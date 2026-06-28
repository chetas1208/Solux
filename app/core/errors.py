from __future__ import annotations

from typing import Any


class SoluxModelError(Exception):
    """Base error for model server operations."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        error_code: str = "model_error",
        details: dict[str, Any] | None = None,
        remediation: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        self.remediation = remediation

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "error": self.error_code,
            "message": self.message,
            "details": self.details,
        }
        if self.remediation:
            payload["remediation"] = self.remediation
        return payload


class ModelNotFoundError(SoluxModelError):
    def __init__(self, model_key: str, local_path: str) -> None:
        super().__init__(
            f"Model '{model_key}' is not available locally.",
            status_code=404,
            error_code="model_not_found",
            details={"modelKey": model_key, "localPath": local_path},
            remediation=(
                "Run: export MODEL_CACHE_DIR=/data/models/solux && "
                "bash ops/model-cache/download-models.sh"
            ),
        )


class ModelNotLoadedError(SoluxModelError):
    def __init__(self, model_key: str) -> None:
        super().__init__(
            f"Model '{model_key}' is registered but not loaded.",
            status_code=503,
            error_code="model_not_loaded",
            details={"modelKey": model_key},
            remediation=f"POST /models/{model_key}/load to load explicitly.",
        )


class DependencyMissingError(SoluxModelError):
    def __init__(self, package: str, feature: str) -> None:
        super().__init__(
            f"Optional dependency '{package}' is required for {feature}.",
            status_code=503,
            error_code="dependency_missing",
            details={"package": package, "feature": feature},
            remediation=f"Install with: uv sync --extra {package} or pip install {package}",
        )


class GpuOomError(SoluxModelError):
    def __init__(self, model_key: str, gpu: int | None) -> None:
        super().__init__(
            f"CUDA out of memory while running '{model_key}'.",
            status_code=503,
            error_code="cuda_oom",
            details={"modelKey": model_key, "gpu": gpu},
            remediation=(
                "Unload other models via POST /models/{model_key}/unload "
                "or reduce batch/tile size."
            ),
        )


class InferenceNotImplementedError(SoluxModelError):
    def __init__(self, model_key: str, reason: str) -> None:
        super().__init__(
            f"Inference for '{model_key}' is not available: {reason}",
            status_code=501,
            error_code="inference_not_implemented",
            details={"modelKey": model_key, "reason": reason},
        )
