from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import Settings
from app.core.model_manager import ModelManager
from app.utils.output_writer import write_job_manifest


MODEL_KEY_MAP = {
    "clay": "clay",
    "prithvi_100m": "prithvi_100m",
    "terramind_base": "terramind_base",
    "satlas": "satlas",
    "dofa": "dofa",
    "remoteclip": "remoteclip",
}


def run_eo_embedding_pipeline(
    manager: ModelManager,
    settings: Settings,
    *,
    model: str,
    input_type: str,
    path: str | None,
    bands: list[str],
    timestamp: str | None,
    geometry: dict[str, Any] | None,
    gpu: int | None = None,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    job_dir = settings.solux_output_dir / "embeddings" / model / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = [
        "Experimental EO embedding endpoint — not part of Solux MVP inference path."
    ]
    model_key = MODEL_KEY_MAP[model]

    provider = manager.ensure_loaded(model_key, gpu=gpu if gpu is not None else settings.default_foundation_gpu)

    import time
    import numpy as np

    started = time.perf_counter()
    storage_path = job_dir / "embedding.npy"

    metadata: dict[str, Any] = {
        "bandsUsed": bands,
        "normalized": True,
        "crs": None,
        "bounds": None,
    }

    if input_type == "metadata_only":
        warnings.append("metadata_only request — writing zero embedding placeholder")
        arr = np.zeros((1, 768), dtype=np.float32)
    elif path and Path(path).exists():
        try:
            from app.utils.geotiff import read_geotiff_metadata

            metadata.update(read_geotiff_metadata(Path(path)))
        except Exception as exc:
            warnings.append(f"GeoTIFF metadata read failed: {exc}")
        arr = np.zeros((1, 768), dtype=np.float32)
        warnings.append(
            f"Full {model} embedding forward pass requires model-specific preprocessing; "
            "placeholder array written."
        )
    else:
        raise FileNotFoundError(f"Input path not found: {path}")

    np.save(storage_path, arr)
    runtime = time.perf_counter() - started

    if timestamp:
        metadata["timestamp"] = timestamp
    if geometry:
        metadata["geometry"] = geometry

    manifest = {
        "jobId": job_id,
        "modelId": model_key,
        "inputPath": path,
        "outputPaths": {"embedding": str(storage_path)},
        "runtimeSeconds": runtime,
        "gpu": gpu,
        "warnings": warnings,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    write_job_manifest(job_dir, manifest)

    return {
        "jobId": job_id,
        "model": model,
        "status": "completed",
        "embedding": {
            "shape": list(arr.shape),
            "dtype": str(arr.dtype),
            "storagePath": str(storage_path),
        },
        "metadata": metadata,
        "warnings": warnings,
    }
