from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.core.model_manager import get_model_manager
from app.core.gpu_scheduler import DualGpuScheduler
from app.core.orchestrator import JobOrchestrator
from app.schemas_orchestrator import OrchestratorRequest

router = APIRouter(tags=["route"])


@router.post("/route")
def post_route(request: OrchestratorRequest) -> dict:
    orch = JobOrchestrator(get_settings(), get_model_manager())
    decision = orch.route(request.model_dump())
    return {
        "jobType": decision.job_type,
        "selectedPipeline": decision.pipeline,
        "selectedModels": decision.models,
        "latencyMode": decision.latency_mode,
        "gpu": decision.gpu,
        "modelGpuMap": decision.model_gpu_map,
        "parallelDualGpu": decision.parallel_dual_gpu,
        "gpuSchedule": DualGpuScheduler(get_settings()).describe(
            DualGpuScheduler(get_settings()).plan(decision.models)
        ),
        "useCritic": decision.use_critic,
        "useOnlineRanker": decision.use_online_ranker,
        "warnings": decision.warnings,
    }
