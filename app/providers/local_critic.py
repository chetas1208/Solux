from __future__ import annotations

from pathlib import Path

from app.config import Settings
from app.core.errors import InferenceNotImplementedError
from app.providers.base import BaseProvider


class LocalCriticProvider(BaseProvider):
    """Optional local LLM critic — intended for future Modular/MAX HTTP endpoint."""

    def __init__(self, settings: Settings, local_path: str, model_key: str) -> None:
        super().__init__(local_path, model_key)
        self.settings = settings
        self.model_dir = Path(local_path)

    def load(self, gpu_id: int | None = None) -> None:
        if not any(self.model_dir.glob("*.safetensors")) and not any(
            self.model_dir.glob("*.bin")
        ):
            raise InferenceNotImplementedError(
                self.model_key,
                f"No LLM weights found under {self.model_dir}. "
                "Set DOWNLOAD_LOCAL_LLM=true and re-run download-models.sh",
            )
        self._gpu = gpu_id
        self._loaded = True

    def unload(self) -> None:
        self._loaded = False

    def critique(self, *, prompt: str, context: str) -> str:
        if not self._loaded:
            raise InferenceNotImplementedError(
                self.model_key,
                "Local critic not loaded. Serve via Modular/MAX separately.",
            )
        return (
            "Local critic weights are cached but inference should be routed through "
            "a Modular/MAX OpenAI-compatible endpoint, not this sidecar directly."
        )
