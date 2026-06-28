from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    cache = tmp_path / "cache"
    out = tmp_path / "outputs"
    cache.mkdir()
    out.mkdir()
    reg = {
        "generatedAt": "2026-01-01T00:00:00Z",
        "modelCacheDir": str(cache),
        "runtimePolicy": {"queueEnabled": True, "autoUnloadAfterSeconds": 600},
        "models": [],
    }
    reg_path = tmp_path / "registry.json"
    reg_path.write_text(json.dumps(reg), encoding="utf-8")

    settings = Settings(
        **{
            "MODEL_CACHE_DIR": str(cache),
            "SOLUX_OUTPUT_DIR": str(out),
            "REGISTRY_JSON": str(reg_path),
        }
    )
    monkeypatch.setattr("app.config.get_settings", lambda: settings)

    import app.core.model_manager as mm

    mm._manager = None
    monkeypatch.setattr(mm, "get_model_manager", lambda: mm.ModelManager(settings))

    app = create_app()
    return TestClient(app)


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "solux-model-orchestrator"
    assert "registryPath" in body


def test_models_list(client: TestClient) -> None:
    resp = client.get("/models")
    assert resp.status_code == 200
    assert "models" in resp.json()


def test_solar_farm_missing_input(client: TestClient) -> None:
    resp = client.post(
        "/infer/solar-farm",
        json={
            "model": "microsoft_grw_solar",
            "inputType": "geotiff_path",
            "outputFormat": "both",
        },
    )
    assert resp.status_code in (400, 404, 422)


def test_embed_eo_requires_model(client: TestClient, tmp_path: Path) -> None:
    clay = tmp_path / "cache" / "clay"
    clay.mkdir(parents=True)
    (clay / "config.json").write_text("{}", encoding="utf-8")

    resp = client.post(
        "/embed/eo",
        json={
            "model": "clay",
            "inputType": "metadata_only",
            "bands": ["red", "green", "blue"],
        },
    )
    assert resp.status_code in (404, 503, 500, 501)
