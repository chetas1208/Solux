import type { ProjectBrief, ProjectDetail } from '~/types/api'
import { ApiClientError } from '~/composables/useApiClient'

export function useProjects() {
  const api = useApiClient()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const offline = ref(false)

  function handleError(err: unknown) {
    if (err instanceof ApiClientError) {
      error.value = err.detail ? `${err.message}: ${err.detail}` : err.message
      offline.value = err.offline
    } else {
      error.value = String(err)
      offline.value = false
    }
  }

  async function createProject(rawPrompt: string): Promise<ProjectBrief | null> {
    loading.value = true
    error.value = null
    offline.value = false
    try {
      return await api.createProject(rawPrompt)
    } catch (err) {
      handleError(err)
      return null
    } finally {
      loading.value = false
    }
  }

  async function listProjects(): Promise<ProjectBrief[]> {
    loading.value = true
    error.value = null
    offline.value = false
    try {
      return await api.listProjects()
    } catch (err) {
      handleError(err)
      return []
    } finally {
      loading.value = false
    }
  }

  async function getProject(id: string): Promise<ProjectDetail | null> {
    loading.value = true
    error.value = null
    offline.value = false
    try {
      return await api.getProject(id)
    } catch (err) {
      handleError(err)
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, offline, createProject, listProjects, getProject }
}
