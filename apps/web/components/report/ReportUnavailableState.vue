<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <LayoutEmptyState
    title="Report unavailable"
    :description="message ?? 'Gemini is not configured or this site has not been scored yet.'"
  />
</template>
