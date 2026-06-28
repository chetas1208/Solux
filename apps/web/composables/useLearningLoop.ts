export interface LearningLoopStatus {
  active: boolean
  activePolicyVersion?: string
  scoringPolicyVersion: string
  queryRunsCount: number
  feedbackEventsCount: number
  queryRuns?: Array<Record<string, unknown>>
  feedbackEvents?: Array<Record<string, unknown>>
  metrics?: Record<string, number>
  notes?: string[]
  immutableNote: string
  message: string
}

export function useLearningLoop() {
  const api = useApiClient()
  const status = ref<LearningLoopStatus | null>(null)
  const loading = ref(false)

  async function refresh() {
    loading.value = true
    try {
      status.value = await api.getLearningLoopStatus()
    } finally {
      loading.value = false
    }
  }

  async function submitFeedback(projectId: string, payload: {
    siteId: string
    verdict: 'accepted' | 'rejected' | 'corrected'
    reason?: string
    rating?: number
  }) {
    return api.submitProjectFeedback(projectId, payload)
  }

  return { status, loading, refresh, submitFeedback }
}
