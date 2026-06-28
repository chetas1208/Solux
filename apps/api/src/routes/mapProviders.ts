import { Hono } from 'hono'
import { env } from '../config/env.js'

type ProviderState = 'READY' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED'

interface MapProviderStatus {
  id: string
  name: string
  state: ProviderState
  configured: boolean
  whatWasTested: string[]
  failureReason?: string
  fallback: string
  confidenceImpact: string
  lastCheckedAt: string
}

interface MapProvidersResponse {
  overall: ProviderState
  checkedAt: string
  providers: MapProviderStatus[]
}

let cache: { at: number; data: MapProvidersResponse } | null = null
const CACHE_MS = 60_000

function maskKey(key: string): boolean {
  return key.trim().length >= 8
}

async function probeMapTiler(key: string): Promise<{ ok: boolean; reason?: string }> {
  if (!key) return { ok: false, reason: 'MAPTILER_KEY not configured' }
  try {
    const res = await fetch(
      `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return { ok: false, reason: `MapTiler style HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: String(err) }
  }
}

async function probeCesiumIon(token: string): Promise<{ ok: boolean; reason?: string }> {
  if (!token) return { ok: false, reason: 'CESIUM_ION_TOKEN not configured' }
  try {
    const res = await fetch('https://api.cesium.com/v1/assets/2/endpoint?access_token=' + encodeURIComponent(token), {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { ok: false, reason: `Cesium ion HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: String(err) }
  }
}

async function probeGoogle3DTiles(key: string): Promise<{ ok: boolean; reason?: string }> {
  if (!key) return { ok: false, reason: 'GOOGLE_MAPS_API_KEY not configured' }
  try {
    const url =
      'https://tile.googleapis.com/v1/3dtiles/root.json?key=' + encodeURIComponent(key)
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return { ok: false, reason: `Google 3D Tiles HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: String(err) }
  }
}

function overallState(states: ProviderState[]): ProviderState {
  const hasReady = states.includes('READY')
  const hasDegraded = states.includes('DEGRADED')
  const allUnavailable = states.every((s) => s === 'UNAVAILABLE' || s === 'NOT_CONFIGURED')
  if (allUnavailable) return 'UNAVAILABLE'
  if (hasReady && !hasDegraded) return 'READY'
  if (hasReady || hasDegraded) return 'DEGRADED'
  return 'UNAVAILABLE'
}

function resolveMapKeys() {
  const cesiumToken =
    env.CESIUM_ION_TOKEN || process.env['NUXT_PUBLIC_CESIUM_ION_TOKEN'] || ''
  const maptilerKey = env.MAPTILER_KEY || process.env['NUXT_PUBLIC_MAPTILER_KEY'] || ''
  const googleKey =
    env.GOOGLE_MAPS_API_KEY || process.env['NUXT_PUBLIC_GOOGLE_MAPS_API_KEY'] || ''
  const google3dEnabled =
    env.GOOGLE_3D_TILES_ENABLED ||
    process.env['NUXT_PUBLIC_GOOGLE_3D_TILES_ENABLED'] === 'true'
  return { cesiumToken, maptilerKey, googleKey, google3dEnabled }
}

async function buildStatus(): Promise<MapProvidersResponse> {
  const checkedAt = new Date().toISOString()
  const { cesiumToken, maptilerKey, googleKey, google3dEnabled } = resolveMapKeys()

  const ionProbe = await probeCesiumIon(cesiumToken)
  const maptilerProbe = await probeMapTiler(maptilerKey)
  const google3dProbe =
    google3dEnabled && googleKey ? await probeGoogle3DTiles(googleKey) : { ok: false, reason: 'Disabled or key missing' }

  const providers: MapProviderStatus[] = [
    {
      id: 'cesium',
      name: 'CesiumJS',
      state: 'READY',
      configured: true,
      whatWasTested: ['runtime (frontend)', 'webgl (frontend)'],
      fallback: 'MapLibre + MapTiler',
      confidenceImpact: 'Visualization only — scoring unaffected.',
      lastCheckedAt: checkedAt,
    },
    {
      id: 'cesium_ion',
      name: 'Cesium ion',
      state: !cesiumToken ? 'NOT_CONFIGURED' : ionProbe.ok ? 'READY' : 'UNAVAILABLE',
      configured: maskKey(cesiumToken),
      whatWasTested: cesiumToken
        ? ['CESIUM_ION_TOKEN or NUXT_PUBLIC_CESIUM_ION_TOKEN', 'ion asset endpoint']
        : ['CESIUM_ION_TOKEN or NUXT_PUBLIC_CESIUM_ION_TOKEN'],
      failureReason: cesiumToken && !ionProbe.ok ? ionProbe.reason : undefined,
      fallback: 'MapLibre + MapTiler or OpenStreetMap imagery',
      confidenceImpact: 'Visual realism reduced; scoring unaffected.',
      lastCheckedAt: checkedAt,
    },
    {
      id: 'google_3d_tiles',
      name: 'Google Photorealistic 3D Tiles',
      state: !googleKey
        ? 'NOT_CONFIGURED'
        : !google3dEnabled
          ? 'NOT_CONFIGURED'
          : google3dProbe.ok
            ? 'READY'
            : 'UNAVAILABLE',
      configured: maskKey(googleKey) && google3dEnabled,
      whatWasTested: googleKey && google3dEnabled ? ['GOOGLE_MAPS_API_KEY', 'root tileset'] : ['GOOGLE_MAPS_API_KEY', 'GOOGLE_3D_TILES_ENABLED'],
      failureReason:
        googleKey && google3dEnabled && !google3dProbe.ok ? google3dProbe.reason : undefined,
      fallback: 'Cesium ion terrain + imagery',
      confidenceImpact: 'Visual realism reduced; scoring unaffected.',
      lastCheckedAt: checkedAt,
    },
    {
      id: 'google_maps_js',
      name: 'Google Maps JavaScript API',
      state: googleKey ? 'READY' : 'NOT_CONFIGURED',
      configured: maskKey(googleKey),
      whatWasTested: ['GOOGLE_MAPS_API_KEY presence'],
      failureReason: googleKey ? undefined : 'Key not set on backend',
      fallback: 'CesiumJS globe without Google layers',
      confidenceImpact: 'None — visualization only.',
      lastCheckedAt: checkedAt,
    },
    {
      id: 'maptiler',
      name: 'MapTiler',
      state: !maptilerKey ? 'NOT_CONFIGURED' : maptilerProbe.ok ? 'READY' : 'UNAVAILABLE',
      configured: maskKey(maptilerKey),
      whatWasTested: maptilerKey
        ? ['MAPTILER_KEY or NUXT_PUBLIC_MAPTILER_KEY', 'style.json request']
        : ['MAPTILER_KEY or NUXT_PUBLIC_MAPTILER_KEY'],
      failureReason: maptilerKey && !maptilerProbe.ok ? maptilerProbe.reason : undefined,
      fallback: 'Cesium default imagery',
      confidenceImpact: '2D fallback basemap unavailable if Cesium also fails.',
      lastCheckedAt: checkedAt,
    },
    {
      id: 'maplibre',
      name: 'MapLibre fallback',
      state: 'READY',
      configured: true,
      whatWasTested: ['runtime (frontend bundle)'],
      fallback: 'Table and report-only mode',
      confidenceImpact: 'Visualization only — screening results remain available.',
      lastCheckedAt: checkedAt,
    },
  ]

  const vizStates = providers
    .filter((p) => p.id !== 'cesium')
    .map((p) => p.state)

  return {
    overall: overallState(vizStates),
    checkedAt,
    providers,
  }
}

export const mapProvidersRouter = new Hono()

mapProvidersRouter.get('/status', async (c) => {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) {
    return c.json({ data: cache.data })
  }
  const data = await buildStatus()
  cache = { at: now, data }
  return c.json({ data })
})
