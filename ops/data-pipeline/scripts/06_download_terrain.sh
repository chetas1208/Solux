#!/usr/bin/env bash
# Download Copernicus DEM GLO-30 terrain tiles.
# Source: https://dataspace.copernicus.eu and AWS public (requester-pays for some paths)
# License: DLR/ESA — Attribution required
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

RAW="${DATA_ROOT}/raw/global/copernicus_dem"
mkdir -p "$RAW"

log_info "Checking Copernicus DEM GLO-30 availability …"

# OpenTopography provides a public HTTP interface to Copernicus DEM tiles.
# API reference: https://opentopography.org/meta/OT.032021.4326.1
# Direct tile download via OpenTopography does NOT require login for individual tiles.
# The AWS S3 bucket (s3://copernicus-dem-30m/) is requester-pays.

# Check if files were manually downloaded
if ls "${RAW}"/*.tif "${RAW}"/*.TIF "${RAW}"/*.tar 2>/dev/null | grep -q . 2>/dev/null; then
  log_ok "Copernicus DEM tiles found (manual or prior download)"
  write_source_meta "copernicus_dem" "available" "$RAW"
  exit 0
fi

log_info "Attempting Copernicus DEM download via OpenTopography API …"

# Define approximate tile bounds for solar regions
# Tile naming: Copernicus_DSM_COG_10_N{lat}_{lon}_00
# Each tile = 1°×1° at 30m resolution

declare -a TILES
if scope_includes "USA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  # Arizona, California, Nevada, New Mexico, Texas (partial)
  for lat in 31 32 33 34 35 36 37 38 39; do
    for lon in 108 109 110 111 112 113 114 115 116 117 118 119 120; do
      TILES+=("N${lat}_W${lon}")
    done
  done
fi

if scope_includes "INDIA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  # Rajasthan, Gujarat, MP, Maharashtra, Karnataka, AP, Telangana, TN
  for lat in 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
    for lon in 68 69 70 71 72 73 74 75 76 77 78 79 80 81 82 83 84; do
      TILES+=("N${lat}_E${lon}")
    done
  done
fi

log_info "Target: ${#TILES[@]} tiles — will attempt direct download …"
log_warn "Note: Copernicus DEM bulk download may be slow. Manual download recommended."
log_warn "  OpenTopography: https://portal.opentopography.org/raster?opentopoID=OT.032021.4326.1"
log_warn "  AWS (requester-pays): s3://copernicus-dem-30m/"
log_warn "  Copernicus Data Space: https://dataspace.copernicus.eu"

DOWNLOADED=0
FAILED=0
# Only download a small subset in quick mode; full region when DOWNLOAD_BIG_RASTERS=true
MAX_TILES=10
[[ "$DOWNLOAD_BIG_RASTERS" == "true" ]] && MAX_TILES=${#TILES[@]}

for tile_id in "${TILES[@]:0:$MAX_TILES}"; do
  # Attempt OpenTopography direct tile (HTTP, no key for small requests)
  # NOTE: OpenTopography rate-limits heavy use and requires API key for bulk.
  # Format: Copernicus_DSM_COG_10_N{LAT}_00_E{LON}_00_DEM.tif
  lat_part="${tile_id%%_*}"
  lon_part="${tile_id##*_}"
  lon_sign="${lon_part:0:1}"
  lon_num="${lon_part:1}"

  if [[ "$lon_sign" == "W" ]]; then
    TILE_FILE="Copernicus_DSM_COG_10_${lat_part}_00_W${lon_num}_00_DEM.tif"
  else
    TILE_FILE="Copernicus_DSM_COG_10_${lat_part}_00_E${lon_num}_00_DEM.tif"
  fi

  TILE_DEST="${RAW}/${TILE_FILE}"
  # Try Copernicus Data Space browser link
  TILE_URL="https://prism-dem-open.copernicus.eu/pd-desk-open-access/prismDownload/COP-DEM_GLO-30-DGED__2023_1/${TILE_FILE}"

  if download_if_missing "$TILE_URL" "$TILE_DEST" "CopDEM ${tile_id}" 2>/dev/null; then
    DOWNLOADED=$((DOWNLOADED+1))
  else
    FAILED=$((FAILED+1))
  fi
done

if [[ $DOWNLOADED -gt 0 ]]; then
  log_ok "Copernicus DEM: ${DOWNLOADED} tiles downloaded"
  write_source_meta "copernicus_dem" "partial_download" "$RAW" "${DOWNLOADED} tiles, ${FAILED} failed"
else
  create_manual_download_notice "$RAW" "Copernicus DEM GLO-30" \
    "Automated download failed. Manual options:

Option 1 — OpenTopography (recommended, requires free account):
  https://portal.opentopography.org/raster?opentopoID=OT.032021.4326.1
  Select your region → download GLO-30 COG GeoTIFF

Option 2 — Copernicus Data Space (requires account):
  https://dataspace.copernicus.eu
  Search for COP-DEM_GLO-30

Option 3 — AWS S3 (requester-pays):
  aws s3 sync s3://copernicus-dem-30m/ ${RAW}/ --request-payer requester

Place tiles in: ${RAW}/"
  write_source_meta "copernicus_dem" "manual_required" "$RAW"
fi
