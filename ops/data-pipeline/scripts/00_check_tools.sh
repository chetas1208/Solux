#!/usr/bin/env bash
# Verify all required tools are installed before running the pipeline.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

MISSING=()
OPTIONAL_MISSING=()

check_tool() {
  local tool="$1" optional="${2:-false}"
  if command -v "$tool" &>/dev/null; then
    local ver; ver=$("$tool" --version 2>&1 | head -1 || true)
    log_ok "$tool: $ver"
  else
    if [[ "$optional" == "true" ]]; then
      log_warn "OPTIONAL MISSING: $tool"
      OPTIONAL_MISSING+=("$tool")
    else
      log_error "REQUIRED MISSING: $tool"
      MISSING+=("$tool")
    fi
  fi
}

check_node_version() {
  if command -v node &>/dev/null; then
    local ver; ver=$(node --version)
    local major; major=$(echo "$ver" | sed 's/v\([0-9]*\).*/\1/')
    if [[ "$major" -ge 22 ]]; then
      log_ok "node: $ver"
    else
      log_warn "node: $ver (want ≥ v22)"
    fi
  else
    log_error "REQUIRED MISSING: node"
    MISSING+=("node")
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Solux Data Pipeline — Tool Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "── Required ──────────────────────────────"
check_node_version
check_tool pnpm
check_tool tsx
check_tool curl
check_tool jq
check_tool unzip
check_tool duckdb

echo ""
echo "── GDAL ──────────────────────────────────"
check_tool ogr2ogr
check_tool gdalinfo
check_tool gdalwarp
check_tool gdal_translate
check_tool gdaldem

echo ""
echo "── Tiles ─────────────────────────────────"
check_tool tippecanoe
check_tool pmtiles true

echo ""
echo "── Upload ────────────────────────────────"
check_tool aws
check_tool rclone true
check_tool s5cmd true

echo ""
echo "── Optional ──────────────────────────────"
check_tool python3 true
check_tool h3 true

echo ""
if [[ ${#MISSING[@]} -gt 0 ]]; then
  log_error "Missing required tools: ${MISSING[*]}"
  echo ""
  echo "Install guidance:"
  for t in "${MISSING[@]}"; do
    case "$t" in
      node)       echo "  node: https://nodejs.org/ or nvm install 22" ;;
      pnpm)       echo "  pnpm: npm install -g pnpm@9" ;;
      tsx)        echo "  tsx: npm install -g tsx" ;;
      curl)       echo "  curl: apt install curl / brew install curl" ;;
      jq)         echo "  jq: apt install jq / brew install jq" ;;
      unzip)      echo "  unzip: apt install unzip" ;;
      duckdb)     echo "  duckdb: https://duckdb.org/docs/installation/" ;;
      ogr2ogr)    echo "  ogr2ogr: apt install gdal-bin / brew install gdal" ;;
      gdalinfo)   echo "  gdalinfo: apt install gdal-bin / brew install gdal" ;;
      gdalwarp)   echo "  gdalwarp: apt install gdal-bin / brew install gdal" ;;
      gdal_translate) echo "  gdal_translate: apt install gdal-bin / brew install gdal" ;;
      gdaldem)    echo "  gdaldem: apt install gdal-bin / brew install gdal" ;;
      tippecanoe) echo "  tippecanoe: https://github.com/mapbox/tippecanoe" ;;
      aws)        echo "  aws: pip install awscli / https://aws.amazon.com/cli/" ;;
    esac
  done
  echo ""
  exit 1
fi

if [[ ${#OPTIONAL_MISSING[@]} -gt 0 ]]; then
  log_warn "Optional tools not found (non-fatal): ${OPTIONAL_MISSING[*]}"
fi

echo ""
log_ok "All required tools present."

echo ""
echo "── Environment variables ─────────────────"
check_env_var() {
  local var="$1" required="${2:-false}"
  local val="${!var:-}"
  if [[ -n "$val" ]]; then
    if [[ "$var" =~ (KEY|SECRET|TOKEN|PASSWORD) ]]; then
      log_ok "$var: ***set***"
    else
      log_ok "$var: $val"
    fi
  else
    if [[ "$required" == "true" ]]; then
      log_warn "$var: NOT SET (may be required for some steps)"
    else
      log_skip "$var: not set (optional)"
    fi
  fi
}

check_env_var DATA_ROOT
check_env_var COUNTRY_SCOPE
check_env_var NREL_API_KEY false
check_env_var PVGIS_BASE_URL
check_env_var DIGITALOCEAN_SPACES_ENDPOINT false
check_env_var DIGITALOCEAN_SPACES_BUCKET false
check_env_var DIGITALOCEAN_SPACES_KEY false
check_env_var DIGITALOCEAN_SPACES_SECRET false
check_env_var DOWNLOAD_GEBCO
check_env_var DOWNLOAD_WORLD_COVER
check_env_var DOWNLOAD_GLOBAL_SOLAR_ATLAS
check_env_var DOWNLOAD_COPERNICUS_MARINE
check_env_var RUN_REGION_SUBSET
check_env_var H3_RES_LAND
check_env_var H3_RES_WATER

echo ""
log_ok "Tool check complete."
