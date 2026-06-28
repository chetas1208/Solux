#!/usr/bin/env tsx
// Convert parquet files to GeoJSON.
// CLI: tsx src/io/geojson.ts parquet-to-geojson --input ... --output ... --lat-col ... --lon-col ...
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import type { FeatureCollection, Feature, Point, GeoJsonProperties } from 'geojson'
import { dirs } from '../config.js'

function readParquetAsJson(parquetPath: string): unknown[] {
  const tmpJson = parquetPath.replace('.parquet', '_geojson_tmp.json')
  execSync(`duckdb -c "COPY (SELECT * FROM read_parquet('${parquetPath}')) TO '${tmpJson}' (FORMAT JSON, ARRAY true);"`, { stdio: 'pipe' })
  const { readFileSync } = require('node:fs')
  const data = JSON.parse(readFileSync(tmpJson, 'utf8'))
  try { require('node:fs').unlinkSync(tmpJson) } catch { /* ok */ }
  return data
}

async function parquetToGeoJSON(opts: {
  input: string
  output: string
  latCol: string
  lonCol: string
}): Promise<void> {
  if (!existsSync(opts.input)) throw new Error(`Input not found: ${opts.input}`)
  await mkdir(dirname(opts.output), { recursive: true })

  const rows = readParquetAsJson(opts.input) as Record<string, unknown>[]
  const features: Feature<Point, GeoJsonProperties>[] = rows
    .filter(r => {
      const lat = r[opts.latCol]
      const lon = r[opts.lonCol]
      return typeof lat === 'number' && typeof lon === 'number' &&
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    })
    .map(r => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [r[opts.lonCol] as number, r[opts.latCol] as number],
      },
      properties: Object.fromEntries(
        Object.entries(r).filter(([k]) => k !== opts.latCol && k !== opts.lonCol)
      ),
    }))

  const fc: FeatureCollection<Point, GeoJsonProperties> = {
    type: 'FeatureCollection',
    features,
  }

  await writeFile(opts.output, JSON.stringify(fc))
  console.log(`[OK] ${features.length} features → ${opts.output}`)
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('geojson.ts')) {
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

  if (cmd === 'parquet-to-geojson') {
    await parquetToGeoJSON({
      input: argMap['input'] ?? '',
      output: argMap['output'] ?? resolve(dirs.processed, 'output.geojson'),
      latCol: argMap['lat-col'] ?? 'centroid_lat',
      lonCol: argMap['lon-col'] ?? 'centroid_lon',
    })
  } else {
    console.error(`Unknown command: ${cmd}`)
    process.exit(1)
  }
}
