<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'

const props = defineProps<{
  sites: SiteWithScore[]
  projectId: string
  selectedId?: string
}>()

const emit = defineEmits<{ select: [string] }>()

const ranked = computed(() =>
  [...props.sites].sort((a, b) => (b.scoreBreakdown?.finalScore ?? 0) - (a.scoreBreakdown?.finalScore ?? 0)),
)
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="solux-panel-header shrink-0">
      Ranked candidates ({{ sites.length }})
    </div>
    <div v-if="!sites.length" class="p-4">
      <p class="data-degraded">
        No candidate sites generated from configured real data sources.
      </p>
    </div>
    <div v-else class="overflow-auto flex-1 p-2 space-y-2">
      <SitesSiteDecisionCard
        v-for="site in ranked"
        :key="site.id"
        :site="site"
        :project-id="projectId"
        :selected="selectedId === site.id"
        @click="emit('select', site.id)"
      />
    </div>
  </div>
</template>
