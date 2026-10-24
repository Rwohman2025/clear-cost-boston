"""Start the API and initialize a mounted persistent data directory when configured."""
import os
import shutil
from pathlib import Path

from config import DB, SEED_DB

def bootstrap_data():
    target = Path(DB)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() and SEED_DB.exists():
        shutil.copy2(SEED_DB, target)

if __name__ == "__main__":
    bootstrap_data()
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
