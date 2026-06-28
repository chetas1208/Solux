# Solux Mojo Score Kernel

This directory contains an optional Mojo kernel for weighted score aggregation.

## What the kernel does

Takes an array of dimension scores and weights, returns the weighted final score.
This is numerically trivial but serves as the Mojo integration demonstration.

## Requirements

- Mojo CLI (Magic or MAX SDK): https://docs.modular.com/mojo/manual/get-started/
- Compile the kernel before use (not required for app boot)

## Compile

```bash
# Install Magic (Mojo package manager)
curl -ssL https://magic.modular.com | bash

# Compile the kernel
cd apps/api/src/mojo/kernels
magic run mojo build solux_score_kernel.mojo -o solux_score_kernel_bin

# Set the binary path
export MOJO_SCORE_KERNEL_BIN=$(pwd)/solux_score_kernel_bin
```

## Usage

When `MOJO_SCORE_KERNEL_BIN` is set and the binary exists, the screening job
automatically uses the Mojo kernel for final score computation.

If the binary is absent, the TypeScript fallback in `scoreKernelFallback.ts` is used.
The app starts and scores correctly without the Mojo binary.

## Kernel I/O

Input (stdin, space-separated floats): `score0 weight0 score1 weight1 ... scoreN weightN`
Output (stdout): `finalScore\n` — a single float 0–100

## Model registry

Compiled kernels are tracked in `models/manifests/registry.json`:
```json
[{
  "name": "solux_score_kernel",
  "version": "0.1.0",
  "type": "mojo_kernel",
  "path": "apps/api/src/mojo/kernels/solux_score_kernel_bin",
  "checksum": "",
  "compiledAt": "2026-06-27T00:00:00Z",
  "description": "Weighted score aggregation kernel"
}]
```

Set `MODEL_REGISTRY_DIR` to `models/manifests` to enable registry tracking.
