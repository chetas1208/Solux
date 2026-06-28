from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.errors import SoluxModelError
from app.core.model_manager import get_model_manager
from app.schemas import LoadUnloadResponse, ModelSummary, ModelsListResponse

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=ModelsListResponse)
def list_models() -> ModelsListResponse:
    manager = get_model_manager()
    manager.reload_registry()
    missing_required = [
        m.model_id for m in manager.registry.models if m.required_for_mvp and not m.downloaded
    ]
    models = [
        ModelSummary(
            modelId=m.model_id,
            modelKey=m.model_id,
            found=m.downloaded,
            downloaded=m.downloaded,
            localPath=str(m.local_path),
            sizeBytes=m.size_bytes,
            sizeHuman=m.to_dict()["sizeHuman"],
            requiredForMVP=m.required_for_mvp,
            task=m.task,
            category=m.category,
            licenseStatus=m.license_status,
            warnings=m.warnings,
        )
        for m in manager.registry.models
    ]
    return ModelsListResponse(
        modelCacheDir=str(manager.registry.model_cache_dir),
        models=models,
        missingRequired=missing_required,
    )


@router.get("/{model_key}")
def get_model(model_key: str) -> dict:
    manager = get_model_manager()
    entry = manager.registry.get(model_key)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Unknown model key: {model_key}")
    entry.refresh_disk_state()
    loaded = manager.loaded_models().get(model_key)
    payload = entry.to_dict()
    payload["loaded"] = loaded is not None
    payload["loadInfo"] = loaded
    return payload


@router.post("/{model_key}/load", response_model=LoadUnloadResponse)
def load_model(model_key: str, gpu: int | None = None) -> LoadUnloadResponse:
    manager = get_model_manager()
    try:
        result = manager.load(model_key, gpu=gpu)
    except SoluxModelError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.to_dict()) from exc
    return LoadUnloadResponse(**result)


@router.post("/{model_key}/unload", response_model=LoadUnloadResponse)
def unload_model(model_key: str) -> LoadUnloadResponse:
    manager = get_model_manager()
    result = manager.unload(model_key)
    return LoadUnloadResponse(modelKey=result["modelKey"], status=result["status"])
