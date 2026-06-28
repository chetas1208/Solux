<script setup lang="ts">
import type { EvidenceItem } from '~/types/api'

defineProps<{ evidence: EvidenceItem[]; limit?: number }>()

const SOURCE_LABELS: Record<string, string> = {
  nrel_nsrdb: 'NREL NSRDB',
  pvgis: 'PVGIS',
  global_solar_atlas: 'Global Solar Atlas',
  openstreetmap: 'OpenStreetMap',
  uspvdb: 'US PVDB',
  gebco: 'GEBCO',
  copernicus_marine: 'Copernicus Marine',
}
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Evidence ({{ evidence.length }})</div>
    <div class="divide-y divide-zinc-800 max-h-48 overflow-auto">
      <div v-for="item in evidence.slice(0, limit ?? 5)" :key="item.id" class="p-3 text-xs">
        <span class="text-zinc-500 font-medium">{{ SOURCE_LABELS[item.source] ?? item.source }}</span>
        <span class="text-zinc-600 ml-2">{{ item.description }}</span>
      </div>
      <p v-if="!evidence.length" class="p-3 text-zinc-600">No evidence retrieved.</p>
    </div>
  </UiCard>
</template>
