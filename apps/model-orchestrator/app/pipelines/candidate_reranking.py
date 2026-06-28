from __future__ import annotations

import uuid
from typing import Any

import numpy as np

from app.config import Settings
from app.core.model_manager import ModelManager
from app.core.mojo_runtime import get_mojo_runtime


def run_candidate_reranking_pipeline(
    manager: ModelManager,
    settings: Settings,
    *,
    candidate_geojson: dict[str, Any],
    tile_image_paths: list[str],
    method: str,
    prompt: str | None,
    gpu: int | None = None,
    query_embedding: list[float] | None = None,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    warnings: list[str] = [
        "Candidate reranking is experimental. Original detections are never deleted."
    ]

    features = candidate_geojson.get("features", [])
    ranked: list[dict[str, Any]] = []

    if method == "rules":
        for idx, feat in enumerate(features):
            fid = str(feat.get("id") or feat.get("properties", {}).get("id") or idx)
            ranked.append(
                {
                    "featureId": fid,
                    "score": float(len(features) - idx),
                    "reason": "Rule-based preserve-order ranking (placeholder)",
                    "model": "rules",
                }
            )
    elif method == "cosine":
        if not query_embedding:
            raise ValueError("queryEmbedding is required for cosine reranking")
        query = np.asarray(query_embedding, dtype=np.float64)
        matrix = np.asarray(
            [f.get("embedding", f.get("properties", {}).get("embedding", [])) for f in features],
            dtype=np.float64,
        )
        if matrix.ndim != 2 or matrix.shape[0] != len(features):
            raise ValueError("Each candidate feature must include an embedding vector")
        sims = get_mojo_runtime().cosine_similarity_rows(query, matrix)
        backend = get_mojo_runtime().backend
        for idx, feat in enumerate(features):
            fid = str(feat.get("id") or idx)
            ranked.append(
                {
                    "featureId": fid,
                    "score": float(sims[idx]),
                    "reason": "Mojo cosine similarity kernel",
                    "model": f"cosine_{backend}",
                }
            )
    elif method == "remoteclip":
        provider = manager.ensure_loaded("remoteclip", gpu=gpu or settings.default_foundation_gpu)
        scores = provider.score(image_paths=tile_image_paths, prompt=prompt or "solar panel")
        for idx, feat in enumerate(features):
            fid = str(feat.get("id") or idx)
            score_row = scores[idx] if idx < len(scores) else {"score": 0.0, "reason": "no tile"}
            ranked.append(
                {
                    "featureId": fid,
                    "score": float(score_row.get("score", 0.0)),
                    "reason": str(score_row.get("reason", "")),
                    "model": "remoteclip",
                }
            )
        warnings.append("RemoteCLIP license unknown — verify before commercial use.")
    elif method == "local_critic":
        provider = manager.ensure_loaded("local_critic", gpu=gpu or settings.default_foundation_gpu)
        critique = provider.critique(prompt=prompt or "Rank solar candidates", context=str(features))
        for idx, feat in enumerate(features):
            fid = str(feat.get("id") or idx)
            ranked.append(
                {
                    "featureId": fid,
                    "score": 0.0,
                    "reason": critique,
                    "model": "local_critic",
                }
            )
        warnings.append("Route local critic inference through Modular/MAX for production use.")
    else:
        raise ValueError(f"Unknown rerank method: {method}")

    ranked.sort(key=lambda x: x["score"], reverse=True)

    return {
        "jobId": job_id,
        "rankedCandidates": ranked,
        "warnings": warnings,
    }
