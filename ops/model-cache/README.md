# Solux Model Cache

Bash scripts to download, verify, and register open-source geospatial and solar analysis model weights for local experimentation.

**These weights are not integrated into the production Solux product.** They are cached locally for the experimental Python model-server sidecar (`app/`).

## Prerequisites

```bash
# System packages (Ubuntu)
sudo apt-get install -y git git-lfs curl jq

# Hugging Face CLI
pip install huggingface_hub[cli]

# GitHub CLI (optional but recommended)
sudo apt-get install -y gh
gh auth login
```

## Quick start

```bash
export MODEL_CACHE_DIR=/data/models/solux
export HF_TOKEN=hf_...          # required for gated Hugging Face models
export DOWNLOAD_OPTIONAL_LARGE=false
export DOWNLOAD_LOCAL_LLM=false

bash ops/model-cache/download-models.sh
bash ops/model-cache/verify-models.sh
```

`download-models.sh` automatically runs `verify-models.sh` when finished.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_CACHE_DIR` | `/data/models/solux` | Root directory for all cached weights |
| `HF_TOKEN` | unset | Hugging Face token for gated models |
| `DOWNLOAD_OPTIONAL_LARGE` | `false` | Enable Prithvi 600M and DOFA |
| `DOWNLOAD_LOCAL_LLM` | `false` | Download optional Qwen critic model |
| `LOCAL_CRITIC_MODEL_ID` | `Qwen/Qwen2.5-7B-Instruct` | HF id for local critic |
| `COMPUTE_LARGE_CHECKSUMS` | `false` | SHA256 files larger than 5 GB |
| `MIN_FREE_GB_FOR_LARGE` | `120` | Minimum free disk for large downloads |
| `REGISTRY_JSON` | `ops/model-cache/model-registry.json` | Registry path for verify script |

## Model tiers

### Required for MVP

| Model ID | Source | Task |
|----------|--------|------|
| `microsoft_grw` | GitHub + release assets | Utility-scale solar farm detection |
| `geobase_solar_panel_detection` | Hugging Face | Rooftop/panel detection (ONNX preferred) |

### Useful but optional

| Model ID | Source | Task |
|----------|--------|------|
| `clay` | HF + GitHub | EO embeddings |
| `prithvi_100m` | Hugging Face | Multispectral spatiotemporal backbone |
| `satlas` | HF + GitHub | Remote sensing backbone |
| `terramind_base` | HF + GitHub | Multimodal EO backbone |
| `remoteclip` | HF + GitHub | Image-text reranking |
| `geobase_geoai_models` | Hugging Face | Optional ONNX model pack |

### Large optional (`DOWNLOAD_OPTIONAL_LARGE=true`)

| Model ID | Notes |
|----------|-------|
| `prithvi_600m` | ~600M parameter Prithvi backbone |
| `dofa` | Dynamic One-for-All EO backbone |

### Local LLM optional (`DOWNLOAD_LOCAL_LLM=true`)

| Model ID | Notes |
|----------|-------|
| `local_critic` | Qwen2.5-7B-Instruct for critique/reranking via future Modular/MAX endpoint |

## License warnings

Several models have unknown or research-only licenses. Scripts print warnings for:

- `geobase/geoai-models` — license unknown
- `chendelong/RemoteCLIP` — verify before commercial use
- Any model with `*_warn_*` in `licenseStatus`

Inspect each model card before production use.

## Files

- `download-models.sh` — clone/download all models, write checksums, regenerate registry
- `verify-models.sh` — print found/missing status; exits non-zero if MVP models missing
- `model-registry.json` — generated registry consumed by the Python server

## Checksums

After each download, `SHA256SUMS.txt` is written in the model directory for files under 5 GB. Set `COMPUTE_LARGE_CHECKSUMS=true` to include larger files.
