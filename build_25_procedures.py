"""
Build a `three_hospitals_25_procedures`-style workbook from the raw
hospital standard-charge CSVs in ~/Desktop/ds+x.

Output: one Coverage summary sheet, one data sheet per hospital (filtered to
the same 25 CPT/HCPCS codes and reshaped to a standard 25-column layout),
and a Sources and notes sheet.

The source CSVs come in several different schemas, so each schema family has
its own small adapter. Files that don't match a known adapter are skipped
with a logged warning rather than guessed at.

Run:  .venv/bin/python test.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import pandas as pd

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

DATA_DIR = Path.home() / "Desktop" / "ds+x"
OUT_PATH = DATA_DIR / "all_hospitals_25_procedures.xlsx"

# The 25 selected procedures: CPT/HCPCS code -> friendly procedure name.
PROCEDURES: dict[str, str] = {
    "19301": "Breast lumpectomy / partial mastectomy",
    "20680": "Removal of deep orthopedic hardware",
    "21320": "Closed nasal fracture reduction with stabilization",
    "26055": "Trigger finger release",
    "27130": "Total hip replacement",
    "27447": "Total knee replacement",
    "29827": "Arthroscopic rotator cuff repair",
    "29888": "Arthroscopic ACL reconstruction",
    "31237": "Nasal / sinus endoscopy with biopsy, polyp removal or debridement",
    "43248": "Upper endoscopy with guidewire-assisted esophageal dilation",
    "45385": "Colonoscopy with snare removal of polyp / lesion",
    "46250": "External hemorrhoidectomy, 2 or more groups",
    "46260": "Internal and external hemorrhoidectomy, 2 or more columns/groups",
    "49591": "Initial reducible anterior abdominal hernia repair, under 3 cm",
    "49650": "Laparoscopic initial inguinal hernia repair",
    "52234": "Endoscopic removal / destruction of small bladder tumor, 0.5-2 cm",
    "52353": "Ureteroscopy / pyeloscopy with stone fragmentation",
    "55250": "Vasectomy",
    "58150": "Total abdominal hysterectomy",
    "58558": "Hysteroscopy with endometrial sampling / polyp removal",
    "58561": "Hysteroscopic removal of uterine fibroids",
    "58563": "Hysteroscopy with endometrial ablation",
    "58600": "Tubal ligation, abdominal or vaginal approach",
    "60220": "Unilateral thyroid lobectomy",
    "64721": "Open carpal tunnel release",
}
CODE_SET = set(PROCEDURES)

# Standard output columns (match the reference workbook exactly).
OUT_COLS = [
    "CPT code", "Procedure", "Hospital description", "Setting", "Billing class",
    "Payer", "Plan", "Negotiated USD", "Cash USD", "Gross USD", "Minimum USD",
    "Maximum USD", "Negotiated percent", "Algorithm", "Methodology", "Median USD",
    "10th percentile USD", "90th percentile USD", "Count", "Modifiers", "Notes",
    "Source code type", "Source record", "Payer index", "Additional fields JSON",
]

# Which CSVs to process, and which adapter + Excel sheet name to use.
# sheet names are capped at 31 chars by Excel.
HOSPITALS = [
    # file name, sheet name, adapter key
    ("042697983_Massachusetts-General-Hospital_StandardCharges.csv", "Mass General", "mgb"),
    ("042312909_Brigham-and-Womens-Hospital_StandardCharges.csv", "Brigham", "mgb"),
    ("beth_israel_deaconess_prices.csv", "Beth Israel", "beth_israel"),
    ("dana_farber_hospital_prices.csv", "Dana-Farber", "dana_farber"),
    ("boston_childrens_longwood_prices.csv", "Boston Children's", "boston_childrens"),
    ("baystate-medical-center_standardcharges.csv", "Baystate Medical", "baystate"),
    ("baystate-franklin-medical-center_standardcharges.csv", "Baystate Franklin", "baystate"),
    ("baystate-noble-hospital_standardcharges.csv", "Baystate Noble", "baystate"),
    ("baystate-wing-hospital-and-medical-centers_standardcharges.csv", "Baystate Wing", "baystate"),
    ("042103612_new-england-baptist-hospital_standardcharges.json", "NE Baptist", "cms_json"),
    ("Shriners-Childrens-Boston_standardcharges.csv", "Shriners Boston", "wide_payer"),
]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def num(x):
    """Coerce to float, or None if blank/non-numeric."""
    if x is None:
        return None
    s = str(x).strip().replace(",", "").replace("$", "")
    if s == "" or s.lower() == "nan":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def clean(x):
    if x is None:
        return None
    s = str(x).strip()
    return None if s == "" or s.lower() == "nan" else s


def blank_row() -> dict:
    return {c: None for c in OUT_COLS}


def read_csv_robust(path, **kw):
    """Read a CSV trying UTF-8 then Windows-1252 (curly quotes etc.)."""
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            return pd.read_csv(path, encoding=enc, **kw)
        except UnicodeDecodeError:
            continue
    # last resort: replace undecodable bytes
    return pd.read_csv(path, encoding="utf-8", encoding_errors="replace", **kw)


# --------------------------------------------------------------------------
# Adapters: each returns a list of output-row dicts for the 25 codes.
# They read raw so differing metadata header offsets are handled explicitly.
# --------------------------------------------------------------------------

def adapt_mgb(path: Path) -> list[dict]:
    """MGH / Brigham: 2 metadata rows, header on row 3, code|1..4 + *|type."""
    df = read_csv_robust(path, skiprows=2, dtype=str, low_memory=False)
    rows = []
    for _, r in df.iterrows():
        code, ctype, all_codes = _pick_code(r, ("code|1", "code|2", "code|3", "code|4"))
        if code is None:
            continue
        out = blank_row()
        out["CPT code"] = code
        out["Procedure"] = PROCEDURES[code]
        out["Hospital description"] = clean(r.get("description"))
        out["Setting"] = clean(r.get("setting"))
        out["Billing class"] = clean(r.get("billing_class"))
        out["Payer"] = clean(r.get("payer_name"))
        out["Plan"] = clean(r.get("plan_name"))
        out["Negotiated USD"] = num(r.get("standard_charge|negotiated_dollar"))
        out["Cash USD"] = num(r.get("standard_charge|discounted_cash"))
        out["Gross USD"] = num(r.get("standard_charge|gross"))
        out["Minimum USD"] = num(r.get("standard_charge|min"))
        out["Maximum USD"] = num(r.get("standard_charge|max"))
        out["Negotiated percent"] = num(r.get("standard_charge|negotiated_percentage"))
        out["Algorithm"] = clean(r.get("standard_charge|negotiated_algorithm"))
        out["Methodology"] = clean(r.get("standard_charge|methodology"))
        out["Median USD"] = num(r.get("median_amount"))
        out["10th percentile USD"] = num(r.get("10th_percentile"))
        out["90th percentile USD"] = num(r.get("90th_percentile"))
        out["Count"] = clean(r.get("count"))
        out["Modifiers"] = clean(r.get("modifiers"))
        out["Notes"] = clean(r.get("additional_generic_notes"))
        out["Source code type"] = ctype
        out["Additional fields JSON"] = json.dumps({"all_codes": all_codes})
        rows.append(out)
    return rows


def _pick_code(row, code_cols):
    """From code|1..code|N pick the first value that is one of our 25 codes.
    Returns (code, source_type, all_codes_list)."""
    all_codes = []
    found = None
    found_type = None
    for col in code_cols:
        val = clean(row.get(col))
        typ = clean(row.get(f"{col}|type"))
        if val:
            all_codes.append({"code": val, "type": typ or ""})
            if val in CODE_SET and found is None:
                found, found_type = val, typ
    return found, found_type, all_codes


def adapt_baystate(path: Path) -> list[dict]:
    """Baystate family: 2 metadata rows, header on row 3, code|1..3,
    columns use ' | ' spacing in some negotiated fields. Streamed in chunks
    because the files are hundreds of MB."""
    rows = []
    reader = None
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            reader = pd.read_csv(path, skiprows=2, dtype=str, low_memory=False,
                                 chunksize=100_000, encoding=enc)
            # force the first chunk to surface a decode error early
            first = next(reader)
            def _gen(first=first, reader=reader):
                yield first
                yield from reader
            reader = _gen()
            break
        except UnicodeDecodeError:
            reader = None
            continue
    if reader is None:
        reader = pd.read_csv(path, skiprows=2, dtype=str, low_memory=False,
                             chunksize=100_000, encoding="utf-8",
                             encoding_errors="replace")
    for chunk in reader:
        chunk.columns = [c.replace(" | ", "|").strip() for c in chunk.columns]
        for _, r in chunk.iterrows():
            code, ctype, all_codes = _pick_code(r, ("code|1", "code|2", "code|3"))
            if code is None:
                continue
            out = blank_row()
            out["CPT code"] = code
            out["Procedure"] = PROCEDURES[code]
            out["Hospital description"] = clean(r.get("description"))
            out["Setting"] = clean(r.get("setting"))
            out["Payer"] = clean(r.get("payer_name"))
            out["Plan"] = clean(r.get("plan_name"))
            out["Negotiated USD"] = num(r.get("standard_charge|negotiated_dollar"))
            out["Cash USD"] = num(r.get("standard_charge|discounted_cash"))
            out["Gross USD"] = num(r.get("standard_charge|gross"))
            out["Negotiated percent"] = num(r.get("standard_charge|negotiated_percentage"))
            out["Algorithm"] = clean(r.get("standard_charge|negotiated_algorithm"))
            out["Methodology"] = clean(r.get("standard_charge|methodology"))
            out["Modifiers"] = clean(r.get("modifiers"))
            out["Source code type"] = ctype
            out["Additional fields JSON"] = json.dumps({"all_codes": all_codes})
            rows.append(out)
    return rows


def adapt_beth_israel(path: Path) -> list[dict]:
    """BIDMC: flat header, billing_codes + code_types may hold multiple
    semicolon/comma separated codes and parallel types."""
    df = read_csv_robust(path, dtype=str, low_memory=False)
    rows = []
    for _, r in df.iterrows():
        codes = _split(r.get("billing_codes"))
        types = _split(r.get("code_types"))
        all_codes = [{"code": c, "type": (types[i] if i < len(types) else "")}
                     for i, c in enumerate(codes)]
        match = next((c for c in codes if c in CODE_SET), None)
        if match is None:
            continue
        mt = next((types[i] for i, c in enumerate(codes)
                   if c == match and i < len(types)), None)
        out = blank_row()
        out["CPT code"] = match
        out["Procedure"] = PROCEDURES[match]
        out["Hospital description"] = clean(r.get("description"))
        out["Setting"] = clean(r.get("setting"))
        out["Billing class"] = clean(r.get("billing_class"))
        out["Payer"] = clean(r.get("payer_payer_name"))
        out["Plan"] = clean(r.get("payer_plan_name"))
        out["Cash USD"] = num(r.get("discounted_cash"))
        out["Gross USD"] = num(r.get("gross_charge"))
        out["Minimum USD"] = num(r.get("minimum"))
        out["Maximum USD"] = num(r.get("maximum"))
        out["Methodology"] = clean(r.get("payer_methodology"))
        out["Median USD"] = num(r.get("payer_median_amount"))
        out["10th percentile USD"] = num(r.get("payer_10th_percentile"))
        out["90th percentile USD"] = num(r.get("payer_90th_percentile"))
        out["Count"] = clean(r.get("payer_count"))
        out["Modifiers"] = clean(r.get("modifier_code"))
        out["Notes"] = clean(r.get("additional_generic_notes"))
        out["Source code type"] = mt
        out["Additional fields JSON"] = json.dumps({"all_codes": all_codes})
        rows.append(out)
    return rows


def adapt_dana_farber(path: Path) -> list[dict]:
    """Dana-Farber: flat header, single code + code_type columns."""
    df = read_csv_robust(path, dtype=str, low_memory=False)
    rows = []
    for _, r in df.iterrows():
        code = clean(r.get("code"))
        if code not in CODE_SET:
            continue
        ctype = clean(r.get("code_type"))
        out = blank_row()
        out["CPT code"] = code
        out["Procedure"] = PROCEDURES[code]
        out["Hospital description"] = clean(r.get("description"))
        out["Setting"] = clean(r.get("setting"))
        out["Billing class"] = clean(r.get("billing_class"))
        out["Payer"] = clean(r.get("payer_name"))
        out["Plan"] = clean(r.get("plan_name"))
        out["Negotiated USD"] = num(r.get("negotiated_rate"))
        out["Cash USD"] = num(r.get("discounted_cash"))
        out["Gross USD"] = num(r.get("gross_charge"))
        out["Minimum USD"] = num(r.get("minimum"))
        out["Maximum USD"] = num(r.get("maximum"))
        out["Negotiated percent"] = num(r.get("negotiated_percentage"))
        out["Algorithm"] = clean(r.get("negotiated_algorithm"))
        out["Methodology"] = clean(r.get("methodology"))
        out["Modifiers"] = clean(r.get("modifiers"))
        out["Notes"] = clean(r.get("additional_generic_notes"))
        out["Source code type"] = ctype
        out["Additional fields JSON"] = json.dumps(
            {"all_codes": [{"code": code, "type": ctype or ""}]})
        rows.append(out)
    return rows


def adapt_boston_childrens(path: Path) -> list[dict]:
    """Boston Children's: flat header, codes + code_types columns."""
    df = read_csv_robust(path, dtype=str, low_memory=False)
    rows = []
    for _, r in df.iterrows():
        codes = _split(r.get("codes"))
        types = _split(r.get("code_types"))
        match = next((c for c in codes if c in CODE_SET), None)
        if match is None:
            continue
        mt = next((types[i] for i, c in enumerate(codes)
                   if c == match and i < len(types)), None)
        all_codes = [{"code": c, "type": (types[i] if i < len(types) else "")}
                     for i, c in enumerate(codes)]
        out = blank_row()
        out["CPT code"] = match
        out["Procedure"] = PROCEDURES[match]
        out["Hospital description"] = clean(r.get("description"))
        out["Setting"] = clean(r.get("setting"))
        out["Payer"] = clean(r.get("payer_name"))
        out["Plan"] = clean(r.get("plan_name"))
        out["Negotiated USD"] = num(r.get("standard_charge_dollar"))
        out["Cash USD"] = num(r.get("discounted_cash"))
        out["Gross USD"] = num(r.get("gross_charge"))
        out["Minimum USD"] = num(r.get("minimum"))
        out["Maximum USD"] = num(r.get("maximum"))
        out["Algorithm"] = clean(r.get("standard_charge_algorithm"))
        out["Methodology"] = clean(r.get("methodology"))
        out["Median USD"] = num(r.get("median_amount"))
        out["10th percentile USD"] = num(r.get("10th_percentile"))
        out["90th percentile USD"] = num(r.get("90th_percentile"))
        out["Count"] = clean(r.get("count"))
        out["Notes"] = clean(r.get("additional_generic_notes"))
        out["Source code type"] = mt
        out["Additional fields JSON"] = json.dumps({"all_codes": all_codes})
        rows.append(out)
    return rows


