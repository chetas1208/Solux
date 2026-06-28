#!/usr/bin/env tsx
// Generate H3 candidate cells for all scoped countries.
// CLI: tsx src/scoring/candidateSchema.ts generate-candidates [options]
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { H3_RES_LAND, H3_RES_WATER, COUNTRY_SCOPE, RUN_REGION_SUBSET, DATA_ROOT, dirs, scopeIncludes } from '../config.js'
import { bboxToH3Cells, h3ToFeature, REGION_BBOXES, type BBox, type SiteSurfaceType } from '../geo.js'
import type { FeatureCollection, Feature, Polygon } from 'geojson'

interface CandidateSite {
  h3Index: string
  h3Res: number
  country: string
  region?: string
  centroid_lat: number
  centroid_lon: number
  area_km2: number
  site_surface_type: SiteSurfaceType
  generated_at: string
}

interface CandidateRow extends CandidateSite {
  geometry_wkt?: string
}

function makeRow(h3Index: string, country: string, region: string | undefined, surfaceType: SiteSurfaceType): CandidateSite {
  const feat = h3ToFeature(h3Index)
  const props = feat.properties!
  return {
    h3Index,
    h3Res: props.h3Res as number,
    country,
    region,
    centroid_lat: props.centroid_lat as number,
    centroid_lon: props.centroid_lon as number,
    area_km2: props.area_km2 as number,
    site_surface_type: surfaceType,
    generated_at: new Date().toISOString(),
  }
}

async function generateCandidates(
  opts: {
    h3ResLand: number
    h3ResWater: number
    countryScope: string
    regionSubset: boolean
    outputDir: string
  }
): Promise<CandidateSite[]> {
  const candidates: CandidateSite[] = []
  const countries = opts.countryScope.split(',').map(s => s.trim().toUpperCase())

  const USA_REGIONS = opts.regionSubset
    ? ['AZ', 'NV', 'TX'] as const
    : ['USA'] as const

  const INDIA_REGIONS = opts.regionSubset
    ? ['RAJ', 'GUJ'] as const
    : ['INDIA'] as const

  if (countries.includes('USA')) {
    for (const region of USA_REGIONS) {
      const bbox = REGION_BBOXES[region]
      if (!bbox) { console.warn(`[WARN] No bbox for region: ${region}`); continue }
      console.log(`[INFO] Generating USA/${region} land cells (H3 res ${opts.h3ResLand}) …`)
      const cells = bboxToH3Cells(bbox, opts.h3ResLand)
      console.log(`[INFO]   ${cells.length} cells`)
      for (const cell of cells) {
        candidates.push(makeRow(cell, 'USA', region, 'land'))
      }
    }
  }

  if (countries.includes('INDIA')) {
    for (const region of INDIA_REGIONS) {
      const bbox = REGION_BBOXES[region]
      if (!bbox) { console.warn(`[WARN] No bbox for region: ${region}`); continue }
      console.log(`[INFO] Generating INDIA/${region} land cells (H3 res ${opts.h3ResLand}) …`)
      const cells = bboxToH3Cells(bbox, opts.h3ResLand)
      console.log(`[INFO]   ${cells.length} cells`)
      for (const cell of cells) {
        candidates.push(makeRow(cell, 'INDIA', region, 'land'))
      }
    }
  }

  return candidates
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('candidateSchema.ts')) {
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

  if (cmd === 'generate-candidates') {
    const outputDir = argMap['output-dir'] ?? resolve(dirs.processed, 'candidates')
    await mkdir(outputDir, { recursive: true })

    const candidates = await generateCandidates({
      h3ResLand: parseInt(argMap['h3-res-land'] ?? String(H3_RES_LAND), 10),
      h3ResWater: parseInt(argMap['h3-res-water'] ?? String(H3_RES_WATER), 10),
      countryScope: argMap['country-scope'] ?? COUNTRY_SCOPE,
      regionSubset: argMap['region-subset'] === 'true',
      outputDir,
    })

    console.log(`[INFO] Total candidates: ${candidates.length}`)

    // Write GeoJSON
    const geojsonPath = resolve(outputDir, 'solux_candidate_sites.geojson')
    const fc: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: candidates.map(c => ({
        type: 'Feature' as const,
        geometry: h3ToFeature(c.h3Index).geometry,
        properties: { ...c },
      })),
    }
    await writeFile(geojsonPath, JSON.stringify(fc))
    console.log(`[OK] Wrote ${geojsonPath}`)

    // Write NDJSON for DuckDB parquet ingestion
    const ndjsonPath = resolve(outputDir, 'solux_candidate_sites.ndjson')
    const lines = candidates.map(c => JSON.stringify(c)).join('\n')
    await writeFile(ndjsonPath, lines)

    // Write parquet via npm duckdb (no CLI required)
    const parquetPath = resolve(outputDir, 'solux_candidate_sites.parquet')
    try {
      const duckdb = await import('duckdb')
      const db = new duckdb.default.Database(':memory:')
      await new Promise<void>((res, rej) => {
        db.run(
          `COPY (SELECT * FROM read_json_auto('${ndjsonPath}')) TO '${parquetPath}' (FORMAT PARQUET)`,
          (err: Error | null) => err ? rej(err) : res()
        )
      })
      console.log(`[OK] Wrote ${parquetPath}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[WARN] Parquet write failed: ${msg}`)
      console.warn(`[WARN] GeoJSON + NDJSON available at ${outputDir}`)
    }
  }
}
