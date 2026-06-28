import { v4 as uuid } from 'uuid'
import { GeminiClient } from './geminiClient.js'
import { runEvidenceGuard } from './evidenceGuard.js'
import type {
  FatalFlawReport,
  ScoreBreakdown,
  EvidenceItem,
  KillTrigger,
  AgentTrace,
  AgentTraceEvent,
  Decision,
} from './schemas.js'

interface SiteContext {
  id: string
  name: string
  siteType: string
  country: string
  areaKm2: number
  centroid: [number, number]
}

export async function generateGroundedReport(
  site: SiteContext,
  score: ScoreBreakdown,
  killTriggers: KillTrigger[],
  evidence: EvidenceItem[],
  projectId: string,
): Promise<{ report: FatalFlawReport; trace: AgentTrace }> {
  if (!GeminiClient.isAvailable()) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  const client = new GeminiClient()
  const model = client.fastModel()
  const traceId = uuid()
  const startedAt = new Date().toISOString()
  const events: AgentTraceEvent[] = []

  const evidenceContext = evidence
    .map(
      (e) =>
        `[${e.source}] ${e.description}: ${JSON.stringify(e.value)} ${e.unit ?? ''} (conf ${Math.round(e.dataConfidence * 100)}%)`,
    )
    .join('\n')

  const prompt = `You are a solar project analyst writing a fatal-flaw screening report for a developer.

STRICT RULES:
- Every numeric claim MUST be traceable to a line in RETRIEVED EVIDENCE below
- Do not invent irradiance values, distances, depths, or voltages not in the evidence
- If evidence is absent for a claim, write "not retrieved" — never guess
- Use technical, direct language. No marketing.
- Decision is already computed — do NOT override it

SITE: ${site.name} (${site.siteType}, ${site.country}, ${site.areaKm2.toFixed(1)} km²)
CENTROID: [${site.centroid[0].toFixed(4)}, ${site.centroid[1].toFixed(4)}]

DECISION: ${score.finalDecision}
FINAL SCORE: ${score.finalScore}/100
CONFIDENCE: ${score.confidence}%

DIMENSION SCORES:
- Solar Output: ${score.powerOutputScore}/100
- Grid Connectivity: ${score.gridConnectivityScore}/100
- Buildability: ${score.buildabilityScore}/100
- Vegetation Tradeoff: ${score.vegetationTradeoffScore}/100
- Storage Feasibility: ${score.storageFeasibilityScore}/100
- Atmosphere Risk: ${score.atmosphereRiskScore}/100
- Power Loss Risk: ${score.powerLossScore}/100
${score.waterFeasibilityScore !== undefined ? `- Water Feasibility: ${score.waterFeasibilityScore}/100` : ''}

FATAL FLAWS:
${killTriggers.length ? killTriggers.map((t) => `- [${t.dimension}] ${t.description}`).join('\n') : 'None'}

MISSING DATA:
${score.missingDataWarnings.length ? score.missingDataWarnings.join('\n') : 'None'}

RETRIEVED EVIDENCE:
${evidenceContext || 'No evidence items retrieved — flag all numeric claims as unverified'}

Output JSON (no prose outside JSON):
{
  "executiveSummary": "2-3 sentences: decision, key reason, immediate action.",
  "keyFindings": ["Finding with source citation", ...],
  "recommendedNextSteps": ["Specific action", ...],
  "risksAndMitigations": [{"risk": "...", "mitigation": "..."}, ...]
}`

  events.push({ timestamp: new Date().toISOString(), type: 'model_request', input: { siteId: site.id } })
  const reqStart = Date.now()

  let raw: string
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    raw = result.response.text()
  } catch (err) {
    events.push({ timestamp: new Date().toISOString(), type: 'error', error: String(err) })
    throw new Error(`Gemini report generation failed: ${err}`)
  }

  events.push({
    timestamp: new Date().toISOString(),
    type: 'model_response',
    output: raw,
    durationMs: Date.now() - reqStart,
  })

  let parsed: {
    executiveSummary: string
    keyFindings: string[]
    recommendedNextSteps: string[]
    risksAndMitigations: Array<{ risk: string; mitigation: string }>
  }
  try {
    parsed = JSON.parse(raw) as typeof parsed
  } catch {
    throw new Error('Gemini returned invalid JSON for report')
  }

  // Evidence guard — check all text
  const allText = [
    parsed.executiveSummary,
    ...parsed.keyFindings,
    ...parsed.recommendedNextSteps,
    ...parsed.risksAndMitigations.map((r) => `${r.risk} ${r.mitigation}`),
  ].join(' ')

  const guardResult = runEvidenceGuard(allText, evidence)

  events.push({
    timestamp: new Date().toISOString(),
    type: 'evidence_guard_check',
    output: {
      passed: guardResult.passed,
      hallucinationScore: guardResult.hallucinationScore,
      unsupportedClaims: guardResult.unsupportedClaims,
    },
  })

  // Use sanitized executive summary if guard failed
  const executiveSummary = guardResult.passed
    ? parsed.executiveSummary
    : guardResult.sanitizedText.slice(0, 500)

  const now = new Date().toISOString()
  const headline = buildHeadline(score.finalDecision, site.name, killTriggers)

  const report: FatalFlawReport = {
    id: uuid(),
    siteId: site.id,
    projectId,
    decision: score.finalDecision,
    headline,
    summary: executiveSummary,
    killTriggers,
    scoreBreakdown: score,
    executiveSummary,
    keyFindings: parsed.keyFindings,
    recommendedNextSteps: parsed.recommendedNextSteps,
    risksAndMitigations: parsed.risksAndMitigations,
    evidenceTable: evidence,
    missingDataWarnings: score.missingDataWarnings,
    claimVerification: {
      claims: guardResult.unsupportedClaims.map((c) => ({
        text: c,
        claimType: 'numeric' as const,
        supported: false,
        confidence: 0.1,
      })),
      totalClaims: guardResult.totalClaims,
      supportedClaims: guardResult.totalClaims - guardResult.unsupportedClaims.length,
      unsupportedClaims: guardResult.unsupportedClaims.length,
      hallucinationScore: guardResult.hallucinationScore,
      passed: guardResult.passed,
    },
    hallucinationScore: guardResult.hallucinationScore,
    generatedAt: now,
    modelUsed: client.fastModelName,
  }

  const trace: AgentTrace = {
    id: traceId,
    projectId,
    siteId: site.id,
    runType: 'generate_report',
    model: client.fastModelName,
    startedAt,
    completedAt: now,
    status: 'completed',
    events,
    toolCallCount: 1,
    hallucinationScore: guardResult.hallucinationScore,
  }

  return { report, trace }
}

function buildHeadline(decision: Decision, siteName: string, killTriggers: KillTrigger[]): string {
  if (decision === 'GO') return `${siteName} — GO: passes all fatal-flaw checks`
  if (decision === 'INVESTIGATE') return `${siteName} — INVESTIGATE: promising but data gaps remain`
  return `${siteName} — KILL: ${killTriggers[0]?.description ?? 'fatal constraint violated'}`
}
