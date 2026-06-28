#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

require_spaces_env

DEST="${DATA_ROOT}/model_input/${DATASET_VERSION}"
mkdir -p "$DEST"

S3_BASE="s3://${DIGITALOCEAN_SPACES_BUCKET}/${SOLUX_DATASET_PREFIX}"
ENDPOINT="${DIGITALOCEAN_SPACES_ENDPOINT}"
AWS_ARGS=(--endpoint-url "$ENDPOINT" --no-progress)

download_sub() {
  local sub="$1"
  log_info "Downloading ${sub} …"
  aws s3 sync "${S3_BASE}/${sub}" "${DEST}/${sub}" "${AWS_ARGS[@]}"
}

download_sub "processed/candidates"
download_sub "processed/scoring"
download_sub "processed/solar_assets"
download_sub "processed/water"
download_sub "manifests"
download_sub "catalog"

[[ -f "${DEST}/manifests/dataset_manifest.json" || -f "${DEST}/manifests/upload_manifest.json" ]] || \
  die "Upload manifest missing after download"

CAND="${DEST}/processed/candidates/solux_candidate_sites.parquet"
[[ -f "$CAND" ]] || die "Candidate parquet missing: $CAND"

if command -v duckdb &>/dev/null; then
  COUNT=$(duckdb -csv -noheader -c "SELECT COUNT(*) FROM read_parquet('${CAND}')" 2>/dev/null || echo 0)
  [[ "${COUNT:-0}" -gt 0 ]] || die "Zero candidate cells in parquet"
  log_ok "Downloaded ${COUNT} candidate cells"
else
  log_warn "duckdb not installed — skipping candidate count check"
fi

log_ok "Model input ready: ${DEST}"
