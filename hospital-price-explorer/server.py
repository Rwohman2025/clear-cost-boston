"""ClearCost Boston API: serves the cleaned DuckDB tables in the shape the React frontend expects.

    python build_db.py                 # once: load the spreadsheet + clean -> data/db/prices.duckdb
    uvicorn server:app --port 8000     # then run the API

Response shapes mirror src/lib/models/types.ts in the frontend (camelCase). Endpoints are the ones
sketched in src/lib/api/http-api.ts.
"""
import math
import re
from datetime import date, datetime
from functools import lru_cache

import duckdb
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import CATEGORIES, DB, PROCS, XLSX

# Hospital identity and source metadata. The spreadsheet carries no address or bed data, so only
# facts we can state are included; `last_published` comes from the spreadsheet's "Sources and notes".
HOSPITALS = {
    "bidmc": dict(code="BIDMC", name="Beth Israel Deaconess Medical Center", shortName="BIDMC",
                  neighborhood="Longwood Medical Area", published="2026-04-01",
                  source="hospital_prices_flattened.zip"),
    "mgh": dict(code="MGH", name="Massachusetts General Hospital", shortName="MGH",
                neighborhood="West End", published="2026-03-27",
                source="042697983_Massachusetts-General-Hospital_StandardCharges.zip"),
    "bwh": dict(code="BWH", name="Brigham and Women's Hospital", shortName="BWH",
                neighborhood="Mission Hill", published="2026-03-27",
                source="042312909_Brigham-and-Womens-Hospital_StandardCharges.zip"),
}
BY_CODE = {h["code"]: hid for hid, h in HOSPITALS.items()}
PRICE_TYPES = ("gross", "cash", "negotiated")

