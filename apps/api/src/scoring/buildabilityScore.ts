import type { EvidenceItem } from '@solux/shared'
import type { LandCoverResult } from '../data/types.js'

export interface BuildabilityScoreResult {
  buildabilityScore: number
  vegetationTradeoffScore: number
  killTrigger: string | null
  assumptions: string[]
  evidenceIds: string[]
}

/**
 * Scores site buildability from land cover data.
 * Separate vegetation tradeoff score captures ecological risk.
 */
export function scoreBuildability(
  data: LandCoverResult | null,
  maxSlopeAngle: number,
  avoidProtectedAreas: boolean,
  evidence: EvidenceItem[],
  missingDataWarnings: string[],
): BuildabilityScoreResult {
  const assumptions: string[] = [
    'Slope data from land cover provider — verify with site survey before development',
    'Land ownership, permitting status, and easements NOT assessed — requires legal due diligence',
    'Soil bearing capacity not modelled — check for peat, shrink-swell clay, or karst',
  ]

  if (!data) {
    missingDataWarnings.push(
      'Land cover and slope data unavailable — buildability score reduced to reflect missing data',
    )
    return {
      buildabilityScore: 40,
      vegetationTradeoffScore: 50,
      killTrigger: null,
      assumptions: [
        ...assumptions,
        'No land cover data available — configure a land cover provider for accurate assessment',
      ],
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  // Hard KILL: protected area with exclusion setting
  if (data.isProtectedArea && avoidProtectedAreas) {
    return {
      buildabilityScore: 0,
      vegetationTradeoffScore: 0,
      killTrigger: `Site overlaps protected area: ${data.protectedAreaName ?? 'unknown'}`,
      assumptions,
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  // Hard KILL: slope too steep
  if (data.slopeAngleDeg > maxSlopeAngle) {
    return {
      buildabilityScore: 0,
      vegetationTradeoffScore: 50,
      killTrigger: `Slope ${data.slopeAngleDeg.toFixed(1)}° exceeds maximum ${maxSlopeAngle}°`,
      assumptions,
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  // Slope score
  let slopeScore: number
  if (data.slopeAngleDeg <= 3) slopeScore = 100
  else if (data.slopeAngleDeg <= 7) slopeScore = 80
  else if (data.slopeAngleDeg <= 12) slopeScore = 60
  else slopeScore = Math.max(0, 60 - (data.slopeAngleDeg - 12) * 5)

  // Vegetation tradeoff score (higher = less ecological impact)
  const vegScoreMap: Record<string, number> = {
    none: 100,
    sparse: 85,
    moderate: 60,
    dense: 25,
    protected: 0,
  }
  const vegetationTradeoffScore = vegScoreMap[data.vegetationDensity] ?? 50

  // Protected area (but not excluded) — INVESTIGATE flag
  const protectedPenalty = data.isProtectedArea ? -20 : 0

  const buildabilityScore = Math.max(
    0,
    Math.round((slopeScore * 0.6 + vegetationTradeoffScore * 0.4) + protectedPenalty),
  )

  return {
    buildabilityScore: Math.min(100, buildabilityScore),
    vegetationTradeoffScore,
    killTrigger: null,
    assumptions,
    evidenceIds: evidence.map((e) => e.id),
  }
}
