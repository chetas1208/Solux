<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<template>
  <div class="animate-pulse space-y-3 p-4">
    <div class="h-3 bg-zinc-800 rounded w-1/3" />
    <div class="h-20 bg-zinc-800/80 rounded" />
    <div class="h-3 bg-zinc-800 rounded w-2/3" />
    <p v-if="label" class="text-xs text-zinc-600">{{ label }}</p>
  </div>
</template>
