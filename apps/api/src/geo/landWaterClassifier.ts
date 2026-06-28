import type { SiteType } from '../agent/schemas.js'
import type { GeoPolygon } from './geometry.js'

/**
 * Classifies a grid cell as land or water-based site type.
 *
 * Current implementation uses a simple heuristic from OSM tags.
 * When a cell is retrieved from OSM, water features (natural=water, waterway=*, etc.)
 * in the cell determine site type.
 *
 * TODO: Replace with raster land/water mask from ESA WorldCover or Copernicus LULC.
 */
export function classifySiteType(
  osmTags: Record<string, string>[],
  preferredTypes: SiteType[],
): SiteType {
  const hasWater = osmTags.some(
    (t) =>
      t['natural'] === 'water' ||
      t['waterway'] != null ||
      t['water'] != null,
  )
  const hasReservoir = osmTags.some(
    (t) => t['water'] === 'reservoir' || t['landuse'] === 'reservoir',
  )
  const hasCanal = osmTags.some((t) => t['waterway'] === 'canal' || t['waterway'] === 'river')

  if (hasReservoir && preferredTypes.includes('reservoir')) return 'reservoir'
  if (hasCanal && preferredTypes.includes('canal')) return 'canal'
  if (hasWater && preferredTypes.includes('lake')) return 'lake'
  if (hasWater && preferredTypes.includes('coastal_shallow')) return 'coastal_shallow'

  return preferredTypes[0] ?? 'land'
}
