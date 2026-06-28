from __future__ import annotations

from typing import Any


def normalize_band_names(bands: list[str]) -> list[str]:
    return [b.strip().lower() for b in bands]


def normalize_reflectance(arr: Any, scale: float = 10000.0) -> Any:
    return arr / scale
