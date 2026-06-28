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

const regionChip = computed(() => {
  const states = summary.value?.primaryStates?.length
    ? summary.value.primaryStates
    : props.project.regionLabel?.match(/\(([A-Z]{2,3})\)/g)?.map((m) => m.replace(/[()]/g, ''))
  if (states?.length) return states.slice(0, 3).join(' · ')
  return props.project.regionLabel?.split('(')[0]?.trim() ?? '—'
})

const scoreRange = computed(() => {
  if (!summary.value?.hasResults) return null
  const min = Math.round(summary.value.scoreMin)
  const max = Math.round(summary.value.scoreMax)
  return min === max ? String(min) : `${min}–${max}`
})

const solarLabel = computed(() =>
  summary.value?.avgSolar != null && summary.value.avgSolar > 0
    ? Math.round(summary.value.avgSolar)
    : null,
)

const gridLabel = computed(() =>
  summary.value?.avgGrid != null && summary.value.avgGrid > 0
    ? Math.round(summary.value.avgGrid)
    : null,
)

const topPick = computed(() => {
  const label = summary.value?.topSiteLabel
  if (!label) return null
  return label.length > 42 ? `${label.slice(0, 39)}…` : label
})

const decisionTone = computed(() => {
  const d = summary.value?.topDecision?.toUpperCase() ?? ''
  if (d === 'GO' || d === 'PROCEED') return 'READY'
  if (d === 'NO_GO' || d === 'KILL') return 'DEGRADED'
  return 'UNKNOWN'
})

const countryFlag = computed(() => {
  const c = props.project.country
  if (c === 'USA') return '🇺🇸'
  if (c === 'India') return '🇮🇳'
  const text = `${props.project.rawPrompt} ${props.project.regionLabel ?? ''}`.toLowerCase()
  if (/\b(nevada|arizona|texas|california|usa|u\.s\.)\b/.test(text)) return '🇺🇸'
  return '🇮🇳'
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
        <div class="text-lg font-semibold text-zinc-100 tabular-nums">{{ regionChip }}</div>
        <div class="text-[9px] uppercase tracking-wider text-zinc-600">Region</div>
      </div>
      <div class="bg-zinc-950/80 px-3 py-2.5 text-center">
        <div class="text-lg font-semibold text-zinc-100 tabular-nums">{{ scoreRange ?? '—' }}</div>
        <div class="text-[9px] uppercase tracking-wider text-zinc-600">Score range</div>
      </div>
      <div class="bg-zinc-950/80 px-3 py-2.5 text-center">
        <div class="text-lg font-semibold text-zinc-100 tabular-nums">
          <template v-if="solarLabel != null && gridLabel != null">{{ solarLabel }}/{{ gridLabel }}</template>
          <template v-else>{{ summary.candidateCount }}</template>
        </div>
        <div class="text-[9px] uppercase tracking-wider text-zinc-600">
          {{ solarLabel != null ? 'Solar / grid' : 'Sites ranked' }}
        </div>
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
      class="px-4 py-2 border-t border-surface-border flex items-center justify-between gap-2 text-[10px] text-zinc-600"
    >
      <span v-if="topPick" class="truncate">Lead: {{ topPick }}</span>
      <span v-else>{{ summary.candidateCount }} sites · map ready</span>
      <span class="shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors">Open →</span>
    </div>
  </NuxtLink>
</template>
