from __future__ import annotations

from pathlib import Path
from typing import Any


def read_geotiff_metadata(path: Path) -> dict[str, Any]:
    try:
        import rasterio
    except ImportError as exc:
        raise ImportError("rasterio is required for GeoTIFF metadata") from exc

    with rasterio.open(path) as ds:
        bounds = list(ds.bounds) if ds.bounds else None
        crs = ds.crs.to_string() if ds.crs else None
        return {
            "crs": crs,
            "bounds": bounds,
            "width": ds.width,
            "height": ds.height,
            "count": ds.count,
        }
