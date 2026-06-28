import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { ProjectSpec } from '@solux/shared'
import { parseProjectPrompt } from '../agent/parseProjectPrompt.js'
import { isLlmAvailable, llmUnavailableReason } from '../agent/llmClient.js'
import { runEvidenceGuard } from '../agent/evidenceGuard.js'
import { saveAgentTrace } from '../db/repositories/agentTraceRepo.js'
import { saveProjectSpec, getProjectSpec } from '../db/repositories/projects.js'
import {
  queryCandidateSummaries,
  countCandidateSummaries,
  insertQueryRun,
  updateQueryRun,
  insertParsedSpec,
  insertFatalFlawReport,
  insertLearningEvent,
  getActiveDatasetCatalogVersion,
  getActiveScoringPolicy,
  ensureBaselineScoringPolicy,
  getModelRerankByCandidateIds,
} from '../db/repositories/lakeRepositories.js'
import { loadResolvedDataPaths, s3KeyFromUri, spacesReady } from './resolvedPathsService.js'
import { getModelOutputStatus } from './modelOutputService.js'
import { env } from '../config/env.js'
import type { Filter } from 'mongodb'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CandidateSiteSummary } from '../db/repositories/lakeRepositories.js'
import {
  parseMissingDataFlags,
  formatMissingFlagLabel,
  diversifyCandidates,
  buildCandidateDisplayLabel,
} from './candidateRankingUtils.js'

const REGION_ALIASES: Record<string, string[]> = {
  rajasthan: ['RAJ', 'Rajasthan'],
  gujarat: ['GUJ', 'Gujarat'],
  karnataka: ['KA', 'Karnataka'],
  arizona: ['AZ', 'Arizona'],
  nevada: ['NV', 'Nevada'],
  california: ['CA', 'California'],
  'new mexico': ['NM', 'New Mexico'],
  texas: ['TX', 'Texas'],
  india: ['RAJ', 'GUJ'],
}

function regionTokens(spec: ProjectSpec, regionHint?: string): string[] {
  const text = `${spec.targetRegion} ${regionHint ?? ''} ${spec.additionalConstraints.join(' ')}`.toLowerCase()
  const tokens = new Set<string>()
  for (const [key, codes] of Object.entries(REGION_ALIASES)) {
    if (text.includes(key)) codes.forEach((c) => tokens.add(c))
  }
  // Explicit region codes in hint (e.g. "RAJ TX NV")
  if (regionHint) {
    for (const part of regionHint.toUpperCase().split(/[\s,]+/)) {
      if (/^[A-Z]{2,3}$/.test(part)) tokens.add(part)
    }
  }
  if (!tokens.size && spec.targetCountry === 'India') ['RAJ', 'GUJ'].forEach((c) => tokens.add(c))
  return [...tokens]
}

