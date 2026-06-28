import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import duckdb from 'duckdb'
import {
  envPath,
  modelInputDir,
  modelOutputDir,
  manifestsDir,
  writeJson,
  readJson,
  type ModelSiteAssessment,
} from './config.js'
import { probeModelEndpoint } from './modelEndpointClient.js'
import type { ModelEndpointCapabilities } from './config.js'

const RISK_CLUSTERS = [
  'high-output-low-risk',
  'high-output-grid-uncertain',
  'high-output-vegetation-conflict',
  'low-output-not-worth-it',
  'water-promising-depth-unknown',
  'coastal-wave-risk',
  'data-insufficient',
] as const

interface CandidateRow {
  candidate_id: string
  final_score?: number
  confidence?: number
  site_type?: string
}

function hashFeatures(row: CandidateRow): string {
  return createHash('sha256')
    .update(JSON.stringify({ id: row.candidate_id, score: Number(row.final_score ?? 0) }))
    .digest('hex')
    .slice(0, 16)
}

function clusterFromScores(row: CandidateRow): string {
  const score = Number(row.final_score ?? 0)
  const conf = Number(row.confidence ?? 0) / 100
  if (conf < 0.4) return 'data-insufficient'
  if (score >= 75) return 'high-output-low-risk'
  if (score >= 55) return 'high-output-grid-uncertain'
  if (score >= 40) return 'high-output-vegetation-conflict'
  return 'low-output-not-worth-it'
}

async function queryParquet<T>(sql: string): Promise<T[]> {
  const db = new duckdb.Database(':memory:')
  const conn = db.connect()
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      conn.close()
      if (err) reject(err)
      else resolve(rows as T[])
    })
  })
}

async function loadCandidates(): Promise<CandidateRow[]> {
  const input = modelInputDir()
  const candPath = join(input, 'processed/candidates/solux_candidate_sites.parquet')
  const scorePath = join(input, 'processed/scoring/solux_site_scores.parquet')

  const sql = `
    SELECT
      c.h3Index AS candidate_id,
      s.final_score,
      s.confidence_score AS confidence,
      c.site_surface_type AS site_type
    FROM read_parquet('${candPath}') c
    LEFT JOIN read_parquet('${scorePath}') s ON c.h3Index = s.h3Index
    ORDER BY s.final_score DESC NULLS LAST
    LIMIT 50000
  `
  return queryParquet<CandidateRow>(sql)
}

async function callModelRerank(
  batch: CandidateRow[],
  caps: ModelEndpointCapabilities,
): Promise<ModelSiteAssessment[] | null> {
  if (!caps.reachable) return null
  const endpoint = caps.endpointUrl.replace(/\/$/, '').replace(/\/docs$/, '')

  const hasReason = caps.supportedRoutes.some((r) => r.includes('/v1/reason/auto'))
  if (!hasReason) return null

  const question = [
    'Rank these solar candidate sites for developer priority.',
    'Return JSON: {"results":[{"candidateId":"...","modelScore":0-100,"modelConfidence":0-1,"reasoningSummary":"..."}]}',
    JSON.stringify(
      batch.map((r) => ({
        candidateId: r.candidate_id,
        deterministicScore: Number(r.final_score ?? 0),
        confidence: Number(r.confidence ?? 0),
        siteType: r.site_type,
      })),
    ),
  ].join('\n')

  try {
    const auth = envPath('SOLUX_MODEL_ENDPOINT_AUTH', '')
    const headers: Record<string, string> = {}
    if (auth) headers['Authorization'] = `Bearer ${auth}`

    const fd = new FormData()
    fd.append('question', question)
    fd.append('medical', 'false')

    const res = await fetch(`${endpoint}/v1/reason/auto`, {
      method: 'POST',
      headers,
      body: fd,
      signal: AbortSignal.timeout(Number(envPath('SOLUX_MODEL_TIMEOUT_MS', '120000'))),
    })
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as {
      results?: Array<Record<string, unknown>>
      answer?: string
      job_id?: string
    } | null
    if (json?.results?.length) {
      return json.results.map((r, i) => ({
        candidateId: String(r.candidateId ?? batch[i]?.candidate_id ?? ''),
        inputFeatureHash: hashFeatures(batch[i] ?? { candidate_id: '' }),
        modelName: 'hpc-model-backend/reason-auto',
        modelEndpoint: endpoint,
        modelTask: 'rerank_for_developer_priority',
        modelScore: Number(r.modelScore ?? r.score ?? batch[i]?.final_score ?? 0),
        modelConfidence: Number(r.modelConfidence ?? r.confidence ?? 0.5),
        reasoningSummary: String(r.reasoningSummary ?? r.summary ?? ''),
        unsupportedClaims: [],
        evidenceIds: [],
        createdAt: new Date().toISOString(),
      })) as ModelSiteAssessment[]
    }
    return null
  } catch {
    return null
  }
}

