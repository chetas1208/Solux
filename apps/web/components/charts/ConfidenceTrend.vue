<script setup lang="ts">
defineProps<{ values: number[]; labels?: string[] }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Confidence trend</div>
    <LayoutEmptyState
      title="No trend data"
      description="Confidence trend requires historical runs from the backend."
      class="py-6"
    />
  </UiCard>
</template>