function buildMongoFilter(spec: ProjectSpec, regionHint?: string): Filter<Record<string, unknown>> {
  const filter: Filter<Record<string, unknown>> = {}
  const datasetVersion = process.env['DATASET_VERSION'] ?? 'v0.1'
  filter.datasetVersion = datasetVersion

  if (spec.targetCountry === 'USA') filter.country = 'USA'
  else if (spec.targetCountry === 'India') filter.country = { $in: ['India', 'INDIA'] }

  const states = regionTokens(spec, regionHint)
  if (states.length) filter.state = { $in: states }

  if (spec.preferredSiteTypes?.length === 1) {
    filter.siteSurfaceType = spec.preferredSiteTypes[0]
  }

  if (spec.searchBBox) {
    const [minLon, minLat, maxLon, maxLat] = spec.searchBBox
    filter['centroid.coordinates'] = {
      $geoWithin: {
        $box: [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
      },
    }
  }

  return filter
}

function loadCandidatesFromLocalParquet(
  spec: ProjectSpec,
  regionHint: string | undefined,
  limit: number,
  datasetVersion: string,
  paths: Awaited<ReturnType<typeof loadResolvedDataPaths>>,
): CandidateSiteSummary[] {
  const dataRoot = process.env['DATA_ROOT'] ?? '/data/solux'
  const parquet = join(dataRoot, 'processed/scoring/solux_site_scores.parquet')
  if (!existsSync(parquet)) return []

  const states = regionTokens(spec, regionHint)
  const country =
    spec.targetCountry === 'USA' ? 'USA' : spec.targetCountry === 'India' ? 'INDIA' : null
  const clauses: string[] = []
  if (country) clauses.push(`country = '${country}'`)
  if (states.length) clauses.push(`region IN (${states.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ')})`)
  const where = clauses.length ? clauses.join(' AND ') : '1=1'

  const sql = `
    SELECT h3Index, country, region, centroid_lat, centroid_lon, site_surface_type,
           final_score, confidence_score, decision, missing_data_flags,
           solar_score, grid_score, vegetation_score
    FROM read_parquet('${parquet.replace(/'/g, "''")}')
    WHERE ${where}
    ORDER BY final_score DESC NULLS LAST, solar_score DESC NULLS LAST, grid_score DESC NULLS LAST
    LIMIT ${limit * 20}
  `
  try {
    const out = execSync(`duckdb -json -c "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    const rows = JSON.parse(out || '[]') as Array<Record<string, unknown>>
    return rows.map((r) => {
      const flags = parseMissingDataFlags(r.missing_data_flags)
      const solar = Number(r.solar_score ?? 0)
      const grid = Number(r.grid_score ?? 0)
      const veg = Number(r.vegetation_score ?? 0)
      const positive: string[] = []
      if (solar >= 70) positive.push(`Strong solar (${solar})`)
      if (grid >= 70) positive.push(`Grid proximity (${grid})`)
      if (veg >= 70) positive.push(`Low vegetation conflict (${veg})`)
      return {
        candidateId: String(r.h3Index),
        datasetVersion,
        country: String(r.country),
        state: String(r.region),
        centroid: {
          type: 'Point' as const,
          coordinates: [Number(r.centroid_lon), Number(r.centroid_lat)] as [number, number],
        },
        siteSurfaceType: String(r.site_surface_type ?? 'land'),
        finalScore: Number(r.final_score ?? 0),
        confidence: Number(r.confidence_score ?? 0),
        decision: String(r.decision ?? 'INVESTIGATE'),
        topFatalFlaws: flags.slice(0, 5).map(formatMissingFlagLabel),
        topPositiveFactors: positive,
        solarScore: solar,
        gridScore: grid,
        vegetationScore: veg,
        evidenceIds: [],
        missingDataFlags: flags,
        spacesObjectRefs: {
          siteScoresParquet: paths?.processed.siteScoresParquet ?? parquet,
        },
        ingestedAt: new Date(),
      }
    })
  } catch {
    return []
  }
}

function asStringArray(v: unknown): string[] {
  return parseMissingDataFlags(v).map(formatMissingFlagLabel)
}

function buildPositiveFactors(s: Record<string, unknown>): string[] {
  const out: string[] = []
  const solar = Number(s.solarScore ?? 0)
  const grid = Number(s.gridScore ?? 0)
  const veg = Number(s.vegetationScore ?? 0)
  if (solar >= 65) out.push(`Solar output ${solar}`)
  if (grid >= 65) out.push(`Grid proximity ${grid}`)
  if (veg >= 65) out.push(`Vegetation ${veg}`)
  return out
}

function scoreBreakdownFromSummary(s: Record<string, unknown>) {
  return {
    siteId: String(s.candidateId),
    finalScore: Number(s.finalScore ?? 0),
    confidence: Number(s.confidence ?? 0),
    decision: String(s.decision ?? 'INVESTIGATE'),
    missingDataWarnings: parseMissingDataFlags(s.missingDataFlags),
  }
}

function buildReportText(
  spec: ProjectSpec,
  ranked: Array<Record<string, unknown>>,
  missingWarnings: string[],
): string {
  const lines = ranked.slice(0, 10).map((s, i) => {
    const flaws = asStringArray(s.topFatalFlaws).slice(0, 2).join('; ') || 'none flagged'
    return `${i + 1}. ${s.candidateId} — ${s.decision} score=${s.finalScore} conf=${s.confidence}% flaws: ${flaws}`
  })
  return [
    `# Fatal-flaw screening — ${spec.name}`,
    `Region: ${spec.targetRegion} (${spec.targetCountry})`,
    `Technology: ${spec.technology}, target ${spec.targetCapacityMW} MW`,
    spec.storageCapacityMW ? `Storage: ${spec.storageCapacityMW} MW` : '',
    '',
    '## Ranked candidates (deterministic + optional model rerank)',
    ...lines,
    '',
    missingWarnings.length ? `## Missing data warnings\n${missingWarnings.map((w) => `- ${w}`).join('\n')}` : '',
    '',
    'Every numeric claim above is derived from scored candidate summaries in Spaces/Mongo.',
    'Grid transmission capacity is NOT claimed unless HIFLD/grid evidence exists.',
  ]
    .filter(Boolean)
    .join('\n')
}

function s3Client(): S3Client | null {
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

async function uploadReportArtifact(queryId: string, report: Record<string, unknown>): Promise<string | null> {
  const paths = await loadResolvedDataPaths()
  const c = s3Client()
  if (!c || !paths || !env.DIGITALOCEAN_SPACES_BUCKET) return null
  const key = `${paths.outputPrefix}/reports/${queryId}/fatal_flaw_report.json`
  await c.send(
    new PutObjectCommand({
      Bucket: env.DIGITALOCEAN_SPACES_BUCKET,
      Key: key,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
    }),
  )
  return `s3://${env.DIGITALOCEAN_SPACES_BUCKET}/${key}`
}

type StepState = 'pending' | 'running' | 'completed' | 'degraded' | 'failed' | 'skipped'
interface PipelineStep {
  id: string
  label: string
  state: StepState
  note?: string
}

export const QueryResponseSchema = z.object({
  queryId: z.string(),
  parsedSpec: z.record(z.unknown()),
  rankedSites: z.array(z.record(z.unknown())),
  report: z.object({
    summary: z.string(),
    guardPassed: z.boolean(),
    hallucinationScore: z.number(),
    unsupportedClaims: z.array(z.string()),
  }),
  evidenceSummary: z.array(z.record(z.unknown())),
  missingDataWarnings: z.array(z.string()),
  modelRerankUsed: z.boolean(),
  scoringPolicyVersion: z.string(),
  datasetVersion: z.string(),
  spacesArtifacts: z.record(z.unknown()),
  pipelineSteps: z.array(z.object({
    id: z.string(),
    label: z.string(),
    state: z.string(),
    note: z.string().optional(),
  })),
  unsupportedCountries: z.array(z.string()),
})

export type QueryPipelineResult = z.infer<typeof QueryResponseSchema>

export async function runQueryPipeline(opts: {
  projectId: string
  userPrompt: string
  regionHint?: string
  limit: number
  existingSpec?: ProjectSpec | null
}): Promise<QueryPipelineResult> {
  const queryId = uuid()
  const paths = await loadResolvedDataPaths()
  const datasetCatalog = await getActiveDatasetCatalogVersion()
  const datasetVersion =
    String(datasetCatalog?.datasetVersion ?? paths?.datasetVersion ?? process.env['DATASET_VERSION'] ?? 'v0.1')
  const policy = (await getActiveScoringPolicy()) ?? (await ensureBaselineScoringPolicy())
  const scoringPolicyVersion = String(policy.version ?? 'v0.1.0-baseline')

  const steps: PipelineStep[] = [
    { id: 'project_created', label: 'Project created', state: 'completed' },
    { id: 'prompt_parsed', label: 'Prompt parsed', state: 'running' },
    { id: 'region_validated', label: 'Supported region validated', state: 'pending' },
    { id: 'catalog_loaded', label: 'Dataset catalog loaded', state: 'pending' },
    { id: 'candidate_retrieval', label: 'Candidate retrieval', state: 'pending' },
    { id: 'evidence_loaded', label: 'Evidence loaded', state: 'pending' },
    { id: 'address_enrichment', label: 'Address enrichment', state: 'pending' },
    { id: 'model_pipeline', label: 'Model pipeline', state: 'pending' },
    { id: 'model_reranking', label: 'Model reranking', state: 'pending' },
    { id: 'report_generation', label: 'Report generation', state: 'pending' },
    { id: 'evidence_guard', label: 'Evidence guard', state: 'pending' },
    { id: 'learning_event', label: 'Learning event logged', state: 'pending' },
    { id: 'results_ready', label: 'Results ready', state: 'pending' },
  ]

  function setStep(id: string, state: StepState, note?: string) {
    const s = steps.find((s) => s.id === id)
    if (s) { s.state = state; if (note) s.note = note }
  }

  await insertQueryRun({
    queryId,
    projectId: opts.projectId,
    userPrompt: opts.userPrompt,
    state: 'PARSING',
    datasetVersion,
    scoringPolicyVersion,
  })

  let spec = opts.existingSpec ?? null
  if (isLlmAvailable()) {
    if (spec) {
      setStep('prompt_parsed', 'completed', 'Using saved project spec')
    } else {
      const parsed = await parseProjectPrompt(opts.userPrompt, opts.projectId)
      spec = parsed.spec
      await saveProjectSpec(spec)
      await saveAgentTrace(parsed.trace)
      await insertParsedSpec({ projectId: opts.projectId, queryId, spec, briefId: spec.briefId })
      setStep('prompt_parsed', 'completed')
    }
  } else if (!spec) {
    setStep('prompt_parsed', 'failed', llmUnavailableReason())
    await updateQueryRun(queryId, { state: 'FAILED', error: llmUnavailableReason() })
    throw new Error(`${llmUnavailableReason()} — cannot parse query`)
  } else {
    setStep('prompt_parsed', 'skipped', 'LLM unavailable; using cached spec')
  }

  // Check for unsupported regions
  const unsupportedCountries = spec.additionalConstraints
    .filter((c) => c.startsWith('unsupported_region:'))
    .map((c) => c.replace('unsupported_region:', '').trim())
  const hasSupported = spec.targetCountry === 'India' || spec.targetCountry === 'USA'

  if (!hasSupported && unsupportedCountries.length > 0) {
    setStep('region_validated', 'failed', `Unsupported: ${unsupportedCountries.join(', ')}`)
    await updateQueryRun(queryId, { state: 'FAILED', error: 'UNSUPPORTED_REGION' })
    const err = new Error(`UNSUPPORTED_REGION:${unsupportedCountries.join(',')}`)
    ;(err as unknown as Record<string, unknown>).code = 'UNSUPPORTED_REGION'
    ;(err as unknown as Record<string, unknown>).unsupportedCountries = unsupportedCountries
    throw err
  }

  const missingDataWarnings: string[] = []

  if (hasSupported && unsupportedCountries.length > 0) {
    missingDataWarnings.push(
      `Unsupported regions excluded: ${unsupportedCountries.join(', ')}. Screening limited to ${spec.targetCountry}.`,
    )
    setStep('region_validated', 'degraded', `${unsupportedCountries.join(', ')} excluded; screening ${spec.targetCountry} only`)
  } else {
    setStep('region_validated', 'completed')
  }

  // Dataset catalog
  setStep('catalog_loaded', spacesReady(paths) ? 'completed' : 'degraded',
    spacesReady(paths) ? undefined : 'Spaces catalog paths not resolved')
  if (!spacesReady(paths)) {
    missingDataWarnings.push('Spaces catalog paths not resolved — run discover-solux-paths.sh')
  }

  await updateQueryRun(queryId, { state: 'RETRIEVING', parsedProjectSpec: spec })

  const filter = buildMongoFilter(spec, opts.regionHint)
  let candidates = await queryCandidateSummaries(filter, opts.limit * 5)
  const totalInFilter = await countCandidateSummaries(filter)

  if (!candidates.length) {
    const local = loadCandidatesFromLocalParquet(spec, opts.regionHint, opts.limit, datasetVersion, paths)
    if (local.length) {
      candidates = local as unknown as typeof candidates
      missingDataWarnings.push('Candidate summaries loaded from local scored parquet (MongoDB ingest in progress)')
      setStep('candidate_retrieval', 'degraded', 'Loaded from local parquet; MongoDB ingest pending')
    } else {
      missingDataWarnings.push(
        'No candidate summaries in MongoDB for this filter — run ops/spaces/ingest-catalog-to-mongo.ts',
      )
      setStep('candidate_retrieval', 'degraded', 'No candidates from configured sources')
    }
  } else {
    setStep('candidate_retrieval', 'completed')
  }

  setStep('evidence_loaded', 'completed')

  const modelStatus = await getModelOutputStatus()
  let modelRerankUsed = false
  const candidateIds = candidates.map((c) => String(c.candidateId))

  setStep('model_pipeline', modelStatus.modelEndpointReachable ? 'completed' : 'degraded',
    !modelStatus.modelEndpointReachable ? 'Model endpoint unavailable; deterministic scoring active.' : undefined)

  if (modelStatus.outputsAvailable && candidateIds.length) {
    const rerankMap = await getModelRerankByCandidateIds(datasetVersion, candidateIds)
    if (rerankMap.size) {
      candidates = [...candidates].sort((a, b) => {
        const ra = Number(rerankMap.get(String(a.candidateId))?.modelScore ?? a.finalScore ?? 0)
        const rb = Number(rerankMap.get(String(b.candidateId))?.modelScore ?? b.finalScore ?? 0)
        return rb - ra
      })
      modelRerankUsed = true
      setStep('model_reranking', 'completed')
    } else {
      const { existsSync } = await import('node:fs')
      const { readFile } = await import('node:fs/promises')
      const { join } = await import('node:path')
      const localRerank = join(process.env['DATA_ROOT'] ?? '/data/solux', 'model_outputs', datasetVersion, 'model_reranked_sites.json')
      if (existsSync(localRerank)) {
        const reranked = JSON.parse(await readFile(localRerank, 'utf8')) as Array<{ candidateId: string; modelScore: number }>
        const order = new Map(reranked.map((r, i) => [r.candidateId, i]))
        candidates = [...candidates].sort(
          (a, b) => (order.get(String(a.candidateId)) ?? 9999) - (order.get(String(b.candidateId)) ?? 9999),
        )
        modelRerankUsed = true
        setStep('model_reranking', 'completed')
      } else {
        if (paths?.modelOutputs.modelRerankedSites) {
          missingDataWarnings.push('Model rerank refs not in Mongo — using deterministic order')
        }
        setStep('model_reranking', 'skipped', 'Model reranking unavailable; deterministic evidence scoring active.')
        missingDataWarnings.push('Model reranking unavailable; deterministic evidence scoring active.')
      }
    }
  } else {
    setStep('model_reranking', 'skipped', 'Model reranking unavailable; deterministic evidence scoring active.')
    missingDataWarnings.push('Model reranking unavailable; deterministic evidence scoring active.')
  }

  for (const c of candidates) {
    for (const flag of (c.missingDataFlags as string[] | undefined) ?? []) {
      if (!missingDataWarnings.includes(flag)) missingDataWarnings.push(flag)
    }
  }

  const baseRankedSites = diversifyCandidates(
    candidates.map((s) => ({
      ...s,
      solarScore: Number((s as Record<string, unknown>).solarScore ?? 0),
      gridScore: Number((s as Record<string, unknown>).gridScore ?? 0),
    })),
    opts.limit,
  ).map((s, i) => ({
    rank: i + 1,
    candidateId: s.candidateId,
    country: s.country,
    state: s.state,
    siteSurfaceType: s.siteSurfaceType,
    finalScore: s.finalScore,
    confidence: s.confidence,
    decision: s.decision,
    centroid: s.centroid,
    solarScore: Number((s as Record<string, unknown>).solarScore ?? 0),
    gridScore: Number((s as Record<string, unknown>).gridScore ?? 0),
    topFatalFlaws: parseMissingDataFlags(
      s.topFatalFlaws ?? (s as Record<string, unknown>).missingDataFlags,
    ).map(formatMissingFlagLabel),
    topPositiveFactors: (s.topPositiveFactors as string[] | undefined)?.length
      ? (s.topPositiveFactors as string[])
      : buildPositiveFactors(s),
    spacesObjectRefs: s.spacesObjectRefs,
    evidenceBacked: true,
  }))

  // Geocoding enrichment
  const { reverseGeocode } = await import('./geocodingService.js')
  const geocodingAvailable = Boolean(env.GOOGLE_MAPS_API_KEY)
  setStep('address_enrichment',
    geocodingAvailable ? 'completed' : 'degraded',
    geocodingAvailable ? undefined : 'Google Maps key not configured; region labels used.')
  if (!geocodingAvailable) {
    missingDataWarnings.push('Google geocoding not configured; nearest region labels used for candidate display.')
  }

  const rankedSites = await Promise.all(
    baseRankedSites.map(async (s) => {
      const coords = (s.centroid as { coordinates: [number, number] } | undefined)?.coordinates
      const [lng, lat] = coords ?? [0, 0]
      if (!coords) {
        return {
          ...s,
          displayLabel: buildCandidateDisplayLabel({
            rank: s.rank,
            state: String(s.state),
            lat,
            lng,
            candidateId: String(s.candidateId),
            finalScore: Number(s.finalScore),
          }),
          formattedAddress: null,
          locality: null,
          adminArea1: s.state,
        }
      }
      const geo = await reverseGeocode(String(s.candidateId), lat, lng, String(s.state))
      const displayLabel =
        geo.locality && geo.adminArea1
          ? `${geo.locality}, ${geo.adminArea1}`
          : buildCandidateDisplayLabel({
              rank: s.rank,
              state: String(s.state),
              lat,
              lng,
              candidateId: String(s.candidateId),
              finalScore: Number(s.finalScore),
              locality: geo.locality,
            })
      return { ...s, ...geo, displayLabel }
    }),
  )

  setStep('report_generation', 'running')
  const reportText = buildReportText(spec, rankedSites, missingDataWarnings)
  const guard = runEvidenceGuard(reportText, [])
  if (guard.unsupportedClaims.length) {
    missingDataWarnings.push(`${guard.unsupportedClaims.length} unsupported claims flagged by evidence guard`)
  }
  setStep('report_generation', 'completed')
  setStep('evidence_guard', guard.passed ? 'completed' : 'degraded',
    !guard.passed ? `${guard.unsupportedClaims.length} unsupported claims flagged` : undefined)

  const reportArtifact = {
    queryId,
    projectId: opts.projectId,
    generatedAt: new Date().toISOString(),
    spec,
    rankedSites,
    missingDataWarnings,
    modelRerankUsed,
    scoringPolicyVersion,
    datasetVersion,
    guard: {
      passed: guard.passed,
      hallucinationScore: guard.hallucinationScore,
      unsupportedClaims: guard.unsupportedClaims,
    },
    sanitizedText: guard.sanitizedText,
  }

  const spacesReportUri = await uploadReportArtifact(queryId, reportArtifact)

  await insertFatalFlawReport({
    queryId,
    projectId: opts.projectId,
    summary: guard.sanitizedText.slice(0, 2000),
    guardPassed: guard.passed,
    spacesArtifactUri: spacesReportUri,
    datasetVersion,
  })

  await insertLearningEvent({
    queryId,
    projectId: opts.projectId,
    userPrompt: opts.userPrompt,
    parsedProjectSpec: spec,
    retrievedCandidates: rankedSites.map((s) => s.candidateId),
    deterministicRanking: candidates.slice(0, opts.limit).map((s) => s.candidateId),
    modelRanking: modelRerankUsed ? rankedSites.map((s) => s.candidateId) : null,
    finalRanking: rankedSites.map((s) => s.candidateId),
    missingDataWarnings,
    hallucinationScore: guard.hallucinationScore,
    datasetVersion,
    scoringPolicyVersion,
    modelRerankUsed,
  })
  setStep('learning_event', 'completed')

  await updateQueryRun(queryId, {
    state: 'COMPLETED',
    finalRanking: rankedSites.map((s) => s.candidateId),
    modelRerankUsed,
    spacesReportUri,
  })
  setStep('results_ready', 'completed')

  const evidenceSummary = rankedSites.flatMap((s) =>
    asStringArray(s.topFatalFlaws).map((flaw, i) => ({
      candidateId: s.candidateId,
      evidenceId: `${s.candidateId}-flaw-${i}`,
      description: flaw,
      source: 'deterministic_scoring',
      confidence: s.confidence,
    })),
  )

  return QueryResponseSchema.parse({
    queryId,
    parsedSpec: spec as unknown as Record<string, unknown>,
    rankedSites,
    report: {
      summary: guard.sanitizedText,
      guardPassed: guard.passed,
      hallucinationScore: guard.hallucinationScore,
      unsupportedClaims: guard.unsupportedClaims,
    },
    evidenceSummary,
    missingDataWarnings,
    modelRerankUsed,
    scoringPolicyVersion,
    datasetVersion,
    spacesArtifacts: {
      reportUri: spacesReportUri,
      datasetCatalog: paths?.catalog ?? {},
      resolvedAt: paths?.checkedAt ?? null,
      candidatesMatched: totalInFilter,
    },
    pipelineSteps: steps,
    unsupportedCountries,
  })
}
