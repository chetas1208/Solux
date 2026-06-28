#!/usr/bin/env tsx
// IO helpers: convert EIA-860, WRI GPPD CSVs → Parquet via DuckDB.
// CLI: tsx src/io/parquet.ts eia860-to-parquet|wri-gppd-to-parquet [options]
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { dirs } from '../config.js'

function duckdb(sql: string): void {
  execSync(`duckdb -c "${sql.replace(/"/g, '\\"')}"`, { stdio: ['pipe', 'pipe', 'pipe'] })
}

function eia860ToParquet(input: string, output: string): void {
  if (!existsSync(input)) throw new Error(`Input not found: ${input}`)
  // EIA-860 is an Excel file; use DuckDB's spatial extension can't read Excel directly.
  // Extract via xlsx → CSV first (fallback to copy if already CSV)
  if (input.endsWith('.csv')) {
    execSync(`duckdb -c "COPY (SELECT * FROM read_csv_auto('${input}')) TO '${output}' (FORMAT PARQUET);"`)
  } else {
    // Requires python3 + openpyxl as one-time conversion if xlsx
    try {
      execSync(`python3 -c "
import sys, json
import openpyxl
wb = openpyxl.load_workbook('${input}', read_only=True, data_only=True)
# Sheet 3 = 'Operable' for EIA-860
ws = wb.worksheets[2] if len(wb.worksheets) > 2 else wb.active
rows = list(ws.iter_rows(values_only=True))
headers = rows[0]
import csv, io
out = io.StringIO()
w = csv.writer(out)
w.writerows(rows)
print(out.getvalue())
" > /tmp/eia860_tmp.csv && duckdb -c "COPY (SELECT * FROM read_csv_auto('/tmp/eia860_tmp.csv')) TO '${output}' (FORMAT PARQUET);"`, { stdio: 'pipe' })
    } catch {
      console.warn('[WARN] EIA-860 xlsx conversion needs python3 + openpyxl. CSV fallback unavailable.')
      throw new Error('EIA-860 Excel conversion requires python3 openpyxl')
    }
  }
  console.log(`[OK] eia860 → ${output}`)
}

function wriGppdToParquet(input: string, output: string, fuelType?: string): void {
  if (!existsSync(input)) throw new Error(`Input not found: ${input}`)
  const filter = fuelType ? `WHERE UPPER(primary_fuel) = '${fuelType.toUpperCase()}'` : ''
  execSync(`duckdb -c "COPY (SELECT * FROM read_csv_auto('${input}') ${filter}) TO '${output}' (FORMAT PARQUET);"`, { stdio: 'pipe' })
  console.log(`[OK] WRI GPPD${fuelType ? ` (${fuelType})` : ''} → ${output}`)
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('parquet.ts')) {
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

  const input = argMap['input'] ?? ''
  const output = argMap['output'] ?? resolve(dirs.staging, `${cmd}.parquet`)
  await mkdir(dirname(output), { recursive: true })

  if (cmd === 'eia860-to-parquet') {
    eia860ToParquet(input, output)
  } else if (cmd === 'wri-gppd-to-parquet') {
    wriGppdToParquet(input, output, argMap['fuel-type'])
  } else {
    console.error(`Unknown command: ${cmd}`)
    process.exit(1)
  }
}
