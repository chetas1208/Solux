#!/usr/bin/env bash
# Download water layer data: JRC Surface Water, HydroLAKES, GRanD, GEBCO, Copernicus Marine
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ── JRC Global Surface Water ───────────────────────────────────────────────────
RAW_JRC="${DATA_ROOT}/raw/global/jrc_surface_water"
mkdir -p "$RAW_JRC"
log_info "Downloading JRC Global Surface Water tiles …"

# JRC data available from their FTP mirror and Google Cloud Storage
# The "occurrence" band shows fraction of time a pixel was water (1984-2021)
# Tile naming: occurrence_{LON}_{LAT}v1_4_2021.tif

jrc_tile_list() {
  # Generate tile IDs for solar screening regions
  if scope_includes "USA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
    echo "100W_40N 100W_30N 110W_40N 110W_30N 120W_40N 120W_30N"
  fi
  if scope_includes "INDIA" && [[ "$RUN_REGION_SUBSET" == "true" ]]; then
    echo "70E_30N 70E_20N 80E_30N 80E_20N"
  fi
  if [[ "$RUN_REGION_SUBSET" != "true" ]]; then
    if scope_includes "USA"; then
      echo "80W_50N 80W_40N 80W_30N 90W_50N 90W_40N 90W_30N 100W_50N 100W_40N 100W_30N 110W_40N 110W_30N 120W_40N 120W_30N"
    fi
    if scope_includes "INDIA"; then
      echo "60E_30N 70E_30N 70E_20N 70E_10N 80E_30N 80E_20N 80E_10N 90E_30N 90E_20N 90E_10N"
    fi
  fi
}

JRC_BASE="https://storage.googleapis.com/global-surface-water/downloads2021v2/occurrence"

for tile_id in $(jrc_tile_list); do
  JRC_FILE="occurrence_${tile_id}v1_4_2021.tif"
  JRC_URL="${JRC_BASE}/${JRC_FILE}"
  JRC_DEST="${RAW_JRC}/${JRC_FILE}"
  download_if_missing "$JRC_URL" "$JRC_DEST" "JRC water occurrence ${tile_id}" || \
    log_warn "JRC tile ${tile_id} unavailable — skip"
done

