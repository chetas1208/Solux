<script setup lang="ts">
defineProps<{ impact: string }>()
</script>

<template>
  <div class="data-degraded">{{ impact }}</div>
</template>
