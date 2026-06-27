import { z } from 'zod'
import { PointSchema, PolygonSchema, MultiPolygonSchema } from './geo.js'
import { SiteTypeSchema, CountrySchema } from './project.js'

export const DecisionSchema = z.enum(['GO', 'INVESTIGATE', 'KILL'])
export type Decision = z.infer<typeof DecisionSchema>

export const CandidateSiteSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  specId: z.string().uuid(),
  name: z.string(),
  geometry: z.union([PolygonSchema, MultiPolygonSchema]),
  centroid: PointSchema,
  siteType: SiteTypeSchema,
  country: CountrySchema,
  areaKm2: z.number().positive(),
  /** How the site was generated. */
  generationMethod: z.enum(['grid_cell', 'osm_feature', 'manual', 'ai_suggested']),
  createdAt: z.string().datetime(),
})
export type CandidateSite = z.infer<typeof CandidateSiteSchema>

export const ScoreBreakdownSchema = z.object({
  siteId: z.string().uuid(),
  projectId: z.string().uuid(),
  finalScore: z.number().min(0).max(100),
  finalDecision: DecisionSchema,
  /** 0–100. Lower when data sources are missing. */
  confidence: z.number().min(0).max(100),

  /** Score dimensions — each 0–100, higher = better. */
  powerOutputScore: z.number().min(0).max(100),
  vegetationTradeoffScore: z.number().min(0).max(100),
  gridConnectivityScore: z.number().min(0).max(100),
  buildabilityScore: z.number().min(0).max(100),
  storageFeasibilityScore: z.number().min(0).max(100),
  powerLossScore: z.number().min(0).max(100),
  atmosphereRiskScore: z.number().min(0).max(100),
  /** Only scored when siteType is water-based. */
  waterFeasibilityScore: z.number().min(0).max(100).optional(),

  topPositiveFactors: z.array(z.string()).max(5),
  topFatalFlaws: z.array(z.string()).max(5),
  /** Data layers absent that would change the decision. */
  missingDataWarnings: z.array(z.string()),
  /** IDs of EvidenceItems backing this score. */
  evidenceIds: z.array(z.string()),

  scoredAt: z.string().datetime(),
})
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>

export const FatalFlawDecisionSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  projectId: z.string().uuid(),
  decision: DecisionSchema,
  headline: z.string(),
  summary: z.string(),
  /** Ordered list of flaws that triggered a KILL. Empty for GO/INVESTIGATE. */
  killTriggers: z.array(
    z.object({
      dimension: z.string(),
      description: z.string(),
      evidenceId: z.string().optional(),
    }),
  ),
  scoreBreakdown: ScoreBreakdownSchema,
  generatedAt: z.string().datetime(),
  /** Hallucination guard: fraction of claims with no evidence. */
  unsupportedClaimFraction: z.number().min(0).max(1),
})
export type FatalFlawDecision = z.infer<typeof FatalFlawDecisionSchema>
