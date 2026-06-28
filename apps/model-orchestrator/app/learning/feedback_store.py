from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class FeedbackStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.file = self.root / "feedback.jsonl"

    def append(self, record: dict[str, Any]) -> str:
        record.setdefault("id", str(uuid.uuid4()))
        record.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        with self.file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
        return record["id"]

    def list_recent(self, limit: int = 100) -> list[dict[str, Any]]:
        if not self.file.exists():
            return []
        lines = self.file.read_text(encoding="utf-8").strip().splitlines()
        out = []
        for line in lines[-limit:]:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return out
