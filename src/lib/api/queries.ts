import { queryOptions } from "@tanstack/react-query";
import type { PriceFilters } from "@/lib/models/types";
import { createHttpApi } from "./http-api";
import type { PricingApi } from "./types";

/** Published three-hospital prices are served by the separate Python backend. */
const API_URL = import.meta.env["VITE_API_URL"] as string | undefined;
export const isLiveData = true;
export const api: PricingApi = createHttpApi(API_URL?.trim().replace(/\/$/, ""));

/** Filters the Explorer opens with for the three-hospital dataset. */
export const DEFAULT_FILTERS: PriceFilters = {
  code: "45385", priceType: "negotiated", setting: "outpatient", payerId: "blue-cross-blue-shield",
};

export const proceduresQuery = (q = "") => queryOptions({ queryKey: ["procedures", q], queryFn: () => api.searchProcedures(q) });
export const hospitalsQuery = (q = "") => queryOptions({ queryKey: ["hospitals", q], queryFn: () => api.listHospitals(q) });
export const hospitalQuery = (id: string) => queryOptions({ queryKey: ["hospital", id], queryFn: () => api.getHospital(id) });
export const hospitalPricesQuery = (id: string) => queryOptions({ queryKey: ["hospital-prices", id], queryFn: () => api.getHospitalPrices(id) });
export const payersQuery = () => queryOptions({ queryKey: ["payers"], queryFn: () => api.listPayers(), staleTime: Infinity });
export const comparisonQuery = (f: PriceFilters) => queryOptions({ queryKey: ["compare", f], queryFn: () => api.comparePrices(f) });
export const qualityQuery = () => queryOptions({ queryKey: ["quality"], queryFn: () => api.getDataQuality() });
