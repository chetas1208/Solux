import { existsSync } from 'fs'
import { env } from '../config/env.js'
import type { DataSourceStatus } from '../agent/schemas.js'

/**
 * Returns current availability for all data sources.
 * Pass `deep=true` to make lightweight API probe calls (PVGIS ping, OSM ping).
 * Never calls expensive NREL endpoints unless explicitly requested.
 */
export async function getDataSourceStatuses(deep = false): Promise<DataSourceStatus[]> {
  const now = new Date().toISOString()
  const statuses: DataSourceStatus[] = []

  // NREL NSRDB
  statuses.push({
    id: 'nrel_nsrdb',
    label: 'NREL NSRDB (US Solar)',
    available: !!env.NREL_API_KEY,
    unavailableReason: env.NREL_API_KEY
      ? undefined
      : 'NREL_API_KEY not set — sign up at https://developer.nrel.gov/signup/',
    lastCheckedAt: now,
    coverageDescription: 'USA solar irradiance TMY and historical at hourly resolution',
    deepCheckRan: false,
  })

  // PVGIS
  let pvgisAvailable = true
  let pvgisReason: string | undefined
  if (deep) {
    try {
      const res = await fetch(`${env.PVGIS_BASE_URL}/PVcalc?outputformat=json&lat=23&lon=72&peakpower=1&loss=14`, {
        signal: AbortSignal.timeout(8000),
      })
      pvgisAvailable = res.ok
      if (!res.ok) pvgisReason = `PVGIS API returned HTTP ${res.status}`
    } catch (err) {
      pvgisAvailable = false
      pvgisReason = `PVGIS unreachable: ${String(err).slice(0, 100)}`
    }
  }
  statuses.push({
    id: 'pvgis',
    label: 'PVGIS (Global Solar, free)',
    available: pvgisAvailable,
    unavailableReason: pvgisReason,
    lastCheckedAt: now,
    coverageDescription: 'Global solar via EU REST API — no key required',
    deepCheckRan: deep,
  })

  // OpenStreetMap Overpass
  let osmAvailable = true
  let osmReason: string | undefined
  if (deep) {
    try {
      const res = await fetch('https://overpass-api.de/api/status', {
        signal: AbortSignal.timeout(5000),
      })
      osmAvailable = res.ok
      if (!res.ok) osmReason = `Overpass returned HTTP ${res.status}`
    } catch (err) {
      osmAvailable = false
      osmReason = `Overpass unreachable: ${String(err).slice(0, 100)}`
    }
  }
  statuses.push({
    id: 'openstreetmap',
    label: 'OpenStreetMap Overpass (Grid & Roads)',
    available: osmAvailable,
    unavailableReason: osmReason,
    lastCheckedAt: now,
    coverageDescription: 'Global transmission lines, substations, roads — free',
    deepCheckRan: deep,
  })

  // Global Solar Atlas
  const gsaDir = env.GLOBAL_SOLAR_ATLAS_DATA_DIR
  const gsaAvail = !!gsaDir && existsSync(gsaDir)
  statuses.push({
    id: 'global_solar_atlas',
    label: 'Global Solar Atlas (GHI Raster)',
    available: gsaAvail,
    unavailableReason: gsaAvail
      ? undefined
      : gsaDir
        ? `GLOBAL_SOLAR_ATLAS_DATA_DIR "${gsaDir}" does not exist on disk`
        : 'GLOBAL_SOLAR_ATLAS_DATA_DIR not set — download from https://globalsolaratlas.info/download',
    lastCheckedAt: now,
    coverageDescription: 'Global GHI raster at 1 km resolution — local GeoTIFF required',
    deepCheckRan: false,
  })

  // US PVDB
  const pvdbDir = env.USPVDB_DATA_DIR
  const pvdbAvail = !!pvdbDir && existsSync(pvdbDir)
  statuses.push({
    id: 'uspvdb',
    label: 'US PVDB (Utility PV Database)',
    available: pvdbAvail,
    unavailableReason: pvdbAvail
      ? undefined
      : pvdbDir
        ? `USPVDB_DATA_DIR "${pvdbDir}" does not exist`
        : 'USPVDB_DATA_DIR not set — download from https://eerscmap.usgs.gov/uspvdb/',
    lastCheckedAt: now,
    coverageDescription: 'US utility-scale PV locations — local shapefile required',
    deepCheckRan: false,
  })

  // GEBCO
  const gebcoDir = env.GEBCO_DATA_DIR
  const gebcoAvail = !!gebcoDir && existsSync(gebcoDir)
  statuses.push({
    id: 'gebco',
    label: 'GEBCO (Bathymetry)',
    available: gebcoAvail,
    unavailableReason: gebcoAvail
      ? undefined
      : gebcoDir
        ? `GEBCO_DATA_DIR "${gebcoDir}" does not exist`
        : 'GEBCO_DATA_DIR not set — download from https://www.gebco.net/',
    lastCheckedAt: now,
    coverageDescription: 'Global ocean/lake bathymetry — local raster required for water sites',
    deepCheckRan: false,
  })

  // Copernicus Marine
  const copernicusConf = env.COPERNICUS_MARINE_CONFIG
  const copernicusAvail = !!copernicusConf && existsSync(copernicusConf)
  statuses.push({
    id: 'copernicus_marine',
    label: 'Copernicus Marine (Waves/Currents)',
    available: copernicusAvail,
    unavailableReason: copernicusAvail
      ? undefined
      : copernicusConf
        ? `COPERNICUS_MARINE_CONFIG path "${copernicusConf}" not found`
        : 'COPERNICUS_MARINE_CONFIG not set — sign up at https://marine.copernicus.eu/',
    lastCheckedAt: now,
    coverageDescription: 'Wave height, current speed for offshore/coastal feasibility',
    deepCheckRan: false,
  })

  return statuses
}

/** Quick check: is any real solar data source available? */
export function hasSolarDataSource(): boolean {
  return !!env.NREL_API_KEY || !!env.PVGIS_BASE_URL || !!env.GLOBAL_SOLAR_ATLAS_DATA_DIR
}
