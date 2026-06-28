export type StepState = 'pending' | 'running' | 'completed' | 'degraded' | 'failed' | 'skipped'

export interface PipelineStep {
  id: string
  label: string
  state: StepState
  note?: string
}

const STEP_DEFS: Array<{ id: string; label: string }> = [
  { id: 'project_created', label: 'Project created' },
  { id: 'prompt_parsed', label: 'Prompt parsed' },
  { id: 'region_validated', label: 'Supported region validated' },
  { id: 'catalog_loaded', label: 'Dataset catalog loaded' },
  { id: 'candidate_retrieval', label: 'Candidate retrieval' },
  { id: 'evidence_loaded', label: 'Evidence loaded' },
  { id: 'address_enrichment', label: 'Address enrichment' },
  { id: 'model_pipeline', label: 'Model pipeline' },
  { id: 'model_reranking', label: 'Model reranking' },
  { id: 'report_generation', label: 'Report generation' },
  { id: 'evidence_guard', label: 'Evidence guard' },
  { id: 'learning_event', label: 'Learning event logged' },
  { id: 'results_ready', label: 'Results ready' },
]

export function usePipelineSteps() {
  const steps = ref<PipelineStep[]>(
    STEP_DEFS.map((d) => ({ ...d, state: 'pending' as StepState })),
  )

  function reset() {
    steps.value = STEP_DEFS.map((d) => ({ ...d, state: 'pending' as StepState }))
  }

  function startQuery() {
    reset()
    setStep('project_created', 'completed')
    setStep('prompt_parsed', 'running')
  }

  function setStep(id: string, state: StepState, note?: string) {
    const s = steps.value.find((s) => s.id === id)
    if (s) {
      s.state = state
      if (note !== undefined) s.note = note
    }
  }

  function applyBackendSteps(backendSteps: Array<{ id: string; state: string; note?: string }>) {
    for (const bs of backendSteps) {
      setStep(bs.id, bs.state as StepState, bs.note)
    }
  }

  function markRunning() {
    reset()
    setStep('project_created', 'completed')
    setStep('prompt_parsed', 'running')
  }

  function markFailed(stepId?: string) {
    const runningIdx = steps.value.findIndex((s) => s.state === 'running')
    if (runningIdx >= 0) steps.value[runningIdx]!.state = 'failed'
    if (stepId) setStep(stepId, 'failed')
    // Mark remaining as skipped
    steps.value.forEach((s) => { if (s.state === 'pending') s.state = 'skipped' })
  }

  const completedCount = computed(() => steps.value.filter((s) => s.state === 'completed').length)
  const hasFailure = computed(() => steps.value.some((s) => s.state === 'failed'))
  const hasDegraded = computed(() => steps.value.some((s) => s.state === 'degraded'))
  const isComplete = computed(() => steps.value.find((s) => s.id === 'results_ready')?.state === 'completed')

  return {
    steps,
    reset,
    startQuery,
    setStep,
    applyBackendSteps,
    markRunning,
    markFailed,
    completedCount,
    hasFailure,
    hasDegraded,
    isComplete,
  }
}
