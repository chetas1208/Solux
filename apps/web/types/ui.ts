export type CapabilityState = 'READY' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'UNKNOWN'

export type ConfidenceLevel = 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE'

export type DecisionToken = 'GO' | 'INVESTIGATE' | 'KILL'

export interface CapabilityItem {
  id: string
  name: string
  group: CapabilityGroup
  state: CapabilityState
  whyItMatters: string
  lastCheckedAt?: string
  confidenceImpact: string
  fallbackBehavior: string
  actionNeeded?: string
}

export type CapabilityGroup =
  | 'core_runtime'
  | 'data_coverage'
  | 'ai_model'
  | 'scoring_execution'

export interface CapabilityMatrixRow {
  id: string
  capability: string
  state: CapabilityState
  requiredSources: string[]
  fallback: string
  confidenceImpact: string
}

export interface ReadinessSummary {
  overall: CapabilityState
  coreScreening: CapabilityState
  landScreening: CapabilityState
  waterScreening: CapabilityState
  voiceBriefing: CapabilityState
  modelCache: CapabilityState
}

export interface MapLayerConfig {
  id: string
  label: string
  available: boolean
  degraded: boolean
  sourceName?: string
  confidenceImpact: string
  enabled: boolean
}

export interface TradeoffPoint {
  siteId: string
  siteName: string
  decision: DecisionToken
  powerScore: number
  developmentRisk: number
  vegetationRisk: number
  gridScore: number
  confidence: number
  gridDistance?: number
}

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  offline: boolean
}
