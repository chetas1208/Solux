<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  actions?: boolean
}>()
</script>

<template>
  <div class="px-4 py-4 border-b border-surface-border flex items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-lg font-semibold text-zinc-100 tracking-tight">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-zinc-500 mt-1">{{ subtitle }}</p>
    </div>
    <div v-if="actions" class="shrink-0 flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
