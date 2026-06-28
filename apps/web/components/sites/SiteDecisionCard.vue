<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'
import type { RankedSiteResult } from '~/composables/useProjectQuery'

const props = defineProps<{
  site?: SiteWithScore
  ranked?: RankedSiteResult
  projectId: string
  selected?: boolean
  rank?: number
  modelRerankUsed?: boolean
}>()

const emit = defineEmits<{
  click: []
  focus: []
}>()

function normalizeFlaw(raw: unknown): string | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const joined = raw.map(String).filter((x) => x && x !== '[').join(', ')
    return joined || null
  }
  const s = String(raw).trim()
  if (!s || s === '[') return null
  if (s.startsWith('[') && s.endsWith(']')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim().replace(/^['"]|['"]$/g, '').replace(/_/g, ' '))
      .filter(Boolean)
      .join(', ')
  }
  return s.replace(/_/g, ' ')
}

const decision = computed(() =>
  props.ranked?.decision ?? props.site?.scoreBreakdown?.finalDecision ?? 'INVESTIGATE',
)
const finalScore = computed(() =>
  props.ranked?.finalScore ?? props.site?.scoreBreakdown?.finalScore ?? null,
)
const confidence = computed(() =>
  props.ranked?.confidence ?? props.site?.scoreBreakdown?.confidence ?? null,
)
const displayName = computed(() =>
  props.ranked?.displayLabel ?? props.site?.name ?? `Site ${props.rank ?? '—'}`,
)
const displayAddress = computed(() =>
  props.ranked?.formattedAddress ?? props.ranked?.locality ?? null,
)
const adminArea = computed(() =>
  props.ranked?.adminArea1 ?? props.ranked?.state ?? props.site?.country ?? null,
)
const siteType = computed(() =>
  props.ranked?.siteSurfaceType ?? props.site?.siteType ?? 'land',
)
const topPositive = computed(() =>
  props.ranked?.topPositiveFactors?.[0] ?? props.site?.scoreBreakdown?.topPositiveFactors?.[0] ?? null,
)
const topFlaw = computed(() =>
  normalizeFlaw(props.ranked?.topFatalFlaws?.[0] ?? props.site?.scoreBreakdown?.topFatalFlaws?.[0]),
)
const scoreDetail = computed(() => {
  const parts: string[] = []
  if (props.ranked?.solarScore) parts.push(`Solar ${props.ranked.solarScore}`)
  if (props.ranked?.gridScore) parts.push(`Grid ${props.ranked.gridScore}`)
  return parts.length ? parts.join(' · ') : null
})

const coords = computed(() => {
  const c = props.ranked?.centroid?.coordinates ?? props.site?.centroid?.coordinates
  if (!c) return null
  return `${Math.abs(c[1]!).toFixed(2)}°${c[1]! >= 0 ? 'N' : 'S'}, ${Math.abs(c[0]!).toFixed(2)}°${c[0]! >= 0 ? 'E' : 'W'}`
})

const reportLink = computed(() => {
  const id = props.ranked?.candidateId ?? props.site?.id
  return id ? `/projects/${props.projectId}/sites/${id}` : null
})

function decisionClass(d: string) {
  if (d === 'GO') return 'decision-go'
  if (d === 'KILL') return 'decision-kill'
  return 'decision-investigate'
}

function siteTypeLabel(t: string) {
  const map: Record<string, string> = {
    land: 'Land',
    reservoir: 'Reservoir',
    canal: 'Canal',
    lake: 'Lake',
    coastal_shallow: 'Coastal',
  }
  return map[t] ?? t
}
</script>

<template>
  <div
    class="solux-panel p-3 cursor-pointer transition-colors hover:border-zinc-600"
    :class="selected ? 'border-zinc-500 ring-1 ring-zinc-600' : ''"
    @click="$emit('click')"
  >
    <div class="flex items-start gap-2 mb-2">
      <span
        v-if="rank"
        class="shrink-0 w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 mt-0.5"
      >
        {{ rank }}
      </span>
      <span
        v-if="decision"
        class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
        :class="decisionClass(decision)"
      >
        {{ decision }}
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-zinc-100 leading-snug">{{ displayName }}</p>
        <p v-if="displayAddress" class="text-[10px] text-zinc-500 mt-0.5 truncate">{{ displayAddress }}</p>
        <p v-else-if="coords" class="text-[10px] text-zinc-600 mt-0.5 font-mono">{{ coords }}</p>
        <p v-else-if="adminArea" class="text-[10px] text-zinc-600 mt-0.5">{{ adminArea }}</p>
      </div>
      <span v-if="finalScore !== null" class="font-mono text-sm text-zinc-300 shrink-0 ml-1">
        {{ typeof finalScore === 'number' ? finalScore.toFixed(1) : finalScore }}
      </span>
    </div>

    <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-600 mb-1.5">
      <span>{{ siteTypeLabel(siteType) }}</span>
      <span v-if="confidence !== null">{{ typeof confidence === 'number' ? confidence.toFixed(0) : confidence }}% conf</span>
      <span v-if="scoreDetail" class="text-zinc-500">{{ scoreDetail }}</span>
      <span v-if="modelRerankUsed" class="text-blue-500/70">model ranked</span>
    </div>

    <p v-if="topPositive" class="text-[10px] text-emerald-500/80 truncate mb-0.5">+ {{ topPositive }}</p>
    <p v-if="topFlaw" class="text-[10px] text-amber-500/90 truncate mb-2">⚠ Missing: {{ topFlaw }}</p>

    <div class="flex items-center gap-2 pt-1.5 border-t border-surface-border/60">
      <button
        type="button"
        class="flex-1 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors text-left"
        @click.stop="$emit('focus')"
      >
        Focus on globe →
      </button>
      <NuxtLink
        v-if="reportLink"
        :to="reportLink"
        class="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
        @click.stop
      >
        Open report →
      </NuxtLink>
    </div>
  </div>
</template>
