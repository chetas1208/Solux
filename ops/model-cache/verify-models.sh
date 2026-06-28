#!/usr/bin/env bash
# Verify Solux model cache contents against model-registry.json.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_JSON="${REGISTRY_JSON:-${SCRIPT_DIR}/model-registry.json}"
MODEL_CACHE_DIR="${MODEL_CACHE_DIR:-/data/models/solux}"

log() { printf '[solux-verify] %s\n' "$*"; }
warn() { printf '[solux-verify] WARNING: %s\n' "$*" >&2; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { printf '[solux-verify] ERROR: Required command not found: %s\n' "$1" >&2; exit 1; }
}

dir_size_human() {
  local path="$1"
  if [[ -d "$path" ]]; then
    du -sh "$path" 2>/dev/null | cut -f1 || echo "0"
  else
    echo "0"
  fi
}

dir_size_bytes() {
  local path="$1"
  if [[ -d "$path" ]]; then
    du -sb "$path" 2>/dev/null | cut -f1 || echo 0
  else
    echo 0
  fi
}

print_license_warnings() {
  local status="$1" model_id="$2"
  case "$status" in
    *warn*|unknown*|detect_from*)
      warn "License/access for $model_id: $status"
      ;;
  esac
}

main() {
  require_cmd jq
  require_cmd du

  if [[ ! -f "$REGISTRY_JSON" ]]; then
    warn "Registry not found: $REGISTRY_JSON"
    warn "Run: bash ops/model-cache/download-models.sh"
    exit 1
  fi

  log "Registry: $REGISTRY_JSON"
  log "Cache dir: $MODEL_CACHE_DIR"
  printf '\n'
  printf '%-8s  %-36s  %-12s  %-10s  %s\n' "STATUS" "MODEL_ID" "MVP" "SIZE" "LOCAL_PATH"
  printf '%s\n' "$(printf '%.0s-' {1..120})"

  local missing_mvp=0
  local count=0

  while IFS= read -r entry; do
    count=$((count + 1))
    local model_id local_path required task license status size_human size_bytes warnings

    model_id="$(echo "$entry" | jq -r '.modelId')"
    local_path="$(echo "$entry" | jq -r '.localPath')"
    required="$(echo "$entry" | jq -r '.requiredForMVP')"
    task="$(echo "$entry" | jq -r '.task')"
    license="$(echo "$entry" | jq -r '.licenseStatus')"
    warnings="$(echo "$entry" | jq -r '.warnings | join("; ")')"

    size_bytes="$(dir_size_bytes "$local_path")"
    size_human="$(dir_size_human "$local_path")"

    status="MISSING"
    if [[ -d "$local_path" && "$size_bytes" -gt 0 ]]; then
      status="FOUND"
    fi

    if [[ "$required" == "true" && "$status" == "MISSING" ]]; then
      missing_mvp=$((missing_mvp + 1))
      warn "Required MVP model missing: $model_id ($local_path)"
    fi

    print_license_warnings "$license" "$model_id"

    if [[ -n "$warnings" && "$warnings" != "null" ]]; then
      warn "$model_id: $warnings"
    fi

    printf '%-8s  %-36s  %-12s  %-10s  %s\n' "$status" "$model_id" "$required" "$size_human" "$local_path"
    printf '         task=%s  licenseStatus=%s\n' "$task" "$license"
  done < <(jq -c '.models[]' "$REGISTRY_JSON")

  printf '\n'
  log "Checked $count models"

  local total_bytes=0
  if [[ -d "$MODEL_CACHE_DIR" ]]; then
    total_bytes="$(du -sb "$MODEL_CACHE_DIR" 2>/dev/null | cut -f1 || echo 0)"
    log "Total cache size: $(numfmt --to=iec-i --suffix=B "$total_bytes" 2>/dev/null || echo "${total_bytes} bytes")"
  fi

  if [[ "$missing_mvp" -gt 0 ]]; then
    warn "$missing_mvp required MVP model(s) missing"
    warn "Run: export MODEL_CACHE_DIR=$MODEL_CACHE_DIR && bash ops/model-cache/download-models.sh"
    exit 1
  fi

  log "All required MVP models present"
  exit 0
}

main "$@"
