<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'
import type { MapLayerConfig } from '~/types/ui'

const props = defineProps<{
  sites: SiteWithScore[]
  layers: MapLayerConfig[]
  selectedId?: string
}>()

const emit = defineEmits<{ select: [string] }>()

const config = useRuntimeConfig()
const mapReady = ref(false)
const mapError = ref<string | null>(null)
const container = ref<HTMLDivElement | null>(null)
let map: import('maplibre-gl').Map | null = null

const DECISION_COLORS: Record<string, string> = {
  GO: '#16a34a',
  INVESTIGATE: '#ca8a04',
  KILL: '#dc2626',
}

const hasMapProvider = computed(() => !!(config.public.maptilerKey as string))

const showCandidates = computed(() => props.layers.find((l) => l.id === 'candidates')?.enabled !== false)

onMounted(async () => {
  if (!container.value || !hasMapProvider.value) return
  try {
    const maplibre = await import('maplibre-gl')
    const key = config.public.maptilerKey as string
    map = new maplibre.Map({
      container: container.value,
      style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`,
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    })
    map.on('load', () => {
      mapReady.value = true
      updateLayers()
    })
  } catch (err) {
    mapError.value = String(err)
  }
})

watch(() => [props.sites, showCandidates.value], updateLayers, { deep: true })

function updateLayers() {
  if (!map || !mapReady.value) return
  const sourceId = 'candidates'
  if (map.getLayer('candidates-fill')) map.removeLayer('candidates-fill')
  if (map.getLayer('candidates-outline')) map.removeLayer('candidates-outline')
  if (map.getSource(sourceId)) map.removeSource(sourceId)

  if (!showCandidates.value || !props.sites.length) return

  const { sitesToGeoJSON } = useMapLayers(ref([]))
  const geojson = sitesToGeoJSON(props.sites)
  const features = geojson.features.map((f) => ({
    ...f,
    properties: {
      ...f.properties,
      color: DECISION_COLORS[String(f.properties?.decision)] ?? '#71717a',
    },
  }))

  map.addSource(sourceId, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  })

  map.addLayer({
    id: 'candidates-fill',
    type: 'fill',
    source: sourceId,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 },
  })

  map.addLayer({
    id: 'candidates-outline',
    type: 'line',
    source: sourceId,
    paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
  })

  map.on('click', 'candidates-fill', (e) => {
    const id = e.features?.[0]?.properties?.siteId
    if (id) emit('select', String(id))
  })

  fitBounds()
}

function fitBounds() {
  if (!map || !props.sites.length) return
  const coords = props.sites.flatMap((s) => {
    const g = s.geometry
    if (g.type === 'Polygon') return g.coordinates[0] ?? []
    return g.coordinates.flatMap((p) => p[0] ?? [])
  })
  if (!coords.length) return
  const lons = coords.map((c) => c[0] ?? 0)
  const lats = coords.map((c) => c[1] ?? 0)
  map.fitBounds(
    [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
    { padding: 48, maxZoom: 10 },
  )
}

onUnmounted(() => map?.remove())
</script>

<template>
  <div class="relative w-full h-full min-h-[320px] bg-zinc-900 rounded-md border border-surface-border overflow-hidden">
    <MapMapUnavailableState v-if="!hasMapProvider" />
    <MapMapUnavailableState v-else-if="mapError" :message="mapError" />
    <div v-else ref="container" class="absolute inset-0" />
    <div
      v-if="hasMapProvider && !sites.length"
      class="absolute inset-0 flex items-center justify-center p-6 pointer-events-none"
    >
      <p class="data-degraded max-w-sm text-center">
        No candidate sites generated from configured real data sources.
      </p>
    </div>
    <MapMapLegend class="absolute bottom-3 left-3" />
  </div>
</template>
