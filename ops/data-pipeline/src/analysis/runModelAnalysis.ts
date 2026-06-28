#!/usr/bin/env tsx
// Model analysis pipeline: reads scored Solux candidates → local model (OpenAI-compat) regional analysis
// → structured JSON outputs → uploads to DO Spaces
// Usage: tsx src/analysis/runModelAnalysis.ts [--dry-run] [--top-n=25] [--model=<id>]
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DATA_ROOT = process.env['DATA_ROOT'] ?? '/data/solux'
const OUTPUT_PREFIX = process.env['SOLUX_OUTPUT_PREFIX'] ?? 'outputs/solux-site-screening/v0.1'
const BUCKET = process.env['DIGITALOCEAN_SPACES_BUCKET'] ?? 'solux'
const ENDPOINT = process.env['DIGITALOCEAN_SPACES_ENDPOINT'] ?? 'https://sfo3.digitaloceanspaces.com'
const SPACES_KEY = process.env['DIGITALOCEAN_SPACES_KEY'] ?? ''
const SPACES_SECRET = process.env['DIGITALOCEAN_SPACES_SECRET'] ?? ''
const MODEL_BASE = (process.env['SOLUX_MODEL_ENDPOINT'] ?? '').replace(/\/$/, '')
const MODEL_AUTH = process.env['SOLUX_MODEL_ENDPOINT_AUTH'] ?? ''
const TIMEOUT_MS = parseInt(process.env['SOLUX_MODEL_TIMEOUT_MS'] ?? '120000', 10)

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const TOP_N = parseInt(args.find(a => a.startsWith('--top-n='))?.split('=')[1] ?? '25', 10)
const MODEL_OVERRIDE = args.find(a => a.startsWith('--model='))?.split('=')[1] ?? ''

const SCORES_PATH = resolve(DATA_ROOT, 'processed/scoring/solux_site_scores.parquet')
const LOCAL_OUT = resolve(DATA_ROOT, 'analysis')

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegionStats {
  country: string
  region: string
  total_sites: number
  avg_score: number
  max_score: number
  min_score: number
  p75_score: number
  avg_solar_score: number
  avg_grid_score: number
  avg_buildability_score: number
  avg_water_score: number
  avg_atmosphere_score: number
  avg_ghi: number
  avg_area_km2: number
}

interface TopSite {
  h3Index: string
  country: string
  region: string
  centroid_lat: number
  centroid_lon: number
  area_km2: number
  site_surface_type: string
  final_score: number
  solar_score: number
  grid_score: number
  buildability_score: number
  water_score: number
  atmosphere_score: number
  pvgis_ghi: number | null
}

interface RegionInsight {
  summary: string
  key_strengths: string[]
  risks: string[]
  top_sites_rationale: string
  investment_attractiveness_score: number
  recommended_next_steps: string[]
  estimated_capacity_mw_range: string
}

// ── Local model client ────────────────────────────────────────────────────────

async function detectModel(): Promise<string> {
  if (MODEL_OVERRIDE) return MODEL_OVERRIDE
  if (!MODEL_BASE) throw new Error('SOLUX_MODEL_ENDPOINT not set')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (MODEL_AUTH) headers['Authorization'] = `Bearer ${MODEL_AUTH}`
  const res = await fetch(`${MODEL_BASE}/v1/models`, {
    headers,
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`/v1/models → HTTP ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data?: Array<{ id: string }> }
  const model = json.data?.[0]?.id
  if (!model) throw new Error('No models returned from endpoint')
  return model
}

async function chatCompletion(model: string, userPrompt: string): Promise<string> {
  if (!MODEL_BASE) throw new Error('SOLUX_MODEL_ENDPOINT not set')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (MODEL_AUTH) headers['Authorization'] = `Bearer ${MODEL_AUTH}`

  const body = {
    model,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.3,
    max_tokens: 2048,
  }

  const res = await fetch(`${MODEL_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`/v1/chat/completions → HTTP ${res.status}: ${text}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('Empty content in model response')
  return content
}

// ── DuckDB ────────────────────────────────────────────────────────────────────

async function dbAll<T>(db: import('duckdb').Database, sql: string): Promise<T[]> {
  return new Promise((res, rej) => {
    db.all(sql, (err: Error | null, rows: unknown) => {
      if (err) return rej(err)
      res((rows ?? []) as T[])
    })
  })
}

// ── S3 upload ─────────────────────────────────────────────────────────────────

const s3 = SPACES_KEY
  ? new S3Client({
      endpoint: ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: false,
      credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
    })
  : null

async function uploadToSpaces(key: string, body: string): Promise<string> {
  const s3Key = `${OUTPUT_PREFIX}/analysis/${key}`
  const publicUrl = `https://${BUCKET}.sfo3.digitaloceanspaces.com/${s3Key}`

  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would upload: s3://${BUCKET}/${s3Key}`)
    return publicUrl
  }
  if (!s3) throw new Error('DO Spaces credentials not configured')

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: 'application/json',
      ACL: 'public-read',
    }),
  )

  console.log(`[OK] Uploaded → s3://${BUCKET}/${s3Key}`)
  return publicUrl
}

