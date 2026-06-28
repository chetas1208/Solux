import type { DataSourceStatus } from '@solux/shared'
import type {
  CapabilityItem,
  CapabilityMatrixRow,
  CapabilityState,
  ReadinessSummary,
} from '~/types/ui'
import { ApiClientError } from '~/composables/useApiClient'

function worstState(states: CapabilityState[]): CapabilityState {
  const order: CapabilityState[] = ['UNAVAILABLE', 'NOT_CONFIGURED', 'DEGRADED', 'UNKNOWN', 'READY']
  for (const s of order) {
    if (states.includes(s)) return s
  }
  return 'UNKNOWN'
}

export function useOperationalReadiness() {
  const api = useApiClient()
  const { sources, fetchSources, toCapability } = useDataSources()

  const loading = ref(false)
  const error = ref<string | null>(null)
  const offline = ref(false)
  const apiHealth = ref<{ ok: boolean; version?: string; checkedAt?: string }>({ ok: false })

  async function refresh(deep = true): Promise<void> {
    loading.value = true
    error.value = null
    offline.value = false
    try {
      const health = await api.health()
      apiHealth.value = { ok: health.status === 'ok', version: health.version, checkedAt: health.timestamp }
      await fetchSources(deep)
    } catch (err) {
      if (err instanceof ApiClientError) {
        error.value = err.message
        offline.value = err.offline
      } else {
        error.value = String(err)
      }
      apiHealth.value = { ok: false, checkedAt: new Date().toISOString() }
    } finally {
      loading.value = false
    }
  }

  const coreCapabilities = computed<CapabilityItem[]>(() => {
    const now = apiHealth.value.checkedAt ?? new Date().toISOString()
    const pvgis = sources.value.find((s) => s.id === 'pvgis')
    const gemini = sources.value.find((s) => s.id === 'gemini')
    const geminiState: CapabilityState = gemini
      ? gemini.available ? 'READY' : 'NOT_CONFIGURED'
      : 'NOT_CONFIGURED'
    const mongoState: CapabilityState = apiHealth.value.ok ? 'READY' : 'UNAVAILABLE'

    return [
      {
        id: 'backend_api',
        name: 'Backend API',
        group: 'core_runtime',
        state: apiHealth.value.ok ? 'READY' : 'UNAVAILABLE',
        whyItMatters: 'All screening, scoring, and evidence flows through the API.',
        lastCheckedAt: now,
        confidenceImpact: apiHealth.value.ok ? 'Core screening available.' : 'All capabilities offline.',
        fallbackBehavior: 'None — API must be reachable.',
        actionNeeded: apiHealth.value.ok ? undefined : 'Start the Solux API service.',
      },
      {
        id: 'mongodb',
        name: 'MongoDB',
        group: 'core_runtime',
        state: mongoState,
        whyItMatters: 'Stores projects, sites, evidence, and geospatial results.',
        lastCheckedAt: now,
        confidenceImpact: mongoState === 'READY' ? 'Project persistence available.' : 'Cannot persist or retrieve runs.',
        fallbackBehavior: 'None for persisted projects.',
        actionNeeded: mongoState === 'READY' ? undefined : 'Configure MONGODB_URI on backend.',
      },
      {
        id: 'gemini',
        name: 'Gemini',
        group: 'core_runtime',
        state: geminiState,
        whyItMatters: 'Parses prompts, plans screening, generates grounded reports.',
        lastCheckedAt: gemini?.lastCheckedAt ?? now,
        confidenceImpact: geminiState === 'READY' ? 'Prompt parsing and AI reports active.' : 'Prompt parsing and AI reports require Gemini.',
        fallbackBehavior: 'Deterministic scoring still runs; AI reports unavailable.',
        actionNeeded: gemini?.unavailableReason,
      },
      {
        id: 'report_generator',
        name: 'Report generator',
        group: 'core_runtime',
        state: geminiState === 'READY' ? 'READY' : 'DEGRADED',
        whyItMatters: 'Produces evidence-guarded fatal-flaw reports.',
        lastCheckedAt: now,
        confidenceImpact: 'Without Gemini, reports cannot be generated.',
        fallbackBehavior: 'Score breakdown and evidence table still available.',
        actionNeeded: geminiState !== 'READY' ? 'Configure Gemini for AI reports.' : undefined,
      },
      {
        id: 'pvgis_check',
        name: 'PVGIS fallback path',
        group: 'data_coverage',
        state: pvgis?.available ? 'READY' : 'UNAVAILABLE',
        whyItMatters: 'Global irradiance when NREL NSRDB unavailable.',
        lastCheckedAt: pvgis?.lastCheckedAt,
        confidenceImpact: pvgis?.available ? 'Global solar coverage active.' : 'Irradiance confidence reduced.',
        fallbackBehavior: 'NREL NSRDB when configured for US sites.',
        actionNeeded: pvgis?.unavailableReason,
      },
    ]
  })

  const dataCapabilities = computed(() => sources.value.map(toCapability))

  const aiCapabilities = computed<CapabilityItem[]>(() => {
    const gemini = sources.value.find((s) => s.id === 'gemini')
    const minimax = sources.value.find((s) => s.id === 'minimax')
    const mojo = sources.value.find((s) => s.id === 'mojo_kernel')
    const geminiState: CapabilityState = gemini ? (gemini.available ? 'READY' : 'NOT_CONFIGURED') : 'NOT_CONFIGURED'
    const minimaxState: CapabilityState = minimax ? (minimax.available ? 'READY' : 'NOT_CONFIGURED') : 'NOT_CONFIGURED'
    const mojoState: CapabilityState = mojo ? (mojo.available ? 'READY' : 'NOT_CONFIGURED') : 'NOT_CONFIGURED'

    return [
      {
        id: 'gemini_planner',
        name: 'Gemini planner',
        group: 'ai_model',
        state: geminiState,
        whyItMatters: 'Parses natural-language prompts and plans screening runs.',
        confidenceImpact: geminiState === 'READY' ? 'Prompt parsing active.' : 'Tool plan quality depends on Gemini availability.',
        fallbackBehavior: 'Deterministic screening pipeline used.',
        actionNeeded: gemini?.unavailableReason,
      },
      {
        id: 'gemini_verifier',
        name: 'Gemini claim verifier',
        group: 'ai_model',
        state: geminiState,
        whyItMatters: 'Second-pass claim verification on reports.',
        confidenceImpact: geminiState === 'READY' ? 'Claim verification active.' : 'Hallucination scoring degraded without verifier.',
        fallbackBehavior: 'Evidence guard still filters unsupported claims.',
        actionNeeded: gemini?.unavailableReason,
      },
      {
        id: 'minimax',
        name: 'MiniMax voice briefing',
        group: 'ai_model',
        state: minimaxState,
        whyItMatters: 'Optional spoken 60-second executive briefing.',
        confidenceImpact: minimaxState === 'READY' ? 'Voice briefings available.' : 'Voice briefing disabled. Core screening unaffected.',
        fallbackBehavior: 'Text report always available.',
        actionNeeded: minimax?.unavailableReason,
      },
      {
        id: 'mojo_kernel',
        name: 'Mojo scoring kernel',
        group: 'ai_model',
        state: mojoState,
        whyItMatters: 'High-performance scoring kernel path.',
        confidenceImpact: mojoState === 'READY' ? 'Mojo kernel active.' : 'TypeScript scoring fallback active.',
        fallbackBehavior: 'TypeScript scoring always available.',
        actionNeeded: mojo?.unavailableReason,
      },
    ]
  })

  const scoringCapabilities = computed<CapabilityItem[]>(() => {
    const mojo = sources.value.find((s) => s.id === 'mojo_kernel')
    const mojoState: CapabilityState = mojo ? (mojo.available ? 'READY' : 'NOT_CONFIGURED') : 'NOT_CONFIGURED'

    return [
    {
      id: 'ts_scoring',
      name: 'TypeScript scoring fallback',
      group: 'scoring_execution',
      state: 'READY',
      whyItMatters: 'Deterministic fatal-flaw scoring when Mojo unavailable.',
      confidenceImpact: 'Core decisions always computed.',
      fallbackBehavior: 'Primary path when Mojo kernel offline.',
    },
    {
      id: 'mojo_kernel',
      name: 'Mojo scoring kernel',
      group: 'scoring_execution',
      state: mojoState,
      whyItMatters: 'High-performance scoring kernel path.',
      confidenceImpact: mojoState === 'READY' ? 'Mojo kernel active.' : 'TypeScript scoring fallback active.',
      fallbackBehavior: 'TypeScript scoring fallback active.',
      actionNeeded: mojo?.unavailableReason,
    },
    {
      id: 'evidence_guard',
      name: 'Evidence guard',
      group: 'scoring_execution',
      state: 'READY',
      whyItMatters: 'Strips unsupported claims from reports.',
      confidenceImpact: 'Reports grounded in retrieved evidence.',
      fallbackBehavior: 'Claims without evidence marked unsupported.',
    },
    {
      id: 'hallucination_scorer',
      name: 'Hallucination scorer',
      group: 'scoring_execution',
      state: 'READY',
      whyItMatters: 'Quantifies unsupported claim fraction in reports.',
      confidenceImpact: 'Visible on report when verification runs.',
      fallbackBehavior: 'Score shown as unavailable if verification skipped.',
    },
  ]
  })

  const capabilityMatrix = computed<CapabilityMatrixRow[]>(() => {
    const src = (ids: string[]) =>
      ids
        .map((id) => sources.value.find((s) => s.id === id)?.label)
        .filter(Boolean)
        .join(', ') || '—'

    const stateFor = (ids: string[]): CapabilityState => {
      const matched = ids.map((id) => sources.value.find((s) => s.id === id)).filter(Boolean) as DataSourceStatus[]
      if (!matched.length) return 'NOT_CONFIGURED'
      if (matched.every((s) => s.available)) return 'READY'
      if (matched.some((s) => s.available)) return 'DEGRADED'
      return 'UNAVAILABLE'
    }

    return [
      { id: 'parse', capability: 'Prompt parsing', state: stateFor(['gemini']), requiredSources: [src(['gemini'])], fallback: 'Manual spec entry unavailable', confidenceImpact: 'Cannot parse natural-language requirements.' },
      { id: 'land', capability: 'Land solar screening', state: stateFor(['pvgis', 'nrel_nsrdb', 'global_solar_atlas', 'openstreetmap']), requiredSources: [src(['pvgis', 'nrel_nsrdb']), src(['openstreetmap'])], fallback: 'PVGIS for irradiance', confidenceImpact: 'Missing irradiance lowers power confidence.' },
      { id: 'water', capability: 'Floating/inland water screening', state: stateFor(['gebco', 'openstreetmap']), requiredSources: [src(['gebco']), src(['openstreetmap'])], fallback: 'Land-only candidates', confidenceImpact: 'GEBCO unavailable. Shallow-water screening disabled for this run.' },
      { id: 'coastal', capability: 'Shallow coastal screening', state: stateFor(['gebco', 'copernicus_marine']), requiredSources: [src(['gebco']), src(['copernicus_marine'])], fallback: 'Inland water only', confidenceImpact: 'Wave/current data missing reduces coastal confidence.' },
      { id: 'pv', capability: 'PV output estimation', state: stateFor(['pvgis', 'nrel_nsrdb']), requiredSources: [src(['pvgis', 'nrel_nsrdb'])], fallback: 'PVGIS global', confidenceImpact: 'NREL NSRDB unavailable. U.S. irradiance confidence reduced. PVGIS fallback is active.' },
      { id: 'veg', capability: 'Vegetation tradeoff', state: stateFor(['global_solar_atlas']), requiredSources: [src(['global_solar_atlas'])], fallback: 'Conservative assumption', confidenceImpact: 'Vegetation layer confidence reduced.' },
      { id: 'grid', capability: 'Grid proximity', state: stateFor(['openstreetmap']), requiredSources: [src(['openstreetmap'])], fallback: 'None', confidenceImpact: 'Grid scoring unavailable without OSM.' },
      { id: 'storage', capability: 'Storage feasibility', state: 'READY', requiredSources: ['Project spec'], fallback: 'Rule-based scoring', confidenceImpact: 'Based on spec constraints only.' },
      { id: 'loss', capability: 'Power-loss scoring', state: stateFor(['pvgis', 'nrel_nsrdb']), requiredSources: [src(['pvgis'])], fallback: 'Regional defaults', confidenceImpact: 'Loss estimates less precise.' },
      { id: 'atmo', capability: 'Atmospheric risk', state: stateFor(['pvgis', 'nrel_nsrdb']), requiredSources: [src(['pvgis'])], fallback: 'Conservative dust/soiling factor', confidenceImpact: 'Atmospheric confidence may be reduced.' },
      { id: 'reports', capability: 'Evidence-guarded reports', state: stateFor(['gemini']), requiredSources: [src(['gemini']), 'Evidence store'], fallback: 'Score breakdown only', confidenceImpact: 'AI narrative unavailable without Gemini.' },
      { id: 'briefing', capability: 'MiniMax briefing', state: stateFor(['minimax']), requiredSources: [src(['minimax'])], fallback: 'Text report', confidenceImpact: 'Voice briefing disabled.' },
      { id: 'mojo', capability: 'Mojo scoring', state: stateFor(['mojo_kernel']), requiredSources: [src(['mojo_kernel'])], fallback: 'TypeScript scoring', confidenceImpact: 'Performance path unavailable.' },
    ]
  })

  const summary = computed<ReadinessSummary>(() => {
    const dataStates = sources.value.map((s) => (s.available ? 'READY' : s.unavailableReason?.includes('not set') ? 'NOT_CONFIGURED' : 'UNAVAILABLE') as CapabilityState)
    const landSources = ['pvgis', 'nrel_nsrdb', 'global_solar_atlas', 'openstreetmap']
    const waterSources = ['gebco', 'copernicus_marine']
    const landStates = landSources.map((id) => {
      const s = sources.value.find((x) => x.id === id)
      if (!s) return 'NOT_CONFIGURED' as CapabilityState
      return s.available ? 'READY' : s.unavailableReason?.includes('not set') ? 'NOT_CONFIGURED' : 'UNAVAILABLE'
    })
    const waterStates = waterSources.map((id) => {
      const s = sources.value.find((x) => x.id === id)
      if (!s) return 'NOT_CONFIGURED' as CapabilityState
      return s.available ? 'READY' : s.unavailableReason?.includes('not set') ? 'NOT_CONFIGURED' : 'UNAVAILABLE'
    })

    return {
      overall: worstState([
        apiHealth.value.ok ? 'READY' : 'UNAVAILABLE',
        ...dataStates,
      ]),
      coreScreening: apiHealth.value.ok ? worstState(landStates) : 'UNAVAILABLE',
      landScreening: worstState(landStates),
      waterScreening: worstState(waterStates),
      voiceBriefing: sources.value.find((s) => s.id === 'minimax')?.available ? 'READY' : 'NOT_CONFIGURED',
      modelCache: 'NOT_CONFIGURED',
    }
  })

  return {
    loading,
    error,
    offline,
    apiHealth,
    sources,
    summary,
    coreCapabilities,
    dataCapabilities,
    aiCapabilities,
    scoringCapabilities,
    capabilityMatrix,
    refresh,
  }
}
