import type { CapabilityState } from './ui'

export type MapProviderId =
  | 'cesium'
  | 'cesium_ion'
  | 'google_3d_tiles'
  | 'google_maps_js'
  | 'maptiler'
  | 'maplibre'

export interface MapProviderStatus {
  id: MapProviderId
  name: string
  state: CapabilityState
  configured: boolean
  whatWasTested: string[]
  failureReason?: string
  fallback: string
  confidenceImpact: string
  lastCheckedAt: string
}

export interface MapProvidersResponse {
  overall: CapabilityState
  checkedAt: string
  providers: MapProviderStatus[]
}

export type MapProviderMode = 'cesium' | 'maplibre' | 'table'

export interface MapRuntimeConfig {
  provider: MapProviderMode
  enable3dEarth: boolean
  cesiumIonToken: string
  googleMapsApiKey: string
  google3dTilesEnabled: boolean
  maptilerKey: string
  fallback: MapProviderMode
}

export interface GlobeLayerAvailability {
  id: string
  label: string
  state: CapabilityState
  sourceName?: string
  confidenceImpact: string
  fallbackBehavior: string
  enabled: boolean
}