app = FastAPI(title="ClearCost Boston API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


# ---------------------------------------------------------------- data access

@lru_cache(maxsize=1)
def load():
    """Read the cleaned table once. Restart the server after re-running build_db.py."""
    try:
        con = duckdb.connect(DB, read_only=True)
        df = con.sql("select * from clean where in_scope").df()
        con.close()
    except duckdb.Error as e:
        raise RuntimeError(f"Could not read {DB}. Run `python build_db.py` first. ({e})")
    df["hid"] = df.hospital.map(BY_CODE)
    df["bad"] = df.flag_missing | df.flag_placeholder | df.flag_huge
    return df


def retrieved_at() -> str:
    """Date the source spreadsheet was last built into the DB (proxy for 'retrieved')."""
    return datetime.fromtimestamp(XLSX.stat().st_mtime).date().isoformat() if XLSX.exists() else date.today().isoformat()


def clean_num(x):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else float(x)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ---------------------------------------------------------------- shapes

def hospital_json(hid: str) -> dict:
    h = HOSPITALS[hid]
    return dict(id=hid, name=h["name"], shortName=h["shortName"], neighborhood=h["neighborhood"], city="Boston",
                type="Academic medical center", beds=None, sourceUrl=h["source"], sourceFormat="CSV",
                lastPublished=h["published"], lastRetrieved=retrieved_at())


def procedure_json(code: str) -> dict:
    return dict(code=code, codeType="CPT", name=PROCS[code], category=CATEGORIES.get(code, "Procedure"),
                defaultSetting="outpatient")


def payer_list() -> list[dict]:
    names = sorted(load().payer.dropna().unique())
    return [dict(id=slug(n), name=n) for n in names]


def setting_ok(df, setting: str):
    """Source rows marked 'both' apply to either setting."""
    return df[df.setting.isin([setting, "both"])]


def amounts(df, hid: str, code: str, price_type: str, setting: str, payer_id: str | None):
    """Usable published amounts for one hospital x code x price type (x payer for negotiated)."""
    d = setting_ok(df[(df.hid == hid) & (df.code == code)], setting)
    if price_type == "negotiated":
        d = d[~d.bad & d.payer.notna()]
        if payer_id:
            d = d[d.payer.map(lambda p: slug(p)) == payer_id]
        vals = d.amount
    else:
        vals = d[price_type]
    return [float(v) for v in vals.dropna() if v > 0]


def stats_for(values: list[float]):
    if not values:
        return None
    a = np.sort(np.array(values, dtype=float))
    mean = float(a.mean())
    return dict(count=int(a.size), min=float(a[0]), max=float(a[-1]), median=float(np.percentile(a, 50)), mean=mean,
                p25=float(np.percentile(a, 25)), p75=float(np.percentile(a, 75)),
                spreadRatio=float(a[-1] / a[0]) if a[0] > 0 else None,
                cv=float(a.std() / mean) if mean > 0 else 0.0)


def is_outlier(v: float, s: dict) -> bool:
    iqr = s["p75"] - s["p25"]
    return v < s["p25"] - 1.5 * iqr or v > s["p75"] + 1.5 * iqr


def quality_for(hid: str) -> dict:
    df = load()
    d = df[df.hid == hid]
    present = 0
    for code in PROCS:
        c = d[d.code == code]
        present += int(c.cash.notna().any()) + int(c.gross.notna().any()) + int((~c.bad & c.payer.notna()).any())
    expected = len(PROCS) * len(PRICE_TYPES)
    completeness = round(present / expected * 100)
    today = date.today()
    pub_age = (today - date.fromisoformat(HOSPITALS[hid]["published"])).days
    days = (today - date.fromisoformat(retrieved_at())).days
    freshness = max(0.0, 100 - pub_age / 3)
    comparability = min(100, round(completeness * 0.6 + freshness * 0.3 + 6))
    outliers = int((d.flag_stat.fillna(False) | d.flag_placeholder | d.flag_huge).sum())
    return dict(hospital=hospital_json(hid), completeness=completeness, missingCount=expected - present,
                expectedCount=expected, outlierCount=outliers, daysSinceRetrieved=days, comparability=comparability)


# ---------------------------------------------------------------- endpoints

@app.get("/api/health")
def health():
    df = load()
    return dict(status="ok", rows=int(len(df)), hospitals=len(HOSPITALS), procedures=len(PROCS), source=XLSX.name)


@app.get("/api/procedures")
def procedures(q: str = ""):
    q = q.strip().lower()
    return [procedure_json(c) for c, n in PROCS.items() if not q or q in c.lower() or q in n.lower()]


@app.get("/api/procedures/{code}")
def procedure(code: str):
    if code not in PROCS:
        raise HTTPException(404, "Unknown procedure code")
    return procedure_json(code)


@app.get("/api/hospitals")
def hospitals(q: str = ""):
    q = q.strip().lower()
    out = [hospital_json(h) for h in HOSPITALS]
    return [h for h in out if not q or q in f'{h["name"]} {h["city"]} {h["neighborhood"]}'.lower()]


@app.get("/api/hospitals/{hospital_id}")
def hospital(hospital_id: str):
    if hospital_id not in HOSPITALS:
        raise HTTPException(404, "Unknown hospital")
    return hospital_json(hospital_id)


@app.get("/api/payers")
def payers():
    return payer_list()


@app.get("/api/prices/compare")
def compare(code: str, priceType: str = "cash", setting: str = "outpatient", payerId: str = "",
            hospitalIds: str = Query("", description="comma-separated hospital ids")):
    if code not in PROCS:
        raise HTTPException(404, f"Unknown procedure code {code}")
    if priceType not in PRICE_TYPES or setting not in ("inpatient", "outpatient"):
        raise HTTPException(400, "Invalid priceType or setting")
    df = load()
    scope = [h for h in (hospitalIds.split(",") if hospitalIds else HOSPITALS) if h in HOSPITALS]
    payer = payerId or None
    found = {}
    for hid in scope:
        vals = amounts(df, hid, code, priceType, setting, payer)
        if vals:
            found[hid] = float(np.median(vals))
    stats = stats_for(list(found.values()))
    retrieved = retrieved_at()
    rows = [dict(
        hospital=hospital_json(hid), amount=amt,
        record=dict(id=f"{hid}-{code}-{setting}-{priceType}-{payer or 'all'}", hospitalId=hid, code=code,
                    priceType=priceType, payerId=payer if priceType == "negotiated" else None, setting=setting,
                    amount=amt, retrievedAt=retrieved, sourceUrl=HOSPITALS[hid]["source"]),
        isOutlier=bool(stats and is_outlier(amt, stats)),
        comparability=quality_for(hid)["comparability"],
    ) for hid, amt in found.items()]
    return dict(procedure=procedure_json(code),
                filters=dict(code=code, priceType=priceType, setting=setting, payerId=payer),
                rows=rows, stats=stats, missingHospitals=[hospital_json(h) for h in scope if h not in found])


@app.get("/api/hospitals/{hospital_id}/prices")
def hospital_prices(hospital_id: str):
    if hospital_id not in HOSPITALS:
        raise HTTPException(404, "Unknown hospital")
    df = load()
    out = []
    for code in PROCS:
        mine = amounts(df, hospital_id, code, "cash", "outpatient", None)
        gross = amounts(df, hospital_id, code, "gross", "outpatient", None)
        neg = amounts(df, hospital_id, code, "negotiated", "outpatient", None)
        market = [float(np.median(v)) for h in HOSPITALS if (v := amounts(df, h, code, "cash", "outpatient", None))]
        out.append(dict(procedure=procedure_json(code),
                        cash=clean_num(np.median(mine)) if mine else None,
                        gross=clean_num(np.median(gross)) if gross else None,
                        negotiatedMedian=clean_num(np.median(neg)) if neg else None,
                        marketCashMedian=clean_num(np.median(market)) if market else None))
    return out


@app.get("/api/quality")
def quality():
    return [quality_for(h) for h in HOSPITALS]
