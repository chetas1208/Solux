#!/usr/bin/env bash
# Shared utilities for Solux data pipeline scripts.
set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
export DATA_ROOT="${DATA_ROOT:-/data/solux}"
export COUNTRY_SCOPE="${COUNTRY_SCOPE:-USA,INDIA}"
export FORCE_DOWNLOAD="${FORCE_DOWNLOAD:-false}"
export DOWNLOAD_BIG_RASTERS="${DOWNLOAD_BIG_RASTERS:-false}"
export DOWNLOAD_COPERNICUS_MARINE="${DOWNLOAD_COPERNICUS_MARINE:-false}"
export DOWNLOAD_GEBCO="${DOWNLOAD_GEBCO:-false}"
export DOWNLOAD_WORLD_COVER="${DOWNLOAD_WORLD_COVER:-true}"
export DOWNLOAD_GLOBAL_SOLAR_ATLAS="${DOWNLOAD_GLOBAL_SOLAR_ATLAS:-false}"
export RUN_REGION_SUBSET="${RUN_REGION_SUBSET:-true}"
export DO_UPLOAD="${DO_UPLOAD:-false}"
export H3_RES_LAND="${H3_RES_LAND:-7}"
export H3_RES_WATER="${H3_RES_WATER:-7}"
export PVGIS_BASE_URL="${PVGIS_BASE_URL:-https://re.jrc.ec.europa.eu/api/v5_3}"

export LOG_DIR="${DATA_ROOT}/logs"
export MANIFESTS_DIR="${DATA_ROOT}/manifests"
export PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; RESET='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${RESET}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_skip()  { echo -e "${YELLOW}[SKIP]${RESET}  $*"; }

die() { log_error "$*"; exit 1; }

# ── Checksum helpers ──────────────────────────────────────────────────────────
sha256_file() {
  local f="$1"
  if command -v sha256sum &>/dev/null; then
    sha256sum "$f" | awk '{print $1}'
  else
    shasum -a 256 "$f" | awk '{print $1}'
  fi
}

record_checksum() {
  local src="$1" label="$2"
  local hash; hash=$(sha256_file "$src")
  mkdir -p "${MANIFESTS_DIR}"
  echo "${hash}  ${label}" >> "${MANIFESTS_DIR}/checksums.sha256"
  log_ok "SHA256 ${label}: ${hash:0:12}…"
}

# ── Download helpers ──────────────────────────────────────────────────────────
download_if_missing() {
  local url="$1" dest="$2" label="${3:-$(basename "$dest")}"
  if [[ -f "$dest" && "$FORCE_DOWNLOAD" != "true" ]]; then
    log_skip "$label already downloaded"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  log_info "Downloading $label …"
  if ! curl -fSL --retry 3 --retry-delay 5 --connect-timeout 30 \
       -o "$dest" "$url" 2>/tmp/curl_err.txt; then
    log_warn "Download failed for $label: $(cat /tmp/curl_err.txt | head -1)"
    return 1
  fi
  record_checksum "$dest" "$label"
  log_ok "Saved $dest"
}

create_manual_download_notice() {
  local raw_dir="$1" label="$2" instructions="$3"
  mkdir -p "$raw_dir"
  cat > "${raw_dir}/MANUAL_DOWNLOAD_REQUIRED.md" << NOTICE
# Manual Download Required: ${label}

${instructions}

## Status
This source requires manual download. The pipeline will skip processing
for this layer and mark it as unavailable in the data catalog.

## When Downloaded
Place the downloaded file(s) in this directory:
  ${raw_dir}/

Then re-run the pipeline. The idempotency checks will detect the files
and include this layer in processing.
NOTICE
  log_warn "MANUAL DOWNLOAD required for ${label} — see ${raw_dir}/MANUAL_DOWNLOAD_REQUIRED.md"
}

