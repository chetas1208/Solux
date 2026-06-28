<script setup lang="ts">
import type { ProjectBrief, ProjectSpec } from '~/types/api'

definePageMeta({ commandTitle: '3D Earth command center' })

const route = useRoute()
const projectId = route.params.id as string

const api = useApiClient()
const { parsePrompt, loading: parsing, error: parseError, spec: parsedSpec } = useProjectPrompt()
const { state: screeningState, sites, result, warnings, error: screeningError, startScreening, loadSites } = useScreening()
const { fetchSources, sources } = useDataSources()
const { status: modelStatus, refresh: refreshModel } = useModelOutputs()
const { status: learningStatus, refresh: refreshLearning } = useLearningLoop()
const { source: catalogSource, refresh: refreshCatalog } = useDatasetCatalog()

const brief = ref<ProjectBrief | null>(null)
const spec = ref<ProjectSpec | null>(null)
const loadError = ref<string | null>(null)
const selectedSiteId = ref<string | undefined>()

const { layers, toggleLayer } = useMapLayers(sources)
const { mapReadinessLabel, refresh: refreshMapHealth } = useMapProviderHealth()

onMounted(async () => {
  await Promise.all([
    fetchSources(false),
    refreshModel(),
    refreshLearning(),
    refreshCatalog(),
    refreshMapHealth(false),
  ])
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
  return sources.value.length ? `${avail}/${sources.value.length}` : '—'
})

async function handleParse() { await parsePrompt(projectId) }
async function handleScreen() { await startScreening(projectId) }

const selectedSite = computed(() => sites.value.find((s) => s.id === selectedSiteId.value) ?? null)
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-2.75rem)]">
    <LayoutErrorState v-if="loadError" class="m-4" :message="loadError" />

    <template v-else>
      <div class="shrink-0 border-b border-surface-border px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span class="font-semibold text-zinc-200">{{ brief?.name ?? 'Project' }}</span>
        <span class="text-zinc-600">|</span>
        <span class="text-zinc-500">Dataset <span class="text-zinc-300">{{ catalogSource }}</span></span>
        <span class="text-zinc-500">Policy <span class="font-mono text-zinc-300">{{ learningStatus?.scoringPolicyVersion ?? '—' }}</span></span>
        <span class="text-zinc-500">Run <span class="text-zinc-300">{{ screeningState }}</span></span>
        <span class="text-zinc-500">Confidence <span class="text-zinc-300">{{ avgConfidence ?? '—' }}</span></span>
        <span class="text-zinc-500">Sources <span class="text-zinc-300">{{ dataCoverage }}</span></span>
        <span class="text-zinc-500">Model <span :class="modelStatus?.outputsAvailable ? 'status-ready' : 'status-degraded'">{{ modelStatus?.outputsAvailable ? 'ready' : 'deterministic' }}</span></span>
        <span class="text-zinc-500">Map <span class="text-zinc-400">{{ mapReadinessLabel }}</span></span>
      </div>

      <LayoutSplitPane left-width="240px" right-width="280px" class="flex-1 min-h-0">
        <template #left>
          <div class="p-3 space-y-3 overflow-y-auto h-full">
            <ProjectParsedConstraintReview v-if="spec" :spec="spec" />
            <UiCard v-else-if="brief">
              <div class="solux-panel-header">Requirement</div>
              <p class="p-3 text-xs text-zinc-400 leading-relaxed">{{ brief.rawPrompt }}</p>
            </UiCard>
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
            <MapLayerTogglePanel :layers="layers" @toggle="toggleLayer" />
            <ProjectProjectDecisionSummary :result="result" />
          </div>
        </template>

        <div class="relative flex flex-col min-h-0 flex-1">
          <EarthEarthWorkspace
            class="flex-1 min-h-0"
            :sites="sites"
            :layers="layers"
            :selected-id="selectedSiteId"
            @select="selectedSiteId = $event"
          />
          <MapSiteHoverCard :site="selectedSite" />
        </div>

        <template #right>
          <div class="h-full overflow-y-auto">
            <SitesSiteRankingPanel
              :sites="sites"
              :project-id="projectId"
              :selected-id="selectedSiteId"
              @select="selectedSiteId = $event"
            />
            <div class="p-3 border-t border-surface-border">
              <NuxtLink :to="`/projects/${projectId}/sites/${selectedSiteId}`" v-if="selectedSiteId">
                <UiButton variant="primary" size="sm" class="w-full">Open fatal-flaw report</UiButton>
              </NuxtLink>
            </div>
          </div>
        </template>
      </LayoutSplitPane>

      <ProjectCommandCenterDrawer :project-id="projectId" />
    </template>
  </div>
</template>
