from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.core.model_manager import get_model_manager
from app.learning.active_learning_queue import ActiveLearningQueue
from app.learning.feedback_store import FeedbackStore
from app.learning.online_ranker import OnlineRanker
from app.learning.preference_profiles import PreferenceProfileStore
from app.schemas_orchestrator import FeedbackRequest

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("")
def post_feedback(request: FeedbackRequest) -> dict:
    settings = get_settings()
    store = FeedbackStore(settings.learning_dir / "feedback")
    ranker = OnlineRanker(settings.learning_dir / "online_ranker")
    profiles = PreferenceProfileStore(settings.learning_dir / "profiles")
    queue = ActiveLearningQueue(settings.learning_dir / "active_queue")

    record = request.model_dump()
    store.append(record)

    profile_version = None
    pid = request.projectProfileId or request.userId
    if pid:
        profile_version = profiles.get(pid).apply_feedback(record)

    ranker_version = ranker.version
    if request.features:
        ranker.update(request.features, request.feedbackType, request.rating)
        ranker_version = ranker.version

    queued = False
    if request.feedbackType in ("reject", "false_positive", "false_negative"):
        queue.enqueue(
            job_id=request.jobId,
            reason=request.feedbackType,
            uncertainty=0.8,
            model_output={"target": request.target},
            user_correction={
                "geometry": request.correctedGeometry,
                "label": request.correctedLabel,
            },
        )
        queued = True

    return {
        "status": "stored",
        "updated": {
            "preferenceProfile": profile_version is not None,
            "onlineRanker": bool(request.features),
            "activeLearningQueue": queued,
        },
        "versions": {
            "profileVersion": profile_version or "v0",
            "onlineRankerVersion": ranker_version,
        },
    }
