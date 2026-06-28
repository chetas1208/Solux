<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center bg-zinc-900/95 p-6">
    <div class="max-w-md text-center">
      <div class="text-sm font-medium text-zinc-300">Map unavailable</div>
      <p class="text-xs text-zinc-500 mt-2">
        {{ message ?? 'Map provider is not configured. Screening results can still be reviewed in table/report form.' }}
      </p>
      <p class="text-[11px] text-zinc-600 mt-3">Set NUXT_PUBLIC_MAPTILER_KEY for MapLibre basemaps.</p>
    </div>
  </div>
</template>
