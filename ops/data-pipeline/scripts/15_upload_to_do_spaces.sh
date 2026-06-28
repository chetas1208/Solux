#!/usr/bin/env bash
# Upload processed outputs to DigitalOcean Spaces.
# Requires: aws CLI configured for DO Spaces S3 endpoint
# Only runs if DO_UPLOAD=true and validation passed.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

if [[ "$DO_UPLOAD" != "true" ]]; then
  log_skip "DO_UPLOAD=false — skipping upload"
  exit 0
fi

# ── Pre-flight checks ─────────────────────────────────────────────────────────
[[ -z "${DIGITALOCEAN_SPACES_ENDPOINT:-}" ]] && die "DIGITALOCEAN_SPACES_ENDPOINT not set"
[[ -z "${DIGITALOCEAN_SPACES_BUCKET:-}"   ]] && die "DIGITALOCEAN_SPACES_BUCKET not set"
[[ -z "${DIGITALOCEAN_SPACES_KEY:-}"      ]] && die "DIGITALOCEAN_SPACES_KEY not set"
[[ -z "${DIGITALOCEAN_SPACES_SECRET:-}"   ]] && die "DIGITALOCEAN_SPACES_SECRET not set"

command -v aws &>/dev/null || die "aws CLI not found. Install: pip install awscli"

# Validation must have passed
QA_REPORT="${DATA_ROOT}/manifests/quality_report.json"
if [[ -f "$QA_REPORT" ]]; then
  QA_STATUS=$(jq -r '.status // "unknown"' "$QA_REPORT" 2>/dev/null || echo "unknown")
  if [[ "$QA_STATUS" != "pass" ]]; then
    die "Validation did not pass (status=${QA_STATUS}) — refusing upload. Run 13_validate_dataset.sh."
  fi
else
  die "quality_report.json not found — run 13_validate_dataset.sh first"
fi

UPLOAD_RAW="${UPLOAD_RAW:-false}"
S3_BASE="s3://${DIGITALOCEAN_SPACES_BUCKET}/datasets/solux-site-screening/v0.1"
ENDPOINT="$DIGITALOCEAN_SPACES_ENDPOINT"

log_info "Uploading Solux dataset to DigitalOcean Spaces …"
log_info "  Endpoint: ${ENDPOINT}"
log_info "  Bucket:   ${DIGITALOCEAN_SPACES_BUCKET}"
log_info "  Path:     ${S3_BASE}"

AWS_CMD="aws s3 sync"
AWS_ARGS="--endpoint-url ${ENDPOINT} --acl public-read --no-progress"

export AWS_ACCESS_KEY_ID="$DIGITALOCEAN_SPACES_KEY"
export AWS_SECRET_ACCESS_KEY="$DIGITALOCEAN_SPACES_SECRET"

upload_dir() {
  local local_dir="$1" s3_path="$2" label="$3"
  if [[ ! -d "$local_dir" ]]; then
    log_skip "$label: directory not found ($local_dir)"
    return 0
  fi
  log_info "Uploading ${label} …"
  if $AWS_CMD "$local_dir" "${s3_path}/" $AWS_ARGS 2>&1 | \
     grep -E "^(upload:|error)" | head -20; then
    log_ok "Uploaded $label"
  else
    log_warn "Upload may have failed for $label — check AWS output"
  fi
}

upload_dir "${DATA_ROOT}/processed" "${S3_BASE}/processed" "processed/"
upload_dir "${DATA_ROOT}/tiles"     "${S3_BASE}/tiles"     "tiles/"
upload_dir "${DATA_ROOT}/manifests" "${S3_BASE}/manifests" "manifests/"
upload_dir "${DATA_ROOT}/reports"   "${S3_BASE}/reports"   "reports/"

if [[ "$UPLOAD_RAW" == "true" ]]; then
  log_warn "UPLOAD_RAW=true — uploading raw data (may be very large)"
  log_warn "Excluding large rasters: worldcover, copernicus_dem, gebco"
  aws s3 sync "${DATA_ROOT}/raw" "${S3_BASE}/raw/" \
    --endpoint-url "${ENDPOINT}" \
    --exclude "*/esa_worldcover/*" \
    --exclude "*/copernicus_dem/*" \
    --exclude "*/gebco/*" \
    --exclude "*/nsrdb/*.csv" \
    $AWS_ARGS 2>&1 | grep -E "^(upload:|error)" | head -50 || true
fi

# ── Generate upload manifest ─────────────────────────────────────────────────
log_info "Generating upload manifest …"
UPLOAD_MANIFEST="${DATA_ROOT}/manifests/upload_manifest.json"
run_tsx "io/s3Upload.ts" write-upload-manifest \
  --data-root "$DATA_ROOT" \
  --s3-base "${S3_BASE}" \
  --output "$UPLOAD_MANIFEST" 2>/dev/null \
  || {
    # Minimal manifest
    cat > "$UPLOAD_MANIFEST" << JSON
{
  "uploadedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "endpoint": "${ENDPOINT}",
  "bucket": "${DIGITALOCEAN_SPACES_BUCKET}",
  "s3Base": "${S3_BASE}",
  "status": "uploaded"
}
JSON
  }

log_ok "Upload complete."
echo ""
log_info "Dataset URLs:"
log_info "  Candidates: ${S3_BASE}/processed/candidates/solux_candidate_sites.parquet"
log_info "  Scores:     ${S3_BASE}/processed/scoring/solux_site_scores.parquet"
log_info "  Catalog:    ${S3_BASE}/processed/solux_data_catalog.json"
log_info "  Manifest:   ${S3_BASE}/manifests/dataset_manifest.json"
