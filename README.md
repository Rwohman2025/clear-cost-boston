# ClearCost Boston

**Hospital prices, made transparent.** A price-transparency platform for comparing published hospital procedure prices across greater Boston.

The project has three parts that work together:

| Part | Where | What it is |
| --- | --- | --- |
| Frontend | `src/` | React app (this README's stack below) |
| Backend | `hospital-price-explorer/` | Python + DuckDB pipeline and a FastAPI server (`server.py`) |
| Real data | `three_hospitals_25_procedures.xlsx` | Published prices for Beth Israel Deaconess, Mass General and Brigham and Women's across 25 procedures (source ZIPs for MGH and BWH are alongside it) |

The frontend runs in two modes. **With `VITE_API_URL` set it shows the real published prices from the backend.** Without it, it falls back to **synthetic demonstration data** (fictional hospitals, generated prices) from `src/lib/mock/`. Published prices are not bills or estimates.

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

## Integration points
- The backend already implements the endpoints listed in `src/lib/api/http-api.ts`; `src/lib/api/queries.ts` picks the HTTP client when `VITE_API_URL` is set.
- Known gaps in the real data: Brigham's files lack 4 of the 25 codes; BIDMC publishes gross/cash for only some codes; the spreadsheet has no bed counts or hospital URLs, so those fields are empty in the UI.
- Backend will ingest hospital CSV/JSON machine-readable files, normalize CPT/HCPCS codes, hospital identities, settings, price types and payers, preserve source URLs and retrieval dates, compute statistics/outliers, and serve `ComparisonResult` objects.
- Keep `lib/models/types.ts` as the shared contract with the backend.

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org) (LTS). Tested with Node 24 and npm 11.
- Optional: [Bun](https://bun.sh). The repo ships a `bun.lock`, so Bun users get the exact locked versions.

### Run locally
```bash
git clone https://github.com/laurenbe06/clear-cost-boston.git
cd clear-cost-boston
git checkout <your-branch>

npm install        # or: bun install
npm run dev        # or: bun run dev
```
Open **http://localhost:8080**. The dev server hot-reloads as you edit files.

With no further setup this runs on the **synthetic mock data**. To use the real data, also run the backend below.

### Run with the real data (frontend + backend)
Needs Python 3.10+ in addition to Node.

```bash
# 1. Backend (terminal 1)
cd hospital-price-explorer
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python build_db.py                 # loads the spreadsheet, cleans it -> data/db/prices.duckdb
uvicorn server:app --port 8000     # API at http://localhost:8000/api/health

# 2. Frontend (terminal 2, from the repo root)
cp .env.example .env.local         # sets VITE_API_URL=http://localhost:8000
npm run dev
```
Restart the frontend after creating or changing `.env.local`, and restart the API after re-running `build_db.py`.
To switch back to synthetic data, delete `.env.local` and restart `npm run dev`.

**How the data flows:** `three_hospitals_25_procedures.xlsx` -> `pipeline/02_load_xlsx.py` (raw table) -> `pipeline/03_clean.py` (payer normalization, validity and outlier flags) -> `server.py` (stats, comparability, REST endpoints in the shapes of `src/lib/models/types.ts`) -> `src/lib/api/http-api.ts` -> pages.

### Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 8080 |
| `npm run build` | Production build (output in `.output/`) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |

Quick check before opening a PR: `npx tsc --noEmit && npm test && npm run build`.

### Troubleshooting
- **`node` or `npm` not found (Windows):** install Node, then open a new terminal so the updated PATH is picked up.
- **Port 8080 already in use:** stop the other process, or run `npm run dev -- --port 3000`.
- **Odd dependency errors:** delete `node_modules` and run `npm install` again.
