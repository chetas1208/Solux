import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { modelOutputDir } from './config.js'

const RequiredFiles = [
  'model_analysis_manifest.json',
  'model_quality_report.json',
  'model_site_assessments.json',
  'model_reranked_sites.json',
]

export async function validateModelOutputs(): Promise<{ ok: boolean; errors: string[] }> {
  const outDir = modelOutputDir()
  const errors: string[] = []

  for (const f of RequiredFiles) {
    const p = join(outDir, f)
    if (!existsSync(p)) errors.push(`Missing ${f}`)
  }

  if (errors.length) return { ok: false, errors }

  const manifest = JSON.parse(
    await readFile(join(outDir, 'model_analysis_manifest.json'), 'utf8'),
  ) as { assessmentCount?: number; candidateCount?: number }

  if (!manifest.assessmentCount || manifest.assessmentCount === 0) {
    errors.push('Zero assessments in manifest')
  }

  const assessments = JSON.parse(
    await readFile(join(outDir, 'model_site_assessments.json'), 'utf8'),
  ) as unknown[]

  const rowSchema = z.object({
    candidateId: z.string(),
    modelScore: z.number(),
    modelConfidence: z.number(),
    modelTask: z.string(),
    unsupportedClaims: z.array(z.string()),
  })

  let invalid = 0
  for (const row of assessments.slice(0, 100)) {
    const parsed = rowSchema.safeParse(row)
    if (!parsed.success) invalid++
  }
  if (invalid > 0) errors.push(`${invalid} malformed assessment rows (sample)`)

  console.log(errors.length ? `[FAIL] ${errors.join('; ')}` : '[OK] Model outputs validated')
  return { ok: errors.length === 0, errors }
}

if (process.argv[1]?.endsWith('validateModelOutputs.ts')) {
  validateModelOutputs().then((r) => process.exit(r.ok ? 0 : 1))
}
