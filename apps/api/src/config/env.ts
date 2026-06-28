import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server
  PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // DB
  MONGODB_URI: z.string().default(''),
  MONGODB_DB: z.string().default('solux'),

  // AI
  GEMINI_API_KEY: z.string().default(''),
  // gemini-2.5-flash for fast tasks; override with GEMINI_FAST_MODEL
  GEMINI_FAST_MODEL: z.string().default('gemini-2.5-flash'),
  // gemini-2.5-pro for report verification; optional — skip if not set
  GEMINI_REPORT_MODEL: z.string().default(''),

  MINIMAX_API_KEY: z.string().default(''),
  MINIMAX_GROUP_ID: z.string().default(''),

  // Solar data
  NREL_API_KEY: z.string().default(''),
  PVGIS_BASE_URL: z.string().default('https://re.jrc.ec.europa.eu/api/v5_2'),

  // Local raster/vector datasets
  GLOBAL_SOLAR_ATLAS_DATA_DIR: z.string().default(''),
  USPVDB_DATA_DIR: z.string().default(''),
  GEBCO_DATA_DIR: z.string().default(''),
  COPERNICUS_MARINE_CONFIG: z.string().default(''),

  // Model registry (optional — for Mojo kernel metadata)
  MODEL_REGISTRY_DIR: z.string().default(''),

  // Mojo binary path (optional)
  MOJO_SCORE_KERNEL_BIN: z.string().default(''),

  // Maps
  GOOGLE_MAPS_API_KEY: z.string().default(''),
  CESIUM_ION_TOKEN: z.string().default(''),
  MAPTILER_KEY: z.string().default(''),
  GOOGLE_3D_TILES_ENABLED: z
    .enum(['true', 'false', '1', '0', ''])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  // Object storage
  DIGITALOCEAN_SPACES_ENDPOINT: z.string().default(''),
  DIGITALOCEAN_SPACES_BUCKET: z.string().default('solux-reports'),
  DIGITALOCEAN_SPACES_KEY: z.string().default(''),
  DIGITALOCEAN_SPACES_SECRET: z.string().default(''),

  // Data lake + model pipeline
  DATA_ROOT: z.string().default('/data/solux'),
  DATASET_VERSION: z.string().default('v0.1'),
  SOLUX_DATASET_PREFIX: z.string().default('datasets/solux-site-screening/v0.1'),
  SOLUX_OUTPUT_PREFIX: z.string().default('outputs/solux-site-screening/v0.1'),
  SOLUX_MODEL_ENDPOINT: z.string().default(''),
  SOLUX_MODEL_ENDPOINT_AUTH: z.string().default(''),
})

function parseEnv() {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment:', result.error.flatten().fieldErrors)
    process.exit(1)
  }
  return result.data
}

export const env = parseEnv()

export type Env = typeof env
