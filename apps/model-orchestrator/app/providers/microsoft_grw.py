from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

from app.config import Settings
from app.core.errors import DependencyMissingError, InferenceNotImplementedError
from app.providers.base import BaseProvider


class MicrosoftGrwProvider(BaseProvider):
    """Microsoft Global Renewables Watch solar farm detection."""

    def __init__(self, settings: Settings, local_path: str, model_key: str) -> None:
        super().__init__(local_path, model_key)
        self.settings = settings
        self.repo_path = Path(local_path)
        self._process_env: dict[str, str] | None = None

    def load(self, gpu_id: int | None = None) -> None:
        if not (self.repo_path / "inference_solar.py").exists():
            raise InferenceNotImplementedError(
                self.model_key,
                f"inference_solar.py not found under {self.repo_path}",
            )
        self._gpu = gpu_id
        self._loaded = True

    def unload(self) -> None:
        self._loaded = False

    def infer(
        self,
        *,
        geotiff_path: Path,
        output_dir: Path,
        threshold: float | None = None,
        min_area_sqm: float | None = None,
        output_format: str = "both",
    ) -> dict[str, Any]:
        if not self._loaded:
            raise InferenceNotImplementedError(self.model_key, "model not loaded")

        inference_script = self.repo_path / "inference_solar.py"
        ckpt_candidates = [
            self.repo_path / "models" / "solar_model.ckpt",
            self.repo_path / "solar_model.ckpt",
        ]
        ckpt = next((p for p in ckpt_candidates if p.exists()), None)

        if ckpt is None:
            raise InferenceNotImplementedError(
                self.model_key,
                "solar_model.ckpt not found; ensure GRW release assets were downloaded",
            )

        pred_dir = output_dir / "predictions"
        pred_dir.mkdir(parents=True, exist_ok=True)
        cmd = [
            sys.executable,
            str(inference_script),
            "--model-fn",
            str(ckpt),
            "--input-fn",
            str(geotiff_path),
            "--output-dir",
            str(pred_dir),
            "--overwrite",
        ]
        if self._gpu is not None:
            cmd.extend(["--gpu", str(self._gpu)])
        if threshold is not None:
            # GRW script has no threshold flag; keep for future polygonize min-area mapping
            pass

        env = dict(**{k: str(v) for k, v in __import__("os").environ.items()})
        if self._gpu is not None:
            env["CUDA_VISIBLE_DEVICES"] = str(self._gpu)

        try:
            result = subprocess.run(
                cmd,
                cwd=str(self.repo_path),
                capture_output=True,
                text=True,
                env=env,
                check=False,
            )
        except FileNotFoundError as exc:
            raise DependencyMissingError("python", "GRW subprocess inference") from exc

        if result.returncode != 0:
            raise InferenceNotImplementedError(
                self.model_key,
                f"GRW inference failed (exit {result.returncode}): {result.stderr[:500]}",
            )

        pred_tiff = pred_dir / f"{geotiff_path.stem}_solar.tif"
        if not pred_tiff.exists():
            # GRW names from basename (handles paths with dirs)
            import os

            alt = pred_dir / os.path.basename(str(geotiff_path)).replace(".tif", "_solar.tif")
            pred_tiff = alt if alt.exists() else pred_tiff

        outputs: dict[str, Any] = {"predictionGeoTiff": str(pred_tiff) if pred_tiff.exists() else None}
        geojson_path = None

        if output_format in ("geojson", "both"):
            polygonize = self.repo_path / "polygonize.py"
            if polygonize.exists() and pred_tiff.exists():
                geojson_dir = output_dir / "geojson"
                geojson_dir.mkdir(parents=True, exist_ok=True)
                poly_cmd = [
                    sys.executable,
                    str(polygonize),
                    "--input-dir",
                    str(pred_dir),
                    "--output-dir",
                    str(geojson_dir),
                    "--overwrite",
                ]
                if min_area_sqm is not None:
                    poly_cmd.extend(["--min-area", str(min_area_sqm)])
                poly_result = subprocess.run(
                    poly_cmd,
                    cwd=str(self.repo_path),
                    capture_output=True,
                    text=True,
                    env=env,
                    check=False,
                )
                geojson_path = geojson_dir / pred_tiff.name.replace("_solar.tif", "_solar.geojson")
                if poly_result.returncode != 0:
                    outputs["geojsonWarning"] = poly_result.stderr[:300]
                elif geojson_path.exists():
                    outputs["geojson"] = str(geojson_path)
            else:
                outputs["geojsonWarning"] = "polygonize.py unavailable or prediction GeoTIFF missing"

        return outputs
