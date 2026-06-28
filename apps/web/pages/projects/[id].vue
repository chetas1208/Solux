<script setup lang="ts">
import type { ProjectBrief, ProjectSpec } from '~/types/api'

definePageMeta({ commandTitle: 'Project workspace' })

const route = useRoute()
const projectId = route.params.id as string

const api = useApiClient()
const { parsePrompt, loading: parsing, error: parseError, spec: parsedSpec } = useProjectPrompt()
const { state: screeningState, sites, result, warnings, error: screeningError, startScreening, loadSites } = useScreening()
const { fetchSources, sources } = useDataSources()

const brief = ref<ProjectBrief | null>(null)
const spec = ref<ProjectSpec | null>(null)
const loadError = ref<string | null>(null)
const selectedSiteId = ref<string | undefined>()

const { layers, toggleLayer } = useMapLayers(sources)

onMounted(async () => {
  await fetchSources(false)
  try {
    const data = await api.getProject(projectId)
    brief.value = data.brief
    spec.value = data.spec
    await loadSites(projectId)
  } catch (err) {
    loadError.value = String(err)
  }
})

watch(parsedSpec, (v) => { if (v) spec.value = v })

const avgConfidence = computed(() => {
  const scored = sites.value.filter((s) => s.scoreBreakdown)
  if (!scored.length) return null
  return Math.round(scored.reduce((a, s) => a + (s.scoreBreakdown?.confidence ?? 0), 0) / scored.length)
})

const dataCoverage = computed(() => {
  const avail = sources.value.filter((s) => s.available).length
  return sources.value.length ? `${avail}/${sources.value.length} sources ready` : undefined
})

async function handleParse() {
  await parsePrompt(projectId)
}

async function handleScreen() {
  await startScreening(projectId)
}

const selectedSite = computed(() => sites.value.find((s) => s.id === selectedSiteId.value) ?? null)
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-2.75rem)]">
    <LayoutErrorState v-if="loadError" class="m-4" :message="loadError" />

    <template v-else>
      <ProjectProjectHeader
        :brief="brief"
        :spec="spec"
        :run-state="screeningState"
        :confidence-summary="avgConfidence"
        :data-coverage="dataCoverage"
      />

      <LayoutSplitPane left-width="260px" right-width="300px" class="flex-1 min-h-0">
        <template #left>
          <div class="p-3 space-y-3">
            <UiCard v-if="brief && !spec">
              <div class="solux-panel-header">Requirement</div>
              <p class="p-3 text-xs text-zinc-400 leading-relaxed">{{ brief.rawPrompt }}</p>
            </UiCard>
            <ProjectParsedConstraintReview v-if="spec" :spec="spec" />
            <ProjectProjectRunControls
              :can-parse="!!brief && !spec"
              :can-screen="!!spec && screeningState !== 'completed'"
              :parsing="parsing"
              :screening="screeningState === 'running'"
              @parse="handleParse"
              @screen="handleScreen"
            />
            <LayoutErrorState v-if="parseError" :message="parseError" />
            <LayoutErrorState v-if="screeningError" :message="screeningError" />
            <div v-if="warnings.length" class="space-y-1">
              <div v-for="w in warnings" :key="w" class="data-degraded">{{ w }}</div>
            </div>
            <MapLayerTogglePanel :layers="layers" @toggle="toggleLayer" />
            <ProjectProjectDecisionSummary :result="result" />
          </div>
        </template>

        <div class="flex flex-col min-h-0 flex-1 p-3 gap-3">
          <div class="flex-1 min-h-[240px] relative">
            <MapCandidateMap
              :sites="sites"
              :layers="layers"
              :selected-id="selectedSiteId"
              @select="selectedSiteId = $event"
            />
            <MapSiteHoverCard :site="selectedSite" />
          </div>
          <ChartsTradeoffScatter
            v-if="sites.length >= 2"
            :sites="sites"
            :project-id="projectId"
            @select="(id) => navigateTo(`/projects/${projectId}/sites/${id}`)"
          />
        </div>

        <template #right>
          <SitesSiteRankingPanel
            :sites="sites"
            :project-id="projectId"
            :selected-id="selectedSiteId"
            @select="selectedSiteId = $event"
          />
          <div class="p-3 border-t border-surface-border flex gap-2">
            <NuxtLink :to="`/projects/${projectId}/compare`" class="flex-1">
              <UiButton variant="ghost" size="sm" class="w-full">Compare</UiButton>
            </NuxtLink>
            <NuxtLink :to="`/projects/${projectId}/evidence`" class="flex-1">
              <UiButton variant="ghost" size="sm" class="w-full">Evidence trace</UiButton>
            </NuxtLink>
          </div>
        </template>
      </LayoutSplitPane>
    </template>
  </div>
</template>
