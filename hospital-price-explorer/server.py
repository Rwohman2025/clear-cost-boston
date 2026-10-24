"""ClearCost Boston API: serves the cleaned DuckDB tables in the shape the React frontend expects.

    python build_db.py                 # once: load the spreadsheet + clean -> data/db/prices.duckdb
    uvicorn server:app --port 8000     # then run the API

Response shapes mirror src/lib/models/types.ts in the frontend (camelCase). Endpoints are the ones
sketched in src/lib/api/http-api.ts.
"""
import math
import os
import re
import secrets
import io
import runpy
from pathlib import Path
from datetime import date, datetime
from functools import lru_cache

import duckdb
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from config import CATEGORIES, DB, PROCS, XLSX

# Hospital identity and source metadata. The spreadsheet carries no address or bed data, so only
# facts we can state are included; `last_published` comes from the spreadsheet's "Sources and notes".
DEFAULT_HOSPITALS = {
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
HOSPITALS = dict(DEFAULT_HOSPITALS)
BY_CODE = {h["code"]: hid for hid, h in HOSPITALS.items()}
PRICE_TYPES = ("gross", "cash", "negotiated")

app = FastAPI(title="ClearCost Boston API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*", "X-Admin-Key"])


def ensure_admin_tables():
    con = duckdb.connect(DB)
    con.execute("""create table if not exists hospital_registry (
        id varchar primary key, code varchar, name varchar, short_name varchar, neighborhood varchar,
        city varchar, source varchar, published varchar, uploaded_at timestamp default current_timestamp
    )""")
    con.close()


def refresh_hospitals():
    """Merge persistent admin-uploaded hospitals into the built-in starter catalog."""
    global HOSPITALS, BY_CODE
    catalog = dict(DEFAULT_HOSPITALS)
    try:
        con = duckdb.connect(DB, read_only=True)
        rows = con.execute("select id, code, name, short_name, neighborhood, city, source, published from hospital_registry").fetchall()
        con.close()
    except duckdb.Error:
        rows = []
    for hid, code, name, short_name, neighborhood, city, source, published in rows:
        catalog[hid] = dict(code=code, name=name, shortName=short_name or code, neighborhood=neighborhood or "Greater Boston", published=published or date.today().isoformat(), source=source or "Admin CSV upload", city=city or "Boston")
    HOSPITALS = catalog
    BY_CODE = {h["code"]: hid for hid, h in catalog.items()}


def require_admin_key(username: str | None, key: str | None):
    expected_username = os.environ.get("ADMIN_USERNAME")
    expected_key = os.environ.get("ADMIN_API_KEY")
    if not expected_username or not expected_key:
        raise HTTPException(503, "Admin uploads are disabled. Set ADMIN_USERNAME and ADMIN_API_KEY on the API service first.")
    if not username or not key or not secrets.compare_digest(username, expected_username) or not secrets.compare_digest(key, expected_key):
        raise HTTPException(401, "Invalid admin credentials")


def normalize_id(value: str) -> str:
    result = slug(value)
    if not result or len(result) > 48:
        raise HTTPException(422, "Hospital ID must contain letters or numbers and be at most 48 characters.")
    return result


def upload_frame(contents: bytes, hospital_code: str, hospital_name: str, system: str, published: str):
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(413, "CSV files must be 25 MB or smaller.")
    try:
        import pandas as pd
        source = pd.read_csv(io.BytesIO(contents), dtype=str)
    except Exception as error:
        raise HTTPException(422, f"Could not read CSV: {error}") from error
    aliases = {
        "cpt": "code", "cpt_code": "code", "hcpcs": "code", "procedure_code": "code",
        "payer": "payer_raw", "payer_name": "payer_raw", "plan": "plan_raw", "plan_name": "plan_raw",
        "negotiated": "amount", "negotiated_usd": "amount", "negotiated_rate": "amount",
        "gross_usd": "gross", "gross_charge": "gross", "cash_usd": "cash", "cash_price": "cash",
        "service_setting": "setting", "description": "description", "procedure_description": "description",
    }
    source.columns = [aliases.get(str(c).strip().lower().replace(" ", "_"), str(c).strip().lower().replace(" ", "_")) for c in source.columns]
    if "code" not in source or "setting" not in source:
        raise HTTPException(422, "CSV needs code (or CPT code) and setting columns.")
    if not any(c in source for c in ("amount", "gross", "cash")):
        raise HTTPException(422, "CSV needs at least one price column: negotiated, gross, or cash.")
    def col(name, default=None):
        return source[name] if name in source else default
    frame = pd.DataFrame({
        "hospital": hospital_code, "system": system or hospital_name, "code": col("code").astype(str).str.strip(),
        "description": col("description", ""), "payer_raw": col("payer_raw", ""), "plan_raw": col("plan_raw", ""),
        "setting": col("setting").astype(str).str.strip(), "billing_class": col("billing_class", ""),
        "gross": pd.to_numeric(col("gross"), errors="coerce"), "cash": pd.to_numeric(col("cash"), errors="coerce"),
        "amount": pd.to_numeric(col("amount"), errors="coerce"), "methodology": col("methodology", "admin-upload"),
        "est_pct": pd.to_numeric(col("est_pct"), errors="coerce"), "median_amt": pd.to_numeric(col("median_amt"), errors="coerce"),
        "p10": pd.to_numeric(col("p10"), errors="coerce"), "p90": pd.to_numeric(col("p90"), errors="coerce"), "last_updated": published,
    })
    frame = frame[frame.code.str.match(r"^[A-Za-z0-9]{5}", na=False)].copy()
    if frame.empty:
        raise HTTPException(422, "No rows contained a five-character CPT or HCPCS code.")
    return frame


