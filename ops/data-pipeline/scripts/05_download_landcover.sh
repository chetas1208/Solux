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
log_info "Tile index from: https://esa-worldcover.s3.eu-central-1.amazonaws.com/esa_worldcover_grid.geojson"

# Download the tile grid to select relevant tiles (grid lives at bucket root, not v200/2021)
TILE_INDEX="${RAW}/esa_worldcover_grid.geojson"
download_if_missing \
  "https://esa-worldcover.s3.eu-central-1.amazonaws.com/esa_worldcover_grid.geojson" \
  "$TILE_INDEX" "ESA WorldCover tile index" || {
    log_warn "Could not download ESA WorldCover tile index"
    write_source_meta "esa_worldcover" "tile_index_failed" "$RAW"
    exit 0
  }

log_info "Selecting tiles for configured countries/regions …"

# Tile grid uses 3-degree cells. Extract tiles from the downloaded geojson using bbox filters.
# USA solar region: lat 24-42, lon -125 to -93 (AZ, CA, NV, TX, NM, NM)
# India solar region: lat 8-37, lon 65-97

{
  if scope_includes "USA"; then
    # Filter tiles in USA solar bbox (ll_tile = lower-left corner, so N=lat, W/E=lon)
    jq -r '.features[] | .properties.ll_tile |
      select(
        test("^N(2[4-9]|3[0-9]|4[0-2])W(9[3-9]|1[01][0-9]|12[0-5])$")
      )' "$TILE_INDEX" 2>/dev/null || true
  fi
  if scope_includes "INDIA"; then
    # Tiles are zero-padded 2-digit lat, 3-digit lon: N09E075, N00E072, etc.
    # India solar bbox: lat 0-37, lon 065-097
    jq -r '.features[] | .properties.ll_tile |
      select(
        test("^N(0[0-9]|[12][0-9]|3[0-7])E0(6[5-9]|[7-8][0-9]|9[0-7])$")
      )' "$TILE_INDEX" 2>/dev/null || true
  fi
} | sort -u > "${RAW}/selected_tiles.txt"

TILE_COUNT=$(grep -c . "${RAW}/selected_tiles.txt" 2>/dev/null || echo 0)
log_info "Selected ${TILE_COUNT} ESA WorldCover tiles for download …"

while IFS= read -r tile_id; do
  [[ -z "$tile_id" ]] && continue
  TILE_FILE="ESA_WorldCover_10m_2021_v200_${tile_id}_Map.tif"
  TILE_DEST="${RAW}/${TILE_FILE}"
  S3_PATH="s3://esa-worldcover/v200/2021/map/${TILE_FILE}"

  if [[ -f "$TILE_DEST" ]]; then
    log_skip "WorldCover tile ${tile_id} already downloaded"
    continue
  fi
  log_info "Downloading WorldCover tile ${tile_id} …"
  if aws s3 cp "$S3_PATH" "$TILE_DEST" --no-sign-request --quiet 2>/dev/null; then
    log_ok "Saved ${TILE_DEST}"
  else
    log_warn "Could not download tile ${tile_id} — skipping"
  fi
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
