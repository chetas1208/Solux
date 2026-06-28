import type { MapProviderMode } from '~/types/map'

export function useMapFallback() {
  const config = useRuntimeConfig()
  const { canUseCesium } = useCesiumGlobe()
  const { webglAvailable } = useMapProviderHealth()

  const activeProvider = computed<MapProviderMode>(() => {
    if (import.meta.server) return 'table'
    if (canUseCesium.value && webglAvailable()) return 'cesium'
    const maptilerKey = config.public.maptilerKey as string
    if (maptilerKey && (config.public.mapFallback as string) === 'maplibre') return 'maplibre'
    return 'table'
  })

  const degradedMessage = computed(() => {
    switch (activeProvider.value) {
      case 'cesium':
        return null
      case 'maplibre':
        return '3D Earth unavailable. Using 2D MapLibre fallback — scoring unaffected.'
      default:
        return '3D map unavailable. Screening results and evidence remain available.'
    }
  })

  const hasMaptiler = computed(() => !!(config.public.maptilerKey as string))
  const hasCesiumToken = computed(() => !!(config.public.cesiumIonToken as string))
  const hasGoogleKey = computed(() => !!(config.public.googleMapsApiKey as string))
  const google3dEnabled = computed(() => config.public.google3dTilesEnabled === true)

  return {
    activeProvider,
    degradedMessage,
    hasMaptiler,
    hasCesiumToken,
    hasGoogleKey,
    google3dEnabled,
  }
}