def adapt_cms_json(path: Path) -> list[dict]:
    """CMS v3.0.0 machine-readable JSON (e.g. New England Baptist).

    Structure: standard_charge_information[] each has description,
    code_information[] (code + type) and standard_charges[]; each charge
    entry carries setting/billing_class/gross/cash/min/max and a nested
    payers_information[] list. We expand to one output row per
    (matching code, charge entry, payer)."""
    with open(path, encoding="utf-8-sig") as fh:
        doc = json.load(fh)

    rows = []
    for item in doc.get("standard_charge_information", []):
        code_info = item.get("code_information", []) or []
        all_codes = [{"code": str(ci.get("code", "")).strip(),
                      "type": ci.get("type", "")} for ci in code_info]
        match = next((c for c in all_codes if c["code"] in CODE_SET), None)
        if match is None:
            continue
        code = match["code"]
        desc = clean(item.get("description"))

        for sc in item.get("standard_charges", []) or []:
            base = blank_row()
            base["CPT code"] = code
            base["Procedure"] = PROCEDURES[code]
            base["Hospital description"] = desc
            base["Setting"] = clean(sc.get("setting"))
            base["Billing class"] = clean(sc.get("billing_class"))
            base["Cash USD"] = num(sc.get("discounted_cash"))
            base["Gross USD"] = num(sc.get("gross_charge"))
            base["Minimum USD"] = num(sc.get("minimum"))
            base["Maximum USD"] = num(sc.get("maximum"))
            base["Notes"] = clean(sc.get("additional_generic_notes"))
            base["Source code type"] = match["type"]
            base["Additional fields JSON"] = json.dumps({"all_codes": all_codes})

            payers = sc.get("payers_information") or []
            if not payers:
                # gross/cash-only row with no payer-specific negotiated rate
                rows.append(base)
                continue
            for pay in payers:
                out = dict(base)
                out["Payer"] = clean(pay.get("payer_name"))
                out["Plan"] = clean(pay.get("plan_name"))
                out["Negotiated USD"] = num(pay.get("standard_charge_dollar"))
                out["Negotiated percent"] = num(pay.get("standard_charge_percentage"))
                out["Algorithm"] = clean(pay.get("standard_charge_algorithm"))
                out["Methodology"] = clean(pay.get("methodology"))
                out["Median USD"] = num(pay.get("estimated_amount"))
                rows.append(out)
    return rows


