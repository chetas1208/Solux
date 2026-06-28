<script setup lang="ts">
import type { FatalFlawReport } from '~/types/api'

defineProps<{ report: FatalFlawReport }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Fatal-flaw report</div>
    <div class="p-4 space-y-4">
      <ReportExecutiveDecision
        :decision="report.decision"
        :headline="report.headline"
        :summary="report.summary"
        :score="report.scoreBreakdown.finalScore"
        :confidence="report.scoreBreakdown.confidence"
      />
      <p class="text-sm text-zinc-400 leading-relaxed">{{ report.executiveSummary }}</p>
      <div v-if="report.keyFindings.length">
        <div class="text-[11px] uppercase text-zinc-500 mb-2">Key findings</div>
        <ul class="space-y-1 text-sm text-zinc-400">
          <li v-for="f in report.keyFindings" :key="f" class="flex gap-2"><span class="text-zinc-600">›</span>{{ f }}</li>
        </ul>
      </div>
    </div>
  </UiCard>
</template>
