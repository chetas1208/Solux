<script setup lang="ts">
definePageMeta({ commandTitle: 'Projects' })

const api = useApiClient()
const { data: projects, pending, error, refresh } = await useAsyncData('projects-list', () => api.listProjects())

const prompt = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)
const router = useRouter()

async function createAndGo() {
  if (!prompt.value.trim()) return
  creating.value = true
  createError.value = null
  try {
    const brief = await api.createProject(prompt.value.trim())
    await router.push(`/projects/${brief.id}`)
  } catch (err) {
    createError.value = String(err)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <LayoutPageHeader title="Screening projects" subtitle="Kill bad sites early." actions>
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
      <div v-else class="space-y-2">
        <NuxtLink
          v-for="p in projects"
          :key="p.id"
          :to="`/projects/${p.id}`"
          class="solux-panel block p-4 hover:border-zinc-600 transition-colors"
        >
          <div class="text-sm text-zinc-200 line-clamp-2">{{ p.rawPrompt }}</div>
          <div class="text-[11px] font-mono text-zinc-600 mt-2">{{ p.id.slice(0, 8) }} · {{ new Date(p.createdAt).toLocaleString() }}</div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
