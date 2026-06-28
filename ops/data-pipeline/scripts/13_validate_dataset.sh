#!/usr/bin/env bash
# QA validation for the Solux candidate dataset.
# Fails (exit 1) if any hard requirement is violated.
# Produces: manifests/quality_report.json
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

PROC="${DATA_ROOT}/processed"
MANIFESTS="${DATA_ROOT}/manifests"
mkdir -p "$MANIFESTS"

ERRORS=()
WARNINGS=()

check_file_exists() {
  local path="$1" label="$2" optional="${3:-false}"
  if [[ -f "$path" ]]; then
    local size; size=$(du -h "$path" | cut -f1)
    log_ok "$label: $size"
    return 0
  else
    if [[ "$optional" == "true" ]]; then
      WARNINGS+=("Missing optional file: $label ($path)")
      log_warn "OPTIONAL MISSING: $label"
    else
      ERRORS+=("Missing required file: $label ($path)")
      log_error "REQUIRED MISSING: $label"
    fi
    return 1
  fi
}

check_parquet_rows() {
  local path="$1" label="$2" min_rows="${3:-1}" optional="${4:-false}"
  if [[ ! -f "$path" ]]; then return 0; fi
  local count
  count=$(node -e "
const duckdb = require('${PIPELINE_DIR}/node_modules/duckdb');
const db = new duckdb.Database(':memory:');
db.all(\"SELECT COUNT(*) as c FROM read_parquet('${path}')\", (e,r) => {
  process.stdout.write(e ? '0' : String(Number(r[0].c)));
});
" 2>/dev/null || echo "0")
  if [[ "$count" -ge "$min_rows" ]]; then
    log_ok "$label: ${count} rows"
  else
    if [[ "$optional" == "true" ]]; then
      WARNINGS+=("$label has ${count} rows (min ${min_rows})")
      log_warn "$label: only ${count} rows"
    else
      ERRORS+=("$label has ${count} rows (min ${min_rows})")
      log_error "$label: ${count} rows — need ≥ ${min_rows}"
    fi
  fi
}

_ddb_count() {
  # _ddb_count <parquet_file> <sql_condition>
  local path="$1" cond="$2"
  node -e "
const duckdb = require('${PIPELINE_DIR}/node_modules/duckdb');
const db = new duckdb.Database(':memory:');
db.all(\"SELECT COUNT(*) as c FROM read_parquet('${path}') WHERE ${cond}\", (e,r) => {
  process.stdout.write(e ? '0' : String(Number(r[0].c)));
});
" 2>/dev/null || echo "0"
}

check_score_validity() {
  local path="$1"
  [[ -f "$path" ]] || return 0
  local bad_scores
  bad_scores=$(_ddb_count "$path" "final_score < 0 OR final_score > 100 OR power_output_score < 0 OR power_output_score > 100 OR grid_connectivity_score < 0 OR grid_connectivity_score > 100")
  if [[ "$bad_scores" -eq 0 ]]; then
    log_ok "All scores in range [0, 100]"
  else
    ERRORS+=("${bad_scores} sites have scores outside [0, 100] range")
    log_error "Score range violation: ${bad_scores} invalid rows"
  fi

  local bad_decisions
  bad_decisions=$(_ddb_count "$path" "decision NOT IN ('GO','INVESTIGATE','KILL')")
  if [[ "$bad_decisions" -eq 0 ]]; then
    log_ok "All decisions are GO / INVESTIGATE / KILL"
  else
    ERRORS+=("${bad_decisions} sites have invalid decision values")
    log_error "Decision validation: ${bad_decisions} invalid"
  fi
}

