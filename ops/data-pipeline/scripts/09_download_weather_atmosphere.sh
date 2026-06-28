#!/usr/bin/env bash
# Download weather and atmosphere data via NASA POWER API.
# Source: https://power.larc.nasa.gov
# License: NASA Open Data — free, no restrictions
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

RAW="${DATA_ROOT}/raw/global/nasa_power"
mkdir -p "$RAW"

log_info "Sampling NASA POWER climatology for representative points …"
log_info "  API: https://power.larc.nasa.gov/api/temporal/climatology/point"
log_info "  Full candidate sampling happens during scoring step (script 12)"

# Define representative sample points for region coverage validation
declare -a SAMPLE_POINTS
if scope_includes "USA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  # Arizona, California, Nevada, New Mexico, Texas centroids
  SAMPLE_POINTS+=(
    "az_phoenix:33.45:-112.07"
    "ca_bakersfield:35.37:-119.01"
    "nv_las_vegas:36.17:-115.14"
    "tx_west:31.12:-103.30"
    "nm_southwest:32.00:-106.77"
  )
fi

if scope_includes "INDIA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
  # Rajasthan, Gujarat, Maharashtra, MP, Karnataka, AP, Telangana, TN centroids
  SAMPLE_POINTS+=(
    "raj_jodhpur:26.29:73.02"
    "guj_ahmedabad:23.03:72.58"
    "mh_pune:18.52:73.86"
    "mp_bhopal:23.26:77.41"
    "kar_bangalore:12.97:77.59"
    "ap_tirupati:13.63:79.42"
    "ts_hyderabad:17.39:78.48"
    "tn_madurai:9.93:78.12"
  )
fi

# NASA POWER parameters relevant to Solux scoring
NASA_PARAMS="T2M,T2MDEW,CLRSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_LW_DWN,ALLSKY_SRF_ALB,WS10M,PRECTOTCORR,CLOUD_AMT,AOD_55"

PROBE_DONE=false
for point_def in "${SAMPLE_POINTS[@]}"; do
  IFS=':' read -r pname plat plon <<< "$point_def"
  DEST="${RAW}/nasa_power_${pname}.json"

  if [[ -f "$DEST" && "$FORCE_DOWNLOAD" != "true" ]]; then
    log_skip "NASA POWER $pname already sampled"
    continue
  fi

  NASA_URL="https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=${NASA_PARAMS}&community=RE&longitude=${plon}&latitude=${plat}&format=JSON&header=true&time-standard=LST"

  log_info "Sampling NASA POWER at ${pname} (${plat}, ${plon}) …"
  if curl -fSL --retry 3 --connect-timeout 30 --max-time 60 \
       -o "$DEST" "$NASA_URL" 2>/tmp/curl_err.txt; then
    # Validate response
    if jq -e '.properties.parameter != null' "$DEST" &>/dev/null; then
      log_ok "NASA POWER: ${pname} sampled"
      PROBE_DONE=true
    else
      local err; err=$(jq -r '.messages[0] // "unknown"' "$DEST" 2>/dev/null || echo "parse error")
      log_warn "NASA POWER ${pname}: unexpected response — ${err}"
      rm -f "$DEST"
    fi
  else
    log_warn "NASA POWER ${pname} API call failed: $(cat /tmp/curl_err.txt | head -1)"
  fi
  sleep 1  # polite rate limiting
done

if [[ "$PROBE_DONE" == "true" ]]; then
  write_source_meta "nasa_power" "sampled" "$RAW" "Representative points for validation"
  log_ok "NASA POWER: representative points sampled for validation"
else
  write_source_meta "nasa_power" "no_samples" "$RAW" "NASA POWER will be called per-candidate in scoring step"
  log_warn "No NASA POWER samples collected — will retry per-candidate in script 12"
fi

log_ok "Weather / atmosphere download step complete."
log_info "Full per-candidate NASA POWER sampling runs in script 12 (score_candidates.sh)"