source_available() {
  local raw_dir="$1"
  # Available if dir exists, has files, and no MANUAL_DOWNLOAD_REQUIRED marker
  [[ -d "$raw_dir" ]] \
    && [[ -f "${raw_dir}/MANUAL_DOWNLOAD_REQUIRED.md" ]] \
    && { ls "${raw_dir}"/*.zip "${raw_dir}"/*.geojson "${raw_dir}"/*.gpkg \
             "${raw_dir}"/*.csv "${raw_dir}"/*.tif "${raw_dir}"/*.parquet \
             "${raw_dir}"/*.nc 2>/dev/null | grep -qv "MANUAL_DOWNLOAD_REQUIRED.md"; } \
    || { [[ -d "$raw_dir" ]] && ! [[ -f "${raw_dir}/MANUAL_DOWNLOAD_REQUIRED.md" ]] \
         && ls "$raw_dir"/* &>/dev/null; }
}

data_available() {
  local raw_dir="$1"
  [[ -d "$raw_dir" ]] \
    && ! [[ -f "${raw_dir}/MANUAL_DOWNLOAD_REQUIRED.md" ]] \
    && ls "$raw_dir"/* &>/dev/null 2>&1
}

# ── Zenodo download ───────────────────────────────────────────────────────────
download_zenodo_record() {
  local record_id="$1" dest_dir="$2" label="$3"
  mkdir -p "$dest_dir"
  log_info "Fetching Zenodo record ${record_id} metadata for ${label} …"

  local meta_file="${dest_dir}/zenodo_record_${record_id}.json"
  if ! curl -fSL --retry 3 -o "$meta_file" \
       "https://zenodo.org/api/records/${record_id}" 2>/tmp/curl_err.txt; then
    log_warn "Zenodo API failed for ${label}: $(cat /tmp/curl_err.txt | head -1)"
    return 1
  fi

  local file_count; file_count=$(jq '.files | length' "$meta_file")
  log_info "${label}: ${file_count} file(s) in Zenodo record"

  jq -r '.files[] | [.key, .links.self] | @tsv' "$meta_file" \
  | while IFS=$'\t' read -r fname furl; do
      local fpath="${dest_dir}/${fname}"
      if [[ -f "$fpath" && "$FORCE_DOWNLOAD" != "true" ]]; then
        log_skip "${fname} already present"
        continue
      fi
      log_info "  Downloading ${fname} …"
      if curl -fSL --retry 3 -o "$fpath" "$furl" 2>/tmp/curl_err.txt; then
        record_checksum "$fpath" "${label}/${fname}"
      else
        log_warn "  Failed: $(cat /tmp/curl_err.txt | head -1)"
      fi
    done
}

# ── Overpass query ────────────────────────────────────────────────────────────
overpass_query() {
  local query="$1" dest="$2" label="${3:-overpass}"
  if [[ -f "$dest" && "$FORCE_DOWNLOAD" != "true" ]]; then
    log_skip "$label already downloaded"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  log_info "Overpass query: $label …"
  local encoded; encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.stdin.read()))" <<< "$query" 2>/dev/null \
    || node -e "process.stdout.write(encodeURIComponent(require('fs').readFileSync('/dev/stdin','utf8')))" <<< "$query")

  if ! curl -fSL --retry 2 --max-time 120 \
       -o "$dest" \
       "https://overpass-api.de/api/interpreter?data=${encoded}" 2>/tmp/curl_err.txt; then
    log_warn "$label Overpass query failed: $(cat /tmp/curl_err.txt | head -1)"
    return 1
  fi
  record_checksum "$dest" "$label"
  log_ok "Saved $dest"
}

# ── Region filter helpers ─────────────────────────────────────────────────────
USA_STATES_SUBSET="Arizona,California,Nevada,Texas,'New Mexico'"
INDIA_STATES_SUBSET="Rajasthan,Gujarat,Maharashtra,'Madhya Pradesh',Karnataka,Telangana,'Andhra Pradesh','Tamil Nadu'"

scope_includes() {
  local country="$1"
  echo "$COUNTRY_SCOPE" | tr ',' '\n' | grep -qi "^${country}$"
}

# ── Metadata helpers ──────────────────────────────────────────────────────────
write_source_meta() {
  local id="$1" status="$2" raw_dir="$3" note="${4:-}"
  mkdir -p "${MANIFESTS_DIR}"
  local meta_file="${MANIFESTS_DIR}/source-metadata.json"
  local ts; ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  # Append to JSONL
  echo "{\"id\":\"${id}\",\"status\":\"${status}\",\"rawDir\":\"${raw_dir}\",\"checkedAt\":\"${ts}\",\"note\":\"${note}\"}" \
    >> "${MANIFESTS_DIR}/source-status.jsonl"
}

# ── TSX runner ────────────────────────────────────────────────────────────────
run_tsx() {
  local script="$1"; shift
  local tsx_bin="${PIPELINE_DIR}/node_modules/.bin/tsx"
  [[ ! -x "$tsx_bin" ]] && tsx_bin="$(command -v tsx 2>/dev/null || true)"
  [[ -z "$tsx_bin" ]] && tsx_bin="npx tsx"
  $tsx_bin "${PIPELINE_DIR}/src/${script}" "$@"
}

# ── DuckDB runner (CLI or npm fallback) ───────────────────────────────────────
# Usage: duckdb_query "SQL statement"
duckdb_query() {
  local sql="$1"
  if command -v duckdb &>/dev/null; then
    duckdb -c "$sql"
  else
    # Fall back to npm duckdb via Node
    node -e "
const duckdb = require('${PIPELINE_DIR}/node_modules/duckdb');
const db = new duckdb.Database(':memory:');
db.run(\`${sql//\`/\\\`}\`, function(err) {
  if (err) { process.stderr.write(err.message + '\n'); process.exit(1); }
  db.close();
});
"
  fi
}
