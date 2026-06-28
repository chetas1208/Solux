#!/usr/bin/env bash
# Safe prefix-only cleanup for Solux objects in DigitalOcean Spaces.
# NEVER deletes bucket root. NEVER uses aws s3 rb.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

require_spaces_env

[[ "${CLEAN_CONFIRM:-}" == "DELETE_SOLUX_PREFIXES" ]] || \
  die 'Set CLEAN_CONFIRM="DELETE_SOLUX_PREFIXES" to authorize prefix cleanup'

validate_deletable_prefix "${SOLUX_DATASET_PREFIX}"
validate_deletable_prefix "${SOLUX_OUTPUT_PREFIX}"
validate_deletable_prefix "${SOLUX_RUN_PREFIX}"

PREFIXES=("${SOLUX_DATASET_PREFIX}" "${SOLUX_OUTPUT_PREFIX}" "${SOLUX_RUN_PREFIX}")

if [[ "${CLEAN_RAW:-false}" == "true" ]]; then
  [[ "${PURGE_CONFIRM:-}" == "DELETE_SOLUX_RAW" ]] || \
    die 'CLEAN_RAW=true requires PURGE_CONFIRM="DELETE_SOLUX_RAW"'
  validate_deletable_prefix "raw/solux-site-screening/${DATASET_VERSION}"
  PREFIXES+=("raw/solux-site-screening/${DATASET_VERSION}")
else
  log_info "CLEAN_RAW=false — raw/ prefix will NOT be deleted"
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MANIFEST_DIR="${DATA_ROOT}/manifests"
mkdir -p "${MANIFEST_DIR}"

PRE_MANIFEST="${MANIFEST_DIR}/pre_clean_spaces_manifest_${STAMP}.json"
POST_MANIFEST="${MANIFEST_DIR}/post_clean_spaces_manifest_${STAMP}.json"

log_info "=== DRY RUN — objects that WOULD be deleted ==="
PRE_JSON='{"capturedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","prefixes":[]}'
ENTRIES=()

for prefix in "${PREFIXES[@]}"; do
  validate_deletable_prefix "$prefix"
  log_info "Listing s3://${DIGITALOCEAN_SPACES_BUCKET}/${prefix}/"
  TMP="${MANIFEST_DIR}/.list_${prefix//\//_}.txt"
  aws s3 ls "s3://${DIGITALOCEAN_SPACES_BUCKET}/${prefix}/" \
    --recursive --endpoint-url "${DIGITALOCEAN_SPACES_ENDPOINT}" | tee "$TMP" || true
  COUNT=$(wc -l < "$TMP" | tr -d ' ')
  log_warn "  → ${COUNT} objects under ${prefix}/"
  ENTRY=$(list_prefix_manifest "$prefix" "${MANIFEST_DIR}/.pre_${prefix//\//_}")
  ENTRIES+=("$ENTRY")
done

PRE_JSON=$(printf '%s\n' "${ENTRIES[@]}" | jq -s \
  --arg capturedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{capturedAt: $capturedAt, prefixes: .}')
echo "$PRE_JSON" > "$PRE_MANIFEST"
log_ok "Pre-clean manifest: $PRE_MANIFEST"

if [[ "${FORCE_CLEAN:-false}" != "true" ]]; then
  echo ""
  log_warn "This will DELETE only these prefixes (not archive/, not bucket root):"
  for prefix in "${PREFIXES[@]}"; do echo "  - ${prefix}/"; done
  read -r -p 'Type DELETE to confirm: ' CONFIRM
  [[ "$CONFIRM" == "DELETE" ]] || die "Cleanup cancelled"
fi

log_info "=== Deleting approved prefixes ==="
DELETED=()
for prefix in "${PREFIXES[@]}"; do
  log_info "Deleting s3://${DIGITALOCEAN_SPACES_BUCKET}/${prefix}/"
  aws s3 rm "s3://${DIGITALOCEAN_SPACES_BUCKET}/${prefix}/" \
    --recursive \
    --endpoint-url "${DIGITALOCEAN_SPACES_ENDPOINT}"
  DELETED+=("$prefix")
  log_ok "Deleted prefix: ${prefix}/"
done

POST_ENTRIES=()
for prefix in "${PREFIXES[@]}"; do
  POST_ENTRIES+=("$(list_prefix_manifest "$prefix" "${MANIFEST_DIR}/.post_${prefix//\//_}")")
done
printf '%s\n' "${POST_ENTRIES[@]}" | jq -s \
  --arg capturedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson deleted "$(printf '%s\n' "${DELETED[@]}" | jq -R . | jq -s .)" \
  '{capturedAt: $capturedAt, deletedPrefixes: $deleted, prefixes: .}' > "$POST_MANIFEST"

log_ok "Post-clean manifest: $POST_MANIFEST"
log_ok "Cleanup complete. Bucket root and archive/ were NOT touched."
