<script setup lang="ts">
import type { ScoreBreakdown } from '~/types/api'

const props = defineProps<{ score: ScoreBreakdown }>()

const option = computed(() => ({
  backgroundColor: 'transparent',
  radar: {
    indicator: [
      { name: 'Solar', max: 100 },
      { name: 'Grid', max: 100 },
      { name: 'Build', max: 100 },
      { name: 'Storage', max: 100 },
      { name: 'Vegetation', max: 100 },
      { name: 'Atmosphere', max: 100 },
    ],
    axisName: { color: '#71717a', fontSize: 10 },
    splitLine: { lineStyle: { color: '#3f3f46' } },
    splitArea: { show: false },
  },
  series: [
    {
      type: 'radar',
      data: [
        {
          value: [
            props.score.powerOutputScore,
            props.score.gridConnectivityScore,
            props.score.buildabilityScore,
            props.score.storageFeasibilityScore,
            props.score.vegetationTradeoffScore,
            props.score.atmosphereRiskScore,
          ],
          areaStyle: { color: 'rgba(161, 161, 170, 0.15)' },
          lineStyle: { color: '#a1a1aa' },
          itemStyle: { color: '#e4e4e7' },
        },
      ],
    },
  ],
}))
</script>

<template>
  <ClientOnly>
    <VChart :option="option" autoresize class="h-56 w-full" />
  </ClientOnly>
</template>
