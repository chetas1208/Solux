from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import Settings
from app.core.errors import DependencyMissingError, InferenceNotImplementedError
from app.providers.base import BaseProvider


class GeobaseOnnxProvider(BaseProvider):
    """geobase/solar-panel-detection ONNX provider."""

    def __init__(self, settings: Settings, local_path: str, model_key: str) -> None:
        super().__init__(local_path, model_key)
        self.settings = settings
        self.model_dir = Path(local_path)
        self._session = None
        self._onnx_path: Path | None = None

    def _find_onnx(self) -> Path | None:
        for path in sorted(self.model_dir.rglob("*.onnx")):
            return path
        return None

    def load(self, gpu_id: int | None = None) -> None:
        self._onnx_path = self._find_onnx()
        if self._onnx_path is None:
            raise InferenceNotImplementedError(
                self.model_key,
                f"No ONNX file found under {self.model_dir}",
            )
        try:
            import onnxruntime as ort
        except ImportError as exc:
            raise DependencyMissingError("onnxruntime", "geobase ONNX inference") from exc

        providers = ["CPUExecutionProvider"]
        if gpu_id is not None:
            if "CUDAExecutionProvider" in ort.get_available_providers():
                providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

        self._session = ort.InferenceSession(str(self._onnx_path), providers=providers)
        self._gpu = gpu_id
        self._loaded = True

    def unload(self) -> None:
        self._session = None
        self._loaded = False

    def infer(self, *, image_array: Any, **kwargs: Any) -> dict[str, Any]:
        if not self._loaded or self._session is None:
            raise InferenceNotImplementedError(self.model_key, "model not loaded")

        import numpy as np

        inputs = self._session.get_inputs()
        if not inputs:
            raise InferenceNotImplementedError(self.model_key, "ONNX model has no inputs")

        feed = {inputs[0].name: image_array.astype(np.float32)}
        outputs = self._session.run(None, feed)
        return {"rawOutputs": outputs, "onnxPath": str(self._onnx_path)}
