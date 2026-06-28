# Solux Data Pipeline

Curated, versioned USA + India solar site screening dataset.

## Quick start

```bash
# Install deps
cd ops/data-pipeline && pnpm install

# Check required tools
bash scripts/00_check_tools.sh

# Run full pipeline
DATA_ROOT=/data/solux \
COUNTRY_SCOPE=USA,INDIA \
RUN_REGION_SUBSET=true \       # true = fast subset, false = full countries
H3_RES_LAND=7 \
NREL_API_KEY=<your-key> \      # optional
DO_UPLOAD=false \
bash scripts/run_all.sh
```

## What it does

| Step | Script | Output |
|------|--------|--------|
| 00 | `check_tools.sh` | Tool availability report |
| 01 | `init_dirs.sh` | `$DATA_ROOT/` directory tree |
| 02 | `download_boundaries.sh` | geoBoundaries ADM0+ADM1 |
| 03 | `download_solar_assets.sh` | USPVDB, EIA-860, WRI GPPD, Kruitwagen, GRW, India AI |
| 04 | `download_solar_resource.sh` | PVGIS probe, NREL NSRDB probe |
| 05 | `download_landcover.sh` | ESA WorldCover 2021 tiles |
| 06 | `download_terrain.sh` | Copernicus DEM GLO-30 |
| 07 | `download_grid_roads.sh` | HIFLD lines, OSM power+roads |
| 08 | `download_water_layers.sh` | JRC GSW, HydroLAKES*, GRanD*, GEBCO* |
| 09 | `download_weather_atmosphere.sh` | NASA POWER probe points |
| 10 | `prepare_layers.sh` | OGR2OGR normalization |
| 11 | `generate_candidates.sh` | H3 candidate cells |
| 12 | `score_candidates.sh` | PVGIS + dimension scoring |
| 13 | `validate_dataset.sh` | QA checks, `quality_report.json` |
| 14 | `package_dataset.sh` | MBTiles/PMTiles, manifests |
| 15 | `upload_to_do_spaces.sh` | DO Spaces S3 sync |

`*` = manual download required — see notices in raw dir.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_ROOT` | `/data/solux` | Root for all pipeline data |
| `COUNTRY_SCOPE` | `USA,INDIA` | Comma-separated countries |
| `RUN_REGION_SUBSET` | `false` | `true` = fast subset for testing |
| `H3_RES_LAND` | `7` | H3 resolution for land cells (~5 km edge) |
| `H3_RES_WATER` | `7` | H3 resolution for water cells |
| `NREL_API_KEY` | — | NREL NSRDB key (optional) |
| `DO_UPLOAD` | `false` | Set `true` to upload to DO Spaces |
| `DIGITALOCEAN_SPACES_ENDPOINT` | — | e.g. `https://nyc3.digitaloceanspaces.com` |
| `DIGITALOCEAN_SPACES_BUCKET` | — | Bucket name |
| `DIGITALOCEAN_SPACES_KEY` | — | DO Spaces access key |
| `DIGITALOCEAN_SPACES_SECRET` | — | DO Spaces secret |
| `FORCE_DOWNLOAD` | `false` | Re-download even if file exists |

## Required tools

```
node ≥22, pnpm, tsx, curl, jq, unzip
duckdb, ogr2ogr, gdalinfo, gdalwarp, gdal_translate
```

Optional: `tippecanoe`, `pmtiles`, `aws`, `rclone`, `s5cmd`

## Manual downloads

Some sources require login / license acceptance. The pipeline creates
`MANUAL_DOWNLOAD_REQUIRED.md` files in those directories.

| Source | Why manual | Where to get |
|--------|-----------|--------------|
| Global Solar Atlas | No bulk API | https://globalsolaratlas.info |
| HydroLAKES | Registration | https://www.hydrosheds.org |
| GRanD | NASA Earthdata login | https://www.earthdata.nasa.gov |
| Copernicus Marine | CLI tool required | https://marine.copernicus.eu |
| NITI Aayog Energy Map | Restricted portal | https://ndp.nic.in |

## Data directory structure

```
$DATA_ROOT/
  raw/
    global/          # Multi-country sources
    usa/             # USA-specific
    india/           # India-specific
  staging/           # Intermediate converted files
  processed/
    boundaries/
    candidates/      # H3 cell parquet
    scoring/         # Scored sites parquet
    solar_assets/
    grid/
    access/
    water/
  tiles/             # MBTiles / PMTiles
  manifests/         # source_manifest.json, dataset_manifest.json, quality_report.json
  logs/              # Per-step logs
```

## Outputs

- `processed/candidates/solux_candidate_sites.parquet` — H3 cells with geometry
- `processed/scoring/solux_site_scores.parquet` — Scored sites with decision
- `processed/solux_data_catalog.json` — Machine-readable catalog for backend
- `manifests/dataset_manifest.json` — Full dataset manifest
- `manifests/quality_report.json` — QA report

## Score weights

| Dimension | Weight |
|-----------|--------|
| Solar Resource | 25% |
| Grid Connectivity | 20% |
| Buildability | 15% |
| Vegetation / Land Cover | 15% |
| Storage Proximity | 10% |
| Atmosphere | 5% |
| Power Loss | 5% |
| Water Access | 5% |

Decisions: **GO** ≥ 70, **INVESTIGATE** 45–69, **KILL** < 45.

## License

See `LICENSE_NOTES.md` for per-source attribution.
Dataset composition: CC BY 4.0 (geoBoundaries) + ODbL (OSM) + public domain (USPVDB, NASA) + free non-commercial (ESA, Copernicus, PVGIS).
