<script setup lang="ts">
const props = defineProps<{
  projectId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  answered: [highlightSiteIds: string[]]
}>()

const query = ref('')
const { loading, error, lastResult, submitQuery } = useProjectQuery()

const minLen = 10
const canSubmit = computed(() => query.value.trim().length >= minLen && !loading.value && !props.disabled)

async function submit() {
  if (!canSubmit.value) return
  const result = await submitQuery(props.projectId, query.value.trim())
  if (result?.highlightSiteIds?.length) {
    emit('answered', result.highlightSiteIds)
  }
}
</script>

<template>
  <UiCard class="p-3">
    <div class="solux-panel-header border-0 px-0 pt-0">Ask Solux</div>
    <p class="text-[11px] text-zinc-600 mt-1 mb-2">
      Natural-language queries parse requirements, rank evidence-backed sites, and fly the globe to results.
    </p>
    <textarea
      v-model="query"
      rows="3"
      placeholder="e.g. Find 100 MW solar+storage sites in Rajasthan with low vegetation conflict…"
      class="w-full bg-zinc-900/50 border border-surface-border rounded px-2.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none focus:border-zinc-600"
      :disabled="loading || disabled"
      @keydown.ctrl.enter="submit"
    />
    <div class="flex items-center justify-between mt-2">
      <span class="text-[10px] text-zinc-600">Ctrl+Enter · min {{ minLen }} chars</span>
      <UiButton variant="primary" size="sm" :disabled="!canSubmit" @click="submit">
        {{ loading ? 'Running pipeline…' : 'Ask' }}
      </UiButton>
    </div>

    <div v-if="lastResult" class="mt-3 border-t border-surface-border pt-3 space-y-2">
      <div class="flex flex-wrap gap-2 text-[10px]">
        <UiBadge :label="`Dataset ${lastResult.datasetVersion}`" variant="status" state="READY" />
        <UiBadge :label="`Policy ${lastResult.scoringPolicyVersion}`" variant="status" state="READY" />
        <UiBadge
          :label="lastResult.modelRerankUsed ? 'Model rerank' : 'Deterministic'"
          variant="status"
          :state="lastResult.modelRerankUsed ? 'READY' : 'DEGRADED'"
        />
      </div>
      <p class="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{{ lastResult.report?.summary ?? lastResult.answer }}</p>
      <ul v-if="lastResult.missingDataWarnings?.length" class="text-[10px] text-amber-500/90 space-y-0.5">
        <li v-for="(w, i) in lastResult.missingDataWarnings.slice(0, 4)" :key="i">Missing data lowers confidence: {{ w }}</li>
      </ul>
      <p v-if="!lastResult.modelRerankUsed" class="text-[10px] text-zinc-500">
        Model reranking unavailable; deterministic evidence scoring active.
      </p>
    </div>
    <LayoutErrorState v-if="error" class="mt-3" :message="error" />
  </UiCard>
</template>
