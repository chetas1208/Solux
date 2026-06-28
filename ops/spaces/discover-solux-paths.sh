#!/usr/bin/env bash
# Discover real Solux object paths in DigitalOcean Spaces.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

require_spaces_env

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${DIGITALOCEAN_SPACES_KEY:-}}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${DIGITALOCEAN_SPACES_SECRET:-}}"

log_info "Discovering Solux paths in s3://${DIGITALOCEAN_SPACES_BUCKET}/ …"
log_info "  Dataset prefix: ${SOLUX_DATASET_PREFIX}"
log_info "  Output prefix:  ${SOLUX_OUTPUT_PREFIX}"

mkdir -p "${DATA_ROOT}/manifests"

cd "${REPO_ROOT}"
pnpm exec tsx "${SCRIPT_DIR}/discover-solux-paths.ts"

log_ok "Manifests in ${DATA_ROOT}/manifests/"