export async function runModelAnalysis() {
  const outDir = modelOutputDir()
  const quarantineDir = join(outDir, 'quarantine')
  await mkdir(quarantineDir, { recursive: true })

  const capsPath = join(manifestsDir(), 'model_endpoint_capabilities.json')
  const caps = await readJson<ModelEndpointCapabilities>(capsPath)
  const capabilities = caps ?? (await probeModelEndpoint())

  const candidates = await loadCandidates()
  const batchSize = Number(envPath('SOLUX_MODEL_BATCH_SIZE', '256'))
  const assessments: ModelSiteAssessment[] = []
  let quarantined = 0
  let modelUsed = false

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)
    const modelBatch = await callModelRerank(batch, capabilities)
    if (modelBatch?.length) {
      modelUsed = true
      for (const a of modelBatch) {
        if (a.unsupportedClaims.length > 0) {
          a.reasoningSummary = `[Claims stripped] ${a.reasoningSummary}`
        }
        assessments.push(a)
      }
    } else {
      for (const row of batch) {
        assessments.push({
          candidateId: row.candidate_id,
          inputFeatureHash: hashFeatures(row),
          modelName: modelUsed ? 'hosted-endpoint' : 'deterministic-baseline',
          modelEndpoint: capabilities.endpointUrl || 'none',
          modelTask: 'risk_cluster_label',
          modelScore: Number(row.final_score ?? 0),
          modelConfidence: Number(row.confidence ?? 0) / 100,
          reasoningSummary: `Deterministic cluster: ${clusterFromScores(row)}`,
          unsupportedClaims: [],
          evidenceIds: [],
          createdAt: new Date().toISOString(),
        })
      }
    }
  }

  const reranked = [...assessments].sort((a, b) => b.modelScore - a.modelScore)

  await writeJson(join(outDir, 'model_analysis_manifest.json'), {
    runAt: new Date().toISOString(),
    candidateCount: candidates.length,
    assessmentCount: assessments.length,
    modelEndpointReachable: capabilities.reachable,
    modelUsed,
    quarantined,
    endpointCapabilities: capabilities,
  })

  await writeJson(join(outDir, 'model_quality_report.json'), {
    generatedAt: new Date().toISOString(),
    clustersUsed: RISK_CLUSTERS,
    unsupportedClaimsStripped: assessments.filter((a) => a.unsupportedClaims.length).length,
    deterministicBaselineOnly: !modelUsed,
  })

  await writeJson(join(outDir, 'model_site_assessments.json'), assessments)
  await writeJson(join(outDir, 'model_reranked_sites.json'), reranked)

  // GeoJSON summary (centroids from scores if geometry unavailable)
  await writeJson(join(outDir, 'model_site_assessments.geojson'), {
    type: 'FeatureCollection',
    features: assessments.slice(0, 5000).map((a) => ({
      type: 'Feature',
      properties: {
        candidateId: a.candidateId,
        modelScore: a.modelScore,
        modelConfidence: a.modelConfidence,
        modelTask: a.modelTask,
      },
      geometry: null,
    })),
  })

  console.log(
    `[OK] Model analysis: ${assessments.length} assessments, modelUsed=${modelUsed}, endpoint=${capabilities.reachable}`,
  )
  return { assessments, capabilities, modelUsed }
}

if (process.argv[1]?.endsWith('run-model-analysis.ts')) {
  runModelAnalysis().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
