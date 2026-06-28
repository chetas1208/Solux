#!/usr/bin/env tsx
// S3-compatible upload utilities and manifest writer for DO Spaces.
// CLI: tsx src/io/s3Upload.ts write-upload-manifest [options]
import { writeFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { DATA_ROOT, dirs } from '../config.js'

interface UploadedFile {
  localPath: string
  s3Key: string
  size: number
  contentType: string
}

function inferContentType(path: string): string {
  if (path.endsWith('.parquet')) return 'application/octet-stream'
  if (path.endsWith('.geojson')) return 'application/geo+json'
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.mbtiles')) return 'application/octet-stream'
  if (path.endsWith('.pmtiles')) return 'application/octet-stream'
  if (path.endsWith('.md')) return 'text/markdown'
  if (path.endsWith('.csv')) return 'text/csv'
  return 'application/octet-stream'
}

async function listUploadedFiles(baseDir: string, s3Base: string): Promise<UploadedFile[]> {
  if (!existsSync(baseDir)) return []
  const entries = await readdir(baseDir, { recursive: true, withFileTypes: true })
  const files = entries.filter(e => e.isFile() && !e.name.startsWith('.'))

  return Promise.all(
    files.map(async (e) => {
      const fullPath = resolve(e.path ?? baseDir, e.name)
      const s = await stat(fullPath).catch(() => null)
      const relPath = relative(DATA_ROOT, fullPath)
      return {
        localPath: fullPath,
        s3Key: `${s3Base}/${relPath}`,
        size: s?.size ?? 0,
        contentType: inferContentType(fullPath),
      }
    })
  )
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('s3Upload.ts')) {
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

  if (cmd === 'write-upload-manifest') {
    const s3Base = argMap['s3-base'] ?? 's3://bucket/datasets/solux-site-screening/v0.1'
    const output = argMap['output'] ?? resolve(dirs.manifests, 'upload_manifest.json')

    const [processedFiles, tileFiles, manifestFiles] = await Promise.all([
      listUploadedFiles(dirs.processed, s3Base),
      listUploadedFiles(dirs.tiles, s3Base),
      listUploadedFiles(dirs.manifests, s3Base),
    ])

    const allFiles = [...processedFiles, ...tileFiles, ...manifestFiles]
    const totalBytes = allFiles.reduce((sum, f) => sum + f.size, 0)

    const manifest = {
      uploadedAt: new Date().toISOString(),
      s3Base,
      totalFiles: allFiles.length,
      totalBytes,
      totalMB: Math.round(totalBytes / 1024 / 1024),
      files: allFiles.map(f => ({
        localPath: f.localPath,
        s3Key: f.s3Key,
        size: f.size,
        contentType: f.contentType,
      })),
    }

    await writeFile(output, JSON.stringify(manifest, null, 2))
    console.log(`[OK] Upload manifest: ${output}`)
    console.log(`     ${manifest.totalFiles} files, ${manifest.totalMB} MB`)
  }
}
