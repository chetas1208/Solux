from __future__ import annotations

from pathlib import Path

from app.learning.feedback_store import FeedbackStore
from app.learning.online_ranker import OnlineRanker
from app.learning.preference_profiles import PreferenceProfileStore


def test_feedback_updates_ranker_and_profile(tmp_path: Path) -> None:
    profiles = PreferenceProfileStore(tmp_path / "profiles")
    ranker = OnlineRanker(tmp_path / "ranker")
    store = FeedbackStore(tmp_path / "feedback")

    profile = profiles.get("user-1")
    v1 = profile.apply_feedback({"feedbackType": "accept", "target": {"candidateId": "c1"}})
    assert v1.startswith("v")

    ranker.update({"slope": 5.0, "site_area": 1000.0}, "accept")
    assert ranker.version != "v0"

    store.append({"jobId": "j1", "feedbackType": "reject"})
    assert len(store.list_recent()) == 1
