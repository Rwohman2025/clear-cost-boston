import duckdb, pandas as pd, streamlit as st
from config import PROCS, DB
from quality import quality
con = duckdb.connect(DB, read_only=True)
st.title("Boston Hospital Price Explorer")
proc = st.selectbox("Procedure", list(PROCS), format_func=lambda c: f"{c} · {PROCS[c]}")
payers = con.sql("select distinct payer from clean where payer is not null order by 1").df().payer.tolist()
payer = st.selectbox("Insurer", payers)
setting = st.radio("Setting", ["outpatient", "inpatient"], horizontal=True)

df = con.sql("""
 select system, hospital,
        count(*) n_rates, min(amount) low, quantile_cont(amount,0.1) p10,
        median(amount) median, quantile_cont(amount,0.9) p90, max(amount) high,
        median(mult) medicare_multiple
 from clean where code=? and payer=? and setting=? and valid
 group by all order by median""", [proc, payer, setting]).df()
q = quality(con)[["quality_score"]].reset_index()
out = df.merge(q, on="hospital", how="left")
out["rank"] = range(1, len(out) + 1)
st.dataframe(out[["rank","hospital","median","low","high","n_rates","medicare_multiple","quality_score"]]
             .style.format({"median":"${:,.0f}","low":"${:,.0f}","high":"${:,.0f}","medicare_multiple":"{:.1f}x"}))
st.caption("Range = min–max of posted negotiated rates across this insurer's plans. n_rates=1 means no range. "
           "Quality score <60: treat the ranking with caution.")
if len(out):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots()
    ax.barh(out.hospital, out["median"], xerr=[out["median"]-out.p10, out.p90-out["median"]], capsize=3)
    ax.invert_yaxis(); ax.set_xlabel("Median negotiated rate ($), whiskers = 10th–90th pct")
    st.pyplot(fig)
else:
    st.warning("No valid posted price for this combination.")