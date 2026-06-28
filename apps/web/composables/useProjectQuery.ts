import { ApiClientError } from '~/composables/useApiClient'
import { formatApiError } from '~/utils/formatApiError'

export interface RankedSiteResult {
  rank: number
  candidateId: string
  country: string
  state: string
  siteSurfaceType: string
  finalScore: number
  confidence: number
  decision: string
  centroid?: { type: string; coordinates: [number, number] }
  topFatalFlaws?: string[]
  topPositiveFactors?: string[]
  evidenceBacked?: boolean
  displayLabel?: string
  formattedAddress?: string | null
  locality?: string | null
  adminArea1?: string | null
}

export interface ProjectQueryResult {
  queryId: string
  parsedSpec: Record<string, unknown>
  rankedSites: RankedSiteResult[]
  report: {
    summary: string
    guardPassed: boolean
    hallucinationScore: number
    unsupportedClaims: string[]
  }
  evidenceSummary: Array<Record<string, unknown>>
  missingDataWarnings: string[]
  modelRerankUsed: boolean
  scoringPolicyVersion: string
  datasetVersion: string
  spacesArtifacts: Record<string, unknown>
  pipelineSteps?: Array<{ id: string; label: string; state: string; note?: string }>
  unsupportedCountries?: string[]
  /** Legacy compat */
  answer?: string
  highlightSiteIds?: string[]
  siteCount?: number
}

export function useProjectQuery() {
  const api = useApiClient()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastResult = ref<ProjectQueryResult | null>(null)
  const unsupportedRegion = ref(false)
  const unsupportedCountries = ref<string[]>([])

  async function submitQuery(projectId: string, query: string): Promise<ProjectQueryResult | null> {
    loading.value = true
    error.value = null
    unsupportedRegion.value = false
    unsupportedCountries.value = []
    try {
      const result = await api.submitProjectQuery(projectId, query)
      lastResult.value = {
        ...result,
        answer: result.report?.summary,
        highlightSiteIds: result.rankedSites?.map((s) => s.candidateId) ?? [],
        siteCount: result.rankedSites?.length ?? 0,
      }
      if (result.unsupportedCountries?.length) {
        unsupportedCountries.value = result.unsupportedCountries
      }
      return lastResult.value
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 422 || err.message === 'UNSUPPORTED_REGION') {
          unsupportedRegion.value = true
          error.value =
            err.detail ??
            'Solux currently supports solar screening in India and the United States. This project cannot be created for the requested country yet.'
        } else {
          error.value = err.detail ? `${err.message}: ${err.detail}` : err.message
        }
      } else {
        error.value = String(err)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, lastResult, unsupportedRegion, unsupportedCountries, submitQuery }
}
