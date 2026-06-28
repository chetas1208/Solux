from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import Settings
from app.core.errors import DependencyMissingError, InferenceNotImplementedError
from app.providers.base import BaseProvider


class RemoteClipProvider(BaseProvider):
    """RemoteCLIP image-text embedding provider."""

    def __init__(self, settings: Settings, local_path: str, model_key: str) -> None:
        super().__init__(local_path, model_key)
        self.settings = settings
        self.model_dir = Path(local_path)
        self._model = None
        self._processor = None

    def load(self, gpu_id: int | None = None) -> None:
        try:
            import torch
            from transformers import AutoModel, AutoProcessor
        except ImportError as exc:
            raise DependencyMissingError("transformers", "RemoteCLIP") from exc

        if not (self.model_dir / "config.json").exists():
            raise InferenceNotImplementedError(
                self.model_key,
                f"RemoteCLIP weights not found under {self.model_dir}",
            )

        device = "cpu"
        if gpu_id is not None and torch.cuda.is_available():
            device = f"cuda:{gpu_id}"

        self._processor = AutoProcessor.from_pretrained(str(self.model_dir), trust_remote_code=True)
        self._model = AutoModel.from_pretrained(str(self.model_dir), trust_remote_code=True)
        self._model.to(device)
        self._model.eval()
        self._gpu = gpu_id
        self._loaded = True

    def unload(self) -> None:
        self._model = None
        self._processor = None
        self._loaded = False

    def score(self, *, image_paths: list[str], prompt: str) -> list[dict[str, Any]]:
        if not self._loaded:
            raise InferenceNotImplementedError(self.model_key, "model not loaded")
        # Placeholder scoring: real RemoteCLIP integration requires model-specific preprocessing.
        return [
            {
                "path": p,
                "score": 0.0,
                "reason": "RemoteCLIP scoring requires model-specific preprocessing pipeline",
            }
            for p in image_paths
        ]
