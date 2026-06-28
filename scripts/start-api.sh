#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
set -a
[[ -f .env ]] && source .env
set +a
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8088}"
LOG="${ROOT}/server.log"
PIDFILE="${ROOT}/.api.pid"

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "API already running (pid $(cat "$PIDFILE"))"
  exit 0
fi

nohup .venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT" >>"$LOG" 2>&1 &
echo $! >"$PIDFILE"
sleep 2
curl -sf "http://127.0.0.1:${PORT}/health" | head -c 200 || { echo "Health check failed; see $LOG"; exit 1; }
echo
echo "API pid=$(cat "$PIDFILE") on http://${HOST}:${PORT}"
