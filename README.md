# UK Housing Data Pipeline

Full stack data pipeline processing 30M+ UK property transactions using DuckDB medallion architecture, FastAPI, and React - no cloud required.

## Data Sources

- [HM Land Registry Price Paid Data](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads) (30M+ transactions)
- [ONS Postcode Directory](https://www.arcgis.com/sharing/rest/content/items/3635ca7f69df4733af27caf86473ffa1/data) (2.6M+ postcodes with coordinates)

## Architecture

```
Land Registry CSV ──→ Bronze ──→ Silver ──→ Gold ──→ FastAPI ──→ React Dashboard
ONS Postcodes CSV ─┘  (raw)    (clean)   (agg)     (API)       (interactive maps + charts)
```

The pipeline follows a **medallion architecture** within a single DuckDB database file:

**Bronze** — Raw ingestion of CSV files into DuckDB tables with minimal transformation. Column naming, type casting, and ingestion metadata only.

**Silver** — Cleaned and standardised data. Deduplication, price filtering, postcode normalisation, property type expansion (D→Detached, S→Semi-Detached etc.), and derived time fields (month, quarter).

**Gold** — 8 pre-aggregated analytics tables optimised for dashboard queries, all keyed by postcode area (BS, CM, SW etc.) and postcode district (BS1, CM2 etc.):

| Table | Description |
|---|---|
| `market_summary_by_area` | Yearly stats per postcode area |
| `market_summary_by_district` | District-level drill-down with coordinates |
| `heatmap_data` | Postcode-level lat/long + price (last 5 years) |
| `heatmap_data_by_type` | Heatmap data split by property type |
| `monthly_trends_by_area` | Monthly trends for seasonality analysis |
| `property_analysis_by_area` | Property type breakdown with p25/p75 percentiles |
| `postcode_area_labels` | Human-readable area names derived from transaction data |
| `uk_overview` | UK-wide postcode area centroids for the overview map |


## Quick Start

### Prerequisites

- [pixi](https://pixi.sh) (Python package manager)
- Node.js 18+

### 1. Install dependencies

```bash
pixi install
```

### 2. Get the data

Download the [HM Land Registry Price Paid Data (All, CSV)](https://price-paid-data.publicdata.landregistry.gov.uk/pp-complete.csv) manually and save it as `data/raw/land_registry/pp-complete.csv`

The ONS Latest Postcode Centroids can be downloaded using the `scripts/download_ons_postcodes.py` script. (This is preferred as the Government website could lag quite a bit and cancel itseld mid download)

### 3. Run the full pipeline

```bash
pixi run process
```

This will download the ONS postcodes (if not already present), then run bronze → silver → gold. Takes approximately 10–15 minutes depending on hardware.

Or run each step individually:

```bash
pixi run download   # ONS postcodes via ArcGIS API
pixi run bronze     # raw CSV → DuckDB
pixi run silver     # clean + standardise
pixi run gold       # aggregate into analytics tables
```

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Database | DuckDB | Embedded columnar analytics DB — fast aggregations, no server needed |
| Pipeline | Python | Bronze/silver/gold medallion transforms |
| Package mgmt | pixi | Conda-based Python environment management |
