from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.feedback import router as feedback_router
from app.api.infer import router as infer_router
from app.api.jobs import router as jobs_router
from app.api.learning import router as learning_router
from app.api.route import router as route_router
from app.api import embed_router, health_router, models_router, rerank_router
from app.config import get_settings
from app.core.errors import SoluxModelError
from app.core.model_manager import get_model_manager

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Solux Model Orchestrator",
        description=(
            "Geospatial/solar model orchestration with routing, GPU scheduling, "
            "continual-learning feedback, and Modular/MAX local critic integration."
        ),
        version="0.2.0",
    )

    @app.exception_handler(SoluxModelError)
    async def solux_error_handler(_: Request, exc: SoluxModelError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.on_event("startup")
    async def startup() -> None:
        manager = get_model_manager()
        manager.reload_registry()
        if settings.preload_required_models:
            for entry in manager.registry.models:
                if entry.required_for_mvp and entry.downloaded:
                    try:
                        manager.load(entry.model_id)
                    except SoluxModelError as exc:
                        logger.warning("Preload failed for %s: %s", entry.model_id, exc.message)
        elif settings.dual_gpu_parallel:
            warmed = manager.preload_dual_gpu_mvp()
            for w in warmed:
                if w.get("status") == "skipped":
                    logger.warning("Dual-GPU warm skipped for %s: %s", w.get("modelKey"), w.get("error"))
                else:
                    logger.info("Dual-GPU warm: %s", w)

    app.include_router(health_router)
    app.include_router(models_router)
    app.include_router(route_router)
    app.include_router(infer_router)
    from app.routes.inference import router as legacy_infer_router

    app.include_router(legacy_infer_router)
    app.include_router(embed_router)
    app.include_router(rerank_router)
    app.include_router(feedback_router)
    app.include_router(learning_router)
    app.include_router(jobs_router)
    return app


app = create_app()
