<script setup lang="ts">
import type { ScreeningResult } from '~/types/api'

defineProps<{ result: ScreeningResult | null }>()
</script>

<template>
  <UiCard v-if="result">
    <div class="solux-panel-header">Screening summary</div>
    <div class="p-4 grid grid-cols-3 gap-3 text-center">
      <div>
        <div class="text-2xl font-semibold text-decision-go">{{ result.decisions.filter(d => d.decision === 'GO').length }}</div>
        <div class="text-[11px] text-zinc-500 uppercase">GO</div>
      </div>
      <div>
        <div class="text-2xl font-semibold text-decision-investigate">{{ result.decisions.filter(d => d.decision === 'INVESTIGATE').length }}</div>
        <div class="text-[11px] text-zinc-500 uppercase">Investigate</div>
      </div>
      <div>
        <div class="text-2xl font-semibold text-decision-kill">{{ result.decisions.filter(d => d.decision === 'KILL').length }}</div>
        <div class="text-[11px] text-zinc-500 uppercase">Kill</div>
      </div>
    </div>
    <div class="px-4 pb-4 text-xs text-zinc-500">
      {{ result.siteCount }} candidates · {{ result.evidenceCount }} evidence items retrieved
    </div>
  </UiCard>
</template>
