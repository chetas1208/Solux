import type { SiteWithScore } from './api'

export interface GlobeCameraTarget {
  longitude: number
  latitude: number
  height?: number
  heading?: number
  pitch?: number
}

export interface GlobeSiteFeature {
  siteId: string
  name: string
  decision: string
  score: number
  confidence: number
  siteType: string
  topFatalFlaw?: string
  topPositive?: string
}

export interface GlobeHoverPayload {
  site: SiteWithScore
  screenX: number
  screenY: number
}

export interface GlobeSceneState {
  ready: boolean
  loading: boolean
  error: string | null
  provider: 'cesium' | 'maplibre' | 'unavailable'
  webglAvailable: boolean
  sitesRendered: number
  sitesTotal: number
}

export const GLOBE_MAX_SITES = 200
