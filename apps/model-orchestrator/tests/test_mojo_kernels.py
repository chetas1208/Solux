from __future__ import annotations

import numpy as np

from app.core.mojo_runtime import MojoKernelRuntime, reset_mojo_runtime


def test_numpy_fallback_batch_scores() -> None:
    reset_mojo_runtime()
    rt = MojoKernelRuntime(enabled=True)
    rows = [{"a": 1.0, "b": 0.5}, {"a": -1.0, "b": 2.0}]
    weights = {"a": 0.3, "b": -0.2}
    scores = rt.batch_sigmoid_scores(rows, weights, bias=0.1)
    assert scores.shape == (2,)
    assert 0.0 <= scores[0] <= 1.0


def test_numpy_fallback_cosine() -> None:
    reset_mojo_runtime()
    rt = MojoKernelRuntime(enabled=True)
    query = np.array([1.0, 0.0])
    matrix = np.array([[1.0, 0.0], [0.0, 1.0]])
    sims = rt.cosine_similarity_rows(query, matrix)
    assert np.isclose(sims[0], 1.0)
    assert np.isclose(sims[1], 0.0)


def test_l2_normalize_rows() -> None:
    reset_mojo_runtime()
    rt = MojoKernelRuntime(enabled=True)
    m = np.array([[3.0, 4.0], [0.0, 0.0]])
    out = rt.l2_normalize_rows(m)
    assert np.isclose(np.linalg.norm(out[0]), 1.0)
    assert np.allclose(out[1], 0.0)


def test_status_reports_numpy_when_mojo_missing() -> None:
    reset_mojo_runtime()
    rt = MojoKernelRuntime(enabled=True)
    st = rt.status()
    assert st.enabled is True
    # Without mojo CLI in CI/dev, fallback is expected
    assert st.backend in ("mojo", "numpy")
