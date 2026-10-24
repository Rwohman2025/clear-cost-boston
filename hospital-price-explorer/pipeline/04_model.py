import duckdb, numpy as np, statsmodels.formula.api as smf, pandas as pd
con = duckdb.connect("prices.duckdb")
d = con.sql("""select * from clean where in_scope and valid and payer is not null
               and setting in ('inpatient','outpatient')""").df()
d["lp"] = np.log(d.amount)
d["system"] = d.system.astype(str)
d["loc_id"] = d.hospital

# M1: what share of price variance is explained by each factor? (procedure FE absorbs case mix)
m1 = smf.ols("lp ~ C(code) + C(system) + C(payer) + C(setting)", d).fit(
        cov_type="cluster", cov_kwds={"groups": d["hospital"].astype("category").cat.codes})
print(m1.summary().tables[1])
print("R2 full:", m1.rsquared)

# Incremental R2 by factor (drop-one)
base = "lp ~ C(code)"
terms = {"hospital system": "C(system)", "payer": "C(payer)", "setting": "C(setting)"}
r2 = {"procedure only": smf.ols(base, d).fit().rsquared}
for k, t in terms.items():
    r2[f"+ {k}"] = smf.ols(f"{base} + {t}", d).fit().rsquared
r2["all"] = m1.rsquared
print(pd.Series(r2))

# M2: relative price level (Medicare multiple) by hospital/payer/setting
dm = d.dropna(subset=["mult"]).copy(); dm["lm"] = np.log(dm.mult)
m2 = smf.ols("lm ~ C(hospital) + C(payer) + C(setting)", dm).fit(cov_type="HC3")
print(m2.summary().tables[1])
# exp(coef) - 1 = % difference vs reference group
eff = np.exp(m2.params) - 1
ci = np.exp(m2.conf_int()) - 1
print(pd.concat([eff.rename("pct_diff"), ci], axis=1).round(3))