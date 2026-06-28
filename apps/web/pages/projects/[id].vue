<script setup lang="ts">
import type { ProjectBrief, ProjectSpec, SiteWithScore } from '~/types/api'
import type { SiteType, Decision } from '@solux/shared'

definePageMeta({
  commandTitle: '3D Earth command center',
  layout: 'command-center',
})

const route = useRoute()
const projectId = route.params.id as string

const api = useApiClient()
const { fetchSources, sources } = useDataSources()
const { status: modelStatus, refresh: refreshModel } = useModelOutputs()
const { status: learningStatus, refresh: refreshLearning } = useLearningLoop()
const { source: catalogSource, refresh: refreshCatalog } = useDatasetCatalog()
const { mapReadinessLabel, refresh: refreshMapHealth } = useMapProviderHealth()
const { layers, toggleLayer } = useMapLayers(sources)
const { flyToSite, flyToBounds, flyToTarget, flyToRegion } = useGlobeCamera()
const { steps: pipelineSteps, markRunning, applyBackendSteps, markFailed } = usePipelineSteps()
const { loading: queryLoading, error: queryError, lastResult, unsupportedRegion, unsupportedCountries, submitQuery } = useProjectQuery()

const queryText = ref('')
const minQueryLen = 10
const canQuery = computed(() => queryText.value.trim().length >= minQueryLen && !queryLoading.value)

// Project state
const brief = ref<ProjectBrief | null>(null)
const spec = ref<ProjectSpec | null>(null)
const loadError = ref<string | null>(null)

// Site state — legacy screening sites
const legacySites = ref<SiteWithScore[]>([])
const selectedId = ref<string | undefined>()

// Query result ranked sites
const rankedSites = computed(() => lastResult.value?.rankedSites ?? [])
const modelRerankUsed = computed(() => lastResult.value?.modelRerankUsed ?? false)
const missingWarnings = computed(() => lastResult.value?.missingDataWarnings ?? [])

// Convert rankedSites to SiteWithScore for globe compatibility
const globeSites = computed<SiteWithScore[]>(() => {
  if (rankedSites.value.length) {
    return rankedSites.value.map((s) => {
      const coords = s.centroid?.coordinates ?? [0, 0]
      const delta = 0.04
      const [lng, lat] = coords
      return {
        id: s.candidateId,
        projectId,
        specId: '',
        name: s.displayLabel ?? `Candidate ${s.rank ?? ''}`,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [lng - delta, lat - delta],
            [lng + delta, lat - delta],
            [lng + delta, lat + delta],
            [lng - delta, lat + delta],
            [lng - delta, lat - delta],
          ]],
        },
        centroid: s.centroid ?? { type: 'Point' as const, coordinates: [0, 0] as [number, number] },
        siteType: (s.siteSurfaceType ?? 'land') as SiteType,
        country: (s.country ?? 'Other') as 'India' | 'USA' | 'Other',
        areaKm2: 10,
        generationMethod: 'grid_cell' as const,
        createdAt: new Date().toISOString(),
        scoreBreakdown: {
          siteId: s.candidateId,
          projectId,
          finalScore: s.finalScore,
          finalDecision: (s.decision ?? 'INVESTIGATE') as Decision,
          confidence: s.confidence,
          powerOutputScore: 0,
          vegetationTradeoffScore: 0,
          gridConnectivityScore: 0,
          buildabilityScore: 0,
          storageFeasibilityScore: 0,
          powerLossScore: 0,
          atmosphereRiskScore: 0,
          topPositiveFactors: s.topPositiveFactors ?? [],
          topFatalFlaws: s.topFatalFlaws ?? [],
          missingDataWarnings: [],
          evidenceIds: [],
          scoredAt: new Date().toISOString(),
        },
      } as SiteWithScore
    })
  }
  return legacySites.value
})

// Globe fly behavior when sites update
watch(
  rankedSites,
  (sites) => {
    if (!sites.length) return
    const gSites = globeSites.value
    if (gSites.length) flyToBounds(gSites)
  },
  { deep: true },
)

// Fly to selected
watch(selectedId, (id) => {
  if (!id) return
  const gs = globeSites.value.find((s) => s.id === id)
  if (gs) flyToSite(gs)
})

