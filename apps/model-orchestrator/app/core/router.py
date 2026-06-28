from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.core.latency_budget import LatencyBudget, get_budget


@dataclass
class RouteDecision:
    job_type: str
    pipeline: str
    models: list[str]
    latency_mode: str
    gpu: int | None
    use_critic: bool
    use_online_ranker: bool
    warnings: list[str] = field(default_factory=list)
    explicit_model: str | None = None
    model_gpu_map: dict[str, int] = field(default_factory=dict)
    parallel_dual_gpu: bool = True


DEEP_ONLY_MODELS = {"satlas", "prithvi_600m", "dofa", "terramind_base"}


def _has_geotiff(inputs: list[dict[str, Any]]) -> bool:
    return any(i.get("type") in ("geotiff", "cog") for i in inputs)


def _has_tile_or_polygon(inputs: list[dict[str, Any]], geometry: dict | None, bbox: list | None) -> bool:
    if geometry or bbox:
        return True
    return any(i.get("type") in ("image_tile", "geojson") for i in inputs)


def route_job(
    *,
    job_type: str,
    input_files: list[dict[str, Any]],
    latency_mode: str = "fast",
    geometry: dict[str, Any] | None = None,
    bbox: list[float] | None = None,
    requested_model: str | None = None,
    model_available: dict[str, bool] | None = None,
    personalization_enabled: bool = True,
) -> RouteDecision:
    budget: LatencyBudget = get_budget(latency_mode)
    available = model_available or {}
    warnings: list[str] = []
    models: list[str] = []
    pipeline = job_type
    gpu: int | None = 0
    use_critic = budget.allow_critic
    use_ranker = personalization_enabled

    if requested_model:
        if not available.get(requested_model, False):
            raise ValueError(
                f"Requested model '{requested_model}' unavailable. "
                f"Run: bash ops/model-cache/verify-models.sh"
            )
        return RouteDecision(
            job_type=job_type,
            pipeline=pipeline,
            models=[requested_model],
            latency_mode=latency_mode,
            gpu=1 if requested_model in DEEP_ONLY_MODELS or requested_model == "local_critic" else 0,
            use_critic=False,
            use_online_ranker=use_ranker,
            explicit_model=requested_model,
        )

    if job_type == "fatal_flaw":
        pipeline = "fatal_flaw_screening"
        models = []
        use_critic = budget.allow_critic

    elif job_type == "utility_solar_detection":
        pipeline = "utility_solar_detection"
        if _has_geotiff(input_files) and available.get("microsoft_grw", False):
            models = ["microsoft_grw"]
            gpu = 0
            # Balanced/deep: run site embedding on GPU 1 in parallel with detection on GPU 0
            if latency_mode in ("balanced", "deep") and budget.allow_foundation:
                if available.get("clay", False):
                    models.append("clay")
                elif available.get("prithvi_100m", False):
                    models.append("prithvi_100m")
        else:
            warnings.append("No GeoTIFF input or microsoft_grw unavailable")

    elif job_type == "rooftop_panel_detection":
        pipeline = "rooftop_panel_detection"
        if available.get("geobase_solar_panel_detection", False):
            models = ["geobase_solar_panel_detection"]
            gpu = 0
        else:
            warnings.append("geobase_solar_panel_detection unavailable")

    elif job_type in ("floating_solar", "canal_solar", "reservoir_solar"):
        pipeline = f"{job_type}_screening"
        models = []
        if _has_geotiff(input_files) and available.get("microsoft_grw", False):
            if latency_mode != "fast":
                models.append("microsoft_grw")
        if budget.allow_foundation and latency_mode == "deep":
            if available.get("clay", False):
                models.append("clay")
                gpu = 1

    elif job_type == "embedding":
        pipeline = "eo_embedding"
        if latency_mode == "fast" and available.get("clay", False):
            models = ["clay"]
        elif latency_mode == "balanced":
            if available.get("clay", False):
                models = ["clay"]
            elif available.get("prithvi_100m", False):
                models = ["prithvi_100m"]
        elif latency_mode == "deep":
            for mid in ("clay", "prithvi_100m", "terramind_base", "remoteclip"):
                if available.get(mid, False):
                    models = [mid]
                    break
            if available.get("satlas", False) and not models:
                models = ["satlas"]
                warnings.append("satlas is 72G — loading only in explicit deep mode")
        gpu = 1

    elif job_type == "rerank":
        pipeline = "candidate_reranking"
        use_ranker = True
        if latency_mode == "fast":
            models = []
        elif latency_mode == "balanced" and available.get("remoteclip", False):
            models = ["remoteclip"]
            gpu = 1
        elif latency_mode == "deep":
            if available.get("remoteclip", False):
                models.append("remoteclip")
            use_critic = budget.allow_critic
        gpu = 1 if models else None

    elif job_type == "report":
        pipeline = "report_generation"
        use_critic = budget.allow_critic
        models = ["local_critic"] if use_critic and available.get("local_critic", False) else []

    else:
        raise ValueError(f"Unknown jobType: {job_type}")

    for mid in models:
        if mid in DEEP_ONLY_MODELS and latency_mode == "fast":
            warnings.append(f"{mid} skipped in fast mode")
            models = [m for m in models if m not in DEEP_ONLY_MODELS]

    from app.core.gpu_scheduler import DualGpuScheduler, SOLAR_MODELS as SM, FOUNDATION_MODELS as FM

    gpu_map: dict[str, int] = {}
    for mid in models:
        if mid in SM:
            gpu_map[mid] = 0
        elif mid in FM:
            gpu_map[mid] = 1
        else:
            gpu_map[mid] = gpu if gpu is not None else 0

    parallel = len(set(gpu_map.values())) > 1 and len(models) > 1

    return RouteDecision(
        job_type=job_type,
        pipeline=pipeline,
        models=models,
        latency_mode=latency_mode,
        gpu=gpu,
        use_critic=use_critic,
        use_online_ranker=use_ranker,
        warnings=warnings,
        model_gpu_map=gpu_map,
        parallel_dual_gpu=parallel,
    )