def adapt_wide_payer(path: Path) -> list[dict]:
    """CMS 'wide' CSV layout (e.g. Shriners Children's Boston): 2 metadata
    rows, header on row 3, code|1..N, and one column *group* per payer/plan
    like standard_charge|<Payer>|<Plan>|negotiated_dollar plus matching
    percentage / algorithm / methodology and median/percentile/count columns.

    We discover the payer groups from the header, then emit one output row per
    (matching code, payer) that has a negotiated value, plus a gross/cash-only
    row. Streamed in chunks because these files are hundreds of MB."""
    import re

    # Peek at the header to map payer groups.
    header = read_csv_robust(path, skiprows=2, nrows=0)
    cols = list(header.columns)

    # payer -> dict of the per-payer column names we care about
    neg_re = re.compile(r"^standard_charge\|(.+)\|(.+)\|negotiated_dollar$")
    groups = {}  # (payer, plan) -> {field: column}
    for c in cols:
        m = neg_re.match(c)
        if m:
            payer, plan = m.group(1), m.group(2)
            key = (payer, plan)
            g = groups.setdefault(key, {})
            g["neg"] = c
            g["pct"] = f"standard_charge|{payer}|{plan}|negotiated_percentage"
            g["algo"] = f"standard_charge|{payer}|{plan}|negotiated_algorithm"
            g["meth"] = f"standard_charge|{payer}|{plan}|methodology"
            g["median"] = f"median_amount|{payer}|{plan}"
            g["p10"] = f"10th_percentile|{payer}|{plan}"
            g["p90"] = f"90th_percentile|{payer}|{plan}"
            g["count"] = f"count|{payer}|{plan}"
    # keep only columns that actually exist in the file
    colset = set(cols)
    for g in groups.values():
        for k in list(g):
            if g[k] not in colset:
                g.pop(k)

    code_cols = ("code|1", "code|2", "code|3", "code|4")

    rows = []
    reader = None
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            reader = pd.read_csv(path, skiprows=2, dtype=str, low_memory=False,
                                 chunksize=50_000, encoding=enc)
            first = next(reader)
            def _gen(first=first, reader=reader):
                yield first
                yield from reader
            reader = _gen()
            break
        except UnicodeDecodeError:
            reader = None
            continue
    if reader is None:
        reader = pd.read_csv(path, skiprows=2, dtype=str, low_memory=False,
                             chunksize=50_000, encoding="utf-8",
                             encoding_errors="replace")
    for chunk in reader:
        for _, r in chunk.iterrows():
            code, ctype, all_codes = _pick_code(r, code_cols)
            if code is None:
                continue
            base = blank_row()
            base["CPT code"] = code
            base["Procedure"] = PROCEDURES[code]
            base["Hospital description"] = clean(r.get("description"))
            base["Setting"] = clean(r.get("setting"))
            base["Billing class"] = clean(r.get("billing_class"))
            base["Gross USD"] = num(r.get("standard_charge|gross"))
            base["Cash USD"] = num(r.get("standard_charge|discounted_cash"))
            base["Notes"] = clean(r.get("additional_generic_notes"))
            base["Source code type"] = ctype
            base["Modifiers"] = clean(r.get("modifiers"))
            base["Additional fields JSON"] = json.dumps({"all_codes": all_codes})

            emitted = False
            for (payer, plan), g in groups.items():
                neg = num(r.get(g.get("neg")))
                pct = num(r.get(g.get("pct")))
                algo = clean(r.get(g.get("algo")))
                if neg is None and pct is None and algo is None:
                    continue  # this payer has nothing for this row
                out = dict(base)
                out["Payer"] = payer
                out["Plan"] = plan
                out["Negotiated USD"] = neg
                out["Negotiated percent"] = pct
                out["Algorithm"] = algo
                out["Methodology"] = clean(r.get(g.get("meth")))
                out["Median USD"] = num(r.get(g.get("median")))
                out["10th percentile USD"] = num(r.get(g.get("p10")))
                out["90th percentile USD"] = num(r.get(g.get("p90")))
                out["Count"] = clean(r.get(g.get("count")))
                rows.append(out)
                emitted = True

            # keep a gross/cash-only row if no payer-specific rows were made
            if not emitted and (base["Gross USD"] is not None
                                or base["Cash USD"] is not None):
                rows.append(base)
    return rows


