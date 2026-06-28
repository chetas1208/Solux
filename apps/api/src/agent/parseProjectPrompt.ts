import { v4 as uuid } from 'uuid'
import { ProjectSpecSchema } from '@solux/shared'
import type { ProjectSpec } from '@solux/shared'
import type { AgentTrace, AgentTraceEvent } from './schemas.js'
import { generateText, isLlmAvailable, llmUnavailableReason, parseJsonFromLlm } from './llmClient.js'

/** Known region → approximate [minLon, minLat, maxLon, maxLat] bounding boxes. */
const REGION_BBOX: Record<string, [number, number, number, number]> = {
  gujarat: [68.1, 20.1, 74.5, 24.7],
  rajasthan: [69.5, 23.0, 78.3, 30.2],
  'gujarat rajasthan': [68.1, 20.1, 78.3, 30.2],
  karnataka: [74.0, 11.5, 78.6, 18.5],
  'tamil nadu': [76.2, 8.0, 80.4, 13.6],
  maharashtra: [72.6, 15.6, 80.9, 22.0],
  nevada: [-120.0, 35.0, -114.0, 42.0],
  'nevada desert': [-120.0, 35.0, -114.0, 42.0],
  california: [-124.4, 32.5, -114.1, 42.0],
  texas: [-106.6, 25.8, -93.5, 36.5],
  arizona: [-114.8, 31.3, -109.0, 37.0],
  'new mexico': [-109.1, 31.3, -103.0, 37.0],
  india: [68.0, 8.0, 97.4, 37.1],
  usa: [-125.0, 24.0, -66.9, 49.4],
}

function inferBBox(region: string, rawPrompt?: string): [number, number, number, number] | undefined {
  const haystack = `${rawPrompt ?? ''} ${region}`.toLowerCase()
  const entries = Object.entries(REGION_BBOX).sort((a, b) => b[0].length - a[0].length)
  for (const [k, bbox] of entries) {
    if (haystack.includes(k)) return bbox
  }
  return undefined
}

const SYSTEM_PROMPT = `You are a solar project analyst. Parse the user's natural-language requirement into structured JSON.

RULES:
- Only extract facts explicitly stated or clearly implied
- Never invent capacity, coordinates, or thresholds not mentioned
- If the user mentions "Gujarat and Rajasthan", targetRegion = "Gujarat and Rajasthan"
- For technology: "solar + storage" = solar_plus_storage; floating/reservoir/canal/lake = floating_pv; else solar_pv
- For country: Gujarat/Rajasthan/Karnataka/Tamil Nadu/Maharashtra → India; Nevada/Texas/California/Arizona/New Mexico → USA
- targetCountry: "USA" if only USA states mentioned; "India" if only India states mentioned; "India" if India+USA mixed (use first supported country); "Other" if ONLY unsupported countries
- unsupportedCountries: list every country mentioned that is NOT India or United States — e.g. Brazil, Australia, China, EU countries, etc. Empty array if none.
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
  "unsupportedCountries": string[],
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
  if (!isLlmAvailable()) {
    throw new Error(`${llmUnavailableReason()} — cannot parse project prompt`)
  }

  const traceId = uuid()
  const startedAt = new Date().toISOString()
  const events: AgentTraceEvent[] = []

  const prompt = `${SYSTEM_PROMPT}\n\nProject requirement:\n${rawPrompt}`

  events.push({
    timestamp: new Date().toISOString(),
    type: 'model_request',
    toolName: 'parse_project_prompt',
    input: { rawPrompt },
  })

  const reqStart = Date.now()

  let raw: string
  let modelUsed: string
  try {
    const result = await generateText(prompt, { jsonMode: true, modelHint: 'fast' })
    raw = result.text
    modelUsed = `${result.provider}/${result.model}`
    events.push({
      timestamp: new Date().toISOString(),
      type: 'model_response',
      output: { text: raw, provider: result.provider },
      durationMs: Date.now() - reqStart,
    })
  } catch (err) {
    events.push({ timestamp: new Date().toISOString(), type: 'error', error: String(err) })
    const trace = buildTrace(traceId, projectId, startedAt, events, 'none', 'failed', String(err))
    throw Object.assign(new Error(`LLM parse failed: ${err}`), { trace })
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseJsonFromLlm(raw)
  } catch {
    const trace = buildTrace(traceId, projectId, startedAt, events, modelUsed, 'failed', 'Invalid JSON from LLM')
    throw Object.assign(new Error('LLM returned invalid JSON'), { trace })
  }

  const region = (parsed['targetRegion'] as string | undefined) ?? ''
  const inferredBBox = inferBBox(region, rawPrompt)

  for (const key of ['storageCapacityMW', 'storageHours', 'searchBBox', 'searchPolygon'] as const) {
    if (parsed[key] === null) delete parsed[key]
  }

  // Encode unsupported countries as additionalConstraints so they survive schema parsing
  const unsupportedCountries = (parsed['unsupportedCountries'] as string[] | undefined) ?? []
  delete parsed['unsupportedCountries']
  if (unsupportedCountries.length) {
    parsed['additionalConstraints'] = [
      ...((parsed['additionalConstraints'] as string[]) ?? []),
      ...unsupportedCountries.map((c: string) => `unsupported_region:${c}`),
    ]
  }
  if (parsed['targetCapacityMW'] == null) {
    parsed['targetCapacityMW'] = 50
    parsed['missingFields'] = [
      ...((parsed['missingFields'] as string[]) ?? []),
      'targetCapacityMW',
    ]
  }

  const specResult = ProjectSpecSchema.safeParse({
    ...parsed,
    id: uuid(),
    briefId: projectId,
    parsedAt: new Date().toISOString(),
    geminiModel: modelUsed,
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
    const trace = buildTrace(traceId, projectId, startedAt, events, modelUsed, 'failed', msg)
    throw Object.assign(new Error(`Schema validation failed: ${msg}`), { trace })
  }

  const spec = specResult.data
  const trace = buildTrace(traceId, projectId, startedAt, events, modelUsed, 'completed')
  return { spec, trace }
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
