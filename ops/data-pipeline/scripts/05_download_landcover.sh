#!/usr/bin/env bash
# Download ESA WorldCover 2021 10m land cover tiles.
# Source: https://esa-worldcover.org/en
# License: CC BY 4.0
# Files hosted on AWS S3: s3://esa-worldcover (public read)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

RAW="${DATA_ROOT}/raw/global/esa_worldcover"
mkdir -p "$RAW"

if [[ "$DOWNLOAD_WORLD_COVER" != "true" ]]; then
  log_skip "DOWNLOAD_WORLD_COVER=false — skipping ESA WorldCover download"
  # Check if files were manually placed
  if ls "${RAW}"/*.tif "${RAW}"/*.TIF 2>/dev/null | grep -q . 2>/dev/null; then
    log_ok "ESA WorldCover tiles found (manual placement)"
    write_source_meta "esa_worldcover" "available_manual" "$RAW"
  else
    write_source_meta "esa_worldcover" "skipped" "$RAW" "Set DOWNLOAD_WORLD_COVER=true"
  fi
  exit 0
fi

log_info "Downloading ESA WorldCover 2021 v200 tiles …"
log_info "Tile index from: https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/esa_worldcover_2021_grid.geojson"

# Download the tile grid to select relevant tiles
TILE_INDEX="${RAW}/esa_worldcover_grid.geojson"
download_if_missing \
  "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/esa_worldcover_2021_grid.geojson" \
  "$TILE_INDEX" "ESA WorldCover tile index" || {
    log_warn "Could not download ESA WorldCover tile index"
    write_source_meta "esa_worldcover" "tile_index_failed" "$RAW"
    exit 0
  }

log_info "Selecting tiles for configured countries/regions …"

# Use tsx to select which tiles overlap the region of interest
run_tsx "io/raster.ts" select-worldcover-tiles \
  --tile-index "$TILE_INDEX" \
  --countries "$COUNTRY_SCOPE" \
  --region-subset "$RUN_REGION_SUBSET" \
  --output "${RAW}/selected_tiles.txt" 2>/tmp/tsx_err.txt \
  || {
    log_warn "Tile selection via tsx failed: $(cat /tmp/tsx_err.txt | head -3)"
    log_warn "Falling back to all tiles for region bounding box"
    # Fallback: define approximate tile grid IDs for USA/India solar regions
    {
      scope_includes "USA" && cat << 'TILES'
N30W120
N30W110
N30W100
N30W090
N35W120
N35W110
N35W100
N35W090
TILES
      scope_includes "INDIA" && cat << 'TILES'
N20E070
N20E080
N25E070
N25E080
N30E070
N30E080
TILES
    } > "${RAW}/selected_tiles.txt"
  }

TILE_COUNT=$(wc -l < "${RAW}/selected_tiles.txt" | tr -d ' ')
log_info "Downloading ${TILE_COUNT} ESA WorldCover tiles …"

while IFS= read -r tile_id; do
  [[ -z "$tile_id" ]] && continue
  TILE_FILE="ESA_WorldCover_10m_2021_v200_${tile_id}_Map.tif"
  TILE_URL="https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/${TILE_FILE}"
  TILE_DEST="${RAW}/${TILE_FILE}"

  download_if_missing "$TILE_URL" "$TILE_DEST" "WorldCover tile ${tile_id}" || {
    log_warn "Could not download tile ${tile_id} — trying alternate URL pattern"
    # Some tiles have lowercase naming
    TILE_FILE_ALT="esa_worldcover_10m_2021_v200_${tile_id,,}_map.tif"
    TILE_URL_ALT="https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/${TILE_FILE_ALT}"
    download_if_missing "$TILE_URL_ALT" "${RAW}/${TILE_FILE_ALT}" "WorldCover tile ${tile_id} (alt)" || true
  }
done < "${RAW}/selected_tiles.txt"

# Count successfully downloaded tiles
N_TILES=$(ls "${RAW}"/*.tif "${RAW}"/*.TIF 2>/dev/null | grep -v "MANUAL_DOWNLOAD" | wc -l | tr -d ' ')
if [[ "$N_TILES" -gt 0 ]]; then
  log_ok "ESA WorldCover: ${N_TILES} tiles downloaded"
  write_source_meta "esa_worldcover" "downloaded" "$RAW" "${N_TILES} tiles"
else
  log_warn "No ESA WorldCover tiles downloaded — check URL format"
  log_warn "You may need to download manually from: https://esa-worldcover.org/en/data-access"
  write_source_meta "esa_worldcover" "download_failed" "$RAW" "Check tile URL format"
fi
