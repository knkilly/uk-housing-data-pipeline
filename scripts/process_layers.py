"""
Process Layers — Run the full data pipeline from download to gold.

Usage:
    pixi run process                        # download + bronze + silver + gold
    pixi run process -- --skip-download     # bronze + silver + gold only
"""
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


def run_step(name: str, script: str) -> bool:
    """Run a pipeline script as a subprocess, print timing, return success."""
    print()
    print("=" * 70)
    print(f"  STEP: {name}")
    print("=" * 70)
    print()
    start = time.time()
    result = subprocess.run([sys.executable, script])
    elapsed = time.time() - start
    ok = result.returncode == 0
    status = "✓" if ok else "✗"
    print(f"\n{status} {name} — {elapsed:.1f}s")
    return ok


def main():
    skip_download = "--skip-download" in sys.argv

    print("╔" + "═" * 68 + "╗")
    print("║" + " UK HOUSING ANALYTICS — FULL PIPELINE".center(68) + "║")
    print("╚" + "═" * 68 + "╝")
    print(f"  Started:  {datetime.now():%Y-%m-%d %H:%M:%S}")
    print(f"  Download: {'skip' if skip_download else 'enabled'}")
    print()

    pipeline_start = time.time()
    steps_run = 0
    steps_ok = 0

    # Create directories
    for d in ["data/raw/land_registry", "data/raw/ons_postcodes", "data/processed"]:
        Path(d).mkdir(parents=True, exist_ok=True)

    # ── 0. Download data ──────────────────────────────────────────────
    if not skip_download:
        lr_file = Path("data/raw/land_registry/pp-complete.csv")
        if lr_file.exists():
            size_mb = lr_file.stat().st_size / (1024 * 1024)
            print(f"  Land Registry file exists ({size_mb:.0f} MB) — skipping download")
        else:
            print("  ✗ Land Registry file not found.")
            print("    Download manually from:")
            print("    https://price-paid-data.publicdata.landregistry.gov.uk/pp-complete.csv")
            print(f"    Save as: {lr_file}")
            sys.exit(1)

        ons_files = list(Path("data/raw/ons_postcodes").glob("*.csv"))
        if ons_files:
            print(f"  ONS Postcode files exist ({len(ons_files)} file(s)) — skipping download")
        else:
            steps_run += 1
            if run_step("Download ONS Postcodes", "scripts/download_ons_postcodes.py"):
                steps_ok += 1
            else:
                print("\n✗ Postcode download failed. Pipeline stopped.")
                sys.exit(1)
    else:
        print("  Skipping download (--skip-download)")

    print()

    # ── 1. Bronze ─────────────────────────────────────────────────────
    steps_run += 1
    if not run_step("Bronze Ingestion", "scripts/bronze_ingestion.py"):
        print("\n✗ Bronze failed. Pipeline stopped.")
        sys.exit(1)
    steps_ok += 1

    # ── 2. Silver ─────────────────────────────────────────────────────
    steps_run += 1
    if not run_step("Silver Transformation", "scripts/silver_transformation.py"):
        print("\n✗ Silver failed. Pipeline stopped.")
        sys.exit(1)
    steps_ok += 1

    # ── 3. Gold ───────────────────────────────────────────────────────
    steps_run += 1
    if not run_step("Gold Aggregation", "scripts/gold_aggregation.py"):
        print("\n✗ Gold failed. Pipeline stopped.")
        sys.exit(1)
    steps_ok += 1

    # ── Summary ───────────────────────────────────────────────────────
    total_elapsed = time.time() - pipeline_start
    db_path = Path("data/processed/housing_analytics.db")
    db_size = f"{db_path.stat().st_size / (1024*1024):.0f} MB" if db_path.exists() else "N/A"

    print()
    print("╔" + "═" * 68 + "╗")
    print("║" + " PIPELINE COMPLETE".center(68) + "║")
    print("╚" + "═" * 68 + "╝")
    print(f"  Steps:    {steps_ok}/{steps_run} succeeded")
    print(f"  Duration: {total_elapsed/60:.1f} minutes")
    print(f"  Database: {db_path} ({db_size})")
    print()
    print("  Next steps (in separate terminals):")
    print("    pixi run -e api api               # start the API")
    print("    cd app/frontend && npm run dev    # start the frontend")
    print()


if __name__ == "__main__":
    main()
