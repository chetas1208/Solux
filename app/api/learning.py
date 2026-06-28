from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.core.model_manager import get_model_manager
from app.learning.active_learning_queue import ActiveLearningQueue
from app.learning.drift_detection import detect_drift
from app.learning.feedback_store import FeedbackStore
from app.learning.model_promotion import ModelPromotionRegistry
from app.learning.preference_profiles import PreferenceProfileStore
from app.schemas_orchestrator import PromoteRequest

router = APIRouter(prefix="/learning", tags=["learning"])


@router.get("/profile/{profile_id}")
def get_profile(profile_id: str) -> dict:
    settings = get_settings()
    return PreferenceProfileStore(settings.learning_dir / "profiles").get(profile_id).load()


@router.get("/active-queue")
def get_active_queue() -> dict:
    settings = get_settings()
    items = ActiveLearningQueue(settings.learning_dir / "active_queue").list_pending()
    return {"items": items, "count": len(items)}


@router.get("/drift")
def get_drift() -> dict:
    settings = get_settings()
    return detect_drift(FeedbackStore(settings.learning_dir / "feedback"))


@router.post("/promote")
def promote_model(request: PromoteRequest) -> dict:
    settings = get_settings()
    reg = ModelPromotionRegistry(settings.learning_dir / "promotions")
    return reg.promote(
        model_key=request.modelKey,
        version=request.version,
        metrics=request.metrics,
        min_metric=request.minMetric,
    )
