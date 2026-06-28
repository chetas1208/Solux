import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { modelOutputDir, envPath, manifestsDir, writeJson } from './config.js'

function s3Client() {
  return new S3Client({
    endpoint: envPath('DIGITALOCEAN_SPACES_ENDPOINT', ''),
    region: 'us-east-1',
    credentials: {
      accessKeyId: envPath('DIGITALOCEAN_SPACES_KEY', envPath('AWS_ACCESS_KEY_ID', '')),
      secretAccessKey: envPath('DIGITALOCEAN_SPACES_SECRET', envPath('AWS_SECRET_ACCESS_KEY', '')),
    },
    forcePathStyle: false,
  })
}

async function uploadFile(localPath: string, key: string) {
  const body = await readFile(localPath)
  await s3Client().send(
    new PutObjectCommand({
      Bucket: envPath('DIGITALOCEAN_SPACES_BUCKET', ''),
      Key: key,
      Body: body,
      ContentType: localPath.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    }),
  )
}

async function walkJsonFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => join(e.path ?? dir, e.name))
}

export async function pushModelOutputs() {
  if (envPath('PUSH_MODEL_OUTPUTS', 'true') !== 'true') {
    console.log('[SKIP] PUSH_MODEL_OUTPUTS=false')
    return
  }

  const bucket = envPath('DIGITALOCEAN_SPACES_BUCKET', '')
  const prefix = envPath(
    'SOLUX_OUTPUT_PREFIX',
    `outputs/solux-site-screening/${envPath('DATASET_VERSION', 'v0.1')}`,
  )
  const outDir = modelOutputDir()
  const remoteBase = `${prefix}/model_outputs`

  const files = await walkJsonFiles(outDir)
  const skipQuarantine = envPath('UPLOAD_QUARANTINE', 'false') !== 'true'

  for (const file of files) {
    if (!skipQuarantine && file.includes('/quarantine/')) continue
    const rel = file.replace(outDir, '').replace(/^\//, '')
    await uploadFile(file, `${remoteBase}/${rel}`)
    console.log(`[OK] Uploaded ${remoteBase}/${rel}`)
  }

  const caps = join(manifestsDir(), 'model_endpoint_capabilities.json')
  if (existsSync(caps)) {
    await uploadFile(caps, `${prefix}/model_outputs/endpoint_capabilities.json`)
  }

  await writeJson(join(outDir, 'push_report.json'), {
    pushedAt: new Date().toISOString(),
    bucket,
    prefix: remoteBase,
    fileCount: files.length,
  })

  console.log(`[OK] Model outputs pushed to s3://${bucket}/${remoteBase}/`)
}

if (process.argv[1]?.endsWith('push-model-outputs.ts')) {
  pushModelOutputs().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
