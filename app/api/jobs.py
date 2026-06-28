from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.core.storage import JobStorage

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
def get_job(job_id: str) -> dict:
    settings = get_settings()
    storage = JobStorage(settings.solux_output_dir, settings.data_dir)
    manifest = storage.load_manifest(job_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return manifest
