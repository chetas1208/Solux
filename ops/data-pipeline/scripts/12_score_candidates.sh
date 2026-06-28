#!/usr/bin/env bash
# Score all candidate sites across all dimensions.
# Sources: PVGIS API (free), NASA POWER API, NREL NSRDB (if key set),
#          local rasters (terrain, landcover), OSM/HIFLD (grid proximity)
# Output: processed/scoring/solux_site_scores.parquet
#          processed/scoring/solux_site_scores.geojson
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

PROC="${DATA_ROOT}/processed"
mkdir -p "${PROC}/scoring"

CANDIDATES="${PROC}/candidates/solux_candidate_sites.parquet"
if [[ ! -f "$CANDIDATES" ]]; then
  die "Candidate file missing: $CANDIDATES — run 11_generate_candidates.sh first"
fi

CAND_COUNT=$(duckdb -c "SELECT COUNT(*) FROM read_parquet('$CANDIDATES');" 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
log_info "Scoring ${CAND_COUNT} candidate sites …"

log_info "Running scoring pipeline …"
run_tsx "scoring/finalScore.ts" score-all \
  --candidates "$CANDIDATES" \
  --data-root "$DATA_ROOT" \
  --output "${PROC}/scoring/solux_site_scores.parquet" \
  --pvgis-url "$PVGIS_BASE_URL" \
  --nrel-key "${NREL_API_KEY:-}" \
  --grid-dir "${PROC}/grid" \
  --access-dir "${PROC}/access" \
  --water-dir "${PROC}/water" \
  --landcover-dir "${DATA_ROOT}/raw/global/esa_worldcover" \
  --terrain-dir "${DATA_ROOT}/raw/global/copernicus_dem" \
  --solar-assets-dir "${PROC}/solar_assets" 2>&1 | tee "${DATA_ROOT}/logs/12_score_candidates.log"

# GeoJSON export for small datasets / API
if [[ -f "${PROC}/scoring/solux_site_scores.parquet" ]]; then
  SCORE_COUNT=$(duckdb -c "SELECT COUNT(*) FROM read_parquet('${PROC}/scoring/solux_site_scores.parquet');" 2>/dev/null | tail -1 | tr -d ' ' || echo "0")
  log_ok "Scored ${SCORE_COUNT} sites"

  # Convert to GeoJSON (only if ≤50000 rows to avoid huge files)
  if [[ "$SCORE_COUNT" -le 50000 ]]; then
    run_tsx "io/geojson.ts" parquet-to-geojson \
      --input "${PROC}/scoring/solux_site_scores.parquet" \
      --output "${PROC}/scoring/solux_site_scores.geojson" \
      --lat-col centroid_lat --lon-col centroid_lon 2>/dev/null \
      && log_ok "Exported solux_site_scores.geojson"
  else
    log_info "Score count ${SCORE_COUNT} > 50000 — skipping GeoJSON export (use parquet)"
  fi

  # Decision summary
  duckdb << SQL 2>/dev/null || true
SELECT decision, COUNT(*) as count, ROUND(AVG(final_score),1) as avg_score
FROM read_parquet('${PROC}/scoring/solux_site_scores.parquet')
GROUP BY decision ORDER BY count DESC;
SQL

  # Candidate summary DuckDB
  duckdb <<SQL > "${PROC}/candidates/solux_candidate_sites.geojson" 2>/dev/null || log_warn "Candidate summary SQL failed"
$(cat "${PIPELINE_DIR}/sql/generate_candidate_summary.sql")
SQL

fi

log_ok "Scoring complete."
log_info "Outputs: ${PROC}/scoring/"
