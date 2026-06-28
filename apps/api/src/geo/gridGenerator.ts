import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import type { BBox, GeoPolygon, GeoPoint } from './geometry.js'
import { centroidOf, areaKm2 } from './geometry.js'

export interface GridCell {
  index: number
  geometry: GeoPolygon
  centroid: GeoPoint
  areaKm2: number
}

/**
 * Splits a bounding box into a regular grid of square cells.
 * Returns up to maxCells cells in row-major order.
 */
export function generateGrid(bbox: BBox, cellSizeKm: number, maxCells = 20): GridCell[] {
  const turfBbox: [number, number, number, number] = [bbox[0], bbox[1], bbox[2], bbox[3]]
  const grid = turf.squareGrid(turfBbox, cellSizeKm, { units: 'kilometers' })

  return grid.features.slice(0, maxCells).map((f: Feature<Polygon>, i: number) => {
    const geom = f.geometry as unknown as GeoPolygon
    return {
      index: i,
      geometry: geom,
      centroid: centroidOf(geom),
      areaKm2: areaKm2(geom),
    }
  })
}
