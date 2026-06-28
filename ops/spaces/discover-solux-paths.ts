#!/usr/bin/env tsx
/**
 * Discover real Solux object paths in DigitalOcean Spaces.
 * Writes: spaces_discovery_report.json, spaces_object_inventory.json, resolved_data_paths.json
 */
import { execSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

interface InventoryObject {
  key: string
  sizeBytes: number
  lastModified?: string
}

interface ResolvedPaths {
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

function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() ?? fallback
}

function s3Uri(bucket: string, key: string): string {
  return `s3://${bucket}/${key.replace(/^\//, '')}`
}

function listPrefix(
  bucket: string,
  prefix: string,
  endpoint: string,
): { objects: InventoryObject[]; totalBytes: number } {
  const objects: InventoryObject[] = []
  let totalBytes = 0
  try {
    const out = execSync(
      `aws s3 ls "s3://${bucket}/${prefix}" --recursive --endpoint-url "${endpoint}"`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(\d+)\s+(.+)$/)
      if (!m) continue
      const sizeBytes = Number(m[2])
      const key = m[3]!.trim()
      objects.push({ key, sizeBytes, lastModified: m[1] })
      totalBytes += sizeBytes
    }
  } catch {
    /* prefix may not exist */
  }
  return { objects, totalBytes }
}

function findKey(objects: InventoryObject[], pattern: RegExp): string | null {
  const hit = objects.find((o) => pattern.test(o.key))
  return hit ? hit.key : null
}

function findPrefix(objects: InventoryObject[], prefixFragment: string): string | null {
  const hit = objects.find((o) => o.key.includes(prefixFragment))
  return hit ? hit.key : null
}

