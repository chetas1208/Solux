<script setup lang="ts">
import type { EvidenceItem } from '~/types/api'

defineProps<{ evidence: EvidenceItem[] }>()

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
    <div class="solux-panel-header">Evidence table</div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-zinc-800 text-zinc-500 text-left">
            <th class="p-3 font-medium">Source</th>
            <th class="p-3 font-medium">Description</th>
            <th class="p-3 font-medium">Value</th>
            <th class="p-3 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in evidence" :key="item.id" class="border-b border-zinc-800/60">
            <td class="p-3 text-zinc-400">{{ SOURCE_LABELS[item.source] ?? item.source }}</td>
            <td class="p-3 text-zinc-300">{{ item.description }}</td>
            <td class="p-3 font-mono text-zinc-500">{{ JSON.stringify(item.value) }}<span v-if="item.unit" class="ml-1">{{ item.unit }}</span></td>
            <td class="p-3">{{ Math.round(item.dataConfidence * 100) }}%</td>
          </tr>
          <tr v-if="!evidence.length">
            <td colspan="4" class="p-4 text-zinc-600">No evidence items retrieved for this site.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UiCard>
</template>
