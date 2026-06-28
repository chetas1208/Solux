#!/usr/bin/env bash
set -euo pipefail

export DATA_ROOT="${DATA_ROOT:-/data/solux}"
export DATASET_VERSION="${DATASET_VERSION:-v0.1}"
export SOLUX_DATASET_PREFIX="${SOLUX_DATASET_PREFIX:-datasets/solux-site-screening/${DATASET_VERSION}}"
export SOLUX_OUTPUT_PREFIX="${SOLUX_OUTPUT_PREFIX:-outputs/solux-site-screening/${DATASET_VERSION}}"
export SOLUX_RUN_PREFIX="${SOLUX_RUN_PREFIX:-runs/solux-site-screening/${DATASET_VERSION}}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${DIGITALOCEAN_SPACES_KEY:-}}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${DIGITALOCEAN_SPACES_SECRET:-}}"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; RESET='\033[0m'
log_info()  { echo -e "${BLUE}[INFO]${RESET}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die() { log_error "$*"; exit 1; }

require_spaces_env() {
  [[ -n "${DIGITALOCEAN_SPACES_ENDPOINT:-}" ]] || die "DIGITALOCEAN_SPACES_ENDPOINT not set"
  [[ -n "${DIGITALOCEAN_SPACES_BUCKET:-}" ]]   || die "DIGITALOCEAN_SPACES_BUCKET not set"
  [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]            || die "AWS_ACCESS_KEY_ID / DIGITALOCEAN_SPACES_KEY not set"
  [[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]]        || die "AWS_SECRET_ACCESS_KEY / DIGITALOCEAN_SPACES_SECRET not set"
  command -v aws &>/dev/null || die "aws CLI required"
}

validate_deletable_prefix() {
  local prefix="$1"
  [[ -n "$prefix" ]] || die "Empty prefix refused"
  [[ "$prefix" != "/" ]] || die "Root prefix '/' refused"
  [[ "$prefix" != "." ]] || die "Prefix '.' refused"
  [[ "$prefix" != "*" ]] || die "Wildcard prefix refused"
  [[ "$prefix" != *"*"* ]] || die "Wildcard in prefix refused: $prefix"
}

list_prefix_manifest() {
  local prefix="$1" outfile="$2"
  aws s3 ls "s3://${DIGITALOCEAN_SPACES_BUCKET}/${prefix}/" \
    --recursive --endpoint-url "${DIGITALOCEAN_SPACES_ENDPOINT}" \
    > "${outfile}.txt" 2>/dev/null || true
  local count size
  count=$(wc -l < "${outfile}.txt" | tr -d ' ')
  size=$(awk '{sum+=$3} END {print sum+0}' "${outfile}.txt")
  jq -n \
    --arg prefix "$prefix" \
    --arg bucket "${DIGITALOCEAN_SPACES_BUCKET}" \
    --argjson objectCount "${count:-0}" \
    --argjson totalBytes "${size:-0}" \
    --arg capturedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{prefix: $prefix, bucket: $bucket, objectCount: $objectCount, totalBytes: $totalBytes, capturedAt: $capturedAt}'
}
