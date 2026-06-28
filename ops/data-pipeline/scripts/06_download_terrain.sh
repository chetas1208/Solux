#!/usr/bin/env bash
# Download Copernicus DEM GLO-90 terrain tiles via public AWS S3.
# GLO-90 = 3 arc-second (~90m) resolution. Public bucket, no requester-pays.
# License: DLR/ESA — Attribution required
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

RAW="${DATA_ROOT}/raw/global/copernicus_dem"
mkdir -p "$RAW"

# Check if files were manually downloaded
if ls "${RAW}"/*.tif 2>/dev/null | grep -q . 2>/dev/null; then
  log_ok "Copernicus DEM tiles found (prior download)"
  write_source_meta "copernicus_dem" "available" "$RAW"
  exit 0
fi

log_info "Downloading Copernicus DEM GLO-90 via public S3 (s3://copernicus-dem-90m) …"

# GLO-90 tile naming: Copernicus_DSM_COG_30_{LAT_DIR}{LAT_2D}_00_{LON_DIR}{LON_3D}_00_DEM/
# File inside: Copernicus_DSM_COG_30_{LAT_DIR}{LAT_2D}_00_{LON_DIR}{LON_3D}_00_DEM.tif
# Tile size: 1°×1°, ~490KB each

download_glo90_tile() {
  local lat="$1" lon_sign="$2" lon="$3"
  local lat_pad lon_pad prefix tile_file dest s3_path

  printf -v lat_pad "%02d" "$lat"
  printf -v lon_pad "%03d" "$lon"

  prefix="Copernicus_DSM_COG_30_N${lat_pad}_00_${lon_sign}${lon_pad}_00_DEM"
  tile_file="${prefix}.tif"
  dest="${RAW}/${tile_file}"
  s3_path="s3://copernicus-dem-90m/${prefix}/${tile_file}"

  if [[ -f "$dest" ]]; then
    return 0
  fi
  if aws s3 cp "$s3_path" "$dest" --no-sign-request --quiet 2>/dev/null; then
    log_ok "  GLO-90 N${lat_pad} ${lon_sign}${lon_pad}"
    return 0
  else
    log_warn "  Missing tile: N${lat_pad} ${lon_sign}${lon_pad} (ocean/no data)"
    return 0
  fi
}

# Download tiles for configured regions
if scope_includes "USA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  log_info "USA solar region: lat 24-42N, lon 93-125W …"
  for lat in 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41; do
    for lon in 93 94 95 96 97 98 99 100 101 102 103 104 105 106 107 108 109 110 111 112 113 114 115 116 117 118 119 120 121 122 123 124; do
      download_glo90_tile "$lat" "W" "$lon"
    done
  done
elif scope_includes "USA"; then
  log_info "USA full region: lat 18-50N, lon 65-125W …"
  for lat in $(seq 18 50); do
    for lon in $(seq 65 125); do
      download_glo90_tile "$lat" "W" "$lon"
    done
  done
fi

if scope_includes "INDIA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  log_info "India solar region: lat 8-37N, lon 65-97E …"
  for lat in 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36; do
    for lon in 65 66 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 82 83 84 85 86 87 88 89 90 91 92 93 94 95 96; do
      download_glo90_tile "$lat" "E" "$lon"
    done
  done
elif scope_includes "INDIA"; then
  log_info "India full region: lat 6-37N, lon 65-100E …"
  for lat in $(seq 6 37); do
    for lon in $(seq 65 100); do
      download_glo90_tile "$lat" "E" "$lon"
    done
  done
fi

N_TILES=$(ls "${RAW}"/*.tif 2>/dev/null | wc -l | tr -d ' ')
if [[ "$N_TILES" -gt 0 ]]; then
  log_ok "Copernicus DEM GLO-90: ${N_TILES} tiles downloaded"
  write_source_meta "copernicus_dem" "downloaded" "$RAW" "${N_TILES} tiles (GLO-90, 90m)"
else
  log_warn "No Copernicus DEM tiles downloaded"
  write_source_meta "copernicus_dem" "download_failed" "$RAW"
fi
