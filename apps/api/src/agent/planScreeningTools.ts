import type { ProjectSpec } from '@solux/shared'

export type ScreeningToolId =
  | 'fetch_solar_pvgis'
  | 'fetch_solar_nrel'
  | 'fetch_grid_osm'
  | 'fetch_water_gebco'
  | 'fetch_wave_copernicus'
  | 'fetch_land_cover_gsa'

export interface ScreeningToolPlan {
  toolId: ScreeningToolId
  required: boolean
  reason: string
}

/**
 * Derives which data-fetching tools to run for a given spec.
 * Pure function — no AI call needed; rules are deterministic.
 */
export function planScreeningTools(spec: ProjectSpec): ScreeningToolPlan[] {
  const plan: ScreeningToolPlan[] = []

  // Solar
  if (spec.targetCountry === 'USA') {
    plan.push({ toolId: 'fetch_solar_nrel', required: true, reason: 'US project — NREL NSRDB preferred' })
  } else {
    plan.push({ toolId: 'fetch_solar_pvgis', required: true, reason: 'Non-US project — PVGIS free API' })
  }

  // Grid always needed
  plan.push({ toolId: 'fetch_grid_osm', required: true, reason: 'Grid proximity needed for connectivity score' })

  // Water tools only for water site types
  const isWaterProject = spec.preferredSiteTypes?.some((t) =>
    ['reservoir', 'canal', 'lake', 'coastal_shallow'].includes(t),
  )

  if (isWaterProject) {
    plan.push({ toolId: 'fetch_water_gebco', required: true, reason: 'Water depth needed for floating PV / offshore' })
    plan.push({ toolId: 'fetch_wave_copernicus', required: false, reason: 'Wave height for offshore suitability — optional' })
  }

  // Global Solar Atlas only if local data dir configured
  if (process.env['GLOBAL_SOLAR_ATLAS_DATA_DIR']) {
    plan.push({ toolId: 'fetch_land_cover_gsa', required: false, reason: 'GSA raster available — use for GHI cross-check' })
  }

  return plan
}