# ---------------------------------------------------------------- data access

@lru_cache(maxsize=1)
def load():
    """Read the cleaned table once. Restart the server after re-running build_db.py."""
    try:
        refresh_hospitals()
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
    return dict(id=hid, name=h["name"], shortName=h["shortName"], neighborhood=h["neighborhood"], city=h.get("city", "Boston"),
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


@app.get("/api/admin/template")
def admin_template(x_admin_username: str | None = Header(None), x_admin_key: str | None = Header(None)):
    require_admin_key(x_admin_username, x_admin_key)
    return {"columns": ["code", "description", "payer", "plan", "setting", "gross", "cash", "negotiated"], "required": ["code", "setting"], "priceColumns": ["gross", "cash", "negotiated"]}


@app.post("/api/admin/uploads")
async def admin_upload(
    file: UploadFile = File(...),
    hospital_name: str = Form(...),
    hospital_code: str = Form(...),
    system: str = Form(""),
    neighborhood: str = Form("Greater Boston"),
    city: str = Form("Boston"),
    published: str = Form(""),
    replace: bool = Form(False),
    x_admin_username: str | None = Header(None),
    x_admin_key: str | None = Header(None),
):
    require_admin_key(x_admin_username, x_admin_key)
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(422, "Upload a CSV file.")
    hospital_id = normalize_id(hospital_code)
    code = hospital_code.upper().strip()
    if not code:
        raise HTTPException(422, "Hospital code is required.")
    published = published or date.today().isoformat()
    try:
        date.fromisoformat(published)
    except ValueError as error:
        raise HTTPException(422, "Published date must be YYYY-MM-DD.") from error
    frame = upload_frame(await file.read(), code, hospital_name.strip(), system.strip(), published)
    ensure_admin_tables()
    con = duckdb.connect(DB)
    try:
        exists = con.execute("select count(*) from hospital_registry where id = ?", [hospital_id]).fetchone()[0]
        if exists and not replace:
            raise HTTPException(409, "That hospital already exists. Select replace to replace its uploaded records.")
        con.execute("begin transaction")
        if exists:
            old_code = con.execute("select code from hospital_registry where id = ?", [hospital_id]).fetchone()[0]
            con.execute("delete from raw where hospital = ?", [old_code])
            con.execute("delete from hospital_registry where id = ?", [hospital_id])
        con.register("uploaded_rows", frame)
        con.execute("insert into raw select * from uploaded_rows")
        con.execute("insert into hospital_registry (id, code, name, short_name, neighborhood, city, source, published) values (?, ?, ?, ?, ?, ?, ?, ?)", [hospital_id, code, hospital_name.strip(), code, neighborhood.strip(), city.strip(), file.filename, published])
        con.execute("commit")
    except HTTPException:
        con.execute("rollback")
        raise
    except Exception as error:
        con.execute("rollback")
        raise HTTPException(500, f"Upload was not saved: {error}") from error
    finally:
        con.close()
    # Rebuild the cleaned view from raw records before exposing the upload.
    runpy.run_path(str(Path(__file__).resolve().parent / "pipeline" / "03_clean.py"))
    load.cache_clear()
    refresh_hospitals()
    return {"status": "ok", "hospitalId": hospital_id, "rowsImported": int(len(frame)), "inScopeRows": int(frame.code.isin(PROCS).sum())}
