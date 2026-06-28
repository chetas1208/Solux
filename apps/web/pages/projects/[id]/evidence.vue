<script setup lang="ts">
definePageMeta({ commandTitle: 'Evidence trace' })

const route = useRoute()
const projectId = route.params.id as string
const api = useApiClient()

const { data, pending, error } = await useAsyncData(`evidence-${projectId}`, async () => {
  const [project, evidence, sites] = await Promise.all([
    api.getProject(projectId),
    api.getProjectEvidence(projectId),
    api.getProjectSites(projectId),
  ])
  return { project, evidence, sites }
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6 space-y-4">
    <LayoutPageHeader
      title="Evidence trace"
      subtitle="Full audit trail from parsed request through scoring."
    />

    <LayoutLoadingState v-if="pending" />
    <LayoutErrorState v-else-if="error" :message="String(error)" />
    <template v-else-if="data">
      <EvidenceEvidenceTrace
        :brief="data.project.brief"
        :spec="data.project.spec"
        :evidence="data.evidence"
      />
      <UiCard>
        <div class="solux-panel-header">Scored candidates ({{ data.sites.length }})</div>
        <div class="p-4 text-xs text-zinc-500">
          {{ data.sites.filter(s => s.scoreBreakdown).length }} sites scored from configured data sources.
        </div>
      </UiCard>
      <ReportEvidenceTable :evidence="data.evidence" />
    </template>
  </div>
</template>
