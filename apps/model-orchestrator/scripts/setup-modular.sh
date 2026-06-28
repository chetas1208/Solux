#!/usr/bin/env bash
# Install Modular Mojo + MAX into a project-local pixi environment.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pixi >/dev/null 2>&1; then
  echo "Installing pixi..."
  curl -fsSL https://pixi.sh/install.sh | sh
  export PATH="${HOME}/.pixi/bin:${PATH}"
fi

if [[ ! -f pixi.toml ]]; then
  echo "ERROR: pixi.toml missing in ${ROOT}" >&2
  exit 1
fi

pixi install
echo
echo "Modular toolchain installed in .pixi/envs/default"
echo "  eval \"\$(pixi shell-hook)\"   # add mojo/max to PATH for this shell"
echo "  bash modular/build-kernels.sh  # compile solux_kernels.mojo"
echo "  bash modular/serve-local-critic.sh  # start MAX critic on GPU 1"
