import type { EvidenceItem } from '../agent/schemas.js'

/**
 * Computes overall confidence for a site's score.
 *
 * Confidence is reduced by:
 * - Missing data warnings (each -8 points)
 * - Low-confidence evidence items
 * - No evidence at all (-40 points)
 */
export function computeConfidence(
  evidence: EvidenceItem[],
  missingDataWarnings: string[],
): number {
  if (evidence.length === 0) {
    return Math.max(10, 50 - missingDataWarnings.length * 8)
  }

  const avgDataConf =
    evidence.reduce((sum, e) => sum + e.dataConfidence, 0) / evidence.length

  const missingPenalty = missingDataWarnings.length * 8

  return Math.max(10, Math.min(99, Math.round(avgDataConf * 100 - missingPenalty)))
}
