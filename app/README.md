# UK Housing Dashboard — Web App

FastAPI backend + React frontend serving an interactive dashboard for UK housing market analysis.

## Prerequisites

- **Python** via [pixi](https://pixi.sh)
- **Node.js 18+** (for the React frontend)
- **DuckDB database** already created (run `pixi run process` from the root directory first)

## First-Time Setup

```bash
# 1. Install Python dependencies
pixi install

# 2. Install frontend dependencies
cd app/frontend && npm install

# 3. Add your OS Maps API key
cp app/frontend/.env.example app/frontend/.env
# Then edit app/frontend/.env and add your key
# Get a free key at https://os.uk/maps
```

## Development

Open **two terminal tabs**:

```bash
# Terminal 1 — FastAPI backend on port 8000
pixi run -e api api

# Terminal 2 — Vite dev server on port 5173
cd app/frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The frontend dev server proxies `/api/*` requests to `localhost:8000` (see `vite.config.ts`).

### Hot Reload

- **Backend:** Uvicorn reloads on Python file changes
- **Frontend:** Vite reloads on React/TypeScript file changes

## Production Build

```bash
# Build the React frontend into static files
cd app/frontend && npm run build

# Serve everything from FastAPI (backend + static frontend)
pixi run -e api api-prod
```

Open [http://localhost:8000](http://localhost:8000) — FastAPI serves the compiled frontend as static assets and the API under `/api/*`.

## Project Structure

```
app/
├── main.py                          ← FastAPI app
│                                      - mounts static frontend files
│                                      - includes API router
│                                      - CORS config
├── db.py                            ← DuckDB connection
│                                      - read-only access to gold tables
│                                      - lru_cache on query functions
├── routers/
│   └── api.py                       ← all /api/* endpoint handlers
│
└── frontend/
    ├── .env                         ← VITE_OS_API_KEY (gitignored)
    ├── .env.example                 ← template for API key
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts               ← dev proxy config
    ├── index.html
    │
    └── src/
        ├── App.tsx                  ← React Router setup + QueryClientProvider
        ├── main.tsx                 ← React DOM mount
        ├── theme.ts                 ← Colour constants (dark mode)
        ├── lib/
        │   └── api.ts               ← Typed fetch functions + type definitions
        ├── pages/
        │   ├── Overview.tsx         ← UK overview map (route: /)
        │   └── Area.tsx             ← Area detail (route: /area/:code)
        └── components/
            ├── Layout.tsx           ← Shared header with postcode search
            ├── UKMap.tsx            ← UK overview bubble map (react-leaflet)
            ├── HeatMap.tsx          ← Area heatmap (leaflet.heat)
            ├── RepeatSalesMap.tsx   ← Repeat-sales map with price history modal
            ├── OSMapsTiles.tsx      ← OS Maps raster basemap (with CSS filter)
            ├── PriceTrend.tsx       ← Yearly avg price line chart (Plotly)
            ├── VolumeChart.tsx      ← Annual transaction volume bar chart
            ├── PropertyType.tsx     ← Property type breakdown (Plotly)
            └── Candlestick.tsx      ← Monthly seasonality candlestick chart
```

## Environment Variables

### Frontend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_OS_API_KEY` | Yes | OS Maps NGD API key for raster tiles |

### Backend

| Variable | Default | Description |
|---|---|---|
| `HOUSING_DB_PATH` | `../data/processed/housing_analytics.db` | Path to DuckDB database |

## API Endpoints

All endpoints are read-only and return JSON.

### Overview

```
GET /api/overview
```

Returns UK-wide postcode area centroids with aggregated stats.

**Response:**
```json
[
  {
    "postcode_area": "BS",
    "center_lat": 51.45,
    "center_long": -2.62,
    "total_transactions": 123456,
    "avg_price": 285000,
    "median_price": 250000,
    "latest_year": 2025
  },
  ...
]
```

### Area Summary

```
GET /api/area/{area}/summary
```

Yearly market summary for a postcode area (e.g., `BS`, `M`, `L`).

**Response:**
```json
[
  {
    "postcode_area": "BS",
    "transaction_year": 1995,
    "transaction_count": 1234,
    "avg_price": 45000,
    "median_price": 42000,
    "min_price": 5000,
    "max_price": 500000,
    "stddev_price": 12345
  },
  ...
]
```

### Property Types

```
GET /api/area/{area}/property-types
```

Property type breakdown with percentiles for an area.

**Response:**
```json
[
  {
    "property_type": "Detached",
    "transaction_count": 5678,
    "avg_price": 350000,
    "median_price": 320000,
    "p25": 280000,
    "p75": 420000
  },
  ...
]
```

### Monthly Trends

```
GET /api/area/{area}/monthly
```

Monthly transaction trends for seasonality analysis.

**Response:**
```json
[
  {
    "postcode_area": "BS",
    "transaction_year": 2020,
    "transaction_month": 1,
    "transaction_count": 234,
    "avg_price": 265000,
    "median_price": 245000
  },
  ...
]
```

### Heatmap Data

```
GET /api/area/{area}/heatmap?property_type=All&price_min=100&price_max=1000
```

Postcode-level points for the heatmap layer (last 5 years).

**Query Parameters:**
- `property_type` — Filter by type (e.g., `Detached`, `Flat`) or `All`
- `price_min` — Min avg price in £K
- `price_max` — Max avg price in £K

**Response:**
```json
[
  {
    "postcode": "BS8 4LY",
    "latitude": 51.45,
    "longitude": -2.62,
    "postcode_area": "BS",
    "postcode_district": "BS8",
    "property_type": "Detached",
    "total_transactions": 12,
    "avg_price": 425000,
    "median_price": 410000
  },
  ...
]
```

### Repeat Sales

```
GET /api/area/{area}/repeat-sales
```

Address-matched properties sold 3+ times with full price history. Filtered to exclude tenure changes (leasehold ↔ freehold).

**Response:**
```json
[
  {
    "property_key": "BS8 4LY|4|",
    "postcode": "BS8 4LY",
    "postcode_area": "BS",
    "postcode_district": "BS8",
    "paon": "4",
    "saon": null,
    "street": "ALBERMARLE ROW",
    "town_city": "BRISTOL",
    "latitude": 51.45,
    "longitude": -2.62,
    "n_sales": 19,
    "first_date": "1996-07-26",
    "last_date": "2025-06-26",
    "first_price": 48750,
    "last_price": 450000,
    "total_pct_change": 823.1,
    "annualised_pct_change": 8.0,
    "history": [
      { "date": "1996-07-26", "price": 48750 },
      { "date": "1997-05-30", "price": 75000 },
      ...
    ]
  },
  ...
]
```

## Performance Notes

- **Database:** All queries run against pre-aggregated gold tables. No real-time computation.
- **Caching:** API responses are cached client-side by TanStack Query (5-minute stale time).
- **Heatmap filtering:** Type and price filtering happens client-side (no re-fetch).
- **Maps:** Leaflet circles use canvas rendering (`preferCanvas={true}`) for performance at scale.

## Troubleshooting

### "VITE_OS_API_KEY is not defined"

→ Create `app/frontend/.env` and add your OS Maps API key.

### "Cannot find module '@vitejs/plugin-react'"

→ Run `npm install` in `app/frontend/`.

### "DuckDB file not found"

→ Run `pixi run process` from the root directory to create the database.

### Vite build warnings

→ Check `package.json` for conflicting peer dependencies. Current known issue: `@vitejs/plugin-react@4` with `vite@8`. Workaround: use `vite@^7`.

## Deployment

### Docker

```dockerfile
FROM node:18 AS builder
WORKDIR /app/frontend
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Systemd Service

```ini
[Unit]
Description=UK Housing Dashboard
After=network.target

[Service]
Type=simple
User=housing
WorkingDirectory=/opt/housing
ExecStart=/opt/housing/.pixi/envs/api/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Known Issues

- **OS Maps zoom floor:** Raster tiles only available at zoom 7+. UK overview falls back to Carto tiles.
- **Repeat-sales tenure filtering:** Properties that changed tenure (leasehold ↔ freehold) are excluded to prevent artificial price jumps.
- **Map re-centering:** Ensure `MapController` component is rendered in `RepeatSalesMap` for area switching to re-center.

## Future Enhancements

- Real price adjustment (CPI-deflated)
- Predictive price models
- Postcode-level drill-down
- BI tool connectors (Tableau, Power BI)

See the root `README.md` for the full project roadmap.