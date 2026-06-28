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
  evidence_ids?: string
}

function hashFeatures(row: CandidateRow): string {
  return createHash('sha256')
    .update(JSON.stringify({ id: row.candidate_id, score: row.final_score }))
    .digest('hex')
    .slice(0, 16)
}

function clusterFromScores(row: CandidateRow): string {
  const score = row.final_score ?? 0
  const conf = row.confidence ?? 0
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
      c.candidate_id,
      s.final_score,
      s.confidence,
      c.site_type,
      COALESCE(CAST(c.evidence_ids AS VARCHAR), '[]') AS evidence_ids
    FROM read_parquet('${candPath}') c
    LEFT JOIN read_parquet('${scorePath}') s ON c.candidate_id = s.candidate_id
    LIMIT 50000
  `
  return queryParquet<CandidateRow>(sql)
}

async function callModelRerank(
  batch: CandidateRow[],
  caps: ModelEndpointCapabilities,
): Promise<ModelSiteAssessment[] | null> {
  if (!caps.reachable) return null
  const endpoint = caps.endpointUrl.replace(/\/$/, '')
  const hasAnalyze = caps.supportedRoutes.some((r) => r.includes('/analyze'))
  const hasPredict = caps.supportedRoutes.some((r) => r.includes('/predict'))
  const path = hasAnalyze ? '/analyze' : hasPredict ? '/predict' : null
  if (!path) return null

  const payload = {
    task: 'rerank_for_developer_priority',
    candidates: batch.map((r) => ({
      candidateId: r.candidate_id,
      deterministicScore: r.final_score ?? 0,
      confidence: r.confidence ?? 0,
      siteType: r.site_type,
    })),
  }

  try {
    const auth = envPath('SOLUX_MODEL_ENDPOINT_AUTH', '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (auth) headers['Authorization'] = `Bearer ${auth}`
    const res = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Number(envPath('SOLUX_MODEL_TIMEOUT_MS', '120000'))),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { results?: Array<Record<string, unknown>> }
    if (!json.results?.length) return null
    return json.results.map((r, i) => ({
      candidateId: String(r.candidateId ?? batch[i]?.candidate_id ?? ''),
      inputFeatureHash: hashFeatures(batch[i] ?? { candidate_id: '' }),
      modelName: String(r.modelName ?? 'hosted-endpoint'),
      modelEndpoint: endpoint,
      modelVersion: r.modelVersion ? String(r.modelVersion) : undefined,
      modelTask: 'rerank_for_developer_priority',
      modelScore: Number(r.modelScore ?? r.score ?? batch[i]?.final_score ?? 0),
      modelConfidence: Number(r.modelConfidence ?? r.confidence ?? 0.5),
      reasoningSummary: String(r.reasoningSummary ?? r.summary ?? ''),
      unsupportedClaims: Array.isArray(r.unsupportedClaims)
        ? r.unsupportedClaims.map(String)
        : [],
      evidenceIds: (() => {
        try {
          return row.evidence_ids ? (JSON.parse(row.evidence_ids) as string[]) : []
        } catch {
          return []
        }
      })(),
      createdAt: new Date().toISOString(),
    })) as ModelSiteAssessment[]
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
          modelScore: row.final_score ?? 0,
          modelConfidence: row.confidence ?? 0,
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