check_geometry_null() {
  local path="$1" label="$2"
  [[ -f "$path" ]] || return 0
  local null_geo
  null_geo=$(_ddb_count "$path" "centroid_lat IS NULL OR centroid_lon IS NULL OR centroid_lat < -90 OR centroid_lat > 90 OR centroid_lon < -180 OR centroid_lon > 180")
  if [[ "$null_geo" -eq 0 ]]; then
    log_ok "$label: all geometry valid"
  else
    ERRORS+=("$label: ${null_geo} rows with null/invalid geometry")
    log_error "$label: ${null_geo} invalid geometries"
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Solux Dataset Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── Required files ────────────────────────"
check_file_exists "${PROC}/candidates/solux_candidate_sites.parquet" "solux_candidate_sites.parquet"
check_file_exists "${MANIFESTS}/dataset_manifest.json" "dataset_manifest.json" true
check_file_exists "${MANIFESTS}/source_manifest.json" "source_manifest.json" true

echo ""
echo "── Boundaries ────────────────────────────"
scope_includes "USA"   && { check_file_exists "${PROC}/boundaries/usa_states.geojson" "USA states" true || true; }
scope_includes "INDIA" && { check_file_exists "${PROC}/boundaries/india_states.geojson" "India states" true || true; }

echo ""
echo "── Candidate counts ──────────────────────"
check_parquet_rows "${PROC}/candidates/solux_candidate_sites.parquet" "All candidates" 1
check_parquet_rows "${PROC}/candidates/usa_candidate_cells.parquet" "USA candidates" 0 true
check_parquet_rows "${PROC}/candidates/india_candidate_cells.parquet" "India candidates" 0 true

echo ""
echo "── Scored sites ──────────────────────────"
check_parquet_rows "${PROC}/scoring/solux_site_scores.parquet" "Scored sites" 0 true

echo ""
echo "── Score range validation ────────────────"
check_score_validity "${PROC}/scoring/solux_site_scores.parquet"

echo ""
echo "── Geometry validation ───────────────────"
check_geometry_null "${PROC}/candidates/solux_candidate_sites.parquet" "candidates"
check_geometry_null "${PROC}/scoring/solux_site_scores.parquet" "scored sites"

echo ""
echo "── Optional layers ───────────────────────"
check_file_exists "${PROC}/solar_assets/usa_solar_assets.parquet" "USA solar assets" true || true
check_file_exists "${PROC}/grid/usa_transmission_lines.geojson" "USA transmission lines" true || true
check_file_exists "${PROC}/water/global_lakes.geojson" "Global lakes" true || true

echo ""
echo "── Data coverage stats ───────────────────"
if [[ -f "${PROC}/candidates/solux_candidate_sites.parquet" ]]; then
  node -e "
const duckdb = require('${PIPELINE_DIR}/node_modules/duckdb');
const db = new duckdb.Database(':memory:');
db.all(\"SELECT country, site_surface_type, COUNT(*) as candidates FROM read_parquet('${PROC}/candidates/solux_candidate_sites.parquet') GROUP BY country, site_surface_type ORDER BY country, candidates DESC\", (e,r) => {
  if (!e) console.table(r.map(x => ({country:x.country, surface:x.site_surface_type, candidates:Number(x.candidates)})));
});
" 2>/dev/null || true
fi

if [[ -f "${PROC}/scoring/solux_site_scores.parquet" ]]; then
  node -e "
const duckdb = require('${PIPELINE_DIR}/node_modules/duckdb');
const db = new duckdb.Database(':memory:');
db.all(\"SELECT decision, COUNT(*)::INTEGER as count, ROUND(AVG(final_score::DOUBLE),1) as avg_score, ROUND(AVG(confidence_score::DOUBLE),1) as avg_confidence FROM read_parquet('${PROC}/scoring/solux_site_scores.parquet') GROUP BY decision ORDER BY count DESC\", (e,r) => {
  if (!e) console.table(r);
});
" 2>/dev/null || true
fi

# ── Generate quality report ─────────────────────────────────────────────────────
QA_STATUS="$([ ${#ERRORS[@]} -eq 0 ] && echo 'pass' || echo 'fail')"
cat > "${MANIFESTS}/quality_report.json" << JSON
{
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "${QA_STATUS}",
  "errorCount": ${#ERRORS[@]},
  "warningCount": ${#WARNINGS[@]},
  "errors": $(printf '%s\n' "${ERRORS[@]:-none}" | grep -v '^none$' | jq -R . | jq -s . 2>/dev/null || echo '[]'),
  "warnings": $(printf '%s\n' "${WARNINGS[@]:-none}" | grep -v '^none$' | jq -R . | jq -s . 2>/dev/null || echo '[]')
}
JSON

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  log_error "Validation FAILED: ${#ERRORS[@]} error(s)"
  for e in "${ERRORS[@]}"; do log_error "  ✗ $e"; done
  if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    log_warn "${#WARNINGS[@]} warning(s):"
    for w in "${WARNINGS[@]}"; do log_warn "  ⚠ $w"; done
  fi
  log_info "Quality report: ${MANIFESTS}/quality_report.json"
  exit 1
else
  log_ok "Validation PASSED"
  if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    log_warn "${#WARNINGS[@]} warning(s) — review quality_report.json"
    for w in "${WARNINGS[@]}"; do log_warn "  ⚠ $w"; done
  fi
  log_info "Quality report: ${MANIFESTS}/quality_report.json"
fi
