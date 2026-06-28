#!/usr/bin/env bash
# Download country and state administrative boundaries from geoBoundaries API.
# Source: https://www.geoboundaries.org/
# License: CC BY 4.0 / ODbL
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

RAW="${DATA_ROOT}/raw/global/geoboundaries"
mkdir -p "$RAW"

log_info "Fetching geoBoundaries administrative boundaries …"

download_geoboundaries() {
  local iso3="$1" level="$2" label="$3"
  local dest="${RAW}/${iso3}_${level}.geojson"
  if [[ -f "$dest" && "$FORCE_DOWNLOAD" != "true" ]]; then
    log_skip "$label ($iso3 $level) already present"
    return 0
  fi

  log_info "Fetching geoBoundaries metadata: $iso3 $level …"
  local meta_url="https://www.geoboundaries.org/api/current/gbOpen/${iso3}/${level}/"
  local meta_file="${RAW}/${iso3}_${level}_meta.json"

  if ! curl -fSL --retry 3 --connect-timeout 30 \
       -H "Accept: application/json" \
       -o "$meta_file" "$meta_url" 2>/tmp/curl_err.txt; then
    log_warn "geoBoundaries API failed for $iso3 $level: $(cat /tmp/curl_err.txt | head -1)"
    write_source_meta "geoboundaries_${iso3,,}_${level,,}" "download_failed" "$RAW" "API error"
    return 1
  fi

  local dl_url; dl_url=$(jq -r '.gjDownloadURL // .simplifiedGeometryGeoJSON // empty' "$meta_file")
  if [[ -z "$dl_url" || "$dl_url" == "null" ]]; then
    log_warn "No download URL in geoBoundaries response for $iso3 $level"
    write_source_meta "geoboundaries_${iso3,,}_${level,,}" "no_url" "$RAW"
    return 1
  fi

  log_info "Downloading $label GeoJSON …"
  if curl -fSL --retry 3 --connect-timeout 30 -o "$dest" "$dl_url" 2>/tmp/curl_err.txt; then
    record_checksum "$dest" "$label"
    write_source_meta "geoboundaries_${iso3,,}_${level,,}" "downloaded" "$RAW"
    log_ok "Saved $dest"
  else
    log_warn "GeoJSON download failed for $label"
    write_source_meta "geoboundaries_${iso3,,}_${level,,}" "download_failed" "$RAW"
    return 1
  fi
}

scope_includes "USA" && {
  download_geoboundaries "USA" "ADM0" "USA country boundary" || true
  download_geoboundaries "USA" "ADM1" "USA states" || true
}

scope_includes "INDIA" && {
  download_geoboundaries "IND" "ADM0" "India country boundary" || true
  download_geoboundaries "IND" "ADM1" "India states" || true
}

# Process to processed/boundaries/ if source files exist
mkdir -p "${DATA_ROOT}/processed/boundaries"

process_boundary() {
  local src="$1" dest="$2" label="$3"
  [[ -f "$src" ]] || { log_skip "$label source missing, skip processing"; return 0; }
  if ogr2ogr -f GeoJSON -t_srs EPSG:4326 "$dest" "$src" 2>/dev/null; then
    log_ok "Processed $label → $dest"
  else
    cp "$src" "$dest"
    log_ok "Copied $label → $dest (no reprojection needed)"
  fi
}

process_boundary \
  "${RAW}/USA_ADM1.geojson" \
  "${DATA_ROOT}/processed/boundaries/usa_states.geojson" \
  "USA states"

process_boundary \
  "${RAW}/IND_ADM1.geojson" \
  "${DATA_ROOT}/processed/boundaries/india_states.geojson" \
  "India states"

log_ok "Boundary download complete."
