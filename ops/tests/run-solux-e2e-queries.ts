#!/usr/bin/env tsx
/**
 * End-to-end Solux query tests — India land+water and USA Southwest.
 * Requires API at API_BASE (default http://localhost:3000).
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const repoRoot = resolve(import.meta.dirname, '../..')
if (existsSync(resolve(repoRoot, '.env'))) {
  loadEnv({ path: resolve(repoRoot, '.env'), override: true })
}

import { MongoClient } from 'mongodb'

const API_BASE = process.env['API_BASE'] ?? 'http://localhost:3000'
const DATA_ROOT = process.env['DATA_ROOT'] ?? '/data/solux'

interface TestResult {
  name: string
  passed: boolean
  reasons: string[]
}

const results: TestResult[] = []

function record(name: string, passed: boolean, reasons: string[]) {
  results.push({ name, passed, reasons })
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string; detail?: string; status?: string }
    if (!res.ok) throw new Error(`${path} → ${res.status}: ${json.error ?? json.detail ?? res.statusText}`)
    return (json.data ?? json) as T
  } catch (err) {
    throw err
  }
}

const QUERY_1 =
  'Find the best sites for a 100 MW solar plus 50 MW battery project in Rajasthan and Gujarat. Avoid dense vegetation, protected land, steep slopes, and areas far from roads or transmission. Include reservoir or canal-adjacent floating solar options only if water evidence exists.'

const QUERY_2 =
  'Screen Arizona, Nevada, California, New Mexico, and Texas for utility-scale solar sites above 80 MW. Prioritize high PV output, low slope, grid proximity, low vegetation conflict, and lower heat/dust power-loss risk. Do not claim grid capacity unless evidence exists.'

function validateQueryResponse(name: string, data: Record<string, unknown>, specChecks: (spec: Record<string, unknown>, data: Record<string, unknown>) => string[]) {
  const reasons: string[] = []
  if (!data.queryId) reasons.push('missing queryId')
  if (!data.parsedSpec) reasons.push('missing parsedSpec')
  if (!Array.isArray(data.rankedSites)) reasons.push('rankedSites not array')
  if (!data.report) reasons.push('missing report')
  if (!Array.isArray(data.missingDataWarnings)) reasons.push('missing missingDataWarnings')
  if (typeof data.modelRerankUsed !== 'boolean') reasons.push('modelRerankUsed not boolean')
  if (!data.scoringPolicyVersion) reasons.push('missing scoringPolicyVersion')
  if (!data.datasetVersion) reasons.push('missing datasetVersion')

  const spec = data.parsedSpec as Record<string, unknown>
  reasons.push(...specChecks(spec, data))

  const ranked = data.rankedSites as Array<Record<string, unknown>>
  if (ranked.length === 0) reasons.push('rankedSites empty — dataset may lack candidates for region')

  for (const site of ranked.slice(0, 3)) {
    if (!site.evidenceBacked) reasons.push('site missing evidenceBacked flag')
    if (!site.candidateId) reasons.push('site missing candidateId')
  }

  const report = data.report as Record<string, unknown>
  if (report.unsupportedClaims && (report.unsupportedClaims as string[]).length > 5) {
    reasons.push('too many unsupported claims in report')
  }

  record(name, reasons.length === 0, reasons)
}

async function main() {
  console.log(`[E2E] API base: ${API_BASE}`)

  try {
    const health = await api<{ status: string }>('/health')
    record('GET /health', health.status === 'ok', health.status !== 'ok' ? [`status=${health.status}`] : [])
  } catch (err) {
    record('GET /health', false, [String(err)])
  }

  try {
    const catalog = await api<{ source: string }>('/v1/dataset/catalog')
    record('GET /v1/dataset/catalog', Boolean(catalog), !catalog ? ['empty catalog'] : [])
  } catch (err) {
    record('GET /v1/dataset/catalog', false, [String(err)])
  }

  try {
    const model = await api<Record<string, unknown>>('/v1/model-outputs/status')
    record('GET /v1/model-outputs/status', Boolean(model), !model ? ['empty status'] : [])
  } catch (err) {
    record('GET /v1/model-outputs/status', false, [String(err)])
  }

  let projectId = ''
  try {
    const project = await api<{ id: string }>('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ rawPrompt: QUERY_1.slice(0, 200) }),
    })
    projectId = project.id
    record('POST /v1/projects', Boolean(projectId), !projectId ? ['no project id'] : [])
  } catch (err) {
    record('POST /v1/projects', false, [String(err)])
    printReport()
    process.exit(1)
  }

  try {
    const q1 = await api<Record<string, unknown>>(`/v1/projects/${projectId}/query`, {
      method: 'POST',
      body: JSON.stringify({ prompt: QUERY_1, limit: 10 }),
    })
    validateQueryResponse('Query 1 — India land+water', q1, (spec) => {
      const reasons: string[] = []
      if (spec.targetCountry !== 'India') reasons.push(`expected India, got ${spec.targetCountry}`)
      const region = String(spec.targetRegion ?? '').toLowerCase()
      if (!region.includes('rajasthan') && !region.includes('gujarat') && !region.includes('india')) {
        reasons.push(`region should include Rajasthan/Gujarat: ${spec.targetRegion}`)
      }
      if (spec.technology !== 'solar_plus_storage' && spec.technology !== 'floating_pv') {
        reasons.push(`expected solar+storage, got ${spec.technology}`)
      }
      if (Number(spec.targetCapacityMW) < 50) reasons.push('capacity should parse ~100 MW solar')
      if (spec.avoidDenseVegetation !== true) reasons.push('avoidDenseVegetation should be true')
      return reasons
    })
  } catch (err) {
    record('Query 1 — India land+water', false, [String(err)])
  }

  await new Promise((r) => setTimeout(r, 3000))

  try {
    const q2 = await api<Record<string, unknown>>(`/v1/projects/${projectId}/query`, {
      method: 'POST',
      body: JSON.stringify({ prompt: QUERY_2, limit: 10 }),
    })
    validateQueryResponse('Query 2 — USA Southwest', q2, (spec, data) => {
      const reasons: string[] = []
      if (spec.targetCountry !== 'USA') reasons.push(`expected USA, got ${spec.targetCountry}`)
      if (Number(spec.targetCapacityMW) < 80) reasons.push('capacity should be >= 80 MW')
      const summary = String((data.report as Record<string, unknown>)?.summary ?? '')
      if (/transmission capacity available|grid capacity available|grid capacity of \d/i.test(summary)) {
        reasons.push('report must not claim grid capacity without evidence')
      }
      const spaces = data.spacesArtifacts as Record<string, unknown> | undefined
      if (!spaces?.reportUri) reasons.push('report artifact not written to Spaces')
      return reasons
    })
  } catch (err) {
    record('Query 2 — USA Southwest', false, [String(err)])
  }

  const mongoUri = process.env['MONGODB_URI']
  if (mongoUri) {
    const client = new MongoClient(mongoUri)
    await client.connect()
    const db = client.db(process.env['MONGODB_DB'] ?? 'solux')
    const queryRuns = await db.collection('query_runs').countDocuments({ projectId })
    record('Mongo query_runs', queryRuns >= 2, queryRuns < 2 ? [`count=${queryRuns}, expected >= 2`] : [])
    const learning = await db.collection('learning_events').countDocuments({ projectId })
    record('Mongo learning_events', learning >= 2, learning < 2 ? [`count=${learning}, expected >= 2`] : [])
    await client.close()
  } else {
    record('Mongo query_runs', false, ['MONGODB_URI not set'])
  }

  try {
    const ll = await api<Record<string, unknown>>('/v1/learning-loop/status')
    record('GET /v1/learning-loop/status', Boolean(ll.activePolicyVersion), !ll ? ['empty'] : [])
  } catch (err) {
    record('GET /v1/learning-loop/status', false, [String(err)])
  }

  printReport()
  const failed = results.filter((r) => !r.passed).length
  process.exit(failed ? 1 : 0)
}

function printReport() {
  console.log('\n=== Solux E2E Query Test Report ===')
  for (const r of results) {
    console.log(`${r.passed ? 'PASS' : 'FAIL'} — ${r.name}`)
    for (const reason of r.reasons) console.log(`       • ${reason}`)
  }
  const passed = results.filter((r) => r.passed).length
  console.log(`\n${passed}/${results.length} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
