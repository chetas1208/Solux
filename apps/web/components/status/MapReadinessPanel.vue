<script setup lang="ts">
const { snapshot, mapReadinessLabel, refresh } = useMapProviderHealth()

onMounted(() => refresh(false))

const items = computed(() => snapshot.value.backend?.providers ?? [])
</script>

<template>
  <UiCard>
    <div class="solux-panel-header flex items-center justify-between">
      <span>Map readiness</span>
      <NuxtLink to="/diagnostics/maps" class="text-[10px] normal-case tracking-normal text-zinc-500 hover:text-zinc-300">
        Full diagnostics →
      </NuxtLink>
    </div>
    <div class="p-4 space-y-3">
      <p class="text-sm text-zinc-300">{{ mapReadinessLabel }}</p>
      <p class="text-xs text-zinc-500">
        Visualization readiness does not affect scoring. Missing map providers degrade the 3D Earth workspace only.
      </p>
      <div class="grid sm:grid-cols-2 gap-2">
        <div
          v-for="p in items.slice(0, 6)"
          :key="p.id"
          class="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-zinc-900/60 border border-surface-border"
        >
          <span class="text-zinc-400">{{ p.name }}</span>
          <UiBadge :label="p.state" variant="status" :state="p.state" />
        </div>
      </div>
    </div>
  </UiCard>
</template>
