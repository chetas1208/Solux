from __future__ import annotations

import time
from typing import Any

from app.core.model_manager import ModelManager
from app.harnesses.detection_harness import DetectionHarness


class BenchmarkHarness:
    def __init__(self, manager: ModelManager) -> None:
        self.manager = manager

    def benchmark_model(self, model_key: str, **kwargs: Any) -> dict[str, Any]:
        results: dict[str, Any] = {"modelKey": model_key}
        cold_start = time.perf_counter()
        try:
            load_info = self.manager.load(model_key, gpu=kwargs.get("gpu"))
            results["modelLoadMs"] = int((time.perf_counter() - cold_start) * 1000)
            results["loadInfo"] = load_info
        except Exception as exc:
            results["error"] = str(exc)
            return results

        if model_key in ("microsoft_grw", "geobase_solar_panel_detection"):
            harness = DetectionHarness(self.manager, model_key)
            warm_start = time.perf_counter()
            try:
                harness.validate_input(**kwargs)
                results["warmValidationMs"] = int((time.perf_counter() - warm_start) * 1000)
            except Exception as exc:
                results["validationError"] = str(exc)
        self.manager.unload(model_key)
        return results
