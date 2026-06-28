from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.core.errors import SoluxModelError
from app.core.model_manager import get_model_manager
from app.core.orchestrator import JobOrchestrator
from app.schemas_orchestrator import OrchestratorRequest

router = APIRouter(tags=["infer"])


def _orch() -> JobOrchestrator:
    return JobOrchestrator(get_settings(), get_model_manager())


@router.post("/infer")
def infer(request: OrchestratorRequest) -> dict:
    try:
        return _orch().execute(request.model_dump())
    except SoluxModelError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.to_dict()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


@router.post("/infer/utility-solar")
def infer_utility_solar(request: OrchestratorRequest) -> dict:
    payload = request.model_dump()
    payload["jobType"] = "utility_solar_detection"
    return _orch().execute(payload)


@router.post("/infer/rooftop-panel")
def infer_rooftop_panel(request: OrchestratorRequest) -> dict:
    payload = request.model_dump()
    payload["jobType"] = "rooftop_panel_detection"
    return _orch().execute(payload)


@router.post("/infer/fatal-flaw")
def infer_fatal_flaw(request: OrchestratorRequest) -> dict:
    payload = request.model_dump()
    payload["jobType"] = "fatal_flaw"
    return _orch().execute(payload)
