import { z } from 'zod'
import { BBoxSchema, PolygonSchema } from './geo.js'

export const SiteTypeSchema = z.enum(['land', 'reservoir', 'canal', 'lake', 'coastal_shallow'])
export type SiteType = z.infer<typeof SiteTypeSchema>

export const CountrySchema = z.enum(['USA', 'India', 'Other'])
export type Country = z.infer<typeof CountrySchema>

export const TechnologySchema = z.enum(['solar_pv', 'solar_plus_storage', 'floating_pv'])
export type Technology = z.infer<typeof TechnologySchema>

/** Raw natural-language project brief as the user typed it. */
export const ProjectBriefSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().optional(),
  rawPrompt: z.string().min(10).max(4000),
  createdAt: z.string().datetime(),
})
export type ProjectBrief = z.infer<typeof ProjectBriefSchema>

/** Structured constraints Gemini parses from the raw prompt. */
export const ProjectSpecSchema = z.object({
  id: z.string().uuid(),
  briefId: z.string().uuid(),
  name: z.string().min(1).max(200),
  technology: TechnologySchema,
  targetCapacityMW: z.number().positive(),
  storageCapacityMW: z.number().nonnegative().optional(),
  storageHours: z.number().nonnegative().optional(),
  targetCountry: CountrySchema,
  targetRegion: z.string().min(1).max(500),
  /** GeoJSON bbox of the search area, if parseable. */
  searchBBox: BBoxSchema.optional(),
  /** GeoJSON polygon of explicit search boundary, if parseable. */
  searchPolygon: PolygonSchema.optional(),
  preferredSiteTypes: z.array(SiteTypeSchema),
  excludedSiteTypes: z.array(SiteTypeSchema),
  maxSlopeAngle: z.number().nonnegative().default(15),
  avoidDenseVegetation: z.boolean().default(true),
  avoidProtectedAreas: z.boolean().default(true),
  minGridVoltageKV: z.number().nonnegative().default(33),
  maxGridDistanceKm: z.number().positive().default(25),
  minGhiKwhM2Day: z.number().nonnegative().default(4.0),
  maxWaterDepthM: z.number().nonnegative().default(3),
  maxWaveHeightM: z.number().nonnegative().default(0.5),
  additionalConstraints: z.array(z.string()).default([]),
  parsedAt: z.string().datetime(),
  geminiModel: z.string(),
})
export type ProjectSpec = z.infer<typeof ProjectSpecSchema>

/** A single parsed requirement extracted from the spec. */
export const ParsedRequirementSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  category: z.enum([
    'capacity',
    'geography',
    'site_type',
    'exclusion',
    'grid',
    'environmental',
    'storage',
    'solar_resource',
    'water',
    'other',
  ]),
  description: z.string(),
  value: z.unknown().optional(),
  isHardConstraint: z.boolean(),
  confidence: z.number().min(0).max(1),
})
export type ParsedRequirement = z.infer<typeof ParsedRequirementSchema>
