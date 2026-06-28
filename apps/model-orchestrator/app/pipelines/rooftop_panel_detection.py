from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import Settings
from app.core.model_manager import ModelManager
from app.utils.geojson import empty_feature_collection
from app.utils.output_writer import write_job_manifest


def run_rooftop_panel_pipeline(
    manager: ModelManager,
    settings: Settings,
    *,
    geometry: dict[str, Any],
    tile_size: int = 512,
    zoom: int | None = None,
    gpu: int | None = None,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    job_dir = settings.solux_output_dir / "solar-panel" / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    model_key = "geobase_solar_panel_detection"

    provider = manager.ensure_loaded(model_key, gpu=gpu)

    import time

    started = time.perf_counter()

    detections = empty_feature_collection()
    try:
        import numpy as np

        dummy = np.zeros((1, 3, tile_size, tile_size), dtype=np.float32)
        raw = provider.infer(image_array=dummy)
        warnings.append(
            "Geobase ONNX session loaded; full tile fetch + postprocessing pipeline "
            "requires imagery source integration. Returning empty detections."
        )
        _ = raw
    except Exception as exc:
        warnings.append(str(exc))

    runtime = time.perf_counter() - started
    if zoom is not None:
        warnings.append(f"zoom={zoom} accepted but imagery fetch not implemented in sidecar")

    manifest = {
        "jobId": job_id,
        "modelId": model_key,
        "inputGeometry": geometry,
        "outputPaths": {"geojson": str(job_dir / "detections.geojson")},
        "runtimeSeconds": runtime,
        "gpu": gpu,
        "warnings": warnings,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    out_path = job_dir / "detections.geojson"
    out_path.write_text(__import__("json").dumps(detections, indent=2), encoding="utf-8")
    write_job_manifest(job_dir, manifest)

    return {
        "jobId": job_id,
        "model": "geobase_solar_panel_detection",
        "status": "completed",
        "detections": detections,
        "metrics": {
            "runtimeSeconds": round(runtime, 3),
            "numDetections": len(detections.get("features", [])),
            "gpu": gpu,
        },
        "warnings": warnings,
    }
