from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_geometry(geometry: dict[str, Any] | None) -> str:
    if not geometry:
        return ""
    return sha256_text(json.dumps(geometry, sort_keys=True))


def hash_input_files(files: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for f in files:
        path = f.get("path")
        if path and Path(path).is_file():
            out.append(sha256_file(Path(path)))
        elif path:
            out.append(sha256_text(str(path)))
    return out


def cache_key(*parts: str) -> str:
    return sha256_text("|".join(parts))
