from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class ModelPromotionRegistry:
    """Versioned promotion — offline training only, explicit alias switch."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.file = self.root / "promotions.json"

    def _load(self) -> dict[str, Any]:
        if self.file.exists():
            return json.loads(self.file.read_text(encoding="utf-8"))
        return {"production": {}, "candidates": []}

    def promote(
        self,
        *,
        model_key: str,
        version: str,
        metrics: dict[str, float],
        min_metric: float = 0.0,
    ) -> dict[str, Any]:
        primary = metrics.get("primary", metrics.get("f1", 0.0))
        if primary < min_metric:
            return {
                "status": "rejected",
                "reason": f"primary metric {primary} below threshold {min_metric}",
            }
        data = self._load()
        data["production"][model_key] = {
            "version": version,
            "metrics": metrics,
            "promotedAt": datetime.now(timezone.utc).isoformat(),
        }
        self.file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return {"status": "promoted", "modelKey": model_key, "version": version}
