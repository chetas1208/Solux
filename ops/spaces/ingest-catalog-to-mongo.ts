#!/usr/bin/env tsx
/**
 * Ingest Spaces catalog + candidate summaries into MongoDB.
 * Reads resolved_data_paths.json — no mock data.
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const repoRoot = resolve(import.meta.dirname, '../..')
if (existsSync(resolve(repoRoot, '.env'))) {
  loadEnv({ path: resolve(repoRoot, '.env'), override: true })
}
if (existsSync(resolve(repoRoot, '.solux-env'))) {
  loadEnv({ path: resolve(repoRoot, '.solux-env'), override: false })
}
import { join } from 'node:path'
import { MongoClient } from 'mongodb'
import {
  bulkUpsertCandidateSummaries,
  bulkUpsertCandidateRefs,
  insertCandidateSummariesBatch,
  upsertDatasetCatalogVersion,
  ensureBaselineScoringPolicy,
  insertSystemReadinessSnapshot,
  countCandidateSummaries,
} from '../../apps/api/src/db/repositories/lakeRepositories.js'
import {
  parseMissingDataFlags,
  formatMissingFlagLabel,
} from '../../apps/api/src/services/candidateRankingUtils.js'

interface ResolvedPaths {
  bucket: string
  endpoint: string
  datasetVersion: string
  datasetPrefix: string
  catalog: Record<string, string | null>
  processed: Record<string, string | null>
}

function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() ?? fallback
}

function s3Key(uri: string | null): string | null {
  if (!uri?.startsWith('s3://')) return null
  const rest = uri.slice(5)
  return rest.slice(rest.indexOf('/') + 1)
}

function downloadS3(key: string, dest: string, bucket: string, endpoint: string) {
  mkdir(join(dest, '..'), { recursive: true }).catch(() => undefined)
  execSync(
    `aws s3 cp "s3://${bucket}/${key}" "${dest}" --endpoint-url "${endpoint}"`,
    { stdio: 'inherit' },
  )
}

async function fetchJson(key: string, bucket: string, endpoint: string, cacheDir: string) {
  const dest = join(cacheDir, key.replace(/\//g, '_'))
  if (!existsSync(dest)) downloadS3(key, dest, bucket, endpoint)
  return JSON.parse(await readFile(dest, 'utf8'))
}

function queryParquet<T>(parquetPath: string, sql: string): T[] {
  const fullSql = sql.replace('__PARQUET__', parquetPath.replace(/'/g, "''"))
  const out = execSync(`duckdb -json -c "${fullSql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  const parsed = JSON.parse(out || '[]') as T[]
  return parsed
}

interface ScoreRow {
  h3Index: string
  country: string
  region: string
  centroid_lat: number
  centroid_lon: number
  site_surface_type: string
  final_score: number
  confidence_score: number
  decision: string
  missing_data_flags: string[]
  solar_score: number
  grid_score: number
  vegetation_score: number
}

async function main() {
  const dataRoot = env('DATA_ROOT', '/data/solux')
  const mongoUri = env('MONGODB_URI')
  if (!mongoUri) throw new Error('MONGODB_URI not set')

  const resolvedPath = join(dataRoot, 'manifests/resolved_data_paths.json')
  if (!existsSync(resolvedPath)) throw new Error(`Missing ${resolvedPath} — run discover-solux-paths.sh first`)
  const resolved = JSON.parse(await readFile(resolvedPath, 'utf8')) as ResolvedPaths

  const bucket = resolved.bucket
  const endpoint = resolved.endpoint
  const cacheDir = join(dataRoot, 'cache/ingest')
  await mkdir(cacheDir, { recursive: true })

  const catalogKey = s3Key(resolved.catalog.soluxDataCatalog)
  const manifestKey = s3Key(resolved.catalog.datasetManifest)
  const qualityKey = s3Key(resolved.catalog.qualityReport)
  const scoresKey = s3Key(resolved.processed.siteScoresParquet)

  if (!scoresKey) throw new Error('siteScoresParquet not resolved in Spaces')

  const catalog = catalogKey ? await fetchJson(catalogKey, bucket, endpoint, cacheDir) : null
  const manifest = manifestKey ? await fetchJson(manifestKey, bucket, endpoint, cacheDir) : null
  const quality = qualityKey ? await fetchJson(qualityKey, bucket, endpoint, cacheDir) : null

  const scoresLocal = join(dataRoot, 'processed/scoring/solux_site_scores.parquet')
  const cacheScores = join(cacheDir, 'solux_site_scores.parquet')
  let scoresPath = scoresLocal
  if (!existsSync(scoresPath)) {
    if (!existsSync(cacheScores)) downloadS3(scoresKey, cacheScores, bucket, endpoint)
    scoresPath = cacheScores
  }

  const client = new MongoClient(mongoUri)
  await client.connect()
  const dbName = env('MONGODB_DB', 'solux')
  // Repos use getDb() — set env and connect via app's getDb by importing after connect
  process.env['MONGODB_URI'] = mongoUri
  process.env['MONGODB_DB'] = dbName

  await upsertDatasetCatalogVersion({
    datasetVersion: resolved.datasetVersion,
    bucket,
    endpoint,
    catalog,
    manifest,
    quality,
    spacesPaths: resolved,
    candidateCount: catalog?.candidateCount ?? null,
  })
  await ensureBaselineScoringPolicy()

  const rows = queryParquet<ScoreRow>(scoresPath, `
    SELECT
      h3Index,
      country,
      region,
      centroid_lat,
      centroid_lon,
      site_surface_type,
      final_score,
      confidence_score,
      decision,
      missing_data_flags,
      solar_score,
      grid_score,
      vegetation_score
    FROM read_parquet('__PARQUET__')
  `)

  console.log(`[INFO] Loaded ${rows.length} scored candidates from parquet`)

  const batchSize = 1000
  const existing = await countCandidateSummaries({ datasetVersion: resolved.datasetVersion })
  let inserted = 0

  if (existing >= rows.length * 0.99) {
    console.log(`[SKIP] Already ingested ${existing} summaries — skipping bulk upsert`)
  } else {
    const useInsert = existing === 0
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const summaries = batch.map((r) => {
        const flaws = parseMissingDataFlags(r.missing_data_flags)
        const positive: string[] = []
        if (Number(r.solar_score) >= 70) positive.push('high solar output')
        if (Number(r.grid_score) >= 70) positive.push('grid proximity favorable')
        if (Number(r.vegetation_score) >= 70) positive.push('low vegetation conflict')
        return {
          candidateId: r.h3Index,
          datasetVersion: resolved.datasetVersion,
          country: r.country,
          state: r.region,
          centroid: {
            type: 'Point' as const,
            coordinates: [Number(r.centroid_lon), Number(r.centroid_lat)] as [number, number],
          },
          siteSurfaceType: r.site_surface_type ?? 'land',
          finalScore: Number(r.final_score ?? 0),
          confidence: Number(r.confidence_score ?? 0),
          decision: r.decision ?? 'INVESTIGATE',
          topFatalFlaws: flaws.slice(0, 5).map(formatMissingFlagLabel),
          topPositiveFactors: positive,
          missingDataFlags: flaws,
          spacesObjectRefs: {
            siteScoresParquet: resolved.processed.siteScoresParquet!,
            candidateSitesParquet: resolved.processed.candidateSitesParquet ?? '',
          },
          ingestedAt: new Date(),
        }
      })

      const refs = batch.map((r) => ({
        candidateId: r.h3Index,
        datasetVersion: resolved.datasetVersion,
        country: r.country,
        state: r.region,
        decision: r.decision ?? 'INVESTIGATE',
        finalScore: Number(r.final_score ?? 0),
        confidence: Number(r.confidence_score ?? 0),
        spacesObjectRefs: {
          siteScoresParquet: resolved.processed.siteScoresParquet!,
        },
      }))

      if (useInsert) {
        inserted += await insertCandidateSummariesBatch(summaries)
      } else {
        inserted += await bulkUpsertCandidateSummaries(summaries)
      }
      await bulkUpsertCandidateRefs(refs)
      console.log(`[INFO] Upserted batch ${Math.floor(i / batchSize) + 1} (${Math.min(i + batchSize, rows.length)}/${rows.length})`)
    }
  }

  const total = await countCandidateSummaries({ datasetVersion: resolved.datasetVersion })
  await insertSystemReadinessSnapshot({
    mongoReady: true,
    candidateCount: total,
    datasetVersion: resolved.datasetVersion,
    ingestSource: scoresKey,
    ingestedAt: new Date().toISOString(),
  })

  const report = { ingested: inserted, totalInMongo: total, datasetVersion: resolved.datasetVersion }
  await writeFile(join(dataRoot, 'manifests/catalog_ingest_report.json'), JSON.stringify(report, null, 2))
  console.log('[OK] Catalog ingest complete', report)

  await client.close()
}

main().catch((err) => {
  console.error('[ERROR]', err)
  process.exit(1)
})
