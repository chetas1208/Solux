import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export const DATA_ROOT = process.env.DATA_ROOT ?? '/data/solux'
export const PIPELINE_DIR = process.env.PIPELINE_DIR ?? resolve(_dirname, '../../')
export const COUNTRY_SCOPE = process.env.COUNTRY_SCOPE ?? 'USA,INDIA'
export const RUN_REGION_SUBSET = process.env.RUN_REGION_SUBSET === 'true'
export const H3_RES_LAND = parseInt(process.env.H3_RES_LAND ?? '7', 10)
export const H3_RES_WATER = parseInt(process.env.H3_RES_WATER ?? '7', 10)
export const PVGIS_BASE_URL = process.env.PVGIS_BASE_URL ?? 'https://re.jrc.ec.europa.eu/api/v5_2'
export const NREL_API_KEY = process.env.NREL_API_KEY ?? ''
export const DO_UPLOAD = process.env.DO_UPLOAD === 'true'
export const FORCE_DOWNLOAD = process.env.FORCE_DOWNLOAD === 'true'

export const dirs = {
  raw: `${DATA_ROOT}/raw`,
  staging: `${DATA_ROOT}/staging`,
  processed: `${DATA_ROOT}/processed`,
  tiles: `${DATA_ROOT}/tiles`,
  manifests: `${DATA_ROOT}/manifests`,
  reports: `${DATA_ROOT}/reports`,
  cache: `${DATA_ROOT}/cache`,
  logs: `${DATA_ROOT}/logs`,
} as const

export function scopeIncludes(country: string): boolean {
  return COUNTRY_SCOPE.split(',').map(s => s.trim().toUpperCase()).includes(country.toUpperCase())
}
