<script setup lang="ts">
const prompt = ref('')
const { createProject, loading, error, offline } = useProjects()
const router = useRouter()

const MIN_LEN = 10
const tooShort = computed(() => prompt.value.trim().length > 0 && prompt.value.trim().length < MIN_LEN)
const canSubmit = computed(() => prompt.value.trim().length >= MIN_LEN && !loading.value)

async function submit() {
  if (!canSubmit.value) return
  const brief = await createProject(prompt.value.trim())
  if (brief) await router.push(`/projects/${brief.id}`)
}
</script>

<template>
  <div>
    <div class="relative">
      <textarea
        v-model="prompt"
        rows="4"
        placeholder="Example: Find the best sites for a 100 MW solar + 50 MW battery project in Rajasthan and Gujarat. Avoid dense vegetation, steep slopes, and areas far from roads or transmission."
        class="w-full bg-zinc-900/80 border border-surface-border rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none focus:border-zinc-500 transition-colors leading-relaxed"
        :disabled="loading"
        @keydown.ctrl.enter="submit"
      />
      <div class="absolute bottom-3 right-3 flex items-center gap-2">
        <span class="text-[10px] text-zinc-700">Ctrl+Enter</span>
        <UiButton variant="primary" size="sm" :disabled="!canSubmit" @click="submit">
          {{ loading ? 'Creating…' : 'Create project' }}
        </UiButton>
      </div>
    </div>
    <p v-if="tooShort" class="text-[11px] text-decision-kill mt-1.5">
      Add more detail — region, capacity, or site type.
    </p>
    <LayoutErrorState
      v-if="error"
      class="mt-2"
      :message="error"
      :offline="offline"
    />
  </div>
</template>
