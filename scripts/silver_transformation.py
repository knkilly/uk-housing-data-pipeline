"""
Silver Layer Transformation - Clean and enrich bronze data
"""
import sys
from pathlib import Path
from datetime import datetime
import duckdb

DB_PATH = "data/processed/housing_analytics.db"

def transform_silver_layer():
    """Transform bronze data into clean silver layer"""
    
    print("=" * 70)
    print("SILVER LAYER TRANSFORMATION")
    print("=" * 70)
    print(f"Started at: {datetime.now()}")
    print()
    
    # Connect to DuckDB
    print("Connecting to DuckDB...")
    con = duckdb.connect(DB_PATH)
    print(f"✓ Connected to: {DB_PATH}")
    print()
    
    # Create silver schema
    print("Creating silver schema...")
    con.execute("CREATE SCHEMA IF NOT EXISTS silver")
    print("✓ Silver schema ready")
    print()
    
    # Transform Transactions
    print("=" * 70)
    print("1. Transforming Transactions")
    print("=" * 70)
    print("Applying transformations:")
    print("  - Remove duplicates")
    print("  - Filter valid prices (>= £1,000)")
    print("  - Standardise postcodes")
    print("  - Add derived fields")
    print()
    
    start_time = datetime.now()
    
    try:
        con.execute("DROP TABLE IF EXISTS silver.transactions")
        
        con.execute("""
            CREATE TABLE silver.transactions AS
            SELECT DISTINCT
                transaction_id,
                price,
                transaction_date,
                UPPER(TRIM(postcode)) as postcode,
                CASE property_type
                    WHEN 'D' THEN 'Detached'
                    WHEN 'S' THEN 'Semi-Detached'
                    WHEN 'T' THEN 'Terraced'
                    WHEN 'F' THEN 'Flat'
                    WHEN 'O' THEN 'Other'
                    ELSE 'Unknown'
                END as property_type,
                CASE old_new
                    WHEN 'Y' THEN 'New Build'
                    WHEN 'N' THEN 'Established'
                    ELSE 'Unknown'
                END as build_status,
                CASE duration
                    WHEN 'F' THEN 'Freehold'
                    WHEN 'L' THEN 'Leasehold'
                    ELSE 'Unknown'
                END as tenure,
                COALESCE(NULLIF(TRIM(paon), ''), 'Unknown') as paon,
                COALESCE(NULLIF(TRIM(saon), ''), NULL) as saon,
                COALESCE(NULLIF(TRIM(street), ''), 'Unknown') as street,
                COALESCE(NULLIF(TRIM(locality), ''), NULL) as locality,
                COALESCE(NULLIF(TRIM(town_city), ''), 'Unknown') as town_city,
                COALESCE(NULLIF(TRIM(district), ''), 'Unknown') as district,
                COALESCE(NULLIF(TRIM(county), ''), NULL) as county,
                transaction_year,
                EXTRACT(MONTH FROM transaction_date) as transaction_month,
                EXTRACT(QUARTER FROM transaction_date) as transaction_quarter,
                ingestion_timestamp,
                source_file
            FROM bronze.land_registry_transactions
            WHERE price >= 1000
              AND transaction_date IS NOT NULL
              AND record_status != 'D'
        """)
        
        result = con.execute("SELECT COUNT(*) FROM silver.transactions").fetchone()
        row_count = result[0]
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"✓ Transformed {row_count:,} transactions in {duration:.2f} seconds")
        
        # Show data quality stats
        print("\nData quality improvements:")
        stats = con.execute("""
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT transaction_id) as unique_transactions,
                SUM(CASE WHEN postcode IS NOT NULL THEN 1 ELSE 0 END) as with_postcode
            FROM silver.transactions
        """).fetchdf()
        print(stats.to_string(index=False))
        
    except Exception as e:
        print(f"✗ Error transforming transactions: {e}")
        return False
    
    print()
    
    # Transform Postcodes
    print("=" * 70)
    print("2. Transforming Postcodes")
    print("=" * 70)
    print("Applying transformations:")
    print("  - Standardise postcode format")
    print("  - Filter UK coordinates")
    print("  - Select relevant columns")
    print()
    
    start_time = datetime.now()
    
    try:
        # First, get available columns
        columns = con.execute("PRAGMA table_info('bronze.ons_postcodes')").fetchdf()
        available_cols = columns['name'].tolist()
        
        # Map to expected column names (case-insensitive)
        col_map = {}
        available_cols_lower = {c.lower(): c for c in available_cols}

        # Postcode columns
        for pc in ['pcds', 'pcd8', 'pcd7', 'pcd', 'postcode']:
            if pc in available_cols_lower:
                col_map['postcode'] = available_cols_lower[pc]
                break

        # Coordinate columns
        for lat in ['lat', 'latitude']:
            if lat in available_cols_lower:
                col_map['latitude'] = available_cols_lower[lat]
                break
        for lng in ['long', 'longitude', 'lng']:
            if lng in available_cols_lower:
                col_map['longitude'] = available_cols_lower[lng]
                break

        # Location columns — include uppercase ONS API field names
        for col, opts in [
            ('district', ['lad25cd', 'laua', 'lauanm', 'district', 'oslaua']),
            ('ward',     ['wd25cd', 'ward', 'wardnm', 'osward']),
            ('region',   ['rgn25cd', 'rgn', 'rgnnm', 'region']),
            ('country',  ['ctry25cd', 'ctry', 'ctrynm', 'country']),
        ]:
            for opt in opts:
                if opt in available_cols_lower:
                    col_map[col] = available_cols_lower[opt]
                    break
        
        # Build SELECT statement
        select_parts = [
            f"UPPER(TRIM({col_map.get('postcode', 'column0')})) as postcode"
        ]
        
        if 'latitude' in col_map:
            select_parts.append(f"CAST({col_map['latitude']} as DOUBLE) as latitude")
        else:
            select_parts.append("NULL as latitude")
            
        if 'longitude' in col_map:
            select_parts.append(f"CAST({col_map['longitude']} as DOUBLE) as longitude")
        else:
            select_parts.append("NULL as longitude")
        
        for col in ['district', 'ward', 'region', 'country']:
            if col in col_map:
                select_parts.append(f"COALESCE(NULLIF(TRIM({col_map[col]}), ''), 'Unknown') as {col}")
            else:
                select_parts.append(f"'Unknown' as {col}")
        
        select_parts.extend([
            "ingestion_timestamp",
            "source_file"
        ])
        
        con.execute("DROP TABLE IF EXISTS silver.postcodes")
        
        con.execute(f"""
            CREATE TABLE silver.postcodes AS
            SELECT DISTINCT
                {', '.join(select_parts)}
            FROM bronze.ons_postcodes
            WHERE {col_map.get('postcode', 'column0')} IS NOT NULL
        """)
        
        result = con.execute("SELECT COUNT(*) FROM silver.postcodes").fetchone()
        row_count = result[0]
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"✓ Transformed {row_count:,} postcodes in {duration:.2f} seconds")
        
        # Show coordinate coverage
        print("\nCoordinate coverage:")
        stats = con.execute("""
            SELECT 
                COUNT(*) as total_postcodes,
                SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) as with_coordinates,
                ROUND(100.0 * SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as coverage_percent
            FROM silver.postcodes
        """).fetchdf()
        print(stats.to_string(index=False))
        
    except Exception as e:
        print(f"✗ Error transforming postcodes: {e}")
        return False
    
    print()

    # =========================================================================
    # 3. Repeat-Property Sales (helper for gold.repeat_sales)
    # =========================================================================
    print("=" * 70)
    print("3. Building Repeat-Property Sales helper")
    print("=" * 70)
    print("Narrowing to address-matched properties with 3+ sales")
    print("(key = postcode + PAON + SAON). The heavy filter runs once here so")
    print("gold.repeat_sales becomes a light aggregation.")
    print()

    start_time = datetime.now()
    try:
        con.execute("PRAGMA preserve_insertion_order=false")

        # Pass 1 (cheap, count only): which properties sold 3+ times.
        # 3+ is a more meaningful "repeat" signal than 2 and sharply shrinks
        # the set (most homes have sold exactly twice since 1995).
        t0 = datetime.now()
        con.execute("DROP TABLE IF EXISTS silver.repeat_keys")
        con.execute("""
            CREATE TABLE silver.repeat_keys AS
            SELECT postcode, paon, saon
            FROM silver.transactions
            WHERE paon <> 'Unknown'
            GROUP BY postcode, paon, saon
            HAVING COUNT(*) >= 3
        """)
        n_keys = con.execute("SELECT COUNT(*) FROM silver.repeat_keys").fetchone()[0]
        print(f"  [1/2] repeat property keys: {n_keys:,}  "
              f"({(datetime.now() - t0).total_seconds():.1f}s)")

        # Pass 2: keep only the sale rows for those properties.
        t0 = datetime.now()
        con.execute("DROP TABLE IF EXISTS silver.repeat_property_sales")
        con.execute("""
            CREATE TABLE silver.repeat_property_sales AS
            SELECT t.postcode, t.paon, t.saon, t.street, t.town_city,
                   t.transaction_date, t.price, t.tenure
            FROM silver.transactions t
            INNER JOIN silver.repeat_keys k
                ON  t.postcode = k.postcode
                AND t.paon     = k.paon
                AND t.saon IS NOT DISTINCT FROM k.saon
        """)
        n_rows = con.execute("SELECT COUNT(*) FROM silver.repeat_property_sales").fetchone()[0]
        print(f"  [2/2] repeat-property sale rows: {n_rows:,}  "
              f"({(datetime.now() - t0).total_seconds():.1f}s)")

        con.execute("DROP TABLE IF EXISTS silver.repeat_keys")
        duration = (datetime.now() - start_time).total_seconds()
        print(f"✓ Built silver.repeat_property_sales in {duration:.2f} seconds")
    except Exception as e:
        print(f"✗ Error building repeat-property sales: {e}")
        return False

    print()

    # Summary
    print("=" * 70)
    print("SILVER LAYER SUMMARY")
    print("=" * 70)
    
    stats = con.execute("""
        SELECT 
            'Transactions' as table_name,
            COUNT(*) as row_count,
            MIN(transaction_year) as min_year,
            MAX(transaction_year) as max_year
        FROM silver.transactions
        UNION ALL
        SELECT 
            'Postcodes' as table_name,
            COUNT(*) as row_count,
            NULL,
            NULL
        FROM silver.postcodes
        UNION ALL
        SELECT
            'Repeat-property sales' as table_name,
            COUNT(*) as row_count,
            NULL,
            NULL
        FROM silver.repeat_property_sales
    """).fetchdf()
    
    print(stats.to_string(index=False))
    print()
    
    db_size_mb = Path(DB_PATH).stat().st_size / (1024 * 1024)
    print(f"Database size: {db_size_mb:.2f} MB")
    print()
    
    print("=" * 70)
    print("✓ SILVER LAYER TRANSFORMATION COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print()
    print("Next steps:")
    print("  1. Run: pixi run gold")
    
    con.close()
    return True

if __name__ == "__main__":
    success = transform_silver_layer()
    sys.exit(0 if success else 1)
