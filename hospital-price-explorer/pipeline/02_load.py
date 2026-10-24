import duckdb
from config import PROCS, DB
con = duckdb.connect(DB)
D = r"C:\Users\iminl\Documents\Hackathons\DS+X\Data Sets"
codes = ",".join(f"'{c}'" for c in PROCS)

con.execute("""create or replace table raw (
  hospital varchar, system varchar, code varchar, description varchar,
  payer_raw varchar, plan_raw varchar, setting varchar, billing_class varchar,
  gross double, cash double, amount double, methodology varchar, est_pct double,
  median_amt double, p10 double, p90 double, last_updated varchar)""")

def load_tall(name, system, fname):
    # CMS tall CSV: 2 metadata rows, then header. Real CPT may sit in code|1..4.
    cpt = " ,".join([f"""case when "code|{i}|type" in ('CPT','HCPCS') then "code|{i}" end"""
                     for i in (1, 2, 3, 4)])
    con.execute(f"""
    create or replace temp view t as
    select * from read_csv('{D}\\{fname}', skip=2, header=true, all_varchar=true,
                           ignore_errors=true, null_padding=true);
    create or replace temp view meta as
    select hospital_name, last_updated_on from read_csv('{D}\\{fname}', header=true,
           all_varchar=true, ignore_errors=true, null_padding=true) limit 1;
    insert into raw
    select '{name}', '{system}', c, description, payer_name, plan_name, setting, null,
           try_cast("standard_charge|gross" as double), try_cast("standard_charge|discounted_cash" as double),
           try_cast("standard_charge|negotiated_dollar" as double), "standard_charge|methodology",
           try_cast("standard_charge|negotiated_percentage" as double),
           try_cast(median_amount as double), try_cast("10th_percentile" as double),
           try_cast("90th_percentile" as double), (select last_updated_on from meta)
    from (select *, coalesce({cpt}) as c from t)
    where c in ({codes})""")

def load_bidmc(fname):
    con.execute(f"""
    insert into raw
    select 'BIDMC', 'BIDMC', c, description, "payer.payer_name", "payer.plan_name", setting, billing_class,
           try_cast(gross_charge as double), try_cast(discounted_cash as double),
           try_cast("payer.standard_charge_dollar" as double), "payer.methodology", null,
           try_cast("payer.median_amount" as double), try_cast("payer.10th_percentile" as double),
           try_cast("payer.90th_percentile" as double), last_updated_on
    from (select *, coalesce(
            case when "code_information.1.type" in ('CPT','HCPCS') then "code_information.1.code" end,
            case when "code_information.2.type" in ('CPT','HCPCS') then "code_information.2.code" end,
            case when "code_information.3.type" in ('CPT','HCPCS') then "code_information.3.code" end) as c
          from read_csv('{D}\\{fname}', header=true, all_varchar=true, ignore_errors=true, null_padding=true))
    where c in ({codes})""")

load_tall("MGH",  "Mass General Brigham", "Massachusetts General Hospital.csv")
load_tall("BWH",  "Mass General Brigham", "Brigham and Womens Hospital.csv")
load_tall("BMC",  "Boston Medical Center", "Boston Medical Center.csv")
load_bidmc("Beth Israel Deaconess Medical Center.csv")

print(con.sql("select hospital, count(*) rows, count(distinct code) codes, "
              "count(amount) with_dollar from raw group by 1").df())
print(con.sql("select hospital, methodology, count(*) from raw group by all order by 1, 3 desc").df())
print(con.sql("select payer_raw, plan_raw, count(*) n from raw group by all order by n desc limit 40").df())