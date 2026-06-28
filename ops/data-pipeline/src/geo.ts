import * as h3 from 'h3-js'
import * as turf from '@turf/turf'
import type { Feature, Polygon, FeatureCollection } from 'geojson'

export interface BBox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

// Bounding boxes for region subsets
export const REGION_BBOXES: Record<string, BBox> = {
  // USA high-solar states
  'AZ': { minLon: -114.82, minLat: 31.33, maxLon: -109.04, maxLat: 37.00 },
  'CA': { minLon: -124.41, minLat: 32.53, maxLon: -114.13, maxLat: 42.01 },
  'NV': { minLon: -120.00, minLat: 35.00, maxLon: -114.04, maxLat: 42.00 },
  'NM': { minLon: -109.05, minLat: 31.33, maxLon: -103.00, maxLat: 37.00 },
  'TX': { minLon: -106.65, minLat: 25.84, maxLon: -93.51,  maxLat: 36.50 },
  // India high-solar states
  'RAJ': { minLon: 69.48, minLat: 23.04, maxLon: 78.26, maxLat: 30.21 },
  'GUJ': { minLon: 68.14, minLat: 20.09, maxLon: 74.48, maxLat: 24.73 },
  'MH':  { minLon: 72.66, minLat: 15.61, maxLon: 80.90, maxLat: 22.03 },
  'MP':  { minLon: 74.03, minLat: 21.08, maxLon: 82.80, maxLat: 26.87 },
  'KAR': { minLon: 74.05, minLat: 11.59, maxLon: 78.59, maxLat: 18.47 },
  'AP':  { minLon: 76.76, minLat: 12.62, maxLon: 84.75, maxLat: 19.92 },
  'TS':  { minLon: 77.21, minLat: 15.73, maxLon: 81.35, maxLat: 19.92 },
  'TN':  { minLon: 76.24, minLat: 8.07,  maxLon: 80.35, maxLat: 13.57 },
  // Whole countries (fallback)
  'USA': { minLon: -125.0, minLat: 24.0, maxLon: -66.0, maxLat: 50.0 },
  'INDIA': { minLon: 68.0, minLat: 8.0, maxLon: 97.0, maxLat: 37.0 },
}

export function bboxToH3Cells(bbox: BBox, res: number): string[] {
  // h3-js v4 polygonToCells takes flat [lat, lng][] (not {outer} object)
  const ring: [number, number][] = [
    [bbox.maxLat, bbox.minLon],
    [bbox.maxLat, bbox.maxLon],
    [bbox.minLat, bbox.maxLon],
    [bbox.minLat, bbox.minLon],
    [bbox.maxLat, bbox.minLon],
  ]
  return h3.polygonToCells(ring, res) as string[]
}

export function h3ToFeature(h3Index: string): Feature<Polygon> {
  const boundary = h3.cellToBoundary(h3Index) as [number, number][]
  // h3-js v4 returns [lat, lng]; GeoJSON needs [lon, lat]
  const ring = boundary.map(([lat, lng]) => [lng, lat] as [number, number])
  ring.push(ring[0]!)  // close ring
  const coordinates = ring
  const center = h3.cellToLatLng(h3Index) as [number, number]
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coordinates] },
    properties: {
      h3Index,
      h3Res: h3.getResolution(h3Index),
      centroid_lat: center[0],  // [lat, lng] in h3-js v4
      centroid_lon: center[1],
      area_km2: h3.cellArea(h3Index, 'km2'),
    },
  }
}

export function h3CellsToFeatureCollection(cells: string[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: cells.map(h3ToFeature),
  }
}

export function latLonToH3(lat: number, lon: number, res: number): string {
  return h3.latLngToCell(lat, lon, res)
}

export function h3Neighbors(h3Index: string, k = 1): string[] {
  return h3.gridDisk(h3Index, k)
}

export type SiteSurfaceType = 'land' | 'water_reservoir' | 'water_lake' | 'water_coastal'

// ESA WorldCover class codes: 10=Tree cover, 20=Shrubland, 30=Grassland, 40=Cropland,
// 50=Built-up, 60=Bare/sparse veg, 70=Snow/ice, 80=Perm water, 90=Herbaceous wetland,
// 95=Mangroves, 100=Moss/lichen
export const BUILDABLE_LAND_CLASSES = new Set([20, 30, 40, 60])  // shrub, grass, crop, bare
export const WATER_CLASSES = new Set([80])
export const EXCLUDED_LAND_CLASSES = new Set([50, 70, 95, 100])  // built-up, snow, mangrove, moss

export function classifyLandcover(dominantEsaClass: number): {
  suitableForSolar: boolean
  suitableForFloating: boolean
  excludeReason?: string
} {
  if (EXCLUDED_LAND_CLASSES.has(dominantEsaClass)) {
    return { suitableForSolar: false, suitableForFloating: false, excludeReason: `ESA class ${dominantEsaClass} excluded` }
  }
  if (dominantEsaClass === 10) {
    return { suitableForSolar: false, suitableForFloating: false, excludeReason: 'Tree cover' }
  }
  if (WATER_CLASSES.has(dominantEsaClass)) {
    return { suitableForSolar: false, suitableForFloating: true }
  }
  if (BUILDABLE_LAND_CLASSES.has(dominantEsaClass)) {
    return { suitableForSolar: true, suitableForFloating: false }
  }
  return { suitableForSolar: true, suitableForFloating: false }
}
