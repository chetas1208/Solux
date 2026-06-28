from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseProvider(ABC):
    model_key: str

    def __init__(self, local_path: str, model_key: str) -> None:
        self.local_path = local_path
        self.model_key = model_key
        self._loaded = False
        self._gpu: int | None = None

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @abstractmethod
    def load(self, gpu_id: int | None = None) -> None:
        ...

    @abstractmethod
    def unload(self) -> None:
        ...

    def infer(self, **kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError
