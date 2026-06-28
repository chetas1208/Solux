<script setup lang="ts">
import type { PipelineStep } from '~/composables/usePipelineSteps'

const props = defineProps<{
  projectId: string
  pipelineSteps?: PipelineStep[]
}>()

const tab = ref<'pipeline' | 'evidence' | 'sources' | 'model' | 'learning' | 'diagnostics'>('pipeline')
const open = ref(false)

const { sources, fetchSources } = useDataSources()
const { status: modelStatus, refresh: refreshModel } = useModelOutputs()
const { status: learningStatus, refresh: refreshLearning } = useLearningLoop()

onMounted(async () => {
  await Promise.all([fetchSources(false), refreshModel(), refreshLearning()])
})

const tabs = [
  { id: 'pipeline' as const, label: 'Pipeline' },
  { id: 'evidence' as const, label: 'Evidence' },
  { id: 'sources' as const, label: 'Data Sources' },
  { id: 'model' as const, label: 'Model Analysis' },
  { id: 'learning' as const, label: 'Learning Loop' },
  { id: 'diagnostics' as const, label: 'Diagnostics' },
]

const stepSummary = computed(() => {
  if (!props.pipelineSteps?.length) return null
  const done = props.pipelineSteps.filter((s) => s.state === 'completed').length
  const total = props.pipelineSteps.length
  const failed = props.pipelineSteps.some((s) => s.state === 'failed')
  const degraded = props.pipelineSteps.some((s) => s.state === 'degraded')
  return { done, total, failed, degraded }
})
</script>

<template>
  <div class="border-t border-surface-border bg-surface-raised">
    <button
      type="button"
      class="w-full px-4 py-2 flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200"
      @click="open = !open"
    >
      <div class="flex items-center gap-2">
        <span>Evidence · Model Pipeline · Data Sources · Learning Loop</span>
        <span
          v-if="stepSummary"
          class="text-[10px] font-mono px-1.5 py-0.5 rounded"
          :class="stepSummary.failed ? 'text-red-400 bg-red-950/40' : stepSummary.degraded ? 'text-amber-400 bg-amber-950/40' : 'text-emerald-500 bg-emerald-950/40'"
        >
          {{ stepSummary.done }}/{{ stepSummary.total }}
        </span>
      </div>
      <span>{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="max-h-[45vh] flex flex-col">
      <div class="flex gap-1 px-3 py-2 border-b border-surface-border overflow-x-auto shrink-0">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors shrink-0"
          :class="tab === t.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 text-xs">
        <!-- Pipeline -->
        <template v-if="tab === 'pipeline'">
          <div v-if="pipelineSteps?.length">
            <ProjectPipelineStepMonitor :steps="pipelineSteps" />
          </div>
          <div v-else class="data-degraded">
            Submit a query to see pipeline step states.
          </div>
          <p class="text-zinc-600 mt-3 text-[10px]">
            Model endpoint failure degrades gracefully — deterministic scoring remains active.
          </p>
        </template>

        <!-- Evidence -->
        <template v-else-if="tab === 'evidence'">
          <NuxtLink :to="`/projects/${projectId}/evidence`" class="text-zinc-300 hover:underline">
            Open full evidence trace →
          </NuxtLink>
          <p class="text-zinc-500 mt-2">Every recommendation is grounded in retrieved evidence. Unsupported claims are blocked by the evidence guard.</p>
        </template>

        <!-- Data Sources -->
        <template v-else-if="tab === 'sources'">
          <ul class="space-y-1.5">
            <li v-for="s in sources" :key="s.id" class="flex items-center justify-between text-zinc-400">
              <span>{{ s.label }}</span>
              <UiBadge
                :label="s.available ? 'READY' : 'UNAVAILABLE'"
                variant="status"
                :state="s.available ? 'READY' : 'UNAVAILABLE'"
              />
            </li>
          </ul>
          <p v-if="!sources.length" class="data-degraded">Loading data source states…</p>
        </template>

        <!-- Model Analysis -->
        <template v-else-if="tab === 'model'">
          <p class="text-zinc-300 mb-3">{{ modelStatus?.message }}</p>
          <dl class="grid grid-cols-2 gap-2 text-zinc-500">
            <dt>Endpoint reachable</dt>
            <dd :class="modelStatus?.modelEndpointReachable ? 'status-ready' : 'status-degraded'">
              {{ modelStatus?.modelEndpointReachable ? 'Yes' : 'No' }}
            </dd>
            <dt>Outputs available</dt>
            <dd>{{ modelStatus?.outputsAvailable ? 'Yes' : 'No' }}</dd>
            <dt>Candidates analyzed</dt>
            <dd>{{ modelStatus?.candidateCount ?? 0 }}</dd>
            <dt>Last run</dt>
            <dd class="font-mono text-[10px]">{{ modelStatus?.lastRun ?? '—' }}</dd>
          </dl>
          <p v-if="!modelStatus?.modelEndpointReachable" class="data-degraded mt-3">
            Model reranking unavailable; deterministic evidence scoring active.
          </p>
        </template>

        <!-- Learning Loop -->
        <template v-else-if="tab === 'learning'">
          <p class="text-zinc-300 mb-3">{{ learningStatus?.message }}</p>
          <dl class="grid grid-cols-2 gap-2 text-zinc-500">
            <dt>Policy version</dt>
            <dd class="font-mono">{{ learningStatus?.activePolicyVersion ?? learningStatus?.scoringPolicyVersion }}</dd>
            <dt>Query runs</dt>
            <dd>{{ learningStatus?.queryRunsCount ?? learningStatus?.metrics?.queryRunCount ?? 0 }}</dd>
            <dt>Feedback events</dt>
            <dd>{{ learningStatus?.feedbackEventsCount ?? 0 }}</dd>
          </dl>
          <div v-if="learningStatus?.queryRuns?.length" class="mt-3">
            <p class="text-zinc-400 mb-1">Recent query runs</p>
            <ul class="space-y-1 font-mono text-[10px] text-zinc-500">
              <li v-for="(q, i) in learningStatus.queryRuns.slice(0, 5)" :key="i">
                {{ q.queryId ?? q._id }} — {{ q.state ?? 'completed' }}
              </li>
            </ul>
          </div>
          <ul v-if="learningStatus?.notes?.length" class="mt-3 text-[10px] text-zinc-600 space-y-1">
            <li v-for="(n, i) in learningStatus.notes" :key="i">{{ n }}</li>
          </ul>
          <p class="data-degraded mt-3">
            {{ learningStatus?.immutableNote ?? 'Raw evidence is immutable. Learning adjusts ranking policy, not source data.' }}
          </p>
        </template>

        <!-- Diagnostics -->
        <template v-else>
          <NuxtLink to="/diagnostics/maps" class="text-zinc-300 hover:underline">
            Map provider diagnostics →
          </NuxtLink>
          <p class="text-zinc-500 mt-2">Visualization degraded states do not affect scoring or evidence.</p>
        </template>
      </div>
    </div>
  </div>
</template>
