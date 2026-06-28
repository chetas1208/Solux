#!/usr/bin/env bash
# Download grid infrastructure and road data.
# Sources: HIFLD (USA transmission), OSM Overpass (global power + roads)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ── HIFLD USA Transmission Lines ──────────────────────────────────────────────
if scope_includes "USA"; then
  RAW_HIFLD="${DATA_ROOT}/raw/usa/hifld_transmission"
  mkdir -p "$RAW_HIFLD"
  log_info "Downloading HIFLD transmission lines …"

  HIFLD_DEST="${RAW_HIFLD}/electric_power_transmission_lines.geojson"

  # HIFLD via ArcGIS REST API (public, no key required)
  # Returns up to 1000 features per call; pagination needed for full USA
  HIFLD_BASE="https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0/query"
  HIFLD_PARAMS="where=1%3D1&outFields=*&f=geojson&resultRecordCount=1000"
  HIFLD_COUNT_URL="${HIFLD_BASE}?where=1%3D1&returnCountOnly=true&f=json"

  if [[ -f "$HIFLD_DEST" && "$FORCE_DOWNLOAD" != "true" ]]; then
    log_skip "HIFLD transmission lines already downloaded"
    write_source_meta "hifld_transmission" "available" "$RAW_HIFLD"
  else
    log_info "Fetching HIFLD feature count …"
    TOTAL_COUNT=$(curl -fSL --retry 2 --connect-timeout 30 \
      "${HIFLD_COUNT_URL}" 2>/dev/null | jq -r '.count // 0')

    log_info "HIFLD: ${TOTAL_COUNT} transmission line features"

    if [[ "$TOTAL_COUNT" -gt 0 ]]; then
      log_info "Downloading in pages of 1000 …"
      echo '{"type":"FeatureCollection","features":[' > "$HIFLD_DEST"
      FIRST_BATCH=true
      OFFSET=0

      while true; do
        PAGE_DEST="${RAW_HIFLD}/page_${OFFSET}.json"
        PAGE_URL="${HIFLD_BASE}?${HIFLD_PARAMS}&resultOffset=${OFFSET}"

        if ! curl -fSL --retry 3 --connect-timeout 30 \
             -o "$PAGE_DEST" "$PAGE_URL" 2>/dev/null; then
          log_warn "HIFLD page ${OFFSET} download failed"
          break
        fi

        FEATURE_COUNT=$(jq '.features | length' "$PAGE_DEST" 2>/dev/null || echo 0)
        if [[ "$FEATURE_COUNT" -eq 0 ]]; then break; fi

        if [[ "$FIRST_BATCH" == "true" ]]; then
          jq -c '.features[]' "$PAGE_DEST" >> "${HIFLD_DEST}.lines"
          FIRST_BATCH=false
        else
          echo "," >> "${HIFLD_DEST}.lines"
          jq -c '.features[]' "$PAGE_DEST" >> "${HIFLD_DEST}.lines"
        fi

        OFFSET=$((OFFSET + 1000))
        [[ $OFFSET -ge $TOTAL_COUNT ]] && break
        sleep 0.5  # polite rate limiting
      done

      # Reassemble
      cat "${HIFLD_DEST}.lines" >> "$HIFLD_DEST" 2>/dev/null || true
      echo ']}' >> "$HIFLD_DEST"
      rm -f "${HIFLD_DEST}.lines" "${RAW_HIFLD}"/page_*.json

      FEAT_CHECK=$(jq '.features | length' "$HIFLD_DEST" 2>/dev/null || echo 0)
      if [[ "$FEAT_CHECK" -gt 0 ]]; then
        record_checksum "$HIFLD_DEST" "HIFLD transmission lines"
        write_source_meta "hifld_transmission" "downloaded" "$RAW_HIFLD" "${FEAT_CHECK} features"
        log_ok "HIFLD transmission: ${FEAT_CHECK} features"
      else
        log_warn "HIFLD GeoJSON appears empty or malformed"
        write_source_meta "hifld_transmission" "download_malformed" "$RAW_HIFLD"
      fi
    else
      log_warn "HIFLD count query returned 0 or failed — pipeline continues"
      write_source_meta "hifld_transmission" "count_zero" "$RAW_HIFLD"
    fi
  fi
fi

# ── OSM Overpass: Power lines + substations ────────────────────────────────────
RAW_OSM="${DATA_ROOT}/raw/global/osm"
mkdir -p "$RAW_OSM"

log_info "Downloading OSM power infrastructure via Overpass …"
log_warn "Overpass queries are rate-limited. Large regions may time out."
log_warn "  For bulk India/USA OSM, consider: https://download.geofabrik.de/"

