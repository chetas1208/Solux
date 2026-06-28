#!/usr/bin/env bash
# Download existing solar farm datasets (benchmarks + energy data).
# Sources: USPVDB, EIA-860, EIA-923, WRI GPPD, Kruitwagen, Global Renewables Watch, India AI Dataset
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ── USPVDB ─────────────────────────────────────────────────────────────────────
if scope_includes "USA"; then
  RAW_USA="${DATA_ROOT}/raw/usa/uspvdb"
  mkdir -p "$RAW_USA"
  log_info "Checking USPVDB …"

  # USPVDB GeoPackage direct download (USGS data releases)
  # Check for 2023 or 2024 release. Try both.
  USPVDB_DOWNLOADED=false
  for year in 2023 2022 2021; do
    USPVDB_URL="https://energy.usgs.gov/uspvdb/data/USPVDB_${year}.zip"
    USPVDB_DEST="${RAW_USA}/USPVDB_${year}.zip"
    if download_if_missing "$USPVDB_URL" "$USPVDB_DEST" "USPVDB ${year}"; then
      unzip -o -d "$RAW_USA" "$USPVDB_DEST" "*.gpkg" "*.shp" "*.csv" 2>/dev/null || true
      write_source_meta "uspvdb" "downloaded" "$RAW_USA" "Year $year"
      USPVDB_DOWNLOADED=true
      break
    fi
  done

  if [[ "$USPVDB_DOWNLOADED" != "true" ]]; then
    # Try the direct GeoPackage URL pattern
    USPVDB_GPKG_URL="https://energy.usgs.gov/uspvdb/data/v2/USPVDB.gpkg"
    if download_if_missing "$USPVDB_GPKG_URL" "${RAW_USA}/USPVDB.gpkg" "USPVDB GeoPackage"; then
      write_source_meta "uspvdb" "downloaded" "$RAW_USA"
    else
      create_manual_download_notice "$RAW_USA" "USPVDB" \
        "Visit https://energy.usgs.gov/uspvdb/data/ and download the latest USPVDB GeoPackage or Shapefile ZIP.
Place the downloaded file in: ${RAW_USA}/
Direct URL is not stable — check the page for the current release."
      write_source_meta "uspvdb" "manual_required" "$RAW_USA"
    fi
  fi
fi

# ── EIA-860 ────────────────────────────────────────────────────────────────────
if scope_includes "USA"; then
  RAW_EIA860="${DATA_ROOT}/raw/usa/eia860"
  mkdir -p "$RAW_EIA860"
  log_info "Downloading EIA-860 …"

  EIA860_DOWNLOADED=false
  for year in 2023 2022 2021; do
    EIA860_URL="https://www.eia.gov/electricity/data/eia860/xls/eia860${year}.zip"
    EIA860_DEST="${RAW_EIA860}/eia860_${year}.zip"
    if download_if_missing "$EIA860_URL" "$EIA860_DEST" "EIA-860 ${year}"; then
      unzip -o -d "${RAW_EIA860}/${year}" "$EIA860_DEST" 2>/dev/null || true
      write_source_meta "eia860" "downloaded" "$RAW_EIA860" "Year $year"
      EIA860_DOWNLOADED=true
      break
    fi
  done

  if [[ "$EIA860_DOWNLOADED" != "true" ]]; then
    write_source_meta "eia860" "download_failed" "$RAW_EIA860" "Check https://www.eia.gov/electricity/data/eia860/"
    log_warn "EIA-860 download failed — pipeline continues"
  fi
fi

# ── EIA-923 ────────────────────────────────────────────────────────────────────
if scope_includes "USA"; then
  RAW_EIA923="${DATA_ROOT}/raw/usa/eia923"
  mkdir -p "$RAW_EIA923"
  log_info "Downloading EIA-923 …"

  EIA923_DOWNLOADED=false
  for year in 2023 2022 2021; do
    EIA923_URL="https://www.eia.gov/electricity/data/eia923/archive/xls/f923_${year}.zip"
    EIA923_DEST="${RAW_EIA923}/eia923_${year}.zip"
    if download_if_missing "$EIA923_URL" "$EIA923_DEST" "EIA-923 ${year}"; then
      unzip -o -d "${RAW_EIA923}/${year}" "$EIA923_DEST" 2>/dev/null || true
      write_source_meta "eia923" "downloaded" "$RAW_EIA923" "Year $year"
      EIA923_DOWNLOADED=true
      break
    fi
  done

  if [[ "$EIA923_DOWNLOADED" != "true" ]]; then
    write_source_meta "eia923" "download_failed" "$RAW_EIA923"
    log_warn "EIA-923 download failed — pipeline continues"
  fi
fi

# ── WRI Global Power Plant Database ───────────────────────────────────────────
RAW_WRI="${DATA_ROOT}/raw/global/wri_gppd"
mkdir -p "$RAW_WRI"
log_info "Downloading WRI GPPD …"

WRI_URL="https://datasets.wri.org/dataset/globalpowerplantdatabase/resource/b01dcdc0-6b7e-4b4d-bfde-7a96e7611f0d"
# The actual CSV direct link (from WRI Dataportal, version 1.3.0)
WRI_CSV_URL="https://wri-dataportal-prod.s3.amazonaws.com/manual/global_power_plant_database_v_1_3.zip"
WRI_DEST="${RAW_WRI}/global_power_plant_database_v1_3.zip"

