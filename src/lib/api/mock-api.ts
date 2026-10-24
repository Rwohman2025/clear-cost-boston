import { DATA_AS_OF, hospitals, payers, priceRecords, procedures } from "@/lib/mock/data";
import type { HospitalQuality, PriceRecord } from "@/lib/models/types";
import { computeStats, isOutlier, quantile } from "@/lib/stats";
import type { PricingApi } from "./types";

const delay = <T,>(value: T, ms = 220) => new Promise<T>((r) => setTimeout(() => r(value), ms));

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function qualityFor(hospitalId: string): HospitalQuality {
  const hospital = hospitals.find((h) => h.id === hospitalId)!;
  const expected = procedures.reduce((n, p) => n + (p.category === "Lab" || p.defaultSetting === "inpatient" ? 1 : 2), 0) * (2 + payers.length);
  const recs = priceRecords.filter((r) => r.hospitalId === hospitalId);
  const present = recs.filter((r) => r.amount != null).length;
  let outlierCount = 0;
  for (const p of procedures) {
    const cash = priceRecords.filter((r) => r.code === p.code && r.priceType === "cash" && r.setting === p.defaultSetting && r.amount != null);
    const stats = computeStats(cash.map((r) => r.amount!));
    const mine = cash.find((r) => r.hospitalId === hospitalId);
    if (stats && mine && isOutlier(mine.amount!, stats)) outlierCount++;
  }
  const completeness = Math.round((present / expected) * 100);
  const days = daysBetween(hospital.lastRetrieved, DATA_AS_OF);
  const pubAge = daysBetween(hospital.lastPublished, DATA_AS_OF);
  const freshness = Math.max(0, 100 - pubAge / 3);
  const comparability = Math.round(completeness * 0.6 + freshness * 0.3 + (hospital.sourceFormat === "JSON" ? 10 : 6));
  return { hospital, completeness, missingCount: expected - present, expectedCount: expected, outlierCount, daysSinceRetrieved: days, comparability: Math.min(100, comparability) };
}

export const mockApi: PricingApi = {
  async searchProcedures(query) {
    const q = query.trim().toLowerCase();
    return delay(q ? procedures.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : procedures, 80);
  },
  async getProcedure(code) {
    return delay(procedures.find((p) => p.code === code) ?? null, 60);
  },
  async listHospitals(query = "") {
    const q = query.trim().toLowerCase();
    return delay(q ? hospitals.filter((h) => `${h.name} ${h.city} ${h.neighborhood}`.toLowerCase().includes(q)) : hospitals, 120);
  },
  async getHospital(id) {
    return delay(hospitals.find((h) => h.id === id) ?? null, 80);
  },
  async listPayers() {
    return delay(payers, 40);
  },
  async comparePrices(filters) {
    const procedure = procedures.find((p) => p.code === filters.code);
    if (!procedure) throw new Error(`Unknown procedure code ${filters.code}`);
    const scope = filters.hospitalIds?.length ? hospitals.filter((h) => filters.hospitalIds!.includes(h.id)) : hospitals;
    const match = (r: PriceRecord) =>
      r.code === filters.code && r.priceType === filters.priceType && r.setting === filters.setting &&
      (filters.priceType !== "negotiated" || r.payerId === filters.payerId);
    const usable = new Map<string, PriceRecord>();
    for (const r of priceRecords) if (match(r) && r.amount != null) usable.set(r.hospitalId, r);
    const present = scope.filter((h) => usable.has(h.id));
    const stats = computeStats(present.map((h) => usable.get(h.id)!.amount!));
    const rows = present.map((hospital) => {
      const record = usable.get(hospital.id)!;
      return { hospital, record, amount: record.amount!, isOutlier: stats ? isOutlier(record.amount!, stats) : false, comparability: qualityFor(hospital.id).comparability };
    });
    return delay({ procedure, filters, rows, stats, missingHospitals: scope.filter((h) => !usable.has(h.id)) });
  },
  async getHospitalPrices(hospitalId) {
    const rows = procedures.map((procedure) => {
      const s = procedure.defaultSetting;
      const mine = priceRecords.filter((r) => r.hospitalId === hospitalId && r.code === procedure.code && r.setting === s);
      const pick = (t: string) => mine.find((r) => r.priceType === t)?.amount ?? null;
      const neg = mine.filter((r) => r.priceType === "negotiated" && r.amount != null).map((r) => r.amount!).sort((a, b) => a - b);
      const market = priceRecords.filter((r) => r.code === procedure.code && r.setting === s && r.priceType === "cash" && r.amount != null).map((r) => r.amount!).sort((a, b) => a - b);
      return { procedure, cash: pick("cash"), gross: pick("gross"), negotiatedMedian: neg.length ? quantile(neg, 0.5) : null, marketCashMedian: market.length ? quantile(market, 0.5) : null };
    });
    return delay(rows);
  },
  async getDataQuality() {
    return delay(hospitals.map((h) => qualityFor(h.id)));
  },
};
