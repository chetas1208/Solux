import { v4 as uuid } from 'uuid'
import { dataConfig } from '@solux/config'
import type { WaterConditionsProvider, WaterConditionsResult } from './types.js'
import type { Point } from '@solux/shared'

/**
 * GEBCO (General Bathymetric Chart of the Oceans) client.
 * Requires local GeoTIFF raster data downloaded from https://www.gebco.net/
 * Falls back to GEBCO WMS if local data is unavailable (limited coverage).
 *
 * TODO: Add node-gdal-next for local raster reading.
 * TODO: Add Copernicus Marine Service integration for wave/current data.
 */
export class GebcoClient implements WaterConditionsProvider {
  isAvailable(): boolean {
    return !!dataConfig.gebcoDataDir
  }

  unavailableReason(): string | undefined {
    if (!dataConfig.gebcoDataDir) {
      return 'GEBCO_DATA_DIR not configured — download bathymetry data from https://www.gebco.net/data_and_products/gridded_bathymetry_data/'
    }
    return undefined
  }

  async fetch(centroid: Point, projectId: string, siteId: string): Promise<WaterConditionsResult> {
    if (!this.isAvailable()) {
      throw new Error('GEBCO not available: ' + this.unavailableReason())
    }

    const [lon, lat] = centroid.coordinates

    // TODO: Read local GEBCO GeoTIFF using node-gdal-next
    // const depth = await readGebcoRaster(dataConfig.gebcoDataDir, lat, lon)

    // Fall back to GEBCO WMS for depth estimate
    const wmsUrl = new URL('https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv')
    wmsUrl.searchParams.set('SERVICE', 'WMS')
    wmsUrl.searchParams.set('VERSION', '1.1.1')
    wmsUrl.searchParams.set('REQUEST', 'GetFeatureInfo')
    wmsUrl.searchParams.set('LAYERS', 'GEBCO_LATEST')
    wmsUrl.searchParams.set('QUERY_LAYERS', 'GEBCO_LATEST')
    wmsUrl.searchParams.set('INFO_FORMAT', 'text/plain')
    wmsUrl.searchParams.set('BBOX', `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`)
    wmsUrl.searchParams.set('WIDTH', '10')
    wmsUrl.searchParams.set('HEIGHT', '10')
    wmsUrl.searchParams.set('X', '5')
    wmsUrl.searchParams.set('Y', '5')
    wmsUrl.searchParams.set('SRS', 'EPSG:4326')

    let depthM: number | null = null

    try {
      const res = await fetch(wmsUrl.toString(), { signal: AbortSignal.timeout(10_000) })
      if (res.ok) {
        const text = await res.text()
        const match = /(-?\d+\.?\d*)/.exec(text)
        if (match?.[1]) depthM = parseFloat(match[1])
      }
    } catch {
      // WMS failed — depth unknown
    }

    // Negative GEBCO values = below sea level (ocean/lake floor)
    const actualDepthM = depthM !== null && depthM < 0 ? Math.abs(depthM) : depthM

    return {
      depthM: actualDepthM,
      waveHeightHsM: null, // TODO: Copernicus Marine
      currentSpeedMs: null, // TODO: Copernicus Marine
      tidalRangeM: null, // TODO: NOAA tides
      isCalm: actualDepthM !== null ? actualDepthM < 3 : false,
      source: 'gebco',
      evidenceItems: [
        {
          id: uuid(),
          siteId,
          projectId,
          source: 'gebco',
          retrievedAt: new Date().toISOString(),
          description: `GEBCO bathymetry depth at [${lat.toFixed(4)}, ${lon.toFixed(4)}]`,
          value: { depthM: actualDepthM, rawValue: depthM },
          unit: 'meters',
          latitude: lat,
          longitude: lon,
          dataConfidence: dataConfig.gebcoDataDir ? 0.85 : 0.55,
          metadata: { method: dataConfig.gebcoDataDir ? 'local_raster' : 'wms_fallback' },
        },
      ],
    }
  }
}
