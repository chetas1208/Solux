<script setup lang="ts">
const config = useRuntimeConfig()
const { loading, error, snapshot, refresh } = useMapProviderHealth()

onMounted(() => refresh(false))

const overallClass = computed(() => {
  switch (snapshot.value.overall) {
    case 'READY':
      return 'status-ready'
    case 'DEGRADED':
      return 'status-degraded'
    case 'NOT_CONFIGURED':
      return 'status-not-configured'
    default:
      return 'status-unavailable'
  }
})

function keyHint(id: string): string | undefined {
  switch (id) {
    case 'cesium_ion':
    case 'cesium_client':
      return config.public.cesiumIonToken as string
    case 'maptiler':
    case 'maptiler_client':
      return config.public.maptilerKey as string
    case 'google_3d_tiles':
    case 'google_maps_js':
      return config.public.googleMapsApiKey as string
    default:
      return undefined
  }
}
</script>

<template>
  <div class="space-y-6">
    <UiCard class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-[10px] uppercase tracking-wider text-zinc-600">Overall map readiness</p>
          <p class="text-lg font-semibold mt-1" :class="overallClass">{{ snapshot.overall }}</p>
          <p class="text-xs text-zinc-500 mt-1">
            Visualization readiness does not affect scoring or evidence quality.
          </p>
        </div>
        <UiButton variant="ghost" size="sm" :disabled="loading" @click="refresh(true)">
          {{ loading ? 'Testing…' : 'Run diagnostics' }}
        </UiButton>
      </div>
      <p v-if="snapshot.checkedAt" class="text-[10px] text-zinc-600 font-mono mt-3">
        Last checked: {{ snapshot.checkedAt }}
      </p>
    </UiCard>

    <LayoutErrorState v-if="error" :message="error" retry @retry="refresh(true)" />

    <section>
      <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Backend probes</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <DiagnosticsMapProviderHealthCard
          v-for="p in snapshot.backend?.providers ?? []"
          :key="p.id"
          :provider="p"
          :public-key-hint="keyHint(p.id)"
        />
      </div>
    </section>

    <section v-if="snapshot.client.length">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Browser runtime</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <DiagnosticsMapProviderHealthCard
          v-for="p in snapshot.client"
          :key="p.id"
          :provider="p"
          :public-key-hint="keyHint(p.id)"
        />
      </div>
    </section>

    <DiagnosticsProviderCapabilityMatrix :snapshot="snapshot" />
    <DiagnosticsApiKeyRestrictionNotice />
  </div>
</template>
