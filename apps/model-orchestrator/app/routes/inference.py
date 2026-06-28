from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.core.errors import SoluxModelError
from app.core.model_manager import get_model_manager
from app.pipelines.candidate_reranking import run_candidate_reranking_pipeline
from app.pipelines.eo_embedding import run_eo_embedding_pipeline
from app.pipelines.rooftop_panel_detection import run_rooftop_panel_pipeline
from app.pipelines.solar_farm_detection import run_solar_farm_pipeline
from app.schemas import (
    EoEmbedRequest,
    EoEmbedResponse,
    RerankRequest,
    RerankResponse,
    SolarFarmRequest,
    SolarFarmResponse,
    SolarPanelRequest,
    SolarPanelResponse,
)

router = APIRouter(prefix="/infer", tags=["inference"])
embed_router = APIRouter(prefix="/embed", tags=["embeddings"])
rerank_router = APIRouter(prefix="/rerank", tags=["reranking"])


def _handle_error(exc: Exception) -> HTTPException:
    if isinstance(exc, SoluxModelError):
        return HTTPException(status_code=exc.status_code, detail=exc.to_dict())
    if isinstance(exc, FileNotFoundError):
        return HTTPException(
            status_code=404,
            detail={
                "error": "input_not_found",
                "message": str(exc),
                "remediation": "Provide a valid localGeoTiffPath or upload a GeoTIFF.",
            },
        )
    return HTTPException(status_code=500, detail={"error": "internal_error", "message": str(exc)})


@router.post("/solar-farm", response_model=SolarFarmResponse)
async def infer_solar_farm(request: Request) -> SolarFarmResponse:
    settings = get_settings()
    manager = get_model_manager()

    geotiff_path: Path | None = None
    tmp_dir: tempfile.TemporaryDirectory[str] | None = None
    req: SolarFarmRequest

    content_type = request.headers.get("content-type", "")
    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            upload = form.get("file")
            if upload is None:
                raise HTTPException(status_code=400, detail="file field required for multipart upload")
            tmp_dir = tempfile.TemporaryDirectory(prefix="solux-upload-")
            geotiff_path = Path(tmp_dir.name) / getattr(upload, "filename", "upload.tif")
            geotiff_path.write_bytes(await upload.read())  # type: ignore[union-attr]
            req = SolarFarmRequest(
                inputType="geotiff_upload",
                outputFormat=str(form.get("outputFormat", "both")),
                threshold=float(form["threshold"]) if form.get("threshold") else None,
                minAreaSqm=float(form["minAreaSqm"]) if form.get("minAreaSqm") else None,
                gpu=int(form["gpu"]) if form.get("gpu") else None,
            )
        else:
            body = await request.json()
            req = SolarFarmRequest.model_validate(body)
            if req.inputType != "geotiff_path" or not req.localGeoTiffPath:
                raise HTTPException(
                    status_code=400,
                    detail="localGeoTiffPath is required for geotiff_path input",
                )
            geotiff_path = Path(req.localGeoTiffPath)

        if geotiff_path is None or not geotiff_path.exists():
            raise FileNotFoundError(str(geotiff_path))

        result = run_solar_farm_pipeline(
            manager,
            settings,
            geotiff_path=geotiff_path,
            output_format=req.outputFormat,
            threshold=req.threshold,
            min_area_sqm=req.minAreaSqm,
            gpu=req.gpu,
        )
        return SolarFarmResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise _handle_error(exc) from exc
    finally:
        if tmp_dir is not None:
            tmp_dir.cleanup()


@router.post("/solar-panel", response_model=SolarPanelResponse)
def infer_solar_panel(request: SolarPanelRequest) -> SolarPanelResponse:
    settings = get_settings()
    manager = get_model_manager()
    try:
        result = run_rooftop_panel_pipeline(
            manager,
            settings,
            geometry=request.geometry,
            tile_size=request.tileSize,
            zoom=request.zoom,
            gpu=request.gpu,
        )
        return SolarPanelResponse(**result)
    except Exception as exc:
        raise _handle_error(exc) from exc


@embed_router.post("/eo", response_model=EoEmbedResponse)
def embed_eo(request: EoEmbedRequest) -> EoEmbedResponse:
    settings = get_settings()
    manager = get_model_manager()
    try:
        result = run_eo_embedding_pipeline(
            manager,
            settings,
            model=request.model,
            input_type=request.inputType,
            path=request.path,
            bands=request.bands,
            timestamp=request.timestamp,
            geometry=request.geometry,
            gpu=request.gpu,
        )
        return EoEmbedResponse(**result)
    except Exception as exc:
        raise _handle_error(exc) from exc


@rerank_router.post("/candidates", response_model=RerankResponse)
def rerank_candidates(request: RerankRequest) -> RerankResponse:
    settings = get_settings()
    manager = get_model_manager()
    try:
        result = run_candidate_reranking_pipeline(
            manager,
            settings,
            candidate_geojson=request.candidateGeoJson,
            tile_image_paths=request.tileImagePaths,
            method=request.method,
            prompt=request.prompt,
            gpu=request.gpu,
            query_embedding=request.queryEmbedding or None,
        )
        return RerankResponse(**result)
    except Exception as exc:
        raise _handle_error(exc) from exc
