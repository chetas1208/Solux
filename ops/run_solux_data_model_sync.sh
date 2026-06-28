#!/usr/bin/env bash
# End-to-end: validate → clean → upload → verify → download → model analysis → push
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_ROOT}/ops/spaces/lib/common.sh"

log_info "=== Solux data + model sync ==="

[[ -n "${DIGITALOCEAN_SPACES_ENDPOINT:-}" ]] || die "DIGITALOCEAN_SPACES_ENDPOINT required"
[[ -n "${DATA_ROOT:-}" ]] || export DATA_ROOT="/data/solux"

bash "${REPO_ROOT}/ops/data-pipeline/scripts/13_validate_dataset.sh"

if [[ "${CLEAN_CONFIRM:-}" == "DELETE_SOLUX_PREFIXES" ]]; then
  bash "${REPO_ROOT}/ops/spaces/clean-solux-prefixes.sh"
else
  log_warn "Skipping cleanup — set CLEAN_CONFIRM=DELETE_SOLUX_PREFIXES to clean prefixes"
fi

if [[ "${DO_UPLOAD:-true}" == "true" ]]; then
  bash "${REPO_ROOT}/ops/spaces/upload-solux-data.sh"
  bash "${REPO_ROOT}/ops/spaces/verify-spaces-upload.sh"
fi

bash "${REPO_ROOT}/ops/spaces/download-solux-data.sh"

cd "${REPO_ROOT}/ops/model-analysis"
pnpm exec tsx modelEndpointClient.ts || log_warn "Model endpoint probe failed — continuing with deterministic baseline"

if [[ "${RUN_MODEL_ANALYSIS:-true}" == "true" ]]; then
  pnpm exec tsx run-model-analysis.ts
  pnpm exec tsx validateModelOutputs.ts
fi

if [[ "${PUSH_MODEL_OUTPUTS:-true}" == "true" ]]; then
  pnpm exec tsx push-model-outputs.ts
fi

pnpm exec tsx learningLoop.ts --status-only || true

REPORT="${DATA_ROOT}/manifests/final_sync_report.json"
cat > "$REPORT" << EOF
{
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "datasetPrefix": "${SOLUX_DATASET_PREFIX}",
  "outputPrefix": "${SOLUX_OUTPUT_PREFIX}",
  "runPrefix": "${SOLUX_RUN_PREFIX}",
  "bucket": "${DIGITALOCEAN_SPACES_BUCKET}"
}
EOF

log_ok "Sync complete. Report: ${REPORT}"
log_info "Dataset:  s3://${DIGITALOCEAN_SPACES_BUCKET}/${SOLUX_DATASET_PREFIX}/"
log_info "Outputs:  s3://${DIGITALOCEAN_SPACES_BUCKET}/${SOLUX_OUTPUT_PREFIX}/model_outputs/"
