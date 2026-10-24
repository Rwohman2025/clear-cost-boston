import duckdb, numpy as np, pandas as pd, itertools
from scipy import stats
con = duckdb.connect("prices.duckdb")
b = con.sql("""select loc, code, payer, setting, median(amount) amt
               from clean where valid and in_scope and system = 'Boston Children''s' and payer is not null
               group by all""").df()
w = b.pivot_table(index=["code","payer","setting"], columns="loc", values="amt").dropna()
print("comparable (code,payer,setting) cells:", len(w))

rows = []
for a, c in itertools.combinations(w.columns, 2):
    ratio = np.log(w[a] / w[c])
    ident = (w[a] == w[c]).mean()
    p = stats.wilcoxon(ratio[ratio != 0]).pvalue if (ratio != 0).any() else 1.0
    rows.append(dict(pair=f"{a} vs {c}", pct_identical=ident,
                     median_pct_diff=np.exp(ratio.median()) - 1,
                     max_abs_pct_diff=np.exp(ratio.abs().max()) - 1, wilcoxon_p=p))
res = pd.DataFrame(rows)
res["p_holm"] = np.minimum(1, res.wilcoxon_p * (len(res) - res.wilcoxon_p.rank() + 1))  # Holm-style
print(res.round(4))
# Finding rule: if pct_identical > ~95% and median_pct_diff ~ 0 for all pairs -> "no location pricing; one chargemaster."
# Also compare the files' hashes/row counts: duplicated files are a data-quality finding in itself.