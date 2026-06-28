<script setup lang="ts">
const props = defineProps<{
  projectId: string
  evidenceCount?: number
}>()

const tab = ref<'evidence' | 'sources' | 'model' | 'learning' | 'diagnostics'>('evidence')
const open = ref(false)

const { sources, fetchSources } = useDataSources()
const { status: modelStatus, refresh: refreshModel } = useModelOutputs()
const { status: learningStatus, refresh: refreshLearning } = useLearningLoop()

onMounted(async () => {
  await Promise.all([fetchSources(false), refreshModel(), refreshLearning()])
})

const tabs = [
  { id: 'evidence' as const, label: 'Evidence' },
  { id: 'sources' as const, label: 'Data Sources' },
  { id: 'model' as const, label: 'Model Analysis' },
  { id: 'learning' as const, label: 'Learning Loop' },
  { id: 'diagnostics' as const, label: 'Diagnostics' },
]
</script>

<template>
  <div class="border-t border-surface-border bg-surface-raised">
    <button
      type="button"
      class="w-full px-4 py-2 flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200"
      @click="open = !open"
    >
      <span>Command drawer — evidence, model outputs, learning loop</span>
      <span>{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="max-h-[40vh] flex flex-col">
      <div class="flex gap-1 px-3 py-2 border-b border-surface-border overflow-x-auto">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors"
          :class="tab === t.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 text-xs">
        <template v-if="tab === 'evidence'">
          <NuxtLink :to="`/projects/${projectId}/evidence`" class="text-zinc-300 hover:underline">
            Open full evidence trace →
          </NuxtLink>
          <p class="text-zinc-500 mt-2">This recommendation is grounded in retrieved evidence.</p>
        </template>

        <template v-else-if="tab === 'sources'">
          <ul class="space-y-1">
            <li v-for="s in sources" :key="s.id" class="flex justify-between text-zinc-400">
              <span>{{ s.label }}</span>
              <UiBadge :label="s.available ? 'READY' : 'UNAVAILABLE'" variant="status" :state="s.available ? 'READY' : 'UNAVAILABLE'" />
            </li>
          </ul>
        </template>

        <template v-else-if="tab === 'model'">
          <p class="text-zinc-300">{{ modelStatus?.message }}</p>
          <dl class="grid grid-cols-2 gap-2 mt-3 text-zinc-500">
            <dt>Endpoint reachable</dt>
            <dd>{{ modelStatus?.modelEndpointReachable ? 'Yes' : 'No' }}</dd>
            <dt>Outputs available</dt>
            <dd>{{ modelStatus?.outputsAvailable ? 'Yes' : 'No' }}</dd>
            <dt>Candidates analyzed</dt>
            <dd>{{ modelStatus?.candidateCount ?? 0 }}</dd>
            <dt>Last run</dt>
            <dd class="font-mono text-[10px]">{{ modelStatus?.lastRun ?? '—' }}</dd>
          </dl>
        </template>

        <template v-else-if="tab === 'learning'">
          <p class="text-zinc-300">{{ learningStatus?.message }}</p>
          <dl class="grid grid-cols-2 gap-2 mt-3 text-zinc-500">
            <dt>Policy version</dt>
            <dd class="font-mono">{{ learningStatus?.scoringPolicyVersion }}</dd>
            <dt>Query runs</dt>
            <dd>{{ learningStatus?.queryRunsCount ?? 0 }}</dd>
            <dt>Feedback events</dt>
            <dd>{{ learningStatus?.feedbackEventsCount ?? 0 }}</dd>
          </dl>
          <p class="data-degraded mt-3">{{ learningStatus?.immutableNote }}</p>
        </template>

        <template v-else>
          <NuxtLink to="/diagnostics/maps" class="text-zinc-300 hover:underline">
            Map provider diagnostics →
          </NuxtLink>
          <p class="text-zinc-500 mt-2">Visualization degraded; scoring unaffected.</p>
        </template>
      </div>
    </div>
  </div>
</template>
