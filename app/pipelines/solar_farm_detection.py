from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import Settings
from app.core.model_manager import ModelManager
from app.utils.output_writer import write_job_manifest


def run_solar_farm_pipeline(
    manager: ModelManager,
    settings: Settings,
    *,
    geotiff_path: Path,
    output_format: str = "both",
    threshold: float | None = None,
    min_area_sqm: float | None = None,
    gpu: int | None = None,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    job_dir = settings.solux_output_dir / "solar-farm" / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    model_key = "microsoft_grw"

    provider = manager.ensure_loaded(model_key, gpu=gpu)
    load_seconds = 0.0

    input_meta: dict[str, Any] = {"path": str(geotiff_path)}
    try:
        from app.utils.geotiff import read_geotiff_metadata

        meta = read_geotiff_metadata(geotiff_path)
        input_meta.update(meta)
    except Exception as exc:
        warnings.append(f"Could not read GeoTIFF metadata: {exc}")

    import time

    started = time.perf_counter()
    outputs = provider.infer(
        geotiff_path=geotiff_path,
        output_dir=job_dir,
        threshold=threshold,
        min_area_sqm=min_area_sqm,
        output_format=output_format,
    )
    runtime = time.perf_counter() - started

    manifest = {
        "jobId": job_id,
        "modelId": model_key,
        "inputPath": str(geotiff_path),
        "outputPaths": outputs,
        "runtimeSeconds": runtime,
        "gpu": gpu if gpu is not None else settings.default_solar_gpu,
        "warnings": warnings,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    write_job_manifest(job_dir, manifest)

    return {
        "jobId": job_id,
        "model": "microsoft_grw_solar",
        "status": "completed",
        "input": input_meta,
        "outputs": {
            "predictionGeoTiff": outputs.get("predictionGeoTiff"),
            "geojson": outputs.get("geojson"),
            "previewPng": None,
        },
        "metrics": {
            "runtimeSeconds": round(runtime, 3),
            "gpu": gpu if gpu is not None else settings.default_solar_gpu,
            "modelLoadSeconds": load_seconds,
        },
        "warnings": warnings + ([outputs["geojsonWarning"]] if outputs.get("geojsonWarning") else []),
    }
