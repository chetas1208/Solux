#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SOLUX_TUNNEL_PORT:-3000}"
LOG="${ROOT}/cloudflared.log"
PIDFILE="${ROOT}/.cloudflared.pid"
CF="${CLOUDFLARED_BIN:-${HOME}/.local/bin/cloudflared}"

if [[ ! -x "$CF" ]]; then
  echo "cloudflared not found at $CF" >&2
  exit 1
fi

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Tunnel already running (pid $(cat "$PIDFILE"))"
  grep -o 'https://[^ ]*trycloudflare.com' "$LOG" 2>/dev/null | tail -1 || true
  exit 0
fi

nohup "$CF" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate >>"$LOG" 2>&1 &
echo $! >"$PIDFILE"
sleep 4
URL="$(grep -o 'https://[^ ]*trycloudflare.com' "$LOG" 2>/dev/null | tail -1 || true)"
echo "$URL" >"${ROOT}/public_url.txt"
echo "Tunnel pid=$(cat "$PIDFILE")"
echo "Public URL: ${URL:-see $LOG}"