async function main() {
  const endpoint = env('DIGITALOCEAN_SPACES_ENDPOINT')
  const bucket = env('DIGITALOCEAN_SPACES_BUCKET')
  const dataRoot = env('DATA_ROOT', '/data/solux')
  const datasetVersion = env('DATASET_VERSION', 'v0.1')
  const datasetPrefix = env('SOLUX_DATASET_PREFIX', `datasets/solux-site-screening/${datasetVersion}`)
  const outputPrefix = env('SOLUX_OUTPUT_PREFIX', `outputs/solux-site-screening/${datasetVersion}`)
  const runPrefix = env('SOLUX_RUN_PREFIX', `runs/solux-site-screening/${datasetVersion}`)

  if (!endpoint) throw new Error('DIGITALOCEAN_SPACES_ENDPOINT not set')
  if (!bucket) throw new Error('DIGITALOCEAN_SPACES_BUCKET not set')
  if (!env('AWS_ACCESS_KEY_ID') && !env('DIGITALOCEAN_SPACES_KEY')) {
    throw new Error('AWS_ACCESS_KEY_ID / DIGITALOCEAN_SPACES_KEY not set')
  }

  const prefixesToScan = [
    datasetPrefix,
    outputPrefix,
    runPrefix,
    'archive/solux-site-screening/',
  ].filter((p, i, arr) => arr.indexOf(p) === i)

  const allObjects: InventoryObject[] = []
  const prefixReports: Record<string, { objectCount: number; totalBytes: number }> = {}

  for (const prefix of prefixesToScan) {
    const { objects, totalBytes } = listPrefix(bucket, prefix, endpoint)
    prefixReports[prefix] = { objectCount: objects.length, totalBytes }
    allObjects.push(...objects)
  }

  const catalogKey = findKey(allObjects, /solux_data_catalog\.json$/)
    ?? findKey(allObjects, /catalog\/solux_data_catalog\.json$/)
  const datasetManifestKey = findKey(allObjects, /dataset_manifest\.json$/)
  const qualityReportKey = findKey(allObjects, /quality_report\.json$/)
  const uploadManifestKey = findKey(allObjects, /upload_manifest\.json$/)
  const candidateParquet = findKey(allObjects, /solux_candidate_sites\.parquet$/)
  const candidateGeojson = findKey(allObjects, /solux_candidate_sites\.geojson$/)
  const scoresParquet = findKey(allObjects, /solux_site_scores\.parquet$/)
  const scoresGeojson = findKey(allObjects, /solux_site_scores\.geojson$/)
  const solarAssets = findPrefix(allObjects, 'solar_assets')
  const waterCandidates = findPrefix(allObjects, 'water')
  const candidatesTile = findKey(allObjects, /solux_candidates\.(pmtiles|mbtiles)$/)
  const modelManifest = findKey(allObjects, /model_analysis_manifest\.json$/)
  const modelQuality = findKey(allObjects, /model_quality_report\.json$/)
  const modelRerank = findKey(allObjects, /model_reranked_sites\.(json|parquet)$/)
  const modelAssessments = findKey(allObjects, /model_site_assessments\.(json|parquet)$/)
  const embeddings = findPrefix(allObjects, 'embeddings')

  const resolved: ResolvedPaths = {
    bucket,
    endpoint,
    checkedAt: new Date().toISOString(),
    datasetVersion,
    datasetPrefix,
    outputPrefix,
    runPrefix,
    catalog: {
      soluxDataCatalog: catalogKey ? s3Uri(bucket, catalogKey) : null,
      datasetManifest: datasetManifestKey ? s3Uri(bucket, datasetManifestKey) : null,
      qualityReport: qualityReportKey ? s3Uri(bucket, qualityReportKey) : null,
      uploadManifest: uploadManifestKey ? s3Uri(bucket, uploadManifestKey) : null,
    },
    processed: {
      candidateSitesParquet: candidateParquet ? s3Uri(bucket, candidateParquet) : null,
      candidateSitesGeojson: candidateGeojson ? s3Uri(bucket, candidateGeojson) : null,
      siteScoresParquet: scoresParquet ? s3Uri(bucket, scoresParquet) : null,
      siteScoresGeojson: scoresGeojson ? s3Uri(bucket, scoresGeojson) : null,
      solarAssets: solarAssets ? s3Uri(bucket, solarAssets) : null,
      waterCandidates: waterCandidates ? s3Uri(bucket, waterCandidates) : null,
    },
    tiles: {
      candidates: candidatesTile ? s3Uri(bucket, candidatesTile) : null,
      solarAssets: findKey(allObjects, /solar.*\.(pmtiles|mbtiles)$/) ? s3Uri(bucket, findKey(allObjects, /solar.*\.(pmtiles|mbtiles)$/)!) : null,
      grid: findKey(allObjects, /grid.*\.(pmtiles|mbtiles)$/) ? s3Uri(bucket, findKey(allObjects, /grid.*\.(pmtiles|mbtiles)$/)!) : null,
      water: findKey(allObjects, /water.*\.(pmtiles|mbtiles)$/) ? s3Uri(bucket, findKey(allObjects, /water.*\.(pmtiles|mbtiles)$/)!) : null,
    },
    modelOutputs: {
      modelAnalysisManifest: modelManifest ? s3Uri(bucket, modelManifest) : null,
      modelQualityReport: modelQuality ? s3Uri(bucket, modelQuality) : null,
      modelRerankedSites: modelRerank ? s3Uri(bucket, modelRerank) : null,
      modelSiteAssessments: modelAssessments ? s3Uri(bucket, modelAssessments) : null,
      embeddings: embeddings ? s3Uri(bucket, embeddings) : null,
    },
    missingExpectedObjects: [],
    warnings: [],
    objectCounts: Object.fromEntries(
      Object.entries(prefixReports).map(([k, v]) => [k, v.objectCount]),
    ),
    totalSizeBytes: allObjects.reduce((s, o) => s + o.sizeBytes, 0),
  }

  const expected = [
    ['catalog.soluxDataCatalog', resolved.catalog.soluxDataCatalog],
    ['processed.candidateSitesParquet', resolved.processed.candidateSitesParquet],
    ['processed.siteScoresParquet', resolved.processed.siteScoresParquet],
    ['catalog.qualityReport', resolved.catalog.qualityReport],
  ] as const
  for (const [label, path] of expected) {
    if (!path) resolved.missingExpectedObjects.push(label)
  }
  if (!resolved.modelOutputs.modelAnalysisManifest) {
    resolved.warnings.push('Model outputs not yet uploaded to Spaces')
  }

  const manifestsDir = join(dataRoot, 'manifests')
  await mkdir(manifestsDir, { recursive: true })

  const discoveryReport = {
    checkedAt: resolved.checkedAt,
    bucket,
    endpoint,
    prefixesScanned: prefixesToScan,
    prefixReports,
    totalObjects: allObjects.length,
    totalSizeBytes: resolved.totalSizeBytes,
    missingExpectedObjects: resolved.missingExpectedObjects,
    warnings: resolved.warnings,
  }

  await writeFile(join(manifestsDir, 'spaces_discovery_report.json'), JSON.stringify(discoveryReport, null, 2))
  await writeFile(join(manifestsDir, 'spaces_object_inventory.json'), JSON.stringify(allObjects, null, 2))
  await writeFile(join(manifestsDir, 'resolved_data_paths.json'), JSON.stringify(resolved, null, 2))

  console.log('[OK] Discovery complete')
  console.log(`     Objects: ${allObjects.length}, ${(resolved.totalSizeBytes / 1e6).toFixed(1)} MB`)
  console.log(`     resolved_data_paths.json → ${join(manifestsDir, 'resolved_data_paths.json')}`)
  if (resolved.missingExpectedObjects.length) {
    console.warn('[WARN] Missing:', resolved.missingExpectedObjects.join(', '))
    process.exitCode = 2
  }
}

main().catch((err) => {
  console.error('[ERROR]', err)
  process.exit(1)
})
