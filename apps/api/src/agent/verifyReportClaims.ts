import { GeminiClient } from './geminiClient.js'
import { generateText, isLlmAvailable, parseJsonFromLlm } from './llmClient.js'
import type { FatalFlawReport, EvidenceItem, ClaimVerificationResult } from './schemas.js'
import { scoreHallucination } from './hallucinationScorer.js'

/**
 * Optional second-pass verification using the report model.
 * Gemini report model first; MiniMax fallback; deterministic scorer last.
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

  const deterministicResult = scoreHallucination(allText, evidence)

  const canUseGeminiReport =
    GeminiClient.isAvailable() &&
    !!process.env['GEMINI_REPORT_MODEL'] &&
    process.env['GEMINI_REPORT_MODEL'] !== process.env['GEMINI_FAST_MODEL']

  if (!canUseGeminiReport && !isLlmAvailable()) {
    return deterministicResult
  }

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
    const result = await generateText(prompt, {
      jsonMode: true,
      modelHint: canUseGeminiReport ? 'report' : 'fast',
    })
    const parsed = parseJsonFromLlm(result.text) as {
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
    return deterministicResult
  }
}
