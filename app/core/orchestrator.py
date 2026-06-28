from __future__ import annotations

import time
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any

from app.config import Settings
from app.core.cache import ResultCache
from app.core.gpu_scheduler import DualGpuScheduler, GpuTask
from app.core.model_manager import ModelManager
from app.core.observability import log_job_event, timed_stage
from app.core.router import RouteDecision, route_job
from app.core.storage import JobStorage
from app.harnesses.detection_harness import DetectionHarness
from app.harnesses.embedding_harness import EMBED_MODEL_MAP, EmbeddingHarness
from app.learning.online_ranker import OnlineRanker
from app.learning.preference_profiles import PreferenceProfileStore
from app.providers.max_local_critic import MaxLocalCriticProvider
from app.utils.hashing import hash_input_files, sha256_geometry
from app.pipelines.fatal_flaw_screening import run_fatal_flaw_screening
from app.pipelines.floating_solar_screening import run_water_solar_screening


class JobOrchestrator:
    def __init__(self, settings: Settings, manager: ModelManager) -> None:
        self.settings = settings
        self.manager = manager
        self.scheduler = DualGpuScheduler(settings)
        self.storage = JobStorage(settings.solux_output_dir, settings.data_dir)
        self.cache = ResultCache(settings.cache_dir)
        self.ranker = OnlineRanker(settings.learning_dir / "online_ranker")
        self.profiles = PreferenceProfileStore(settings.learning_dir / "profiles")
        self.critic = MaxLocalCriticProvider(settings)

    def _model_availability(self) -> dict[str, bool]:
        self.manager.reload_registry()
        return {m.model_id: m.downloaded for m in self.manager.registry.models}

    def route(self, request: dict[str, Any]) -> RouteDecision:
        return route_job(
            job_type=request["jobType"],
            input_files=request.get("inputFiles", []),
            latency_mode=request.get("latencyMode", "fast"),
            geometry=request.get("geometry"),
            bbox=request.get("bbox"),
            requested_model=request.get("requestedModel"),
            model_available=self._model_availability(),
            personalization_enabled=request.get("personalization", {}).get("enabled", True),
        )

    def _run_model_task(self, task: GpuTask, request: dict[str, Any]) -> dict[str, Any]:
        model_key = task.model_key
        t0 = time.perf_counter()

        def _infer(provider: Any) -> dict[str, Any]:
            if model_key in ("microsoft_grw", "geobase_solar_panel_detection"):
                geotiff = next(
                    (f["path"] for f in request.get("inputFiles", []) if f.get("type") in ("geotiff", "cog")),
                    None,
                )
                harness = DetectionHarness(self.manager, model_key)
                if model_key == "microsoft_grw" and geotiff:
                    return harness.run(
                        settings=self.settings,
                        geotiff_path=geotiff,
                        gpu=task.gpu_id,
                    )
                return harness.run(
                    settings=self.settings,
                    geometry=request.get("geometry") or {},
                    gpu=task.gpu_id,
                )
            if model_key in EMBED_MODEL_MAP:
                path = next((f.get("path") for f in request.get("inputFiles", [])), None)
                return EmbeddingHarness(self.manager, model_key).run(
                    settings=self.settings,
                    path=path,
                    input_type="geotiff_path" if path else "metadata_only",
                    gpu=task.gpu_id,
                )
            raise NotImplementedError(f"No harness for {model_key}")

        try:
            out, load_info = self.manager.run_inference(model_key, _infer, gpu=task.gpu_id)
        except Exception as exc:
            return {
                "modelKey": model_key,
                "gpu": task.gpu_id,
                "error": str(exc),
                "inferenceMs": int((time.perf_counter() - t0) * 1000),
            }
        elapsed = int((time.perf_counter() - t0) * 1000)
        return {
            "modelKey": model_key,
            "gpu": task.gpu_id,
            "output": out,
            "loadInfo": load_info,
            "inferenceMs": elapsed,
        }

    def execute(self, request: dict[str, Any]) -> dict[str, Any]:
        job_id = self.storage.new_job_id()
        started = time.perf_counter()
        metrics: dict[str, Any] = {"gpusUsed": []}
        warnings: list[str] = []

        self.storage.save_request(job_id, request)
        file_hashes = hash_input_files(request.get("inputFiles", []))
        geom_hash = sha256_geometry(request.get("geometry"))

        with timed_stage(metrics, "queueWaitMs"):
            decision = self.route(request)
        warnings.extend(decision.warnings)

        plan = self.scheduler.plan(decision.models)
        metrics["gpuSchedule"] = self.scheduler.describe(plan)
        if decision.parallel_dual_gpu and len(plan.waves) > 0 and len(plan.waves[0]) > 1:
            warnings.append(
                f"Dual-GPU parallel wave: {[t.model_key for t in plan.waves[0]]}"
            )

        profile_id = request.get("personalization", {}).get("userProfileId") or request.get("userId")
        profile_version = "v0"
        if profile_id:
            profile_version = self.profiles.get(profile_id).load().get("version", "v0")

        results: dict[str, Any] = {"features": [], "scores": {}, "fatalFlaws": [], "rankedCandidates": []}
        outputs: dict[str, Any] = {}
        status = "completed"
        model_load_ms = 0
        inference_ms = 0

        try:
            # CPU-bound rules run while GPU models can load in parallel on other jobs
            if decision.pipeline == "fatal_flaw_screening":
                ff = run_fatal_flaw_screening(
                    geometry=request.get("geometry"),
                    bbox=request.get("bbox"),
                    constraints=request.get("constraints", {}),
                )
                results["fatalFlaws"] = ff.get("fatalFlaws", [])
                results["scores"] = ff.get("scores", {})
                warnings.extend(ff.get("warnings", []))
                if decision.use_critic and self.critic.is_available():
                    with timed_stage(metrics, "criticMs"):
                        results["explanation"] = self.critic.explain_routing_decision(decision=ff)

            elif decision.pipeline in (
                "floating_solar_screening",
                "canal_solar_screening",
                "reservoir_solar_screening",
            ):
                ws = run_water_solar_screening(
                    job_type=decision.job_type,
                    geometry=request.get("geometry"),
                    constraints=request.get("constraints", {}),
                )
                results.update(ws.get("results", {}))
                warnings.extend(ws.get("warnings", []))

            # Parallel GPU model execution across waves (overlap critic on GPU 1 when possible)
            critic_future: Future[str] | None = None
            critic_pool: ThreadPoolExecutor | None = None
            if (
                decision.use_critic
                and self.critic.is_available()
                and decision.pipeline not in ("fatal_flaw_screening",)
            ):
                critic_pool = ThreadPoolExecutor(max_workers=1)
                critic_future = critic_pool.submit(
                    self.critic.explain_routing_decision,
                    decision={
                        "pipeline": decision.pipeline,
                        "models": decision.models,
                        "plannedGpus": decision.model_gpu_map,
                        "latencyMode": decision.latency_mode,
                    },
                )

            if decision.models:
                with timed_stage(metrics, "inferenceMs"):
                    model_results = self.scheduler.execute_waves(
                        plan,
                        lambda task: self._run_model_task(task, request),
                    )

                for mr in model_results:
                    if mr.get("error"):
                        warnings.append(f"{mr.get('modelKey')} failed: {mr['error']}")
                        continue
                    out = mr.get("output", {})
                    mk = mr.get("modelKey", "")
                    gpu = mr.get("gpu")
                    if gpu is not None and gpu not in metrics["gpusUsed"]:
                        metrics["gpusUsed"].append(gpu)
                    model_load_ms += int(mr.get("loadInfo", {}).get("loadSeconds", 0) * 1000)
                    inference_ms += mr.get("inferenceMs", 0)

                    if mk in ("microsoft_grw", "geobase_solar_panel_detection"):
                        results["features"] = out.get("detections", {}).get("features", [])
                        if not results["features"] and out.get("outputs"):
                            results["features"] = []
                        outputs["geojson"] = out.get("outputs", {}).get("geojson") or out.get("detections")
                    elif mk in EMBED_MODEL_MAP:
                        outputs.setdefault("embeddings", {})[mk] = out.get("embedding", {}).get("storagePath")

                # Unload after job to free VRAM for next request (keep warm if preload enabled)
                if not self.settings.keep_models_warm_after_job:
                    for mk in decision.models:
                        self.manager.unload(mk)

            # Critic on GPU 1 via MAX HTTP — may already be running in parallel with inference
            if decision.use_critic and self.critic.is_available() and "explanation" not in results:
                with timed_stage(metrics, "criticMs"):
                    if critic_future is not None:
                        try:
                            results["explanation"] = critic_future.result(
                                timeout=self.settings.max_critic_timeout_seconds
                            )
                        except Exception as exc:
                            warnings.append(f"MAX critic failed: {exc}")
                        finally:
                            if critic_pool is not None:
                                critic_pool.shutdown(wait=False)
                    else:
                        results["explanation"] = self.critic.explain_routing_decision(
                            decision={
                                "pipeline": decision.pipeline,
                                "models": decision.models,
                                "gpus": metrics["gpusUsed"],
                            }
                        )
            elif decision.use_critic:
                warnings.append("MAX critic unavailable on GPU 1 — continuing without explanation")
            elif critic_pool is not None:
                critic_pool.shutdown(wait=False)

            if decision.use_online_ranker:
                candidates = request.get("candidates") or results.get("features", [])
                if candidates:
                    results["rankedCandidates"] = self.ranker.rank_candidates(
                        [{"properties": c.get("properties", c), "features": c} for c in candidates]
                    )

        except Exception as exc:
            status = "failed"
            warnings.append(str(exc))
            log_job_event(job_id, "failed", error=str(exc))

        metrics["modelLoadMs"] = model_load_ms
        metrics["inferenceMs"] = inference_ms
        metrics["totalMs"] = int((time.perf_counter() - started) * 1000)
        metrics["gpu"] = ",".join(str(g) for g in sorted(metrics["gpusUsed"])) or "cpu"
        from app.core.mojo_runtime import get_mojo_runtime

        ms = get_mojo_runtime().status()
        metrics["mojoKernels"] = {
            "backend": ms.backend,
            "enabled": ms.enabled,
            "moduleLoaded": ms.module_loaded,
        }

        response = {
            "jobId": job_id,
            "status": status,
            "jobType": request.get("jobType"),
            "selectedPipeline": decision.pipeline,
            "selectedModels": decision.models,
            "latencyMode": decision.latency_mode,
            "inputs": {
                "geometryHash": geom_hash,
                "fileHashes": file_hashes,
                "crs": "EPSG:4326",
                "bounds": request.get("bbox"),
            },
            "outputs": outputs,
            "results": results,
            "learning": {
                "personalizationApplied": bool(profile_id),
                "profileVersion": profile_version,
                "onlineRankerVersion": self.ranker.version,
                "feedbackRequested": True,
            },
            "metrics": metrics,
            "warnings": warnings,
        }
        self.storage.save_manifest(job_id, response)
        return response
