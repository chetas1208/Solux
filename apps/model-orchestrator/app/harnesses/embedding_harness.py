from __future__ import annotations

from typing import Any

from app.core.model_manager import ModelManager
from app.harnesses.base_harness import BaseHarness
from app.pipelines.eo_embedding import run_eo_embedding_pipeline

EMBED_MODEL_MAP = {
    "clay": "clay",
    "prithvi_100m": "prithvi_100m",
    "prithvi_600m": "prithvi_600m",
    "satlas": "satlas",
    "terramind_base": "terramind_base",
    "dofa": "dofa",
    "remoteclip": "remoteclip",
}


class EmbeddingHarness(BaseHarness):
    def __init__(self, manager: ModelManager, model_key: str) -> None:
        self.manager = manager
        self.model_key = model_key

    def validate_input(self, **kwargs: Any) -> None:
        if not kwargs.get("path") and kwargs.get("input_type") != "metadata_only":
            raise ValueError("path required for embedding input")

    def run(self, **kwargs: Any) -> dict[str, Any]:
        api_model = EMBED_MODEL_MAP.get(self.model_key, self.model_key)
        return run_eo_embedding_pipeline(
            self.manager,
            kwargs["settings"],
            model=api_model,
            input_type=kwargs.get("input_type", "geotiff_path"),
            path=kwargs.get("path"),
            bands=kwargs.get("bands", ["red", "green", "blue", "nir"]),
            timestamp=kwargs.get("timestamp"),
            geometry=kwargs.get("geometry"),
            gpu=kwargs.get("gpu", 1),
        )
