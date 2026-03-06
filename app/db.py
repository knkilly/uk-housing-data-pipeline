"""
DuckDB read-only connection and cached query helpers for the housing analytics API.

Key design:
- Threading lock around the single connection (DuckDB is not thread-safe)
- lru_cache means each area is only queried once, then served from memory
- Startup warmup pre-loads the overview so the first page load is instant
"""

import os
import threading
from functools import lru_cache
from typing import Any

import duckdb

DB_PATH = os.environ.get("HOUSING_DB_PATH", "data/processed/housing_analytics.db")

_con: duckdb.DuckDBPyConnection | None = None
_lock = threading.Lock()


def get_connection() -> duckdb.DuckDBPyConnection:
    """Return a singleton read-only DuckDB connection."""
    global _con
    if _con is None:
        _con = duckdb.connect(DB_PATH, read_only=True)
    return _con


def _rows(sql: str, params: list[Any] | None = None) -> list[dict]:
    """Execute *sql* under a lock and return a list of dicts."""
    with _lock:
        con = get_connection()
        if params:
            rel = con.execute(sql, params)
        else:
            rel = con.execute(sql)
        cols = [desc[0] for desc in rel.description]
        return [dict(zip(cols, row)) for row in rel.fetchall()]


# ---------------------------------------------------------------------------
# Cached queries (all per-area lookups)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def overview() -> list[dict]:
    return _rows(
        "SELECT postcode_area, center_lat, center_long, total_transactions, "
        "avg_price, median_price FROM gold.uk_overview ORDER BY postcode_area"
    )


@lru_cache(maxsize=256)
def area_summary(code: str) -> list[dict]:
    return _rows(
        "SELECT transaction_year, transaction_count, avg_price, median_price, "
        "min_price, max_price FROM gold.market_summary_by_area "
        "WHERE postcode_area = ? ORDER BY transaction_year",
        [code],
    )


@lru_cache(maxsize=256)
def area_property_types(code: str) -> list[dict]:
    return _rows(
        "SELECT property_type, transaction_year, transaction_count, avg_price, "
        "median_price, p25, p75 FROM gold.property_analysis_by_area "
        "WHERE postcode_area = ? ORDER BY transaction_year, property_type",
        [code],
    )


@lru_cache(maxsize=256)
def area_monthly(code: str) -> list[dict]:
    return _rows(
        "SELECT transaction_year, transaction_month, transaction_count, avg_price, "
        "median_price FROM gold.monthly_trends_by_area "
        "WHERE postcode_area = ? ORDER BY transaction_year, transaction_month",
        [code],
    )


# NOT cached — filtered at query time
def area_heatmap(
    code: str,
    property_type: str = "All",
    price_min: int = 0,
    price_max: int = 99999,
) -> list[dict]:
    sql = (
        "SELECT latitude, longitude, avg_price, total_transactions, "
        "property_type, postcode_district "
        "FROM gold.heatmap_data_by_type "
        "WHERE postcode_area = ? "
        "AND avg_price BETWEEN ? AND ? "
    )
    params: list[Any] = [code, price_min * 1000, price_max * 1000]

    if property_type != "All":
        sql += "AND property_type = ? "
        params.append(property_type)

    sql += "ORDER BY total_transactions DESC LIMIT 5000"
    return _rows(sql, params)


@lru_cache(maxsize=256)
def area_districts(code: str) -> list[dict]:
    return _rows(
        "SELECT postcode_district, district_name, transaction_count, avg_price, "
        "median_price, center_lat, center_long "
        "FROM gold.market_summary_by_district "
        "WHERE postcode_area = ? "
        "AND transaction_year = ("
        "  SELECT MAX(transaction_year) FROM gold.market_summary_by_district "
        "  WHERE postcode_area = ?"
        ") ORDER BY transaction_count DESC",
        [code, code],
    )


def warmup() -> None:
    """Pre-load overview data and area labels so the first page load is instant."""
    try:
        overview()
        area_labels()
        print(f"✓ DB warmup complete — {DB_PATH}")
    except Exception as e:
        print(f"✗ DB warmup failed: {e}")


@lru_cache(maxsize=1)
def area_labels() -> dict[str, str]:
    """Return a dict mapping postcode_area -> human-readable area name."""
    rows = _rows("SELECT postcode_area, area_name FROM gold.postcode_area_labels")
    return {r["postcode_area"]: r["area_name"] for r in rows}
