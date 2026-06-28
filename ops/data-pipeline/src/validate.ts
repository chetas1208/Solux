#!/usr/bin/env tsx
// Write quality report for the pipeline output.
// CLI: tsx src/validate.ts write-quality-report [--data-root ...] [--output ...]
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DATA_ROOT, dirs } from './config.js'
import { getAllSourceStatuses } from './sourceStatus.js'

interface QualityReport {
  generatedAt: string
  status: 'pass' | 'fail'
  errorCount: number
  warningCount: number
  errors: string[]
  warnings: string[]
  sourceSummary: {
    total: number
    available: number
    manualRequired: number
    unavailable: number
  }
  fileChecks: { path: string; exists: boolean; required: boolean }[]
}

async function buildQualityReport(errors: string[], warnings: string[]): Promise<QualityReport> {
  const statuses = await getAllSourceStatuses()
  const procDir = dirs.processed
  const manifestsDir = dirs.manifests

  const requiredFiles = [
    { path: resolve(procDir, 'candidates/solux_candidate_sites.parquet'), required: true },
  ]
  const optionalFiles = [
    { path: resolve(procDir, 'scoring/solux_site_scores.parquet'), required: false },
    { path: resolve(procDir, 'solux_data_catalog.json'), required: false },
    { path: resolve(manifestsDir, 'dataset_manifest.json'), required: false },
    { path: resolve(manifestsDir, 'source_manifest.json'), required: false },
    { path: resolve(manifestsDir, 'quality_report.json'), required: false },
  ]

  const fileChecks = [...requiredFiles, ...optionalFiles].map(f => ({
    path: f.path,
    exists: existsSync(f.path),
    required: f.required,
  }))

  for (const fc of fileChecks) {
    if (fc.required && !fc.exists) {
      errors.push(`Required file missing: ${fc.path}`)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    status: errors.length === 0 ? 'pass' : 'fail',
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    sourceSummary: {
      total: statuses.length,
      available: statuses.filter(s => ['downloaded', 'sampled'].includes(s.status)).length,
      manualRequired: statuses.filter(s => s.status === 'manual_required').length,
      unavailable: statuses.filter(s => s.status === 'unavailable').length,
    },
    fileChecks,
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('validate.ts')) {
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

  if (cmd === 'write-quality-report') {
    const output = argMap['output'] ?? resolve(dirs.manifests, 'quality_report.json')
    const errors = argMap['errors'] ? argMap['errors'].split('|').filter(Boolean) : []
    const warnings = argMap['warnings'] ? argMap['warnings'].split('|').filter(Boolean) : []
    const report = await buildQualityReport(errors, warnings)
    await writeFile(output, JSON.stringify(report, null, 2))
    console.log(`[${report.status === 'pass' ? 'OK' : 'FAIL'}] Quality report: ${output}`)
    console.log(`       ${report.errorCount} error(s), ${report.warningCount} warning(s)`)
    if (report.status === 'fail') process.exit(1)
  }
}
