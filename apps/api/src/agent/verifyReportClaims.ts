import { GeminiClient } from './geminiClient.js'
import type { FatalFlawReport, EvidenceItem, ClaimVerificationResult } from './schemas.js'
import { scoreHallucination } from './hallucinationScorer.js'

/**
 * Optional second-pass verification using the report model.
 * Only runs if GEMINI_REPORT_MODEL is configured and differs from the fast model.
 * Falls back to deterministic hallucinationScorer if Gemini unavailable.
 */
export async function verifyReportClaims(
  report: FatalFlawReport,
  evidence: EvidenceItem[],
): Promise<ClaimVerificationResult> {
  const allText = [
    report.executiveSummary,
    ...report.keyFindings,
    ...report.recommendedNextSteps,
    ...report.risksAndMitigations.map((r) => `${r.risk} ${r.mitigation}`),
  ].join(' ')

  // Always run deterministic check first
  const deterministicResult = scoreHallucination(allText, evidence)

  // Skip Gemini verification if not configured or same model as fast
  if (
    !GeminiClient.isAvailable() ||
    !process.env['GEMINI_REPORT_MODEL'] ||
    process.env['GEMINI_REPORT_MODEL'] === process.env['GEMINI_FAST_MODEL']
  ) {
    return deterministicResult
  }

  const client = new GeminiClient()
  const model = client.reportModel()

  const evidenceContext = evidence
    .map((e) => `[${e.source}] ${e.description}: ${JSON.stringify(e.value)} ${e.unit ?? ''}`)
    .join('\n')

  const prompt = `You are a fact-checker reviewing a solar site screening report.

For each numeric claim in the REPORT TEXT, determine if it is traceable to EVIDENCE.
A claim is supported if the numeric value (within 20% tolerance) appears in evidence.

EVIDENCE:
${evidenceContext}

REPORT TEXT:
${allText.slice(0, 3000)}

Return JSON:
{
  "unsupportedClaims": ["claim text", ...],
  "supportedClaims": ["claim text", ...],
  "verdict": "pass" | "fail",
  "notes": "brief explanation"
}`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    const raw = result.response.text()
    const parsed = JSON.parse(raw) as {
      unsupportedClaims: string[]
      supportedClaims: string[]
      verdict: string
    }

    const total = parsed.unsupportedClaims.length + parsed.supportedClaims.length
    const hallucinationScore = total > 0 ? parsed.unsupportedClaims.length / total : 0

    return {
      claims: [
        ...parsed.unsupportedClaims.map((t) => ({
          text: t,
          claimType: 'numeric' as const,
          supported: false,
          confidence: 0.1,
        })),
        ...parsed.supportedClaims.map((t) => ({
          text: t,
          claimType: 'numeric' as const,
          supported: true,
          confidence: 0.85,
        })),
      ],
      totalClaims: total,
      supportedClaims: parsed.supportedClaims.length,
      unsupportedClaims: parsed.unsupportedClaims.length,
      hallucinationScore,
      passed: parsed.verdict === 'pass',
    }
  } catch {
    // Fall back to deterministic on any Gemini error
    return deterministicResult
  }
}
