from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np

logger = logging.getLogger(__name__)

Backend = Literal["mojo", "numpy"]


@dataclass(frozen=True)
class MojoKernelStatus:
    enabled: bool
    backend: Backend
    kernels_dir: str
    mojo_cli: bool
    module_loaded: bool
    message: str


def _kernels_dir() -> Path:
    root = Path(__file__).resolve().parents[2]
    return root / "modular" / "kernels"


def _mojo_cli_available() -> bool:
    from shutil import which

    if which("mojo") is not None:
        return True
    pixi_mojo = Path(__file__).resolve().parents[2] / ".pixi" / "envs" / "default" / "bin" / "mojo"
    return pixi_mojo.exists()


def _ensure_mojo_path() -> None:
    """Prefer project-local pixi Mojo toolchain when system mojo is missing."""
    from shutil import which

    if which("mojo") is not None:
        return
    root = Path(__file__).resolve().parents[2]
    pixi_bin = root / ".pixi" / "envs" / "default" / "bin"
    if (pixi_bin / "mojo").exists():
        import os

        os.environ["PATH"] = f"{pixi_bin}:{os.environ.get('PATH', '')}"


def _load_mojo_module(kernels_dir: Path) -> Any | None:
    _ensure_mojo_path()
    path_str = str(kernels_dir.resolve())
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

    # Prefer pre-built shared library (works from project venv without mojo.importer).
    shared = kernels_dir / "solux_kernels.so"
    if shared.exists():
        try:
            import importlib.util

            spec = importlib.util.spec_from_file_location("solux_kernels", shared)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                sys.modules["solux_kernels"] = module
                spec.loader.exec_module(module)
                module.mojo_status()
                return module
        except Exception as exc:
            logger.warning("Prebuilt Mojo .so load failed: %s", exc)

    if not _mojo_cli_available():
        return None

    try:
        import mojo.importer  # noqa: F401

        import solux_kernels

        solux_kernels.mojo_status()
        return solux_kernels
    except Exception as exc:
        logger.warning("Mojo kernels unavailable, using NumPy fallback: %s", exc)
        return None


# ---------------------------------------------------------------------------
# NumPy fallbacks (same semantics as modular/kernels/solux_kernels.mojo)
# ---------------------------------------------------------------------------


def _numpy_batch_sigmoid_scores(
    matrix: list[dict[str, Any]], weights: dict[str, float], bias: float
) -> np.ndarray:
    scores = np.empty(len(matrix), dtype=np.float64)
    for i, row in enumerate(matrix):
        logit = bias
        for key, w in weights.items():
            logit += w * float(row.get(key, 0.0))
        scores[i] = 1.0 / (1.0 + np.exp(-np.clip(logit, -20.0, 20.0)))
    return scores


def _numpy_batch_sigmoid_scores_matrix(
    matrix: np.ndarray, weight_vector: np.ndarray, bias: float
) -> np.ndarray:
    m = np.asarray(matrix, dtype=np.float64)
    w = np.asarray(weight_vector, dtype=np.float64).reshape(-1)
    logits = m @ w + bias
    return 1.0 / (1.0 + np.exp(-np.clip(logits, -20.0, 20.0)))


def _numpy_cosine_similarity_rows(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    q = np.asarray(query, dtype=np.float64).reshape(-1)
    m = np.asarray(matrix, dtype=np.float64)
    q_norm = np.linalg.norm(q)
    if q_norm == 0.0:
        return np.zeros(len(m), dtype=np.float64)
    m_norms = np.linalg.norm(m, axis=1)
    dots = m @ q
    denom = q_norm * m_norms
    with np.errstate(divide="ignore", invalid="ignore"):
        sims = np.divide(dots, denom, out=np.zeros_like(dots), where=denom > 0)
    return sims


def _numpy_l2_normalize_rows(matrix: np.ndarray) -> np.ndarray:
    m = np.asarray(matrix, dtype=np.float64)
    if m.size == 0:
        return m
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    return m / norms


class MojoKernelRuntime:
    """Unified access to Solux Mojo kernels with transparent NumPy fallback."""

    def __init__(self, *, enabled: bool = True, kernels_dir: Path | None = None) -> None:
        self.enabled = enabled
        self.kernels_dir = kernels_dir or _kernels_dir()
        self._module: Any | None = None
        self._backend: Backend = "numpy"
        if enabled:
            self._module = _load_mojo_module(self.kernels_dir)
            if self._module is not None:
                self._backend = "mojo"

    @property
    def backend(self) -> Backend:
        return self._backend

    def status(self) -> MojoKernelStatus:
        if not self.enabled:
            return MojoKernelStatus(
                enabled=False,
                backend="numpy",
                kernels_dir=str(self.kernels_dir),
                mojo_cli=_mojo_cli_available(),
                module_loaded=False,
                message="Mojo kernels disabled via config",
            )
        if self._module is not None:
            return MojoKernelStatus(
                enabled=True,
                backend="mojo",
                kernels_dir=str(self.kernels_dir),
                mojo_cli=True,
                module_loaded=True,
                message="Mojo extension module loaded",
            )
        msg = "NumPy fallback active"
        if not _mojo_cli_available():
            msg = "Install Mojo (scripts/setup-modular.sh) to enable native kernels"
        return MojoKernelStatus(
            enabled=True,
            backend="numpy",
            kernels_dir=str(self.kernels_dir),
            mojo_cli=_mojo_cli_available(),
            module_loaded=False,
            message=msg,
        )

    def batch_sigmoid_scores(
        self,
        matrix: list[dict[str, Any]],
        weights: dict[str, float],
        bias: float,
    ) -> np.ndarray:
        if self._module is not None:
            return np.asarray(
                self._module.batch_sigmoid_scores(matrix, weights, bias),
                dtype=np.float64,
            )
        return _numpy_batch_sigmoid_scores(matrix, weights, bias)

    def batch_sigmoid_scores_matrix(
        self,
        matrix: np.ndarray,
        weight_vector: np.ndarray,
        bias: float,
    ) -> np.ndarray:
        if self._module is not None:
            return np.asarray(
                self._module.batch_sigmoid_scores_matrix(matrix, weight_vector, bias),
                dtype=np.float64,
            )
        return _numpy_batch_sigmoid_scores_matrix(matrix, weight_vector, bias)

    def cosine_similarity_rows(self, query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
        if self._module is not None:
            return np.asarray(
                self._module.cosine_similarity_rows(query, matrix),
                dtype=np.float64,
            )
        return _numpy_cosine_similarity_rows(query, matrix)

    def l2_normalize_rows(self, matrix: np.ndarray) -> np.ndarray:
        if self._module is not None:
            return np.asarray(self._module.l2_normalize_rows(matrix), dtype=np.float64)
        return _numpy_l2_normalize_rows(matrix)


_runtime: MojoKernelRuntime | None = None


def get_mojo_runtime() -> MojoKernelRuntime:
    global _runtime
    if _runtime is None:
        from app.config import get_settings

        settings = get_settings()
        _runtime = MojoKernelRuntime(
            enabled=settings.mojo_kernels_enabled,
            kernels_dir=settings.mojo_kernels_dir,
        )
    return _runtime


def reset_mojo_runtime() -> None:
    global _runtime
    _runtime = None
