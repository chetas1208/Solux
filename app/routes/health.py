from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.core.model_manager import get_model_manager
from app.core.mojo_runtime import get_mojo_runtime
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


def _cuda_info() -> tuple[bool | None, int | None]:
    try:
        import torch

        return torch.cuda.is_available(), torch.cuda.device_count()
    except ImportError:
        return None, None


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    manager = get_model_manager()
    cuda_available, gpu_count = _cuda_info()
    warnings: list[str] = []
    missing = [
        m.model_id
        for m in manager.registry.models
        if m.required_for_mvp and not m.downloaded
    ]
    if missing:
        warnings.append(
            f"Required MVP models missing locally: {', '.join(missing)}. "
            "Run bash ops/model-cache/download-models.sh"
        )
    mojo = get_mojo_runtime().status()
    if mojo.enabled and mojo.backend == "numpy" and mojo.mojo_cli is False:
        warnings.append(mojo.message)
    return HealthResponse(
        registryPath=str(settings.registry_path),
        modelCacheDir=str(settings.model_cache_dir),
        cudaAvailable=cuda_available,
        gpuCount=gpu_count,
        loadedModels=manager.loaded_models(),
        gpuSchedule=manager.gpu_status(),
        dualGpuParallel=settings.dual_gpu_parallel,
        mojoKernels={
            "enabled": mojo.enabled,
            "backend": mojo.backend,
            "moduleLoaded": mojo.module_loaded,
            "mojoCli": mojo.mojo_cli,
            "kernelsDir": mojo.kernels_dir,
            "message": mojo.message,
        },
        warnings=warnings,
    )
