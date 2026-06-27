import * as turf from '@turf/turf'
import type { BBox, Polygon, MultiPolygon, Point } from '@solux/shared'

/** Creates a GeoJSON polygon from [minLon, minLat, maxLon, maxLat]. */
export function createBoundingBoxRegion(bbox: BBox): Polygon {
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

/** Splits a bounding box into a grid of cells, each roughly cellSizeKm × cellSizeKm. */
export function splitRegionIntoGridCells(
  bbox: BBox,
  cellSizeKm: number,
): Array<{ geometry: Polygon; centroid: Point; rowIndex: number; colIndex: number }> {
  const turfBbox: [number, number, number, number] = [bbox[0], bbox[1], bbox[2], bbox[3]]
  const grid = turf.squareGrid(turfBbox, cellSizeKm, { units: 'kilometers' })

  return grid.features.map((f, i) => {
    const geom = f.geometry as Polygon
    const c = turf.centroid(f)
    return {
      geometry: geom,
      centroid: c.geometry as Point,
      rowIndex: Math.floor(i / Math.ceil((bbox[2] - bbox[0]) / (cellSizeKm / 111))),
      colIndex: i % Math.ceil((bbox[2] - bbox[0]) / (cellSizeKm / 111)),
    }
  })
}

/** Returns area in km². */
export function calculateAreaKm2(geometry: Polygon | MultiPolygon): number {
  const area = turf.area({ type: 'Feature', geometry, properties: {} })
  return area / 1_000_000
}

/** Returns centroid of a polygon or multipolygon. */
export function calculateCentroid(geometry: Polygon | MultiPolygon): Point {
  const c = turf.centroid({ type: 'Feature', geometry, properties: {} })
  return c.geometry as Point
}

/** Returns geometry buffered by `radiusKm` km. */
export function bufferGeometry(
  geometry: Polygon | MultiPolygon,
  radiusKm: number,
): Polygon | MultiPolygon {
  const buffered = turf.buffer(
    { type: 'Feature', geometry, properties: {} },
    radiusKm,
    { units: 'kilometers' },
  )
  if (!buffered) throw new Error('Buffer failed')
  return buffered.geometry as Polygon | MultiPolygon
}

/** Haversine distance in km between two [lon, lat] points. */
export function distanceKm(from: [number, number], to: [number, number]): number {
  return turf.distance(turf.point(from), turf.point(to), { units: 'kilometers' })
}

/** Returns true if geometry intersects any feature in a collection. */
export function intersectsAny(
  geometry: Polygon | MultiPolygon,
  features: Array<Polygon | MultiPolygon>,
): boolean {
  const feat = { type: 'Feature' as const, geometry, properties: {} }
  return features.some((f) => {
    const other = { type: 'Feature' as const, geometry: f, properties: {} }
    return !turf.booleanDisjoint(feat, other)
  })
}

/** Distance in km to the nearest feature in the array. Returns Infinity if empty. */
export function nearestFeatureDistanceKm(
  point: Point,
  features: Array<Polygon | MultiPolygon | Point>,
): number {
  if (features.length === 0) return Infinity
  const turfPt = turf.point(point.coordinates)
  return Math.min(
    ...features.map((f) => {
      const c = turf.centroid({ type: 'Feature', geometry: f, properties: {} })
      return turf.distance(turfPt, c, { units: 'kilometers' })
    }),
  )
}

/** Normalises a raw GeoJSON object — ensures winding order, removes Z coords. */
export function normalizeGeoJson(geometry: Polygon | MultiPolygon): Polygon | MultiPolygon {
  const rewound = turf.rewind({ type: 'Feature', geometry, properties: {} }, { reverse: false })
  return rewound.geometry as Polygon | MultiPolygon
}

/** Returns { valid, reason } for a polygon. */
export function validatePolygon(geometry: Polygon): { valid: boolean; reason?: string } {
  if (geometry.coordinates.length === 0) return { valid: false, reason: 'No rings' }
  const ring = geometry.coordinates[0]
  if (!ring || ring.length < 4) return { valid: false, reason: 'Ring has fewer than 4 points' }
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    return { valid: false, reason: 'Ring is not closed' }
  }
  try {
    turf.area({ type: 'Feature', geometry, properties: {} })
    return { valid: true }
  } catch (e) {
    return { valid: false, reason: String(e) }
  }
}

/** Clips a polygon to a bounding box. Returns null if no intersection. */
export function clipToBBox(geometry: Polygon | MultiPolygon, bbox: BBox): Polygon | MultiPolygon | null {
  const mask = createBoundingBoxRegion(bbox)
  try {
    const intersected = turf.intersect(
      turf.featureCollection([
        turf.feature(geometry),
        turf.feature(mask),
      ]),
    )
    if (!intersected) return null
    return intersected.geometry as Polygon | MultiPolygon
  } catch {
    return null
  }
}
