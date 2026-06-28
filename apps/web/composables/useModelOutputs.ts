export interface ModelOutputStatus {
  outputsAvailable: boolean
  lastRun: string | null
  candidateCount: number
  modelEndpointReachable: boolean
  modelUsed: boolean
  message: string
}

export function useModelOutputs() {
  const api = useApiClient()
  const status = ref<ModelOutputStatus | null>(null)
  const loading = ref(false)

  async function refresh() {
    loading.value = true
    try {
      status.value = await api.getModelOutputStatus()
    } finally {
      loading.value = false
    }
  }

  return { status, loading, refresh }
}
