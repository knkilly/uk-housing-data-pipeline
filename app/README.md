# UK Housing Data Pipeline — Web App

A production-ready FastAPI + React dashboard for UK housing market data.

## Prerequisites

- **Python** via [pixi](https://pixi.sh) (manages the Python environment)
- **Node.js 18+** (for the React frontend)

## First-Time Setup

```bash
# 1. Install Python dependencies
pixi install

# 2. Install frontend dependencies
cd app/frontend && npm install

# 3. Add your Stadia Maps API key
cp app/frontend/.env.example app/frontend/.env
# Then edit app/frontend/.env and replace `your_key_here` with your real key.
# Get one free at https://stadiamaps.com/

# 4. Run the gold layer to generate the heatmap_data_by_type table
pixi run gold
```

## Development

Open **two terminals**:

```bash
# Terminal 1 — FastAPI backend on port 8000
pixi run -e api api

# Terminal 2 — Vite dev server on port 5173 (proxies /api to 8000)
cd app/frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Production Build

```bash
# Build the React frontend
cd app/frontend && npm run build

# Serve everything from FastAPI
pixi run -e api api-prod
```

Open [http://localhost:8000](http://localhost:8000) — FastAPI serves the built frontend as static files and the API under `/api/*`.

## Project Structure

```
app/
├── main.py                    ← FastAPI app, mounts static files, includes router
├── db.py                      ← DuckDB connection (read-only), lru_cache on all queries
├── routers/
│   └── api.py                 ← all /api/* route handlers
└── frontend/
    ├── .env                   ← VITE_OS_API_KEY (gitignored)
    ├── package.json
    ├── vite.config.ts         ← proxies /api to :8000 in dev
    └── src/
        ├── App.tsx            ← React Router + QueryClientProvider
        ├── theme.ts           ← colour constants from Streamlit dashboard
        ├── lib/api.ts         ← typed fetch functions
        ├── pages/
        │   ├── Overview.tsx   ← UK bubble map (route: /)
        │   └── Area.tsx       ← area detail (route: /area/:code)
        └── components/
            ├── Layout.tsx     ← shared header with postcode search
            ├── UKMap.tsx      ← react-leaflet CircleMarker map
            ├── HeatMap.tsx    ← leaflet.heat heatmap layer
            ├── PriceTrend.tsx ← Plotly line chart
            ├── VolumeChart.tsx← Plotly bar chart
            ├── PropertyType.tsx← bar + donut charts
            ├── Candlestick.tsx← monthly seasonality
            └── DistrictTable.tsx← sortable HTML table
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/overview` | UK-wide postcode area centroids + stats |
| `GET /api/area/{code}/summary` | Yearly market summary for an area |
| `GET /api/area/{code}/property-types` | Property type breakdown with percentiles |
| `GET /api/area/{code}/monthly` | Monthly trends for seasonality chart |
| `GET /api/area/{code}/heatmap` | Filtered heatmap points (query params: `property_type`, `price_min`, `price_max`) |
| `GET /api/area/{code}/districts` | District breakdown (latest year) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HOUSING_DB_PATH` | `data/processed/housing_analytics.db` | Path to the DuckDB database |
| `VITE_OS_API_KEY` | — | OS Maps NGD API key (frontend) |
