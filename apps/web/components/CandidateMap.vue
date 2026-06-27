<script setup lang="ts">
import type { CandidateSite, ScoreBreakdown } from '@solux/shared'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  sites: Array<CandidateSite & { scoreBreakdown: ScoreBreakdown | null }>
  projectId: string
}>()

const config = useRuntimeConfig()
const mapContainer = ref<HTMLDivElement | null>(null)
let map: import('maplibre-gl').Map | null = null

const DECISION_COLORS: Record<string, string> = {
  GO: '#22c55e',
  INVESTIGATE: '#f59e0b',
  KILL: '#ef4444',
}

onMounted(async () => {
  if (!mapContainer.value) return

  const maplibre = await import('maplibre-gl')
  const maptilerKey = config.public.maptilerKey as string

  const styleUrl = maptilerKey
    ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey}`
    : 'https://demotiles.maplibre.org/style.json'

  map = new maplibre.Map({
    container: mapContainer.value,
    style: styleUrl,
    center: props.sites.length
      ? [
          props.sites[0]!.centroid.coordinates[0],
          props.sites[0]!.centroid.coordinates[1],
        ]
      : [78.9629, 20.5937],
    zoom: 5,
    attributionControl: false,
  })

  map.on('load', () => {
    if (!map) return

    // Add site polygons as GeoJSON source
    const features = props.sites.map((site) => ({
      type: 'Feature' as const,
      id: site.id,
      geometry: site.geometry,
      properties: {
        siteId: site.id,
        name: site.name,
        decision: site.scoreBreakdown?.finalDecision ?? 'UNKNOWN',
        score: site.scoreBreakdown?.finalScore ?? 0,
        color: DECISION_COLORS[site.scoreBreakdown?.finalDecision ?? 'UNKNOWN'] ?? '#94a3b8',
      },
    }))

    map.addSource('sites', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    })

    map.addLayer({
      id: 'sites-fill',
      type: 'fill',
      source: 'sites',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.25,
      },
    })

    map.addLayer({
      id: 'sites-outline',
      type: 'line',
      source: 'sites',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': 0.8,
      },
    })

    // Fit map to sites
    if (features.length) {
      const coords = props.sites.flatMap((s) => {
        const geom = s.geometry
        if (geom.type === 'Polygon') return geom.coordinates[0] ?? []
        return geom.coordinates.flatMap((p) => p[0] ?? [])
      })

      const lons = coords.map((c) => c[0] ?? 0)
      const lats = coords.map((c) => c[1] ?? 0)
      const minLon = Math.min(...lons)
      const maxLon = Math.max(...lons)
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)

      map.fitBounds([minLon, minLat, maxLon, maxLat] as [number, number, number, number], {
        padding: 60,
        maxZoom: 8,
      })
    }
  })
})

onUnmounted(() => {
  map?.remove()
})
</script>

<template>
  <div class="w-full h-full rounded-lg overflow-hidden border border-slate-700">
    <div ref="mapContainer" class="w-full h-full" />
  </div>
</template>
