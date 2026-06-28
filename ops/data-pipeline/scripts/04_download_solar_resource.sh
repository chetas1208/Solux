#!/usr/bin/env bash
# Download / sample solar resource data.
# Sources: NREL NSRDB (API key required), PVGIS (free API — sampled per candidate),
#          Global Solar Atlas (manual — GeoTIFF rasters)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ── NREL NSRDB ────────────────────────────────────────────────────────────────
if scope_includes "USA"; then
  RAW_NSRDB="${DATA_ROOT}/raw/usa/nsrdb"
  mkdir -p "$RAW_NSRDB"

  if [[ -z "${NREL_API_KEY:-}" ]]; then
    log_warn "NREL_API_KEY not set — skipping NSRDB download."
    log_warn "  Get a free key at: https://developer.nrel.gov/signup/"
    log_warn "  NSRDB data will be fetched point-by-point during candidate scoring."
    cat > "${RAW_NSRDB}/NREL_API_KEY_REQUIRED.md" << 'MSG'
# NREL NSRDB — API Key Required

Set `NREL_API_KEY` in your `.env` file to enable bulk NSRDB downloads.

Sign up at: https://developer.nrel.gov/signup/

## How NSRDB is Used
NSRDB PSM3 TMY data provides hourly GHI, DNI, DHI, temperature, wind speed
for U.S. candidate site validation. Without the key, the pipeline will call
PVGIS (free, no key) as a fallback for solar resource.

## Bulk Download (optional, large)
When NREL_API_KEY is set and DOWNLOAD_BIG_RASTERS=true, the pipeline
samples NSRDB at each candidate cell centroid via the PSM3 TMY API.
MSG
    write_source_meta "nrel_nsrdb" "no_api_key" "$RAW_NSRDB" "Set NREL_API_KEY to enable"
  else
    log_info "NREL API key present — NSRDB will be sampled per candidate during scoring."
    # Save a probe request to confirm key validity
    PROBE_DEST="${RAW_NSRDB}/nsrdb_probe.json"
    if [[ ! -f "$PROBE_DEST" ]]; then
      PROBE_URL="https://developer.nrel.gov/api/nsrdb/v2/solar/psm3-download.json?api_key=${NREL_API_KEY}&wkt=POINT(-104.98+39.76)&names=tmy&email=solux@example.com&attributes=ghi&interval=60&utc=false&leap_day=false&full_name=SoluxPipeline&affiliation=Solux&reason=screening"
      if curl -fSL --retry 2 --connect-timeout 20 -o "$PROBE_DEST" "$PROBE_URL" 2>/dev/null; then
        if jq -e '.errors == null or .errors == []' "$PROBE_DEST" &>/dev/null; then
          log_ok "NREL NSRDB API key valid"
          write_source_meta "nrel_nsrdb" "api_valid" "$RAW_NSRDB"
        else
          local err; err=$(jq -r '.errors[0] // "unknown error"' "$PROBE_DEST")
          log_warn "NREL NSRDB API key error: $err"
          write_source_meta "nrel_nsrdb" "api_error" "$RAW_NSRDB" "$err"
        fi
      else
        log_warn "NREL NSRDB probe request failed"
        write_source_meta "nrel_nsrdb" "probe_failed" "$RAW_NSRDB"
      fi
    else
      log_skip "NSRDB probe already run"
    fi
  fi
fi

# ── PVGIS ─────────────────────────────────────────────────────────────────────
RAW_PVGIS="${DATA_ROOT}/raw/global/pvgis"
mkdir -p "$RAW_PVGIS"
log_info "Probing PVGIS API …"

PVGIS_PROBE_DEST="${RAW_PVGIS}/pvgis_probe.json"
PVGIS_PROBE_URL="${PVGIS_BASE_URL}/PVcalc?outputformat=json&lat=23.0&lon=72.5&peakpower=1&loss=14&mountingplace=free&pvtechchoice=crystSi&fixed=1&optimalinclination=1&optimalangles=1"

if [[ -f "$PVGIS_PROBE_DEST" && "$FORCE_DOWNLOAD" != "true" ]]; then
  log_skip "PVGIS probe already run"
  write_source_meta "pvgis" "available" "$RAW_PVGIS"
elif curl -fSL --retry 2 --connect-timeout 20 -o "$PVGIS_PROBE_DEST" "$PVGIS_PROBE_URL" 2>/dev/null; then
  if jq -e '.outputs != null' "$PVGIS_PROBE_DEST" &>/dev/null; then
    log_ok "PVGIS API reachable"
    write_source_meta "pvgis" "available" "$RAW_PVGIS"
  else
    log_warn "PVGIS probe returned unexpected response"
    write_source_meta "pvgis" "probe_unexpected" "$RAW_PVGIS"
  fi
else
  log_warn "PVGIS API unreachable — solar resource fallback will be unavailable"
  write_source_meta "pvgis" "unreachable" "$RAW_PVGIS"
fi

# ── Global Solar Atlas (manual GeoTIFF) ───────────────────────────────────────
RAW_GSA="${DATA_ROOT}/raw/global/global_solar_atlas"
mkdir -p "$RAW_GSA"

if [[ "$DOWNLOAD_GLOBAL_SOLAR_ATLAS" == "true" ]]; then
  # Global Solar Atlas doesn't provide a public bulk API for full-resolution rasters.
  # The World Bank Data Catalog provides links but requires navigating a download form.
  log_warn "DOWNLOAD_GLOBAL_SOLAR_ATLAS=true but no public bulk download API exists."
  create_manual_download_notice "$RAW_GSA" "Global Solar Atlas" \
    "Manual download required from https://globalsolaratlas.info/download

Steps:
1. Go to https://globalsolaratlas.info/download
2. Select region: World (or India/USA subset)
3. Download GeoTIFF files for:
   - GHI (Global Horizontal Irradiation)
   - PVOUT (Photovoltaic Power Output)
   - DNI (Direct Normal Irradiation)
4. Place the .tif files in: ${RAW_GSA}/

Alternatively, the World Bank Data Catalog has downloadable files:
https://datacatalog.worldbank.org/search/dataset/0038641
Choose 'World' resolution (larger file) or country-level."
  write_source_meta "global_solar_atlas" "manual_required" "$RAW_GSA"
else
  # Check if manually downloaded files are present
  if ls "${RAW_GSA}"/*.tif "${RAW_GSA}"/*.TIF 2>/dev/null | grep -q .; then
    log_ok "Global Solar Atlas rasters found in ${RAW_GSA}"
    write_source_meta "global_solar_atlas" "available_manual" "$RAW_GSA"
  else
    log_skip "Global Solar Atlas not downloaded (set DOWNLOAD_GLOBAL_SOLAR_ATLAS=true)"
    write_source_meta "global_solar_atlas" "skipped" "$RAW_GSA" "Set DOWNLOAD_GLOBAL_SOLAR_ATLAS=true and download manually"
  fi
fi

log_ok "Solar resource download step complete."
