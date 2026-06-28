from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class LatencyMode(str, Enum):
    FAST = "fast"
    BALANCED = "balanced"
    DEEP = "deep"


@dataclass(frozen=True)
class LatencyBudget:
    max_total_ms: int
    allow_foundation: bool
    allow_critic: bool
    max_embedding_models: int


BUDGETS: dict[LatencyMode, LatencyBudget] = {
    LatencyMode.FAST: LatencyBudget(
        max_total_ms=30_000,
        allow_foundation=False,
        allow_critic=False,
        max_embedding_models=0,
    ),
    LatencyMode.BALANCED: LatencyBudget(
        max_total_ms=120_000,
        allow_foundation=True,
        allow_critic=True,
        max_embedding_models=1,
    ),
    LatencyMode.DEEP: LatencyBudget(
        max_total_ms=600_000,
        allow_foundation=True,
        allow_critic=True,
        max_embedding_models=1,
    ),
}


def get_budget(mode: str) -> LatencyBudget:
    try:
        return BUDGETS[LatencyMode(mode)]
    except ValueError:
        return BUDGETS[LatencyMode.FAST]
