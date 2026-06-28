<script setup lang="ts">
defineProps<{ warnings: string[] }>()
</script>

<template>
  <UiCard v-if="warnings.length">
    <div class="solux-panel-header">Missing data warnings</div>
    <div class="p-4 space-y-2">
      <p class="text-xs text-zinc-500">Missing data lowers confidence.</p>
      <div v-for="w in warnings" :key="w" class="data-degraded">{{ w }}</div>
    </div>
  </UiCard>
</template>
