import { v4 as uuid } from 'uuid'
import { dataConfig } from '@solux/config'
import type { SolarResourceProvider, SolarResourceResult } from './types.js'
import type { Point } from '@solux/shared'

/**
 * NREL NSRDB solar resource client.
 * Fetches hourly/annual solar data via the NREL Developer API.
 * Docs: https://developer.nrel.gov/docs/solar/nsrdb/
 *
 * TODO: Implement full time-series fetch and annual averaging.
 * Currently fetches the NSRDB annual statistics endpoint.
 */
export class NrelNsrdbClient implements SolarResourceProvider {
  private readonly baseUrl = 'https://developer.nrel.gov/api/nsrdb/v2/solar'

  isAvailable(): boolean {
    return !!dataConfig.nrelApiKey
  }

  unavailableReason(): string | undefined {
    if (!dataConfig.nrelApiKey) return 'NREL_API_KEY not configured'
    return undefined
  }

  async fetch(centroid: Point, projectId: string, siteId: string): Promise<SolarResourceResult> {
    if (!this.isAvailable()) {
      throw new Error('NREL NSRDB not available: ' + this.unavailableReason())
    }

    const [lon, lat] = centroid.coordinates

    // TODO: Switch to full time-series endpoint for production accuracy
    // Using PSM v3 attributes endpoint for quick annual summary
    const url = new URL(`${this.baseUrl}/psm3-tmy-download.json`)
    url.searchParams.set('api_key', dataConfig.nrelApiKey)
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lon', lon.toString())
    url.searchParams.set('attributes', 'ghi,dni,air_temperature,dew_point,wind_speed')
    url.searchParams.set('leap_day', 'true')
    url.searchParams.set('interval', '60')
    url.searchParams.set('utc', 'false')
    url.searchParams.set('email', 'solux@example.com')
    url.searchParams.set('names', 'tmy')
    url.searchParams.set('wkt', `POINT(${lon} ${lat})`)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`NREL NSRDB API error ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as Record<string, unknown>

    // NSRDB returns a download URL — parse outputs summary
    const outputs = json['outputs'] as Record<string, number> | undefined
    const ghiAnnual = outputs?.['ghi'] ?? null
    const dniAnnual = outputs?.['dni'] ?? null

    if (ghiAnnual === null) {
      throw new Error('NREL NSRDB returned no GHI data for this location')
    }

    const ghiKwhM2Day = (ghiAnnual as number) / 365

    return {
      ghiKwhM2Day,
      dniKwhM2Day: dniAnnual ? (dniAnnual as number) / 365 : ghiKwhM2Day * 0.8,
      temperatureC: (outputs?.['air_temperature'] as number | undefined) ?? 25,
      source: 'nrel_nsrdb',
      evidenceItems: [
        {
          id: uuid(),
          siteId,
          projectId,
          source: 'nrel_nsrdb',
          retrievedAt: new Date().toISOString(),
          description: `NREL NSRDB TMY GHI for [${lat.toFixed(4)}, ${lon.toFixed(4)}]`,
          value: { ghiAnnual, dniAnnual },
          unit: 'kWh/m²/year',
          latitude: lat,
          longitude: lon,
          dataConfidence: 0.92,
          metadata: { endpoint: 'psm3-tmy', apiVersion: 'v2' },
        },
      ],
    }
  }
}
