<script setup lang="ts">
import type { ProjectListItem } from '~/types/api'

const props = defineProps<{
  project: ProjectListItem
}>()

const title = computed(
  () => props.project.name ?? props.project.rawPrompt.slice(0, 64),
)

const subtitle = computed(
  () =>
    props.project.subtitle ??
    props.project.regionLabel ??
    props.project.rawPrompt.slice(0, 120),
)

const summary = computed(() => props.project.summary)

const confidencePct = computed(() =>
  summary.value?.avgConfidence != null
    ? Math.round(summary.value.avgConfidence * (summary.value.avgConfidence <= 1 ? 100 : 1))
    : null,
)

const scoreLabel = computed(() =>
  summary.value?.avgScore != null ? Math.round(summary.value.avgScore) : null,
)

const decisionTone = computed(() => {
  const d = summary.value?.topDecision?.toUpperCase() ?? ''
  if (d === 'GO' || d === 'PROCEED') return 'READY'
  if (d === 'NO_GO' || d === 'KILL') return 'DEGRADED'
  return 'UNKNOWN'
})

const countryFlag = computed(() => {
  const c = props.project.country ?? (props.project.regionLabel?.includes('USA') ? 'USA' : 'India')
  return c === 'USA' ? '🇺🇸' : '🇮🇳'
})
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="solux-panel group block overflow-hidden hover:border-zinc-500 transition-all duration-200"
  >
    <div class="p-4 pb-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-base leading-none">{{ countryFlag }}</span>
            <h3 class="text-sm font-semibold text-zinc-100 truncate group-hover:text-white">
              {{ title }}
            </h3>
          </div>
          <p class="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{{ subtitle }}</p>
        </div>
        <UiBadge
          v-if="summary?.hasResults"
          :label="summary.topDecision"
          variant="status"
          :state="decisionTone"
        />
      </div>
    </div>

    <div
      v-if="summary?.hasResults"
      class="grid grid-cols-3 gap-px bg-surface-border border-t border-surface-border"
    >
      <div class="bg-zinc-950/80 px-3 py-2.5 text-center">
        <div class="text-lg font-semibold text-zinc-100 tabular-nums">{{ summary.candidateCount }}</div>
        <div class="text-[9px] uppercase tracking-wider text-zinc-600">Sites ranked</div>
      </div>
      <div class="bg-zinc-950/80 px-3 py-2.5 text-center">
        <div class="text-lg font-semibold text-zinc-100 tabular-nums">{{ confidencePct ?? '—' }}<span v-if="confidencePct != null" class="text-xs text-zinc-500">%</span></div>
        <div class="text-[9px] uppercase tracking-wider text-zinc-600">Confidence</div>
      </div>
      <div class="bg-zinc-950/80 px-3 py-2.5 text-center">
        <div class="text-lg font-semibold text-zinc-100 tabular-nums">{{ scoreLabel ?? '—' }}</div>
        <div class="text-[9px] uppercase tracking-wider text-zinc-600">Avg score</div>
      </div>
    </div>

    <div
      v-else
      class="border-t border-surface-border px-4 py-3 flex items-center justify-between text-[11px] text-zinc-600"
    >
      <span>Open to load ranked sites on map</span>
      <span class="text-zinc-500 group-hover:text-zinc-300 transition-colors">→</span>
    </div>

    <div
      v-if="summary?.hasResults"
      class="px-4 py-2 border-t border-surface-border flex items-center justify-between text-[10px] text-zinc-600"
    >
      <span>Dataset {{ summary.datasetVersion }} · map ready</span>
      <span class="text-zinc-500 group-hover:text-zinc-300 transition-colors">Open →</span>
    </div>
  </NuxtLink>
</template>
