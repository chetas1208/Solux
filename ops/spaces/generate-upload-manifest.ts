#!/usr/bin/env tsx
/**
 * Generate upload manifest with sha256 checksums for DO Spaces sync.
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

function parseArgs() {
  const args = process.argv.slice(2)
  const map: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i]?.startsWith('--')) {
      const key = args[i].slice(2).split('=')[0]!
      const val = args[i].includes('=')
        ? args[i].split('=').slice(1).join('=')
        : args[i + 1] ?? ''
      map[key] = val
      if (!args[i].includes('=')) i++
    }
  }
  return map
}

async function sha256(file: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    createReadStream(file)
      .on('data', (d) => hash.update(d))
      .on('end', () => resolveHash(hash.digest('hex')))
      .on('error', reject)
  })
}

function contentType(path: string): string {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.geojson')) return 'application/geo+json'
  if (path.endsWith('.parquet')) return 'application/octet-stream'
  if (path.endsWith('.pmtiles') || path.endsWith('.mbtiles')) return 'application/octet-stream'
  return 'application/octet-stream'
}

async function walkFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) return []
  const out: string[] = []
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (!e.name.startsWith('.')) out.push(p)
    }
  }
  await walk(root)
  return out
}

async function main() {
  const args = parseArgs()
  const dataRoot = resolve(args['data-root'] ?? '/data/solux')
  const s3Prefix = args['s3-prefix'] ?? 'datasets/solux-site-screening/v0.1'
  const datasetVersion = args['dataset-version'] ?? 'v0.1'
  const output = resolve(args['output'] ?? join(dataRoot, 'manifests/upload_manifest.json'))

  const subdirs = ['processed', 'tiles', 'manifests', 'reports', 'catalog']
  const files: Array<{
    objectKey: string
    localPath: string
    sizeBytes: number
    sha256: string
    contentType: string
    uploadedAt: string
    datasetVersion: string
  }> = []

  const uploadedAt = new Date().toISOString()

  for (const sub of subdirs) {
    const base = join(dataRoot, sub)
    for (const file of await walkFiles(base)) {
      const rel = relative(dataRoot, file).replace(/\\/g, '/')
      const st = await stat(file)
      files.push({
        objectKey: `${s3Prefix}/${rel}`,
        localPath: file,
        sizeBytes: st.size,
        sha256: await sha256(file),
        contentType: contentType(file),
        uploadedAt,
        datasetVersion,
      })
    }
  }

  const catalog = join(dataRoot, 'processed/solux_data_catalog.json')
  if (existsSync(catalog)) {
    const st = await stat(catalog)
    files.push({
      objectKey: `${s3Prefix}/catalog/solux_data_catalog.json`,
      localPath: catalog,
      sizeBytes: st.size,
      sha256: await sha256(catalog),
      contentType: 'application/json',
      uploadedAt,
      datasetVersion,
    })
  }

  await mkdir(resolve(output, '..'), { recursive: true })
  await writeFile(
    output,
    JSON.stringify(
      {
        uploadedAt,
        datasetVersion,
        s3Prefix,
        bucket: process.env['DIGITALOCEAN_SPACES_BUCKET'] ?? '',
        totalFiles: files.length,
        totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
        files,
      },
      null,
      2,
    ),
  )
  console.log(`[OK] Upload manifest: ${output} (${files.length} files)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
