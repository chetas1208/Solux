<script setup lang="ts">
defineProps<{
  flaws: Array<{ dimension: string; description: string; evidenceId?: string }>
  topFlaws?: string[]
}>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Fatal flaws</div>
    <div class="p-4 space-y-3">
      <div v-for="flaw in flaws" :key="flaw.description" class="flex gap-2 text-sm">
        <span class="text-decision-kill shrink-0">×</span>
        <div>
          <div class="text-[11px] uppercase text-zinc-500">{{ flaw.dimension }}</div>
          <div class="text-zinc-300">{{ flaw.description }}</div>
        </div>
      </div>
      <div v-for="f in topFlaws ?? []" :key="f" class="text-sm text-decision-kill/90">× {{ f }}</div>
      <p v-if="!flaws.length && !(topFlaws?.length)" class="text-xs text-zinc-500">
        No critical fatal flaws flagged from configured data sources.
      </p>
    </div>
  </UiCard>
</template>
