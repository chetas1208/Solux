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
