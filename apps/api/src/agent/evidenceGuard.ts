import type { EvidenceItem } from './schemas.js'
import { scoreHallucination } from './hallucinationScorer.js'

export interface GuardResult {
  passed: boolean
  hallucinationScore: number
  unsupportedClaims: string[]
  totalClaims: number
  /** Text with unsupported numeric claims redacted. */
  sanitizedText: string
}

/**
 * Checks a generated text block against retrieved evidence.
 * Redacts unsupported numeric claims in sanitizedText.
 * Fails if hallucinationScore ≥ 0.30 (>30% claims unsupported).
 */
export function runEvidenceGuard(text: string, evidence: EvidenceItem[]): GuardResult {
  const result = scoreHallucination(text, evidence)

  // Build sanitized version: redact unsupported claims
  let sanitized = text
  for (const claim of result.claims) {
    if (!claim.supported) {
      sanitized = sanitized.replace(claim.text, `[DATA UNVERIFIED: ${claim.text}]`)
    }
  }

  return {
    passed: result.passed,
    hallucinationScore: result.hallucinationScore,
    unsupportedClaims: result.claims.filter((c) => !c.supported).map((c) => c.text),
    totalClaims: result.totalClaims,
    sanitizedText: sanitized,
  }
}


/** Backward-compat alias for tests and old callers. */
export function checkReportClaims(
  text: string,
  evidence: EvidenceItem[],
): { passed: boolean; unsupportedClaimFraction: number; totalClaims: number } {
  const g = runEvidenceGuard(text, evidence)
  return {
    passed: g.passed,
    unsupportedClaimFraction: g.hallucinationScore,
    totalClaims: g.totalClaims,
  }
}
