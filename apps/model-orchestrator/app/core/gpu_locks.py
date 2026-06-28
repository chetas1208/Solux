from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from typing import Any, Generator


class GpuLockManager:
    """Per-GPU locks: load queue + inference exclusivity on each device."""

    def __init__(self, queue_enabled: bool = True) -> None:
        self._queue_enabled = queue_enabled
        self._load_locks: dict[int, threading.Lock] = defaultdict(threading.Lock)
        self._infer_locks: dict[int, threading.RLock] = defaultdict(threading.RLock)
        self._loaded_by_gpu: dict[int, str | None] = defaultdict(lambda: None)
        self._inferring_on_gpu: dict[int, str | None] = defaultdict(lambda: None)
        self._wait_queues: dict[int, deque[threading.Event]] = defaultdict(deque)
        self._meta_lock = threading.Lock()

    def gpu_for_category(self, category: str, default_solar_gpu: int, default_foundation_gpu: int) -> int:
        solar_categories = {
            "utility_scale_solar_detection",
            "panel_detection",
            "optional_model_pack",
        }
        foundation_categories = {
            "eo_foundation_backbone",
            "eo_foundation_backbone_large",
            "image_text_reranking",
            "local_llm",
            "reference_code",
        }
        if category in solar_categories:
            return default_solar_gpu
        if category in foundation_categories:
            return default_foundation_gpu
        return default_solar_gpu

    def _enqueue(self, gpu_id: int) -> threading.Event:
        event = threading.Event()
        with self._meta_lock:
            self._wait_queues[gpu_id].append(event)
        return event

    def _dequeue(self, gpu_id: int) -> None:
        with self._meta_lock:
            if self._wait_queues[gpu_id]:
                finished = self._wait_queues[gpu_id].popleft()
                finished.set()

    @contextmanager
    def acquire_load(self, gpu_id: int, model_key: str) -> Generator[None, None, None]:
        """Serialize model weight loading on a GPU."""
        event = self._enqueue(gpu_id) if self._queue_enabled else None
        if event is not None:
            while True:
                with self._meta_lock:
                    is_front = (
                        len(self._wait_queues[gpu_id]) > 0
                        and self._wait_queues[gpu_id][0] is event
                    )
                if is_front:
                    break
                event.wait(timeout=0.02)
        self._load_locks[gpu_id].acquire()
        try:
            with self._meta_lock:
                self._loaded_by_gpu[gpu_id] = model_key
            yield
        finally:
            with self._meta_lock:
                if self._loaded_by_gpu.get(gpu_id) == model_key:
                    self._loaded_by_gpu[gpu_id] = None
            self._load_locks[gpu_id].release()
            if self._queue_enabled:
                self._dequeue(gpu_id)

    @contextmanager
    def acquire_inference(self, gpu_id: int, model_key: str) -> Generator[None, None, None]:
        """One inference stream per GPU; different GPUs run in parallel."""
        with self._infer_locks[gpu_id]:
            with self._meta_lock:
                self._inferring_on_gpu[gpu_id] = model_key
            try:
                yield
            finally:
                with self._meta_lock:
                    if self._inferring_on_gpu.get(gpu_id) == model_key:
                        self._inferring_on_gpu[gpu_id] = None

    # Backward-compatible alias
    acquire = acquire_load

    def loaded_model_on_gpu(self, gpu_id: int) -> str | None:
        return self._loaded_by_gpu.get(gpu_id)

    def snapshot(self) -> dict[str, Any]:
        with self._meta_lock:
            return {
                "loadedByGpu": dict(self._loaded_by_gpu),
                "inferringOnGpu": dict(self._inferring_on_gpu),
            }


class IdleUnloadTracker:
    def __init__(self, timeout_seconds: int) -> None:
        self.timeout_seconds = timeout_seconds
        self._last_used: dict[str, float] = {}
        self._lock = threading.Lock()

    def touch(self, model_key: str) -> None:
        with self._lock:
            self._last_used[model_key] = time.monotonic()

    def remove(self, model_key: str) -> None:
        with self._lock:
            self._last_used.pop(model_key, None)

    def expired(self) -> list[str]:
        now = time.monotonic()
        with self._lock:
            return [
                key
                for key, ts in self._last_used.items()
                if now - ts >= self.timeout_seconds
            ]
