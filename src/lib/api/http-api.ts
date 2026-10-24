/**
 * FUTURE BACKEND INTEGRATION (not active).
 * Sketch of the HTTP client that will replace `mockApi` once the ingestion
 * pipeline exposes endpoints. Proposed REST surface:
 *
 *   GET /api/procedures?q=            -> Procedure[]
 *   GET /api/procedures/:code         -> Procedure
 *   GET /api/hospitals?q=             -> Hospital[]
 *   GET /api/hospitals/:id            -> Hospital
 *   GET /api/hospitals/:id/prices     -> HospitalProcedurePrice[]
 *   GET /api/payers                   -> Payer[]
 *   GET /api/prices/compare?code=&priceType=&setting=&payerId= -> ComparisonResult
 *   GET /api/quality                  -> HospitalQuality[]
 */
import type { PricingApi } from "./types";

export function createHttpApi(baseUrl: string): PricingApi {
  const get = async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json() as Promise<T>;
  };
  return {
    searchProcedures: (q) => get(`/api/procedures?q=${encodeURIComponent(q)}`),
    getProcedure: (code) => get(`/api/procedures/${code}`),
    listHospitals: (q = "") => get(`/api/hospitals?q=${encodeURIComponent(q)}`),
    getHospital: (id) => get(`/api/hospitals/${id}`),
    listPayers: () => get(`/api/payers`),
    comparePrices: (f) =>
      get(`/api/prices/compare?${new URLSearchParams({ code: f.code, priceType: f.priceType, setting: f.setting, payerId: f.payerId ?? "" })}`),
    getHospitalPrices: (id) => get(`/api/hospitals/${id}/prices`),
    getDataQuality: () => get(`/api/quality`),
  };
}
