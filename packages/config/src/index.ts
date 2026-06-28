import { z } from 'zod'

function env(key: string): string | undefined {
  return process.env[key]
}

function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Required env var ${key} is not set`)
  return v
}

export const serverConfig = {
  get port() {
    return parseInt(env('API_PORT') ?? env('PORT') ?? '3001', 10)
  },
  get host() {
    return env('API_HOST') ?? '0.0.0.0'
  },
  get corsOrigin() {
    return env('CORS_ORIGIN') ?? 'http://localhost:3000'
  },
  get nodeEnv() {
    return (env('NODE_ENV') ?? 'development') as 'development' | 'production' | 'test'
  },
}

export const dbConfig = {
  get uri() {
    return env('MONGODB_URI') ?? ''
  },
  get dbName() {
    return env('MONGODB_DB') ?? 'solux'
  },
}

export const aiConfig = {
  get geminiApiKey() {
    return env('GEMINI_API_KEY') ?? ''
  },
  get minimaxApiKey() {
    return env('MINIMAX_API_KEY') ?? ''
  },
  get minimaxGroupId() {
    return env('MINIMAX_GROUP_ID') ?? ''
  },
  get modularEndpoint() {
    return env('MODULAR_MODEL_ENDPOINT') ?? ''
  },
}

export const dataConfig = {
  get nrelApiKey() {
    return env('NREL_API_KEY') ?? ''
  },
  get pvgisBaseUrl() {
    return env('PVGIS_BASE_URL') ?? 'https://re.jrc.ec.europa.eu/api/v5_2'
  },
  get globalSolarAtlasDataDir() {
    return env('GLOBAL_SOLAR_ATLAS_DATA_DIR') ?? ''
  },
  get uspvdbDataDir() {
    return env('USPVDB_DATA_DIR') ?? ''
  },
  get gebcoDataDir() {
    return env('GEBCO_DATA_DIR') ?? ''
  },
  get copernicusMarineConfig() {
    return env('COPERNICUS_MARINE_CONFIG') ?? ''
  },
  get googleMapsApiKey() {
    return env('GOOGLE_MAPS_API_KEY') ?? ''
  },
}

export const spacesConfig = {
  get endpoint() {
    return env('DIGITALOCEAN_SPACES_ENDPOINT') ?? ''
  },
  get bucket() {
    return env('DIGITALOCEAN_SPACES_BUCKET') ?? 'solux-reports'
  },
  get key() {
    return env('DIGITALOCEAN_SPACES_KEY') ?? ''
  },
  get secret() {
    return env('DIGITALOCEAN_SPACES_SECRET') ?? ''
  },
}

/** Returns whether each data source is configured. */
export function getDataSourceAvailability() {
  return {
    nrel_nsrdb: !!dataConfig.nrelApiKey,
    pvgis: true, // free, no key needed
    global_solar_atlas: !!dataConfig.globalSolarAtlasDataDir,
    openstreetmap: true, // Overpass API — free
    uspvdb: !!dataConfig.uspvdbDataDir,
    gebco: !!dataConfig.gebcoDataDir,
    copernicus_marine: !!dataConfig.copernicusMarineConfig,
    modular_endpoint: !!aiConfig.modularEndpoint,
  }
}
