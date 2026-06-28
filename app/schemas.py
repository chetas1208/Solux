from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "solux-model-orchestrator"
    registryPath: str
    modelCacheDir: str
    cudaAvailable: bool | None = None
    gpuCount: int | None = None
    loadedModels: dict[str, Any] = Field(default_factory=dict)
    gpuSchedule: dict[str, Any] = Field(default_factory=dict)
    dualGpuParallel: bool = True
    mojoKernels: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class ModelSummary(BaseModel):
    modelId: str
    modelKey: str
    found: bool
    downloaded: bool
    localPath: str
    sizeBytes: int
    sizeHuman: str
    requiredForMVP: bool
    task: str
    category: str
    licenseStatus: str
    warnings: list[str] = Field(default_factory=list)


class ModelsListResponse(BaseModel):
    modelCacheDir: str
    models: list[ModelSummary]
    missingRequired: list[str] = Field(default_factory=list)


class LoadUnloadResponse(BaseModel):
    modelKey: str
    status: str
    gpu: int | None = None
    loadSeconds: float | None = None


class SolarFarmRequest(BaseModel):
    model: Literal["microsoft_grw_solar"] = "microsoft_grw_solar"
    inputType: Literal["geotiff_path", "geotiff_upload"]
    localGeoTiffPath: str | None = None
    outputFormat: Literal["geotiff", "geojson", "both"] = "both"
    threshold: float | None = None
    minAreaSqm: float | None = None
    gpu: int | None = None


class SolarFarmInputMeta(BaseModel):
    path: str
    crs: str | None = None
    bounds: list[float] | None = None


class SolarFarmOutputs(BaseModel):
    predictionGeoTiff: str | None = None
    geojson: str | None = None
    previewPng: str | None = None


class SolarFarmMetrics(BaseModel):
    runtimeSeconds: float
    gpu: int | None = None
    modelLoadSeconds: float = 0.0


class SolarFarmResponse(BaseModel):
    jobId: str
    model: str
    status: Literal["completed", "failed"]
    input: SolarFarmInputMeta
    outputs: SolarFarmOutputs
    metrics: SolarFarmMetrics
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None


class SolarPanelRequest(BaseModel):
    model: Literal["geobase_solar_panel_detection"] = "geobase_solar_panel_detection"
    geometry: dict[str, Any]
    zoom: int | None = None
    tileSize: int = 512
    outputFormat: Literal["geojson"] = "geojson"
    gpu: int | None = None


class SolarPanelMetrics(BaseModel):
    runtimeSeconds: float
    numDetections: int = 0
    gpu: int | None = None


class SolarPanelResponse(BaseModel):
    jobId: str
    model: str
    status: Literal["completed", "failed"]
    detections: dict[str, Any]
    metrics: SolarPanelMetrics
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None


class EoEmbedRequest(BaseModel):
    model: Literal["clay", "prithvi_100m", "terramind_base", "satlas", "dofa", "remoteclip"]
    inputType: Literal["geotiff_path", "image_path", "tile_array", "metadata_only"]
    path: str | None = None
    bands: list[str] = Field(default_factory=lambda: ["red", "green", "blue", "nir"])
    timestamp: str | None = None
    geometry: dict[str, Any] | None = None
    gpu: int | None = None


class EmbeddingInfo(BaseModel):
    shape: list[int]
    dtype: str = "float32"
    storagePath: str | None = None


class EoEmbedMetadata(BaseModel):
    bandsUsed: list[str] = Field(default_factory=list)
    normalized: bool = True
    crs: str | None = None
    bounds: list[float] | None = None


class EoEmbedResponse(BaseModel):
    jobId: str
    model: str
    status: Literal["completed", "failed"]
    embedding: EmbeddingInfo | None = None
    metadata: EoEmbedMetadata = Field(default_factory=EoEmbedMetadata)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None


class RerankRequest(BaseModel):
    candidateGeoJson: dict[str, Any]
    tileImagePaths: list[str] = Field(default_factory=list)
    queryEmbedding: list[float] = Field(default_factory=list)
    method: Literal["remoteclip", "local_critic", "rules", "cosine"] = "rules"
    prompt: str | None = None
    gpu: int | None = None


class RankedCandidate(BaseModel):
    featureId: str
    score: float
    reason: str
    model: str


class RerankResponse(BaseModel):
    jobId: str
    rankedCandidates: list[RankedCandidate]
    warnings: list[str] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    remediation: str | None = None
