from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.disk import directory_is_populated, directory_size_bytes, human_size
from app.core.licenses import license_warnings


@dataclass
class ModelRegistryEntry:
    model_id: str
    local_path: Path
    source: str
    task: str
    category: str
    license_status: str
    downloaded_at: datetime | None
    required_for_mvp: bool
    downloaded: bool
    size_bytes: int
    sha256_file: str | None
    warnings: list[str] = field(default_factory=list)
    notes: str = ""

    @property
    def model_key(self) -> str:
        return self.model_id

    def refresh_disk_state(self) -> None:
        self.size_bytes = directory_size_bytes(self.local_path)
        self.downloaded = directory_is_populated(self.local_path)
        self.warnings = list(self.warnings) + license_warnings(
            self.license_status, self.model_id
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "modelId": self.model_id,
            "modelKey": self.model_key,
            "localPath": str(self.local_path),
            "source": self.source,
            "task": self.task,
            "category": self.category,
            "licenseStatus": self.license_status,
            "downloadedAt": self.downloaded_at.isoformat() if self.downloaded_at else None,
            "requiredForMVP": self.required_for_mvp,
            "downloaded": self.downloaded,
            "found": self.downloaded,
            "sizeBytes": self.size_bytes,
            "sizeHuman": human_size(self.size_bytes),
            "sha256File": self.sha256_file,
            "warnings": self.warnings,
            "notes": self.notes,
        }


@dataclass
class ModelRegistry:
    generated_at: datetime | None
    model_cache_dir: Path
    runtime_policy: dict[str, Any]
    models: list[ModelRegistryEntry]

    def get(self, model_key: str) -> ModelRegistryEntry | None:
        for entry in self.models:
            if entry.model_id == model_key:
                return entry
        return None

    def refresh_all(self) -> None:
        for entry in self.models:
            entry.refresh_disk_state()

    def to_dict(self) -> dict[str, Any]:
        return {
            "generatedAt": self.generated_at.isoformat() if self.generated_at else None,
            "modelCacheDir": str(self.model_cache_dir),
            "runtimePolicy": self.runtime_policy,
            "models": [m.to_dict() for m in self.models],
        }


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def load_registry(path: Path, cache_dir: Path | None = None) -> ModelRegistry:
    if not path.exists():
        return ModelRegistry(
            generated_at=None,
            model_cache_dir=cache_dir or Path("/data/models/solux"),
            runtime_policy={
                "default": "lazy_load_single_heavy_model_per_gpu",
                "gpu0": "solar_detection",
                "gpu1": "foundation_embedding_or_local_critic",
                "queueEnabled": True,
                "autoUnloadAfterSeconds": 600,
            },
            models=[],
        )

    raw = json.loads(path.read_text(encoding="utf-8"))
    entries: list[ModelRegistryEntry] = []
    for item in raw.get("models", []):
        entry = ModelRegistryEntry(
            model_id=item["modelId"],
            local_path=Path(item["localPath"]),
            source=item.get("source", "unknown"),
            task=item.get("task", ""),
            category=item.get("category", ""),
            license_status=item.get("licenseStatus", "unknown_warn_required"),
            downloaded_at=_parse_dt(item.get("downloadedAt")),
            required_for_mvp=bool(item.get("requiredForMVP", False)),
            downloaded=bool(item.get("downloaded", False)),
            size_bytes=int(item.get("sizeBytes", 0)),
            sha256_file=item.get("sha256File"),
            warnings=list(item.get("warnings", [])),
            notes=item.get("notes", ""),
        )
        entry.refresh_disk_state()
        entries.append(entry)

    registry = ModelRegistry(
        generated_at=_parse_dt(raw.get("generatedAt")),
        model_cache_dir=Path(raw.get("modelCacheDir", cache_dir or "/data/models/solux")),
        runtime_policy=raw.get("runtimePolicy", {}),
        models=entries,
    )
    return registry
