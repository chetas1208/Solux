from __future__ import annotations

from app.config import Settings
from app.core.gpu_scheduler import DualGpuScheduler


def test_parallel_plan_dual_gpu() -> None:
    settings = Settings(
        DUAL_GPU_PARALLEL=True,
        GPU_COUNT=2,
        SOLUX_MAX_LOADED_MODELS=2,
    )
    sched = DualGpuScheduler(settings)
    plan = sched.plan(["microsoft_grw", "clay"])
    assert len(plan.waves) == 1
    assert len(plan.waves[0]) == 2
    assert plan.model_gpu_map["microsoft_grw"] == 0
    assert plan.model_gpu_map["clay"] == 1


def test_sequential_same_gpu() -> None:
    settings = Settings(GPU_COUNT=2)
    sched = DualGpuScheduler(settings)
    plan = sched.plan(["clay", "prithvi_100m"])
    assert len(plan.waves) == 2
    assert all(t.gpu_id == 1 for wave in plan.waves for t in wave)


def test_execute_waves_parallel() -> None:
    settings = Settings(DUAL_GPU_PARALLEL=True, GPU_COUNT=2)
    sched = DualGpuScheduler(settings)
    plan = sched.plan(["microsoft_grw", "clay"])
    order: list[int] = []

    def runner(task):
        order.append(task.gpu_id)
        return {"gpu": task.gpu_id, "model": task.model_key}

    results = sched.execute_waves(plan, runner)
    assert len(results) == 2
    assert set(order) == {0, 1}
