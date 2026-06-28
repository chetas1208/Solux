from __future__ import annotations

import threading
import time
from typing import Any, Callable

from app.config import Settings, get_settings
from app.core.disk import directory_is_populated
from app.core.errors import GpuOomError, ModelNotFoundError, ModelNotLoadedError, SoluxModelError
from app.core.gpu_locks import GpuLockManager, IdleUnloadTracker
from app.core.gpu_scheduler import DualGpuScheduler, SOLAR_MODELS, FOUNDATION_MODELS
from app.core.model_registry import ModelRegistry, load_registry
from app.providers.base import BaseProvider


ProviderFactory = Callable[[Settings, str, str], BaseProvider]


class ModelManager:
    """Lazy-loading manager: one heavyweight model per GPU, two GPUs in parallel."""

    SOLAR_MODELS = SOLAR_MODELS
    FOUNDATION_MODELS = FOUNDATION_MODELS

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.registry: ModelRegistry = load_registry(
            self.settings.registry_path,
            self.settings.model_cache_dir,
        )
        self.registry.refresh_all()
        policy = self.registry.runtime_policy
        self.gpu_locks = GpuLockManager(queue_enabled=bool(policy.get("queueEnabled", True)))
        self.scheduler = DualGpuScheduler(self.settings)
        self.idle_tracker = IdleUnloadTracker(
            timeout_seconds=int(
                policy.get("autoUnloadAfterSeconds", self.settings.auto_unload_after_seconds)
            )
        )
        self._providers: dict[str, BaseProvider] = {}
        self._provider_factories: dict[str, ProviderFactory] = {}
        self._loaded_gpu: dict[str, int] = {}
        self._lock = threading.RLock()
        self._register_factories()

    def _register_factories(self) -> None:
        from app.providers.clay_embeddings import ClayProvider
        from app.providers.dofa_embeddings import DofaProvider
        from app.providers.geobase_onnx import GeobaseOnnxProvider
        from app.providers.local_critic import LocalCriticProvider
        from app.providers.microsoft_grw import MicrosoftGrwProvider
        from app.providers.prithvi_embeddings import PrithviProvider
        from app.providers.remoteclip import RemoteClipProvider
        from app.providers.satlas_embeddings import SatlasProvider
        from app.providers.terramind_embeddings import TerraMindProvider

        self._provider_factories = {
            "microsoft_grw": lambda s, p, k: MicrosoftGrwProvider(s, p, k),
            "geobase_solar_panel_detection": lambda s, p, k: GeobaseOnnxProvider(s, p, k),
            "clay": lambda s, p, k: ClayProvider(s, p, k),
            "prithvi_100m": lambda s, p, k: PrithviProvider(s, p, k, variant="100m"),
            "prithvi_600m": lambda s, p, k: PrithviProvider(s, p, k, variant="600m"),
            "satlas": lambda s, p, k: SatlasProvider(s, p, k),
            "terramind_base": lambda s, p, k: TerraMindProvider(s, p, k),
            "dofa": lambda s, p, k: DofaProvider(s, p, k),
            "remoteclip": lambda s, p, k: RemoteClipProvider(s, p, k),
            "local_critic": lambda s, p, k: LocalCriticProvider(s, p, k),
        }

    def reload_registry(self) -> None:
        self.registry = load_registry(
            self.settings.registry_path,
            self.settings.model_cache_dir,
        )
        self.registry.refresh_all()

    def _ensure_available(self, model_key: str) -> None:
        entry = self.registry.get(model_key)
        if entry is None:
            raise ModelNotFoundError(model_key, "not in registry")
        if not directory_is_populated(entry.local_path):
            raise ModelNotFoundError(model_key, str(entry.local_path))

    def resolve_gpu(self, model_key: str, gpu: int | None = None) -> int:
        if gpu is not None:
            return gpu
        return self.scheduler.gpu_for_model(model_key)

    def _enforce_per_gpu_limit(self, incoming_key: str, gpu_id: int) -> None:
        max_per_gpu = max(1, self.settings.max_models_per_gpu)
        with self._lock:
            on_gpu = [
                k for k, g in self._loaded_gpu.items()
                if g == gpu_id and k != incoming_key
            ]
            while len(on_gpu) >= max_per_gpu:
                self.unload(on_gpu[0])
                on_gpu = on_gpu[1:]

        total_cap = max(1, self.settings.solux_max_loaded_models)
        with self._lock:
            if len(self._providers) < total_cap:
                return
            if incoming_key in self._providers:
                return
            # Evict LRU on same GPU first
            for key in list(self._providers.keys()):
                if self._loaded_gpu.get(key) == gpu_id:
                    self.unload(key)
                    return
            self.unload(next(iter(self._providers.keys())))

    def get_provider(self, model_key: str) -> BaseProvider:
        self._ensure_available(model_key)
        with self._lock:
            if model_key in self._providers:
                self.idle_tracker.touch(model_key)
                return self._providers[model_key]
        raise ModelNotLoadedError(model_key)

    def load(self, model_key: str, gpu: int | None = None) -> dict[str, Any]:
        self._ensure_available(model_key)
        factory = self._provider_factories.get(model_key)
        if factory is None:
            raise ModelNotFoundError(model_key, "no provider registered")

        entry = self.registry.get(model_key)
        assert entry is not None
        gpu_id = self.resolve_gpu(model_key, gpu)
        self._enforce_per_gpu_limit(model_key, gpu_id)

        started = time.perf_counter()
        with self._lock:
            if model_key in self._providers:
                self.idle_tracker.touch(model_key)
                return {
                    "modelKey": model_key,
                    "status": "already_loaded",
                    "gpu": self._loaded_gpu.get(model_key, gpu_id),
                    "loadSeconds": 0.0,
                }

        with self.gpu_locks.acquire_load(gpu_id, model_key):
            with self._lock:
                if model_key in self._providers:
                    self.idle_tracker.touch(model_key)
                    return {
                        "modelKey": model_key,
                        "status": "already_loaded",
                        "gpu": gpu_id,
                        "loadSeconds": 0.0,
                    }
                provider = factory(self.settings, str(entry.local_path), model_key)
                try:
                    provider.load(gpu_id)
                except RuntimeError as exc:
                    if "out of memory" in str(exc).lower():
                        self._clear_cuda_cache(gpu_id)
                        raise GpuOomError(model_key, gpu_id) from exc
                    raise
                self._providers[model_key] = provider
                self._loaded_gpu[model_key] = gpu_id
                self.idle_tracker.touch(model_key)

        elapsed = time.perf_counter() - started
        return {
            "modelKey": model_key,
            "status": "loaded",
            "gpu": gpu_id,
            "loadSeconds": round(elapsed, 3),
        }

    def run_inference(
        self,
        model_key: str,
        fn: Callable[[BaseProvider], Any],
        gpu: int | None = None,
    ) -> Any:
        """Load model, hold per-GPU inference lock, run fn — safe for parallel GPU execution."""
        gpu_id = self.resolve_gpu(model_key, gpu)
        load_info = self.load(model_key, gpu=gpu_id)
        try:
            with self.gpu_locks.acquire_inference(gpu_id, model_key):
                return fn(self.get_provider(model_key)), load_info
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                self.unload(model_key)
                self._clear_cuda_cache(gpu_id)
                raise GpuOomError(model_key, gpu_id) from exc
            raise

    def unload(self, model_key: str) -> dict[str, Any]:
        gpu_id = None
        with self._lock:
            provider = self._providers.pop(model_key, None)
            gpu_id = self._loaded_gpu.pop(model_key, None)
            self.idle_tracker.remove(model_key)
        if provider is not None:
            provider.unload()
            if gpu_id is not None:
                self._clear_cuda_cache(gpu_id)
            return {"modelKey": model_key, "status": "unloaded", "gpu": gpu_id}
        return {"modelKey": model_key, "status": "not_loaded"}

    def preload_dual_gpu_mvp(self) -> list[dict[str, Any]]:
        """Warm GPU 0 (GRW) and optionally keep geobase paths hot — parallel load."""
        from concurrent.futures import ThreadPoolExecutor

        targets: list[tuple[str, int]] = []
        if self.registry.get("microsoft_grw") and self.registry.get("microsoft_grw").downloaded:
            targets.append(("microsoft_grw", self.settings.default_solar_gpu))
        if self.settings.preload_gpu1_model:
            mid = self.settings.preload_gpu1_model
            entry = self.registry.get(mid)
            if entry and entry.downloaded:
                targets.append((mid, self.settings.default_foundation_gpu))

        results: list[dict[str, Any]] = []
        if not targets:
            return results

        def _load(pair: tuple[str, int]) -> dict[str, Any]:
            key, gpu = pair
            try:
                return self.load(key, gpu=gpu)
            except SoluxModelError as exc:
                return {"modelKey": key, "status": "skipped", "error": exc.message, "gpu": gpu}
            except Exception as exc:
                return {"modelKey": key, "status": "skipped", "error": str(exc), "gpu": gpu}

        if len(targets) > 1 and self.settings.dual_gpu_parallel:
            with ThreadPoolExecutor(max_workers=len(targets)) as pool:
                results = list(pool.map(_load, targets))
        else:
            results = [_load(t) for t in targets]
        return results

    def unload_expired(self) -> list[str]:
        removed: list[str] = []
        for key in self.idle_tracker.expired():
            result = self.unload(key)
            if result["status"] == "unloaded":
                removed.append(key)
        return removed

    def _clear_cuda_cache(self, gpu_id: int | None = None) -> None:
        try:
            import torch

            if torch.cuda.is_available():
                if gpu_id is not None:
                    with torch.cuda.device(gpu_id):
                        torch.cuda.empty_cache()
                else:
                    torch.cuda.empty_cache()
        except ImportError:
            pass

    def loaded_models(self) -> dict[str, Any]:
        with self._lock:
            return {
                key: {
                    "gpu": self._loaded_gpu.get(key),
                    "provider": type(prov).__name__,
                }
                for key, prov in self._providers.items()
            }

    def gpu_status(self) -> dict[str, Any]:
        return {
            "scheduler": self.scheduler.describe(self.scheduler.plan(list(self._loaded_gpu.keys()))),
            "locks": self.gpu_locks.snapshot(),
            "loaded": self.loaded_models(),
        }

    def ensure_loaded(self, model_key: str, gpu: int | None = None) -> BaseProvider:
        try:
            return self.get_provider(model_key)
        except ModelNotLoadedError:
            pass
        self.load(model_key, gpu=gpu)
        return self.get_provider(model_key)


_manager: ModelManager | None = None
_manager_lock = threading.Lock()


def get_model_manager() -> ModelManager:
    global _manager
    with _manager_lock:
        if _manager is None:
            _manager = ModelManager()
        return _manager
