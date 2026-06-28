import { z } from 'zod'

// ─── Project Parsing ─────────────────────────────────────────────────────────

export const SiteTypeSchema = z.enum(['land', 'reservoir', 'canal', 'lake', 'coastal_shallow'])
export type SiteType = z.infer<typeof SiteTypeSchema>

export const ProjectSpecSchema = z.object({
  name: z.string().min(1).max(200),
  technology: z.enum(['solar_pv', 'solar_plus_storage', 'floating_pv']),
  targetCapacityMW: z.number().positive(),
  storageCapacityMW: z.number().nonnegative().optional(),
  storageHours: z.number().nonnegative().optional(),
  targetCountry: z.enum(['USA', 'India', 'Other']),
  targetRegion: z.string().min(1),
  /** Approximate [minLon, minLat, maxLon, maxLat] bbox inferred from region name. */
  searchBBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  preferredSiteTypes: z.array(SiteTypeSchema).default(['land']),
  excludedSiteTypes: z.array(SiteTypeSchema).default([]),
  maxSlopeAngle: z.number().nonnegative().default(15),
  avoidDenseVegetation: z.boolean().default(true),
  avoidProtectedAreas: z.boolean().default(true),
  minGridVoltageKV: z.number().nonnegative().default(33),
  maxGridDistanceKm: z.number().positive().default(25),
  minGhiKwhM2Day: z.number().nonnegative().default(4.0),
  maxWaterDepthM: z.number().nonnegative().default(3),
  maxWaveHeightM: z.number().nonnegative().default(0.5),
  additionalConstraints: z.array(z.string()).default([]),
  /** Fields Gemini could not determine from prompt. */
  missingFields: z.array(z.string()).default([]),
})
export type ProjectSpec = z.infer<typeof ProjectSpecSchema>

// ─── Evidence ────────────────────────────────────────────────────────────────

export const DataSourceIdSchema = z.enum([
  'nrel_nsrdb',
  'pvgis',
  'global_solar_atlas',
  'openstreetmap',
  'uspvdb',
  'gebco',
  'copernicus_marine',
  'noaa_tides',
  'google_earth_engine',
  'manual_input',
  'mojo_kernel',
  'gemini',
  'minimax',
])
export type DataSourceId = z.infer<typeof DataSourceIdSchema>

export const EvidenceItemSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string(),
  projectId: z.string(),
  source: DataSourceIdSchema,
  retrievedAt: z.string().datetime(),
  description: z.string(),
  value: z.unknown(),
  unit: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  dataConfidence: z.number().min(0).max(1),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>

// ─── Scoring ─────────────────────────────────────────────────────────────────

export const DecisionSchema = z.enum(['GO', 'INVESTIGATE', 'KILL'])
export type Decision = z.infer<typeof DecisionSchema>

export const ScoreBreakdownSchema = z.object({
  siteId: z.string(),
  projectId: z.string(),
  finalScore: z.number().min(0).max(100),
  finalDecision: DecisionSchema,
  confidence: z.number().min(0).max(100),
  powerOutputScore: z.number().min(0).max(100),
  vegetationTradeoffScore: z.number().min(0).max(100),
  gridConnectivityScore: z.number().min(0).max(100),
  buildabilityScore: z.number().min(0).max(100),
  storageFeasibilityScore: z.number().min(0).max(100),
  powerLossScore: z.number().min(0).max(100),
  atmosphereRiskScore: z.number().min(0).max(100),
  waterFeasibilityScore: z.number().min(0).max(100).optional(),
  topPositiveFactors: z.array(z.string()).max(5),
  topFatalFlaws: z.array(z.string()).max(10),
  missingDataWarnings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  usedMojoKernel: z.boolean().default(false),
  scoredAt: z.string().datetime(),
})
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>

export const KillTriggerSchema = z.object({
  dimension: z.string(),
  description: z.string(),
  evidenceId: z.string().optional(),
})
export type KillTrigger = z.infer<typeof KillTriggerSchema>

// ─── Report Claims ────────────────────────────────────────────────────────────

export const ReportClaimSchema = z.object({
  text: z.string(),
  claimType: z.enum(['numeric', 'geographic', 'assertion', 'recommendation']),
  evidenceId: z.string().optional(),
  supported: z.boolean(),
  confidence: z.number().min(0).max(1),
})
export type ReportClaim = z.infer<typeof ReportClaimSchema>

export const ClaimVerificationResultSchema = z.object({
  claims: z.array(ReportClaimSchema),
  totalClaims: z.number(),
  supportedClaims: z.number(),
  unsupportedClaims: z.number(),
  hallucinationScore: z.number().min(0).max(1),
  passed: z.boolean(),
})
export type ClaimVerificationResult = z.infer<typeof ClaimVerificationResultSchema>

// ─── Report ───────────────────────────────────────────────────────────────────

export const FatalFlawReportSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string(),
  projectId: z.string(),
  decision: DecisionSchema,
  headline: z.string(),
  summary: z.string(),
  killTriggers: z.array(KillTriggerSchema),
  scoreBreakdown: ScoreBreakdownSchema,
  executiveSummary: z.string(),
  keyFindings: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()),
  risksAndMitigations: z.array(
    z.object({ risk: z.string(), mitigation: z.string() }),
  ),
  evidenceTable: z.array(EvidenceItemSchema),
  missingDataWarnings: z.array(z.string()),
  claimVerification: ClaimVerificationResultSchema.optional(),
  hallucinationScore: z.number().min(0).max(1),
  voiceBriefingUrl: z.string().optional(),
  voiceBriefingTranscript: z.string().optional(),
  generatedAt: z.string().datetime(),
  modelUsed: z.string(),
})
export type FatalFlawReport = z.infer<typeof FatalFlawReportSchema>

// ─── Agent Trace ──────────────────────────────────────────────────────────────

export const AgentTraceEventSchema = z.object({
  timestamp: z.string().datetime(),
  type: z.enum([
    'tool_call',
    'tool_result',
    'model_request',
    'model_response',
    'evidence_guard_check',
    'hallucination_score',
    'error',
  ]),
  toolName: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  durationMs: z.number().optional(),
  error: z.string().optional(),
})
export type AgentTraceEvent = z.infer<typeof AgentTraceEventSchema>

export const AgentTraceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  siteId: z.string().optional(),
  runType: z.enum(['parse_prompt', 'screen_sites', 'generate_report', 'verify_report']),
  model: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(['running', 'completed', 'failed']),
  events: z.array(AgentTraceEventSchema),
  toolCallCount: z.number().int().nonnegative(),
  hallucinationScore: z.number().min(0).max(1).optional(),
  error: z.string().optional(),
})
export type AgentTrace = z.infer<typeof AgentTraceSchema>

// ─── Data Source Status ───────────────────────────────────────────────────────

export const DataSourceStatusSchema = z.object({
  id: DataSourceIdSchema,
  label: z.string(),
  available: z.boolean(),
  unavailableReason: z.string().optional(),
  lastCheckedAt: z.string().datetime().optional(),
  coverageDescription: z.string().optional(),
  deepCheckRan: z.boolean().default(false),
})
export type DataSourceStatus = z.infer<typeof DataSourceStatusSchema>
