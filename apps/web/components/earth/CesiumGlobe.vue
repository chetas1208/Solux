<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'
import type { GlobeCameraTarget } from '~/types/earth'
import type { MapLayerConfig } from '~/types/ui'
import type { GlobeLayerState } from '~/utils/globeLayers'
import { configureGlobeLayers } from '~/utils/globeLayers'

const props = defineProps<{
  sites: SiteWithScore[]
  layers: MapLayerConfig[]
  selectedId?: string
  flyTo?: GlobeCameraTarget | null
}>()

const emit = defineEmits<{ select: [string]; ready: []; error: [string] }>()

const config = useRuntimeConfig()
const container = ref<HTMLDivElement | null>(null)
const { sitesForGlobe, decisionColor, scene } = useCesiumGlobe()
const layerState = ref<GlobeLayerState | null>(null)

let viewer: import('cesium').Viewer | null = null
let CesiumMod: Awaited<ReturnType<typeof loadCesium>> | null = null
let clickHandler: import('cesium').ScreenSpaceEventHandler | null = null

const showCandidates = computed(
  () => props.layers.find((l) => l.id === 'candidates')?.enabled !== false,
)
const visibleSites = computed(() => sitesForGlobe(props.sites))

const googleDegraded = computed(() => {
  if (!config.public.google3dTilesEnabled) return null
  if (layerState.value?.google3dTiles) return null
  return (
    layerState.value?.google3dError ??
    'Google Photorealistic 3D Tiles unavailable. Cesium ion basemap active — scoring unaffected.'
  )
})

onMounted(() => void initGlobe())

watch(
  () => [props.sites, showCandidates.value, props.selectedId] as const,
  () => void syncSites(),
  { deep: true },
)

watch(
  () => props.flyTo,
  (target) => {
    if (!viewer || !CesiumMod || !target) return
    viewer.camera.flyTo({
      destination: CesiumMod.Cartesian3.fromDegrees(
        target.longitude,
        target.latitude,
        target.height ?? 50_000,
      ),
      orientation: {
        heading: CesiumMod.Math.toRadians(target.heading ?? 0),
        pitch: CesiumMod.Math.toRadians(target.pitch ?? -45),
        roll: 0,
      },
      duration: 1.6,
    })
  },
)

async function initGlobe() {
  if (!container.value) return
  scene.value = { ...scene.value, loading: true, error: null }
  try {
    CesiumMod = await loadCesium()

    viewer = new CesiumMod.Viewer(container.value, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      creditContainer: document.createElement('div'),
      baseLayer: false,
      terrain: undefined,
    })

    layerState.value = await configureGlobeLayers(CesiumMod, viewer, {
      ionToken: config.public.cesiumIonToken as string,
      googleKey: config.public.googleMapsApiKey as string,
      google3dEnabled: config.public.google3dTilesEnabled === true,
    })

    clickHandler = new CesiumMod.ScreenSpaceEventHandler(viewer.scene.canvas)
    clickHandler.setInputAction((movement: { position: import('cesium').Cartesian2 }) => {
      if (!viewer || !CesiumMod) return
      const picked = viewer.scene.pick(movement.position)
      const siteId = picked?.id?.properties?.siteId?.getValue?.()
      if (siteId) emit('select', String(siteId))
    }, CesiumMod.ScreenSpaceEventType.LEFT_CLICK)

    await syncSites()
    scene.value = {
      ready: true,
      loading: false,
      error: null,
      provider: 'cesium',
      webglAvailable: true,
      sitesRendered: visibleSites.value.length,
      sitesTotal: props.sites.length,
    }
    emit('ready')
  } catch (err) {
    const msg = String(err)
    scene.value = { ...scene.value, loading: false, error: msg, provider: 'unavailable' }
    emit('error', msg)
  }
}

async function syncSites() {
  if (!viewer || !CesiumMod) return
  viewer.dataSources.removeAll()

  if (!showCandidates.value || !visibleSites.value.length) {
    scene.value.sitesRendered = 0
    scene.value.sitesTotal = props.sites.length
    return
  }

  const { sitesToGeoJSON } = useMapLayers(ref([]))
  const geojson = sitesToGeoJSON(visibleSites.value)
  const ds = await CesiumMod.GeoJsonDataSource.load(geojson, { clampToGround: true })

  for (const entity of ds.entities.values) {
    const decision = entity.properties?.decision?.getValue?.() as string | undefined
    const siteId = entity.properties?.siteId?.getValue?.() as string | undefined
    const color = CesiumMod.Color.fromCssColorString(decisionColor(decision)).withAlpha(0.35)
    const outline = CesiumMod.Color.fromCssColorString(decisionColor(decision))

    if (entity.polygon) {
      entity.polygon.material = new CesiumMod.ColorMaterialProperty(color)
      entity.polygon.outline = new CesiumMod.ConstantProperty(true)
      entity.polygon.outlineColor = new CesiumMod.ConstantProperty(outline)
      entity.polygon.outlineWidth = new CesiumMod.ConstantProperty(2)
    }
    if (siteId === props.selectedId) {
      entity.polygon!.outlineWidth = new CesiumMod.ConstantProperty(4)
    }
  }

  viewer.dataSources.add(ds)
  scene.value.sitesRendered = visibleSites.value.length
  scene.value.sitesTotal = props.sites.length
}

onUnmounted(() => {
  clickHandler?.destroy()
  viewer?.destroy()
  viewer = null
})
</script>

<template>
  <div class="relative w-full h-full min-h-[320px] bg-zinc-950 overflow-hidden">
    <LayoutDegradedState
      v-if="googleDegraded"
      class="absolute top-3 left-3 right-3 z-20 max-w-xl pointer-events-none"
      :message="googleDegraded"
    />
    <div ref="container" class="absolute inset-0" />
    <GlobeSceneStatus
      class="absolute top-3 right-3 z-10"
      :scene="scene"
      :truncated="sites.length > visibleSites.length"
      :layer-state="layerState"
    />
    <EarthGlobeLegend class="absolute bottom-3 left-3 z-10" />
    <div
      v-if="!sites.length"
      class="absolute inset-0 flex items-center justify-center p-6 pointer-events-none z-10"
    >
      <p class="data-degraded max-w-sm text-center">
        No candidate sites generated from configured real data sources.
      </p>
    </div>
  </div>
</template>

<style scoped>
:deep(.cesium-viewer-bottom) {
  display: none;
}
</style>
