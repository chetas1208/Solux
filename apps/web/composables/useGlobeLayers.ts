import type { MapLayerConfig } from '~/types/ui'
import type { GlobeLayerAvailability } from '~/types/map'
import type { CapabilityState } from '~/types/ui'

export function useGlobeLayers(layers: Ref<MapLayerConfig[]>) {
  const globeLayers = computed<GlobeLayerAvailability[]>(() =>
    layers.value.map((l) => ({
      id: l.id,
      label: l.label,
      state: layerState(l),
      sourceName: l.sourceName,
      confidenceImpact: l.confidenceImpact,
      fallbackBehavior: l.available
        ? 'Layer renders from backend data when enabled.'
        : 'Hidden — no configured source returned data for this layer.',
      enabled: l.enabled,
    })),
  )

  function layerState(l: MapLayerConfig): CapabilityState {
    if (!l.available) return 'UNAVAILABLE'
    if (l.degraded) return 'DEGRADED'
    return 'READY'
  }

  return { globeLayers }
}
