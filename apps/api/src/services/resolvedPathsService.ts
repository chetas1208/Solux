import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface ResolvedDataPaths {
  bucket: string
  endpoint: string
  checkedAt: string
  datasetVersion: string
  datasetPrefix: string
  outputPrefix: string
  runPrefix: string
  catalog: Record<string, string | null>
  processed: Record<string, string | null>
  tiles: Record<string, string | null>
  modelOutputs: Record<string, string | null>
  missingExpectedObjects: string[]
  warnings: string[]
  objectCounts: Record<string, number>
  totalSizeBytes: number
}

const DATA_ROOT = process.env['DATA_ROOT'] ?? '/data/solux'

export async function loadResolvedDataPaths(): Promise<ResolvedDataPaths | null> {
  const path = join(DATA_ROOT, 'manifests/resolved_data_paths.json')
  if (!existsSync(path)) return null
  return JSON.parse(await readFile(path, 'utf8')) as ResolvedDataPaths
}

export function s3KeyFromUri(uri: string | null | undefined): string | null {
  if (!uri?.startsWith('s3://')) return null
  const without = uri.slice('s3://'.length)
  const slash = without.indexOf('/')
  return slash >= 0 ? without.slice(slash + 1) : null
}

export function spacesReady(paths: ResolvedDataPaths | null): boolean {
  if (!paths) return false
  return Boolean(
    paths.catalog.soluxDataCatalog &&
      paths.processed.candidateSitesParquet &&
      paths.processed.siteScoresParquet,
  )
}
