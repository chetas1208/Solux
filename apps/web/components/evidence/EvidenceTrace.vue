<script setup lang="ts">
import type { EvidenceItem, ProjectBrief, ProjectSpec } from '~/types/api'

const props = defineProps<{
  brief?: ProjectBrief | null
  spec?: ProjectSpec | null
  evidence: EvidenceItem[]
  warnings?: string[]
}>()

const SOURCE_LABELS: Record<string, string> = {
  nrel_nsrdb: 'NREL NSRDB',
  pvgis: 'PVGIS',
  global_solar_atlas: 'Global Solar Atlas',
  openstreetmap: 'OpenStreetMap',
  gebco: 'GEBCO',
  copernicus_marine: 'Copernicus Marine',
}

const sourcesChecked = computed(() => [...new Set(props.evidence.map((e) => e.source))])
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Evidence trace</div>
    <div class="p-4 space-y-4 text-sm">
      <section v-if="brief">
        <div class="text-[11px] uppercase text-zinc-500 mb-1">Parsed user request</div>
        <p class="text-zinc-400 text-xs leading-relaxed">{{ brief.rawPrompt }}</p>
      </section>
      <section v-if="spec">
        <div class="text-[11px] uppercase text-zinc-500 mb-1">Confirmed constraints</div>
        <p class="text-zinc-400 text-xs">{{ spec.targetRegion }} · {{ spec.targetCapacityMW }} MW · {{ spec.technology }}</p>
      </section>
      <section>
        <div class="text-[11px] uppercase text-zinc-500 mb-1">Data sources checked</div>
        <div v-if="sourcesChecked.length" class="flex flex-wrap gap-1">
          <UiBadge v-for="s in sourcesChecked" :key="s" :label="SOURCE_LABELS[s] ?? s" />
        </div>
        <p v-else class="data-degraded">No sources recorded yet.</p>
      </section>
      <section v-if="warnings?.length">
        <div class="text-[11px] uppercase text-zinc-500 mb-1">Degraded / unavailable</div>
        <div v-for="w in warnings" :key="w" class="data-degraded mb-1">{{ w }}</div>
      </section>
      <EvidenceAgentStepTimeline :evidence="evidence" />
    </div>
  </UiCard>
</template>
