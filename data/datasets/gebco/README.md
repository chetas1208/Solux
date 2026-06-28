# GEBCO bathymetry

Full global GEBCO 2024 GeoTIFF is ~4 GB. Download a region via https://download.gebco.net/ or the full grid from:

https://www.bodc.ac.uk/data/open_download/gebco/gebco_2024_sub_ice_topo/geotiff/

Place `.tif` files in this directory.

Until local rasters are present, the API falls back to the public GEBCO WMS service for depth queries.

Downloaded: not yet (use WMS fallback).
