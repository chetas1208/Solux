#!/usr/bin/env bash
# Download and cache open-source geospatial/solar model weights for Solux.
# Does NOT train models. Does NOT fake successful downloads.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_JSON="${SCRIPT_DIR}/model-registry.json"

MODEL_CACHE_DIR="${MODEL_CACHE_DIR:-/data/models/solux}"
DOWNLOAD_OPTIONAL_LARGE="${DOWNLOAD_OPTIONAL_LARGE:-false}"
DOWNLOAD_LOCAL_LLM="${DOWNLOAD_LOCAL_LLM:-false}"
COMPUTE_LARGE_CHECKSUMS="${COMPUTE_LARGE_CHECKSUMS:-false}"
LOCAL_CRITIC_MODEL_ID="${LOCAL_CRITIC_MODEL_ID:-Qwen/Qwen2.5-7B-Instruct}"
MIN_FREE_GB_FOR_LARGE="${MIN_FREE_GB_FOR_LARGE:-120}"

declare -a ALL_WARNINGS=()

log() { printf '[solux-download] %s\n' "$*"; }
warn() { printf '[solux-download] WARNING: %s\n' "$*" >&2; ALL_WARNINGS+=("$*"); }
die() { printf '[solux-download] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
}

check_prerequisites() {
  require_cmd git
  require_cmd git-lfs
  require_cmd huggingface-cli
  require_cmd curl
  require_cmd sha256sum
  require_cmd du
  require_cmd jq
  if ! command -v gh >/dev/null 2>&1; then
    warn "gh CLI not found; will fall back to git clone for GitHub repos"
  fi
}

ensure_cache_dir() {
  mkdir -p "$MODEL_CACHE_DIR"
  log "Model cache directory: $MODEL_CACHE_DIR"
}

init_git_lfs() {
  log "Initializing git-lfs"
  git lfs install --skip-repo >/dev/null 2>&1 || git lfs install >/dev/null 2>&1
}

gh_authenticated() {
  command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1
}

clone_github_repo() {
  local org_repo="$1"
  local dest="$2"
  if [[ -d "$dest/.git" ]]; then
    log "Repo already cloned: $dest (skipping clone)"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  if gh_authenticated; then
    log "Cloning $org_repo -> $dest (gh)"
    gh repo clone "$org_repo" "$dest"
  else
    warn "gh not authenticated; using git clone for public repo $org_repo"
    git clone "https://github.com/${org_repo}.git" "$dest"
  fi
}

hf_needs_auth() {
  local model_id="$1"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "https://huggingface.co/api/models/${model_id}")"
  [[ "$code" == "401" || "$code" == "403" ]]
}

download_hf_model() {
  local model_id="$1"
  local dest="$2"
  local extra_args=("${@:3}")

  if [[ -d "$dest" ]] && find "$dest" -type f ! -name '.git*' ! -name 'SHA256SUMS.txt' 2>/dev/null | grep -q .; then
    local existing_bytes
    existing_bytes="$(du -sb "$dest" 2>/dev/null | cut -f1 || echo 0)"
    if [[ "$existing_bytes" -gt 0 ]]; then
      log "HF model already present: $model_id at $dest ($existing_bytes bytes)"
      return 0
    fi
  fi

  if hf_needs_auth "$model_id" && [[ -z "${HF_TOKEN:-}" ]]; then
    warn "HF model $model_id requires authentication but HF_TOKEN is not set; skipping"
    return 1
  fi

  mkdir -p "$dest"
  log "Downloading HF model $model_id -> $dest"

  local hf_args=(download "$model_id" --local-dir "$dest")
  if huggingface-cli download --help 2>&1 | grep -q 'local-dir-use-symlinks'; then
    hf_args+=(--local-dir-use-symlinks False)
  fi
  if [[ -n "${HF_TOKEN:-}" ]]; then
    export HF_TOKEN
  fi
  hf_args+=("${extra_args[@]}")

  if ! huggingface-cli "${hf_args[@]}"; then
    warn "Failed to download HF model: $model_id"
    return 1
  fi
  return 0
}

