<script setup lang="ts">
definePageMeta({ commandTitle: 'Projects' })

const api = useApiClient()
const { data: projects, pending, error, refresh } = await useAsyncData('projects-list', () =>
  api.listProjects(),
)
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <LayoutPageHeader
      title="Screening projects"
      subtitle="Evidence-backed site ranking across India and the United States."
      actions
    >
      <template #actions>
        <UiButton variant="ghost" size="sm" @click="refresh()">Refresh</UiButton>
      </template>
    </LayoutPageHeader>

    <div class="px-4 pb-6">
      <ProjectPromptBox />
    </div>

    <div class="px-4 pb-12">
      <LayoutLoadingState v-if="pending" label="Loading projects…" />
      <LayoutErrorState v-else-if="error" :message="String(error)" retry @retry="refresh()" />
      <LayoutEmptyState
        v-else-if="!projects?.length"
        title="No projects yet"
        description="Create a screening project to parse requirements and run fatal-flaw analysis."
        action-label="Start from home"
        action-to="/"
      />
      <div v-else class="grid gap-3 sm:grid-cols-2">
        <ProjectShowcaseCard v-for="p in projects" :key="p.id" :project="p" />
      </div>
    </div>
  </div>
</template>
