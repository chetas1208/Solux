<script setup lang="ts">
import type { PipelineStep } from '~/composables/usePipelineSteps'

defineProps<{
  steps: PipelineStep[]
  compact?: boolean
}>()

function stateIcon(state: string): string {
  switch (state) {
    case 'completed': return '✓'
    case 'running': return '●'
    case 'degraded': return '⚠'
    case 'failed': return '✕'
    case 'skipped': return '–'
    default: return '○'
  }
}

function stateClass(state: string): string {
  switch (state) {
    case 'completed': return 'text-emerald-500'
    case 'running': return 'text-blue-400 animate-pulse'
    case 'degraded': return 'text-amber-400'
    case 'failed': return 'text-red-500'
    case 'skipped': return 'text-zinc-700'
    default: return 'text-zinc-700'
  }
}
</script>

<template>
  <div>
    <div class="space-y-1">
      <div
        v-for="step in steps"
        :key="step.id"
        class="flex items-start gap-2"
        :class="compact ? 'text-[10px]' : 'text-[11px]'"
      >
        <span
          class="shrink-0 w-4 text-center font-mono mt-px"
          :class="stateClass(step.state)"
        >
          {{ stateIcon(step.state) }}
        </span>
        <div class="flex-1 min-w-0">
          <span
            :class="[
              step.state === 'pending' || step.state === 'skipped' ? 'text-zinc-600' : 'text-zinc-300',
            ]"
          >
            {{ step.label }}
          </span>
          <span
            v-if="step.note"
            class="block text-[10px] text-zinc-500 mt-0.5 leading-relaxed"
          >
            {{ step.note }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
