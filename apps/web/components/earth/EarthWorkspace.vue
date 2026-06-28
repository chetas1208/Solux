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
  <div class="relative w-full h-full min-h-[320px]">
    <LayoutDegradedState
      v-if="degradedMessage"
      class="absolute top-3 left-3 right-3 z-20 max-w-xl"
      :message="degradedMessage"
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
        :sites="sites"
        :layers="layers"
        :selected-id="selectedId"
        @select="onSelect"
      />
      <EarthGlobeUnavailableState
        v-else
        title="3D Earth Screening Workspace unavailable"
        message="3D map unavailable. Screening results and evidence remain available."
      />
    </ClientOnly>
  </div>
</template>
