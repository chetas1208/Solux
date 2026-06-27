<script setup lang="ts">
import type { ScoreBreakdown } from '@solux/shared'

defineProps<{ score: ScoreBreakdown }>()

const DIMENSIONS = [
  { key: 'powerOutputScore', label: 'Solar Output', weight: '25%', color: 'bg-solar' },
  { key: 'gridConnectivityScore', label: 'Grid Connectivity', weight: '20%', color: 'bg-blue-500' },
  { key: 'buildabilityScore', label: 'Buildability', weight: '15%', color: 'bg-purple-500' },
  { key: 'vegetationTradeoffScore', label: 'Vegetation Tradeoff', weight: '15%', color: 'bg-green-500' },
  { key: 'storageFeasibilityScore', label: 'Storage Feasibility', weight: '10%', color: 'bg-cyan-500' },
  { key: 'atmosphereRiskScore', label: 'Atmosphere Risk', weight: '5%', color: 'bg-orange-500' },
  { key: 'powerLossScore', label: 'Power Loss Risk', weight: '5%', color: 'bg-rose-500' },
  { key: 'waterFeasibilityScore', label: 'Water Feasibility', weight: '5%', color: 'bg-teal-500' },
] as const
</script>

<template>
  <div class="panel">
    <div class="panel-header">Score Breakdown</div>
    <div class="p-4 space-y-3">
      <div
        v-for="dim in DIMENSIONS"
        :key="dim.key"
      >
        <div v-if="dim.key !== 'waterFeasibilityScore' || score.waterFeasibilityScore !== undefined">
          <div class="flex items-center justify-between mb-1">
            <div class="text-xs text-slate-400">
              {{ dim.label }}
              <span class="text-slate-600 ml-1">{{ dim.weight }}</span>
            </div>
            <div class="text-xs font-mono font-bold text-slate-300">
              {{ score[dim.key as keyof typeof score] ?? '—' }}
            </div>
          </div>
          <div class="score-bar">
            <div
              :class="dim.color"
              class="score-bar-fill"
              :style="{
                width: score[dim.key as keyof typeof score] !== undefined
                  ? `${score[dim.key as keyof typeof score]}%`
                  : '0%'
              }"
            />
          </div>
        </div>
        <div v-else class="data-missing">{{ dim.label }} — water site data not available</div>
      </div>

      <div v-if="score.topPositiveFactors.length" class="pt-3 border-t border-slate-700">
        <div class="text-xs text-slate-500 uppercase tracking-widest mb-2">Positive Factors</div>
        <div v-for="f in score.topPositiveFactors" :key="f" class="text-xs text-green-400 flex gap-1">
          <span>✓</span>{{ f }}
        </div>
      </div>

      <div v-if="score.missingDataWarnings.length" class="pt-2">
        <div class="text-xs text-slate-500 uppercase tracking-widest mb-2">Missing Data</div>
        <div v-for="w in score.missingDataWarnings" :key="w" class="data-missing mb-1">{{ w }}</div>
      </div>
    </div>
  </div>
</template>
