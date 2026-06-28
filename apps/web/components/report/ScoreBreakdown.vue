<script setup lang="ts">
import type { ScoreBreakdown } from '~/types/api'

defineProps<{ score: ScoreBreakdown }>()

const DIMENSIONS = [
  { key: 'powerOutputScore', label: 'Solar output', weight: '25%' },
  { key: 'gridConnectivityScore', label: 'Grid connectivity', weight: '20%' },
  { key: 'buildabilityScore', label: 'Buildability', weight: '15%' },
  { key: 'vegetationTradeoffScore', label: 'Vegetation tradeoff', weight: '15%' },
  { key: 'storageFeasibilityScore', label: 'Storage feasibility', weight: '10%' },
  { key: 'atmosphereRiskScore', label: 'Atmosphere risk', weight: '5%' },
  { key: 'powerLossScore', label: 'Power-loss risk', weight: '5%' },
  { key: 'waterFeasibilityScore', label: 'Water feasibility', weight: '5%' },
] as const
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Score breakdown</div>
    <div class="p-4 grid lg:grid-cols-2 gap-4">
      <div class="space-y-3">
        <div v-for="dim in DIMENSIONS" :key="dim.key">
          <template v-if="dim.key !== 'waterFeasibilityScore' || score.waterFeasibilityScore != null">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-zinc-400">{{ dim.label }} <span class="text-zinc-600">{{ dim.weight }}</span></span>
              <span class="font-mono text-zinc-300">{{ score[dim.key as keyof ScoreBreakdown] }}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill bg-zinc-400" :style="{ width: `${score[dim.key as keyof ScoreBreakdown]}%` }" />
            </div>
          </template>
        </div>
        <div v-if="score.topPositiveFactors.length" class="pt-2 border-t border-zinc-800">
          <div class="text-[11px] text-zinc-500 uppercase mb-1">Positive factors</div>
          <div v-for="f in score.topPositiveFactors" :key="f" class="text-xs text-emerald-500/90">+ {{ f }}</div>
        </div>
      </div>
      <ChartsScoreRadar :score="score" />
    </div>
  </UiCard>
</template>
