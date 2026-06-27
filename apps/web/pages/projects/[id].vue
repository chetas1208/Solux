<script setup lang="ts">
import type { ProjectBrief, ProjectSpec, CandidateSite, ScoreBreakdown, FatalFlawDecision } from '@solux/shared'

const route = useRoute()
const id = route.params['id'] as string
const { getProject, parsePrompt, runScreening, getProjectSites } = useApi()

const state = ref<'loading' | 'brief' | 'parsing' | 'spec' | 'screening' | 'results' | 'error'>('loading')
const brief = ref<ProjectBrief | null>(null)
const spec = ref<ProjectSpec | null>(null)
const sites = ref<Array<CandidateSite & { scoreBreakdown: ScoreBreakdown | null }>>([])
const errors = ref<string[]>([])
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await getProject(id)
    brief.value = data.brief
    spec.value = data.spec
    if (data.spec) {
      state.value = 'spec'
      // Auto-load sites if already screened
      try {
        const s = await getProjectSites(id)
        if (s.length) {
          sites.value = s
          state.value = 'results'
        }
      } catch {}
    } else {
      state.value = 'brief'
    }
  } catch (err) {
    errorMsg.value = String(err)
    state.value = 'error'
  }
})

async function doParse() {
  state.value = 'parsing'
  try {
    const result = await parsePrompt(id)
    spec.value = result.spec
    state.value = 'spec'
  } catch (err) {
    errorMsg.value = String(err)
    state.value = 'error'
  }
}

async function doScreen() {
  state.value = 'screening'
  try {
    const result = await runScreening(id)
    errors.value = result.errors
    const s = await getProjectSites(id)
    sites.value = s
    state.value = 'results'
  } catch (err) {
    errorMsg.value = String(err)
    state.value = 'error'
  }
}

function decisionClass(d: string) {
  if (d === 'GO') return 'decision-go'
  if (d === 'INVESTIGATE') return 'decision-investigate'
  return 'decision-kill'
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8">
    <!-- Breadcrumb -->
    <div class="text-xs text-slate-600 mb-6">
      <NuxtLink to="/projects" class="hover:text-slate-400">Projects</NuxtLink>
      <span class="mx-2">/</span>
      <span class="text-slate-400">{{ id.slice(0, 8) }}</span>
    </div>

    <!-- Loading -->
    <div v-if="state === 'loading'" class="text-slate-500 text-sm">Loading project...</div>

    <!-- Error -->
    <div v-else-if="state === 'error'" class="text-red-400 text-sm">{{ errorMsg }}</div>

    <!-- Brief stage: prompt Gemini to parse -->
    <div v-else-if="state === 'brief' || state === 'parsing'">
      <div class="panel p-4 mb-6 max-w-2xl">
        <div class="panel-header mb-3">Project Requirement</div>
        <p class="text-sm text-slate-300 leading-relaxed">{{ brief?.rawPrompt }}</p>
      </div>
      <button
        :disabled="state === 'parsing'"
        class="px-4 py-2 bg-solar text-slate-900 text-sm font-semibold rounded disabled:opacity-40"
        @click="doParse"
      >
        {{ state === 'parsing' ? 'Parsing with Gemini...' : 'Parse Requirements' }}
      </button>
    </div>

    <!-- Spec review stage -->
    <div v-else-if="state === 'spec' && spec">
      <div class="grid grid-cols-2 gap-4 mb-6 max-w-2xl">
        <div class="panel p-3">
          <div class="text-xs text-slate-500 mb-1">Target Capacity</div>
          <div class="text-sm font-semibold">{{ spec.targetCapacityMW }} MW</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-slate-500 mb-1">Storage</div>
          <div class="text-sm font-semibold">{{ spec.storageCapacityMW ? `${spec.storageCapacityMW} MW / ${spec.storageHours ?? '?'}h` : 'None' }}</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-slate-500 mb-1">Region</div>
          <div class="text-sm font-semibold">{{ spec.targetRegion }}</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-slate-500 mb-1">Min GHI</div>
          <div class="text-sm font-semibold">{{ spec.minGhiKwhM2Day }} kWh/m²/day</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-slate-500 mb-1">Max Grid Distance</div>
          <div class="text-sm font-semibold">{{ spec.maxGridDistanceKm }} km</div>
        </div>
        <div class="panel p-3">
          <div class="text-xs text-slate-500 mb-1">Site Types</div>
          <div class="text-sm font-semibold">{{ spec.preferredSiteTypes.join(', ') }}</div>
        </div>
      </div>

      <div v-if="spec.additionalConstraints.length" class="mb-4 text-xs text-slate-500">
        Additional: {{ spec.additionalConstraints.join(' · ') }}
      </div>

      <button
        class="px-4 py-2 bg-solar text-slate-900 text-sm font-semibold rounded"
        @click="doScreen"
      >
        Run Site Screening
      </button>
    </div>

    <!-- Screening in progress -->
    <div v-else-if="state === 'screening'" class="text-slate-400 text-sm">
      Fetching real data and scoring candidate sites...
    </div>

    <!-- Results -->
    <div v-else-if="state === 'results'">
      <div v-if="errors.length" class="mb-4 bg-amber-500/10 border border-amber-500/30 rounded p-3 text-amber-400 text-xs">
        <div class="font-semibold mb-1">Data warnings ({{ errors.length }})</div>
        <div v-for="err in errors" :key="err" class="mt-0.5">{{ err }}</div>
      </div>

      <SiteRankingPanel :sites="sites" :project-id="id" />
    </div>
  </div>
</template>
