import type { DataSourceStatus } from '@solux/shared'
import type { CapabilityItem, CapabilityState } from '~/types/ui'
import { ApiClientError } from '~/composables/useApiClient'

function mapSourceState(source: DataSourceStatus): CapabilityState {
  if (source.available) return 'READY'
  if (source.unavailableReason?.includes('not set')) return 'NOT_CONFIGURED'
  return 'UNAVAILABLE'
}

export function useDataSources() {
  const api = useApiClient()
  const sources = ref<DataSourceStatus[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const offline = ref(false)
  const lastFetched = ref<string | null>(null)

  async function fetchSources(deep = false): Promise<DataSourceStatus[]> {
    loading.value = true
    error.value = null
    offline.value = false
    try {
      sources.value = await api.getDataSources(deep)
      lastFetched.value = new Date().toISOString()
      return sources.value
    } catch (err) {
      if (err instanceof ApiClientError) {
        error.value = err.message
        offline.value = err.offline
      } else {
        error.value = String(err)
      }
      return []
    } finally {
      loading.value = false
    }
  }

  function sourceById(id: string): DataSourceStatus | undefined {
    return sources.value.find((s) => s.id === id)
  }

  function toCapability(source: DataSourceStatus): CapabilityItem {
    const state = mapSourceState(source)
    const impact =
      state === 'READY'
        ? 'Full confidence for layers backed by this source.'
        : state === 'NOT_CONFIGURED'
          ? 'Capability disabled until configured on backend.'
          : 'Confidence reduced because this layer is unavailable.'

    return {
      id: source.id,
      name: source.label,
      group: 'data_coverage',
      state,
      whyItMatters: source.coverageDescription ?? 'Data source for screening layers.',
      lastCheckedAt: source.lastCheckedAt,
      confidenceImpact: impact,
      fallbackBehavior:
        state === 'READY'
          ? 'Primary source active.'
          : source.id === 'nrel_nsrdb'
            ? 'PVGIS fallback may be active for non-US sites.'
            : 'Layer omitted or scored with reduced confidence.',
      actionNeeded: source.unavailableReason,
    }
  }

  return { sources, loading, error, offline, lastFetched, fetchSources, sourceById, toCapability }
}
