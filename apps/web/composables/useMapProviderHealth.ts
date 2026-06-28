import type { MapProvidersResponse } from '~/types/map'
import type { ClientMapProbe, MapDiagnosticsSnapshot } from '~/types/diagnostics'
import type { CapabilityState } from '~/types/ui'
import { ApiClientError } from '~/composables/useApiClient'

const CACHE_MS = 60_000
let clientCache: { at: number; snapshot: MapDiagnosticsSnapshot } | null = null

function mapReadinessOverall(
  client: ClientMapProbe[],
  backend: MapProvidersResponse | null,
): CapabilityState {
  const cesiumClient = client.find((c) => c.id === 'cesium_client')
  const maplibreClient = client.find((c) => c.id === 'maplibre_client')
  const maptilerClient = client.find((c) => c.id === 'maptiler_client')

  if (cesiumClient?.state === 'READY') {
    const ion = backend?.providers.find((p) => p.id === 'cesium_ion')
    return ion?.state === 'READY' ? 'READY' : 'DEGRADED'
  }
  if (maplibreClient?.state === 'READY' && maptilerClient?.state === 'READY') return 'DEGRADED'
  if (maplibreClient?.state === 'READY') return 'DEGRADED'
  return backend?.overall ?? 'UNAVAILABLE'
}

function webglAvailable(): boolean {
  if (import.meta.server) return false
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('webgl2'))
  } catch {
    return false
  }
}

export function useMapProviderHealth() {
  const config = useRuntimeConfig()
  const api = useApiClient()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const snapshot = ref<MapDiagnosticsSnapshot>({
    backend: null,
    client: [],
    overall: 'UNKNOWN',
    checkedAt: '',
    loading: false,
    error: null,
  })

  async function probeMapTilerStyle(key: string): Promise<ClientMapProbe> {
    const checkedAt = new Date().toISOString()
    if (!key) {
      return {
        id: 'maptiler_client',
        name: 'MapTiler (client)',
        state: 'NOT_CONFIGURED',
        configured: false,
        whatWasTested: ['NUXT_PUBLIC_MAPTILER_KEY'],
        lastCheckedAt: checkedAt,
      }
    }
    try {
      const res = await fetch(
        `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(8000) },
      )
      return {
        id: 'maptiler_client',
        name: 'MapTiler (client)',
        state: res.ok ? 'READY' : 'UNAVAILABLE',
        configured: true,
        whatWasTested: ['style.json fetch'],
        failureReason: res.ok ? undefined : `HTTP ${res.status}`,
        lastCheckedAt: checkedAt,
      }
    } catch (err) {
      return {
        id: 'maptiler_client',
        name: 'MapTiler (client)',
        state: 'UNAVAILABLE',
        configured: true,
        whatWasTested: ['style.json fetch'],
        failureReason: String(err),
        lastCheckedAt: checkedAt,
      }
    }
  }

  async function probeCesiumRuntime(): Promise<ClientMapProbe> {
    const checkedAt = new Date().toISOString()
    const hasWebgl = webglAvailable()
    const token = config.public.cesiumIonToken as string
    if (!hasWebgl) {
      return {
        id: 'cesium_client',
        name: 'CesiumJS (client)',
        state: 'UNAVAILABLE',
        configured: !!token,
        whatWasTested: ['WebGL', 'NUXT_PUBLIC_CESIUM_ION_TOKEN'],
        failureReason: 'WebGL unavailable in this browser',
        lastCheckedAt: checkedAt,
      }
    }
    try {
      await loadCesium()
      return {
        id: 'cesium_client',
        name: 'CesiumJS (client)',
        state: token ? 'READY' : 'DEGRADED',
        configured: !!token,
        whatWasTested: ['module load', 'WebGL', 'NUXT_PUBLIC_CESIUM_ION_TOKEN'],
        failureReason: token ? undefined : 'Cesium ion token missing — default imagery may be limited',
        lastCheckedAt: checkedAt,
      }
    } catch (err) {
      return {
        id: 'cesium_client',
        name: 'CesiumJS (client)',
        state: 'UNAVAILABLE',
        configured: !!token,
        whatWasTested: ['module load', 'WebGL'],
        failureReason: String(err),
        lastCheckedAt: checkedAt,
      }
    }
  }

  async function probeMapLibreRuntime(): Promise<ClientMapProbe> {
    const checkedAt = new Date().toISOString()
    try {
      await import('maplibre-gl')
      return {
        id: 'maplibre_client',
        name: 'MapLibre (client)',
        state: 'READY',
        configured: true,
        whatWasTested: ['module load'],
        lastCheckedAt: checkedAt,
      }
    } catch (err) {
      return {
        id: 'maplibre_client',
        name: 'MapLibre (client)',
        state: 'UNAVAILABLE',
        configured: true,
        whatWasTested: ['module load'],
        failureReason: String(err),
        lastCheckedAt: checkedAt,
      }
    }
  }

  async function refresh(force = false): Promise<MapDiagnosticsSnapshot> {
    const now = Date.now()
    if (!force && clientCache && now - clientCache.at < CACHE_MS) {
      snapshot.value = clientCache.snapshot
      return snapshot.value
    }

    loading.value = true
    error.value = null
    const checkedAt = new Date().toISOString()

    let backend: MapProvidersResponse | null = null
    try {
      backend = await api.getMapProvidersStatus()
    } catch (err) {
      if (err instanceof ApiClientError) error.value = err.message
      else error.value = String(err)
    }

    const client = import.meta.client
      ? await Promise.all([
          probeCesiumRuntime(),
          probeMapTilerStyle(config.public.maptilerKey as string),
          probeMapLibreRuntime(),
        ])
      : []

    snapshot.value = {
      backend,
      client,
      overall: mapReadinessOverall(client, backend),
      checkedAt,
      loading: false,
      error: error.value,
    }
    clientCache = { at: now, snapshot: snapshot.value }
    loading.value = false
    return snapshot.value
  }

  const mapReadinessLabel = computed(() => {
    switch (snapshot.value.overall) {
      case 'READY':
        return 'Map visualization ready'
      case 'DEGRADED':
        return 'Visualization degraded; scoring unaffected'
      case 'NOT_CONFIGURED':
        return 'Map providers not fully configured'
      default:
        return '3D map unavailable — reports remain available'
    }
  })

  return { loading, error, snapshot, mapReadinessLabel, refresh, webglAvailable }
}
