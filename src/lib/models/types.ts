/**
 * Shared data models for ClearCost Boston.
 * These mirror the shapes the future backend API is expected to return.
 * Keep this file framework-agnostic (no React imports).
 */

export type PriceType = "gross" | "cash" | "negotiated";
export type Setting = "inpatient" | "outpatient";
export type CodeType = "CPT" | "HCPCS";
export type HospitalType = "Academic medical center" | "Community hospital" | "Specialty hospital";

export interface Hospital {
  id: string;
  name: string;
  shortName: string;
  neighborhood: string;
  city: string;
  /** Street address supplied by the hospital or uploader. */
  address: string;
  /** Saved from the exact street address for the hospital map. */
  latitude: number | null;
  longitude: number | null;
  type: HospitalType;
  /** null when the source files don't say (real data carries no bed counts). */
  beds: number | null;
  /** URL of the hospital's machine-readable pricing file. */
  sourceUrl: string;
  sourceFormat: "CSV" | "JSON";
  /** ISO date the hospital says it last updated the file. */
  lastPublished: string;
  /** ISO date our pipeline last retrieved the file. */
  lastRetrieved: string;
}

export interface Procedure {
  code: string;
  codeType: CodeType;
  name: string;
  category: string;
  defaultSetting: Setting;
}

export interface Payer {
  id: string;
  name: string;
}

export interface PriceRecord {
  id: string;
  hospitalId: string;
  code: string;
  priceType: PriceType;
  /** Only set for negotiated rates. */
  payerId: string | null;
  setting: Setting;
  /** null = hospital listed the item but published no usable amount. */
  amount: number | null;
  retrievedAt: string;
  sourceUrl: string;
}

export interface PriceFilters {
  code: string;
  priceType: PriceType;
  setting: Setting;
  payerId?: string | null;
  hospitalIds?: string[];
}

export interface PriceStats {
  count: number;
  min: number;
  max: number;
  median: number;
  mean: number;
  p25: number;
  p75: number;
  /** max / min */
  spreadRatio: number;
  /** coefficient of variation (stdev / mean) */
  cv: number;
}

export interface HospitalPriceRow {
  hospital: Hospital;
  amount: number;
  record: PriceRecord;
  isOutlier: boolean;
  /** 0–100 */
  comparability: number;
}

export interface ComparisonResult {
  procedure: Procedure;
  filters: PriceFilters;
  rows: HospitalPriceRow[];
  stats: PriceStats | null;
  /** Hospitals with no usable price for this filter combination. */
  missingHospitals: Hospital[];
}

export interface HospitalQuality {
  hospital: Hospital;
  /** % of expected (code × price type × payer) records present with an amount. */
  completeness: number;
  missingCount: number;
  expectedCount: number;
  outlierCount: number;
  daysSinceRetrieved: number;
  comparability: number;
}

export interface HospitalProcedurePrice {
  procedure: Procedure;
  cash: number | null;
  gross: number | null;
  negotiatedMedian: number | null;
  marketCashMedian: number | null;
}
