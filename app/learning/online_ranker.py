from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from app.core.mojo_runtime import get_mojo_runtime

LABEL_TO_WEIGHT = {
    "accept": 1.0,
    "reject": -1.0,
    "false_positive": -1.5,
    "false_negative": 1.5,
    "rating": 0.0,
    "edit": 0.5,
}


class OnlineRanker:
    """Incremental logistic-style ranker — real online updates, no fake training."""

    def __init__(self, root: Path, feature_names: list[str] | None = None) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.state_path = self.root / "online_ranker.json"
        self.feature_names = feature_names or []
        self._state = self._load()

    def _load(self) -> dict[str, Any]:
        if self.state_path.exists():
            return json.loads(self.state_path.read_text(encoding="utf-8"))
        return {
            "version": "v0",
            "weights": {},
            "bias": 0.0,
            "learningRate": 0.05,
            "updateCount": 0,
        }

    def save(self) -> str:
        ver = self._state.get("version", "v0")
        try:
            n = int(str(ver).lstrip("v")) + 1
        except ValueError:
            n = 1
        self._state["version"] = f"v{n}"
        self.state_path.write_text(json.dumps(self._state, indent=2), encoding="utf-8")
        return self._state["version"]

    @property
    def version(self) -> str:
        return self._state.get("version", "v0")

    def score(self, features: dict[str, float]) -> float:
        w = self._state.get("weights", {})
        s = float(self._state.get("bias", 0.0))
        for k, v in features.items():
            s += float(w.get(k, 0.0)) * float(v)
        return float(1.0 / (1.0 + np.exp(-np.clip(s, -20, 20))))

    def update(self, features: dict[str, float], label: str, rating: float | None = None) -> None:
        y = LABEL_TO_WEIGHT.get(label, 0.0)
        if label == "rating" and rating is not None:
            y = (float(rating) - 3.0) / 2.0
        pred = self.score(features)
        err = y - pred
        lr = float(self._state.get("learningRate", 0.05))
        weights = self._state.setdefault("weights", {})
        for k, v in features.items():
            weights[k] = float(weights.get(k, 0.0)) + lr * err * float(v)
        self._state["bias"] = float(self._state.get("bias", 0.0)) + lr * err
        self._state["updateCount"] = int(self._state.get("updateCount", 0)) + 1
        self.save()

    def rank_candidates(
        self, candidates: list[dict[str, Any]], feature_key: str = "features"
    ) -> list[dict[str, Any]]:
        if not candidates:
            return []

        weights = self._state.get("weights", {})
        bias = float(self._state.get("bias", 0.0))
        rows: list[dict[str, float]] = []
        for c in candidates:
            feats = c.get(feature_key, c.get("properties", {}))
            rows.append(
                {k: float(feats.get(k, 0)) for k in feats if isinstance(feats.get(k), (int, float))}
            )

        scores = get_mojo_runtime().batch_sigmoid_scores(rows, weights, bias)
        ranked = []
        for c, score in zip(candidates, scores):
            ranked.append({**c, "score": float(score), "model": "online_ranker"})
        ranked.sort(key=lambda x: x["score"], reverse=True)
        return ranked
