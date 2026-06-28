<script setup lang="ts">
import type { ReadinessSummary } from '~/types/ui'

defineProps<{ summary: ReadinessSummary }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Executive readiness summary</div>
    <div class="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <StatusStatusHealthCard label="Overall" :state="summary.overall" />
      <StatusStatusHealthCard label="Core screening" :state="summary.coreScreening" />
      <StatusStatusHealthCard label="Land screening" :state="summary.landScreening" />
      <StatusStatusHealthCard label="Water screening" :state="summary.waterScreening" />
      <StatusStatusHealthCard label="Voice briefing" :state="summary.voiceBriefing" />
      <StatusStatusHealthCard label="Model cache" :state="summary.modelCache" />
    </div>
  </UiCard>
</template>
