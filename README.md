# UK Housing Data Pipeline

A production-ready data pipeline and interactive dashboard for analysing 30M+ UK property transactions.

**Problem solved:** The naive approach (Docker + Trino + Hive + MinIO) failed completely. This pipeline proves that **correct tool selection matters more than defaulting to familiar tools**.

## Architecture

```
Land Registry CSV ──→ Bronze ──→ Silver ──→ Gold ──→ FastAPI ──→ React Dashboard
ONS Postcodes CSV ─┘  (raw)    (clean)   (agg)     (API)       (maps + charts)
```

**Medallion architecture** in a single DuckDB database file (~8GB):

| Layer | Purpose |
|---|---|
| **Bronze** | Raw CSV ingestion with minimal transformation |
| **Silver** | Cleaned, deduplicated, standardised data |
| **Gold** | 9 pre-aggregated analytics tables optimised for dashboard queries |

## Data Sources

- [HM Land Registry Price Paid Data](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads) — 30M+ property transactions since 1995
- [ONS Postcode Directory](https://www.arcgis.com/sharing/rest/content/items/3635ca7f69df4733af27caf86473ffa1/data) — 2.6M+ postcodes with lat/long coordinates

## Quick Start

### 1. Prerequisites

- [pixi](https://pixi.sh) (Python environment manager)
- Node.js 18+ (for the React frontend)

### 2. Install

```bash
pixi install
cd app/frontend && npm install
```

### 3. Download data

The Land Registry CSV is large (~4GB) and must be downloaded manually:

```bash
# Download pp-complete.csv and save as:
data/raw/land_registry/pp-complete.csv
```

ONS postcodes are downloaded automatically by the pipeline, but they can also be downloaded using the link.

### 4. Run the pipeline

```bash
# Full pipeline: download ONS → bronze → silver → gold (~10–15 min)
pixi run process

# Or run each step individually:
pixi run download   # ONS postcodes via ArcGIS API
pixi run bronze     # CSV → DuckDB
pixi run silver     # clean + standardise
pixi run gold       # aggregate into analytics tables
```

### 5. Set up API keys

```bash
# OS Maps API key (for map tiles in the frontend)
cp app/frontend/.env.example app/frontend/.env
# Edit and add your OS Maps API key
```

Get an OS Maps API key free at [os.uk/maps](https://os.uk/maps).

### 6. Start the dashboard

```bash
# Terminal 1: Backend
pixi run -e api api

# Terminal 2: Frontend
cd app/frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Production Build (WIP)

```bash
cd app/frontend && npm run build
pixi run -e api api-prod
# → http://localhost:8000
```

## What's Included

### Pipeline

- **Bronze ingestion:** Loads Land Registry and ONS data with minimal transformation
- **Silver cleaning:** Deduplication, postcode standardisation, property type expansion, derived time fields
- **Gold aggregation:** 9 analytics tables optimised for dashboard queries (area-level, district-level, heatmaps, repeat sales)
- **Repeat-sales analysis:** Address-matched properties with 3+ sales; tenure-consistent only (no leasehold ↔ freehold changes)

### Dashboard

- **UK Overview:** Bubble map with postcode area centroids, colour-coded by average price
- **Area Detail Pages:** 
  - Summary KPIs (avg/median price, sales count, YoY change)
  - Price trend chart (yearly averages)
  - Transaction volume chart
  - Property type breakdown with percentiles
  - Monthly seasonality (candlestick chart)
  - Price heatmap with property-type and price-range filters
  - Repeat-sales map (address-matched properties with price history)

All charts are interactive Plotly visualizations with a consistent dark theme. Maps use Leaflet with OS raster tiles.

## Tech Stack

| Component | Technology |
|---|---|
| Database | **DuckDB** — fast columnar analytics, no server needed |
| Pipeline | **Python** — bronze/silver/gold transforms |
| Backend | **FastAPI + Uvicorn** — async API, thread-safe DuckDB access |
| Frontend | **React + TypeScript + Vite** — single-page app |
| Maps | **Leaflet + OS Maps API** — interactive maps with circle markers + heatmaps |
| Charts | **Plotly** — price trends, volume, property types, seasonality |
| Data Fetching | **TanStack Query** — cached API calls (5-min stale time) |
| Package Mgmt | **pixi** — Conda-based Python environment |

## Project Structure

```
├── data/
│   ├── raw/
│   │   ├── land_registry/
│   │   │   └── pp-complete.csv         ← manually downloaded
│   │   └── ons_postcodes/
│   │       └── *.csv                   ← auto-downloaded
│   └── processed/
│       └── housing_analytics.db        ← DuckDB (8GB)
├── scripts/
│   ├── bronze_ingestion.py
│   ├── silver_layer.py
│   ├── gold_ingestion.py
│   ├── process_layers.py               ← Combines all the layers from bronze, silver and gold
│   └── download_ons_postcodes.py
└── app/
    ├── main.py                         ← FastAPI app
    ├── db.py                           ← DuckDB connection
    ├── routers/
    │   └── api.py                      ← /api/* handlers
    └── frontend/                       ← React + TypeScript + Vite
        ├── src/
        │   ├── pages/Overview.tsx
        │   ├── pages/Area.tsx
        │   ├── components/HeatMap.tsx
        │   ├── components/RepeatSalesMap.tsx
        │   └── ...
        └── vite.config.ts              ← dev server config
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/overview` | UK-wide postcode areas + centroids + stats |
| `GET /api/area/{code}/summary` | Yearly summary stats for a postcode area |
| `GET /api/area/{code}/property-types` | Property type breakdown with percentiles |
| `GET /api/area/{code}/monthly` | Monthly trends for seasonality |
| `GET /api/area/{code}/heatmap` | Heatmap points (filters: `property_type`, `price_min`, `price_max`) |
| `GET /api/area/{code}/repeat-sales` | Address-matched repeat-sold properties with price history |

## Future Enhancements

- **Real price adjustment (CPI-deflated)** — Ingest inflation indices, compute prices in base-year pounds
- **Predictive models** — Repeat-sales regression for price forecasting
- **BI export** — Tableau/Power BI connectors for the gold tables
- **Postcode-level drill-down** — Instead of area-level, allow single-postcode queries

## Known Issues

- **Vite peer dependency conflict:** `@vitejs/plugin-react@4` may warn about `vite@8`. Workaround: downgrade to `vite@^7` or switch to `@vitejs/plugin-react-oxc`.
- **OS Maps zoom floor:** OS raster tiles only available at zoom 7+. The UK overview map falls back to Carto tiles below that.

## Data Attribution

Contains HM Land Registry data © Crown copyright and database right 2025. Licensed under [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

Contains OS data © Crown copyright and database right 2025.

Contains Royal Mail data © Royal Mail copyright and database right 2025.

Contains National Statistics data © Crown copyright and database right 2025.

## For Questions

This project is a portfolio piece and proof-of-concept. It is **not financial advice**.
