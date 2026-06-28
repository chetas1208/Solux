import * as turf from '@turf/turf'
import type { GeoPolygon, GeoGeometry } from './geometry.js'

export function intersects(a: GeoGeometry, b: GeoGeometry): boolean {
  return !turf.booleanDisjoint(
    { type: 'Feature', geometry: a as never, properties: {} },
    { type: 'Feature', geometry: b as never, properties: {} },
  )
}

export function bufferKm(geometry: GeoGeometry, radiusKm: number): GeoGeometry {
  const buffered = turf.buffer(
    { type: 'Feature', geometry: geometry as never, properties: {} },
    radiusKm,
    { units: 'kilometers' },
  )
  if (!buffered) throw new Error('Buffer failed')
  return buffered.geometry as GeoGeometry
}

export function clipToBBox(
  geometry: GeoGeometry,
  bbox: [number, number, number, number],
): GeoGeometry | null {
  const mask: GeoPolygon = {
    type: 'Polygon',
    coordinates: [
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[1]],
        [bbox[2], bbox[3]],
        [bbox[0], bbox[3]],
        [bbox[0], bbox[1]],
      ],
    ],
  }
  try {
    const result = turf.intersect(
      turf.featureCollection([
        turf.feature(geometry as never),
        turf.feature(mask),
      ]),
    )
    return result ? (result.geometry as GeoGeometry) : null
  } catch {
    return null
  }
}
