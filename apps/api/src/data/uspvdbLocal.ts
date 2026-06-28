import { existsSync } from 'fs'
import { env } from '../config/env.js'

/**
 * US PVDB (Utility-Scale Solar Photovoltaic Database) local reader.
 * Download shapefile from https://eerscmap.usgs.gov/uspvdb/
 *
 * TODO: Read shapefile using shpjs or parse-dbf to find nearby existing plants.
 *       Useful for: proximity conflict check, grid saturation estimation,
 *       benchmark existing capacity in region.
 */
export class UspvdbClient {
  static isAvailable(): boolean {
    const dir = env.USPVDB_DATA_DIR
    return !!dir && existsSync(dir)
  }

  static unavailableReason(): string | undefined {
    const dir = env.USPVDB_DATA_DIR
    if (!dir) return 'USPVDB_DATA_DIR not set — download from https://eerscmap.usgs.gov/uspvdb/'
    if (!existsSync(dir)) return `Directory "${dir}" not found`
    return undefined
  }

  /**
   * TODO: Query nearby utility-scale PV plants within radiusKm.
   * Returns array of { name, capacityMW, lat, lon }.
   */
  async findNearbyPlants(
    _lat: number,
    _lon: number,
    _radiusKm: number,
  ): Promise<Array<{ name: string; capacityMW: number; lat: number; lon: number }>> {
    if (!UspvdbClient.isAvailable()) return []
    // TODO: implement shapefile spatial query
    return []
  }
}
