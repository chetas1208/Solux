#!/usr/bin/env bash
# Upload local datasets to DigitalOcean Spaces (S3-compatible).
# Requires valid DIGITALOCEAN_SPACES_KEY / SECRET in environment or .env.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi

ENDPOINT="${DIGITALOCEAN_SPACES_ENDPOINT:-https://sfo3.digitaloceanspaces.com}"
BUCKET="${DIGITALOCEAN_SPACES_BUCKET:-solux}"
export AWS_ACCESS_KEY_ID="${DIGITALOCEAN_SPACES_KEY:?missing DIGITALOCEAN_SPACES_KEY}"
export AWS_SECRET_ACCESS_KEY="${DIGITALOCEAN_SPACES_SECRET:?missing DIGITALOCEAN_SPACES_SECRET}"

echo "Syncing datasets to s3://${BUCKET}/datasets/ ..."
aws s3 sync "$ROOT/data/datasets/" "s3://${BUCKET}/datasets/" \
  --endpoint-url "$ENDPOINT" \
  --acl private \
  --exclude '*.zip' \
  --exclude 'world-ghi.zip'

echo "Done."
