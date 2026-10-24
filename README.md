# ClearCost Boston

**Hospital prices, made transparent.** A price-transparency platform for comparing published hospital procedure prices across greater Boston.

The project has three parts that work together:

| Part | Where | What it is |
| --- | --- | --- |
| Frontend | `src/` | React app (this README's stack below) |
| Backend | `hospital-price-explorer/` | Python + DuckDB pipeline and a FastAPI server (`server.py`) |
| Real data | `three_hospitals_25_procedures.xlsx` | Published prices for Beth Israel Deaconess, Mass General and Brigham and Women's across 25 procedures (source ZIPs for MGH and BWH are alongside it) |

The frontend uses a separate Python API serving **three_hospitals_25_procedures.xlsx**: Beth Israel Deaconess, Massachusetts General, and Brigham and Women's across 25 selected procedures. Set `VITE_API_URL` to the API origin before building. Missing configuration or an unavailable API produces an error; the website never silently switches to synthetic data. The Dana-Farber CSV remains in the repository but is not ingested by this backend. Published prices are not bills or estimates.

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
    api/mock-api.ts      Legacy synthetic demo implementation (inactive)
    api/http-api.ts      Active client for the separate Python API
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

Run the separate backend and copy .env.example to .env.local as shown below.

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
Missing prices stay unavailable; synthetic prices are not substituted.

**How the data flows:** `three_hospitals_25_procedures.xlsx` -> `pipeline/02_load_xlsx.py` (raw table) -> `pipeline/03_clean.py` (payer normalization, validity and outlier flags) -> `server.py` (stats, comparability, REST endpoints in the shapes of `src/lib/models/types.ts`) -> `src/lib/api/http-api.ts` -> pages.

### Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 8080 |
| `npm run build` | Production build (output in `.output/`) |
| `npm run preview` | Serve the production build locally |
| `npm start` | Run the production Node server |
| `npm test` | Run the unit tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |

Quick check before opening a PR: `npx tsc --noEmit && npm test && npm run build`.

### Troubleshooting
- **`node` or `npm` not found (Windows):** install Node, then open a new terminal so the updated PATH is picked up.
- **Port 8080 already in use:** stop the other process, or run `npm run dev -- --port 3000`.
- **Odd dependency errors:** delete `node_modules` and run `npm install` again.


## Railway: two separate services

Connect both services to **Rwohman2025/clear-cost-boston**, branch **main**.
Keep **Root Directory = /** for both: the backend needs the spreadsheet at the repository root.
Enable automatic deployments on both services.

### Backend (create first)

1. Create a second Railway service from the same GitHub repository.
2. Set Dockerfile Path to **hospital-price-explorer/Dockerfile**, Start Command to
   **python start_server.py**, Healthcheck Path to **/api/health**, and PORT to **8000**.
3. Clear any copied Node build/start command overrides. The Dockerfile installs Python dependencies,
   loads only the three-hospital spreadsheet, and cleans the data into DuckDB at image build time.
   No external database or volume is needed for this read-only dataset.
4. Generate a public HTTPS domain. The API binds to 0.0.0.0 and Railway's PORT.
5. Open **/api/health** on that domain. It must report source
   **three_hospitals_25_procedures.xlsx**, 3 hospitals, 25 procedures, and 582 source rows.

### Frontend (existing website)

1. Set Build Command to **npm run build**, Start Command to
   **node .output/server/index.mjs**, and PORT and NITRO_PORT to **3000**.
2. Set **VITE_API_URL** to the backend's public HTTPS origin, without /api.
   Do not use the frontend domain, localhost, or a railway.internal address: browser requests need a public API.
3. Set NITRO_HOST to **0.0.0.0** and NITRO_PRESET to **node-server**.
   Clear old diagnostic start commands. Nitro also explicitly builds with node-server in vite.config.ts.
4. Rebuild and deploy after setting VITE_API_URL; Vite embeds it at build time.
5. Verify the hospital directory shows BIDMC, MGH, and BWH; check an insurer-filtered comparison.
   A code missing from a hospital must show as missing, rather than an invented price.

Pushing this code does not create the second Railway service. Once both services are connected,
pushes to main trigger their automatic deployments (subject to Railway settings).

### API checks

From hospital-price-explorer, install requirements.txt and httpx, then run:
```bash
python -m unittest test_api.py
```
The tests build a temporary database from the checked-in workbook and exercise the HTTP API.
A GitHub Actions workflow runs these checks on pushes and pull requests.

Railway settings are configured on each service. Legacy railway.toml/json configuration is not used.

## Admin CSV imports

The `/admin` page imports one hospital price CSV at a time. It is protected by the API service’s `ADMIN_USERNAME` and `ADMIN_API_KEY` variables; the key is entered in the browser and is never included in the frontend build. It accepts either ClearCost columns (`code`, `description`, `payer`, `plan`, `setting`, `gross`, `cash`, `negotiated`) or common CMS machine-readable columns such as `billing_code`, `billing_code_description`, `payer_name`, `plan_name`, `standard_charge_gross`, `standard_charge_discounted_cash`, and `standard_charge_negotiated_dollar`. `setting` is optional and defaults to both settings. Every valid five-character CPT/HCPCS code in the upload is added to the searchable procedure catalog using its supplied description. Exact repeated pricing rows are rejected before anything is saved. The default upload limit is 100 MB and can be changed with the API service's `MAX_UPLOAD_MB` variable.

For durable imports on Railway, mount a volume at `/data` on the API service and set `DATA_DIR=/data`. Set a strong `ADMIN_USERNAME` and `ADMIN_API_KEY` in the API service Variables panel before visiting `/admin`.
