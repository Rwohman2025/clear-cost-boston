import duckdb, re, pandas as pd, numpy as np
from config import PROCS, PAYERS, PLACEHOLDER_VALUES, PRICE_MAX, DB
con = duckdb.connect(DB)
df = con.sql("select * from raw").df()
n0 = len(df)

# --- codes: strip, uppercase, drop modifiers (e.g. "70551-26" or "70551|26")
df["code"] = df["code"].astype(str).str.upper().str.extract(r"^([A-Z0-9]{5})")[0]
df["in_scope"] = df["code"].isin(PROCS)
df["proc"] = df["code"].map(PROCS)

# --- payer: lowercase, strip punctuation, regex to canonical
def norm_payer(*parts):
    t = re.sub(r"[^a-z0-9 ]", " ", " ".join(str(p) for p in parts if pd.notna(p)).lower())
    for canon, rx in PAYERS.items():
        if re.search(rx, t): return canon
    return None
df["payer"] = [norm_payer(a, b) for a, b in zip(df.payer_raw, df.plan_raw)]

# --- setting: normalize to outpatient / inpatient
df["setting"] = df.setting.str.lower().map(
    lambda s: "inpatient" if s and "inpat" in s else ("outpatient" if s and "outpat" in s else s))

# --- outlier / placeholder rule (documented):
#  R1 amount missing or <= 0
#  R2 amount in PLACEHOLDER_VALUES (0, 1, 0.01, 9999, 99999, 999999, ...)
#  R3 amount >= PRICE_MAX (1,000,000)
#  R4 repeating-digit pattern (e.g. 99999.99, 888888)
#  R5 within code: > 20x or < 1/20 of the code's cross-hospital median (flag, not drop)
a = df.amount
df["flag_missing"]  = a.isna() | (a <= 0)
df["flag_placeholder"] = a.isin(PLACEHOLDER_VALUES) | a.round().astype("Int64").astype(str).str.fullmatch(r"(\d)\1{3,}").fillna(False)
df["flag_huge"] = a >= PRICE_MAX
med = df.loc[~(df.flag_missing | df.flag_placeholder | df.flag_huge)].groupby("code").amount.median()
df["code_median"] = df.code.map(med)
df["flag_stat"] = (a > 20 * df.code_median) | (a < df.code_median / 20)
df["valid"] = ~(df.flag_missing | df.flag_placeholder | df.flag_huge)   # R5 kept but flagged only

# --- Medicare benchmark: load CMS PFS / OPPS rates into table `medicare(code, rate)`
# (CMS Physician Fee Schedule national payment, and OPPS APC rate for facility.)
try:
    mc = con.sql("select code, rate from medicare").df()
    df = df.merge(mc, on="code", how="left")
    df["mult"] = df.amount / df.rate
except duckdb.CatalogException:
    df["rate"] = np.nan; df["mult"] = np.nan

# --- match-rate report
rep = {
  "rows_raw": n0,
  "rows_in_scope_code": int(df.in_scope.sum()),
  "pct_in_scope": df.in_scope.mean(),
  "payer_match_rate_(in-scope rows)": df.loc[df.in_scope, "payer"].notna().mean(),
  "valid_rate_(in-scope, matched payer)": df.loc[df.in_scope & df.payer.notna(), "valid"].mean(),
}
print(pd.Series(rep))
print(df[df.in_scope].groupby("hospital").agg(
    codes=("code","nunique"), rows=("code","size"),
    payer_match=("payer", lambda s: s.notna().mean()), valid=("valid","mean")))
# Unmatched payers worth reviewing by hand:
print(df[df.in_scope & df.payer.isna()].payer_raw.value_counts().head(30))

con.register("clean", df); con.execute("create or replace table clean as select * from clean")
con.close()
