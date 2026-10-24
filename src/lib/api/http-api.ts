/**
 * HTTP client for the backend (hospital-price-explorer/server.py). Active when
 * VITE_API_URL is set (see queries.ts). No synthetic fallback. REST surface:
 *
 *   GET /api/procedures?q=            -> Procedure[]
 *   GET /api/procedures/:code         -> Procedure
 *   GET /api/hospitals?q=             -> Hospital[]
 *   GET /api/hospitals/:id            -> Hospital
 *   GET /api/hospitals/:id/prices     -> HospitalProcedurePrice[]
 *   GET /api/payers                   -> Payer[]
 *   GET /api/prices/compare?code=&priceType=&setting=&payerId=&hospitalIds= -> ComparisonResult
 *   GET /api/quality                  -> HospitalQuality[]
 */
import type { PricingApi } from "./types";

export function createHttpApi(baseUrl?: string): PricingApi {
  const get = async <T,>(path: string): Promise<T> => {
    if (!baseUrl) throw new Error("Hospital pricing is unavailable. Please try again later.");
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json() as Promise<T>;
  };
  return {
    searchProcedures: (q, hospitalId) => get(`/api/procedures?${new URLSearchParams({ q, ...(hospitalId ? { hospitalId } : {}) })}`),
    getProcedure: (code) => get(`/api/procedures/${code}`),
    listHospitals: (q = "", procedureCode) => get(`/api/hospitals?${new URLSearchParams({ q, ...(procedureCode ? { procedureCode } : {}) })}`),
    getHospital: (id) => get(`/api/hospitals/${id}`),
    listPayers: () => get(`/api/payers`),
    comparePrices: (f) =>
      get(`/api/prices/compare?${new URLSearchParams({
        code: f.code, priceType: f.priceType, setting: f.setting,
        ...(f.payerId ? { payerId: f.payerId } : {}),
        ...(f.hospitalIds?.length ? { hospitalIds: f.hospitalIds.join(",") } : {}),
      })}`),
    getHospitalPrices: (id) => get(`/api/hospitals/${id}/prices`),
    getDataQuality: () => get(`/api/quality`),
  };
}
