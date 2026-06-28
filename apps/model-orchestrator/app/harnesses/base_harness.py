from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseHarness(ABC):
    model_key: str

    @abstractmethod
    def validate_input(self, **kwargs: Any) -> None: ...

    @abstractmethod
    def run(self, **kwargs: Any) -> dict[str, Any]: ...
