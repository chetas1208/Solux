#!/usr/bin/env tsx
// Score all candidate sites from parquet input.
// Calls PVGIS for solar resource. Uses local layers for grid, terrain, landcover.
// CLI: tsx src/scoring/finalScore.ts score-all [options]
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { DATA_ROOT, dirs, PVGIS_BASE_URL, NREL_API_KEY } from '../config.js'

// Dimension weights — must sum to 1.0
const WEIGHTS = {
  solar: 0.25,
  grid: 0.20,
  buildability: 0.15,
  vegetation: 0.15,
  storage: 0.10,
  atmosphere: 0.05,
  powerLoss: 0.05,
  water: 0.05,
} as const

interface CandidateRow {
  h3Index: string
  country: string
  region?: string
  centroid_lat: number
  centroid_lon: number
  area_km2: number
  site_surface_type: string
}

interface ScoreRow extends CandidateRow {
  solar_score: number
  grid_score: number
  buildability_score: number
  vegetation_score: number
  storage_score: number
  atmosphere_score: number
  power_loss_score: number
  water_score: number
  final_score: number
  confidence_score: number
  power_output_score: number
  grid_connectivity_score: number
  decision: 'GO' | 'INVESTIGATE' | 'KILL'
  pvgis_ghi?: number
  pvgis_dni?: number
  pvgis_temp?: number
  scored_at: string
  data_sources_used: string[]
  missing_data_flags: string[]
}

async function fetchPvgis(lat: number, lon: number): Promise<{
  ghi: number; dni: number; temp: number; ok: boolean
}> {
  // seriescalc: 1-year hourly series → aggregate to annual mean daily GHI.
  // G(i) = global irradiance on plane; sum all hours ÷ 1000 ÷ n_days = kWh/m²/day.
  const base = PVGIS_BASE_URL.replace('/v5_2', '/v5_3').replace('/v5_1', '/v5_3')
  const url = `${base}/seriescalc?lat=${lat}&lon=${lon}&startyear=2015&endyear=2015&components=0&outputformat=json&select_database_seriescalc=PVGIS-SARAH2`
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!resp.ok) return { ghi: 0, dni: 0, temp: 0, ok: false }
    const data = await resp.json() as {
      outputs?: {
        hourly?: { 'G(i)'?: number; T2m?: number; WS10m?: number }[]
      }
      message?: string
    }
    if (data.message) return { ghi: 0, dni: 0, temp: 0, ok: false }
    const hourly = data.outputs?.hourly ?? []
    if (hourly.length < 100) return { ghi: 0, dni: 0, temp: 0, ok: false }
    const nDays = hourly.length / 24
    const totalGi = hourly.reduce((s, h) => s + (h['G(i)'] ?? 0), 0)
    const avgTemp = hourly.reduce((s, h) => s + (h.T2m ?? 20), 0) / hourly.length
    const ghi = totalGi / 1000 / nDays  // kWh/m²/day
    return { ghi, dni: ghi * 0.7, temp: avgTemp, ok: ghi > 0 }
  } catch {
    return { ghi: 0, dni: 0, temp: 0, ok: false }
  }
}

function solarScore(ghi: number): number {
  // GHI in kWh/m²/day; 0=0, 4=50, 5=70, 6=85, 7+=100
  if (ghi <= 0) return 0
  if (ghi >= 7) return 100
  if (ghi >= 6) return 85 + (ghi - 6) * 15
  if (ghi >= 5) return 70 + (ghi - 5) * 15
  if (ghi >= 4) return 50 + (ghi - 4) * 20
  return ghi * 12.5
}

function finalScore(scores: Record<keyof typeof WEIGHTS, number>): number {
  return Object.entries(WEIGHTS).reduce((sum, [dim, w]) => {
    return sum + (scores[dim as keyof typeof WEIGHTS] ?? 0) * w
  }, 0)
}

function decision(score: number): 'GO' | 'INVESTIGATE' | 'KILL' {
  if (score >= 70) return 'GO'
  if (score >= 45) return 'INVESTIGATE'
  return 'KILL'
}

