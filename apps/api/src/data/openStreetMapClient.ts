import { v4 as uuid } from 'uuid'
import type { GridProvider, GridProximityResult } from './types.js'
import type { Point } from '@solux/shared'

/**
 * OpenStreetMap Overpass API client for grid infrastructure and land use.
 * Free, no key required. Rate-limited — use responsibly.
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 */
export class OpenStreetMapClient implements GridProvider {
  private readonly overpassUrl = 'https://overpass-api.de/api/interpreter'

  isAvailable(): boolean {
    return true
  }

  unavailableReason(): string | undefined {
    return undefined
  }

  async fetch(centroid: Point, projectId: string, siteId: string): Promise<GridProximityResult> {
    const [lon, lat] = centroid.coordinates
    const radiusMeter = 30_000 // 30 km search radius

    const query = `
      [out:json][timeout:30];
      (
        way["power"="line"](around:${radiusMeter},${lat},${lon});
        node["power"="substation"](around:${radiusMeter},${lat},${lon});
        way["highway"~"trunk|primary|secondary"](around:${radiusMeter},${lat},${lon});
      );
      out center;
    `

    const res = await fetch(this.overpassUrl, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(35_000),
    })

    if (!res.ok) {
      throw new Error(`Overpass API error ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`)
    }

    const json = (await res.json()) as { elements: Array<Record<string, unknown>> }
    const elements = json.elements

    // Find nearest power line
    let nearestLineDistanceKm = Infinity
    let nearestLineVoltageKV: number | null = null
    let nearestSubstationDistanceKm: number | null = null
    let roadAccessDistanceKm = Infinity

    for (const el of elements) {
      const tags = (el['tags'] as Record<string, string>) ?? {}
      const elLat = (el['lat'] as number | undefined) ?? (el['center'] as Record<string, number> | undefined)?.['lat']
      const elLon = (el['lon'] as number | undefined) ?? (el['center'] as Record<string, number> | undefined)?.['lon']

      if (elLat === undefined || elLon === undefined) continue

      const distKm = haversineKm(lat, lon, elLat, elLon)

      if (el['type'] === 'way' && tags['power'] === 'line') {
        if (distKm < nearestLineDistanceKm) {
          nearestLineDistanceKm = distKm
          const voltageStr = tags['voltage']
          if (voltageStr) {
            const v = parseInt(voltageStr.split(';')[0] ?? '0', 10)
            nearestLineVoltageKV = v / 1000
          }
        }
      } else if (el['type'] === 'node' && tags['power'] === 'substation') {
        if (nearestSubstationDistanceKm === null || distKm < nearestSubstationDistanceKm) {
          nearestSubstationDistanceKm = distKm
        }
      } else if (el['type'] === 'way' && tags['highway']) {
        if (distKm < roadAccessDistanceKm) {
          roadAccessDistanceKm = distKm
        }
      }
    }

    const evidenceItems = [
      {
        id: uuid(),
        siteId,
        projectId,
        source: 'openstreetmap' as const,
        retrievedAt: new Date().toISOString(),
        description: `OSM Overpass grid and road infrastructure within 30 km of [${lat.toFixed(4)}, ${lon.toFixed(4)}]`,
        value: {
          powerLinesFound: elements.filter(
            (e) => (e['tags'] as Record<string, string>)?.['power'] === 'line',
          ).length,
          substationsFound: elements.filter(
            (e) => (e['tags'] as Record<string, string>)?.['power'] === 'substation',
          ).length,
          roadsFound: elements.filter(
            (e) => (e['tags'] as Record<string, string>)?.['highway'],
          ).length,
        },
        latitude: lat,
        longitude: lon,
        dataConfidence: 0.72,
        metadata: { radiusMeter, overpassQuery: 'power_line+substation+roads' },
      },
    ]

    return {
      nearestLineVoltageKV: nearestLineVoltageKV,
      nearestLineDistanceKm: isFinite(nearestLineDistanceKm) ? nearestLineDistanceKm : 999,
      nearestSubstationDistanceKm,
      roadAccessDistanceKm: isFinite(roadAccessDistanceKm) ? roadAccessDistanceKm : 999,
      source: 'openstreetmap',
      evidenceItems,
    }
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
