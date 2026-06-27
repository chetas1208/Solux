import type { EvidenceItem } from '@solux/shared'
import type { GridProximityResult } from '../data/types.js'

export interface GridScoreResult {
  gridConnectivityScore: number
  killTrigger: string | null
  assumptions: string[]
  evidenceIds: string[]
}

/**
 * Scores grid connectivity. KILL if nearest voltage line is > threshold km
 * and is under project minimum voltage.
 */
export function scoreGridConnectivity(
  data: GridProximityResult,
  maxGridDistanceKm: number,
  minVoltageKV: number,
  evidence: EvidenceItem[],
): GridScoreResult {
  const assumptions: string[] = [
    'Voltage and distance from OSM data — completeness varies by country',
    'OSM transmission coverage is ~85% for developed regions, lower for rural areas',
    'Does not include interconnection queue position or grid capacity — contact utility for firm capacity',
    'Road access score is proxy for construction logistics only',
  ]

  const distKm = data.nearestLineDistanceKm
  const voltKV = data.nearestLineVoltageKV ?? 0

  // KILL trigger
  if (distKm > maxGridDistanceKm) {
    return {
      gridConnectivityScore: Math.max(0, Math.round(10 - (distKm - maxGridDistanceKm))),
      killTrigger: `Nearest transmission line is ${distKm.toFixed(1)} km away, exceeds ${maxGridDistanceKm} km threshold`,
      assumptions,
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  if (voltKV > 0 && voltKV < minVoltageKV) {
    const score = Math.round((voltKV / minVoltageKV) * 40)
    return {
      gridConnectivityScore: score,
      killTrigger: `Nearest line is ${voltKV} kV — below minimum ${minVoltageKV} kV required`,
      assumptions,
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  // Score based on distance (closer = better)
  let distScore: number
  if (distKm <= 2) distScore = 100
  else if (distKm <= 5) distScore = 85
  else if (distKm <= 10) distScore = 70
  else if (distKm <= 15) distScore = 55
  else if (distKm <= 20) distScore = 40
  else distScore = Math.max(0, 40 - (distKm - 20) * 2)

  // Bonus for substation proximity
  const substBonus =
    data.nearestSubstationDistanceKm !== null && data.nearestSubstationDistanceKm < 10 ? 10 : 0

  return {
    gridConnectivityScore: Math.min(100, Math.round(distScore + substBonus)),
    killTrigger: null,
    assumptions,
    evidenceIds: evidence.map((e) => e.id),
  }
}
