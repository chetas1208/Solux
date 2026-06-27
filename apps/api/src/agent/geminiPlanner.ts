import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  SchemaType,
} from '@google/generative-ai'
import { v4 as uuid } from 'uuid'
import { aiConfig } from '@solux/config'
import {
  ProjectSpecSchema,
  type ProjectSpec,
  type AgentTrace,
  type AgentTraceEvent,
} from '@solux/shared'

/**
 * Gemini planner — parses natural-language project briefs into typed ProjectSpec.
 * Uses structured JSON output with schema enforcement.
 * Never invents scores — only parses constraints.
 */
export class GeminiPlanner {
  private readonly model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
  private readonly modelName = 'gemini-2.0-flash-exp'

  constructor() {
    if (!aiConfig.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    const genai = new GoogleGenerativeAI(aiConfig.geminiApiKey)
    this.model = genai.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })
  }

  static isAvailable(): boolean {
    return !!aiConfig.geminiApiKey
  }

  async parseProjectBrief(
    rawPrompt: string,
    briefId: string,
    projectId: string,
  ): Promise<{ spec: ProjectSpec; trace: AgentTrace }> {
    const traceId = uuid()
    const events: AgentTraceEvent[] = []
    const startedAt = new Date().toISOString()

    const systemPrompt = `You are a solar project analyst. Parse the user's natural-language project description into a structured JSON object.

RULES:
- Only extract information explicitly stated or clearly implied in the prompt
- Do not invent capacity numbers, coordinates, or constraints not mentioned
- If a constraint is ambiguous, use the default value and note it in additionalConstraints
- For country, infer from region names (Gujarat/Rajasthan → India, Texas/Nevada → USA)
- For technology, infer: "solar + storage" → solar_plus_storage, floating/reservoir/canal/lake → solar_pv with those site types
- Return ONLY valid JSON matching the schema — no prose, no markdown, no explanations

OUTPUT SCHEMA:
{
  "name": "string (project name derived from prompt, max 100 chars)",
  "technology": "solar_pv | solar_plus_storage | floating_pv",
  "targetCapacityMW": number,
  "storageCapacityMW": number | null,
  "storageHours": number | null,
  "targetCountry": "USA | India | Other",
  "targetRegion": "string (geographic region as described)",
  "preferredSiteTypes": ["land" | "reservoir" | "canal" | "lake" | "coastal_shallow"],
  "excludedSiteTypes": ["land" | "reservoir" | "canal" | "lake" | "coastal_shallow"],
  "maxSlopeAngle": number (default 15),
  "avoidDenseVegetation": boolean (default true),
  "avoidProtectedAreas": boolean (default true),
  "minGridVoltageKV": number (default 33),
  "maxGridDistanceKm": number (default 25),
  "minGhiKwhM2Day": number (default 4.0),
  "maxWaterDepthM": number (default 3),
  "maxWaveHeightM": number (default 0.5),
  "additionalConstraints": ["string"]
}`

    const requestStart = new Date().toISOString()
    events.push({
      timestamp: requestStart,
      type: 'model_request',
      toolName: 'parse_project_brief',
      input: { rawPrompt, briefId },
    })

    let parsedSpec: ProjectSpec
    let rawResponse: string

    try {
      const result = await this.model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nProject description:\n${rawPrompt}` }] },
        ],
      })

      rawResponse = result.response.text()

      events.push({
        timestamp: new Date().toISOString(),
        type: 'model_response',
        toolName: 'parse_project_brief',
        output: rawResponse,
        durationMs: Date.now() - new Date(requestStart).getTime(),
      })

      const parsed = JSON.parse(rawResponse) as Record<string, unknown>

      parsedSpec = ProjectSpecSchema.parse({
        id: uuid(),
        briefId,
        parsedAt: new Date().toISOString(),
        geminiModel: this.modelName,
        ...parsed,
        // Ensure arrays default to empty
        preferredSiteTypes: parsed['preferredSiteTypes'] ?? ['land'],
        excludedSiteTypes: parsed['excludedSiteTypes'] ?? [],
        additionalConstraints: parsed['additionalConstraints'] ?? [],
        maxSlopeAngle: parsed['maxSlopeAngle'] ?? 15,
        avoidDenseVegetation: parsed['avoidDenseVegetation'] ?? true,
        avoidProtectedAreas: parsed['avoidProtectedAreas'] ?? true,
        minGridVoltageKV: parsed['minGridVoltageKV'] ?? 33,
        maxGridDistanceKm: parsed['maxGridDistanceKm'] ?? 25,
        minGhiKwhM2Day: parsed['minGhiKwhM2Day'] ?? 4.0,
        maxWaterDepthM: parsed['maxWaterDepthM'] ?? 3,
        maxWaveHeightM: parsed['maxWaveHeightM'] ?? 0.5,
      })
    } catch (err) {
      events.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        error: String(err),
      })

      const trace: AgentTrace = {
        id: traceId,
        projectId,
        runType: 'parse_prompt',
        model: this.modelName,
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'failed',
        events,
        toolCallCount: 1,
        error: String(err),
      }

      throw Object.assign(new Error(`Gemini parsing failed: ${err}`), { trace })
    }

    const trace: AgentTrace = {
      id: traceId,
      projectId,
      runType: 'parse_prompt',
      model: this.modelName,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'completed',
      events,
      toolCallCount: 1,
    }

    return { spec: parsedSpec, trace }
  }
}
