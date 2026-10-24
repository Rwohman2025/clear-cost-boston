"""Load the real published prices from three_hospitals_25_procedures.xlsx into the `raw` table.

Alternative to 02_load.py (which reads the full CMS CSVs from a local folder). The output table has
the same columns, so 03_clean.py and everything downstream work unchanged.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import duckdb
import pandas as pd

from config import DB, PROCS, XLSX

# sheet name -> (short hospital id used downstream, health system, last_updated from the "Sources and notes" sheet)
SHEETS = {
    "Beth Israel":  ("BIDMC", "Beth Israel Lahey Health", "2026-04-01"),
    "Mass General": ("MGH",   "Mass General Brigham",     "2026-03-27"),
    "Brigham":      ("BWH",   "Mass General Brigham",     "2026-03-27"),
}
HEADER_ROW = 4  # 0-based row of the column headers (rows above are a title and a note)


def num(s):
    return pd.to_numeric(s, errors="coerce")


def load(xlsx=XLSX, db=DB):
    frames = []
    for sheet, (hospital, system, updated) in SHEETS.items():
        d = pd.read_excel(xlsx, sheet_name=sheet, header=HEADER_ROW, dtype={"CPT code": str})
        frames.append(pd.DataFrame({
            "hospital": hospital, "system": system,
            "code": d["CPT code"].astype(str).str.strip(),
            "description": d["Hospital description"],
            "payer_raw": d["Payer"], "plan_raw": d["Plan"],
            "setting": d["Setting"], "billing_class": d["Billing class"],
            "gross": num(d["Gross USD"]), "cash": num(d["Cash USD"]), "amount": num(d["Negotiated USD"]),
            "methodology": d["Methodology"], "est_pct": num(d["Negotiated percent"]),
            "median_amt": num(d["Median USD"]), "p10": num(d["10th percentile USD"]), "p90": num(d["90th percentile USD"]),
            "last_updated": updated,
        }))
    raw = pd.concat(frames, ignore_index=True)
    raw = raw[raw.code.isin(PROCS)]
    con = duckdb.connect(db)
    con.register("raw_df", raw)
    con.execute("create or replace table raw as select * from raw_df")
    print(con.sql("select hospital, count(*) rows, count(distinct code) codes, count(amount) with_negotiated "
                  "from raw group by 1 order by 1").df())
    con.close()


if __name__ == "__main__":
    load(*(sys.argv[1:2] and [Path(sys.argv[1])]))