download_hf_onnx_prefer() {
  local model_id="$1"
  local dest="$2"
  # Try to fetch ONNX files first; fall back to full repo if none found.
  if download_hf_model "$model_id" "$dest" --include "*.onnx" "*.json" "*.txt" "*.md" 2>/dev/null; then
    if find "$dest" -name '*.onnx' -print -quit | grep -q .; then
      log "ONNX files found for $model_id"
      return 0
    fi
  fi
  download_hf_model "$model_id" "$dest"
}

dir_size_bytes() {
  local path="$1"
  if [[ -d "$path" ]]; then
    du -sb "$path" 2>/dev/null | cut -f1 || echo 0
  else
    echo 0
  fi
}

dir_is_downloaded() {
  local path="$1"
  [[ -d "$path" ]] && [[ "$(dir_size_bytes "$path")" -gt 0 ]]
}

write_checksums() {
  local target_dir="$1"
  local sums_file="${target_dir}/SHA256SUMS.txt"
  [[ -d "$target_dir" ]] || return 0

  log "Writing checksums: $sums_file"
  : >"$sums_file"
  local large_threshold=$((5 * 1024 * 1024 * 1024))

  while IFS= read -r -d '' f; do
    local size
    size="$(stat -c%s "$f" 2>/dev/null || echo 0)"
    if [[ "$size" -ge "$large_threshold" && "$COMPUTE_LARGE_CHECKSUMS" != "true" ]]; then
      echo "# skipped large file (>5GB): ${f#"$target_dir"/} ($size bytes)" >>"$sums_file"
      continue
    fi
    local hash rel
    hash="$(sha256sum "$f" | awk '{print $1}')"
    rel="${f#"$target_dir"/}"
    printf '%s  %s\n' "$hash" "$rel" >>"$sums_file"
  done < <(find "$target_dir" -type f ! -name 'SHA256SUMS.txt' -print0 2>/dev/null)
}

download_grw_release_assets() {
  local repo_dir="$1"
  local models_dir="${repo_dir}/models"
  mkdir -p "$models_dir"

  for asset in solar_model.ckpt wind_model.pth; do
    if [[ -f "${models_dir}/${asset}" ]]; then
      log "GRW release asset already present: ${models_dir}/${asset}"
      continue
    fi

    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
      log "Downloading GRW release asset via gh: $asset"
      gh release download --repo microsoft/global-renewables-watch --pattern "$asset" --dir "$models_dir" || \
        warn "gh release download failed for: $asset"
    else
      local url="https://github.com/microsoft/global-renewables-watch/releases/download/v1.1/${asset}"
      log "Downloading GRW release asset via curl: $asset"
      curl -fL --retry 3 --continue-at - "$url" -o "${models_dir}/${asset}" || \
        warn "curl download failed for GRW asset: $asset"
    fi
  done
}

verify_grw_paths() {
  local repo_dir="$1"
  local missing=0
  for p in inference_solar.py inference_wind.py polygonize.py environment.yml data src models; do
    if [[ ! -e "${repo_dir}/${p}" ]]; then
      warn "GRW expected path missing: ${repo_dir}/${p}"
      missing=$((missing + 1))
    fi
  done
  return 0
}

free_disk_gb() {
  df -BG "$MODEL_CACHE_DIR" 2>/dev/null | awk 'NR==2 {gsub(/G/,"",$4); print $4}' || echo 0
}

should_download_large() {
  [[ "$DOWNLOAD_OPTIONAL_LARGE" == "true" ]] || return 1
  local free_gb
  free_gb="$(free_disk_gb)"
  if [[ "$free_gb" -lt "$MIN_FREE_GB_FOR_LARGE" ]]; then
    warn "DOWNLOAD_OPTIONAL_LARGE=true but only ${free_gb}GB free (need ${MIN_FREE_GB_FOR_LARGE}GB); skipping large model"
    return 1
  fi
  return 0
}

license_warn() {
  local status="$1"
  local model_id="$2"
  case "$status" in
    *warn*|unknown*)
      warn "License/access for $model_id: $status — verify before commercial use"
      ;;
  esac
}

# --- per-model download functions ---