run_overpass_for_region() {
  local region_name="$1" bb="$2" fname_suffix="$3"
  local OUT="${RAW_OSM}/osm_power_${fname_suffix}.geojson"

  if [[ -f "$OUT" && "$FORCE_DOWNLOAD" != "true" ]]; then
    log_skip "OSM power ${region_name} already downloaded"
    return 0
  fi

  local QUERY="[out:json][timeout:120];(
    way[\"power\"~\"line|cable|minor_line\"](${bb});
    node[\"power\"=\"substation\"](${bb});
    node[\"power\"=\"sub_station\"](${bb});
    way[\"power\"=\"substation\"](${bb});
    relation[\"power\"=\"substation\"](${bb});
  );out body geom;"

  log_info "Overpass query: power lines + substations for ${region_name} …"
  if overpass_query "$QUERY" "${RAW_OSM}/osm_power_raw_${fname_suffix}.json" "OSM power ${region_name}"; then
    # Convert to GeoJSON via jq + ogr2ogr
    run_tsx "io/geojson.ts" osm-to-geojson \
      --input "${RAW_OSM}/osm_power_raw_${fname_suffix}.json" \
      --output "$OUT" \
      --tags "power,voltage,name,operator" 2>/dev/null \
    || {
      log_warn "tsx geojson conversion failed — keeping raw OSM JSON"
      cp "${RAW_OSM}/osm_power_raw_${fname_suffix}.json" "$OUT"
    }
    write_source_meta "osm_power_${fname_suffix}" "downloaded" "$RAW_OSM"
  else
    log_warn "Overpass power query failed for ${region_name}"
    write_source_meta "osm_power_${fname_suffix}" "download_failed" "$RAW_OSM"
  fi
}

run_overpass_for_region_roads() {
  local region_name="$1" bb="$2" fname_suffix="$3"
  local OUT="${RAW_OSM}/osm_roads_${fname_suffix}.geojson"

  if [[ -f "$OUT" && "$FORCE_DOWNLOAD" != "true" ]]; then
    log_skip "OSM roads ${region_name} already downloaded"
    return 0
  fi

  local QUERY="[out:json][timeout:120];(
    way[\"highway\"~\"motorway|trunk|primary|secondary|tertiary\"](${bb});
  );out body geom;"

  log_info "Overpass query: roads for ${region_name} …"
  if overpass_query "$QUERY" "${RAW_OSM}/osm_roads_raw_${fname_suffix}.json" "OSM roads ${region_name}"; then
    run_tsx "io/geojson.ts" osm-to-geojson \
      --input "${RAW_OSM}/osm_roads_raw_${fname_suffix}.json" \
      --output "$OUT" \
      --tags "highway,name,surface" 2>/dev/null \
    || cp "${RAW_OSM}/osm_roads_raw_${fname_suffix}.json" "$OUT"
    write_source_meta "osm_roads_${fname_suffix}" "downloaded" "$RAW_OSM"
  else
    log_warn "Overpass roads query failed for ${region_name}"
  fi
}

if scope_includes "USA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  # Arizona + Nevada bounding box (approximate)
  run_overpass_for_region "Arizona+Nevada" "31.33,-114.82,37.00,-109.04" "usa_az_nv" || true
  run_overpass_for_region_roads "Arizona+Nevada" "31.33,-114.82,37.00,-109.04" "usa_az_nv" || true
  # Texas
  run_overpass_for_region "Texas" "25.84,-106.65,36.50,-93.51" "usa_tx" || true
  run_overpass_for_region_roads "Texas" "25.84,-106.65,36.50,-93.51" "usa_tx" || true
elif scope_includes "USA"; then
  log_warn "Full USA OSM query would time out on Overpass. Use Geofabrik instead:"
  log_warn "  https://download.geofabrik.de/north-america/us.html"
  log_warn "  Download .pbf, extract with osmium/osmfilter, convert with ogr2ogr"
  write_source_meta "osm_power_usa_full" "manual_recommended" "$RAW_OSM" \
    "Use Geofabrik for full USA: https://download.geofabrik.de"
fi

if scope_includes "INDIA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  # Rajasthan + Gujarat
  run_overpass_for_region "Rajasthan+Gujarat" "20.17,68.14,30.18,77.83" "india_raj_guj" || true
  run_overpass_for_region_roads "Rajasthan+Gujarat" "20.17,68.14,30.18,77.83" "india_raj_guj" || true
elif scope_includes "INDIA"; then
  log_warn "Full India OSM query would time out. Use Geofabrik:"
  log_warn "  https://download.geofabrik.de/asia/india.html"
  write_source_meta "osm_power_india_full" "manual_recommended" "$RAW_OSM" \
    "Use Geofabrik for full India: https://download.geofabrik.de"
fi

log_ok "Grid and road download step complete."
