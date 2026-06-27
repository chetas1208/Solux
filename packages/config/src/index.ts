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
  port: parseInt(env('API_PORT') ?? env('PORT') ?? '3001', 10),
  host: env('API_HOST') ?? '0.0.0.0',
  corsOrigin: env('CORS_ORIGIN') ?? 'http://localhost:3000',
  nodeEnv: (env('NODE_ENV') ?? 'development') as 'development' | 'production' | 'test',
}

export const dbConfig = {
  uri: env('MONGODB_URI') ?? '',
  dbName: env('MONGODB_DB') ?? 'solux',
}

export const aiConfig = {
  geminiApiKey: env('GEMINI_API_KEY') ?? '',
  minimaxApiKey: env('MINIMAX_API_KEY') ?? '',
  minimaxGroupId: env('MINIMAX_GROUP_ID') ?? '',
  modularEndpoint: env('MODULAR_MODEL_ENDPOINT') ?? '',
}

export const dataConfig = {
  nrelApiKey: env('NREL_API_KEY') ?? '',
  pvgisBaseUrl: env('PVGIS_BASE_URL') ?? 'https://re.jrc.ec.europa.eu/api/v5_2',
  globalSolarAtlasDataDir: env('GLOBAL_SOLAR_ATLAS_DATA_DIR') ?? '',
  uspvdbDataDir: env('USPVDB_DATA_DIR') ?? '',
  gebcoDataDir: env('GEBCO_DATA_DIR') ?? '',
  copernicusMarineConfig: env('COPERNICUS_MARINE_CONFIG') ?? '',
  googleMapsApiKey: env('GOOGLE_MAPS_API_KEY') ?? '',
}

export const spacesConfig = {
  endpoint: env('DIGITALOCEAN_SPACES_ENDPOINT') ?? '',
  bucket: env('DIGITALOCEAN_SPACES_BUCKET') ?? 'solux-reports',
  key: env('DIGITALOCEAN_SPACES_KEY') ?? '',
  secret: env('DIGITALOCEAN_SPACES_SECRET') ?? '',
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
