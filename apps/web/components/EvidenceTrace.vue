<script setup lang="ts">
import type { EvidenceItem } from '@solux/shared'

defineProps<{ evidence: EvidenceItem[] }>()

const SOURCE_LABELS: Record<string, string> = {
  nrel_nsrdb: 'NREL NSRDB',
  pvgis: 'PVGIS',
  global_solar_atlas: 'Global Solar Atlas',
  openstreetmap: 'OpenStreetMap',
  uspvdb: 'US PVDB',
  gebco: 'GEBCO',
  copernicus_marine: 'Copernicus Marine',
  noaa_tides: 'NOAA Tides',
  manual_input: 'Manual',
  modular_endpoint: 'Modular Endpoint',
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">Evidence Trace ({{ evidence.length }} items)</div>
    <div class="divide-y divide-slate-800">
      <div
        v-for="item in evidence"
        :key="item.id"
        class="p-3 text-xs"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <span class="text-slate-500 font-semibold">
              {{ SOURCE_LABELS[item.source] ?? item.source }}
            </span>
            <span class="text-slate-600 ml-2">
              {{ new Date(item.retrievedAt).toLocaleTimeString() }}
            </span>
            <div class="text-slate-300 mt-0.5">{{ item.description }}</div>
            <div class="text-slate-500 mt-0.5 font-mono">
              {{ JSON.stringify(item.value) }}
              <span v-if="item.unit" class="text-slate-600 ml-1">{{ item.unit }}</span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div class="text-slate-400">{{ Math.round(item.dataConfidence * 100) }}%</div>
            <div class="text-slate-600">conf</div>
          </div>
        </div>
      </div>
      <div v-if="!evidence.length" class="p-3 text-slate-600 text-xs">
        No evidence items retrieved for this site.
      </div>
    </div>
  </div>
</template>
