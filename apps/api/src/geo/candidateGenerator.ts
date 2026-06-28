import { v4 as uuid } from 'uuid'
import { generateGrid } from './gridGenerator.js'
import { classifySiteType } from './landWaterClassifier.js'
import type { BBox } from './geometry.js'
import type { SiteType } from '../agent/schemas.js'

export interface CandidateSite {
  id: string
  projectId: string
  specId: string
  name: string
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
  centroid: { type: 'Point'; coordinates: [number, number] }
  siteType: SiteType
  country: string
  areaKm2: number
  generationMethod: 'grid_cell'
  createdAt: string
}

const CELL_SIZE_KM = 15
const MAX_CELLS = 20

export function generateCandidateSites(
  bbox: BBox,
  projectId: string,
  specId: string,
  country: string,
  preferredSiteTypes: SiteType[],
  excludedSiteTypes: SiteType[],
): CandidateSite[] {
  const cells = generateGrid(bbox, CELL_SIZE_KM, MAX_CELLS)
  const now = new Date().toISOString()

  return cells.map((cell, i) => {
    const rawType = classifySiteType([], preferredSiteTypes)
    const siteType = excludedSiteTypes.includes(rawType)
      ? (preferredSiteTypes.find((t) => !excludedSiteTypes.includes(t)) ?? 'land')
      : rawType

    const [lon, lat] = cell.centroid.coordinates

    return {
      id: uuid(),
      projectId,
      specId,
      name: `Cell-${i + 1} [${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E]`,
      geometry: cell.geometry,
      centroid: cell.centroid,
      siteType,
      country,
      areaKm2: cell.areaKm2,
      generationMethod: 'grid_cell',
      createdAt: now,
    }
  })
}
