from pathlib import Path
DATA = Path("data"); DATA.mkdir(exist_ok=True)
DB = "prices.duckdb"

# Fill in from each hospital's "standard charges" page (CMS-required MRF).
# Mark loc = location label; Children's has 4 separate files.
FILES = {
    # "bch_longwood":  dict(system="Boston Children's", loc="Longwood",  url="", fmt="json"),
    # "bch_brookline": dict(system="Boston Children's", loc="Brookline", url="", fmt="json"),
    # "bch_peabody":   dict(system="Boston Children's", loc="Peabody",   url="", fmt="json"),
    # "bch_lexington": dict(system="Boston Children's", loc="Lexington", url="", fmt="json"),
    # "mgh":  dict(system="Mass General Brigham", loc="MGH", url="", fmt="csv"),
    # "bwh":  ..., "bidmc": ..., "bmc": ..., "tufts": ..., "lahey": ...
}

# Procedure crosswalk: CPT/HCPCS -> friendly name. Extend to 15-20.
PROCS = {
    "70551": "MRI brain w/o contrast",
    "73721": "MRI knee w/o contrast",
    "72148": "MRI lumbar spine w/o contrast",
    "42821": "Tonsillectomy/adenoidectomy (age>=12)",
    "42820": "Tonsillectomy/adenoidectomy (age<12)",
    "69436": "Ear tubes (tympanostomy), general anesthesia",
    "85025": "CBC w/ differential",
    "80053": "Comprehensive metabolic panel",
    "80061": "Lipid panel",
    "84443": "TSH",
    "99283": "ED visit, moderate",
    "99284": "ED visit, high",
    "71046": "Chest X-ray, 2 views",
    "76700": "Abdominal ultrasound",
    "45378": "Colonoscopy, diagnostic",
    "93000": "ECG",
}
PAYERS = {  # canonical -> regex on normalized payer text
    "Blue Cross Blue Shield": r"blue cross|bcbs|\bbcbsma\b",
    "Harvard Pilgrim":        r"harvard|\bhphc\b",
    "Tufts Health Plan":      r"tufts|point32|\bthp\b",
    "Aetna":                  r"aetna",
}
# Placeholder rule (documented in README):
PLACEHOLDER_VALUES = {0, 9999, 99999, 999999, 9999999, 99999999, 1, 0.01}
PRICE_MAX = 1_000_000