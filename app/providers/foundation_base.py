from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import Settings
from app.core.errors import DependencyMissingError, InferenceNotImplementedError
from app.providers.base import BaseProvider


class FoundationProvider(BaseProvider):
    """Shared lazy-load pattern for foundation/embedding models."""

    hf_model_name: str = ""

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
            raise DependencyMissingError("transformers", f"{self.model_key} embeddings") from exc

        if not (self.model_dir / "config.json").exists():
            raise InferenceNotImplementedError(
                self.model_key,
                f"No config.json under {self.model_dir}",
            )

        device = "cpu"
        if gpu_id is not None:
            if torch.cuda.is_available():
                device = f"cuda:{gpu_id}"

        self._processor = AutoProcessor.from_pretrained(
            str(self.model_dir), trust_remote_code=True
        )
        self._model = AutoModel.from_pretrained(str(self.model_dir), trust_remote_code=True)
        self._model.to(device)
        self._model.eval()
        self._gpu = gpu_id
        self._loaded = True

    def unload(self) -> None:
        self._model = None
        self._processor = None
        self._loaded = False
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass

    def embed(self, *, tensor: Any) -> Any:
        if not self._loaded or self._model is None:
            raise InferenceNotImplementedError(self.model_key, "model not loaded")
        import torch

        with torch.no_grad():
            outputs = self._model(tensor)
            if hasattr(outputs, "last_hidden_state"):
                return outputs.last_hidden_state
            if isinstance(outputs, (tuple, list)):
                return outputs[0]
            return outputs
