<script setup lang="ts">
defineProps<{
  title?: string
  message?: string
}>()
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center p-8 bg-zinc-950/90">
    <div class="max-w-md text-center space-y-3">
      <h3 class="text-sm font-semibold text-zinc-200">
        {{ title ?? 'Visualization unavailable' }}
      </h3>
      <p class="text-xs text-zinc-500 leading-relaxed">
        {{ message ?? 'Visualization degraded; scoring unaffected.' }}
      </p>
      <NuxtLink to="/diagnostics/maps" class="inline-block text-xs text-zinc-400 hover:text-zinc-200 underline">
        Check map readiness
      </NuxtLink>
    </div>
  </div>
</template>
