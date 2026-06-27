# Sample Data

This directory contains only real, publicly available sample files clearly marked as such.

## How to add real data

### PVGIS (free, no download needed)
PVGIS data is fetched live via REST API. No local files needed.

### NREL NSRDB (US only, requires API key)
Sign up at https://developer.nrel.gov/signup/ and set `NREL_API_KEY`.

### Global Solar Atlas (GHI raster)
1. Go to https://globalsolaratlas.info/download
2. Download GHI GeoTIFF for your region
3. Set `GLOBAL_SOLAR_ATLAS_DATA_DIR=/path/to/dir`

### GEBCO (bathymetry)
1. Go to https://www.gebco.net/data_and_products/gridded_bathymetry_data/
2. Download GEBCO_2024 netCDF or GeoTIFF
3. Set `GEBCO_DATA_DIR=/path/to/dir`

### US PVDB
1. Go to https://eerscmap.usgs.gov/uspvdb/
2. Download the shapefile
3. Set `USPVDB_DATA_DIR=/path/to/dir`

### OpenStreetMap (Overpass)
No download needed — live Overpass API queries.

### Copernicus Marine
1. Sign up at https://marine.copernicus.eu/
2. Install copernicusmarine Python client (CLI only — not in the app runtime)
3. Download relevant wave/current data to local GeoTIFF
4. Set `COPERNICUS_MARINE_CONFIG=/path/to/config`

## Test fixtures

Any tiny real sample files for unit tests go in `data/sample/` with a `.real-sample` suffix
and a header comment citing their exact source URL and download date.
