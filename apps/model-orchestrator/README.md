# Solux Model Orchestrator

Production-shaped **model orchestration backend** for Solux solar/geospatial analysis: routing, GPU scheduling, caching, Modular/MAX local critic, and real continual-learning feedback loops.

> Experimental sidecar — not integrated into the main Solux product until endpoints are tested and wired.

## Architecture

| Layer | Technology |
|-------|------------|
| API | FastAPI |
| Vision/geospatial models | Python providers (GRW, geobase ONNX, Clay, Prithvi, …) |
| Local LLM critic | Modular/MAX OpenAI-compatible endpoint (Qwen2.5-7B) |
| Performance kernels | **Mojo** (`modular/kernels/solux_kernels.mojo`) with NumPy fallback |

## MVP models (required)

- **microsoft_grw** — utility-scale solar farm detection from GeoTIFF
- **geobase_solar_panel_detection** — rooftop/panel ONNX detection

## Optional models

Clay, Prithvi 100M/600M, Satlas (72G — deep mode only), TerraMind, DOFA, RemoteCLIP, local Qwen critic via MAX.

## Start services

```bash
export MODEL_CACHE_DIR=/home/923873155/solux_models/data/models/solux
bash ops/model-cache/verify-models.sh

bash scripts/start-api.sh          # nohup API on :8088
bash scripts/start-tunnel.sh       # nohup Cloudflare quick tunnel
bash modular/serve-local-critic.sh # MAX Qwen on :8010 (GPU 1)
bash scripts/setup-modular.sh      # install Mojo + MAX via pixi (enables native kernels)
bash modular/build-kernels.sh      # pre-compile solux_kernels.mojo (optional)
```

## Test endpoints

```bash
curl http://localhost:8088/health
curl http://localhost:8088/models
curl -X POST http://localhost:8088/route -H 'Content-Type: application/json' -d '{
  "jobType": "utility_solar_detection",
  "latencyMode": "fast",
  "inputFiles": [{"type": "geotiff", "path": "/path/to/scene.tif"}]
}'
curl http://localhost:8010/v1/models
```

## Continual learning

1. Preference profiles — immediate personalization
2. Online ranker — incremental feedback updates
3. Active-learning queue — uncertain cases
4. Offline promotion — versioned after evaluation

No foundation-model training during live requests.
