import type {
  ComparisonResult, Hospital, HospitalProcedurePrice, HospitalQuality, Payer, PriceFilters, Procedure,
} from "@/lib/models/types";

/**
 * The contract every data source must implement.
 * Today: `mockApi`. Later: an HTTP client backed by the ingestion pipeline.
 * Pages only talk to this interface (via `src/lib/api/queries.ts`).
 */
export interface PricingApi {
  searchProcedures(query: string, hospitalId?: string): Promise<Procedure[]>;
  getProcedure(code: string): Promise<Procedure | null>;
  listHospitals(query?: string, procedureCode?: string): Promise<Hospital[]>;
  getHospital(id: string): Promise<Hospital | null>;
  listPayers(): Promise<Payer[]>;
  comparePrices(filters: PriceFilters): Promise<ComparisonResult>;
  getHospitalPrices(hospitalId: string): Promise<HospitalProcedurePrice[]>;
  getDataQuality(): Promise<HospitalQuality[]>;
}
