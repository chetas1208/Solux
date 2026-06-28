import { v4 as uuid } from 'uuid'
import { GeminiClient } from './geminiClient.js'
import { ProjectSpecSchema } from '@solux/shared'
import type { ProjectSpec } from '@solux/shared'
import type { AgentTrace, AgentTraceEvent } from './schemas.js'
import { env } from '../config/env.js'

/** Known region → approximate [minLon, minLat, maxLon, maxLat] bounding boxes. */
const REGION_BBOX: Record<string, [number, number, number, number]> = {
  gujarat: [68.1, 20.1, 74.5, 24.7],
  rajasthan: [69.5, 23.0, 78.3, 30.2],
  'gujarat rajasthan': [68.1, 20.1, 78.3, 30.2],
  karnataka: [74.0, 11.5, 78.6, 18.5],
  'tamil nadu': [76.2, 8.0, 80.4, 13.6],
  maharashtra: [72.6, 15.6, 80.9, 22.0],
  nevada: [-120.0, 35.0, -114.0, 42.0],
  california: [-124.4, 32.5, -114.1, 42.0],
  texas: [-106.6, 25.8, -93.5, 36.5],
  arizona: [-114.8, 31.3, -109.0, 37.0],
  'new mexico': [-109.1, 31.3, -103.0, 37.0],
  india: [68.0, 8.0, 97.4, 37.1],
  usa: [-125.0, 24.0, -66.9, 49.4],
}

function inferBBox(region: string): [number, number, number, number] | undefined {
  const key = region.toLowerCase().trim()
  // Try exact match first, then partial match
  if (REGION_BBOX[key]) return REGION_BBOX[key]
  for (const [k, bbox] of Object.entries(REGION_BBOX)) {
    if (key.includes(k) || k.includes(key)) return bbox
  }
  return undefined
}

const SYSTEM_PROMPT = `You are a solar project analyst. Parse the user's natural-language requirement into structured JSON.

RULES:
- Only extract facts explicitly stated or clearly implied
- Never invent capacity, coordinates, or thresholds not mentioned
- If the user mentions "Gujarat and Rajasthan", targetRegion = "Gujarat and Rajasthan"
- For technology: "solar + storage" = solar_plus_storage; floating/reservoir/canal/lake = floating_pv; else solar_pv
- For country: Gujarat/Rajasthan/Karnataka → India; Nevada/Texas/California → USA
- missingFields: list any of [targetCapacityMW, targetRegion, technology] that you cannot determine
- Do not include searchBBox — it is added server-side
- Return ONLY valid JSON, no prose

JSON schema:
{
  "name": string,
  "technology": "solar_pv" | "solar_plus_storage" | "floating_pv",
  "targetCapacityMW": number,
  "storageCapacityMW": number | null,
  "storageHours": number | null,
  "targetCountry": "USA" | "India" | "Other",
  "targetRegion": string,
  "preferredSiteTypes": ("land"|"reservoir"|"canal"|"lake"|"coastal_shallow")[],
  "excludedSiteTypes": ("land"|"reservoir"|"canal"|"lake"|"coastal_shallow")[],
  "maxSlopeAngle": number,
  "avoidDenseVegetation": boolean,
  "avoidProtectedAreas": boolean,
  "minGridVoltageKV": number,
  "maxGridDistanceKm": number,
  "minGhiKwhM2Day": number,
  "maxWaterDepthM": number,
  "maxWaveHeightM": number,
  "additionalConstraints": string[],
  "missingFields": string[]
}`

export async function parseProjectPrompt(
  rawPrompt: string,
  projectId: string,
): Promise<{ spec: ProjectSpec; trace: AgentTrace }> {
  if (!GeminiClient.isAvailable()) {
    throw new Error('GEMINI_API_KEY not configured — cannot parse project prompt')
  }

  const client = new GeminiClient()
  const model = client.fastModel()
  const traceId = uuid()
  const startedAt = new Date().toISOString()
  const events: AgentTraceEvent[] = []

  const prompt = `${SYSTEM_PROMPT}\n\nProject requirement:\n${rawPrompt}`

  events.push({
    timestamp: new Date().toISOString(),
    type: 'model_request',
    toolName: 'parse_project_prompt',
    input: { rawPrompt, model: client.fastModelName },
  })

  const reqStart = Date.now()

  let raw: string
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    raw = result.response.text()
  } catch (err) {
    events.push({ timestamp: new Date().toISOString(), type: 'error', error: String(err) })
    const trace = buildTrace(traceId, projectId, startedAt, events, client.fastModelName, 'failed', String(err))
    throw Object.assign(new Error(`Gemini parse failed: ${err}`), { trace })
  }

  events.push({
    timestamp: new Date().toISOString(),
    type: 'model_response',
    output: raw,
    durationMs: Date.now() - reqStart,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    const trace = buildTrace(traceId, projectId, startedAt, events, client.fastModelName, 'failed', 'Invalid JSON from Gemini')
    throw Object.assign(new Error('Gemini returned invalid JSON'), { trace })
  }

  // Infer bbox server-side — never trust Gemini to invent coordinates
  const region = (parsed['targetRegion'] as string | undefined) ?? ''
  const inferredBBox = inferBBox(region)

  const specResult = ProjectSpecSchema.safeParse({
    ...parsed,
    id: uuid(),
    briefId: projectId,
    parsedAt: new Date().toISOString(),
    geminiModel: client.fastModelName,
    preferredSiteTypes: parsed['preferredSiteTypes'] ?? ['land'],
    excludedSiteTypes: parsed['excludedSiteTypes'] ?? [],
    additionalConstraints: [
      ...(parsed['additionalConstraints'] as string[] ?? []),
      ...(parsed['missingFields'] as string[] ?? []).map((f: string) => `missing:${f}`),
    ],
    searchBBox: inferredBBox,
    maxSlopeAngle: parsed['maxSlopeAngle'] ?? 15,
    avoidDenseVegetation: parsed['avoidDenseVegetation'] ?? true,
    avoidProtectedAreas: parsed['avoidProtectedAreas'] ?? true,
    minGridVoltageKV: parsed['minGridVoltageKV'] ?? 33,
    maxGridDistanceKm: parsed['maxGridDistanceKm'] ?? 25,
    minGhiKwhM2Day: parsed['minGhiKwhM2Day'] ?? 4.0,
    maxWaterDepthM: parsed['maxWaterDepthM'] ?? 3,
    maxWaveHeightM: parsed['maxWaveHeightM'] ?? 0.5,
  })

  if (!specResult.success) {
    const msg = specResult.error.message
    const trace = buildTrace(traceId, projectId, startedAt, events, client.fastModelName, 'failed', msg)
    throw Object.assign(new Error(`Schema validation failed: ${msg}`), { trace })
  }

  const trace = buildTrace(traceId, projectId, startedAt, events, client.fastModelName, 'completed')
  return { spec: specResult.data, trace }
}

function buildTrace(
  id: string,
  projectId: string,
  startedAt: string,
  events: AgentTraceEvent[],
  model: string,
  status: 'completed' | 'failed',
  error?: string,
): AgentTrace {
  return {
    id,
    projectId,
    runType: 'parse_prompt',
    model,
    startedAt,
    completedAt: new Date().toISOString(),
    status,
    events,
    toolCallCount: 1,
    error,
  }
}
