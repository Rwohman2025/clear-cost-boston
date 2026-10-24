# quality.py
import duckdb, pandas as pd
from config import PROCS, PAYERS
def quality(con):
    d = con.sql("select * from clean where in_scope").df()
    n_cells = len(PROCS) * len(PAYERS)
    g = d.groupby("hospital")
    q = pd.DataFrame({
        "coverage": g.apply(lambda x: x[x.valid & x.payer.notna()][["code","payer"]].drop_duplicates().shape[0] / n_cells),
        "valid_share": g.valid.mean(),
        "payer_match": g.payer.apply(lambda s: s.notna().mean()),
        "has_medicare_ratio": g.mult.apply(lambda s: s.notna().mean()),
    })
    q["quality_score"] = (100 * (0.4*q.coverage + 0.3*q.valid_share + 0.2*q.payer_match + 0.1*q.has_medicare_ratio)).round(0)
    return q