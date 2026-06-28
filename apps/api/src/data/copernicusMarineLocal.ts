import { existsSync } from 'fs'
import { env } from '../config/env.js'

/**
 * Copernicus Marine Service wave/current data client.
 * Requires local data download via the copernicusmarine Python CLI:
 *   copernicusmarine get -i cmems_mod_glo_wav_anfc_0.083deg_PT3H-i -v VHM0 -v VTPK
 *
 * TODO: Read downloaded NetCDF files using netcdf4-node or node-netcdf.
 *       Extract significant wave height (VHM0) and peak period at [lat, lon].
 *
 * Note: The Copernicus Python CLI is external tooling — not a Python backend.
 *       Data is pre-downloaded to COPERNICUS_MARINE_CONFIG dir before deployment.
 */
export class CopernicusMarineClient {
  static isAvailable(): boolean {
    const cfg = env.COPERNICUS_MARINE_CONFIG
    return !!cfg && existsSync(cfg)
  }

  static unavailableReason(): string | undefined {
    const cfg = env.COPERNICUS_MARINE_CONFIG
    if (!cfg) {
      return [
        'COPERNICUS_MARINE_CONFIG not set.',
        'Download wave data using: copernicusmarine get -i cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
        'Sign up at https://marine.copernicus.eu/',
      ].join(' ')
    }
    if (!existsSync(cfg)) return `Config path "${cfg}" not found`
    return undefined
  }

  /**
   * TODO: Sample significant wave height Hs and peak period at [lat, lon].
   * Returns null if data unavailable for the location.
   */
  async fetchWaveConditions(
    _lat: number,
    _lon: number,
  ): Promise<{ waveHeightHsM: number; peakPeriodS: number } | null> {
    if (!CopernicusMarineClient.isAvailable()) return null
    // TODO: read NetCDF grid at (lat, lon)
    return null
  }
}