download_microsoft_grw() {
  local dest="${MODEL_CACHE_DIR}/microsoft/global-renewables-watch"
  clone_github_repo "microsoft/global-renewables-watch" "$dest"
  download_grw_release_assets "$dest"
  verify_grw_paths "$dest"
  write_checksums "$dest"
  echo "$dest"
}

download_geobase_solar_panel() {
  local dest="${MODEL_CACHE_DIR}/geobase/solar-panel-detection"
  download_hf_onnx_prefer "geobase/solar-panel-detection" "$dest" || true
  write_checksums "$dest"
  echo "$dest"
}

download_geobase_geoai_models() {
  local dest="${MODEL_CACHE_DIR}/geobase/geoai-models"
  download_hf_model "geobase/geoai-models" "$dest" || true
  write_checksums "$dest"
  echo "$dest"
}

download_clay() {
  local hf_dest="${MODEL_CACHE_DIR}/made-with-clay/Clay"
  local repo_dest="${MODEL_CACHE_DIR}/made-with-clay/model-repo"
  download_hf_model "made-with-clay/Clay" "$hf_dest" || true
  clone_github_repo "Clay-foundation/model" "$repo_dest" || clone_github_repo "clay-foundation/model" "$repo_dest" || true
  write_checksums "$hf_dest"
  write_checksums "$repo_dest"
  echo "$hf_dest"
}

download_prithvi_100m() {
  local dest="${MODEL_CACHE_DIR}/ibm-nasa-geospatial/Prithvi-EO-2.0-100M-TL"
  download_hf_model "ibm-nasa-geospatial/Prithvi-EO-2.0-100M-TL" "$dest" || true
  write_checksums "$dest"
  echo "$dest"
}

download_prithvi_600m() {
  local dest="${MODEL_CACHE_DIR}/ibm-nasa-geospatial/Prithvi-EO-2.0-600M"
  if should_download_large; then
    download_hf_model "ibm-nasa-geospatial/Prithvi-EO-2.0-600M" "$dest" || true
    write_checksums "$dest"
  else
    warn "Skipping Prithvi 600M (set DOWNLOAD_OPTIONAL_LARGE=true to enable)"
  fi
  echo "$dest"
}

download_prithvi_repo() {
  local dest="${MODEL_CACHE_DIR}/ibm-nasa-geospatial/Prithvi-EO-2.0-repo"
  clone_github_repo "NASA-IMPACT/Prithvi-EO-2.0" "$dest" || true
  write_checksums "$dest"
  echo "$dest"
}

download_satlas() {
  local hf_dest="${MODEL_CACHE_DIR}/allenai/satlas-pretrain"
  local repo_dest="${MODEL_CACHE_DIR}/allenai/satlaspretrain_models"
  download_hf_model "allenai/satlas-pretrain" "$hf_dest" || true
  clone_github_repo "allenai/satlaspretrain_models" "$repo_dest" || true
  write_checksums "$hf_dest"
  write_checksums "$repo_dest"
  echo "$hf_dest"
}

download_terramind() {
  local hf_dest="${MODEL_CACHE_DIR}/ibm-esa-geospatial/TerraMind-1.0-base"
  local repo_dest="${MODEL_CACHE_DIR}/ibm-esa-geospatial/terramind-repo"
  download_hf_model "ibm-esa-geospatial/TerraMind-1.0-base" "$hf_dest" || true
  clone_github_repo "IBM/terramind" "$repo_dest" || true
  write_checksums "$hf_dest"
  write_checksums "$repo_dest"
  echo "$hf_dest"
}

download_dofa() {
  local hf_dest="${MODEL_CACHE_DIR}/earthflow/DOFA"
  local repo_dest="${MODEL_CACHE_DIR}/earthflow/DOFA-repo"
  if should_download_large; then
    download_hf_model "earthflow/DOFA" "$hf_dest" || true
    clone_github_repo "zhu-xlab/DOFA" "$repo_dest" || true
    write_checksums "$hf_dest"
    write_checksums "$repo_dest"
  else
    warn "Skipping DOFA (set DOWNLOAD_OPTIONAL_LARGE=true to enable)"
  fi
  echo "$hf_dest"
}

