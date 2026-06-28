#!/usr/bin/env tsx
// Write dataset and source manifests.
// CLI: tsx src/manifest.ts write-source-manifest|write-dataset-manifest [--output ...]
import { existsSync, readFileSync } from 'node:fs'
import { writeFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DATA_ROOT, PIPELINE_DIR, dirs, COUNTRY_SCOPE } from './config.js'
import { getSourceRegistry } from './sourceRegistry.js'
import { getAllSourceStatuses } from './sourceStatus.js'
import { sha256File } from './checksum.js'

async function getFileEntries(dir: string): Promise<{ path: string; size: number; sha256?: string }[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  const files = entries.filter(e => e.isFile() && !e.name.startsWith('.'))
  return Promise.all(
    files.map(async (e) => {
      const fullPath = resolve(e.path ?? dir, e.name)
      const s = await stat(fullPath).catch(() => null)
      return { path: fullPath, size: s?.size ?? 0 }
    })
  )
}

async function writeSourceManifest(output: string): Promise<void> {
  const statuses = await getAllSourceStatuses()
  const versionFile = resolve(PIPELINE_DIR, 'dataset-version.json')
  const version = existsSync(versionFile)
    ? JSON.parse(readFileSync(versionFile, 'utf8'))
    : { version: '0.1.0' }

  const manifest = {
    name: 'Solux Site Screening — Source Manifest',
    version: version.version,
    generatedAt: new Date().toISOString(),
    countries: COUNTRY_SCOPE.split(','),
    sources: statuses.map(s => ({
      id: s.id,
      label: s.label,
      category: s.category,
      status: s.status,
      rawDir: s.rawDir,
      fileCount: s.fileCount,
      license: s.license,
      checkedAt: s.checkedAt,
      notes: s.notes,
    })),
  }

  await writeFile(output, JSON.stringify(manifest, null, 2))
  console.log(`[OK] Wrote source manifest: ${output}`)
}

async function writeDatasetManifest(output: string): Promise<void> {
  const versionFile = resolve(PIPELINE_DIR, 'dataset-version.json')
  const version = existsSync(versionFile)
    ? JSON.parse(readFileSync(versionFile, 'utf8'))
    : { version: '0.1.0' }

  const procDir = dirs.processed
  const [candidateFiles, scoringFiles, tileFiles] = await Promise.all([
    getFileEntries(resolve(procDir, 'candidates')),
    getFileEntries(resolve(procDir, 'scoring')),
    getFileEntries(dirs.tiles),
  ])

  const licenseNotesPath = resolve(PIPELINE_DIR, 'LICENSE_NOTES.md')
  const sourceRefsPath = resolve(PIPELINE_DIR, 'SOURCE_REFERENCES.md')

  const manifest = {
    name: 'Solux Site Screening Dataset',
    version: version.version,
    generatedAt: new Date().toISOString(),
    dataRoot: DATA_ROOT,
    countries: COUNTRY_SCOPE.split(','),
    h3ResolutionLand: version.h3ResLand ?? 7,
    h3ResolutionWater: version.h3ResWater ?? 7,
    files: {
      candidates: candidateFiles.map(f => ({ path: f.path, size: f.size })),
      scores: scoringFiles.map(f => ({ path: f.path, size: f.size })),
      tiles: tileFiles.map(f => ({ path: f.path, size: f.size })),
    },
    license: existsSync(licenseNotesPath) ? licenseNotesPath : null,
    sourceReferences: existsSync(sourceRefsPath) ? sourceRefsPath : null,
    attribution: [
      'geoBoundaries: Runfola D et al. (2020) PLOS ONE. CC BY 4.0 / ODbL',
      'USPVDB: Lawrence Berkeley National Laboratory. Public domain.',
      'ESA WorldCover: ESA / Vito, 2021. CC BY 4.0.',
      'Copernicus DEM: © DLR e.V. 2010-2014 / © Airbus DS 2014-2018. Free for non-commercial use.',
      'PVGIS: EC Joint Research Centre. Free for non-commercial use.',
      'NASA POWER: NASA. Open Data.',
      'OpenStreetMap contributors: ODbL.',
    ],
  }

  await writeFile(output, JSON.stringify(manifest, null, 2))
  console.log(`[OK] Wrote dataset manifest: ${output}`)
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('manifest.ts')) {
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

  if (cmd === 'write-source-manifest') {
    const output = argMap['output'] ?? resolve(dirs.manifests, 'source_manifest.json')
    await writeSourceManifest(output)
  } else if (cmd === 'write-dataset-manifest') {
    const output = argMap['output'] ?? resolve(dirs.manifests, 'dataset_manifest.json')
    await writeDatasetManifest(output)
  } else {
    console.error(`Unknown command: ${cmd}`)
    process.exit(1)
  }
}
