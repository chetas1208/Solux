import type {
  ProjectBrief,
  ProjectDetail,
  ParsePromptResult,
  ScreeningResult,
  SiteWithScore,
  SiteDetail,
  SiteReportResponse,
  VoiceBriefingResponse,
  EvidenceItem,
  HealthResponse,
  DataSourcesResponse,
  FatalFlawReport,
} from '~/types/api'
import type { ApiErrorBody } from '~/types/api'

export class ApiClientError extends Error {
  readonly status: number
  readonly detail?: string
  readonly offline: boolean

  constructor(message: string, status: number, detail?: string, offline = false) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.detail = detail
    this.offline = offline
  }
}

export function useApiClient() {
  const config = useRuntimeConfig()
  /** Browser: same-origin. SSR: loop back to this Nuxt server (embedded API). */
  const base = (import.meta.server
    ? (config.apiBaseUrl as string)
    : (config.public.apiBaseUrl as string)) || ''

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${base}${path}`, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...options,
      })
    } catch {
      throw new ApiClientError('Backend unreachable', 0, 'Check that the Solux API is running.', true)
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: res.statusText }))) as ApiErrorBody
      throw new ApiClientError(body.error ?? `HTTP ${res.status}`, res.status, body.detail, res.status === 0)
    }

    const json = (await res.json()) as { data: T }
    return json.data
  }

  async function requestRaw<T>(path: string, options?: RequestInit): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${base}${path}`, {
        headers: { Accept: 'application/json' },
        ...options,
      })
    } catch {
      throw new ApiClientError('Backend unreachable', 0, undefined, true)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: res.statusText }))) as ApiErrorBody
      throw new ApiClientError(body.error ?? `HTTP ${res.status}`, res.status, body.detail, false)
    }
    return (await res.json()) as T
  }

  return {
    baseUrl: base,

    health: () => requestRaw<HealthResponse>('/health'),

    createProject: (rawPrompt: string) =>
      request<ProjectBrief>('/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ rawPrompt }),
      }),

    listProjects: () => request<ProjectBrief[]>('/v1/projects'),

    getProject: (id: string) => request<ProjectDetail>(`/v1/projects/${id}`),

    parsePrompt: (id: string) =>
      request<ParsePromptResult>(`/v1/projects/${id}/parse-prompt`, { method: 'POST' }),

    runScreening: (id: string) =>
      request<ScreeningResult>(`/v1/projects/${id}/run-screening`, { method: 'POST' }),

    getProjectSites: (id: string) => request<SiteWithScore[]>(`/v1/projects/${id}/sites`),

    getProjectEvidence: (id: string) => request<EvidenceItem[]>(`/v1/projects/${id}/evidence`),

    getSite: (id: string) => request<SiteDetail>(`/v1/sites/${id}`),

    getSiteEvidence: (id: string) => request<EvidenceItem[]>(`/v1/sites/${id}/evidence`),

    getSiteReport: (id: string) => request<SiteReportResponse>(`/v1/sites/${id}/report`),

    generateVoiceBriefing: (id: string) =>
      request<VoiceBriefingResponse>(`/v1/sites/${id}/report/briefing`, { method: 'POST' }),

    getDataSources: (deep = false) =>
      requestRaw<DataSourcesResponse>(`/v1/data-sources${deep ? '?deep=true' : ''}`).then((r) => r.data),

    getMapProvidersStatus: () =>
      request<import('~/types/map').MapProvidersResponse>('/v1/map-providers/status'),

    getDatasetCatalog: () =>
      request<{ source: string; catalog: unknown; message?: string }>('/v1/dataset/catalog'),

    getModelOutputStatus: () =>
      request<import('~/composables/useModelOutputs').ModelOutputStatus>('/v1/model-outputs/status'),

    getLearningLoopStatus: () =>
      request<import('~/composables/useLearningLoop').LearningLoopStatus>('/v1/learning-loop/status'),

    getProjectModelRerank: (id: string) =>
      request<{ available: boolean; sites: unknown[]; message?: string }>(`/v1/projects/${id}/model-rerank`),

    submitProjectFeedback: (id: string, body: Record<string, unknown>) =>
      request<{ recorded: boolean; message: string }>(`/v1/projects/${id}/feedback`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    listReportsByProject: (projectId: string) =>
      request<FatalFlawReport[]>(`/v1/reports?projectId=${encodeURIComponent(projectId)}`),
  }
}
