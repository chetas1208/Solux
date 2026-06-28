<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <div class="data-degraded border-decision-investigate/30 bg-decision-investigate-muted/40">
    {{ message }}
  </div>
</template>