// ── Analysis prompts ──────────────────────────────────────────────────────────

function buildRegionPrompt(stats: RegionStats, topSites: TopSite[]): string {
  return `You are a solar site screening analyst. Analyze scored H3 hexagonal candidate sites for utility-scale solar development.

## Region: ${stats.country} / ${stats.region}

### Aggregate Statistics (${stats.total_sites.toLocaleString()} candidate H3 res-7 cells, ~5.16 km² each)
- Average composite score: ${stats.avg_score.toFixed(1)} / 60
- Score range: ${stats.min_score} – ${stats.max_score} (75th pct: ${stats.p75_score})
- Avg solar irradiance score: ${stats.avg_solar_score.toFixed(1)} / 10
- Avg grid connectivity score: ${stats.avg_grid_score.toFixed(1)} / 10
- Avg buildability score: ${stats.avg_buildability_score.toFixed(1)} / 10
- Avg water risk score: ${stats.avg_water_score.toFixed(1)} / 10
- Avg atmosphere score: ${stats.avg_atmosphere_score.toFixed(1)} / 10
- Avg GHI (kWh/m²/day): ${stats.avg_ghi > 0 ? stats.avg_ghi.toFixed(2) : 'N/A'}
- Avg site area: ${stats.avg_area_km2.toFixed(2)} km²

### Top ${Math.min(topSites.length, 15)} Highest-Scoring Sites
${topSites
  .slice(0, 15)
  .map(
    (s, i) =>
      `${i + 1}. H3:${s.h3Index} Score:${s.final_score} ${s.centroid_lat.toFixed(4)}°,${s.centroid_lon.toFixed(4)}° ${s.site_surface_type} GHI:${s.pvgis_ghi?.toFixed(1) ?? 'N/A'} Solar:${s.solar_score} Grid:${s.grid_score} Build:${s.buildability_score} Water:${s.water_score}`,
  )
  .join('\n')}

## Scoring (0–60 total, 10 pts per dimension)
Solar irradiance | Grid connectivity | Buildability | Vegetation/land cover | Water risk | Atmosphere

Return ONLY valid JSON:
{
  "summary": "<2-3 sentence overview>",
  "key_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "top_sites_rationale": "<why top-scoring sites are attractive>",
  "investment_attractiveness_score": <integer 1-10>,
  "recommended_next_steps": ["<step 1>", "<step 2>", "<step 3>"],
  "estimated_capacity_mw_range": "<e.g. 50–200 MW per cluster>"
}`
}

