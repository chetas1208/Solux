import type { ProjectBrief, ProjectSpec, CandidateSite, ScoreBreakdown, EvidenceItem, FatalFlawDecision, DataSourceStatus } from '@solux/shared'

export function useApi() {
  const config = useRuntimeConfig()
  const base = config.public.apiBaseUrl as string

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    const json = await res.json() as { data: T }
    return json.data
  }

  return {
    // Projects
    createProject: (rawPrompt: string) =>
      request<ProjectBrief>('/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ rawPrompt }),
      }),

    listProjects: () => request<ProjectBrief[]>('/v1/projects'),

    getProject: (id: string) =>
      request<{ brief: ProjectBrief; spec: ProjectSpec | null }>(`/v1/projects/${id}`),

    parsePrompt: (id: string) =>
      request<{ spec: ProjectSpec; traceId: string }>(`/v1/projects/${id}/parse-prompt`, {
        method: 'POST',
      }),

    runScreening: (id: string) =>
      request<{
        siteCount: number
        evidenceCount: number
        decisions: Array<{
          siteId: string
          siteName?: string
          decision: string
          finalScore: number
          confidence: number
          headline: string
        }>
        errors: string[]
      }>(`/v1/projects/${id}/run-screening`, { method: 'POST' }),

    getProjectSites: (id: string) =>
      request<Array<CandidateSite & { scoreBreakdown: ScoreBreakdown | null }>>(
        `/v1/projects/${id}/sites`,
      ),

    getProjectEvidence: (id: string) => request<EvidenceItem[]>(`/v1/projects/${id}/evidence`),

    // Sites
    getSiteReport: (siteId: string) =>
      request<{
        site: CandidateSite
        decision: FatalFlawDecision
        evidence: EvidenceItem[]
        aiReport: unknown
        miniMaxAvailable: boolean
      }>(`/v1/sites/${siteId}/report`),

    getSiteEvidence: (siteId: string) => request<EvidenceItem[]>(`/v1/sites/${siteId}/evidence`),

    generateBriefing: (siteId: string) =>
      request<{ audioUrl: string | null; transcript: string; durationEstimateSec: number }>(
        `/v1/sites/${siteId}/report/briefing`,
        { method: 'POST' },
      ),

    // Data sources
    getDataSources: () => request<DataSourceStatus[]>('/v1/data-sources'),
  }
}
