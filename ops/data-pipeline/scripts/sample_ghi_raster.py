#!/usr/bin/env python3
"""Bulk-sample Global Solar Atlas GHI raster for candidate centroids."""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

from osgeo import gdal

gdal.UseExceptions()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--candidates", required=True, help="Candidate parquet path")
    p.add_argument("--ghi-raster", required=True, help="Global Solar Atlas GHI GeoTIFF")
    p.add_argument("--output", required=True, help="Output parquet with h3Index + ghi_kwh_m2_day")
    return p.parse_args()


def sample_ghi(raster: Path, candidates: Path, output: Path) -> None:
    import duckdb

    ds = gdal.Open(str(raster))
    if ds is None:
        sys.exit(f"[ERROR] Cannot open raster: {raster}")

    band = ds.GetRasterBand(1)
    nodata = band.GetNoDataValue()
    gt = ds.GetGeoTransform()
    width, height = ds.RasterXSize, ds.RasterYSize

    con = duckdb.connect()
    rows = con.execute(
        f"SELECT h3Index, centroid_lat, centroid_lon FROM read_parquet('{candidates}')"
    ).fetchall()

    print(f"[INFO] Sampling GHI for {len(rows)} candidates from {raster.name} …")

    # Group candidate indices by raster row for sequential row reads
    by_row: dict[int, list[tuple[int, str]]] = defaultdict(list)
    out: dict[str, float | None] = {h3: None for h3, _, _ in rows}

    for idx, (h3_index, lat, lon) in enumerate(rows):
        px = int((float(lon) - gt[0]) / gt[1])
        py = int((float(lat) - gt[3]) / gt[5])
        if 0 <= px < width and 0 <= py < height:
            by_row[py].append((px, h3_index))

    sampled = 0
    for row_y in sorted(by_row.keys()):
        row_data = band.ReadAsArray(0, row_y, width, 1)[0]
        for px, h3_index in by_row[row_y]:
            val = float(row_data[px])
            if nodata is not None and val == nodata:
                continue
            if val != val or val <= 0:
                continue
            out[h3_index] = val
            sampled += 1
        if row_y % 5000 == 0:
            print(f"[INFO]   scanned row {row_y}/{height} ({sampled} valid GHI so far)")

    results = [(h3, out[h3]) for h3, _, _ in rows]
    con.execute("CREATE TABLE ghi_lookup (h3Index VARCHAR, ghi_kwh_m2_day DOUBLE)")
    con.executemany("INSERT INTO ghi_lookup VALUES (?, ?)", results)
    con.execute(f"COPY ghi_lookup TO '{output}' (FORMAT PARQUET)")
    print(f"[OK] Wrote {output} — {sampled}/{len(rows)} cells with valid GHI")


def main() -> None:
    args = parse_args()
    sample_ghi(Path(args.ghi_raster), Path(args.candidates), Path(args.output))


if __name__ == "__main__":
    main()
