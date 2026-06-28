from __future__ import annotations

from typing import Any

from app.learning.feedback_store import FeedbackStore


def detect_drift(feedback_store: FeedbackStore) -> dict[str, Any]:
    recent = feedback_store.list_recent(500)
    if len(recent) < 10:
        return {"warnings": [], "sampleSize": len(recent)}

    reject_rate = sum(1 for r in recent if r.get("feedbackType") in ("reject", "false_positive")) / len(
        recent
    )
    warnings: list[str] = []
    if reject_rate > 0.4:
        warnings.append(f"High rejection rate: {reject_rate:.1%} over last {len(recent)} feedback events")
    return {
        "warnings": warnings,
        "sampleSize": len(recent),
        "rejectionRate": reject_rate,
        "modelDisagreement": False,
        "geographyDrift": False,
    }
