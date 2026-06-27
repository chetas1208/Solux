import type {
  SolarResourceProvider,
  LandCoverProvider,
  GridProvider,
  WeatherProvider,
  WaterConditionsProvider,
} from './types.js'
import { NrelNsrdbClient } from './nrelNsrdbClient.js'
import { PvgisClient } from './pvgisClient.js'
import { OpenStreetMapClient } from './openStreetMapClient.js'
import { GebcoClient } from './gebcoClient.js'
import type { DataSourceStatus } from '@solux/shared'
import { getDataSourceAvailability } from '@solux/config'

/**
 * Returns the best available solar resource provider.
 * Priority: NREL NSRDB (US) → PVGIS (global).
 */
export function getSolarProvider(countryHint?: string): SolarResourceProvider {
  const nrel = new NrelNsrdbClient()
  if (countryHint === 'USA' && nrel.isAvailable()) return nrel
  return new PvgisClient()
}

export function getLandCoverProvider(): LandCoverProvider {
  // TODO: Implement Google Earth Engine or Copernicus Land Cover client
  // Return unavailable stub for now — do not fake data
  return {
    isAvailable: () => false,
    unavailableReason: () =>
      'Land cover provider not configured. Set up GEE_SERVICE_ACCOUNT or configure COPERNICUS_LAND_COVER_DIR for slope and vegetation data.',
    fetch: async () => {
      throw new Error('Land cover provider not configured')
    },
  }
}

export function getGridProvider(): GridProvider {
  return new OpenStreetMapClient()
}

export function getWeatherProvider(): WeatherProvider {
  // TODO: Implement NASA POWER or ERA5 weather/aerosol client
  return {
    isAvailable: () => false,
    unavailableReason: () =>
      'Weather/aerosol provider not configured. TODO: implement NASA POWER or ERA5 client.',
    fetch: async () => {
      throw new Error('Weather provider not configured')
    },
  }
}

export function getWaterConditionsProvider(): WaterConditionsProvider {
  return new GebcoClient()
}

/** Returns current data source status for the UI panel. */
export function getDataSourceStatuses(): DataSourceStatus[] {
  const avail = getDataSourceAvailability()
  const now = new Date().toISOString()
  const nrel = new NrelNsrdbClient()

  return [
    {
      id: 'nrel_nsrdb',
      label: 'NREL NSRDB (US Solar)',
      available: avail.nrel_nsrdb,
      unavailableReason: nrel.unavailableReason(),
      lastCheckedAt: now,
      coverageDescription: 'United States solar irradiance, TMY and historical',
    },
    {
      id: 'pvgis',
      label: 'PVGIS (Global Solar)',
      available: true,
      lastCheckedAt: now,
      coverageDescription: 'Europe, Africa, Asia, Americas — free REST API',
    },
    {
      id: 'openstreetmap',
      label: 'OpenStreetMap (Grid & Roads)',
      available: true,
      lastCheckedAt: now,
      coverageDescription: 'Global transmission lines, substations, road access via Overpass API',
    },
    {
      id: 'global_solar_atlas',
      label: 'Global Solar Atlas (GHI Raster)',
      available: avail.global_solar_atlas,
      unavailableReason: avail.global_solar_atlas
        ? undefined
        : 'GLOBAL_SOLAR_ATLAS_DATA_DIR not set — download from https://globalsolaratlas.info',
      lastCheckedAt: now,
      coverageDescription: 'Global GHI raster at 1 km resolution',
    },
    {
      id: 'uspvdb',
      label: 'US PVDB (Utility PV Database)',
      available: avail.uspvdb,
      unavailableReason: avail.uspvdb
        ? undefined
        : 'USPVDB_DATA_DIR not set — download from https://eerscmap.usgs.gov/uspvdb/',
      lastCheckedAt: now,
      coverageDescription: 'US utility-scale PV plant locations and specs',
    },
    {
      id: 'gebco',
      label: 'GEBCO (Bathymetry)',
      available: avail.gebco,
      unavailableReason: avail.gebco
        ? undefined
        : 'GEBCO_DATA_DIR not set — download from https://www.gebco.net/',
      lastCheckedAt: now,
      coverageDescription: 'Global ocean and lake depth for water-site feasibility',
    },
    {
      id: 'copernicus_marine',
      label: 'Copernicus Marine (Waves/Currents)',
      available: avail.copernicus_marine,
      unavailableReason: avail.copernicus_marine
        ? undefined
        : 'COPERNICUS_MARINE_CONFIG not set — sign up at https://marine.copernicus.eu/',
      lastCheckedAt: now,
      coverageDescription: 'Wave height, current speed for offshore/coastal site assessment',
    },
  ]
}
