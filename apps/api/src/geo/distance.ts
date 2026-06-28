import * as turf from '@turf/turf'
import type { Coord } from './geometry.js'

export function haversineKm(from: Coord, to: Coord): number {
  return turf.distance(turf.point(from), turf.point(to), { units: 'kilometers' })
}

export function nearestKm(point: Coord, targets: Coord[]): number {
  if (targets.length === 0) return Infinity
  return Math.min(...targets.map((t) => haversineKm(point, t)))
}
