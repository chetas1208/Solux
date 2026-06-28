<script setup lang="ts">
import type { ScoreBreakdown } from '~/types/api'

const props = defineProps<{ score: ScoreBreakdown }>()

const option = computed(() => ({
  backgroundColor: 'transparent',
  grid: { left: 80, right: 16, top: 8, bottom: 24 },
  xAxis: {
    type: 'value',
    max: 100,
    axisLabel: { color: '#71717a', fontSize: 10 },
    splitLine: { lineStyle: { color: '#27272a' } },
  },
  yAxis: {
    type: 'category',
    data: ['Power loss', 'Atmosphere', 'Buildability'],
    axisLabel: { color: '#a1a1aa', fontSize: 10 },
  },
  series: [
    {
      type: 'bar',
      stack: 'loss',
      data: [
        100 - props.score.powerLossScore,
        100 - props.score.atmosphereRiskScore,
        100 - props.score.buildabilityScore,
      ],
      itemStyle: { color: '#dc2626' },
    },
    {
      type: 'bar',
      stack: 'loss',
      data: [
        props.score.powerLossScore,
        props.score.atmosphereRiskScore,
        props.score.buildabilityScore,
      ],
      itemStyle: { color: '#3f3f46' },
    },
  ],
}))
</script>

<template>
  <ClientOnly>
    <VChart :option="option" autoresize class="h-40 w-full" />
  </ClientOnly>
</template>
