import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { readFile, appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DATA_ROOT } from './config.js'

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((res, rej) => {
    const hash = createHash('sha256')
    createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => res(hash.digest('hex')))
      .on('error', rej)
  })
}

export async function sha256String(data: string): Promise<string> {
  return createHash('sha256').update(data).digest('hex')
}

export async function recordChecksum(filePath: string, sourceId: string): Promise<void> {
  const checksumFile = resolve(DATA_ROOT, 'manifests', 'checksums.sha256')
  const hash = await sha256File(filePath)
  const line = `${hash}  ${filePath}  # ${sourceId}\n`
  await appendFile(checksumFile, line)
}

export async function verifyChecksums(checksumFile: string): Promise<{ ok: string[]; bad: string[] }> {
  if (!existsSync(checksumFile)) return { ok: [], bad: [] }
  const lines = (await readFile(checksumFile, 'utf8')).split('\n').filter(Boolean)
  const ok: string[] = []
  const bad: string[] = []
  for (const line of lines) {
    const [expected, filePath] = line.split(/\s+/)
    if (!filePath || !existsSync(filePath)) continue
    const actual = await sha256File(filePath)
    if (actual === expected) ok.push(filePath)
    else bad.push(filePath)
  }
  return { ok, bad }
}
