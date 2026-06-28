<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'
import type { MapLayerConfig } from '~/types/ui'

const props = defineProps<{
  sites: SiteWithScore[]
  layers: MapLayerConfig[]
  selectedId?: string
}>()

const emit = defineEmits<{ select: [string] }>()

const { activeProvider, degradedMessage } = useMapFallback()
const { flyToTarget, flyToSite, flyToBounds } = useGlobeCamera()
const cesiumError = ref<string | null>(null)

watch(
  () => props.sites,
  (sites) => {
    if (sites.length) flyToBounds(sites)
  },
  { deep: true },
)

watch(
  () => props.selectedId,
  (id) => {
    const site = props.sites.find((s) => s.id === id)
    if (site) flyToSite(site)
  },
)

function onSelect(id: string) {
  emit('select', id)
  const site = props.sites.find((s) => s.id === id)
  if (site) flyToSite(site)
}
</script>

<template>
  <div class="relative w-full h-full min-h-[320px] overflow-hidden">
    <LayoutDegradedState
      v-if="degradedMessage"
      class="absolute top-3 left-3 right-3 z-20 max-w-xl pointer-events-none"
      :message="degradedMessage"
    />

    <LayoutErrorState
      v-if="cesiumError"
      class="absolute top-3 left-3 right-3 z-30 max-w-md"
      title="3D Earth failed to load"
      :message="cesiumError"
    />

    <ClientOnly>
      <EarthCesiumGlobe
        v-if="activeProvider === 'cesium' && !cesiumError"
        :sites="sites"
        :layers="layers"
        :selected-id="selectedId"
        :fly-to="flyToTarget"
        @select="onSelect"
        @error="cesiumError = $event"
      />
      <MapFallbackMapLibreFallback
        v-else-if="activeProvider === 'maplibre'"
        class="absolute inset-0"
        :sites="sites"
        :layers="layers"
        :selected-id="selectedId"
        @select="onSelect"
      />
      <EarthGlobeUnavailableState
        v-else-if="!cesiumError"
        title="3D Earth Screening Workspace unavailable"
        message="3D map unavailable. Screening results and evidence remain available."
      />
      <template #fallback>
        <div class="absolute inset-0 flex items-center justify-center bg-zinc-950">
          <p class="text-xs text-zinc-500 animate-pulse">Loading 3D Earth…</p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
