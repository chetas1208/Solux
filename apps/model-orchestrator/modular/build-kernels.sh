#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KERNELS="${ROOT}/modular/kernels"

if ! command -v mojo >/dev/null 2>&1; then
  PIXI_MOJO="${ROOT}/.pixi/envs/default/bin/mojo"
  if [[ -x "$PIXI_MOJO" ]]; then
    export PATH="${ROOT}/.pixi/envs/default/bin:${PATH}"
  else
    echo "ERROR: 'mojo' CLI not found. Run: bash scripts/setup-modular.sh" >&2
    exit 1
  fi
fi

cd "$KERNELS"
echo "Building solux_kernels Python extension..."
mojo build --emit shared-lib solux_kernels.mojo -o solux_kernels.so
echo "Built ${KERNELS}/solux_kernels.so"
echo "Test import:"
python3 - <<'PY'
import sys
sys.path.insert(0, "modular/kernels")
import mojo.importer  # noqa: F401
import solux_kernels
print("mojo_status:", solux_kernels.mojo_status())
PY
