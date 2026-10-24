import { queryOptions } from "@tanstack/react-query";
import type { PriceFilters } from "@/lib/models/types";
import { mockApi } from "./mock-api";
import type { PricingApi } from "./types";

/** Swap to `createHttpApi(import.meta.env.VITE_API_URL)` when the backend exists. */
export const api: PricingApi = mockApi;

export const proceduresQuery = (q = "") => queryOptions({ queryKey: ["procedures", q], queryFn: () => api.searchProcedures(q) });
export const hospitalsQuery = (q = "") => queryOptions({ queryKey: ["hospitals", q], queryFn: () => api.listHospitals(q) });
export const hospitalQuery = (id: string) => queryOptions({ queryKey: ["hospital", id], queryFn: () => api.getHospital(id) });
export const hospitalPricesQuery = (id: string) => queryOptions({ queryKey: ["hospital-prices", id], queryFn: () => api.getHospitalPrices(id) });
export const payersQuery = () => queryOptions({ queryKey: ["payers"], queryFn: () => api.listPayers(), staleTime: Infinity });
export const comparisonQuery = (f: PriceFilters) => queryOptions({ queryKey: ["compare", f], queryFn: () => api.comparePrices(f) });
export const qualityQuery = () => queryOptions({ queryKey: ["quality"], queryFn: () => api.getDataQuality() });
