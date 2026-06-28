#!/usr/bin/env bash
# Create DATA_ROOT directory tree. Idempotent.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

log_info "Initializing data directories under: ${DATA_ROOT}"

dirs=(
  "${DATA_ROOT}/raw/global/geoboundaries"
  "${DATA_ROOT}/raw/global/global_solar_atlas"
  "${DATA_ROOT}/raw/global/esa_worldcover"
  "${DATA_ROOT}/raw/global/copernicus_dem"
  "${DATA_ROOT}/raw/global/osm"
  "${DATA_ROOT}/raw/global/jrc_surface_water"
  "${DATA_ROOT}/raw/global/hydrolakes"
  "${DATA_ROOT}/raw/global/grand"
  "${DATA_ROOT}/raw/global/gebco"
  "${DATA_ROOT}/raw/global/copernicus_marine_waves"
  "${DATA_ROOT}/raw/global/wri_gppd"
  "${DATA_ROOT}/raw/global/global_renewables_watch"
  "${DATA_ROOT}/raw/global/kruitwagen_pv_inventory"
  "${DATA_ROOT}/raw/global/nasa_power"
  "${DATA_ROOT}/raw/global/pvgis"
  "${DATA_ROOT}/raw/usa/uspvdb"
  "${DATA_ROOT}/raw/usa/eia860"
  "${DATA_ROOT}/raw/usa/eia923"
  "${DATA_ROOT}/raw/usa/nsrdb"
  "${DATA_ROOT}/raw/usa/hifld_transmission"
  "${DATA_ROOT}/raw/india/solar_locations_ai_dataset"
  "${DATA_ROOT}/raw/india/energy_map_reference"
  "${DATA_ROOT}/staging"
  "${DATA_ROOT}/processed/boundaries"
  "${DATA_ROOT}/processed/solar_assets"
  "${DATA_ROOT}/processed/solar_resource"
  "${DATA_ROOT}/processed/landcover"
  "${DATA_ROOT}/processed/terrain"
  "${DATA_ROOT}/processed/grid"
  "${DATA_ROOT}/processed/access"
  "${DATA_ROOT}/processed/water"
  "${DATA_ROOT}/processed/candidates"
  "${DATA_ROOT}/processed/scoring"
  "${DATA_ROOT}/tiles"
  "${DATA_ROOT}/manifests"
  "${DATA_ROOT}/reports"
  "${DATA_ROOT}/cache"
  "${DATA_ROOT}/logs"
)

for d in "${dirs[@]}"; do
  mkdir -p "$d"
  log_ok "  $d"
done

# Seed vegetation risk classes JSON if not present
VEG_JSON="${DATA_ROOT}/processed/landcover/vegetation_risk_classes.json"
if [[ ! -f "$VEG_JSON" ]]; then
  cat > "$VEG_JSON" << 'JSON'
{
  "source": "ESA WorldCover 2021 v200 — class definitions",
  "classes": [
    {"code": 10, "label": "Tree cover",       "risk": "HIGH",   "killThreshold": true,  "note": "Likely forest — high vegetation conflict"},
    {"code": 20, "label": "Shrubland",         "risk": "MEDIUM", "killThreshold": false, "note": "Check local regulation"},
    {"code": 30, "label": "Grassland",         "risk": "LOW",    "killThreshold": false},
    {"code": 40, "label": "Cropland",          "risk": "HIGH",   "killThreshold": true,  "note": "Active agriculture — permitting conflict likely"},
    {"code": 50, "label": "Built-up",          "risk": "KILL",   "killThreshold": true,  "note": "Developed land — not viable"},
    {"code": 60, "label": "Bare / sparse",     "risk": "LOW",    "killThreshold": false, "note": "Ideal for utility solar"},
    {"code": 70, "label": "Snow / ice",        "risk": "KILL",   "killThreshold": true,  "note": "Extreme weather / no solar"},
    {"code": 80, "label": "Permanent water",   "risk": "LOW",    "killThreshold": false, "note": "Floating solar candidate"},
    {"code": 90, "label": "Herbaceous wetland","risk": "HIGH",   "killThreshold": true,  "note": "Protected wetland likely"},
    {"code": 95, "label": "Mangroves",         "risk": "KILL",   "killThreshold": true,  "note": "Protected ecosystem"},
    {"code": 100,"label": "Moss / lichen",     "risk": "MEDIUM", "killThreshold": false}
  ],
  "generatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
}
JSON
  log_ok "Wrote vegetation risk classes JSON"
fi

# Score schema skeleton
SCORE_SCHEMA="${DATA_ROOT}/processed/scoring/score_schema.json"
if [[ ! -f "$SCORE_SCHEMA" ]]; then
  cat > "$SCORE_SCHEMA" << 'JSON'
{
  "version": "0.1.0",
  "dimensions": {
    "power_output_score":       {"weight": 0.25, "range": [0,100]},
    "vegetation_tradeoff_score":{"weight": 0.15, "range": [0,100]},
    "buildability_score":       {"weight": 0.15, "range": [0,100]},
    "grid_connectivity_score":  {"weight": 0.20, "range": [0,100]},
    "storage_feasibility_score":{"weight": 0.10, "range": [0,100]},
    "power_loss_score":         {"weight": 0.05, "range": [0,100]},
    "atmosphere_risk_score":    {"weight": 0.05, "range": [0,100]},
    "water_feasibility_score":  {"weight": 0.05, "range": [0,100], "waterSiteOnly": true}
  },
  "decisions": ["GO","INVESTIGATE","KILL"],
  "killTriggers": [
    "vegetation_fraction > 0.60 and landcover_majority in (10,40)",
    "slope_p95 > 15",
    "distance_to_transmission_km > 50 and grid_connectivity_score < 30",
    "landcover_majority == 50 (built-up)",
    "water_candidate and estimated_depth_m > 5",
    "water_candidate and wave_height_p95_m > 1.5",
    "pvout_kwh_kwp_year < 1000"
  ]
}
JSON
  log_ok "Wrote score schema"
fi

log_ok "Data directory initialization complete."
log_info "DATA_ROOT: ${DATA_ROOT}"