// Globe pin click → select in list
function onGlobeSelect(id: string) {
  selectedId.value = id
}

// List item "Focus on globe" → fly to
function onFocusSite(candidateId: string) {
  selectedId.value = candidateId
  const gs = globeSites.value.find((s) => s.id === candidateId)
  if (gs) flyToSite(gs, 20_000)
}

// Query submission
async function handleQuery(query: string) {
  markRunning()
  const result = await submitQuery(projectId, query)
  if (result) {
    if (result.pipelineSteps?.length) {
      applyBackendSteps(result.pipelineSteps)
    }
  } else {
    markFailed()
  }
}

// Metric display
const avgConfidence = computed(() => {
  if (rankedSites.value.length) {
    const avg = rankedSites.value.reduce((a, s) => a + s.confidence, 0) / rankedSites.value.length
    return Math.round(avg)
  }
  const scored = legacySites.value.filter((s) => s.scoreBreakdown)
  if (!scored.length) return null
  return Math.round(scored.reduce((a, s) => a + (s.scoreBreakdown?.confidence ?? 0), 0) / scored.length)
})

const dataCoverage = computed(() => {
  const avail = sources.value.filter((s) => s.available).length
  return sources.value.length ? `${avail}/${sources.value.length}` : '—'
})

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
    // Try to load any legacy sites
    try {
      legacySites.value = await api.getProjectSites(projectId)
    } catch {
      // No legacy sites — that's fine
    }
    // Fly to relevant region based on spec
    if (data.spec?.targetCountry === 'India') flyToRegion(78, 22, 2_800_000)
    else if (data.spec?.targetCountry === 'USA') flyToRegion(-100, 38, 3_500_000)
    else flyToRegion(20, 22, 14_000_000)
  } catch (err) {
    loadError.value = String(err)
  }
})
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <LayoutErrorState v-if="loadError" class="m-4 shrink-0" :message="loadError" />

    <template v-else>
      <!-- Project command bar -->
      <div class="shrink-0 border-b border-surface-border px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span class="font-semibold text-zinc-200">{{ brief?.name ?? 'Project' }}</span>
        <span class="text-zinc-600">|</span>
        <span class="text-zinc-500">Dataset <span class="text-zinc-300">{{ catalogSource ?? '—' }} v0.1</span></span>
        <span class="text-zinc-500">Policy <span class="font-mono text-zinc-300">{{ learningStatus?.activePolicyVersion ?? learningStatus?.scoringPolicyVersion ?? '—' }}</span></span>
        <span class="text-zinc-500">Confidence <span class="text-zinc-300">{{ avgConfidence ?? '—' }}</span></span>
        <span class="text-zinc-500">Sources <span class="text-zinc-300">{{ dataCoverage }}</span></span>
        <span class="text-zinc-500">
          Model
          <span :class="modelStatus?.modelEndpointReachable ? 'status-ready' : 'status-degraded'">
            {{ modelStatus?.modelEndpointReachable ? 'live' : 'deterministic' }}
          </span>
        </span>
        <span class="text-zinc-500">Map <span class="text-zinc-400">{{ mapReadinessLabel }}</span></span>
      </div>

      <!-- Unsupported region error -->
      <div
        v-if="unsupportedRegion"
        class="shrink-0 m-3 p-4 bg-zinc-900 border border-red-900/50 rounded-lg"
      >
        <p class="text-sm font-semibold text-red-400 mb-1">Unsupported region</p>
        <p class="text-xs text-zinc-400 leading-relaxed">
          Solux currently supports solar screening in India and the United States. This project
          cannot be created for the requested country yet.
        </p>
        <p v-if="unsupportedCountries.length" class="text-xs text-zinc-600 mt-2">
          Flagged: {{ unsupportedCountries.join(', ') }}
        </p>
        <p class="text-[10px] text-zinc-600 mt-3">
          To continue, revise the prompt to focus on India or the United States.
        </p>
      </div>

      <LayoutSplitPane left-width="260px" right-width="290px" class="flex-1 min-h-0 h-full">
        <!-- LEFT: query + constraints + layers -->
        <template #left>
          <div class="p-3 space-y-3 overflow-y-auto h-full max-h-full">
            <!-- Query panel -->
            <UiCard class="p-3">
              <div class="solux-panel-header border-0 px-0 pt-0">Ask Solux</div>
              <p class="text-[11px] text-zinc-600 mt-1 mb-2">
                Natural-language queries parse requirements, rank evidence-backed sites, and fly the globe to results.
              </p>
              <textarea
                v-model="queryText"
                rows="3"
                :placeholder="`e.g. Find 100 MW solar+storage sites in ${spec?.targetRegion ?? 'Rajasthan'} with low vegetation conflict…`"
                class="w-full bg-zinc-900/50 border border-surface-border rounded px-2.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none focus:border-zinc-600"
                :disabled="queryLoading"
                @keydown.ctrl.enter="handleQuery(queryText.trim())"
              />
              <div class="flex items-center justify-between mt-2">
                <span class="text-[10px] text-zinc-600">Ctrl+Enter · India or United States</span>
                <UiButton
                  variant="primary"
                  size="sm"
                  :disabled="!canQuery"
                  @click="handleQuery(queryText.trim())"
                >
                  {{ queryLoading ? 'Running…' : 'Ask' }}
                </UiButton>
              </div>

              <!-- Query result metadata -->
              <div v-if="lastResult && !queryLoading" class="mt-3 border-t border-surface-border pt-3 space-y-2">
                <div class="flex flex-wrap gap-2 text-[10px]">
                  <UiBadge :label="`v${lastResult.datasetVersion}`" variant="status" state="READY" />
                  <UiBadge
                    :label="lastResult.modelRerankUsed ? 'Model rerank' : 'Deterministic'"
                    variant="status"
                    :state="lastResult.modelRerankUsed ? 'READY' : 'DEGRADED'"
                  />
                  <UiBadge
                    v-if="lastResult.report?.guardPassed"
                    label="Evidence guard ✓"
                    variant="status"
                    state="READY"
                  />
                </div>
                <p class="text-xs text-zinc-400 leading-relaxed line-clamp-4">{{ lastResult.report?.summary }}</p>
                <ul v-if="missingWarnings.length" class="text-[10px] text-amber-500/90 space-y-0.5">
                  <li v-for="(w, i) in missingWarnings.slice(0, 3)" :key="i">{{ w }}</li>
                </ul>
              </div>

              <LayoutErrorState v-if="queryError && !unsupportedRegion" class="mt-3" :message="queryError" />
            </UiCard>

            <!-- Spec constraints -->
            <ProjectParsedConstraintReview v-if="spec" :spec="spec" />
            <UiCard v-else-if="brief">
              <div class="solux-panel-header">Requirement</div>
              <p class="p-3 text-xs text-zinc-400 leading-relaxed">{{ brief.rawPrompt }}</p>
            </UiCard>

            <!-- Layer controls -->
            <MapLayerTogglePanel :layers="layers" @toggle="toggleLayer" />
          </div>
        </template>

        <!-- CENTER: 3D globe -->
        <div class="relative flex flex-col min-h-0 flex-1 h-full w-full">
          <EarthEarthWorkspace
            class="absolute inset-0"
            :sites="globeSites"
            :layers="layers"
            :selected-id="selectedId"
            @select="onGlobeSelect"
          />
          <MapSiteHoverCard
            :site="globeSites.find((s) => s.id === selectedId) ?? null"
          />
        </div>

        <!-- RIGHT: top 10 ranking panel -->
        <template #right>
          <div class="h-full max-h-full overflow-y-auto flex flex-col">
            <SitesSiteRankingPanel
              :ranked-sites="rankedSites.length ? rankedSites : undefined"
              :sites="!rankedSites.length ? globeSites : undefined"
              :project-id="projectId"
              :selected-id="selectedId"
              :model-rerank-used="modelRerankUsed"
              class="flex-1"
              @select="selectedId = $event"
              @focus="onFocusSite"
            />
          </div>
        </template>
      </LayoutSplitPane>

      <!-- BOTTOM: command drawer with pipeline steps -->
      <ProjectCommandCenterDrawer
        :project-id="projectId"
        :pipeline-steps="pipelineSteps"
      />
    </template>
  </div>
</template>
