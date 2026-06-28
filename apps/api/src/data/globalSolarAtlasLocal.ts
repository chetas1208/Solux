import { existsSync, readdirSync } from 'fs'
import { env } from '../config/env.js'

/**
 * Global Solar Atlas local raster reader.
 * Expects GeoTIFF files downloaded from https://globalsolaratlas.info/download
 *
 * TODO: Implement GeoTIFF pixel sampling using gdal-async or geotiff.js
 *       Once implemented, this replaces PVGIS as the primary solar source for
 *       regions where the raster file covers the candidate site centroid.
 *
 * Supported file naming (GSA download convention):
 *   World_GHI_GISdata_GlobalSolarAtlas_GEOTIFF/GHI.tif
 *   or per-country files like IND_GHI_GISdata_GlobalSolarAtlas_GEOTIFF/GHI.tif
 */
export class GlobalSolarAtlasClient {
  static isAvailable(): boolean {
    const dir = env.GLOBAL_SOLAR_ATLAS_DATA_DIR
    if (!dir || !existsSync(dir)) return false
    try {
      const files = readdirSync(dir)
      return files.some((f) => f.toLowerCase().endsWith('.tif') || f.toLowerCase().endsWith('.tiff'))
    } catch {
      return false
    }
  }

  static unavailableReason(): string | undefined {
    const dir = env.GLOBAL_SOLAR_ATLAS_DATA_DIR
    if (!dir) return 'GLOBAL_SOLAR_ATLAS_DATA_DIR not set'
    if (!existsSync(dir)) return `Directory "${dir}" not found`
    try {
      const files = readdirSync(dir)
      if (!files.some((f) => f.toLowerCase().endsWith('.tif') || f.toLowerCase().endsWith('.tiff'))) {
        return `No .tif files found in ${dir} — download GHI GeoTIFF from https://globalsolaratlas.info/download`
      }
    } catch (err) {
      return `Cannot read directory: ${String(err)}`
    }
    return undefined
  }

  /**
   * TODO: Sample GHI raster at [lat, lon] using gdal-async.
   * Install: pnpm add gdal-async
   * Usage: const ds = gdal.open(tifPath); ds.bands.get(1).pixels.get(px, py)
   */
  async fetchGhi(_lat: number, _lon: number): Promise<number | null> {
    if (!GlobalSolarAtlasClient.isAvailable()) return null
    // TODO: implement raster sampling
    return null
  }
}
