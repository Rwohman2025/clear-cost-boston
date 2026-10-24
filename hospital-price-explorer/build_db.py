"""Build data/db/prices.duckdb from the real-data spreadsheet: load -> clean.

    python build_db.py [path/to/prices.xlsx]
"""
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

if __name__ == "__main__":
    load = runpy.run_path(str(ROOT / "pipeline" / "02_load_xlsx.py"))["load"]
    load(*(sys.argv[1:2] and [Path(sys.argv[1])]))
    runpy.run_path(str(ROOT / "pipeline" / "03_clean.py"))
    print("\nDone. Start the API with: uvicorn server:app --port 8000")
