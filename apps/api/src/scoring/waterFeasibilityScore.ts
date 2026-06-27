import type { EvidenceItem } from '@solux/shared'
import type { WaterConditionsResult } from '../data/types.js'
import type { SiteType } from '@solux/shared'

export interface WaterFeasibilityResult {
  waterFeasibilityScore: number
  killTrigger: string | null
  assumptions: string[]
  evidenceIds: string[]
}

/**
 * Scores feasibility of floating PV or water-based solar.
 * Only called for reservoir, canal, lake, coastal_shallow site types.
 */
export function scoreWaterFeasibility(
  data: WaterConditionsResult | null,
  siteType: SiteType,
  maxDepthM: number,
  maxWaveHeightM: number,
  evidence: EvidenceItem[],
  missingDataWarnings: string[],
): WaterFeasibilityResult {
  const assumptions: string[] = [
    'Water feasibility uses depth and wave height thresholds for standard floating PV pontoon systems',
    'Anchor design, mooring loads, and seasonal water level variation not modelled',
    'Environmental impact on aquatic ecosystems requires site-specific EIA',
    'Evaporation reduction benefit not quantified here',
  ]

  if (!data) {
    missingDataWarnings.push(
      `Water conditions data unavailable for ${siteType} site — configure GEBCO and Copernicus Marine for accurate assessment`,
    )
    return {
      waterFeasibilityScore: 40,
      killTrigger: null,
      assumptions: [...assumptions, 'No water conditions data — score is indicative only'],
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  // KILL: too deep for standard floating systems
  if (data.depthM !== null && data.depthM > maxDepthM) {
    return {
      waterFeasibilityScore: 10,
      killTrigger: `Water depth ${data.depthM.toFixed(1)} m exceeds maximum ${maxDepthM} m for floating PV`,
      assumptions,
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  // KILL: waves too high
  if (data.waveHeightHsM !== null && data.waveHeightHsM > maxWaveHeightM) {
    return {
      waterFeasibilityScore: 10,
      killTrigger: `Significant wave height Hs ${data.waveHeightHsM.toFixed(2)} m exceeds ${maxWaveHeightM} m threshold`,
      assumptions,
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  let score = 70

  // Depth score
  if (data.depthM !== null) {
    if (data.depthM <= 1) score += 15
    else if (data.depthM <= 2) score += 10
    else if (data.depthM <= 3) score += 5
  }

  // Calm water bonus
  if (data.isCalm) score += 10

  // Canal/reservoir bonus (controlled water level)
  if (siteType === 'canal' || siteType === 'reservoir') score += 5

  // Current speed penalty
  if (data.currentSpeedMs !== null && data.currentSpeedMs > 1.0) {
    score -= 15
  }

  return {
    waterFeasibilityScore: Math.max(0, Math.min(100, Math.round(score))),
    killTrigger: null,
    assumptions,
    evidenceIds: evidence.map((e) => e.id),
  }
}
