<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'
import type { TradeoffPoint } from '~/types/ui'

const props = defineProps<{
  sites: SiteWithScore[]
  projectId: string
}>()

const emit = defineEmits<{ select: [string] }>()

const points = computed<TradeoffPoint[]>(() =>
  props.sites
    .filter((s) => s.scoreBreakdown)
    .map((s) => {
      const sb = s.scoreBreakdown!
      return {
        siteId: s.id,
        siteName: s.name,
        decision: sb.finalDecision,
        powerScore: sb.powerOutputScore,
        developmentRisk: developmentRisk(sb),
        vegetationRisk: 100 - sb.vegetationTradeoffScore,
        gridScore: sb.gridConnectivityScore,
        confidence: sb.confidence,
      }
    }),
)

const option = computed(() => {
  const colorMap: Record<string, string> = {
    GO: '#16a34a',
    INVESTIGATE: '#ca8a04',
    KILL: '#dc2626',
  }
  return {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: {
      name: 'Power score',
      nameLocation: 'middle',
      nameGap: 28,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#71717a', fontSize: 10 },
    },
    yAxis: {
      name: 'Development risk',
      nameLocation: 'middle',
      nameGap: 36,
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#71717a', fontSize: 10 },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#18181b',
      borderColor: '#3f3f46',
      textStyle: { color: '#e4e4e7', fontSize: 11 },
      formatter: (p: { data: TradeoffPoint & [number, number, number] }) => {
        const d = p.data
        return [
          `<strong>${d.siteName}</strong>`,
          `Decision: ${d.decision}`,
          `Power: ${d.powerScore}`,
          `Risk: ${d.developmentRisk}`,
          `Vegetation risk: ${d.vegetationRisk}`,
          `Grid: ${d.gridScore}`,
          `Confidence: ${d.confidence}%`,
        ].join('<br/>')
      },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: number[], p: { data: TradeoffPoint }) => Math.max(8, p.data.confidence / 8),
        data: points.value.map((p) => ({
          ...p,
          value: [p.powerScore, p.developmentRisk, p.confidence],
          itemStyle: { color: colorMap[p.decision] },
        })),
      },
    ],
  }
})

function onClick(params: { data?: TradeoffPoint }) {
  if (params.data?.siteId) emit('select', params.data.siteId)
}
</script>

<template>
  <UiCard class="h-full min-h-[280px]">
    <div class="solux-panel-header">Tradeoff: output vs risk</div>
    <LayoutEmptyState
      v-if="points.length < 2"
      title="Insufficient candidates"
      description="Tradeoff scatter requires at least two scored sites from the backend."
      class="py-8"
    />
    <ClientOnly v-else>
      <VChart :option="option" autoresize class="h-64 w-full" @click="onClick" />
    </ClientOnly>
  </UiCard>
</template>
