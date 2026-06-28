import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '../config/env.js'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const DATA_ROOT = process.env['DATA_ROOT'] ?? '/data/solux'
const OUTPUT_PREFIX =
  process.env['SOLUX_OUTPUT_PREFIX'] ?? 'outputs/solux-site-screening/v0.1'

function client() {
  if (!env.DIGITALOCEAN_SPACES_ENDPOINT || !env.DIGITALOCEAN_SPACES_KEY) return null
  return new S3Client({
    endpoint: env.DIGITALOCEAN_SPACES_ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: env.DIGITALOCEAN_SPACES_KEY,
      secretAccessKey: env.DIGITALOCEAN_SPACES_SECRET,
    },
  })
}

async function readLocalManifest() {
  const p = join(DATA_ROOT, 'model_outputs/v0.1/model_analysis_manifest.json')
  if (existsSync(p)) return JSON.parse(await readFile(p, 'utf8'))
  return null
}

async function readLocalCapabilities() {
  const p = join(DATA_ROOT, 'manifests/model_endpoint_capabilities.json')
  if (existsSync(p)) return JSON.parse(await readFile(p, 'utf8'))
  return null
}

async function fetchSpacesJson(key: string) {
  const c = client()
  if (!c) return null
  try {
    const res = await c.send(
      new GetObjectCommand({ Bucket: env.DIGITALOCEAN_SPACES_BUCKET, Key: key }),
    )
    const body = await res.Body?.transformToString()
    return body ? JSON.parse(body) : null
  } catch {
    return null
  }
}

async function probeModelEndpointLive(): Promise<Record<string, unknown> | null> {
  const base = (process.env['SOLUX_MODEL_ENDPOINT'] ?? env.SOLUX_MODEL_ENDPOINT)
    .replace(/\/$/, '')
    .replace(/\/docs$/, '')
  if (!base) return null
  try {
    const auth = process.env['SOLUX_MODEL_ENDPOINT_AUTH'] ?? env.SOLUX_MODEL_ENDPOINT_AUTH
    const headers: Record<string, string> = {}
    if (auth) headers['Authorization'] = `Bearer ${auth}`
    const [health, models] = await Promise.all([
      fetch(`${base}/health`, { signal: AbortSignal.timeout(8000), headers }),
      fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(8000), headers }),
    ])
    const reachable = health.ok || models.ok
    const supportedRoutes: string[] = []
    if (health.ok) supportedRoutes.push('GET /health')
    if (models.ok) supportedRoutes.push('GET /v1/models')
    let supportedModels: string[] = []
    if (models.ok) {
      const json = (await models.json().catch(() => null)) as {
        data?: Array<{ id: string }>
        models?: Array<{ name: string }>
      } | null
      supportedModels = json?.data?.map((m) => m.id) ?? json?.models?.map((m) => m.name) ?? []
    }
    return {
      endpointUrl: base,
      checkedAt: new Date().toISOString(),
      reachable,
      supportedRoutes,
      supportedModels,
      errors: reachable ? [] : ['Health/models probe failed'],
      warnings: [],
    }
  } catch (err) {
    return {
      endpointUrl: base,
      checkedAt: new Date().toISOString(),
      reachable: false,
      supportedRoutes: [],
      supportedModels: [],
      errors: [String(err)],
      warnings: ['Live probe failed'],
    }
  }
}

export async function getModelOutputStatus() {
  const manifest =
    (await readLocalManifest()) ??
    (await fetchSpacesJson(`${OUTPUT_PREFIX}/model_outputs/model_analysis_manifest.json`))
  const capabilities =
    (await probeModelEndpointLive()) ??
    (await readLocalCapabilities()) ??
    (await fetchSpacesJson(`${OUTPUT_PREFIX}/model_outputs/endpoint_capabilities.json`))

  return {
    outputsAvailable: Boolean(manifest),
    lastRun: manifest?.runAt ?? null,
    candidateCount: manifest?.candidateCount ?? 0,
    modelEndpointReachable: capabilities?.reachable ?? false,
    modelUsed: manifest?.modelUsed ?? false,
    capabilities,
    message: manifest
      ? 'Model analysis outputs available'
      : 'Model reranking unavailable; deterministic evidence scoring active.',
  }
}

export async function getModelRerankForProject(_projectId: string) {
  const rerankPath = join(DATA_ROOT, 'model_outputs/v0.1/model_reranked_sites.json')
  if (!existsSync(rerankPath)) {
    return { available: false, sites: [], message: 'No model rerank outputs — using deterministic scores' }
  }
  const sites = JSON.parse(await readFile(rerankPath, 'utf8')) as unknown[]
  return { available: true, sites: sites.slice(0, 100) }
}
