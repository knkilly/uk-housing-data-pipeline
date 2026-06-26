"""
Gold Layer Aggregation - Create business-ready analytics tables
Multi-area only — all tables keyed by postcode area / district.
"""
import sys
from pathlib import Path
from datetime import datetime
import duckdb
import pandas as pd

DB_PATH = "data/processed/housing_analytics.db"

def create_gold_layer():
    """Create aggregated gold layer tables for analytics"""
    
    print("=" * 70)
    print("GOLD LAYER AGGREGATION")
    print("=" * 70)
    print(f"Started at: {datetime.now()}")
    print()
    
    # Connect to DuckDB
    print("Connecting to DuckDB...")
    con = duckdb.connect(DB_PATH)
    print(f"✓ Connected to: {DB_PATH}")
    print()
    
    # Create gold schema
    print("Creating gold schema...")
    con.execute("CREATE SCHEMA IF NOT EXISTS gold")
    print("✓ Gold schema ready")
    print()

    # =========================================================================
    # 1. Market Summary by Postcode Area
    # =========================================================================
    print("=" * 70)
    print("1. Creating Market Summary by Postcode Area")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.market_summary_by_area")

        con.execute("""
            CREATE TABLE gold.market_summary_by_area AS
            SELECT
                REGEXP_EXTRACT(postcode, '^[A-Z]+') AS postcode_area,
                transaction_year,
                COUNT(*)                              AS transaction_count,
                ROUND(AVG(price), 2)                  AS avg_price,
                ROUND(MEDIAN(price), 2)               AS median_price,
                MIN(price)                            AS min_price,
                MAX(price)                            AS max_price,
                ROUND(STDDEV(price), 2)               AS stddev_price
            FROM silver.transactions
            WHERE postcode IS NOT NULL
              AND REGEXP_EXTRACT(postcode, '^[A-Z]+') != ''
            GROUP BY postcode_area, transaction_year
            ORDER BY postcode_area, transaction_year
        """)

        result = con.execute("SELECT COUNT(*) FROM gold.market_summary_by_area").fetchone()
        areas  = con.execute("SELECT COUNT(DISTINCT postcode_area) FROM gold.market_summary_by_area").fetchone()
        print(f"✓ Created {result[0]} rows across {areas[0]} postcode areas")

        print("\nSample — BS (Bristol) latest 3 years:")
        preview = con.execute("""
            SELECT postcode_area, transaction_year, transaction_count, avg_price, median_price
            FROM gold.market_summary_by_area
            WHERE postcode_area = 'BS'
            ORDER BY transaction_year DESC
            LIMIT 3
        """).fetchdf()
        print(preview.to_string(index=False))

    except Exception as e:
        print(f"✗ Error creating market_summary_by_area: {e}")
        return False

    print()

    # =========================================================================
    # 2. Market Summary by Postcode District
    # =========================================================================
    print("=" * 70)
    print("2. Creating Market Summary by Postcode District")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.market_summary_by_district")

        con.execute("""
            CREATE TABLE gold.market_summary_by_district AS
            SELECT
                SPLIT_PART(t.postcode, ' ', 1)        AS postcode_district,
                REGEXP_EXTRACT(t.postcode, '^[A-Z]+') AS postcode_area,
                t.transaction_year,
                AVG(p.latitude)                        AS center_lat,
                AVG(p.longitude)                       AS center_long,
                MAX(p.district)                        AS district_name,
                MAX(p.region)                          AS region,
                COUNT(*)                               AS transaction_count,
                ROUND(AVG(t.price), 2)                 AS avg_price,
                ROUND(MEDIAN(t.price), 2)              AS median_price
            FROM silver.transactions t
            LEFT JOIN silver.postcodes p ON t.postcode = p.postcode
            WHERE t.postcode IS NOT NULL
              AND p.latitude  IS NOT NULL
              AND p.longitude IS NOT NULL
            GROUP BY postcode_district, postcode_area, t.transaction_year
            HAVING COUNT(*) >= 10
            ORDER BY postcode_area, postcode_district, t.transaction_year
        """)

        result    = con.execute("SELECT COUNT(*) FROM gold.market_summary_by_district").fetchone()
        districts = con.execute("SELECT COUNT(DISTINCT postcode_district) FROM gold.market_summary_by_district").fetchone()
        print(f"✓ Created {result[0]} rows across {districts[0]} postcode districts")

        print("\nSample — BS1/BS2 latest year:")
        preview = con.execute("""
            SELECT postcode_district, transaction_year, transaction_count, avg_price, center_lat, center_long
            FROM gold.market_summary_by_district
            WHERE postcode_area = 'BS'
            ORDER BY transaction_year DESC, transaction_count DESC
            LIMIT 5
        """).fetchdf()
        print(preview.to_string(index=False))

    except Exception as e:
        print(f"✗ Error creating market_summary_by_district: {e}")
        return False

    print()

    # =========================================================================
    # 3. Heatmap Data (postcode-level lat/long + price, last 5 years)
    # =========================================================================
    print("=" * 70)
    print("3. Creating Heatmap Data")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.heatmap_data")

        con.execute("""
            CREATE TABLE gold.heatmap_data AS
            SELECT
                t.postcode,
                p.latitude,
                p.longitude,
                REGEXP_EXTRACT(t.postcode, '^[A-Z]+') AS postcode_area,
                SPLIT_PART(t.postcode, ' ', 1)         AS postcode_district,
                MAX(p.district)                         AS district,
                MAX(p.region)                           AS region,
                COUNT(*)                                AS total_transactions,
                ROUND(AVG(t.price), 2)                  AS avg_price,
                ROUND(MEDIAN(t.price), 2)               AS median_price,
                MAX(t.transaction_year)                 AS latest_year
            FROM silver.transactions t
            INNER JOIN silver.postcodes p ON t.postcode = p.postcode
            WHERE p.latitude  IS NOT NULL
              AND p.longitude IS NOT NULL
              AND t.transaction_year >= (
                    SELECT MAX(transaction_year) - 4
                    FROM silver.transactions
              )
            GROUP BY t.postcode, p.latitude, p.longitude
            HAVING COUNT(*) >= 5
            ORDER BY postcode_area, postcode_district
        """)

        result    = con.execute("SELECT COUNT(*) FROM gold.heatmap_data").fetchone()
        areas     = con.execute("SELECT COUNT(DISTINCT postcode_area) FROM gold.heatmap_data").fetchone()
        print(f"✓ Created {result[0]} postcode points across {areas[0]} areas (last 5 years, min 5 sales)")

    except Exception as e:
        print(f"✗ Error creating heatmap_data: {e}")
        return False

    print()

    # =========================================================================
    # 4. Heatmap Data by Property Type
    # =========================================================================
    print("=" * 70)
    print("4. Creating Heatmap Data by Property Type")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.heatmap_data_by_type")

        con.execute("""
            CREATE TABLE gold.heatmap_data_by_type AS
            SELECT
                t.postcode,
                p.latitude,
                p.longitude,
                REGEXP_EXTRACT(t.postcode, '^[A-Z]+')  AS postcode_area,
                SPLIT_PART(t.postcode, ' ', 1)          AS postcode_district,
                t.property_type,
                COUNT(*)                                AS total_transactions,
                ROUND(AVG(t.price), 2)                  AS avg_price,
                ROUND(MEDIAN(t.price), 2)               AS median_price
            FROM silver.transactions t
            INNER JOIN silver.postcodes p ON t.postcode = p.postcode
            WHERE p.latitude  IS NOT NULL
              AND p.longitude IS NOT NULL
              AND p.latitude  != 0
              AND p.longitude != 0
              AND t.transaction_year >= (
                    SELECT MAX(transaction_year) - 4
                    FROM silver.transactions
              )
            GROUP BY t.postcode, p.latitude, p.longitude, t.property_type
            HAVING COUNT(*) >= 3
            ORDER BY postcode_area, postcode_district, t.property_type
        """)

        result = con.execute("SELECT COUNT(*) FROM gold.heatmap_data_by_type").fetchone()
        areas  = con.execute("SELECT COUNT(DISTINCT postcode_area) FROM gold.heatmap_data_by_type").fetchone()
        print(f"✓ Created {result[0]} postcode/type points across {areas[0]} areas")

    except Exception as e:
        print(f"✗ Error creating heatmap_data_by_type: {e}")
        return False

    print()

    # =========================================================================
    # 5. Monthly Trends by Postcode Area
    # =========================================================================
    print("=" * 70)
    print("5. Creating Monthly Trends by Postcode Area")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.monthly_trends_by_area")

        con.execute("""
            CREATE TABLE gold.monthly_trends_by_area AS
            SELECT
                REGEXP_EXTRACT(postcode, '^[A-Z]+') AS postcode_area,
                transaction_year,
                transaction_month,
                COUNT(*)             AS transaction_count,
                ROUND(AVG(price), 2) AS avg_price,
                ROUND(MEDIAN(price), 2) AS median_price
            FROM silver.transactions
            WHERE postcode IS NOT NULL
              AND REGEXP_EXTRACT(postcode, '^[A-Z]+') != ''
            GROUP BY postcode_area, transaction_year, transaction_month
            ORDER BY postcode_area, transaction_year, transaction_month
        """)

        result = con.execute("SELECT COUNT(*) FROM gold.monthly_trends_by_area").fetchone()
        print(f"✓ Created {result[0]} month/area combinations")

    except Exception as e:
        print(f"✗ Error creating monthly_trends_by_area: {e}")
        return False

    print()

    # =========================================================================
    # 6. Property Analysis by Postcode Area
    # =========================================================================
    print("=" * 70)
    print("6. Creating Property Analysis by Postcode Area")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.property_analysis_by_area")

        con.execute("""
            CREATE TABLE gold.property_analysis_by_area AS
            SELECT
                REGEXP_EXTRACT(postcode, '^[A-Z]+') AS postcode_area,
                property_type,
                transaction_year,
                COUNT(*)                AS transaction_count,
                ROUND(AVG(price), 2)   AS avg_price,
                ROUND(MEDIAN(price), 2) AS median_price,
                ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price), 2) AS p25,
                ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price), 2) AS p75
            FROM silver.transactions
            WHERE postcode IS NOT NULL
              AND REGEXP_EXTRACT(postcode, '^[A-Z]+') != ''
            GROUP BY postcode_area, property_type, transaction_year
            ORDER BY postcode_area, transaction_year, property_type
        """)

        result = con.execute("SELECT COUNT(*) FROM gold.property_analysis_by_area").fetchone()
        print(f"✓ Created {result[0]} area/type/year combinations")

    except Exception as e:
        print(f"✗ Error creating property_analysis_by_area: {e}")
        return False

    print()

    # =========================================================================
    # 7. Postcode Area Labels (human-readable names)
    # =========================================================================
    print("=" * 70)
    print("7. Creating Postcode Area Labels")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.postcode_area_labels")

        con.execute("""
            CREATE TABLE gold.postcode_area_labels AS
            WITH ranked_towns AS (
                SELECT
                    REGEXP_EXTRACT(postcode, '^[A-Z]+') AS postcode_area,
                    town_city,
                    COUNT(*) AS n,
                    ROW_NUMBER() OVER (
                        PARTITION BY REGEXP_EXTRACT(postcode, '^[A-Z]+')
                        ORDER BY COUNT(*) DESC
                    ) AS rn
                FROM silver.transactions
                WHERE postcode IS NOT NULL
                  AND REGEXP_EXTRACT(postcode, '^[A-Z]+') != ''
                  AND town_city IS NOT NULL
                  AND town_city != 'Unknown'
                  AND town_city != ''
                GROUP BY postcode_area, town_city
            )
            SELECT
                postcode_area,
                STRING_AGG(
                    UPPER(LEFT(town_city, 1)) || LOWER(SUBSTRING(town_city, 2)),
                    ', '
                    ORDER BY rn
                ) AS area_name
            FROM ranked_towns
            WHERE rn <= 3
            GROUP BY postcode_area
            ORDER BY postcode_area
        """)

        result = con.execute("SELECT COUNT(*) FROM gold.postcode_area_labels").fetchone()
        print(f"✓ Created labels for {result[0]} postcode areas")

        print("\nSample:")
        preview = con.execute("""
            SELECT * FROM gold.postcode_area_labels
            WHERE postcode_area IN ('CM', 'BS', 'M', 'SW', 'L', 'B')
            ORDER BY postcode_area
        """).fetchdf()
        print(preview.to_string(index=False))

    except Exception as e:
        print(f"✗ Error creating postcode_area_labels: {e}")
        return False

    print()

    # =========================================================================
    # 8. UK Overview (one row per postcode area — centroids + stats)
    # =========================================================================
    print("=" * 70)
    print("8. Creating UK Overview")
    print("=" * 70)

    try:
        con.execute("DROP TABLE IF EXISTS gold.uk_overview")

        con.execute("""
            CREATE TABLE gold.uk_overview AS
            SELECT
                REGEXP_EXTRACT(t.postcode, '^[A-Z]+')  AS postcode_area,
                AVG(p.latitude)                        AS center_lat,
                AVG(p.longitude)                       AS center_long,
                COUNT(*)                               AS total_transactions,
                ROUND(AVG(t.price), 2)                 AS avg_price,
                ROUND(MEDIAN(t.price), 2)              AS median_price,
                MAX(t.transaction_year)                AS latest_year
            FROM silver.transactions t
            INNER JOIN silver.postcodes p ON t.postcode = p.postcode
            WHERE p.latitude  IS NOT NULL
              AND p.longitude IS NOT NULL
              AND p.latitude  != 0
              AND p.longitude != 0
              AND REGEXP_EXTRACT(t.postcode, '^[A-Z]+') != ''
            GROUP BY postcode_area
            HAVING COUNT(*) >= 100
            ORDER BY postcode_area
        """)

        result = con.execute("SELECT COUNT(*) FROM gold.uk_overview").fetchone()
        print(f"✓ Created UK overview for {result[0]} postcode areas")

        print("\nSample:")
        preview = con.execute("""
            SELECT postcode_area, center_lat, center_long, total_transactions, avg_price
            FROM gold.uk_overview
            ORDER BY total_transactions DESC
            LIMIT 5
        """).fetchdf()
        print(preview.to_string(index=False))

    except Exception as e:
        print(f"✗ Error creating uk_overview: {e}")
        return False

    print()

    # =========================================================================
    # 9. Indexes for fast dashboard lookups
    # =========================================================================
    print("=" * 70)
    print("9. Creating Indexes")
    print("=" * 70)

    indexes = [
        ("idx_summary_area",        "gold.market_summary_by_area",      "postcode_area"),
        ("idx_district_area",       "gold.market_summary_by_district",  "postcode_area"),
        ("idx_district_code",       "gold.market_summary_by_district",  "postcode_district"),
        ("idx_heatmap_area",        "gold.heatmap_data",                "postcode_area"),
        ("idx_heatmap_district",    "gold.heatmap_data",                "postcode_district"),
        ("idx_heatmap_type_area",   "gold.heatmap_data_by_type",        "(postcode_area property_type)"),
        ("idx_monthly_area",        "gold.monthly_trends_by_area",      "postcode_area"),
        ("idx_property_area",       "gold.property_analysis_by_area",   "postcode_area"),
        ("idx_area_labels",         "gold.postcode_area_labels",        "postcode_area"),
        ("idx_uk_overview_area",    "gold.uk_overview",                 "postcode_area"),
    ]

    for idx_name, table, column in indexes:
        try:
            con.execute(f"DROP INDEX IF EXISTS {idx_name}")
            con.execute(f"CREATE INDEX {idx_name} ON {table}({column})")
            print(f"  ✓ {idx_name}")
        except Exception as e:
            print(f"  ✗ {idx_name}: {e}")

    print()

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("=" * 70)
    print("GOLD LAYER SUMMARY")
    print("=" * 70)
    
    gold_tables = [
        'market_summary_by_area',
        'market_summary_by_district',
        'heatmap_data',
        'heatmap_data_by_type',
        'monthly_trends_by_area',
        'property_analysis_by_area',
        'postcode_area_labels',
        'uk_overview',
    ]
    
    table_stats = []
    for table in gold_tables:
        try:
            result = con.execute(f"SELECT COUNT(*) FROM gold.{table}").fetchone()
            table_stats.append({'table_name': table, 'row_count': f"{result[0]:,}"})
        except:
            table_stats.append({'table_name': table, 'row_count': 'ERROR'})
    
    tables_df = pd.DataFrame(table_stats)
    print(tables_df.to_string(index=False))
    print()
    
    db_size_mb = Path(DB_PATH).stat().st_size / (1024 * 1024)
    print(f"Database size: {db_size_mb:.2f} MB")
    print()
    
    print("=" * 70)
    print("✓ GOLD LAYER AGGREGATION COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print()
    print("Next step:")
    print("  Run: pixi run -e api api")
    print()
    print("Gold tables:")
    print("  - gold.market_summary_by_area       <- yearly stats per postcode area")
    print("  - gold.market_summary_by_district   <- district-level drill-down")
    print("  - gold.heatmap_data                 <- map lat/long + prices")
    print("  - gold.heatmap_data_by_type         <- heatmap filtered by property type")
    print("  - gold.monthly_trends_by_area       <- seasonality for any area")
    print("  - gold.property_analysis_by_area    <- property type breakdown")
    print("  - gold.postcode_area_labels         <- human-readable area names")
    print("  - gold.uk_overview                  <- UK-wide centroids for overview map")
    
    con.close()
    return True

if __name__ == "__main__":
    success = create_gold_layer()
    sys.exit(0 if success else 1)
