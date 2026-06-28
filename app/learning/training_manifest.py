from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def write_training_manifest(root: Path, examples: list[dict[str, Any]], model_key: str) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    manifest = {
        "modelKey": model_key,
        "exampleCount": len(examples),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "examples": examples,
        "note": "Offline fine-tune/LoRA only — not executed during live inference",
    }
    path = root / f"training_manifest_{model_key}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.json"
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return path
