#!/usr/bin/env bash
# Restart Cloudflare quick tunnel for the Solux API (fresh public URL).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDFILE="${ROOT}/.cloudflared.pid"
CF="${CLOUDFLARED_BIN:-${HOME}/.local/bin/cloudflared}"

if [[ -f "$PIDFILE" ]]; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  rm -f "$PIDFILE"
fi
pkill -f "cloudflared tunnel --url http://127.0.0.1:8088" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:8088" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:3000" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true
sleep 1
exec bash "${ROOT}/scripts/start-tunnel.sh"
