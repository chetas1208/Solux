import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const ModelEndpointCapabilitiesSchema = z.object({
  endpointUrl: z.string(),
  checkedAt: z.string(),
  reachable: z.boolean(),
  supportedRoutes: z.array(z.string()),
  supportedModels: z.array(z.string()),
  maxBatchSize: z.number(),
  authRequired: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
})

export type ModelEndpointCapabilities = z.infer<typeof ModelEndpointCapabilitiesSchema>

export const ModelSiteAssessmentSchema = z.object({
  candidateId: z.string(),
  inputFeatureHash: z.string(),
  modelName: z.string(),
  modelEndpoint: z.string(),
  modelVersion: z.string().optional(),
  modelTask: z.string(),
  modelScore: z.number(),
  modelConfidence: z.number(),
  reasoningSummary: z.string(),
  unsupportedClaims: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  createdAt: z.string(),
})

export type ModelSiteAssessment = z.infer<typeof ModelSiteAssessmentSchema>

export function envPath(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export function dataRoot(): string {
  return envPath('DATA_ROOT', '/data/solux')
}

export function modelInputDir(): string {
  const v = envPath('DATASET_VERSION', 'v0.1')
  return join(dataRoot(), 'model_input', v)
}

export function modelOutputDir(): string {
  const v = envPath('DATASET_VERSION', 'v0.1')
  return join(dataRoot(), 'model_outputs', v)
}

export function manifestsDir(): string {
  return join(dataRoot(), 'manifests')
}

export async function writeJson(path: string, data: unknown) {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2))
}

export async function readJson<T>(path: string): Promise<T | null> {
  if (!existsSync(path)) return null
  return JSON.parse(await readFile(path, 'utf8')) as T
}
