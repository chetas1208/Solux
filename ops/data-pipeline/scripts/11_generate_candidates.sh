#!/usr/bin/env bash
# Generate candidate site cells using H3 hexagonal grid.
# Requires: tsx, h3-js (npm), duckdb
# Output: processed/candidates/usa_candidate_cells.parquet
#          processed/candidates/india_candidate_cells.parquet
#          processed/candidates/solux_candidate_sites.parquet
#          processed/candidates/solux_candidate_sites.geojson
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

PROC="${DATA_ROOT}/processed"
mkdir -p "${PROC}/candidates"

log_info "Generating candidate site cells …"
log_info "  H3 resolution (land): ${H3_RES_LAND}"
log_info "  H3 resolution (water): ${H3_RES_WATER}"
log_info "  Region subset: ${RUN_REGION_SUBSET}"

# ── Land candidates ────────────────────────────────────────────────────────────
log_info "Running candidate generator …"
run_tsx "scoring/candidateSchema.ts" generate-candidates \
  --country-scope "$COUNTRY_SCOPE" \
  --region-subset "$RUN_REGION_SUBSET" \
  --h3-res-land "$H3_RES_LAND" \
  --h3-res-water "$H3_RES_WATER" \
  --data-root "$DATA_ROOT" \
  --output-dir "${PROC}/candidates" \
  --boundaries-dir "${PROC}/boundaries" \
  --water-dir "${PROC}/water" \
  --landcover-dir "${DATA_ROOT}/raw/global/esa_worldcover" \
  --terrain-dir "${DATA_ROOT}/raw/global/copernicus_dem" 2>&1 | tee "${DATA_ROOT}/logs/11_generate_candidates.log"

# Verify outputs
for expected in \
  "${PROC}/candidates/solux_candidate_sites.parquet" \
  "${PROC}/candidates/solux_candidate_sites.geojson"; do
  if [[ -f "$expected" ]]; then
    ROW_COUNT=$(duckdb -c "SELECT COUNT(*) FROM read_parquet('${PROC}/candidates/solux_candidate_sites.parquet');" 2>/dev/null | tail -1 | tr -d ' ' || echo "?")
    log_ok "$expected — ${ROW_COUNT} candidates"
  else
    log_warn "$expected not generated"
  fi
done

# Country-level parquet splits
if [[ -f "${PROC}/candidates/solux_candidate_sites.parquet" ]]; then
  duckdb << SQL 2>/dev/null || log_warn "Country split failed"
COPY (SELECT * FROM read_parquet('${PROC}/candidates/solux_candidate_sites.parquet') WHERE country = 'USA')
  TO '${PROC}/candidates/usa_candidate_cells.parquet' (FORMAT PARQUET);
COPY (SELECT * FROM read_parquet('${PROC}/candidates/solux_candidate_sites.parquet') WHERE country = 'INDIA')
  TO '${PROC}/candidates/india_candidate_cells.parquet' (FORMAT PARQUET);
SQL
  log_ok "Country-level splits written"
fi

log_ok "Candidate generation complete."
