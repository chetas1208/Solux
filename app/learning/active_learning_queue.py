from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class ActiveLearningQueue:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.file = self.root / "active_queue.jsonl"

    def enqueue(
        self,
        *,
        job_id: str,
        reason: str,
        uncertainty: float,
        model_output: dict[str, Any],
        user_correction: dict[str, Any] | None = None,
    ) -> str:
        entry = {
            "id": str(uuid.uuid4()),
            "jobId": job_id,
            "reason": reason,
            "uncertaintyScore": uncertainty,
            "modelOutput": model_output,
            "userCorrection": user_correction,
            "recommendedAction": "human_review",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        with self.file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        return entry["id"]

    def list_pending(self, limit: int = 50) -> list[dict[str, Any]]:
        if not self.file.exists():
            return []
        items = []
        for line in self.file.read_text(encoding="utf-8").strip().splitlines():
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return items[-limit:]
