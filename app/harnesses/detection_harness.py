from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.model_manager import ModelManager
from app.harnesses.base_harness import BaseHarness
from app.pipelines.solar_farm_detection import run_solar_farm_pipeline
from app.pipelines.rooftop_panel_detection import run_rooftop_panel_pipeline


class DetectionHarness(BaseHarness):
    def __init__(self, manager: ModelManager, model_key: str) -> None:
        self.manager = manager
        self.model_key = model_key

    def validate_input(self, **kwargs: Any) -> None:
        if self.model_key == "microsoft_grw":
            path = kwargs.get("geotiff_path")
            if not path or not Path(path).exists():
                raise FileNotFoundError(f"GeoTIFF not found: {path}")

    def run(self, **kwargs: Any) -> dict[str, Any]:
        settings = kwargs["settings"]
        if self.model_key == "microsoft_grw":
            return run_solar_farm_pipeline(
                self.manager,
                settings,
                geotiff_path=Path(kwargs["geotiff_path"]),
                output_format=kwargs.get("output_format", "both"),
                threshold=kwargs.get("threshold"),
                min_area_sqm=kwargs.get("min_area_sqm"),
                gpu=kwargs.get("gpu"),
            )
        if self.model_key == "geobase_solar_panel_detection":
            return run_rooftop_panel_pipeline(
                self.manager,
                settings,
                geometry=kwargs["geometry"],
                tile_size=kwargs.get("tile_size", 512),
                zoom=kwargs.get("zoom"),
                gpu=kwargs.get("gpu"),
            )
        raise NotImplementedError(f"Detection harness not implemented for {self.model_key}")
