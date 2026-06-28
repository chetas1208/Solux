import type { ProjectSpec } from '~/types/api'
import { ApiClientError } from '~/composables/useApiClient'

export function useProjectPrompt() {
  const api = useApiClient()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const spec = ref<ProjectSpec | null>(null)
  const traceId = ref<string | null>(null)

  async function parsePrompt(projectId: string): Promise<ProjectSpec | null> {
    loading.value = true
    error.value = null
    try {
      const result = await api.parsePrompt(projectId)
      spec.value = result.spec
      traceId.value = result.traceId
      return result.spec
    } catch (err) {
      if (err instanceof ApiClientError) {
        error.value = err.detail ? `${err.message}: ${err.detail}` : err.message
      } else {
        error.value = String(err)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, spec, traceId, parsePrompt }
}
