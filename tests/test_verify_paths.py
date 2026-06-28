from __future__ import annotations

import json
import subprocess
from pathlib import Path


def test_verify_script_exits_nonzero_when_mvp_missing(tmp_path: Path) -> None:
    cache = tmp_path / "cache"
    cache.mkdir()
    registry = {
        "generatedAt": "2026-01-01T00:00:00Z",
        "modelCacheDir": str(cache),
        "runtimePolicy": {},
        "models": [
            {
                "modelId": "microsoft_grw",
                "localPath": str(cache / "missing-grw"),
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
            }
        ],
    }
    reg_path = tmp_path / "registry.json"
    reg_path.write_text(json.dumps(registry), encoding="utf-8")

    root = Path(__file__).resolve().parents[1]
    script = root / "ops" / "model-cache" / "verify-models.sh"
    result = subprocess.run(
        ["bash", str(script)],
        env={
            **dict(__import__("os").environ),
            "REGISTRY_JSON": str(reg_path),
            "MODEL_CACHE_DIR": str(cache),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "MISSING" in result.stdout or "missing" in result.stderr.lower()


def test_verify_script_passes_when_mvp_present(tmp_path: Path) -> None:
    cache = tmp_path / "cache"
    grw = cache / "microsoft" / "global-renewables-watch"
    geobase = cache / "geobase" / "solar-panel-detection"
    grw.mkdir(parents=True)
    geobase.mkdir(parents=True)
    (grw / "inference_solar.py").write_text("# ok", encoding="utf-8")
    (geobase / "model.onnx").write_bytes(b"onnx")

    registry = {
        "generatedAt": "2026-01-01T00:00:00Z",
        "modelCacheDir": str(cache),
        "runtimePolicy": {},
        "models": [
            {
                "modelId": "microsoft_grw",
                "localPath": str(grw),
                "requiredForMVP": True,
                "task": "solar_farm_detection",
                "licenseStatus": "mit_detected_or_warn_if_unknown",
                "warnings": [],
            },
            {
                "modelId": "geobase_solar_panel_detection",
                "localPath": str(geobase),
                "requiredForMVP": True,
                "task": "rooftop_or_panel_detection",
                "licenseStatus": "mit_detected_or_warn_if_unknown",
                "warnings": [],
            },
        ],
    }
    reg_path = tmp_path / "registry.json"
    reg_path.write_text(json.dumps(registry), encoding="utf-8")

    root = Path(__file__).resolve().parents[1]
    script = root / "ops" / "model-cache" / "verify-models.sh"
    result = subprocess.run(
        ["bash", str(script)],
        env={
            **dict(__import__("os").environ),
            "REGISTRY_JSON": str(reg_path),
            "MODEL_CACHE_DIR": str(cache),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "FOUND" in result.stdout
