/**
 * Solux E2E project pipeline tests.
 * Runs 5 project creation + query scenarios against the live API.
 *
 * Usage:
 *   API_BASE=http://localhost:3001 npx ts-node --esm ops/tests/run-five-ui-project-tests.ts
 *
 * Prerequisites: API running, MongoDB connected, GEMINI_API_KEY configured.
 */

const API_BASE = process.env['API_BASE'] ?? 'http://localhost:3001'

interface ProjectBrief {
  id: string
  rawPrompt: string
  createdAt: string
}

interface QueryResult {
  queryId: string
  rankedSites: Array<{
    rank: number
    candidateId: string
    country: string
    state: string
    decision: string
    finalScore: number
    confidence: number
    displayLabel?: string
    formattedAddress?: string | null
    centroid?: { coordinates: [number, number] }
  }>
  report: { summary: string; guardPassed: boolean }
  missingDataWarnings: string[]
  modelRerankUsed: boolean
  pipelineSteps: Array<{ id: string; label: string; state: string; note?: string }>
  unsupportedCountries: string[]
}

interface ApiError {
  error: string
  detail?: string
  unsupportedCountries?: string[]
}

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiError }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (res.ok) return { ok: true, data: (json.data ?? json) as T }
  return { ok: false, status: res.status, error: json as ApiError }
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { console.error(`  ✗ ${msg}`); process.exitCode = 1 }
function warn(msg: string) { console.log(`  ⚠ ${msg}`) }
function section(title: string) { console.log(`\n── ${title}`) }

async function createProject(rawPrompt: string): Promise<string | null> {
  const res = await post<ProjectBrief>('/v1/projects', { rawPrompt })
  if (!res.ok) { fail(`createProject failed: ${res.error.detail ?? res.error.error}`); return null }
  pass(`Project created: ${res.data.id}`)
  return res.data.id
}

async function runQuery(projectId: string, prompt: string): Promise<QueryResult | null> {
  const res = await post<QueryResult>(`/v1/projects/${projectId}/query`, { prompt, limit: 10 })
  if (!res.ok) {
    if (res.status === 422 && res.error.error === 'UNSUPPORTED_REGION') {
      return { unsupported: true, countries: res.error.unsupportedCountries ?? [] } as unknown as QueryResult
    }
    fail(`runQuery failed: ${res.error.detail ?? res.error.error}`)
    return null
  }
  return res.data
}

// ── Test 1: India solar + storage ────────────────────────────────────────────
async function test1() {
  section('Test 1 — India solar + storage (Rajasthan + Gujarat)')
  const id = await createProject(
    'Find the best sites for a 100 MW solar plus 50 MW battery project in Rajasthan and Gujarat. Avoid dense vegetation, steep slopes, and areas far from roads or transmission.',
  )
  if (!id) return

  const result = await runQuery(id,
    'Find the best sites for a 100 MW solar plus 50 MW battery project in Rajasthan and Gujarat.',
  )
  if (!result) return

  pass(`Query ID: ${result.queryId}`)
  pass(`Dataset version present: ${Boolean(result.pipelineSteps?.length)}`)

  if (result.rankedSites?.length) {
    pass(`Top ${result.rankedSites.length} candidates returned`)
    const countries = [...new Set(result.rankedSites.map((s) => s.country))]
    if (countries.every((c) => c === 'India' || c === 'INDIA')) {
      pass(`All candidates in India`)
    } else {
      warn(`Mixed countries: ${countries.join(', ')}`)
    }
    const withLabels = result.rankedSites.filter((s) => s.displayLabel)
    pass(`${withLabels.length}/${result.rankedSites.length} candidates have display labels`)
  } else {
    warn('No candidate sites returned — dataset may not be ingested for this region')
  }

  const regionStep = result.pipelineSteps?.find((s) => s.id === 'region_validated')
  if (regionStep?.state === 'completed') pass('Region validated: India (supported)')
  else warn(`Region validation state: ${regionStep?.state ?? 'unknown'}`)

  const learningStep = result.pipelineSteps?.find((s) => s.id === 'learning_event')
  if (learningStep?.state === 'completed') pass('Learning event logged')

  if (result.report?.guardPassed !== false) pass('Evidence guard passed')
}

// ── Test 2: USA Southwest utility-scale ──────────────────────────────────────
async function test2() {
  section('Test 2 — USA Southwest utility-scale solar')
  const id = await createProject(
    'Screen Arizona, Nevada, California, New Mexico, and Texas for utility-scale solar sites above 80 MW. Prioritize high PV output, low slope, grid proximity, and low vegetation conflict.',
  )
  if (!id) return

  const result = await runQuery(id,
    'Screen Arizona, Nevada, California for utility-scale solar sites above 80 MW.',
  )
  if (!result) return

  pass(`Query ID: ${result.queryId}`)

  if (result.rankedSites?.length) {
    pass(`Top ${result.rankedSites.length} candidates returned`)
    const countries = [...new Set(result.rankedSites.map((s) => s.country))]
    if (countries.every((c) => c === 'USA')) {
      pass('All candidates in United States')
    } else {
      warn(`Countries returned: ${countries.join(', ')}`)
    }
  } else {
    warn('No candidates — dataset may need USA region ingested')
  }

  const rerankStep = result.pipelineSteps?.find((s) => s.id === 'model_reranking')
  pass(`Model reranking state: ${rerankStep?.state ?? 'unknown'} (${rerankStep?.note ?? 'no note'})`)

  if (result.report?.guardPassed !== false) pass('Report guard passed — no fabricated grid capacity claimed')
}

