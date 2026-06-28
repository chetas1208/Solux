from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from app.config import Settings

SOLAR_MODELS = frozenset({"microsoft_grw", "geobase_solar_panel_detection", "geobase_geoai_models"})
FOUNDATION_MODELS = frozenset({
    "clay",
    "prithvi_100m",
    "prithvi_600m",
    "satlas",
    "terramind_base",
    "dofa",
    "remoteclip",
    "local_critic",
})


@dataclass
class GpuTask:
    model_key: str
    gpu_id: int


@dataclass
class ParallelPlan:
    """Models grouped into waves; each wave runs concurrently across GPUs."""
    waves: list[list[GpuTask]] = field(default_factory=list)
    model_gpu_map: dict[str, int] = field(default_factory=dict)

    @property
    def parallel_gpu_count(self) -> int:
        if not self.waves:
            return 0
        return max(len(w) for w in self.waves)


class DualGpuScheduler:
    """
    Schedules models across GPU 0 (solar/detection) and GPU 1 (foundation/critic).
    Models on different GPUs in the same wave execute in parallel.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.solar_gpu = settings.default_solar_gpu
        self.foundation_gpu = settings.default_foundation_gpu

    def gpu_for_model(self, model_key: str) -> int:
        if model_key in SOLAR_MODELS:
            return self.solar_gpu
        if model_key in FOUNDATION_MODELS:
            return self.foundation_gpu
        return self.solar_gpu

    def plan(self, model_keys: list[str]) -> ParallelPlan:
        if not model_keys:
            return ParallelPlan()

        tasks = [GpuTask(model_key=m, gpu_id=self.gpu_for_model(m)) for m in model_keys]

        # Bucket by GPU — at most one concurrent model per GPU per wave
        by_gpu: dict[int, list[GpuTask]] = {}
        for t in tasks:
            by_gpu.setdefault(t.gpu_id, []).append(t)

        waves: list[list[GpuTask]] = []
        max_depth = max(len(v) for v in by_gpu.values()) if by_gpu else 0
        for depth in range(max_depth):
            wave: list[GpuTask] = []
            for gpu_id in sorted(by_gpu.keys()):
                bucket = by_gpu[gpu_id]
                if depth < len(bucket):
                    wave.append(bucket[depth])
            if wave:
                waves.append(wave)

        return ParallelPlan(
            waves=waves,
            model_gpu_map={t.model_key: t.gpu_id for t in tasks},
        )

    def execute_waves(
        self,
        plan: ParallelPlan,
        runner: Callable[[GpuTask], dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Run each wave; tasks within a wave run in parallel threads."""
        from concurrent.futures import ThreadPoolExecutor, as_completed

        all_results: list[dict[str, Any]] = []
        max_workers = min(
            self.settings.gpu_count,
            max(1, plan.parallel_gpu_count),
        )

        for wave in plan.waves:
            if len(wave) == 1 or not self.settings.dual_gpu_parallel:
                all_results.append(runner(wave[0]))
                continue

            with ThreadPoolExecutor(max_workers=min(len(wave), max_workers)) as pool:
                futures = {pool.submit(runner, task): task for task in wave}
                for fut in as_completed(futures):
                    all_results.append(fut.result())
        return all_results

    def describe(self, plan: ParallelPlan) -> dict[str, Any]:
        return {
            "dualGpuParallel": self.settings.dual_gpu_parallel,
            "solarGpu": self.solar_gpu,
            "foundationGpu": self.foundation_gpu,
            "waves": [
                [{"model": t.model_key, "gpu": t.gpu_id} for t in wave]
                for wave in plan.waves
            ],
            "modelGpuMap": plan.model_gpu_map,
        }
