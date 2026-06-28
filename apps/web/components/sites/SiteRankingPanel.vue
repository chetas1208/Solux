<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'
import type { RankedSiteResult } from '~/composables/useProjectQuery'

const props = defineProps<{
  sites?: SiteWithScore[]
  rankedSites?: RankedSiteResult[]
  projectId: string
  selectedId?: string
  modelRerankUsed?: boolean
}>()

const emit = defineEmits<{
  select: [string]
  focus: [string]
}>()

const sortedLegacy = computed(() =>
  [...(props.sites ?? [])].sort(
    (a, b) => (b.scoreBreakdown?.finalScore ?? 0) - (a.scoreBreakdown?.finalScore ?? 0),
  ),
)

const hasRanked = computed(() => (props.rankedSites?.length ?? 0) > 0)
const hasLegacy = computed(() => (props.sites?.length ?? 0) > 0)
const totalCount = computed(() =>
  hasRanked.value ? props.rankedSites!.length : sortedLegacy.value.length,
)

function selectedKey(): string | undefined {
  return props.selectedId
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="solux-panel-header shrink-0 flex items-center justify-between">
      <span>Top {{ totalCount }} Candidates</span>
      <span v-if="modelRerankUsed" class="text-blue-500/70 normal-case font-normal tracking-normal text-[10px]">
        model ranked
      </span>
    </div>

    <div v-if="!hasRanked && !hasLegacy" class="p-4">
      <p class="data-degraded">
        Submit a query to retrieve candidate sites from configured real data sources.
      </p>
    </div>

    <!-- Query pipeline results -->
    <div v-else-if="hasRanked" class="overflow-auto flex-1 p-2 space-y-2">
      <SitesSiteDecisionCard
        v-for="site in rankedSites"
        :key="site.candidateId"
        :ranked="site"
        :project-id="projectId"
        :selected="selectedId === site.candidateId"
        :rank="site.rank"
        :model-rerank-used="modelRerankUsed"
        @click="emit('select', site.candidateId)"
        @focus="emit('focus', site.candidateId)"
      />
    </div>

    <!-- Legacy screening results -->
    <div v-else class="overflow-auto flex-1 p-2 space-y-2">
      <SitesSiteDecisionCard
        v-for="(site, i) in sortedLegacy"
        :key="site.id"
        :site="site"
        :project-id="projectId"
        :selected="selectedId === site.id"
        :rank="i + 1"
        @click="emit('select', site.id)"
        @focus="emit('focus', site.id)"
      />
    </div>
  </div>
</template>