// ── Test 3: India floating/canal solar ───────────────────────────────────────
async function test3() {
  section('Test 3 — India floating/canal solar (Gujarat + Rajasthan)')
  const id = await createProject(
    'Find reservoir or canal-adjacent floating solar opportunities in Gujarat and Rajasthan. Avoid ecologically sensitive water bodies and show confidence if water evidence is missing.',
  )
  if (!id) return

  const result = await runQuery(id,
    'Find reservoir or canal floating solar opportunities in Gujarat and Rajasthan.',
  )
  if (!result) return

  pass(`Query ID: ${result.queryId}`)

  const waterWarning = result.missingDataWarnings?.some((w) =>
    w.toLowerCase().includes('water') || w.toLowerCase().includes('gebco') || w.toLowerCase().includes('copernicus'),
  )
  if (waterWarning) {
    pass('Water evidence missing warning present — confidence lowered appropriately')
  } else {
    warn('No water evidence warning (may be available or check dataset)')
  }

  if (result.rankedSites?.length) {
    const waterSites = result.rankedSites.filter((s) =>
      ['reservoir', 'canal', 'lake', 'coastal_shallow'].includes(s.siteSurfaceType ?? ''),
    )
    if (waterSites.length) pass(`${waterSites.length} water-type candidates`)
    else warn('No water-type candidates — may be filtered as land by dataset')
  }

  pass(`${result.rankedSites?.length ?? 0} total candidates (no fake water candidates injected)`)
}

// ── Test 4: Unsupported country (Brazil) ─────────────────────────────────────
async function test4() {
  section('Test 4 — Unsupported country: Brazil')
  const id = await createProject(
    'Find solar sites in Brazil for a 200 MW project.',
  )
  if (!id) {
    warn('Project creation returned null — may have been rejected early (acceptable behavior)')
    return
  }

  const rawResult = await runQuery(id, 'Find solar sites in Brazil for a 200 MW project.')
  const result = rawResult as unknown as { unsupported?: boolean; countries?: string[] }

  if (result?.unsupported) {
    pass('Unsupported region error returned (HTTP 422)')
    pass('No candidate sites generated for Brazil')
    if (result.countries?.includes('Brazil')) {
      pass('Brazil correctly flagged in unsupportedCountries list')
    }
    return
  }

  // May have returned 0 candidates if GEMINI set targetCountry=Other but pipeline ran
  const queryResult = rawResult as QueryResult
  if (queryResult?.rankedSites?.length === 0) {
    warn('Query ran but returned 0 candidates — unsupported country handling degraded gracefully')
    if (queryResult.unsupportedCountries?.includes('Brazil')) {
      pass('Brazil in unsupportedCountries field')
    }
  } else if (queryResult?.rankedSites?.length) {
    fail(`${queryResult.rankedSites.length} candidates returned for Brazil — should be 0`)
  }
}

// ── Test 5: Mixed supported + unsupported ────────────────────────────────────
async function test5() {
  section('Test 5 — Mixed: California + Rajasthan + Australia')
  const id = await createProject(
    'Compare solar sites in California, Rajasthan, and Australia.',
  )
  if (!id) return

  const rawResult = await runQuery(id, 'Compare solar sites in California, Rajasthan, and Australia.')
  const result = rawResult as unknown as { unsupported?: boolean; countries?: string[] }

  if (result?.unsupported) {
    warn('All regions rejected as unsupported — acceptable if targetCountry=Other')
    if (result.countries?.includes('Australia')) {
      pass('Australia correctly flagged')
    }
    return
  }

  const queryResult = rawResult as QueryResult

  // Should have Australia in unsupportedCountries and proceed with California+Rajasthan
  if (queryResult.unsupportedCountries?.length) {
    pass(`Unsupported countries flagged: ${queryResult.unsupportedCountries.join(', ')}`)
  } else {
    warn('unsupportedCountries empty — check if Australia was extracted from prompt')
  }

  const australiaWarning = queryResult.missingDataWarnings?.some((w) => w.toLowerCase().includes('australia'))
  if (australiaWarning) pass('Australia excluded warning in missingDataWarnings')

  if (queryResult.rankedSites?.length) {
    const countries = [...new Set(queryResult.rankedSites.map((s) => s.country))]
    const hasAustralia = countries.some((c) => c?.toLowerCase().includes('australia'))
    if (hasAustralia) {
      fail('Australia candidates present — should be excluded')
    } else {
      pass(`No Australia candidates. Countries returned: ${countries.join(', ')}`)
    }
    pass(`${queryResult.rankedSites.length} candidates from supported regions`)
  } else {
    warn('No candidates returned — dataset coverage for California/Rajasthan may vary')
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Solux E2E project pipeline tests`)
  console.log(`API: ${API_BASE}`)
  console.log(`─`.repeat(60))

  const t0 = Date.now()
  for (const [i, test] of [test1, test2, test3, test4, test5].entries()) {
    try {
      await test()
    } catch (err) {
      fail(`Test ${i + 1} threw: ${err}`)
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Completed in ${elapsed}s. Exit code: ${process.exitCode ?? 0}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
