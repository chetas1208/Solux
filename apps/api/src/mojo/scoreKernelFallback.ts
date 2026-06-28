/**
 * TypeScript fallback for weighted score aggregation.
 * Used when MOJO_SCORE_KERNEL_BIN is not configured or binary is absent.
 * Numerically identical to the Mojo kernel output.
 */
export function weightedScoreFallback(
  scoreWeightPairs: Array<{ score: number; weight: number }>,
): number {
  let weightedSum = 0
  let weightTotal = 0
  for (const { score, weight } of scoreWeightPairs) {
    weightedSum += score * weight
    weightTotal += weight
  }
  if (weightTotal === 0) return 0
  return Math.max(0, Math.min(100, weightedSum / weightTotal))
}
