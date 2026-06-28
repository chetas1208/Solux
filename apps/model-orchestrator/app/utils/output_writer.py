from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_job_manifest(job_dir: Path, manifest: dict[str, Any]) -> Path:
    path = job_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return path
