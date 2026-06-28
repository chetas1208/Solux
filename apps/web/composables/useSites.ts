import type { SiteWithScore, SiteDetail } from '~/types/api'
import { ApiClientError } from '~/composables/useApiClient'

export function useSites() {
  const api = useApiClient()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function listRankedSites(projectId: string): Promise<SiteWithScore[]> {
    loading.value = true
    error.value = null
    try {
      const sites = await api.getProjectSites(projectId)
      return [...sites].sort((a, b) => {
        const sa = a.scoreBreakdown?.finalScore ?? -1
        const sb = b.scoreBreakdown?.finalScore ?? -1
        return sb - sa
      })
    } catch (err) {
      if (err instanceof ApiClientError) error.value = err.message
      else error.value = String(err)
      return []
    } finally {
      loading.value = false
    }
  }

  async function getSiteDetail(siteId: string): Promise<SiteDetail | null> {
    loading.value = true
    error.value = null
    try {
      return await api.getSite(siteId)
    } catch (err) {
      if (err instanceof ApiClientError) error.value = err.message
      else error.value = String(err)
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, listRankedSites, getSiteDetail }
}
