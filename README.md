# ClearCost Boston

**Hospital prices, made clearer.**

ClearCost Boston helps people compare published hospital prices across greater Boston. Find a procedure, explore what different hospitals list, and bring better questions to your provider or insurer before scheduling care.

## What you can do

- Search for a procedure by name or billing code.
- Compare cash prices, gross charges, and insurer-negotiated rates.
- Filter by hospital, insurer, and inpatient or outpatient care.
- Explore side-by-side charts, pricing tables, and data quality notes.

## About the data

The included dataset covers **25 selected procedures** at **Beth Israel Deaconess Medical Center, Massachusetts General Hospital, and Brigham and Women’s Hospital**, using hospitals’ publicly published price files.

Coverage varies by hospital and price type. Missing prices stay unavailable; the app does not substitute made-up prices.

**Published prices are a starting point, not a personalized estimate.** Your final bill depends on your care and insurance coverage. Confirm costs with your hospital and insurer.

## Run locally

You’ll need Node.js and Python 3.10 or later. Clone the repository and install the frontend dependencies:

```bash
git clone https://github.com/Rwohman2025/clear-cost-boston.git
cd clear-cost-boston
npm install
```

Start the data API in one terminal:

```bash
cd hospital-price-explorer
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python build_db.py
uvicorn server:app --port 8000
```

In the repository root, create a file named `.env.local` containing:

```dotenv
VITE_API_URL=http://localhost:8000
```

Then start the website in a second terminal:

```bash
npm run dev
```

Open the local address shown in the terminal. Both the API and website must be running to load prices.

## Built with

React, TypeScript, TanStack Start, Tailwind CSS, and Recharts, with a Python FastAPI backend and DuckDB.

## Contributing

Ideas, bug reports, and improvements are welcome. [Open an issue](https://github.com/Rwohman2025/clear-cost-boston/issues) or submit a pull request. For code changes, run `npm test` and `npm run build` before submitting.
