from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class InputFile(BaseModel):
    type: Literal["geotiff", "cog", "geojson", "shapefile", "csv", "image_tile"]
    path: str
    bands: list[str] = Field(default_factory=list)
    crs: str | None = None
    timestamp: str | None = None


class Personalization(BaseModel):
    enabled: bool = True
    userProfileId: str | None = None
    projectProfileId: str | None = None


class Constraints(BaseModel):
    country: str = "USA"
    minAreaSqm: float = 0
    maxSlopeDeg: float = 0
    avoidProtectedLand: bool = True
    avoidUrbanCore: bool = True
    preferNearTransmission: bool = True
    preferNearRoads: bool = True
    preferLowConflictLand: bool = True


class OrchestratorRequest(BaseModel):
    jobType: Literal[
        "fatal_flaw",
        "utility_solar_detection",
        "rooftop_panel_detection",
        "floating_solar",
        "canal_solar",
        "reservoir_solar",
        "embedding",
        "rerank",
        "report",
    ]
    siteId: str | None = None
    userId: str | None = None
    geometry: dict[str, Any] | None = None
    bbox: list[float] | None = None
    inputFiles: list[InputFile] = Field(default_factory=list)
    latencyMode: Literal["fast", "balanced", "deep"] = "fast"
    personalization: Personalization = Field(default_factory=Personalization)
    constraints: Constraints = Field(default_factory=Constraints)
    requestedModel: str | None = None


class FeedbackRequest(BaseModel):
    jobId: str
    userId: str | None = None
    projectProfileId: str | None = None
    feedbackType: Literal["accept", "reject", "edit", "false_positive", "false_negative", "rating"]
    target: dict[str, Any] = Field(default_factory=dict)
    correctedGeometry: dict[str, Any] | None = None
    correctedLabel: str | None = None
    rating: int | None = None
    notes: str | None = None
    features: dict[str, float] = Field(default_factory=dict)


class PromoteRequest(BaseModel):
    modelKey: str
    version: str
    metrics: dict[str, float]
    minMetric: float = 0.0
