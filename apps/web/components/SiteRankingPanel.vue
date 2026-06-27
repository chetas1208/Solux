<script setup lang="ts">
import type { CandidateSite, ScoreBreakdown } from '@solux/shared'

defineProps<{
  sites: Array<CandidateSite & { scoreBreakdown: ScoreBreakdown | null }>
  projectId: string
}>()

function decisionClass(d: string | undefined) {
  if (d === 'GO') return 'decision-go'
  if (d === 'INVESTIGATE') return 'decision-investigate'
  return 'decision-kill'
}

function scoreColor(score: number) {
  if (score >= 70) return 'bg-green-500'
  if (score >= 45) return 'bg-amber-500'
  return 'bg-red-500'
}
</script>

<template>
  <div>
    <div class="panel-header mb-3">
      Ranked Candidate Sites ({{ sites.length }})
    </div>
    <div class="space-y-2">
      <div
        v-for="site in sites"
        :key="site.id"
        class="panel p-3 hover:border-slate-500 transition-colors"
      >
        <div class="flex items-start gap-3">
          <div
            :class="decisionClass(site.scoreBreakdown?.finalDecision)"
            class="shrink-0 w-20 text-center py-1 rounded text-xs font-bold"
          >
            {{ site.scoreBreakdown?.finalDecision ?? '—' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <div class="text-sm text-slate-200 font-medium">{{ site.name }}</div>
              <div class="text-sm font-mono font-bold text-slate-300">
                {{ site.scoreBreakdown?.finalScore ?? '—' }}<span class="text-slate-600 text-xs">/100</span>
              </div>
            </div>
            <div v-if="site.scoreBreakdown" class="grid grid-cols-4 gap-1 mb-2">
              <div v-for="[label, val] in [
                ['Solar', site.scoreBreakdown.powerOutputScore],
                ['Grid', site.scoreBreakdown.gridConnectivityScore],
                ['Build', site.scoreBreakdown.buildabilityScore],
                ['Storage', site.scoreBreakdown.storageFeasibilityScore],
              ]" :key="label" class="text-center">
                <div class="score-bar mb-0.5">
                  <div :class="scoreColor(val as number)" class="score-bar-fill" :style="{ width: `${val}%` }" />
                </div>
                <div class="text-xs text-slate-600">{{ label }}</div>
              </div>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-600">
              <span>{{ site.siteType }}</span>
              <span>{{ site.areaKm2.toFixed(0) }} km²</span>
              <span>{{ site.scoreBreakdown?.confidence ?? '—' }}% conf</span>
            </div>
          </div>
          <NuxtLink
            :to="`/projects/${projectId}/sites/${site.id}`"
            class="shrink-0 text-xs text-solar hover:underline"
          >
            Report →
          </NuxtLink>
        </div>
        <div
          v-if="site.scoreBreakdown?.topFatalFlaws.length"
          class="mt-2 ml-23 text-xs text-red-400"
        >
          ✕ {{ site.scoreBreakdown.topFatalFlaws[0] }}
        </div>
      </div>
    </div>
  </div>
</template>
