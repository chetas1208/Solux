from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_FEATURES = [
    "distance_to_transmission",
    "distance_to_road",
    "slope",
    "land_cover",
    "protected_area_overlap",
    "waterbody_type",
    "site_area",
    "solar_detection_confidence",
    "panel_detection_count",
    "embedding_similarity",
]


class PreferenceProfile:
    def __init__(self, root: Path, profile_id: str) -> None:
        self.path = root / f"{profile_id}.json"
        self.profile_id = profile_id
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def load(self) -> dict[str, Any]:
        if self.path.exists():
            return json.loads(self.path.read_text(encoding="utf-8"))
        return {
            "profileId": self.profile_id,
            "version": "v0",
            "preferredSiteSizeSqm": None,
            "preferredRegions": [],
            "preferredLandWaterType": [],
            "toleranceGridDistanceKm": 10.0,
            "toleranceSlopeDeg": 15.0,
            "preferRooftop": False,
            "preferUtility": True,
            "preferFloating": False,
            "acceptedCandidates": [],
            "rejectedCandidates": [],
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

    def save(self, data: dict[str, Any]) -> str:
        ver = data.get("version", "v0")
        try:
            n = int(str(ver).lstrip("v")) + 1
        except ValueError:
            n = 1
        data["version"] = f"v{n}"
        data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data["version"]

    def apply_feedback(self, feedback: dict[str, Any]) -> str:
        data = self.load()
        ftype = feedback.get("feedbackType", "")
        target = feedback.get("target", {})
        cid = target.get("candidateId") or target.get("featureId")
        if ftype == "accept" and cid:
            if cid not in data["acceptedCandidates"]:
                data["acceptedCandidates"].append(cid)
        elif ftype in ("reject", "false_positive") and cid:
            if cid not in data["rejectedCandidates"]:
                data["rejectedCandidates"].append(cid)
        return self.save(data)


class PreferenceProfileStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def get(self, profile_id: str) -> PreferenceProfile:
        return PreferenceProfile(self.root, profile_id)
