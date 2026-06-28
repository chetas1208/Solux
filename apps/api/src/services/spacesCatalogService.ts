import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '../config/env.js'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

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

const DATA_ROOT = process.env['DATA_ROOT'] ?? '/data/solux'
const DATASET_PREFIX =
  process.env['SOLUX_DATASET_PREFIX'] ?? 'datasets/solux-site-screening/v0.1'

async function fetchJsonFromSpaces(key: string): Promise<unknown | null> {
  const c = client()
  if (!c || !env.DIGITALOCEAN_SPACES_BUCKET) return null
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

async function readLocalCatalog(): Promise<unknown | null> {
  const paths = [
    join(DATA_ROOT, 'processed/solux_data_catalog.json'),
    join(DATA_ROOT, 'model_input/v0.1/catalog/solux_data_catalog.json'),
  ]
  for (const p of paths) {
    if (existsSync(p)) return JSON.parse(await readFile(p, 'utf8'))
  }
  return null
}

export async function getDatasetCatalog() {
  const local = await readLocalCatalog()
  if (local) return { source: 'local', catalog: local }

  const remote = await fetchJsonFromSpaces(`${DATASET_PREFIX}/catalog/solux_data_catalog.json`)
  if (remote) return { source: 'spaces', catalog: remote }

  return {
    source: 'unavailable',
    catalog: null,
    message: 'Dataset catalog not found locally or in Spaces. Run upload-solux-data.sh.',
  }
}
