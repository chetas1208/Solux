#!/usr/bin/env tsx
/**
 * Full model pipeline: download inputs → probe endpoint → analyze → upload → Mongo refs.
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const repoRoot = resolve(import.meta.dirname, '../..')
if (existsSync(resolve(repoRoot, '.env'))) {
  loadEnv({ path: resolve(repoRoot, '.env'), override: true })
}

import { execSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { runModelAnalysis } from './run-model-analysis.js'
import { pushModelOutputs } from './push-model-outputs.js'
import { probeModelEndpoint } from './modelEndpointClient.js'
import { manifestsDir, modelInputDir, writeJson, envPath } from './config.js'
import {
  insertModelOutputRefs,
  insertSystemReadinessSnapshot,
} from '../../apps/api/src/db/repositories/lakeRepositories.js'

function s3Key(uri: string | null): string | null {
  if (!uri?.startsWith('s3://')) return null
  const rest = uri.slice(5)
  return rest.slice(rest.indexOf('/') + 1)
}

function downloadFromSpaces(key: string, dest: string) {
  const bucket = envPath('DIGITALOCEAN_SPACES_BUCKET', '')
  const endpoint = envPath('DIGITALOCEAN_SPACES_ENDPOINT', '')
  execSync(
    `mkdir -p "$(dirname "${dest}")" && aws s3 cp "s3://${bucket}/${key}" "${dest}" --endpoint-url "${endpoint}"`,
    { stdio: 'inherit' },
  )
}

async function downloadModelInputs() {
  const dataRoot = envPath('DATA_ROOT', '/data/solux')
  const resolvedPath = join(dataRoot, 'manifests/resolved_data_paths.json')
  if (!existsSync(resolvedPath)) {
    console.warn('[WARN] resolved_data_paths.json missing — using local processed files if present')
    return
  }
  const resolved = JSON.parse(await readFile(resolvedPath, 'utf8')) as {
    processed: Record<string, string | null>
    catalog: Record<string, string | null>
  }
  const input = modelInputDir()
  const pairs: Array<[string, string]> = [
    [s3Key(resolved.processed.candidateSitesParquet)!, join(input, 'processed/candidates/solux_candidate_sites.parquet')],
    [s3Key(resolved.processed.siteScoresParquet)!, join(input, 'processed/scoring/solux_site_scores.parquet')],
    [s3Key(resolved.catalog.soluxDataCatalog)!, join(input, 'catalog/solux_data_catalog.json')],
  ].filter(([k]) => Boolean(k))

  for (const [key, dest] of pairs) {
    if (!existsSync(dest)) downloadFromSpaces(key, dest)
  }
}

async function ingestModelRefsToMongo(datasetVersion: string) {
  const outDir = join(envPath('DATA_ROOT', '/data/solux'), 'model_outputs', envPath('DATASET_VERSION', 'v0.1'))
  const rerankPath = join(outDir, 'model_reranked_sites.json')
  if (!existsSync(rerankPath)) return 0
  const sites = JSON.parse(await readFile(rerankPath, 'utf8')) as Array<Record<string, unknown>>
  const refs = sites.slice(0, 50000).map((s) => ({
    datasetVersion,
    candidateId: String(s.candidateId),
    modelRunId: `run-${new Date().toISOString().slice(0, 10)}`,
    modelScore: Number(s.modelScore ?? 0),
    modelConfidence: Number(s.modelConfidence ?? 0),
    reasoningSummary: String(s.reasoningSummary ?? ''),
    spacesObjectRefs: {
      modelRerankedSites: `outputs/solux-site-screening/${datasetVersion}/model_outputs/model_reranked_sites.json`,
    },
  }))
  await insertModelOutputRefs(refs)
  return refs.length
}

export async function runFullModelPipeline() {
  const datasetVersion = envPath('DATASET_VERSION', 'v0.1')
  const runModel = envPath('RUN_MODEL_ANALYSIS', 'true') === 'true'

  await downloadModelInputs()

  const capabilities = await probeModelEndpoint()
  await writeJson(join(manifestsDir(), 'model_endpoint_capabilities.json'), capabilities)

  let modelUsed = false
  let assessmentCount = 0
  if (runModel) {
    const result = await runModelAnalysis()
    modelUsed = result.modelUsed
    assessmentCount = result.assessments.length
  } else {
    console.log('[SKIP] RUN_MODEL_ANALYSIS=false')
  }

  if (envPath('PUSH_MODEL_OUTPUTS', 'true') === 'true') {
    await pushModelOutputs()
  }

  let refCount = 0
  if (process.env['MONGODB_URI']) {
    refCount = await ingestModelRefsToMongo(datasetVersion)
    await insertSystemReadinessSnapshot({
      modelOutputsReady: assessmentCount > 0,
      modelEndpointReady: capabilities.reachable,
      modelUsed,
      modelOutputRefCount: refCount,
      datasetVersion,
    })
  }

  const summary = {
    modelEndpointReady: capabilities.reachable,
    modelUsed,
    assessmentCount,
    modelOutputRefsInMongo: refCount,
    capabilities,
  }
  console.log('[OK] Full model pipeline complete', JSON.stringify(summary, null, 2))
  return summary
}

if (process.argv[1]?.endsWith('run-full-model-pipeline.ts')) {
  runFullModelPipeline().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
