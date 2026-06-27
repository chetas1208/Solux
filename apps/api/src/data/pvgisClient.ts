import { v4 as uuid } from 'uuid'
import { dataConfig } from '@solux/config'
import type { SolarResourceProvider, SolarResourceResult } from './types.js'
import type { Point } from '@solux/shared'

/**
 * PVGIS (Photovoltaic Geographical Information System) client.
 * Free EU/global solar API — no key required.
 * Docs: https://re.jrc.ec.europa.eu/pvg_tools/en/
 *
 * TODO: Parse full monthly breakdowns for seasonal analysis.
 */
export class PvgisClient implements SolarResourceProvider {
  private readonly baseUrl = dataConfig.pvgisBaseUrl

  isAvailable(): boolean {
    return true // free, always available
  }

  unavailableReason(): string | undefined {
    return undefined
  }

  async fetch(centroid: Point, projectId: string, siteId: string): Promise<SolarResourceResult> {
    const [lon, lat] = centroid.coordinates

    const url = new URL(`${this.baseUrl}/PVcalc`)
    url.searchParams.set('outputformat', 'json')
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lon', lon.toString())
    url.searchParams.set('peakpower', '1')
    url.searchParams.set('loss', '14')
    url.searchParams.set('raddatabase', 'PVGIS-SARAH2')
    url.searchParams.set('pvtechchoice', 'crystSi')
    url.searchParams.set('mountingplace', 'free')
    url.searchParams.set('optimalangles', '1')

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      // Try ERA5 fallback for regions not covered by SARAH2
      return this.fetchWithEra5(centroid, projectId, siteId)
    }

    const json = (await res.json()) as Record<string, unknown>
    const totals = (json['totals'] as Record<string, unknown>)?.['E_y'] as number | undefined
    const inputs = json['inputs'] as Record<string, unknown> | undefined
    const radiation = (inputs?.['meteo_data'] as Record<string, unknown>)

    const annualKwh = totals ?? null
    const ghiKwhM2Day = annualKwh ? annualKwh / 365 : null

    if (!ghiKwhM2Day) {
      throw new Error('PVGIS returned no irradiance data for this location')
    }

    return {
      ghiKwhM2Day,
      dniKwhM2Day: ghiKwhM2Day * 0.85,
      temperatureC: 25,
      source: 'pvgis',
      evidenceItems: [
        {
          id: uuid(),
          siteId,
          projectId,
          source: 'pvgis',
          retrievedAt: new Date().toISOString(),
          description: `PVGIS SARAH2 annual solar energy for [${lat.toFixed(4)}, ${lon.toFixed(4)}]`,
          value: { annualKwh, radiationDatabase: radiation?.['radiation_db'] ?? 'PVGIS-SARAH2' },
          unit: 'kWh/kWp/year',
          latitude: lat,
          longitude: lon,
          dataConfidence: 0.88,
          metadata: { api: 'PVGIS', version: 'v5_2' },
        },
      ],
    }
  }

  private async fetchWithEra5(
    centroid: Point,
    projectId: string,
    siteId: string,
  ): Promise<SolarResourceResult> {
    const [lon, lat] = centroid.coordinates

    const url = new URL(`${this.baseUrl}/PVcalc`)
    url.searchParams.set('outputformat', 'json')
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lon', lon.toString())
    url.searchParams.set('peakpower', '1')
    url.searchParams.set('loss', '14')
    url.searchParams.set('raddatabase', 'PVGIS-ERA5')
    url.searchParams.set('optimalangles', '1')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      throw new Error(`PVGIS ERA5 fallback failed: ${res.status}`)
    }

    const json = (await res.json()) as Record<string, unknown>
    const totals = (json['totals'] as Record<string, unknown>)?.['E_y'] as number | undefined
    const ghiKwhM2Day = totals ? totals / 365 : 4.0

    return {
      ghiKwhM2Day,
      dniKwhM2Day: ghiKwhM2Day * 0.8,
      temperatureC: 25,
      source: 'pvgis',
      evidenceItems: [
        {
          id: uuid(),
          siteId,
          projectId,
          source: 'pvgis',
          retrievedAt: new Date().toISOString(),
          description: `PVGIS ERA5 fallback annual solar energy for [${lat.toFixed(4)}, ${lon.toFixed(4)}]`,
          value: { annualKwh: totals, radiationDatabase: 'PVGIS-ERA5' },
          unit: 'kWh/kWp/year',
          latitude: lat,
          longitude: lon,
          dataConfidence: 0.75,
          metadata: { api: 'PVGIS', fallback: 'ERA5' },
        },
      ],
    }
  }
}
