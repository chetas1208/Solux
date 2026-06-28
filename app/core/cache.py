from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from app.utils.hashing import cache_key


class ResultCache:
    """Disk cache for model outputs keyed by input/model/profile versions."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    def get(
        self,
        *,
        file_hashes: list[str],
        geometry_hash: str,
        model_id: str,
        model_version: str,
        config_hash: str,
        latency_mode: str,
        profile_version: str,
        ranker_version: str,
    ) -> dict[str, Any] | None:
        key = cache_key(
            ",".join(file_hashes),
            geometry_hash,
            model_id,
            model_version,
            config_hash,
            latency_mode,
            profile_version,
            ranker_version,
        )
        path = self._path(key)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def put(self, key: str, payload: dict[str, Any]) -> Path:
        path = self._path(key)
        payload = {**payload, "cachedAt": time.time()}
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def make_key(
        self,
        *,
        file_hashes: list[str],
        geometry_hash: str,
        model_id: str,
        model_version: str,
        config_hash: str,
        latency_mode: str,
        profile_version: str,
        ranker_version: str,
    ) -> str:
        return cache_key(
            ",".join(file_hashes),
            geometry_hash,
            model_id,
            model_version,
            config_hash,
            latency_mode,
            profile_version,
            ranker_version,
        )
