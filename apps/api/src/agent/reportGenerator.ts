import { GoogleGenerativeAI } from '@google/generative-ai'
import { v4 as uuid } from 'uuid'
import { aiConfig } from '@solux/config'
import type { FatalFlawDecision, EvidenceItem, AgentTrace, AgentTraceEvent, CandidateSite } from '@solux/shared'

export interface GeneratedReport {
  siteId: string
  projectId: string
  executiveSummary: string
  keyFindings: string[]
  recommendedNextSteps: string[]
  risksAndMitigations: Array<{ risk: string; mitigation: string }>
  generatedAt: string
  modelUsed: string
  evidenceIds: string[]
}

/**
 * Gemini report generator — produces developer-facing site reports.
 *
 * STRICT: Gemini is given only the scored data and evidence items.
 * It must not invent claims. EvidenceGuard checks the output.
 */
export class ReportGenerator {
  private readonly model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
  private readonly modelName = 'gemini-2.0-flash-exp'

  constructor() {
    if (!aiConfig.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    const genai = new GoogleGenerativeAI(aiConfig.geminiApiKey)
    this.model = genai.getGenerativeModel({
      model: this.modelName,
      generationConfig: { responseMimeType: 'application/json' },
    })
  }

  async generateSiteReport(
    site: CandidateSite,
    decision: FatalFlawDecision,
    evidence: EvidenceItem[],
    projectId: string,
  ): Promise<{ report: GeneratedReport; trace: AgentTrace }> {
    const traceId = uuid()
    const events: AgentTraceEvent[] = []
    const startedAt = new Date().toISOString()

    // Build the evidence context — Gemini sees only retrieved data, not its own knowledge
    const evidenceContext = evidence
      .map(
        (e) =>
          `[${e.source}] ${e.description}: ${JSON.stringify(e.value)} ${e.unit ?? ''} (confidence: ${Math.round(e.dataConfidence * 100)}%)`,
      )
      .join('\n')

    const scoreContext = `
Decision: ${decision.decision}
Final Score: ${decision.scoreBreakdown.finalScore}/100
Confidence: ${decision.scoreBreakdown.confidence}%

Dimension Scores:
- Solar Output: ${decision.scoreBreakdown.powerOutputScore}/100
- Grid Connectivity: ${decision.scoreBreakdown.gridConnectivityScore}/100
- Buildability: ${decision.scoreBreakdown.buildabilityScore}/100
- Vegetation Tradeoff: ${decision.scoreBreakdown.vegetationTradeoffScore}/100
- Storage Feasibility: ${decision.scoreBreakdown.storageFeasibilityScore}/100
- Atmosphere Risk: ${decision.scoreBreakdown.atmosphereRiskScore}/100
- Power Loss Risk: ${decision.scoreBreakdown.powerLossScore}/100
${decision.scoreBreakdown.waterFeasibilityScore !== undefined ? `- Water Feasibility: ${decision.scoreBreakdown.waterFeasibilityScore}/100` : ''}

Fatal Flaws: ${decision.killTriggers.map((t) => t.description).join('; ') || 'None'}
Missing Data Warnings: ${decision.scoreBreakdown.missingDataWarnings.join('; ') || 'None'}
`

    const prompt = `You are a solar project analyst writing a developer-facing fatal-flaw screening report.

You have been given:
1. Scored data and decisions computed by the deterministic scoring engine
2. Retrieved evidence items from real data sources

STRICT RULES:
- Only state facts that are supported by the evidence items provided
- Do not invent irradiance values, grid distances, or site-specific data not in the evidence
- If data is missing, explicitly say "data not retrieved" rather than estimating
- Write in a direct, technical style — no marketing language
- Every key finding must reference a data source from the evidence

SITE: ${site.name} (${site.siteType}, ${site.country}, ${site.areaKm2.toFixed(1)} km²)
CENTROID: [${site.centroid.coordinates[0].toFixed(4)}, ${site.centroid.coordinates[1].toFixed(4)}]

SCORES:
${scoreContext}

RETRIEVED EVIDENCE:
${evidenceContext || 'No evidence items retrieved — flag all claims as unverified'}

OUTPUT JSON:
{
  "executiveSummary": "2-3 sentences. Decision, key reason, immediate next step.",
  "keyFindings": ["Finding with source citation", ...],
  "recommendedNextSteps": ["Actionable step", ...],
  "risksAndMitigations": [{"risk": "...", "mitigation": "..."}, ...]
}`

    const reqStart = new Date().toISOString()
    events.push({ timestamp: reqStart, type: 'model_request', input: { siteId: site.id } })

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })

      const raw = result.response.text()
      events.push({
        timestamp: new Date().toISOString(),
        type: 'model_response',
        output: raw,
        durationMs: Date.now() - new Date(reqStart).getTime(),
      })

      const parsed = JSON.parse(raw) as {
        executiveSummary: string
        keyFindings: string[]
        recommendedNextSteps: string[]
        risksAndMitigations: Array<{ risk: string; mitigation: string }>
      }

      const report: GeneratedReport = {
        siteId: site.id,
        projectId,
        executiveSummary: parsed.executiveSummary,
        keyFindings: parsed.keyFindings,
        recommendedNextSteps: parsed.recommendedNextSteps,
        risksAndMitigations: parsed.risksAndMitigations,
        generatedAt: new Date().toISOString(),
        modelUsed: this.modelName,
        evidenceIds: evidence.map((e) => e.id),
      }

      const trace: AgentTrace = {
        id: traceId,
        projectId,
        siteId: site.id,
        runType: 'generate_report',
        model: this.modelName,
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'completed',
        events,
        toolCallCount: 1,
      }

      return { report, trace }
    } catch (err) {
      events.push({ timestamp: new Date().toISOString(), type: 'error', error: String(err) })
      const trace: AgentTrace = {
        id: traceId,
        projectId,
        siteId: site.id,
        runType: 'generate_report',
        model: this.modelName,
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'failed',
        events,
        toolCallCount: 1,
        error: String(err),
      }
      throw Object.assign(new Error(`Report generation failed: ${err}`), { trace })
    }
  }
}
