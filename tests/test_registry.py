from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.model_registry import load_registry


@pytest.fixture
def sample_registry(tmp_path: Path) -> Path:
    cache = tmp_path / "models"
    mvp_path = cache / "microsoft" / "global-renewables-watch"
    mvp_path.mkdir(parents=True)
    (mvp_path / "inference_solar.py").write_text("# stub", encoding="utf-8")

    registry = {
        "generatedAt": "2026-01-01T00:00:00Z",
        "modelCacheDir": str(cache),
        "runtimePolicy": {"queueEnabled": True},
        "models": [
            {
                "modelId": "microsoft_grw",
                "localPath": str(mvp_path),
                "source": "github",
                "task": "solar_farm_detection",
                "category": "utility_scale_solar_detection",
                "licenseStatus": "mit_detected_or_warn_if_unknown",
                "downloadedAt": None,
                "requiredForMVP": True,
                "downloaded": False,
                "sizeBytes": 0,
                "sha256File": None,
                "warnings": [],
                "notes": "",
            },
            {
                "modelId": "clay",
                "localPath": str(cache / "made-with-clay" / "Clay"),
                "source": "huggingface",
                "task": "earth_observation_embedding",
                "category": "eo_foundation_backbone",
                "licenseStatus": "apache_2_detected_or_warn_if_unknown",
                "downloadedAt": None,
                "requiredForMVP": False,
                "downloaded": False,
                "sizeBytes": 0,
                "sha256File": None,
                "warnings": [],
                "notes": "",
            },
        ],
    }
    path = tmp_path / "registry.json"
    path.write_text(json.dumps(registry), encoding="utf-8")
    return path


def test_registry_refresh_marks_found(sample_registry: Path) -> None:
    reg = load_registry(sample_registry)
    reg.refresh_all()
    grw = reg.get("microsoft_grw")
    clay = reg.get("clay")
    assert grw is not None
    assert clay is not None
    assert grw.downloaded is True
    assert grw.size_bytes > 0
    assert clay.downloaded is False


def test_registry_to_dict(sample_registry: Path) -> None:
    reg = load_registry(sample_registry)
    payload = reg.to_dict()
    assert payload["modelCacheDir"]
    assert len(payload["models"]) == 2
