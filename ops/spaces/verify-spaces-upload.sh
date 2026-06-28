#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

require_spaces_env

S3_BASE="s3://${DIGITALOCEAN_SPACES_BUCKET}/${SOLUX_DATASET_PREFIX}"
ENDPOINT="${DIGITALOCEAN_SPACES_ENDPOINT}"

REMOTE_MANIFEST="${DATA_ROOT}/manifests/remote_verify_manifest.json"
mkdir -p "${DATA_ROOT}/manifests"

log_info "Verifying remote upload at ${S3_BASE}/"
aws s3 ls "${S3_BASE}/" --recursive --endpoint-url "$ENDPOINT" \
  > "${REMOTE_MANIFEST}.txt"

OBJECT_COUNT=$(wc -l < "${REMOTE_MANIFEST}.txt" | tr -d ' ')
TOTAL_BYTES=$(awk '{sum+=$3} END {print sum+0}' "${REMOTE_MANIFEST}.txt")

REQUIRED=(
  "manifests/upload_manifest.json"
  "catalog/solux_data_catalog.json"
  "processed/candidates/solux_candidate_sites.parquet"
  "processed/scoring/solux_site_scores.parquet"
)

MISSING=()
for key in "${REQUIRED[@]}"; do
  if ! grep -q "${key}" "${REMOTE_MANIFEST}.txt"; then
    MISSING+=("$key")
  fi
done

jq -n \
  --arg s3Base "$S3_BASE" \
  --argjson objectCount "$OBJECT_COUNT" \
  --argjson totalBytes "$TOTAL_BYTES" \
  --arg verifiedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson missing "$(printf '%s\n' "${MISSING[@]:-}" | jq -R . | jq -s 'map(select(length>0))')" \
  '{s3Base: $s3Base, objectCount: $objectCount, totalBytes: $totalBytes, verifiedAt: $verifiedAt, missingRequired: $missing, ok: ($missing | length == 0)}' \
  > "$REMOTE_MANIFEST"

if [[ ${#MISSING[@]} -gt 0 ]]; then
  die "Missing required remote objects: ${MISSING[*]}"
fi

log_ok "Remote verify passed: ${OBJECT_COUNT} objects, ${TOTAL_BYTES} bytes"
