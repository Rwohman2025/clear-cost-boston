import sys, requests, duckdb
from config import FILES, DATA

def fetch(key, meta):
    path = DATA / f"{key}.{meta['fmt']}"
    if not meta["url"]:
        return key, "NO URL"
    try:
        with requests.get(meta["url"], stream=True, timeout=60,
                          headers={"User-Agent": "Mozilla/5.0 (research)"}) as r:
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
    except Exception as e:
        return key, f"DOWNLOAD FAIL: {e}"
    try:
        if meta["fmt"] == "json":
            n = duckdb.sql(f"select count(*) from read_json('{path}', maximum_object_size=1073741824)").fetchone()[0]
        else:  # CMS CSV has 2 metadata rows before the header
            n = duckdb.sql(f"select count(*) from read_csv('{path}', skip=2, all_varchar=true, ignore_errors=true)").fetchone()[0]
        return key, f"OK ({path.stat().st_size/1e6:.0f} MB, {n} top-level rows)"
    except Exception as e:
        return key, f"PARSE FAIL: {e}"

if __name__ == "__main__":
    for k, m in FILES.items():
        print(*fetch(k, m), sep="  ")