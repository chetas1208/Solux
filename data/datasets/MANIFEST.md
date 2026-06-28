# Dataset manifest — 2026-06-28

| Dataset | Local path | Size | Status |
|---------|------------|------|--------|
| US PVDB v4.0 | `uspvdb/` | ~27 MB | Downloaded (shapefile) |
| Global Solar Atlas GHI | `global-solar-atlas/GHI.tif` | ~2.6 GB | Downloaded (world GeoTIFF) |
| GEBCO bathymetry | `gebco/` | — | Not downloaded (use WMS fallback or regional download) |
| Copernicus Marine | `copernicus/` | — | Requires account — see README |

Source URLs:
- USPVDB: https://eerscmap.usgs.gov/uspvdb/assets/data/uspvdbSHP.zip
- GSA GHI: https://api.globalsolaratlas.info/download/World/World_GHI_GISdata_LTAy_AvgDailyTotals_GlobalSolarAtlas-v2_GEOTIFF.zip

Upload to Spaces (when keys valid): `ops/scripts/upload-datasets-to-spaces.sh`
