<script setup lang="ts">
const prompt = ref('')
const { createProject, loading, error, offline } = useProjects()
const router = useRouter()

async function submit() {
  if (!prompt.value.trim() || loading.value) return
  const brief = await createProject(prompt.value.trim())
  if (brief) await router.push(`/projects/${brief.id}`)
}
</script>

<template>
  <UiCard class="p-4">
    <div class="solux-panel-header border-0 px-0 pt-0">Project requirement</div>
    <textarea
      v-model="prompt"
      rows="4"
      placeholder="Describe region, capacity, site types, and hard avoids in plain language..."
      class="w-full mt-2 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none leading-relaxed"
      :disabled="loading"
      @keydown.ctrl.enter="submit"
    />
    <div class="flex items-center justify-between mt-3 pt-3 border-t border-surface-border">
      <span class="text-[11px] text-zinc-600">Ctrl+Enter to submit</span>
      <UiButton variant="primary" :disabled="!prompt.trim() || loading" @click="submit">
        {{ loading ? 'Creating…' : 'Parse & configure' }}
      </UiButton>
    </div>
    <LayoutErrorState
      v-if="error"
      class="mt-3"
      :message="error"
      :offline="offline"
    />
  </UiCard>
</template>
