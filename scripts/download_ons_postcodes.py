"""
Download ONS Postcode Directory (Latest Centroids) from ArcGIS API
Fetches 2000 rows at a time and saves to a single CSV.

Run with: pixi run python scripts/download_postcodes.py
"""

import requests
import pandas as pd
import time
from pathlib import Path
from datetime import datetime

OUTPUT_DIR  = Path("data/raw/ons_postcodes")
OUTPUT_FILE = OUTPUT_DIR / "ONSPD_Latest_Centroids.csv"

# ArcGIS Feature Service endpoint
BASE_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services"
    "/ONSPD_LATEST_UK/FeatureServer/0/query"
)

BATCH_SIZE   = 2000   # API max per request
SAVE_EVERY   = 50     # Write to disk every N batches (~100K rows)
RETRY_LIMIT  = 3      # Retries per failed batch
RETRY_DELAY  = 5      # Seconds between retries


def fetch_batch(offset: int, session: requests.Session) -> pd.DataFrame:
    """Fetch a single batch of 2000 postcodes from the API."""
    params = {
        "where":        "1=1",
        "outFields":    "PCDS,LAT,LONG,LAD25CD,RGN25CD,CTRY25CD",
        "resultOffset": offset,
        "resultRecordCount": BATCH_SIZE,
        "f":            "json",
        "returnGeometry": "false",
    }

    for attempt in range(1, RETRY_LIMIT + 1):
        try:
            r = session.get(BASE_URL, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()

            if "error" in data:
                raise ValueError(f"API error: {data['error']}")

            features = data.get("features", [])
            if not features:
                return pd.DataFrame()

            rows = [f["attributes"] for f in features]
            return pd.DataFrame(rows)

        except Exception as e:
            if attempt < RETRY_LIMIT:
                print(f"    Attempt {attempt} failed: {e} — retrying in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
            else:
                raise


def download_postcodes():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("ONS POSTCODE CENTROIDS DOWNLOAD")
    print("=" * 70)
    print(f"Started: {datetime.now()}")
    print(f"Output:  {OUTPUT_FILE}")
    print(f"Source:  ArcGIS Feature Service (ONSPD_LATEST_UK)")
    print()

    # First request: get total record count
    print("Fetching total record count...")
    session = requests.Session()
    session.headers.update({"User-Agent": "housing-analytics-poc/1.0"})

    count_resp = session.get(BASE_URL, params={
        "where": "1=1", "returnCountOnly": "true", "f": "json"
    }, timeout=30)
    total = count_resp.json().get("count", 0)

    if total == 0:
        print("✗ Could not get record count from API. Check your connection.")
        return False

    total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"✓ Total postcodes: {total:,}")
    print(f"  Batches needed:  {total_batches:,} (x{BATCH_SIZE} rows each)")
    print()

    # Download in batches
    all_chunks  = []
    total_rows  = 0
    start_time  = datetime.now()
    first_write = True

    for batch_num in range(total_batches):
        offset = batch_num * BATCH_SIZE

        try:
            df = fetch_batch(offset, session)
        except Exception as e:
            print(f"\n✗ Failed batch {batch_num} (offset {offset}): {e}")
            print("  Saving progress so far and stopping.")
            break

        if df.empty:
            print(f"\n  No data returned at offset {offset} — download complete.")
            break

        all_chunks.append(df)
        total_rows += len(df)

        # Progress reporting
        pct      = (batch_num + 1) / total_batches * 100
        elapsed  = (datetime.now() - start_time).total_seconds()
        rate     = total_rows / elapsed if elapsed > 0 else 0
        eta_secs = (total - total_rows) / rate if rate > 0 else 0
        eta_mins = eta_secs / 60

        print(
            f"\r  Batch {batch_num+1:>4}/{total_batches} | "
            f"{total_rows:>8,} rows | "
            f"{pct:>5.1f}% | "
            f"{rate:>7,.0f} rows/s | "
            f"ETA {eta_mins:.1f}m",
            end="", flush=True,
        )

        # Periodically flush to disk to avoid memory buildup
        if (batch_num + 1) % SAVE_EVERY == 0 or (batch_num + 1) == total_batches:
            combined = pd.concat(all_chunks, ignore_index=True)
            if first_write:
                combined.to_csv(OUTPUT_FILE, index=False, mode="w")
                first_write = False
            else:
                combined.to_csv(OUTPUT_FILE, index=False, mode="a", header=False)
            all_chunks = []
            print(f"\n  → Saved {total_rows:,} rows to {OUTPUT_FILE.name}")

        # Polite delay to avoid hammering the API
        time.sleep(0.05)

    print()
    print()

    # Final summary
    if OUTPUT_FILE.exists():
        size_mb  = OUTPUT_FILE.stat().st_size / (1024 * 1024)
        elapsed  = (datetime.now() - start_time).total_seconds()
        final_df = pd.read_csv(OUTPUT_FILE, nrows=3)

        print("=" * 70)
        print("DOWNLOAD COMPLETE")
        print("=" * 70)
        print(f"  Rows downloaded: {total_rows:,}")
        print(f"  File size:       {size_mb:.1f} MB")
        print(f"  Time taken:      {elapsed/60:.1f} minutes")
        print(f"  Saved to:        {OUTPUT_FILE}")
        print()
        print("Column preview:")
        print(final_df.to_string(index=False))
        print()
        print("Next steps:")
        print("  pixi run silver")
        print("  pixi run gold")
        return True
    else:
        print("✗ Output file not created — download may have failed.")
        return False


if __name__ == "__main__":
    import sys
    success = download_postcodes()
    sys.exit(0 if success else 1)