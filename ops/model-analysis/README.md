# Solux Model Analysis

Hosted model endpoint integration with deterministic baseline fallback.

## Flow

1. `modelEndpointClient.ts` — probe `/health`, `/models`, `/analyze`, etc.
2. `run-model-analysis.ts` — batch candidates from parquet, optional rerank
3. `validateModelOutputs.ts` — schema validation before upload
4. `push-model-outputs.ts` — upload to `outputs/solux-site-screening/v0.1/`
5. `learningLoop.ts` — query/feedback logging, scoring policy versioning

## Run

```bash
cd ops/model-analysis
pnpm exec tsx modelEndpointClient.ts
pnpm exec tsx run-model-analysis.ts
```

Or end-to-end: `pnpm data:sync` from repo root (requires validated dataset + Spaces creds).

## Safety

- Never sends Spaces credentials or secrets to `SOLUX_MODEL_ENDPOINT`
- Endpoint down → deterministic scoring only, no fake model outputs
- Malformed responses → quarantine directory
