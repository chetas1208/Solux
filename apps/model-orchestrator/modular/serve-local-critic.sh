#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
[[ -f "${ROOT}/.env" ]] && source "${ROOT}/.env"
set +a

MAX_CRITIC_MODEL_PATH="${MAX_CRITIC_MODEL_PATH:-${MODEL_CACHE_DIR:-/home/923873155/solux_models/data/models/solux}/local-critic/Qwen-Qwen2.5-7B-Instruct}"
MAX_CRITIC_PORT="${MAX_CRITIC_PORT:-8010}"
MAX_CRITIC_GPU="${MAX_CRITIC_GPU:-1}"
MAX_CRITIC_DEVICES="${MAX_CRITIC_DEVICES:-gpu:0}"
MAX_QUANTIZATION_ENCODING="${MAX_QUANTIZATION_ENCODING:-float32}"
MAX_BATCH_SIZE="${MAX_BATCH_SIZE:-4}"
MAX_DEVICE_MEMORY_UTILIZATION="${MAX_DEVICE_MEMORY_UTILIZATION:-0.85}"
LOG="${ROOT}/max-critic.log"
PIDFILE="${ROOT}/.max-critic.pid"
PIXI_BIN="${ROOT}/.pixi/envs/default/bin"

if ! command -v max >/dev/null 2>&1; then
  if [[ -x "${PIXI_BIN}/max" ]]; then
    export PATH="${PIXI_BIN}:${PATH}"
  else
    echo "ERROR: 'max' CLI not found. Run: bash scripts/setup-modular.sh" >&2
    echo "Critic endpoint will be unavailable; core pipelines continue without it." >&2
    exit 1
  fi
fi

if [[ ! -d "$MAX_CRITIC_MODEL_PATH" ]]; then
  echo "ERROR: Model path not found: $MAX_CRITIC_MODEL_PATH" >&2
  exit 1
fi

if ss -ltn 2>/dev/null | grep -q ":${MAX_CRITIC_PORT} "; then
  echo "Port ${MAX_CRITIC_PORT} already in use"
  exit 1
fi

if [[ "$MAX_CRITIC_DEVICES" == cpu* ]]; then
  unset CUDA_VISIBLE_DEVICES
else
  export CUDA_VISIBLE_DEVICES="${MAX_CRITIC_GPU}"
fi
nohup max serve \
  --model "$MAX_CRITIC_MODEL_PATH" \
  --devices "$MAX_CRITIC_DEVICES" \
  --quantization-encoding "$MAX_QUANTIZATION_ENCODING" \
  --max-batch-size "$MAX_BATCH_SIZE" \
  --device-memory-utilization "$MAX_DEVICE_MEMORY_UTILIZATION" \
  --port "$MAX_CRITIC_PORT" \
  >>"$LOG" 2>&1 &
echo $! >"$PIDFILE"
sleep 5

echo "MAX critic pid=$(cat "$PIDFILE")"
echo "  http://localhost:${MAX_CRITIC_PORT}/v1/chat/completions"
echo "  http://localhost:${MAX_CRITIC_PORT}/v1/models"
echo "  http://localhost:${MAX_CRITIC_PORT}/v1/health"
