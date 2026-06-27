import { z } from 'zod'

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
  'modular_endpoint',
])
export type DataSourceId = z.infer<typeof DataSourceIdSchema>

export const DataSourceStatusSchema = z.object({
  id: DataSourceIdSchema,
  label: z.string(),
  available: z.boolean(),
  /** Why unavailable — missing key, missing data dir, API error, etc. */
  unavailableReason: z.string().optional(),
  lastCheckedAt: z.string().datetime().optional(),
  coverageDescription: z.string().optional(),
})
export type DataSourceStatus = z.infer<typeof DataSourceStatusSchema>

/** A single retrieved data point supporting a score claim. */
export const EvidenceItemSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  projectId: z.string().uuid(),
  source: DataSourceIdSchema,
  retrievedAt: z.string().datetime(),
  /** Human-readable description of what was retrieved. */
  description: z.string(),
  /** The raw value, number, or category. */
  value: z.unknown(),
  unit: z.string().optional(),
  /** Geospatial reference for this data point. */
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  /** Confidence in the data quality 0–1. */
  dataConfidence: z.number().min(0).max(1),
  /** Optional embedding for vector search. */
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>
