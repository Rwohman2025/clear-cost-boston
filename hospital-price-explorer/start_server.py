"""Start the API and initialize a mounted persistent data directory when configured."""
import os
import shutil
from pathlib import Path

import duckdb

from config import DB, SEED_DB

def bootstrap_data():
    target = Path(DB)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() and SEED_DB.exists():
        # Copy the schema-bearing seed database, then optionally remove its starter rows.
        # This leaves a ready-to-import empty database on a fresh persistent volume.
        shutil.copy2(SEED_DB, target)
        if os.environ.get("START_WITH_EMPTY_CATALOG", "").lower() in {"1", "true", "yes"}:
            con = duckdb.connect(target)
            con.execute("delete from raw")
            con.execute("delete from clean")
            con.close()

if __name__ == "__main__":
    bootstrap_data()
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
