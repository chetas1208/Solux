#!/usr/bin/env bash
# Solux Data Pipeline — full orchestrator.
# Runs all scripts 00–15 in sequence with error handling.
# Individual scripts are idempotent; re-running is safe.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

START_TIME=$(date +%s)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Solux Site Screening Dataset Pipeline  ║"
echo "║   Version 0.1.0                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
log_info "DATA_ROOT:      ${DATA_ROOT}"
log_info "COUNTRY_SCOPE:  ${COUNTRY_SCOPE}"
log_info "REGION_SUBSET:  ${RUN_REGION_SUBSET}"
log_info "H3 RES (land):  ${H3_RES_LAND}"
log_info "H3 RES (water): ${H3_RES_WATER}"
log_info "DO_UPLOAD:      ${DO_UPLOAD}"
echo ""

FAILED_STEPS=()
SKIPPED_STEPS=()

run_step() {
  local num="$1" name="$2"
  local script="${SCRIPT_DIR}/${num}_${name}.sh"
  echo ""
  echo "── Step ${num}: ${name} ──────────────────────────"
  if [[ ! -f "$script" ]]; then
    log_warn "Script not found: $script"
    SKIPPED_STEPS+=("${num}_${name}")
    return 0
  fi
  if bash "$script" 2>&1 | tee "${DATA_ROOT}/logs/${num}_${name}.log"; then
    log_ok "Step ${num} complete"
  else
    local exit_code=$?
    log_error "Step ${num} failed (exit $exit_code)"
    FAILED_STEPS+=("${num}_${name}")
    # Continue unless it's a hard dependency
    if [[ "$num" == "13" ]]; then
      log_error "Validation failed — aborting pipeline"
      return $exit_code
    fi
  fi
}

# Create log dir before any step
mkdir -p "${DATA_ROOT}/logs"

# Step 00: Tool check
run_step "00" "check_tools" || true

# Step 01: Init dirs
run_step "01" "init_dirs"

# Step 02: Boundaries (needed for candidate generation)
run_step "02" "download_boundaries" || true

# Step 03: Solar assets (benchmarks)
run_step "03" "download_solar_assets" || true

# Step 04: Solar resource APIs
run_step "04" "download_solar_resource" || true

# Step 05: Land cover
run_step "05" "download_landcover" || true

# Step 06: Terrain
run_step "06" "download_terrain" || true

# Step 07: Grid and roads
run_step "07" "download_grid_roads" || true

# Step 08: Water layers
run_step "08" "download_water_layers" || true

# Step 09: Weather/atmosphere
run_step "09" "download_weather_atmosphere" || true

# Step 10: Prepare and normalize all layers
run_step "10" "prepare_layers" || true

# Step 11: Generate candidate cells (requires boundaries)
run_step "11" "generate_candidates"

# Step 12: Score candidates
run_step "12" "score_candidates" || true

# Step 13: Validate (hard stop on failure)
run_step "13" "validate_dataset"

# Step 14: Package outputs
run_step "14" "package_dataset"

# Step 15: Upload to DO Spaces
run_step "15" "upload_to_do_spaces" || true

# ── Summary ────────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Pipeline Complete                       ║"
echo "╚══════════════════════════════════════════╝"
echo ""
log_info "Elapsed: ${MINUTES}m ${SECONDS}s"

if [[ ${#FAILED_STEPS[@]} -gt 0 ]]; then
  log_warn "Non-fatal failures in: ${FAILED_STEPS[*]}"
  log_warn "These are usually optional sources — check logs for details"
fi

if [[ ${#SKIPPED_STEPS[@]} -gt 0 ]]; then
  log_warn "Skipped (script not found): ${SKIPPED_STEPS[*]}"
fi

log_info "Logs: ${DATA_ROOT}/logs/"
log_info "Processed: ${DATA_ROOT}/processed/"
log_info "Manifests: ${DATA_ROOT}/manifests/"
log_info "Catalog: ${DATA_ROOT}/processed/solux_data_catalog.json"
echo ""
log_ok "Solux dataset pipeline finished."
