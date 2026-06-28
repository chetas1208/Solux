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

export async function getModelOutputStatus() {
  const manifest =
    (await readLocalManifest()) ??
    (await fetchSpacesJson(`${OUTPUT_PREFIX}/model_outputs/model_analysis_manifest.json`))
  const capabilities =
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