if download_if_missing "$WRI_CSV_URL" "$WRI_DEST" "WRI GPPD v1.3"; then
  unzip -o -d "$RAW_WRI" "$WRI_DEST" "*.csv" 2>/dev/null || true
  write_source_meta "wri_gppd" "downloaded" "$RAW_WRI"
else
  # Fallback: try the direct CSV
  WRI_CSV_DIRECT="https://datasets.wri.org/dataset/globalpowerplantdatabase/datapackage.json"
  if download_if_missing "$WRI_CSV_DIRECT" "${RAW_WRI}/datapackage.json" "WRI GPPD datapackage"; then
    WRI_DL_URL=$(jq -r '.resources[0].path // empty' "${RAW_WRI}/datapackage.json" 2>/dev/null || true)
    if [[ -n "$WRI_DL_URL" ]]; then
      download_if_missing "$WRI_DL_URL" "${RAW_WRI}/global_power_plant_database.csv" "WRI GPPD CSV" || true
    fi
  fi
  write_source_meta "wri_gppd" "download_attempted" "$RAW_WRI" "URL may have changed"
fi

# ── Kruitwagen Global PV Inventory (Zenodo 5005868) ───────────────────────────
RAW_KPV="${DATA_ROOT}/raw/global/kruitwagen_pv_inventory"
mkdir -p "$RAW_KPV"
log_info "Downloading Kruitwagen PV Inventory (Zenodo) …"
download_zenodo_record "5005868" "$RAW_KPV" "Kruitwagen PV Inventory" \
  && write_source_meta "kruitwagen_pv_inventory" "downloaded" "$RAW_KPV" \
  || write_source_meta "kruitwagen_pv_inventory" "download_failed" "$RAW_KPV"

# ── Global Renewables Watch (Microsoft, GitHub releases) ──────────────────────
RAW_GRW="${DATA_ROOT}/raw/global/global_renewables_watch"
mkdir -p "$RAW_GRW"
log_info "Checking Global Renewables Watch (GitHub releases) …"

GRW_RELEASES_URL="https://api.github.com/repos/microsoft/global-renewables-watch/releases/latest"
GRW_META="${RAW_GRW}/latest_release.json"

if curl -fSL --retry 2 --connect-timeout 20 \
     -H "Accept: application/vnd.github.v3+json" \
     -o "$GRW_META" "$GRW_RELEASES_URL" 2>/dev/null; then

  GRW_PARQUET_URL=$(jq -r '.assets[] | select(.name | test("solar.*\\.parquet$|solar.*\\.geojson$"; "i")) | .browser_download_url' "$GRW_META" 2>/dev/null | head -1 || true)

  if [[ -n "$GRW_PARQUET_URL" && "$GRW_PARQUET_URL" != "null" ]]; then
    GRW_FNAME=$(basename "$GRW_PARQUET_URL")
    download_if_missing "$GRW_PARQUET_URL" "${RAW_GRW}/${GRW_FNAME}" "Global Renewables Watch solar" \
      && write_source_meta "global_renewables_watch" "downloaded" "$RAW_GRW" \
      || write_source_meta "global_renewables_watch" "download_failed" "$RAW_GRW"
  else
    log_warn "Global Renewables Watch: no solar asset in release — check ${GRW_META}"
    write_source_meta "global_renewables_watch" "no_asset_found" "$RAW_GRW" \
      "Visit https://github.com/microsoft/global-renewables-watch/releases"
  fi
else
  log_warn "GitHub API unavailable for Global Renewables Watch"
  write_source_meta "global_renewables_watch" "api_unavailable" "$RAW_GRW"
fi

# ── India AI Solar Dataset (Zenodo 6477614) ────────────────────────────────────
if scope_includes "INDIA"; then
  RAW_IND="${DATA_ROOT}/raw/india/solar_locations_ai_dataset"
  mkdir -p "$RAW_IND"
  log_info "Downloading India AI Solar Dataset (Zenodo) …"
  download_zenodo_record "6477614" "$RAW_IND" "India AI Solar Dataset" \
    && write_source_meta "india_ai_solar_dataset" "downloaded" "$RAW_IND" \
    || write_source_meta "india_ai_solar_dataset" "download_failed" "$RAW_IND"
fi

# ── India NITI Aayog Energy Map — restricted ──────────────────────────────────
if scope_includes "INDIA"; then
  RAW_NITI="${DATA_ROOT}/raw/india/energy_map_reference"
  create_manual_download_notice "$RAW_NITI" "NITI Aayog / ISRO SAC Geospatial Energy Map of India" \
    "This source is a restricted Government of India portal.
DO NOT scrape or automate access to https://vedas.sac.gov.in/energymap/

Options:
1. Request data formally via ISRO SAC at vedas.sac.gov.in
2. Use WRI GPPD + OSM as proxy for India grid/plant data (already downloaded)
3. Check https://data.gov.in for publicly released energy datasets

Reference: https://pib.gov.in/Pressreleaseshare.aspx?PRID=1764738"
  write_source_meta "india_niti_energy_map" "restricted_manual" "$RAW_NITI"
fi

log_ok "Solar asset download complete."
