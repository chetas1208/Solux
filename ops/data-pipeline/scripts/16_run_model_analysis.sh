#!/usr/bin/env bash
# Run Claude claude-opus-4-8 model analysis on Solux scored candidates.
# Reads: processed/scoring/solux_site_scores.parquet
# Outputs (local): ${DATA_ROOT}/analysis/{top_sites,region_insights,screening_report}.json
# Outputs (S3):    s3://${BUCKET}/${SOLUX_OUTPUT_PREFIX}/analysis/
# Requires: ANTHROPIC_API_KEY, DIGITALOCEAN_SPACES_* (for upload)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

SCORES="${DATA_ROOT}/processed/scoring/solux_site_scores.parquet"
[[ -f "$SCORES" ]] || die "Scored parquet not found: $SCORES — run 12_score_candidates.sh first"

[[ -z "${ANTHROPIC_API_KEY:-}" ]] && die "ANTHROPIC_API_KEY not set — add it to .env"

TOP_N="${TOP_N:-25}"
DRY_RUN_FLAG=""
[[ "${DRY_RUN:-false}" == "true" ]] && DRY_RUN_FLAG="--dry-run"

log_info "Running model analysis (top ${TOP_N} sites per region) …"

export DATA_ROOT DIGITALOCEAN_SPACES_BUCKET DIGITALOCEAN_SPACES_ENDPOINT \
       DIGITALOCEAN_SPACES_KEY DIGITALOCEAN_SPACES_SECRET \
       ANTHROPIC_API_KEY SOLUX_OUTPUT_PREFIX

run_tsx "analysis/runModelAnalysis.ts" $DRY_RUN_FLAG --top-n="${TOP_N}" \
  2>&1 | tee "${DATA_ROOT}/logs/16_run_model_analysis.log"

log_ok "Model analysis complete. Local outputs: ${DATA_ROOT}/analysis/"
