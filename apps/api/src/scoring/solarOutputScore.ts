import type { EvidenceItem } from '@solux/shared'

export interface SolarOutputScoreResult {
  powerOutputScore: number
  ghiKwhM2Day: number
  assumptions: string[]
  evidenceIds: string[]
}

/**
 * Scores solar output potential based on GHI.
 * Does NOT return exact power output — returns a 0–100 score with assumptions.
 *
 * Score thresholds derived from NREL and IEA benchmarks:
 *   < 3.5 → KILL-level (< 30)
 *   3.5–4.5 → Poor (30–50)
 *   4.5–5.5 → Moderate (50–70)
 *   5.5–6.5 → Good (70–85)
 *   > 6.5 → Excellent (85–100)
 */
export function scoreSolarOutput(
  ghiKwhM2Day: number,
  evidence: EvidenceItem[],
): SolarOutputScoreResult {
  const assumptions: string[] = [
    'Score based on Global Horizontal Irradiance (GHI) from retrieved data',
    'Actual yield depends on panel tilt, technology choice, local soiling, and shading — not modelled here',
    'Temperature coefficient losses estimated at 0.4%/°C above 25°C',
  ]

  let score: number

  if (ghiKwhM2Day < 3.5) {
    score = Math.max(0, (ghiKwhM2Day / 3.5) * 30)
  } else if (ghiKwhM2Day < 4.5) {
    score = 30 + ((ghiKwhM2Day - 3.5) / 1.0) * 20
  } else if (ghiKwhM2Day < 5.5) {
    score = 50 + ((ghiKwhM2Day - 4.5) / 1.0) * 20
  } else if (ghiKwhM2Day < 6.5) {
    score = 70 + ((ghiKwhM2Day - 5.5) / 1.0) * 15
  } else {
    score = Math.min(100, 85 + ((ghiKwhM2Day - 6.5) / 1.0) * 15)
  }

  return {
    powerOutputScore: Math.round(score),
    ghiKwhM2Day,
    assumptions,
    evidenceIds: evidence.map((e) => e.id),
  }
}
