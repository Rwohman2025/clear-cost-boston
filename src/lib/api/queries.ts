import { queryOptions } from "@tanstack/react-query";
import type { PriceFilters } from "@/lib/models/types";
import { createHttpApi } from "./http-api";
import { mockApi } from "./mock-api";
import type { PricingApi } from "./types";

/**
 * Data source. Set VITE_API_URL (see .env.example) to use the real backend
 * (hospital-price-explorer/server.py); leave it unset to fall back to the synthetic mock API.
 */
const API_URL = import.meta.env["VITE_API_URL"] as string | undefined;
export const isLiveData = Boolean(API_URL);
export const api: PricingApi = API_URL ? createHttpApi(API_URL.replace(/\/$/, "")) : mockApi;

/** Filters the Explorer opens with. Featured example per data source. */
export const DEFAULT_FILTERS: PriceFilters = isLiveData
  ? { code: "45385", priceType: "negotiated", setting: "outpatient", payerId: "blue-cross-blue-shield" } // colonoscopy w/ snare removal
  : { code: "72148", priceType: "cash", setting: "outpatient", payerId: "bcbsma" }; // MRI lumbar spine (synthetic)

export const proceduresQuery = (q = "") => queryOptions({ queryKey: ["procedures", q], queryFn: () => api.searchProcedures(q) });
export const hospitalsQuery = (q = "") => queryOptions({ queryKey: ["hospitals", q], queryFn: () => api.listHospitals(q) });
export const hospitalQuery = (id: string) => queryOptions({ queryKey: ["hospital", id], queryFn: () => api.getHospital(id) });
export const hospitalPricesQuery = (id: string) => queryOptions({ queryKey: ["hospital-prices", id], queryFn: () => api.getHospitalPrices(id) });
export const payersQuery = () => queryOptions({ queryKey: ["payers"], queryFn: () => api.listPayers(), staleTime: Infinity });
export const comparisonQuery = (f: PriceFilters) => queryOptions({ queryKey: ["compare", f], queryFn: () => api.comparePrices(f) });
export const qualityQuery = () => queryOptions({ queryKey: ["quality"], queryFn: () => api.getDataQuality() });
