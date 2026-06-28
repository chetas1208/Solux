#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

require_spaces_env

[[ "${DO_UPLOAD:-true}" == "true" ]] || { log_info "DO_UPLOAD=false — skipping"; exit 0; }

PIPELINE="${REPO_ROOT}/ops/data-pipeline/scripts"
log_info "Validating local dataset …"
bash "${PIPELINE}/13_validate_dataset.sh"

QA="${DATA_ROOT}/manifests/quality_report.json"
QA_STATUS=$(jq -r '.status // "unknown"' "$QA" 2>/dev/null || echo unknown)
[[ "$QA_STATUS" == "pass" ]] || die "Validation status=${QA_STATUS} — upload refused"

log_info "Packaging dataset …"
bash "${PIPELINE}/14_package_dataset.sh"

S3_BASE="s3://${DIGITALOCEAN_SPACES_BUCKET}/${SOLUX_DATASET_PREFIX}"
ENDPOINT="${DIGITALOCEAN_SPACES_ENDPOINT}"
AWS_ARGS=(--endpoint-url "$ENDPOINT" --no-progress)

sync_dir() {
  local local_dir="$1" remote_sub="$2"
  [[ -d "$local_dir" ]] || { log_warn "Missing $local_dir — skip"; return 0; }
  log_info "Sync ${local_dir} → ${S3_BASE}/${remote_sub}/"
  aws s3 sync "$local_dir" "${S3_BASE}/${remote_sub}/" "${AWS_ARGS[@]}" \
    --delete
}

sync_dir "${DATA_ROOT}/processed" "processed"
sync_dir "${DATA_ROOT}/tiles" "tiles"
sync_dir "${DATA_ROOT}/manifests" "manifests"
sync_dir "${DATA_ROOT}/reports" "reports"

# Catalog under catalog/
if [[ -f "${DATA_ROOT}/processed/solux_data_catalog.json" ]]; then
  aws s3 cp "${DATA_ROOT}/processed/solux_data_catalog.json" \
    "${S3_BASE}/catalog/solux_data_catalog.json" "${AWS_ARGS[@]}"
fi

if [[ "${UPLOAD_RAW:-false}" == "true" ]]; then
  log_warn "UPLOAD_RAW=true — syncing raw/ (excluding largest rasters)"
  aws s3 sync "${DATA_ROOT}/raw" "${S3_BASE}/raw/" "${AWS_ARGS[@]}" \
    --exclude "*/esa_worldcover/*" \
    --exclude "*/copernicus_dem/*" \
    --exclude "*/gebco/*"
fi

log_info "Generating upload manifest with checksums …"
tsx "${SCRIPT_DIR}/generate-upload-manifest.ts" \
  --data-root "$DATA_ROOT" \
  --s3-prefix "${SOLUX_DATASET_PREFIX}" \
  --dataset-version "${DATASET_VERSION}" \
  --output "${DATA_ROOT}/manifests/upload_manifest.json"

aws s3 cp "${DATA_ROOT}/manifests/upload_manifest.json" \
  "${S3_BASE}/manifests/upload_manifest.json" "${AWS_ARGS[@]}"

log_ok "Upload complete: ${S3_BASE}/"
log_info "Catalog: ${S3_BASE}/catalog/solux_data_catalog.json"
