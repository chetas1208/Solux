import * as turf from '@turf/turf'

export type BBox = [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
export type Coord = [number, number] // [lon, lat]

export interface GeoPolygon {
  type: 'Polygon'
  coordinates: Coord[][]
}
export interface GeoPoint {
  type: 'Point'
  coordinates: Coord
}
export type GeoGeometry = GeoPolygon | { type: 'MultiPolygon'; coordinates: Coord[][][] }

export function bboxToPolygon(bbox: BBox): GeoPolygon {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  }
}

export function centroidOf(geometry: GeoGeometry): GeoPoint {
  const c = turf.centroid({ type: 'Feature', geometry: geometry as never, properties: {} })
  return { type: 'Point', coordinates: c.geometry.coordinates as Coord }
}

export function areaKm2(geometry: GeoGeometry): number {
  return turf.area({ type: 'Feature', geometry: geometry as never, properties: {} }) / 1_000_000
}

export function validatePolygon(geometry: GeoPolygon): { valid: boolean; reason?: string } {
  const ring = geometry.coordinates[0]
  if (!ring || ring.length < 4) return { valid: false, reason: 'Ring needs ≥4 points' }
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    return { valid: false, reason: 'Ring not closed' }
  }
  return { valid: true }
}
