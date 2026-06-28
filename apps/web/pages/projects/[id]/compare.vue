<script setup lang="ts">
definePageMeta({ commandTitle: 'Compare sites' })

const route = useRoute()
const projectId = route.params.id as string
const api = useApiClient()

const { data: sites, pending, error } = await useAsyncData(`compare-${projectId}`, () => api.getProjectSites(projectId))
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <LayoutPageHeader
      title="Site comparison"
      subtitle="Tradeoff scatter from backend-scored candidates only."
    />

    <LayoutLoadingState v-if="pending" />
    <LayoutErrorState v-else-if="error" :message="String(error)" />
    <template v-else>
      <ChartsTradeoffScatter
        :sites="sites ?? []"
        :project-id="projectId"
        class="mb-6"
        @select="(id) => navigateTo(`/projects/${projectId}/sites/${id}`)"
      />
      <SitesSiteRankingPanel :sites="sites ?? []" :project-id="projectId" />
    </template>
  </div>
</template>
