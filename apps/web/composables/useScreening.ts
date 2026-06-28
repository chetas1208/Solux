import type { ScreeningResult, SiteWithScore } from '~/types/api'
import { ApiClientError } from '~/composables/useApiClient'

export type ScreeningState = 'idle' | 'running' | 'completed' | 'error'

export function useScreening() {
  const api = useApiClient()
  const state = ref<ScreeningState>('idle')
  const error = ref<string | null>(null)
  const result = ref<ScreeningResult | null>(null)
  const sites = ref<SiteWithScore[]>([])
  const warnings = ref<string[]>([])

  async function startScreening(projectId: string): Promise<boolean> {
    state.value = 'running'
    error.value = null
    warnings.value = []
    try {
      const screening = await api.runScreening(projectId)
      result.value = screening
      warnings.value = screening.errors
      sites.value = await api.getProjectSites(projectId)
      state.value = 'completed'
      return true
    } catch (err) {
      state.value = 'error'
      if (err instanceof ApiClientError) {
        error.value = err.detail ? `${err.message}: ${err.detail}` : err.message
      } else {
        error.value = String(err)
      }
      return false
    }
  }

  async function loadSites(projectId: string): Promise<void> {
    try {
      sites.value = await api.getProjectSites(projectId)
      if (sites.value.length) state.value = 'completed'
    } catch {
      // keep prior state
    }
  }

  return { state, error, result, sites, warnings, startScreening, loadSites }
}