N_JRC=$(ls "${RAW_JRC}"/*.tif 2>/dev/null | wc -l | tr -d ' ')
if [[ "$N_JRC" -gt 0 ]]; then
  write_source_meta "jrc_surface_water" "downloaded" "$RAW_JRC" "${N_JRC} tiles"
  log_ok "JRC Surface Water: ${N_JRC} tiles"
else
  log_warn "No JRC Surface Water tiles downloaded"
  write_source_meta "jrc_surface_water" "download_failed" "$RAW_JRC"
fi

# ── HydroLAKES ────────────────────────────────────────────────────────────────
RAW_HL="${DATA_ROOT}/raw/global/hydrolakes"
mkdir -p "$RAW_HL"

if ls "${RAW_HL}"/*.shp "${RAW_HL}"/*.gpkg "${RAW_HL}"/*.geojson 2>/dev/null | grep -q .; then
  log_ok "HydroLAKES already present"
  write_source_meta "hydrolakes" "available" "$RAW_HL"
else
  create_manual_download_notice "$RAW_HL" "HydroLAKES" \
    "Download from: https://www.hydrosheds.org/page/hydrolakes

1. Go to https://www.hydrosheds.org/page/hydrolakes
2. Click 'Download HydroLAKES'
3. Register (free) and download:
   HydroLAKES_polys_v10.gdb.zip (GeoDatabase, ~500 MB) or
   HydroLAKES_polys_v10_shp.zip (Shapefile, ~400 MB)
4. Extract and place .shp or .gdb in: ${RAW_HL}/

Contains 1.4 million lake/reservoir polygons globally."
  write_source_meta "hydrolakes" "manual_required" "$RAW_HL"
fi

# ── GRanD ─────────────────────────────────────────────────────────────────────
RAW_GRAND="${DATA_ROOT}/raw/global/grand"
mkdir -p "$RAW_GRAND"

if ls "${RAW_GRAND}"/*.shp "${RAW_GRAND}"/*.gpkg "${RAW_GRAND}"/*.geojson 2>/dev/null | grep -q .; then
  log_ok "GRanD already present"
  write_source_meta "grand" "available" "$RAW_GRAND"
else
  create_manual_download_notice "$RAW_GRAND" "GRanD — Global Reservoir and Dam Database" \
    "Download from NASA Earthdata (free account required):
1. Register at https://urs.earthdata.nasa.gov/
2. Go to: https://www.earthdata.nasa.gov/data/catalog/sedac-ciesin-sedac-grandv1-dams-1.01
3. Download 'GRanD_dams_v1_3.zip' (dams shapefile)
4. Or: https://www.globaldamwatch.org/grand
5. Extract and place .shp files in: ${RAW_GRAND}/

Contains 7,320 large dams and their reservoir polygons globally.
Non-commercial research license — verify before commercial use."
  write_source_meta "grand" "manual_required" "$RAW_GRAND"
fi

# ── GEBCO Bathymetry ───────────────────────────────────────────────────────────
RAW_GEBCO="${DATA_ROOT}/raw/global/gebco"
mkdir -p "$RAW_GEBCO"

if [[ "$DOWNLOAD_GEBCO" != "true" ]]; then
  log_skip "DOWNLOAD_GEBCO=false — skipping GEBCO"
  if ls "${RAW_GEBCO}"/*.tif "${RAW_GEBCO}"/*.nc 2>/dev/null | grep -q .; then
    log_ok "GEBCO data found (prior download)"
    write_source_meta "gebco" "available_prior" "$RAW_GEBCO"
  else
    write_source_meta "gebco" "skipped" "$RAW_GEBCO" "Set DOWNLOAD_GEBCO=true to enable"
  fi
else
  log_info "Downloading GEBCO 2024 grid …"
  # GEBCO provides direct download via BODC. The compressed NetCDF is ~7 GB.
  # Sub-ice topo version is 15 arc-second resolution global grid.
  GEBCO_URL="https://www.bodc.ac.uk/data/open_download/gebco/gebco_2024_sub_ice_topo/geotiff/"
  GEBCO_DEST="${RAW_GEBCO}/GEBCO_2024_sub_ice_topo.zip"
  log_warn "GEBCO grid is ~7 GB. This may take a long time."

  if download_if_missing "$GEBCO_URL" "$GEBCO_DEST" "GEBCO 2024 GeoTIFF"; then
    unzip -o -d "$RAW_GEBCO" "$GEBCO_DEST" "*.tif" 2>/dev/null || true
    write_source_meta "gebco" "downloaded" "$RAW_GEBCO"
  else
    log_warn "GEBCO direct download failed — try manual download:"
    log_warn "  https://download.gebco.net"
    log_warn "  Select region → GeoTIFF format → download"
    create_manual_download_notice "$RAW_GEBCO" "GEBCO 2024" \
      "Download from https://download.gebco.net
Select your region or the full grid in GeoTIFF format.
Place the .tif file in: ${RAW_GEBCO}/"
    write_source_meta "gebco" "manual_fallback" "$RAW_GEBCO"
  fi
fi

# ── Copernicus Marine (Wave Data) ─────────────────────────────────────────────
RAW_CMW="${DATA_ROOT}/raw/global/copernicus_marine_waves"
mkdir -p "$RAW_CMW"

if [[ "$DOWNLOAD_COPERNICUS_MARINE" != "true" ]]; then
  log_skip "DOWNLOAD_COPERNICUS_MARINE=false — skipping wave data"
  write_source_meta "copernicus_marine_waves" "skipped" "$RAW_CMW" "Set DOWNLOAD_COPERNICUS_MARINE=true"
else
  log_info "Checking Copernicus Marine wave data …"
  if command -v copernicusmarine &>/dev/null; then
    log_info "copernicusmarine CLI found — downloading wave analysis …"
    copernicusmarine get \
      -i cmems_mod_glo_wav_anfc_0.083deg_PT3H-i \
      -v VHM0 -v VTPK \
      --output-directory "$RAW_CMW" \
      --force-download 2>/tmp/copernicus_err.txt \
    && write_source_meta "copernicus_marine_waves" "downloaded" "$RAW_CMW" \
    || {
      log_warn "copernicusmarine download failed: $(cat /tmp/copernicus_err.txt | head -3)"
      write_source_meta "copernicus_marine_waves" "download_failed" "$RAW_CMW"
    }
  else
    create_manual_download_notice "$RAW_CMW" "Copernicus Marine Wave Data" \
      "Requires copernicusmarine Python CLI and a free account.
1. Register at: https://marine.copernicus.eu/
2. Install: pip install copernicusmarine
3. Run:
   copernicusmarine get \\
     -i cmems_mod_glo_wav_anfc_0.083deg_PT3H-i \\
     -v VHM0 -v VTPK \\
     --output-directory ${RAW_CMW}/
4. Or download from: https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027"
    write_source_meta "copernicus_marine_waves" "cli_missing" "$RAW_CMW" "Install copernicusmarine CLI"
  fi
fi

log_ok "Water layer download step complete."