async function scoreCandidate(row: CandidateRow, opts: {
  pvgisEnabled: boolean
  dataSources: string[]
  ghiLookup?: Map<string, number>
}): Promise<ScoreRow> {
  const missing: string[] = []
  const usedSources: string[] = []

  // Solar score — prefer pre-sampled Global Solar Atlas GHI raster
  let solar = 0
  let ghi = 0, dni = 0, temp = 20
  const rasterGhi = opts.ghiLookup?.get(row.h3Index)
  if (rasterGhi != null && rasterGhi > 0) {
    ghi = rasterGhi
    dni = ghi * 0.7
    solar = solarScore(ghi)
    usedSources.push('global_solar_atlas')
  } else if (opts.pvgisEnabled) {
    const pvgis = await fetchPvgis(row.centroid_lat, row.centroid_lon)
    if (pvgis.ok) {
      ghi = pvgis.ghi; dni = pvgis.dni; temp = pvgis.temp
      solar = solarScore(ghi)
      usedSources.push('pvgis')
    } else {
      missing.push('pvgis')
      solar = row.country === 'INDIA' ? 55 : 50
    }
  } else {
    solar = row.country === 'INDIA' ? 55 : 50
    if (!opts.ghiLookup) missing.push('solar_resource')
  }

  // Grid score — placeholder until local grid data is loaded
  const grid = opts.dataSources.includes('hifld') || opts.dataSources.includes('osm_power') ? 55 : 40
  if (!opts.dataSources.some(s => ['hifld', 'osm_power'].includes(s))) missing.push('grid_data')

  // Buildability — site surface type and area
  const buildability = row.site_surface_type === 'land' ? 60 :
    row.site_surface_type === 'water_reservoir' ? 50 : 40

  // Vegetation — conservative default (local ESA WorldCover would improve this)
  const vegetation = 60
  missing.push('landcover_raster')

  // Storage — proximity to load, default regional
  const storage = 50
  missing.push('storage_proximity')

  // Atmosphere — temperature penalty
  const tempPenalty = Math.max(0, (temp - 25) * 0.5)
  const atmosphere = Math.max(0, 70 - tempPenalty)

  // Power loss — temperature + terrain (no local data = use defaults)
  const powerLoss = Math.max(0, 70 - tempPenalty)

  // Water — site type dependent
  const water = row.site_surface_type === 'land' ? 80 :
    row.site_surface_type === 'water_reservoir' ? 60 : 50

  const scores = { solar, grid, buildability, vegetation, storage, atmosphere, powerLoss: powerLoss, water }
  const final = finalScore(scores)
  const confidence = Math.max(0, 100 - missing.length * 10)

  return {
    ...row,
    solar_score: Math.round(solar),
    grid_score: Math.round(grid),
    buildability_score: Math.round(buildability),
    vegetation_score: Math.round(vegetation),
    storage_score: Math.round(storage),
    atmosphere_score: Math.round(atmosphere),
    power_loss_score: Math.round(powerLoss),
    water_score: Math.round(water),
    final_score: Math.round(final),
    confidence_score: Math.round(confidence),
    power_output_score: Math.round(solar),
    grid_connectivity_score: Math.round(grid),
    decision: decision(final),
    pvgis_ghi: ghi > 0 ? ghi : undefined,
    pvgis_dni: dni > 0 ? dni : undefined,
    pvgis_temp: temp,
    scored_at: new Date().toISOString(),
    data_sources_used: usedSources,
    missing_data_flags: missing,
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('finalScore.ts')) {
  const [,, cmd, ...rest] = process.argv
  const argMap: Record<string, string> = {}
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2).split('=')[0]
      const val = rest[i].includes('=') ? rest[i].split('=').slice(1).join('=') : rest[i + 1]
      argMap[key] = val
      if (!rest[i].includes('=')) i++
    }
  }

  if (cmd === 'score-all') {
    const candidatesPath = argMap['candidates'] ?? resolve(dirs.processed, 'candidates/solux_candidate_sites.parquet')
    const outputPath = argMap['output'] ?? resolve(dirs.processed, 'scoring/solux_site_scores.parquet')
    await mkdir(resolve(dirs.processed, 'scoring'), { recursive: true })

    if (!existsSync(candidatesPath)) {
      console.error(`[ERROR] Candidates file not found: ${candidatesPath}`)
      process.exit(1)
    }

    // Read candidates via npm duckdb (no CLI required)
    const duckdb = await import('duckdb')
    const db = new duckdb.default.Database(':memory:')
    const ndjsonPath = candidatesPath.replace('.parquet', '_tmp.ndjson')

    await new Promise<void>((res, rej) => {
      db.run(
        `COPY (SELECT * FROM read_parquet('${candidatesPath}')) TO '${ndjsonPath}' (FORMAT JSON, ARRAY true)`,
        (err: Error | null) => err ? rej(err) : res()
      )
    })

    const { readFileSync } = await import('node:fs')
    const rows: CandidateRow[] = JSON.parse(readFileSync(ndjsonPath, 'utf8'))
    console.log(`[INFO] Scoring ${rows.length} candidates …`)

    const pvgisUrl = argMap['pvgis-url'] ?? PVGIS_BASE_URL
    const pvgisEnabled = pvgisUrl.length > 0 && pvgisUrl !== 'disabled'
    const dataSources: string[] = []
    if (existsSync(argMap['grid-dir'] ?? '')) {
      dataSources.push('osm_power', 'hifld')
    }

    const ghiLookup = new Map<string, number>()
    const ghiLookupPath = argMap['ghi-lookup']
    if (ghiLookupPath && existsSync(ghiLookupPath)) {
      await new Promise<void>((res, rej) => {
        db.all(
          `SELECT h3Index, ghi_kwh_m2_day FROM read_parquet('${ghiLookupPath}') WHERE ghi_kwh_m2_day IS NOT NULL`,
          (err: Error | null, result: { h3Index: string; ghi_kwh_m2_day: number }[]) => {
            if (err) return rej(err)
            for (const row of result ?? []) {
              ghiLookup.set(row.h3Index, row.ghi_kwh_m2_day)
            }
            console.log(`[INFO] Loaded ${ghiLookup.size} GHI samples from raster lookup`)
            res()
          },
        )
      })
    }

    const scored: ScoreRow[] = []
    const useRaster = ghiLookup.size > 0
    const BATCH = useRaster ? 5000 : 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const results = await Promise.all(
        batch.map(r => scoreCandidate(r, { pvgisEnabled: useRaster ? false : pvgisEnabled, dataSources, ghiLookup })),
      )
      scored.push(...results)
      if (i % 50000 === 0 || i + BATCH >= rows.length) {
        console.log(`[INFO]   ${Math.min(i + BATCH, rows.length)}/${rows.length} scored`)
      }
      if (!useRaster && pvgisEnabled && i + BATCH < rows.length) {
        await new Promise(r => setTimeout(r, 1200))
      }
    }

    console.log(`[INFO] Writing scores …`)
    const outNdjson = outputPath.replace('.parquet', '_tmp.ndjson')
    await writeFile(outNdjson, JSON.stringify(scored))
    try {
      await new Promise<void>((res, rej) => {
        db.run(
          `COPY (SELECT * FROM read_json_auto('${outNdjson}')) TO '${outputPath}' (FORMAT PARQUET)`,
          (err: Error | null) => err ? rej(err) : res()
        )
      })
      console.log(`[OK] Wrote ${outputPath}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[WARN] Parquet write failed: ${msg}. NDJSON at ${outNdjson}`)
    }

    const goCount = scored.filter(s => s.decision === 'GO').length
    const investigateCount = scored.filter(s => s.decision === 'INVESTIGATE').length
    const killCount = scored.filter(s => s.decision === 'KILL').length
    console.log(`[OK] GO: ${goCount}  INVESTIGATE: ${investigateCount}  KILL: ${killCount}`)
  }
}
