import type { SiteWithScore } from '~/types/api'
import type { GlobeSceneState } from '~/types/earth'
import { GLOBE_MAX_SITES } from '~/types/earth'

const DECISION_COLORS: Record<string, string> = {
  GO: '#16a34a',
  INVESTIGATE: '#ca8a04',
  KILL: '#dc2626',
}

export function useCesiumGlobe() {
  const config = useRuntimeConfig()
  const scene = ref<GlobeSceneState>({
    ready: false,
    loading: false,
    error: null,
    provider: 'unavailable',
    webglAvailable: false,
    sitesRendered: 0,
    sitesTotal: 0,
  })

  const canUseCesium = computed(() => {
    if (!config.public.enable3dEarth) return false
    if ((config.public.mapProvider as string) !== 'cesium') return false
    return true
  })

  function sitesForGlobe(sites: SiteWithScore[]): SiteWithScore[] {
    const sorted = [...sites].sort(
      (a, b) => (b.scoreBreakdown?.finalScore ?? 0) - (a.scoreBreakdown?.finalScore ?? 0),
    )
    return sorted.slice(0, GLOBE_MAX_SITES)
  }

  function decisionColor(decision?: string): string {
    return DECISION_COLORS[decision ?? ''] ?? '#71717a'
  }

  return { scene, canUseCesium, sitesForGlobe, decisionColor, DECISION_COLORS }
}