download_remoteclip() {
  local hf_dest="${MODEL_CACHE_DIR}/chendelong/RemoteCLIP"
  local repo_dest="${MODEL_CACHE_DIR}/chendelong/RemoteCLIP-repo"
  download_hf_model "chendelong/RemoteCLIP" "$hf_dest" || true
  clone_github_repo "ChenDelong1999/RemoteCLIP" "$repo_dest" || true
  write_checksums "$hf_dest"
  write_checksums "$repo_dest"
  echo "$hf_dest"
}

download_local_critic() {
  local critic_id="$LOCAL_CRITIC_MODEL_ID"
  local safe_name
  safe_name="$(echo "$critic_id" | tr '/' '-')"
  local dest="${MODEL_CACHE_DIR}/local-critic/${safe_name}"
  if [[ "$DOWNLOAD_LOCAL_LLM" == "true" ]]; then
    download_hf_model "$critic_id" "$dest" || true
    write_checksums "$dest"
  else
    warn "Skipping local LLM critic (set DOWNLOAD_LOCAL_LLM=true to enable)"
  fi
  echo "$dest"
}

generate_registry() {
  local now
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  declare -A PATHS=(
    [microsoft_grw]="${MODEL_CACHE_DIR}/microsoft/global-renewables-watch"
    [geobase_solar_panel_detection]="${MODEL_CACHE_DIR}/geobase/solar-panel-detection"
    [geobase_geoai_models]="${MODEL_CACHE_DIR}/geobase/geoai-models"
    [clay]="${MODEL_CACHE_DIR}/made-with-clay/Clay"
    [prithvi_100m]="${MODEL_CACHE_DIR}/ibm-nasa-geospatial/Prithvi-EO-2.0-100M-TL"
    [prithvi_600m]="${MODEL_CACHE_DIR}/ibm-nasa-geospatial/Prithvi-EO-2.0-600M"
    [prithvi_repo]="${MODEL_CACHE_DIR}/ibm-nasa-geospatial/Prithvi-EO-2.0-repo"
    [satlas]="${MODEL_CACHE_DIR}/allenai/satlas-pretrain"
    [terramind_base]="${MODEL_CACHE_DIR}/ibm-esa-geospatial/TerraMind-1.0-base"
    [dofa]="${MODEL_CACHE_DIR}/earthflow/DOFA"
    [remoteclip]="${MODEL_CACHE_DIR}/chendelong/RemoteCLIP"
    [local_critic]="${MODEL_CACHE_DIR}/local-critic/$(echo "$LOCAL_CRITIC_MODEL_ID" | tr '/' '-')"
  )

  model_entry() {
    local id="$1" path="$2" source="$3" task="$4" category="$5" license="$6" mvp="$7" notes="$8"
    local downloaded=false size=0 sha_file=null downloaded_at=null
    local entry_warnings='[]'

    if dir_is_downloaded "$path"; then
      downloaded=true
      size="$(dir_size_bytes "$path")"
      downloaded_at="\"$now\""
      if [[ -f "${path}/SHA256SUMS.txt" ]]; then
        sha_file='"SHA256SUMS.txt"'
      fi
    fi

    license_warn "$license" "$id"

    jq -n \
      --arg modelId "$id" \
      --arg localPath "$path" \
      --arg source "$source" \
      --arg task "$task" \
      --arg category "$category" \
      --arg licenseStatus "$license" \
      --argjson requiredForMVP "$mvp" \
      --argjson downloaded "$downloaded" \
      --argjson sizeBytes "$size" \
      --arg notes "$notes" \
      --argjson downloadedAt "${downloaded_at:-null}" \
      --argjson sha256File "${sha_file:-null}" \
      '{
        modelId: $modelId,
        localPath: $localPath,
        source: $source,
        task: $task,
        category: $category,
        licenseStatus: $licenseStatus,
        downloadedAt: $downloadedAt,
        requiredForMVP: $requiredForMVP,
        downloaded: $downloaded,
        sizeBytes: $sizeBytes,
        sha256File: $sha256File,
        warnings: [],
        notes: $notes
      }'
  }

  local models_json='[]'

  models_json="$(jq -n --argjson e "$(model_entry "microsoft_grw" "${PATHS[microsoft_grw]}" "github" "solar_farm_detection" "utility_scale_solar_detection" "mit_detected_or_warn_if_unknown" true "Primary reference for utility-scale solar PV detection from GeoTIFF imagery.")" '[$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "geobase_solar_panel_detection" "${PATHS[geobase_solar_panel_detection]}" "huggingface" "rooftop_or_panel_detection" "panel_detection" "mit_detected_or_warn_if_unknown" true "ONNX/MaskRCNN-style panel detector for rooftop experiments.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "geobase_geoai_models" "${PATHS[geobase_geoai_models]}" "huggingface" "geospatial_onnx_model_pack" "optional_model_pack" "unknown_warn_required" false "Optional GeoAI model pack for inspection.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "clay" "${PATHS[clay]}" "huggingface" "earth_observation_embedding" "eo_foundation_backbone" "apache_2_detected_or_warn_if_unknown" false "EO backbone embeddings; experimental endpoint only.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "prithvi_100m" "${PATHS[prithvi_100m]}" "huggingface" "multispectral_spatiotemporal_backbone" "eo_foundation_backbone" "apache_2_detected_or_warn_if_unknown" false "Prithvi EO 2.0 100M TL backbone.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "prithvi_600m" "${PATHS[prithvi_600m]}" "huggingface" "large_multispectral_spatiotemporal_backbone" "eo_foundation_backbone_large" "apache_2_detected_or_warn_if_unknown" false "Prithvi 600M; requires DOWNLOAD_OPTIONAL_LARGE=true.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "prithvi_repo" "${PATHS[prithvi_repo]}" "github" "prithvi_reference_code" "reference_code" "mit_detected_or_warn_if_unknown" false "Prithvi reference code repo.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "satlas" "${PATHS[satlas]}" "huggingface" "remote_sensing_backbone" "eo_foundation_backbone" "odc_by_or_warn_if_unknown" false "SatlasPretrain remote sensing backbone.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "terramind_base" "${PATHS[terramind_base]}" "huggingface" "multimodal_earth_observation_backbone" "eo_foundation_backbone" "apache_2_detected_or_warn_if_unknown" false "TerraMind multimodal EO backbone.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "dofa" "${PATHS[dofa]}" "huggingface" "dynamic_one_for_all_eo_backbone" "eo_foundation_backbone" "cc_by_4_detected_or_warn_if_unknown" false "DOFA arbitrary-channel EO backbone; large optional.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "remoteclip" "${PATHS[remoteclip]}" "huggingface" "remote_sensing_image_text_embedding" "image_text_reranking" "unknown_warn_required" false "RemoteCLIP image-text reranking; verify license.")" '. + [$e]')"
  models_json="$(echo "$models_json" | jq --argjson e "$(model_entry "local_critic" "${PATHS[local_critic]}" "huggingface" "optional_local_critic" "local_llm" "detect_from_model_card_or_warn" false "Optional local LLM for critique/reranking via Modular/MAX.")" '. + [$e]')"

  jq -n \
    --arg generatedAt "$now" \
    --arg modelCacheDir "$MODEL_CACHE_DIR" \
    --argjson models "$models_json" \
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
      models: $models
    }' >"$REGISTRY_JSON"

  log "Wrote registry: $REGISTRY_JSON"
}

main() {
  log "Starting Solux model cache download"
  check_prerequisites
  ensure_cache_dir
  init_git_lfs

  license_warn "unknown_warn_required" "geobase/geoai-models"
  license_warn "unknown_warn_required" "chendelong/RemoteCLIP"

  download_microsoft_grw >/dev/null
  download_geobase_solar_panel >/dev/null
  download_geobase_geoai_models >/dev/null
  download_clay >/dev/null
  download_prithvi_100m >/dev/null
  download_prithvi_600m >/dev/null
  download_prithvi_repo >/dev/null
  download_satlas >/dev/null
  download_terramind >/dev/null
  download_dofa >/dev/null
  download_remoteclip >/dev/null
  download_local_critic >/dev/null

  generate_registry

  log "Download phase complete. Running verify-models.sh ..."
  bash "${SCRIPT_DIR}/verify-models.sh"
}

main "$@"
