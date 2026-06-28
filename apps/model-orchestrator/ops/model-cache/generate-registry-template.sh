#!/usr/bin/env bash
# Generate static model-registry.json with all known models (downloaded=false until download runs).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_JSON="${SCRIPT_DIR}/model-registry.json"
MODEL_CACHE_DIR="${MODEL_CACHE_DIR:-/data/models/solux}"
LOCAL_CRITIC_MODEL_ID="${LOCAL_CRITIC_MODEL_ID:-Qwen/Qwen2.5-7B-Instruct}"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
CRITIC_PATH="${MODEL_CACHE_DIR}/local-critic/$(echo "$LOCAL_CRITIC_MODEL_ID" | tr '/' '-')"

jq -n \
  --arg generatedAt "$NOW" \
  --arg modelCacheDir "$MODEL_CACHE_DIR" \
  --arg criticPath "$CRITIC_PATH" \
  '{
    generatedAt: $generatedAt,
    modelCacheDir: $modelCacheDir,
    runtimePolicy: {
      default: "lazy_load_single_heavy_model_per_gpu",
      gpu0: "solar_detection",
      gpu1: "foundation_embedding_or_local_critic",
      queueEnabled: true,
      autoUnloadAfterSeconds: 600
    },
    models: [
      {modelId:"microsoft_grw", localPath:($modelCacheDir + "/microsoft/global-renewables-watch"), source:"github", task:"solar_farm_detection", category:"utility_scale_solar_detection", licenseStatus:"mit_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:true, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"Primary utility-scale solar PV detection reference."},
      {modelId:"geobase_solar_panel_detection", localPath:($modelCacheDir + "/geobase/solar-panel-detection"), source:"huggingface", task:"rooftop_or_panel_detection", category:"panel_detection", licenseStatus:"mit_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:true, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"ONNX panel detector."},
      {modelId:"geobase_geoai_models", localPath:($modelCacheDir + "/geobase/geoai-models"), source:"huggingface", task:"geospatial_onnx_model_pack", category:"optional_model_pack", licenseStatus:"unknown_warn_required", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"Optional GeoAI ONNX pack."},
      {modelId:"clay", localPath:($modelCacheDir + "/made-with-clay/Clay"), source:"huggingface", task:"earth_observation_embedding", category:"eo_foundation_backbone", licenseStatus:"apache_2_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"Clay EO embeddings."},
      {modelId:"prithvi_100m", localPath:($modelCacheDir + "/ibm-nasa-geospatial/Prithvi-EO-2.0-100M-TL"), source:"huggingface", task:"multispectral_spatiotemporal_backbone", category:"eo_foundation_backbone", licenseStatus:"apache_2_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"Prithvi 100M TL."},
      {modelId:"prithvi_600m", localPath:($modelCacheDir + "/ibm-nasa-geospatial/Prithvi-EO-2.0-600M"), source:"huggingface", task:"large_multispectral_spatiotemporal_backbone", category:"eo_foundation_backbone_large", licenseStatus:"apache_2_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"Prithvi 600M; DOWNLOAD_OPTIONAL_LARGE=true."},
      {modelId:"prithvi_repo", localPath:($modelCacheDir + "/ibm-nasa-geospatial/Prithvi-EO-2.0-repo"), source:"github", task:"prithvi_reference_code", category:"reference_code", licenseStatus:"mit_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"Prithvi reference repo."},
      {modelId:"satlas", localPath:($modelCacheDir + "/allenai/satlas-pretrain"), source:"huggingface", task:"remote_sensing_backbone", category:"eo_foundation_backbone", licenseStatus:"odc_by_or_warn_if_unknown", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"SatlasPretrain backbone."},
      {modelId:"terramind_base", localPath:($modelCacheDir + "/ibm-esa-geospatial/TerraMind-1.0-base"), source:"huggingface", task:"multimodal_earth_observation_backbone", category:"eo_foundation_backbone", licenseStatus:"apache_2_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"TerraMind multimodal EO."},
      {modelId:"dofa", localPath:($modelCacheDir + "/earthflow/DOFA"), source:"huggingface", task:"dynamic_one_for_all_eo_backbone", category:"eo_foundation_backbone", licenseStatus:"cc_by_4_detected_or_warn_if_unknown", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"DOFA; DOWNLOAD_OPTIONAL_LARGE=true."},
      {modelId:"remoteclip", localPath:($modelCacheDir + "/chendelong/RemoteCLIP"), source:"huggingface", task:"remote_sensing_image_text_embedding", category:"image_text_reranking", licenseStatus:"unknown_warn_required", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"RemoteCLIP reranking."},
      {modelId:"local_critic", localPath:$criticPath, source:"huggingface", task:"optional_local_critic", category:"local_llm", licenseStatus:"detect_from_model_card_or_warn", downloadedAt:null, requiredForMVP:false, downloaded:false, sizeBytes:0, sha256File:null, warnings:[], notes:"Optional Qwen critic; DOWNLOAD_LOCAL_LLM=true."}
    ]
  }' >"$REGISTRY_JSON"

echo "Wrote $REGISTRY_JSON"
