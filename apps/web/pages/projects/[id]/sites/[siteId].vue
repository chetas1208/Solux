<script setup lang="ts">
definePageMeta({ commandTitle: 'Site report' })

const route = useRoute()
const projectId = route.params.id as string
const siteId = route.params.siteId as string

const api = useApiClient()
const { loading: reportLoading, error: reportError, report, evidence, briefing, briefingLoading, briefingError, fetchReport, fetchVoiceBriefing } = useReports()

onMounted(() => fetchReport(siteId))

const reportData = computed(() => report.value?.report)
</script>

<template>
  <div class="max-w-5xl mx-auto pb-12">
    <div class="px-4 py-3 text-xs text-zinc-600 flex gap-2">
      <NuxtLink :to="`/projects/${projectId}`" class="hover:text-zinc-400">← Workspace</NuxtLink>
      <span>·</span>
      <span class="font-mono text-zinc-500">{{ siteId.slice(0, 8) }}</span>
    </div>

    <LayoutLoadingState v-if="reportLoading" label="Generating evidence-guarded report…" />
    <ReportReportUnavailableState v-else-if="reportError" :message="reportError" />
    <template v-else-if="reportData">
      <div class="px-4 space-y-4">
        <ReportExecutiveDecision
          :decision="reportData.decision"
          :headline="reportData.headline"
          :summary="reportData.summary"
          :score="reportData.scoreBreakdown.finalScore"
          :confidence="reportData.scoreBreakdown.confidence"
        />

        <SitesSiteMetricGrid :score="reportData.scoreBreakdown" />
        <ReportScoreBreakdown :score="reportData.scoreBreakdown" />
        <ChartsLossStackedBar :score="reportData.scoreBreakdown" />

        <SitesFatalFlawList :flaws="reportData.killTriggers" :top-flaws="reportData.scoreBreakdown.topFatalFlaws" />
        <SitesMissingDataWarnings :warnings="reportData.missingDataWarnings" />
        <ReportEvidenceTable :evidence="evidence.length ? evidence : reportData.evidenceTable" />
        <EvidenceClaimVerificationTable :verification="reportData.claimVerification" />
        <ReportHallucinationScoreCard :score="reportData.hallucinationScore" :verification="reportData.claimVerification" />

        <UiCard v-if="reportData.recommendedNextSteps.length">
          <div class="solux-panel-header">What would change this decision?</div>
          <ul class="p-4 space-y-1 text-sm text-zinc-400">
            <li v-for="s in reportData.recommendedNextSteps" :key="s" class="flex gap-2">
              <span class="text-zinc-600">→</span>{{ s }}
            </li>
          </ul>
        </UiCard>

        <ReportVoiceBriefingPlayer
          :audio-url="briefing?.audioUrl ?? reportData.voiceBriefingUrl"
          :unavailable="briefingError?.includes('MiniMax')"
          :loading="briefingLoading"
          :error="briefingError"
          @generate="fetchVoiceBriefing(siteId)"
        />
      </div>
    </template>
  </div>
</template>
