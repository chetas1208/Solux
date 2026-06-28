import type {
  ProjectBrief,
  ProjectSpec,
  CandidateSite,
  ScoreBreakdown,
  EvidenceItem,
  FatalFlawDecision,
  DataSourceStatus,
  AgentTrace,
  Decision,
} from '@solux/shared'

/** Backend FatalFlawReport shape (from apps/api agent schemas). */
export interface FatalFlawReport {
  id: string
  siteId: string
  projectId: string
  decision: Decision
  headline: string
  summary: string
  killTriggers: Array<{
    dimension: string
    description: string
    evidenceId?: string
  }>
  scoreBreakdown: ScoreBreakdown
  executiveSummary: string
  keyFindings: string[]
  recommendedNextSteps: string[]
  risksAndMitigations: Array<{ risk: string; mitigation: string }>
  evidenceTable: EvidenceItem[]
  missingDataWarnings: string[]
  claimVerification?: ClaimVerificationResult
  hallucinationScore: number
  voiceBriefingUrl?: string
  voiceBriefingTranscript?: string
  generatedAt: string
  modelUsed: string
}

export interface ClaimVerificationResult {
  claims: Array<{
    text: string
    claimType: 'numeric' | 'geographic' | 'assertion' | 'recommendation'
    evidenceId?: string
    supported: boolean
    confidence: number
  }>
  totalClaims: number
  supportedClaims: number
  unsupportedClaims: number
  hallucinationScore: number
  passed: boolean
}

export interface ApiResponse<T> {
  data: T
}

export interface ApiErrorBody {
  error: string
  detail?: string
}

export interface HealthResponse {
  status: string
  version: string
  timestamp: string
  environment: string
}

export interface ProjectListSummary {
  candidateCount: number
  avgConfidence: number
  avgScore: number
  topDecision: string
  datasetVersion: string
  hasResults: boolean
  updatedAt?: string
}

export interface ProjectListItem extends ProjectBrief {
  summary?: ProjectListSummary
}

export interface ProjectDetail {
  brief: ProjectBrief
  spec: ProjectSpec | null
}

export interface ParsePromptResult {
  spec: ProjectSpec
  traceId: string
}

export interface ScreeningResult {
  siteCount: number
  evidenceCount: number
  decisions: Array<{
    siteId: string
    siteName?: string
    decision: Decision
    finalScore: number
    confidence: number
    headline: string
  }>
  errors: string[]
}

export type SiteWithScore = CandidateSite & { scoreBreakdown: ScoreBreakdown | null }

export interface SiteDetail {
  site: CandidateSite
  scoreBreakdown: ScoreBreakdown | null
}

export interface SiteReportResponse {
  report: FatalFlawReport
  cached: boolean
}

export interface VoiceBriefingResponse {
  audioUrl: string | null
  durationSec: number
  miniMaxAvailable: boolean
}

export interface DataSourcesResponse {
  data: DataSourceStatus[]
  meta: { total: number; available: number }
}

export type { ProjectBrief, ProjectSpec, CandidateSite, ScoreBreakdown, EvidenceItem, FatalFlawDecision, DataSourceStatus, AgentTrace, Decision }
