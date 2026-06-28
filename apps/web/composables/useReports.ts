import type { SiteReportResponse, VoiceBriefingResponse, EvidenceItem } from '~/types/api'
import { ApiClientError } from '~/composables/useApiClient'

export function useReports() {
  const api = useApiClient()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const report = ref<SiteReportResponse | null>(null)
  const evidence = ref<EvidenceItem[]>([])
  const briefing = ref<VoiceBriefingResponse | null>(null)
  const briefingLoading = ref(false)
  const briefingError = ref<string | null>(null)

  async function fetchReport(siteId: string): Promise<SiteReportResponse | null> {
    loading.value = true
    error.value = null
    try {
      const [reportRes, evidenceRes] = await Promise.all([
        api.getSiteReport(siteId),
        api.getSiteEvidence(siteId),
      ])
      report.value = reportRes
      evidence.value = evidenceRes
      return reportRes
    } catch (err) {
      if (err instanceof ApiClientError) {
        error.value = err.detail ? `${err.message}: ${err.detail}` : err.message
      } else {
        error.value = String(err)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchVoiceBriefing(siteId: string): Promise<VoiceBriefingResponse | null> {
    briefingLoading.value = true
    briefingError.value = null
    try {
      const res = await api.generateVoiceBriefing(siteId)
      briefing.value = res
      return res
    } catch (err) {
      if (err instanceof ApiClientError) {
        briefingError.value = err.detail ? `${err.message}: ${err.detail}` : err.message
      } else {
        briefingError.value = String(err)
      }
      return null
    } finally {
      briefingLoading.value = false
    }
  }

  return {
    loading,
    error,
    report,
    evidence,
    briefing,
    briefingLoading,
    briefingError,
    fetchReport,
    fetchVoiceBriefing,
  }
}
