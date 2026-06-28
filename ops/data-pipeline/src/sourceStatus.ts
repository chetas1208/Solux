#!/usr/bin/env tsx
// Check status of all pipeline data sources and write catalog.
// CLI: tsx src/sourceStatus.ts write-catalog [--data-root ...] [--output ...]
import { existsSync, readFileSync } from 'node:fs'
import { writeFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DATA_ROOT, PIPELINE_DIR, dirs } from './config.js'
import { getSourceRegistry, type DataSourceDef } from './sourceRegistry.js'

export type SourceStatus = 'downloaded' | 'sampled' | 'partial' | 'manual_required' | 'unavailable' | 'no_samples' | 'unknown'

export interface SourceStatusRecord {
  id: string
  label: string
  category: string
  status: SourceStatus
  rawDir: string
  fileCount: number
  totalBytes: number
  license: string
  checkedAt: string
  notes?: string
}

export async function checkSourceStatus(source: DataSourceDef): Promise<SourceStatusRecord> {
  const rawDir = resolve(DATA_ROOT, source.rawDir)
  const checkedAt = new Date().toISOString()

  // Check for manual download notice
  const manualNotice = resolve(rawDir, 'MANUAL_DOWNLOAD_REQUIRED.md')
  if (existsSync(manualNotice)) {
    return {
      id: source.id, label: source.label, category: source.category,
      status: 'manual_required', rawDir, fileCount: 0, totalBytes: 0,
      license: source.license, checkedAt,
      notes: 'Manual download required — see MANUAL_DOWNLOAD_REQUIRED.md',
    }
  }

  // Check for source-status.jsonl entry
  const statusJsonl = resolve(dirs.manifests, 'source-status.jsonl')
  if (existsSync(statusJsonl)) {
    const lines = readFileSync(statusJsonl, 'utf8').split('\n').filter(Boolean)
    for (const line of lines.reverse()) {
      try {
        const entry = JSON.parse(line)
        if (entry.id === source.id) {
          return {
            id: source.id, label: source.label, category: source.category,
            status: entry.status as SourceStatus, rawDir, fileCount: 0, totalBytes: 0,
            license: source.license, checkedAt: entry.checkedAt ?? checkedAt,
            notes: entry.note,
          }
        }
      } catch { /* skip */ }
    }
  }

  // Check raw dir for files
  if (!existsSync(rawDir)) {
    return {
      id: source.id, label: source.label, category: source.category,
      status: 'unavailable', rawDir, fileCount: 0, totalBytes: 0,
      license: source.license, checkedAt,
    }
  }

  try {
    const entries = await readdir(rawDir, { recursive: true, withFileTypes: true })
    const files = entries.filter(e => e.isFile() && !e.name.startsWith('.'))
    const fileCount = files.length

    if (fileCount === 0) {
      return {
        id: source.id, label: source.label, category: source.category,
        status: 'unavailable', rawDir, fileCount: 0, totalBytes: 0,
        license: source.license, checkedAt,
      }
    }

    return {
      id: source.id, label: source.label, category: source.category,
      status: 'downloaded', rawDir, fileCount, totalBytes: 0,
      license: source.license, checkedAt,
    }
  } catch {
    return {
      id: source.id, label: source.label, category: source.category,
      status: 'unknown', rawDir, fileCount: 0, totalBytes: 0,
      license: source.license, checkedAt,
    }
  }
}

export async function getAllSourceStatuses(): Promise<SourceStatusRecord[]> {
  const sources = getSourceRegistry()
  return Promise.all(sources.map(checkSourceStatus))
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('sourceStatus.ts')) {
  const [,, cmd, ...rest] = process.argv
  const args = Object.fromEntries(
    rest.filter(a => a.startsWith('--')).map(a => {
      const [k, ...v] = a.slice(2).split('=')
      return [k, v.join('=') || rest[rest.indexOf(a) + 1]]
    })
  )

  if (cmd === 'write-catalog') {
    const output = args['output'] ?? resolve(dirs.processed, 'solux_data_catalog.json')
    const statuses = await getAllSourceStatuses()
    const catalog = {
      datasetVersion: '0.1.0',
      generatedAt: new Date().toISOString(),
      countries: (args['country-scope'] ?? 'USA,INDIA').split(','),
      doSpacesEndpoint: args['do-spaces-endpoint'] ?? null,
      doSpacesBucket: args['do-spaces-bucket'] ?? null,
      sources: statuses,
      summary: {
        total: statuses.length,
        downloaded: statuses.filter(s => ['downloaded', 'sampled'].includes(s.status)).length,
        manualRequired: statuses.filter(s => s.status === 'manual_required').length,
        unavailable: statuses.filter(s => s.status === 'unavailable').length,
      },
    }
    await writeFile(output, JSON.stringify(catalog, null, 2))
    console.log(`[OK] Wrote catalog: ${output}`)
    console.log(`     ${catalog.summary.downloaded}/${catalog.summary.total} sources available`)
  }
}