def adapt_adcare(path: Path) -> list[dict]:
    """AdCare: 2 metadata rows, header on row 3, 'Code | 1' + 'Code |1| Type'."""
    df = read_csv_robust(path, skiprows=2, dtype=str, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    code_col = _first_col(df, ["Code | 1", "Code |1", "Code|1"])
    type_col = _first_col(df, ["Code |1| Type", "Code | 1 | Type", "Code|1|Type"])
    desc_col = _first_col(df, ["Description", "description"])
    rows = []
    for _, r in df.iterrows():
        code = clean(r.get(code_col))
        if code not in CODE_SET:
            continue
        ctype = clean(r.get(type_col))
        out = blank_row()
        out["CPT code"] = code
        out["Procedure"] = PROCEDURES[code]
        out["Hospital description"] = clean(r.get(desc_col))
        out["Setting"] = clean(r.get("setting"))
        out["Payer"] = clean(r.get("payer_name"))
        out["Plan"] = clean(r.get("plan_name"))
        out["Negotiated USD"] = num(r.get("standard_charge|negotiated_dollar"))
        out["Cash USD"] = num(r.get("standard_charge|discounted_cash"))
        out["Gross USD"] = num(r.get("standard_charge|gross"))
        out["Negotiated percent"] = num(r.get("standard_charge|negotiated_percentage"))
        out["Algorithm"] = clean(r.get("standard_charge|negotiated_algorithm"))
        out["Median USD"] = num(r.get("median_amount"))
        out["10th percentile USD"] = num(r.get("10th_percentile"))
        out["90th percentile USD"] = num(r.get("90th_percentile"))
        out["Count"] = clean(r.get("count"))
        out["Modifiers"] = clean(r.get("modifiers"))
        out["Source code type"] = ctype
        out["Additional fields JSON"] = json.dumps(
            {"all_codes": [{"code": code, "type": ctype or ""}]})
        rows.append(out)
    return rows


def _split(val):
    s = clean(val)
    if not s:
        return []
    for sep in (";", ",", "|"):
        if sep in s:
            return [p.strip() for p in s.split(sep) if p.strip()]
    return [s]


def _first_col(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    return None


ADAPTERS = {
    "mgb": adapt_mgb,
    "baystate": adapt_baystate,
    "beth_israel": adapt_beth_israel,
    "dana_farber": adapt_dana_farber,
    "boston_childrens": adapt_boston_childrens,
    "cms_json": adapt_cms_json,
    "wide_payer": adapt_wide_payer,
    "adcare": adapt_adcare,
}


# --------------------------------------------------------------------------
# Coverage + Sources sheets
# --------------------------------------------------------------------------

def coverage_rows(sheet_name, hospital_label, df) -> list[list]:
    """One row per (hospital, code) with source-row and price-row counts."""
    out = []
    for code, name in PROCEDURES.items():
        sub = df[df["CPT code"] == code] if not df.empty else df
        n_src = len(sub)
        price_cols = ["Negotiated USD", "Cash USD", "Gross USD"]
        n_price = int(sub[price_cols].notna().any(axis=1).sum()) if n_src else 0
        availability = "Found" if n_src else "Not found"
        out.append([hospital_label, code, name, n_src, n_price, availability])
    return out


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def write_sheet_with_banner(writer, sheet_name, hospital_label, df):
    """Write a hospital data sheet with the 4-row banner then the table."""
    book = writer.book
    ws = book.create_sheet(title=sheet_name[:31])
    ws["A2"] = hospital_label
    ws["A3"] = ("USD amounts as published; payer and setting matter. "
                "Additional source fields are at the right.")
    # header on row 5 (1-indexed), data from row 6
    for j, col in enumerate(OUT_COLS, start=1):
        ws.cell(row=5, column=j, value=col)
    for i, (_, r) in enumerate(df.iterrows(), start=6):
        for j, col in enumerate(OUT_COLS, start=1):
            ws.cell(row=i, column=j, value=r[col])


def main():
    if not DATA_DIR.exists():
        sys.exit(f"Data dir not found: {DATA_DIR}")

    per_hospital = []   # (sheet_name, hospital_label, DataFrame)
    coverage = []

    for fname, sheet, key in HOSPITALS:
        path = DATA_DIR / fname
        if not path.exists():
            print(f"[skip] missing file: {fname}")
            continue
        adapter = ADAPTERS.get(key)
        if adapter is None:
            print(f"[skip] no adapter for {fname}")
            continue
        print(f"[read] {sheet:20s} <- {fname}")
        try:
            rows = adapter(path)
        except Exception as e:  # don't let one bad file kill the run
            print(f"[skip] {fname}: adapter failed: {e}")
            continue
        df = pd.DataFrame(rows, columns=OUT_COLS) if rows else pd.DataFrame(columns=OUT_COLS)
        df = df.sort_values(["CPT code", "Payer"], na_position="last") if not df.empty else df
        label = sheet
        per_hospital.append((sheet, label, df))
        coverage.extend(coverage_rows(sheet, label, df))
        print(f"        matched rows: {len(df):,}")

    if not per_hospital:
        sys.exit("No hospital files could be processed.")

    # Write one CSV per hospital (standard 25-column layout, no banner rows).
    for sheet, label, df in per_hospital:
        csv_path = DATA_DIR / f"{sheet}_25_procedures.csv"
        df.to_csv(csv_path, index=False)
        print(f"[csv]  {sheet:20s} -> {csv_path.name} ({len(df):,} rows)")

    # Build workbook
    with pd.ExcelWriter(OUT_PATH, engine="openpyxl") as writer:
        # Coverage sheet
        cov_df = pd.DataFrame(
            coverage,
            columns=["Hospital", "CPT code", "Procedure", "Source rows",
                     "Price rows", "Availability"],
        )
        book = writer.book
        cov_ws = book.create_sheet(title="Coverage")
        cov_ws["A2"] = f"{len(PROCEDURES)} procedures across {len(per_hospital)} hospitals"
        cov_ws["A3"] = ("All 25 selected codes checked per hospital; "
                        "\u201cNot found\u201d refers only to these files.")
        hdr = list(cov_df.columns)
        for j, c in enumerate(hdr, start=1):
            cov_ws.cell(row=5, column=j, value=c)
        for i, (_, r) in enumerate(cov_df.iterrows(), start=6):
            for j, c in enumerate(hdr, start=1):
                cov_ws.cell(row=i, column=j, value=r[c])

        # one sheet per hospital
        for sheet, label, df in per_hospital:
            write_sheet_with_banner(writer, sheet, label, df)

        # Sources and notes
        notes = [
            ["Topic", "Details"],
            ["Scope", "The previously selected 25-code starter shortlist; not a popularity ranking."],
            ["Row meaning", "One source charge/payer record; payer arrays expanded where present; no deduplication."],
            ["Price meaning", "Gross, cash, negotiated, minimum and maximum are separate source fields, not episode totals."],
            ["Count", "Source payer-level count or censored range; not a hospital-wide surgical volume ranking."],
            ["Code matching", "Exact selected five-digit code, labeled CPT or HCPCS in the source. Original label retained."],
            ["Availability", "'Not found' means the code is absent from that hospital's file, not that care is unavailable."],
        ]
        src_ws = book.create_sheet(title="Sources and notes")
        src_ws["A2"] = "Sources and notes"
        for i, (a, b) in enumerate(notes, start=5):
            src_ws.cell(row=i, column=1, value=a)
            src_ws.cell(row=i, column=2, value=b)
        row = 5 + len(notes) + 1
        for sheet, label, df in per_hospital:
            fname = next(f for f, s, k in HOSPITALS if s == sheet)
            src_ws.cell(row=row, column=1, value=label)
            src_ws.cell(row=row, column=2, value=fname)
            row += 1

        # drop the default empty sheet openpyxl creates
        if "Sheet" in book.sheetnames:
            del book["Sheet"]
        # order: Coverage first, Sources last
        book.move_sheet("Coverage", -(book.sheetnames.index("Coverage")))

    print(f"\n[done] wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
