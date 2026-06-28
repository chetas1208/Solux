from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
def list_jobs() -> dict:
    return {
        "message": "Job listing not implemented. Inspect SOLUX_OUTPUT_DIR/*/manifest.json files.",
    }
