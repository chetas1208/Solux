import { existsSync } from 'fs'
import { env } from '../config/env.js'
import type { DataSourceStatus } from '@solux/shared'

/**
 * Returns current availability for all data sources AND AI services.
 * Pass `deep=true` to make lightweight API probe calls (PVGIS ping, OSM ping, Gemini ping).
 */
export async function getDataSourceStatuses(deep = false): Promise<DataSourceStatus[]> {
  const now = new Date().toISOString()
  const statuses: DataSourceStatus[] = []

  // ─── AI SERVICES ───────────────────────────────────────────────────────────

  // Gemini
  const geminiConfigured = !!env.GEMINI_API_KEY
  let geminiAvailable = geminiConfigured
  let geminiReason: string | undefined
  if (!geminiConfigured) {
    geminiReason = 'GEMINI_API_KEY not set — get a key at https://aistudio.google.com/apikey'
  } else if (deep) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`,
        { signal: AbortSignal.timeout(6000) },
      )
      geminiAvailable = res.ok
      if (!res.ok) geminiReason = `Gemini API returned HTTP ${res.status}`
    } catch (err) {
      geminiAvailable = false
      geminiReason = `Gemini unreachable: ${String(err).slice(0, 100)}`
    }
  }
  statuses.push({
    id: 'gemini',
    label: 'Gemini (Prompt parsing & Reports)',
    available: geminiAvailable,
    unavailableReason: geminiReason,
    lastCheckedAt: now,
    coverageDescription: 'Prompt parsing, report generation, claim verification',
    deepCheckRan: deep && geminiConfigured,
  })

  // MiniMax
  const minimaxAvail = !!env.MINIMAX_API_KEY && !!env.MINIMAX_GROUP_ID
  statuses.push({
    id: 'minimax',
    label: 'MiniMax (Voice Briefing)',
    available: minimaxAvail,
    unavailableReason: minimaxAvail
      ? undefined
      : !env.MINIMAX_API_KEY
        ? 'MINIMAX_API_KEY not set — sign up at https://www.minimaxi.com/'
        : 'MINIMAX_GROUP_ID not set',
    lastCheckedAt: now,
    coverageDescription: 'Optional 60-second spoken executive briefing',
    deepCheckRan: false,
  })

  // Mojo scoring kernel
  const mojoConfigured = !!env.MOJO_SCORE_KERNEL_BIN
  const mojoAvail = mojoConfigured && existsSync(env.MOJO_SCORE_KERNEL_BIN)
  statuses.push({
    id: 'mojo_kernel',
    label: 'Mojo Scoring Kernel',
    available: mojoAvail,
    unavailableReason: mojoAvail
      ? undefined
      : mojoConfigured
        ? `Mojo binary not found at "${env.MOJO_SCORE_KERNEL_BIN}"`
        : 'MOJO_SCORE_KERNEL_BIN not set — TypeScript scoring active',
    lastCheckedAt: now,
    coverageDescription: 'High-performance scoring kernel (optional — TS fallback always active)',
    deepCheckRan: false,
  })

  // ─── SOLAR DATA ────────────────────────────────────────────────────────────

  // NREL NSRDB
  statuses.push({
    id: 'nrel_nsrdb',
    label: 'NREL NSRDB (US Solar)',
    available: !!env.NREL_API_KEY,
    unavailableReason: env.NREL_API_KEY
      ? undefined
      : 'NREL_API_KEY not set — sign up free at https://developer.nrel.gov/signup/',
    lastCheckedAt: now,
    coverageDescription: 'USA solar irradiance TMY and historical at hourly resolution',
    deepCheckRan: false,
  })

  // PVGIS
  let pvgisAvailable = true
  let pvgisReason: string | undefined
  if (deep) {
    try {
      const res = await fetch(
        `${env.PVGIS_BASE_URL}/PVcalc?outputformat=json&lat=23&lon=72&peakpower=1&loss=14`,
        { signal: AbortSignal.timeout(10000) },
      )
      pvgisAvailable = res.ok
      if (!res.ok) pvgisReason = `PVGIS returned HTTP ${res.status}`
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

  // OpenStreetMap Overpass — use interpreter with tiny query, more reliable than /status
  let osmAvailable = true
  let osmReason: string | undefined
  if (deep) {
    try {
      const res = await fetch(
        'https://overpass-api.de/api/interpreter?data=[out:json][timeout:3];node(51.5,-0.1,51.51,-0.09);out%20count;',
        { signal: AbortSignal.timeout(8000) },
      )
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

  // ─── LOCAL RASTER DATA ─────────────────────────────────────────────────────

  const gsaDir = env.GLOBAL_SOLAR_ATLAS_DATA_DIR
  const gsaAvail = !!gsaDir && existsSync(gsaDir)
  statuses.push({
    id: 'global_solar_atlas',
    label: 'Global Solar Atlas (GHI Raster)',
    available: gsaAvail,
    unavailableReason: gsaAvail
      ? undefined
      : gsaDir
        ? `GLOBAL_SOLAR_ATLAS_DATA_DIR "${gsaDir}" not found on disk`
        : 'GLOBAL_SOLAR_ATLAS_DATA_DIR not set — download from https://globalsolaratlas.info/download',
    lastCheckedAt: now,
    coverageDescription: 'Global GHI raster at 1 km resolution — local GeoTIFF required',
    deepCheckRan: false,
  })

  const pvdbDir = env.USPVDB_DATA_DIR
  const pvdbAvail = !!pvdbDir && existsSync(pvdbDir)
  statuses.push({
    id: 'uspvdb',
    label: 'US PVDB (Utility PV Database)',
    available: pvdbAvail,
    unavailableReason: pvdbAvail
      ? undefined
      : pvdbDir
        ? `USPVDB_DATA_DIR "${pvdbDir}" not found`
        : 'USPVDB_DATA_DIR not set — download from https://eerscmap.usgs.gov/uspvdb/',
    lastCheckedAt: now,
    coverageDescription: 'US utility-scale PV plant locations and specs',
    deepCheckRan: false,
  })

  const gebcoDir = env.GEBCO_DATA_DIR
  const gebcoAvail = !!gebcoDir && existsSync(gebcoDir)
  statuses.push({
    id: 'gebco',
    label: 'GEBCO (Bathymetry)',
    available: gebcoAvail,
    unavailableReason: gebcoAvail
      ? undefined
      : gebcoDir
        ? `GEBCO_DATA_DIR "${gebcoDir}" not found`
        : 'GEBCO_DATA_DIR not set — download from https://www.gebco.net/data_and_products/gridded_bathymetry_data/',
    lastCheckedAt: now,
    coverageDescription: 'Global ocean/lake bathymetry — local raster required for water sites',
    deepCheckRan: false,
  })

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
    coverageDescription: 'Wave height, current speed for offshore/coastal site assessment',
    deepCheckRan: false,
  })

  return statuses
}

export function hasSolarDataSource(): boolean {
  return !!env.NREL_API_KEY || !!env.PVGIS_BASE_URL || !!env.GLOBAL_SOLAR_ATLAS_DATA_DIR
}
