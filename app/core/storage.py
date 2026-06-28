from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class JobStorage:
    def __init__(self, output_dir: Path, data_dir: Path) -> None:
        self.output_dir = output_dir
        self.data_dir = data_dir
        self.jobs_dir = data_dir / "jobs"
        self.manifests_dir = data_dir / "manifests"
        for d in (self.output_dir, self.jobs_dir, self.manifests_dir):
            d.mkdir(parents=True, exist_ok=True)

    def new_job_id(self) -> str:
        return str(uuid.uuid4())

    def job_output_dir(self, job_id: str, job_type: str) -> Path:
        path = self.output_dir / job_type / job_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def save_manifest(self, job_id: str, manifest: dict[str, Any]) -> Path:
        manifest.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        path = self.manifests_dir / f"{job_id}.json"
        path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        return path

    def load_manifest(self, job_id: str) -> dict[str, Any] | None:
        path = self.manifests_dir / f"{job_id}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def save_request(self, job_id: str, request: dict[str, Any]) -> Path:
        path = self.jobs_dir / f"{job_id}-request.json"
        path.write_text(json.dumps(request, indent=2), encoding="utf-8")
        return path
