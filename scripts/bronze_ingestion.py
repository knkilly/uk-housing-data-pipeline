"""
Bronze Layer Ingestion - Load raw CSV data into DuckDB
"""
import sys
from pathlib import Path
from datetime import datetime
import duckdb
import pandas as pd

DB_PATH = "data/processed/housing_analytics.db"

def ingest_bronze_layer():
    """Ingest raw CSV files into bronze layer tables"""
    
    print("=" * 70)
    print("BRONZE LAYER INGESTION")
    print("=" * 70)
    print(f"Started at: {datetime.now()}")
    print()
    
    # Connect to DuckDB
    print("Connecting to DuckDB...")
    con = duckdb.connect(DB_PATH)
    print(f"✓ Connected to: {DB_PATH}")
    print()
    
    # Create bronze schema
    print("Creating bronze schema...")
    con.execute("CREATE SCHEMA IF NOT EXISTS bronze")
    print("✓ Bronze schema ready")
    print()
    
    # Ingest Land Registry data
    print("=" * 70)
    print("1. Ingesting Land Registry Transactions")
    print("=" * 70)
    
    land_registry_file = Path("data/raw/land_registry/pp-complete.csv")
    
    if not land_registry_file.exists():
        print(f"✗ File not found: {land_registry_file}")
        return False
    
    print(f"Source: {land_registry_file}")
    size_mb = land_registry_file.stat().st_size / (1024 * 1024)
    print(f"Size: {size_mb:.2f} MB")
    print()
    
    print("Loading data... (this may take 2-5 minutes)")
    start_time = datetime.now()
    
    try:
        # Drop existing table
        con.execute("DROP TABLE IF EXISTS bronze.land_registry_transactions")
        
        # Create table from CSV with proper column names
        con.execute(f"""
            CREATE TABLE bronze.land_registry_transactions AS
            SELECT 
                column00 as transaction_id,
                CAST(column01 as DECIMAL(15,2)) as price,
                CAST(column02 as DATE) as transaction_date,
                column03 as postcode,
                column04 as property_type,
                column05 as old_new,
                column06 as duration,
                column07 as paon,
                column08 as saon,
                column09 as street,
                column10 as locality,
                column11 as town_city,
                column12 as district,
                column13 as county,
                column14 as ppd_category_type,
                column15 as record_status,
                CURRENT_TIMESTAMP as ingestion_timestamp,
                '{land_registry_file.name}' as source_file,
                YEAR(CAST(column02 as DATE)) as transaction_year
            FROM read_csv_auto('{land_registry_file}', 
                header=false,
                delim=',',
                quote='"',
                escape='"'
            )
        """)
        
        # Get row count
        result = con.execute("SELECT COUNT(*) FROM bronze.land_registry_transactions").fetchone()
        row_count = result[0]
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"✓ Loaded {row_count:,} transactions in {duration:.2f} seconds")
        print(f"  Rate: {row_count/duration:,.0f} rows/second")
        
        # Show sample
        print("\nSample data (first 3 rows):")
        sample = con.execute("""
            SELECT transaction_id, price, transaction_date, postcode, property_type, town_city
            FROM bronze.land_registry_transactions 
            LIMIT 3
        """).fetchdf()
        print(sample.to_string(index=False))
        
    except Exception as e:
        print(f"✗ Error loading transactions: {e}")
        return False
    
    print()
    
    # Ingest ONS Postcodes
    print("=" * 70)
    print("2. Ingesting ONS Postcodes")
    print("=" * 70)
    
    ons_files = list(Path("data/raw/ons_postcodes").glob("*.csv"))
    
    if not ons_files:
        print("✗ No ONS Postcode files found")
        return False
    
    print(f"Found {len(ons_files)} ONS file(s):")
    total_size_mb = 0
    for f in ons_files:
        size_mb = f.stat().st_size / (1024 * 1024)
        total_size_mb += size_mb
        print(f"  {f.name} ({size_mb:.2f} MB)")
    print(f"Total: {total_size_mb:.2f} MB")
    print()

    # Use glob pattern so DuckDB loads ALL files in one pass
    ons_glob = str(Path("data/raw/ons_postcodes") / "*.csv")
    
    print("Loading data... (this may take 1-3 minutes)")
    start_time = datetime.now()
    
    try:
        # Drop existing table
        con.execute("DROP TABLE IF EXISTS bronze.ons_postcodes")
        
        # Load ALL csv files in the folder in a single read
        con.execute(f"""
            CREATE TABLE bronze.ons_postcodes AS
            SELECT 
                *,
                CURRENT_TIMESTAMP as ingestion_timestamp,
                filename as source_file
            FROM read_csv_auto('{ons_glob}',
                header=true,
                ignore_errors=true,
                filename=true
            )
        """)
        
        # Get row count
        result = con.execute("SELECT COUNT(*) FROM bronze.ons_postcodes").fetchone()
        row_count = result[0]
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"✓ Loaded {row_count:,} postcodes in {duration:.2f} seconds")
        print(f"  Rate: {row_count/duration:,.0f} rows/second")
        
        # Show sample
        print("\nSample data (first 3 rows):")
        # Get column names to display relevant ones
        columns = con.execute("PRAGMA table_info('bronze.ons_postcodes')").fetchdf()
        # Try common postcode column names
        postcode_cols = ['pcd', 'pcds', 'postcode']
        lat_cols = ['lat', 'latitude']
        long_cols = ['long', 'longitude', 'lng']
        
        # Find which columns exist
        available_cols = columns['name'].tolist()
        pc_col = next((c for c in postcode_cols if c in available_cols), available_cols[0])
        lat_col = next((c for c in lat_cols if c in available_cols), None)
        long_col = next((c for c in long_cols if c in available_cols), None)
        
        select_cols = [pc_col]
        if lat_col: select_cols.append(lat_col)
        if long_col: select_cols.append(long_col)
        
        sample = con.execute(f"""
            SELECT {', '.join(select_cols[:5])}
            FROM bronze.ons_postcodes 
            LIMIT 3
        """).fetchdf()
        print(sample.to_string(index=False))
        
    except Exception as e:
        print(f"✗ Error loading postcodes: {e}")
        return False
    
    print()
    
    # Summary
    print("=" * 70)
    print("BRONZE LAYER SUMMARY")
    print("=" * 70)
    
    # Get table stats
    stats = con.execute("""
        SELECT 
            'Transactions' as table_name,
            COUNT(*) as row_count,
            MIN(transaction_year) as min_year,
            MAX(transaction_year) as max_year
        FROM bronze.land_registry_transactions
        UNION ALL
        SELECT 
            'Postcodes' as table_name,
            COUNT(*) as row_count,
            NULL as min_year,
            NULL as max_year
        FROM bronze.ons_postcodes
    """).fetchdf()
    
    print(stats.to_string(index=False))
    print()
    
    # Database size
    db_size_mb = Path(DB_PATH).stat().st_size / (1024 * 1024)
    print(f"Database size: {db_size_mb:.2f} MB")
    print(f"Database location: {DB_PATH}")
    print()
    
    print("=" * 70)
    print("✓ BRONZE LAYER INGESTION COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print()
    print("Next steps:")
    print("  1. Run: pixi run silver")
    print("  2. Run: pixi run gold")
    
    con.close()
    return True

if __name__ == "__main__":
    success = ingest_bronze_layer()
    sys.exit(0 if success else 1)
