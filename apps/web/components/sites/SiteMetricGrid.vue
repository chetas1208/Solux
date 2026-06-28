<script setup lang="ts">
import type { ScoreBreakdown } from '~/types/api'

defineProps<{ score: ScoreBreakdown }>()

const rows = [
  { key: 'powerOutputScore', label: 'Solar output' },
  { key: 'vegetationTradeoffScore', label: 'Vegetation tradeoff' },
  { key: 'gridConnectivityScore', label: 'Grid / connectivity' },
  { key: 'buildabilityScore', label: 'Buildability' },
  { key: 'storageFeasibilityScore', label: 'Storage feasibility' },
  { key: 'powerLossScore', label: 'Power-loss risk' },
  { key: 'atmosphereRiskScore', label: 'Atmospheric risk' },
  { key: 'waterFeasibilityScore', label: 'Water feasibility' },
] as const
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
    <div v-for="row in rows" :key="row.key" class="solux-panel p-2">
      <template v-if="row.key !== 'waterFeasibilityScore' || score.waterFeasibilityScore != null">
        <div class="text-[10px] text-zinc-500 uppercase">{{ row.label }}</div>
        <div class="font-mono text-lg text-zinc-200">{{ score[row.key as keyof ScoreBreakdown] ?? '—' }}</div>
      </template>
      <div v-else class="data-degraded text-[10px]">Not applicable</div>
    </div>
  </div>
</template>
