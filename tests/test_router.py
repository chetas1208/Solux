from __future__ import annotations

import pytest

from app.core.router import route_job


def test_route_utility_solar_fast() -> None:
    decision = route_job(
        job_type="utility_solar_detection",
        input_files=[{"type": "geotiff", "path": "/tmp/x.tif"}],
        latency_mode="fast",
        model_available={"microsoft_grw": True},
    )
    assert decision.models == ["microsoft_grw"]
    assert decision.gpu == 0


def test_route_fatal_flaw_no_models() -> None:
    decision = route_job(
        job_type="fatal_flaw",
        input_files=[],
        latency_mode="fast",
    )
    assert decision.models == []
    assert decision.pipeline == "fatal_flaw_screening"


def test_route_balanced_utility_parallel() -> None:
    decision = route_job(
        job_type="utility_solar_detection",
        input_files=[{"type": "geotiff", "path": "/tmp/x.tif"}],
        latency_mode="balanced",
        model_available={"microsoft_grw": True, "clay": True},
    )
    assert "microsoft_grw" in decision.models
    assert "clay" in decision.models
    assert decision.parallel_dual_gpu is True
    assert decision.model_gpu_map["microsoft_grw"] == 0
    assert decision.model_gpu_map["clay"] == 1


def test_route_deep_satlas_not_in_fast() -> None:
    decision = route_job(
        job_type="embedding",
        input_files=[],
        latency_mode="fast",
        model_available={"satlas": True, "clay": True},
    )
    assert "satlas" not in decision.models
