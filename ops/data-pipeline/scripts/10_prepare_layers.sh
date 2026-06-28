#!/usr/bin/env bash
# Normalize and process all raw layers into standardized outputs.
# Requires: ogr2ogr (GDAL), duckdb, tsx
# Output CRS: EPSG:4326 for vector/raster
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

PROC="${DATA_ROOT}/processed"
RAW="${DATA_ROOT}/raw"
STAGING="${DATA_ROOT}/staging"

log_info "Preparing data layers …"

# ── Boundaries ─────────────────────────────────────────────────────────────────
log_info "Processing boundaries …"
for file in "${RAW}/global/geoboundaries"/*.geojson; do
  [[ -f "$file" ]] || continue
  fname=$(basename "$file")
  dest="${PROC}/boundaries/${fname}"
  if [[ ! -f "$dest" || "$FORCE_DOWNLOAD" == "true" ]]; then
    ogr2ogr -f GeoJSON -t_srs EPSG:4326 "$dest" "$file" 2>/dev/null \
      && log_ok "Reprojected: $fname" \
      || cp "$file" "$dest"
  fi
done

# ── USA Solar Assets ───────────────────────────────────────────────────────────
if scope_includes "USA"; then
  log_info "Processing USA solar assets …"

  # USPVDB → GeoParquet + GeoJSON
  USPVDB_SRC=$(ls "${RAW}/usa/uspvdb/"*.gpkg "${RAW}/usa/uspvdb/"*.shp 2>/dev/null | head -1 || true)
  if [[ -n "$USPVDB_SRC" ]]; then
    log_info "Converting USPVDB: $USPVDB_SRC …"
    # Convert to GeoJSON
    ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
      "${STAGING}/uspvdb_raw.geojson" "$USPVDB_SRC" 2>/dev/null \
      && log_ok "USPVDB → staging/uspvdb_raw.geojson"

    # Normalize via DuckDB SQL
    duckdb <<SQL 2>/dev/null || log_warn "USPVDB DuckDB normalize failed"
INSTALL spatial; LOAD spatial;
INSTALL json; LOAD json;
CREATE TABLE uspvdb AS
  SELECT * FROM ST_Read('${STAGING}/uspvdb_raw.geojson');
$(cat "${PIPELINE_DIR}/sql/normalize_uspvdb.sql")
COPY uspvdb_normalized TO '${PROC}/solar_assets/usa_solar_assets.parquet' (FORMAT PARQUET);
SQL
    log_ok "USPVDB normalized → usa_solar_assets.parquet"
  else
    log_warn "USPVDB source file not found — manual download required"
  fi

  # EIA-860 → normalize
  EIA860_SRC=$(ls "${RAW}/usa/eia860/"*/*.xlsx "${RAW}/usa/eia860/"*/*.xls 2>/dev/null | head -1 || true)
  if [[ -n "$EIA860_SRC" ]]; then
    log_info "Processing EIA-860 …"
    run_tsx "io/parquet.ts" eia860-to-parquet \
      --input "$EIA860_SRC" \
      --output "${STAGING}/eia860_raw.parquet" 2>/dev/null \
      && log_ok "EIA-860 → staging" \
      || log_warn "EIA-860 processing failed"
  fi
fi

# ── Global Solar Asset Benchmark ───────────────────────────────────────────────
log_info "Building global solar asset benchmark …"

BENCHMARK_SOURCES=()
[[ -f "${PROC}/solar_assets/usa_solar_assets.parquet" ]] && BENCHMARK_SOURCES+=("${PROC}/solar_assets/usa_solar_assets.parquet")

# Kruitwagen inventory
KPV_SRC=$(ls "${RAW}/global/kruitwagen_pv_inventory/"*.geojson "${RAW}/global/kruitwagen_pv_inventory/"*.gpkg 2>/dev/null | head -1 || true)
if [[ -n "$KPV_SRC" ]]; then
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
    "${STAGING}/kruitwagen_raw.geojson" "$KPV_SRC" 2>/dev/null \
    && BENCHMARK_SOURCES+=("${STAGING}/kruitwagen_raw.geojson") \
    || log_warn "Kruitwagen conversion failed"
fi

# Global Renewables Watch
GRW_SRC=$(ls "${RAW}/global/global_renewables_watch/"*.parquet "${RAW}/global/global_renewables_watch/"*.geojson 2>/dev/null | head -1 || true)
[[ -n "$GRW_SRC" ]] && BENCHMARK_SOURCES+=("$GRW_SRC")

# India AI solar dataset
IND_SOLAR_SRC=$(ls "${RAW}/india/solar_locations_ai_dataset/"*.geojson "${RAW}/india/solar_locations_ai_dataset/"*.shp 2>/dev/null | head -1 || true)
if [[ -n "$IND_SOLAR_SRC" ]]; then
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
    "${STAGING}/india_solar_raw.geojson" "$IND_SOLAR_SRC" 2>/dev/null \
    && BENCHMARK_SOURCES+=("${STAGING}/india_solar_raw.geojson") \
    || log_warn "India solar dataset conversion failed"
fi

# WRI GPPD (solar only)
WRI_CSV=$(ls "${RAW}/global/wri_gppd/"*.csv 2>/dev/null | head -1 || true)
if [[ -n "$WRI_CSV" ]]; then
  run_tsx "io/parquet.ts" wri-gppd-to-parquet \
    --input "$WRI_CSV" \
    --output "${STAGING}/wri_gppd_solar.parquet" \
    --fuel-type SOLAR 2>/dev/null \
    && BENCHMARK_SOURCES+=("${STAGING}/wri_gppd_solar.parquet") \
    || log_warn "WRI GPPD processing failed"
fi

if [[ ${#BENCHMARK_SOURCES[@]} -gt 0 ]]; then
  log_ok "${#BENCHMARK_SOURCES[@]} benchmark sources available"
else
  log_warn "No solar asset benchmark sources available — some datasets require manual download"
fi

# ── Grid and Roads ─────────────────────────────────────────────────────────────
log_info "Processing grid and road data …"
mkdir -p "${PROC}/grid" "${PROC}/access"

# HIFLD → processed
HIFLD_SRC="${RAW}/usa/hifld_transmission/electric_power_transmission_lines.geojson"
if [[ -f "$HIFLD_SRC" ]]; then
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
    "${PROC}/grid/usa_transmission_lines.geojson" "$HIFLD_SRC" 2>/dev/null \
    && log_ok "HIFLD → usa_transmission_lines.geojson" \
    || cp "$HIFLD_SRC" "${PROC}/grid/usa_transmission_lines.geojson"
fi

# OSM power → per-country files
for osm_file in "${RAW}/global/osm/osm_power_"*.geojson; do
  [[ -f "$osm_file" ]] || continue
  fname=$(basename "$osm_file")
  if [[ "$fname" == *"india"* ]]; then
    dest="${PROC}/grid/india_osm_power_lines.geojson"
  else
    dest="${PROC}/grid/usa_osm_power_lines.geojson"
  fi
  [[ ! -f "$dest" ]] && cp "$osm_file" "$dest" && log_ok "OSM power → $dest"
done

for osm_file in "${RAW}/global/osm/osm_roads_"*.geojson; do
  [[ -f "$osm_file" ]] || continue
  fname=$(basename "$osm_file")
  if [[ "$fname" == *"india"* ]]; then
    dest="${PROC}/access/india_roads.geojson"
  else
    dest="${PROC}/access/usa_roads.geojson"
  fi
  [[ ! -f "$dest" ]] && cp "$osm_file" "$dest" && log_ok "OSM roads → $dest"
done

# ── Water Bodies ──────────────────────────────────────────────────────────────
log_info "Processing water layers …"
mkdir -p "${PROC}/water"

HL_SRC=$(ls "${RAW}/global/hydrolakes/"*.shp "${RAW}/global/hydrolakes/"*.gpkg 2>/dev/null | head -1 || true)
if [[ -n "$HL_SRC" ]]; then
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
    "${PROC}/water/global_lakes.geojson" "$HL_SRC" 2>/dev/null \
    && log_ok "HydroLAKES → processed" \
    || log_warn "HydroLAKES conversion failed"
fi

GRAND_SRC=$(ls "${RAW}/global/grand/"*.shp "${RAW}/global/grand/"*.gpkg 2>/dev/null | head -1 || true)
if [[ -n "$GRAND_SRC" ]]; then
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
    "${PROC}/water/global_reservoirs.geojson" "$GRAND_SRC" 2>/dev/null \
    && log_ok "GRanD → processed" \
    || log_warn "GRanD conversion failed"
fi

log_ok "Layer preparation complete."
log_info "Processed outputs in: ${PROC}"