function buildSummaryPrompt(
  regionInsights: Record<string, { stats: RegionStats; insight: RegionInsight }>,
): string {
  const summaries = Object.entries(regionInsights)
    .sort(([, a], [, b]) => b.insight.investment_attractiveness_score - a.insight.investment_attractiveness_score)
    .map(
      ([key, { stats, insight }]) =>
        `### ${key} (attractiveness: ${insight.investment_attractiveness_score}/10)
Sites: ${stats.total_sites.toLocaleString()} | Avg score: ${stats.avg_score.toFixed(1)}/60 | GHI: ${stats.avg_ghi > 0 ? stats.avg_ghi.toFixed(2) : 'N/A'} kWh/m²/day
${insight.summary}
Strengths: ${insight.key_strengths.join('; ')}`,
    )
    .join('\n\n')

  return `You are a senior renewable energy investment analyst. Write a 3-paragraph executive summary for a multi-region solar site screening study.

## Regional Results
${summaries}

## Pipeline
- Total H3 res-7 cells evaluated: 584,537 (USA + India solar belt)
- All candidates: INVESTIGATE class (scores 50–60/60)
- Scoring: multi-source satellite + API data (PVGIS, NASA POWER, ESA WorldCover, Copernicus DEM, OSM, HIFLD, JRC)

Write flowing prose (not JSON). Cover: overall outcomes, priority regions, key risk themes, portfolio strategy recommendation. ~200 words, 3 paragraphs.`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[INFO] Solux Model Analysis Pipeline')
  console.log(`[INFO] Endpoint: ${MODEL_BASE || '(not set)'}`)
  console.log(`[INFO] Scores: ${SCORES_PATH}`)
  console.log(`[INFO] Top N per region: ${TOP_N}`)
  if (DRY_RUN) console.log('[INFO] DRY RUN — no model calls or uploads')

  mkdirSync(LOCAL_OUT, { recursive: true })

  // Detect model
  let modelId = 'local-model'
  if (!DRY_RUN) {
    modelId = await detectModel()
    console.log(`[INFO] Using model: ${modelId}`)
  }

  const duckdb = await import('duckdb')
  const db = new duckdb.default.Database(':memory:')
  const serialize = (v: unknown) =>
    JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val), 2)

  console.log('[INFO] Querying regional statistics …')
  const regionalStats = await dbAll<RegionStats>(
    db,
    `SELECT
      country, region,
      COUNT(*) AS total_sites,
      ROUND(AVG(final_score), 2) AS avg_score,
      MAX(final_score) AS max_score,
      MIN(final_score) AS min_score,
      ROUND(QUANTILE_CONT(final_score, 0.75), 1) AS p75_score,
      ROUND(AVG(solar_score), 2) AS avg_solar_score,
      ROUND(AVG(grid_score), 2) AS avg_grid_score,
      ROUND(AVG(buildability_score), 2) AS avg_buildability_score,
      ROUND(AVG(water_score), 2) AS avg_water_score,
      ROUND(AVG(atmosphere_score), 2) AS avg_atmosphere_score,
      ROUND(AVG(COALESCE(pvgis_ghi, 0)), 3) AS avg_ghi,
      ROUND(AVG(area_km2), 3) AS avg_area_km2
    FROM read_parquet('${SCORES_PATH}')
    GROUP BY country, region
    ORDER BY avg_score DESC`,
  )
  console.log(`[INFO] Found ${regionalStats.length} regions`)

  console.log(`[INFO] Querying top ${TOP_N} sites per region …`)
  const topSitesAll = await dbAll<TopSite>(
    db,
    `WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY country, region ORDER BY final_score DESC, solar_score DESC) AS rn
      FROM read_parquet('${SCORES_PATH}')
    )
    SELECT h3Index, country, region, centroid_lat, centroid_lon, area_km2,
      COALESCE(site_surface_type, 'unknown') AS site_surface_type,
      final_score, solar_score, grid_score, buildability_score,
      water_score, atmosphere_score, pvgis_ghi
    FROM ranked WHERE rn <= ${TOP_N}
    ORDER BY country, region, final_score DESC`,
  )

  const topSitesByRegion = new Map<string, TopSite[]>()
  for (const site of topSitesAll) {
    const key = `${site.country}/${site.region}`
    if (!topSitesByRegion.has(key)) topSitesByRegion.set(key, [])
    topSitesByRegion.get(key)!.push(site)
  }

  // Save top_sites.json
  const topSitesOutput = {
    generated_at: new Date().toISOString(),
    model_version: 'v0.1',
    total_candidates: 584537,
    top_n_per_region: TOP_N,
    regions: Object.fromEntries(topSitesByRegion),
  }
  const topSitesJson = serialize(topSitesOutput)
  writeFileSync(resolve(LOCAL_OUT, 'top_sites.json'), topSitesJson)
  console.log(`[OK] top_sites.json written`)

  // Per-region model analysis
  const regionInsights: Record<string, { stats: RegionStats; insight: RegionInsight }> = {}

  for (const stats of regionalStats) {
    const key = `${stats.country}/${stats.region}`
    const sites = topSitesByRegion.get(key) ?? []
    console.log(`[INFO] Analyzing ${key} (${Number(stats.total_sites).toLocaleString()} sites) …`)

    let insight: RegionInsight
    if (DRY_RUN) {
      insight = {
        summary: `[DRY RUN] ${key} placeholder.`,
        key_strengths: ['High solar irradiance', 'Grid proximity', 'Low water risk'],
        risks: ['Land access', 'Permitting'],
        top_sites_rationale: 'Balanced scores across all dimensions.',
        investment_attractiveness_score: 7,
        recommended_next_steps: ['Ground surveys', 'Grid capacity study', 'Land rights assessment'],
        estimated_capacity_mw_range: '50–500 MW per cluster',
      }
    } else {
      const raw = await chatCompletion(modelId, buildRegionPrompt(stats, sites))
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error(`No JSON in model response for ${key}:\n${raw.slice(0, 300)}`)
      insight = JSON.parse(jsonMatch[0]) as RegionInsight
    }

    regionInsights[key] = { stats, insight }
    console.log(`[OK] ${key} → attractiveness: ${insight.investment_attractiveness_score}/10`)
  }

  const insightsOutput = {
    generated_at: new Date().toISOString(),
    model: modelId,
    endpoint: MODEL_BASE,
    pipeline_version: 'v0.1',
    regions: regionInsights,
  }
  const insightsJson = serialize(insightsOutput)
  writeFileSync(resolve(LOCAL_OUT, 'region_insights.json'), insightsJson)
  console.log(`[OK] region_insights.json written`)

  // Executive summary
  console.log('[INFO] Generating executive summary …')
  let executiveSummary: string
  if (DRY_RUN) {
    executiveSummary = '[DRY RUN] Executive summary placeholder.'
  } else {
    executiveSummary = await chatCompletion(modelId, buildSummaryPrompt(regionInsights))
  }

  const priorityRanking = Object.entries(regionInsights)
    .sort(([, a], [, b]) => b.insight.investment_attractiveness_score - a.insight.investment_attractiveness_score)
    .map(([key, { stats, insight }]) => ({
      region: key,
      investment_attractiveness_score: insight.investment_attractiveness_score,
      total_sites: Number(stats.total_sites),
      avg_score: stats.avg_score,
      avg_ghi: stats.avg_ghi,
      top_next_step: insight.recommended_next_steps[0] ?? '',
    }))

  const screeningReport = {
    generated_at: new Date().toISOString(),
    model: modelId,
    endpoint: MODEL_BASE,
    pipeline_version: 'v0.1',
    total_candidates_screened: 584537,
    h3_resolution: 7,
    regions_analyzed: regionalStats.length,
    coverage: ['USA (TX, AZ, NV)', 'India (GUJ, RAJ)'],
    executive_summary: executiveSummary,
    priority_ranking: priorityRanking,
    methodology: {
      scoring_dimensions: [
        'solar_irradiance — GHI/DNI via PVGIS + NASA POWER',
        'grid_connectivity — OSM + HIFLD transmission lines',
        'buildability — Copernicus DEM slope analysis',
        'vegetation_land_cover — ESA WorldCover',
        'water_risk — JRC Global Surface Water',
        'atmosphere — air quality + temperature',
      ],
      score_range: '0–60 composite (10 pts per dimension)',
      all_candidates_decision: 'INVESTIGATE',
      data_sources: ['PVGIS', 'NASA POWER', 'ESA WorldCover', 'Copernicus DEM', 'OSM', 'HIFLD', 'JRC'],
    },
  }
  const reportJson = serialize(screeningReport)
  writeFileSync(resolve(LOCAL_OUT, 'screening_report.json'), reportJson)
  console.log(`[OK] screening_report.json written`)

  // Upload to DO Spaces
  console.log('[INFO] Uploading to DigitalOcean Spaces …')
  const [topSitesUrl, insightsUrl, reportUrl] = await Promise.all([
    uploadToSpaces('top_sites.json', topSitesJson),
    uploadToSpaces('region_insights.json', insightsJson),
    uploadToSpaces('screening_report.json', reportJson),
  ])

  console.log('\n[DONE] S3 paths:')
  console.log(`  s3://${BUCKET}/${OUTPUT_PREFIX}/analysis/top_sites.json`)
  console.log(`  s3://${BUCKET}/${OUTPUT_PREFIX}/analysis/region_insights.json`)
  console.log(`  s3://${BUCKET}/${OUTPUT_PREFIX}/analysis/screening_report.json`)
  console.log('\n[DONE] Public URLs:')
  console.log(`  ${topSitesUrl}`)
  console.log(`  ${insightsUrl}`)
  console.log(`  ${reportUrl}`)

  db.close()
}

main().catch(err => {
  console.error('[ERROR]', err instanceof Error ? err.message : err)
  process.exit(1)
})
