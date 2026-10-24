# ClearCost Boston

**Hospital prices, made transparent.** A price-transparency platform for comparing published hospital procedure prices across greater Boston.

> ⚠️ This build ships **synthetic demonstration data only**. Hospital names are fictional and all prices are generated. Nothing here is a real hospital charge or a billing estimate.

## Stack
TanStack Start (React 19, TypeScript), TanStack Router + Query, Tailwind CSS v4, shadcn/ui, Recharts.

## Project structure

```text
src/
  lib/
    models/types.ts      Shared data models (Hospital, Procedure, PriceRecord, ComparisonResult, ...)
    stats.ts             Pure stats helpers (median, IQR, outliers, formatting) + stats.test.ts
    mock/data.ts         Seeded synthetic hospitals, procedures, payers and price records
    api/types.ts         PricingApi interface — the contract every data source implements
    api/mock-api.ts      In-memory implementation used today
    api/http-api.ts      Future HTTP client + proposed REST endpoints (inactive)
    api/queries.ts       TanStack Query options; the single place pages get data from
  components/
    common/              Page header, cards, stat cards, loading/empty/error states, badges
    charts/              Recharts visualizations (comparison bars, distribution)
    explorer/            Procedure search + sortable pricing table
    layout/AppSidebar    Left navigation
    ui/                  shadcn primitives
  routes/                One file per page (/, /hospitals, /hospitals/$id, /data-quality, /about, /methodology, /faq)
```

### Suggested ownership (4 developers)
1. **Explorer & charts** — `routes/index.tsx`, `components/explorer`, `components/charts`
2. **Hospitals** — `routes/hospitals.*`
3. **Data quality & stats** — `routes/data-quality.tsx`, `lib/stats.ts`
4. **Backend integration** — `lib/api/*`, `lib/models/types.ts`

## Future integration points
- Implement the endpoints listed in `src/lib/api/http-api.ts` and switch `api` in `src/lib/api/queries.ts` to `createHttpApi(...)`.
- Backend will ingest hospital CSV/JSON machine-readable files, normalize CPT/HCPCS codes, hospital identities, settings, price types and payers, preserve source URLs and retrieval dates, compute statistics/outliers, and serve `ComparisonResult` objects.
- Keep `lib/models/types.ts` as the shared contract with the backend.

## Scripts
`bun run dev` · `bunx vitest run`
