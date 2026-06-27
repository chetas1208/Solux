import type { EvidenceItem } from '@solux/shared'
import type { GridProximityResult } from '../data/types.js'

export interface StorageFeasibilityResult {
  storageFeasibilityScore: number
  assumptions: string[]
  evidenceIds: string[]
}

/**
 * Scores battery storage feasibility.
 * Storage is primarily influenced by grid proximity and land access.
 * Does NOT model grid interconnection capacity — that requires utility data.
 */
export function scoreStorageFeasibility(
  gridData: GridProximityResult | null,
  storageCapacityMW: number | undefined,
  storageHours: number | undefined,
  evidence: EvidenceItem[],
  missingDataWarnings: string[],
): StorageFeasibilityResult {
  const assumptions: string[] = [
    'Storage feasibility scored from grid connectivity and land access proxies only',
    'Battery chemistry choice, thermal management, and fire code compliance not assessed',
    'Interconnection queue and grid export capacity require utility confirmation',
    'BESS sizing (MW/MWh ratio) not optimised — use project-specific load flow analysis',
  ]

  if (!storageCapacityMW) {
    return {
      storageFeasibilityScore: 75,
      assumptions: [...assumptions, 'No storage requirement specified — neutral score applied'],
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  if (!gridData) {
    missingDataWarnings.push('Grid data unavailable — storage feasibility score is indicative only')
    return {
      storageFeasibilityScore: 45,
      assumptions,
      evidenceIds: evidence.map((e) => e.id),
    }
  }

  // Larger storage needs better grid infrastructure
  const sizePenalty = storageCapacityMW > 100 ? 10 : storageCapacityMW > 50 ? 5 : 0
  const distScore = Math.max(0, 80 - gridData.nearestLineDistanceKm * 2)
  const roadScore = Math.max(0, 90 - gridData.roadAccessDistanceKm * 3)

  const score = Math.round((distScore * 0.5 + roadScore * 0.5) - sizePenalty)

  return {
    storageFeasibilityScore: Math.max(0, Math.min(100, score)),
    assumptions,
    evidenceIds: evidence.map((e) => e.id),
  }
}
