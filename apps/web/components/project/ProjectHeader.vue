<script setup lang="ts">
import type { ProjectBrief, ProjectSpec } from '~/types/api'
import type { ScreeningState } from '~/composables/useScreening'

defineProps<{
  brief: ProjectBrief | null
  spec: ProjectSpec | null
  runState: ScreeningState
  confidenceSummary?: number | null
  dataCoverage?: string
}>()
</script>

<template>
  <div class="px-4 py-2 border-b border-surface-border flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
    <div class="font-medium text-zinc-200 truncate max-w-xs">
      {{ spec?.name ?? brief?.rawPrompt.slice(0, 48) ?? 'Project' }}
    </div>
    <span v-if="spec" class="text-zinc-500">{{ spec.targetRegion }}</span>
    <UiBadge
      :label="runState === 'running' ? 'SCREENING' : runState === 'completed' ? 'COMPLETE' : runState.toUpperCase()"
      variant="status"
      :state="runState === 'completed' ? 'READY' : runState === 'running' ? 'DEGRADED' : 'UNKNOWN'"
    />
    <span v-if="confidenceSummary != null" class="text-zinc-500">
      Confidence <span :class="confidenceClass(confidenceLevel(confidenceSummary))">{{ confidenceSummary }}%</span>
    </span>
    <span v-if="dataCoverage" class="text-zinc-600">{{ dataCoverage }}</span>
  </div>
</template>
