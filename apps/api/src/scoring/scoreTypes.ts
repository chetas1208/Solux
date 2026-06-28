import type { EvidenceItem } from '../agent/schemas.js'

export interface DimensionScoreResult {
  score: number // 0–100, higher = better / lower risk
  killTrigger: string | null
  assumptions: string[]
  missingDataWarnings: string[]
  evidenceIds: string[]
}

export interface ScoringContext {
  siteId: string
  projectId: string
  evidence: EvidenceItem[]
  missingDataWarnings: string[]
  killTriggers: Array<{ dimension: string; description: string; evidenceId?: string }>
}

export const SCORE_WEIGHTS = {
  powerOutputScore: 0.25,
  gridConnectivityScore: 0.20,
  buildabilityScore: 0.15,
  vegetationTradeoffScore: 0.15,
  storageFeasibilityScore: 0.10,
  atmosphereRiskScore: 0.05,
  powerLossScore: 0.05,
  waterFeasibilityScore: 0.05, // only counted when isWaterSite
} as const
