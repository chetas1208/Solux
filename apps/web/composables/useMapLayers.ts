import type { SiteWithScore } from '~/types/api'
import type { MapLayerConfig } from '~/types/ui'
import type { DataSourceStatus } from '@solux/shared'

const LAYER_DEFS: Omit<MapLayerConfig, 'available' | 'degraded' | 'sourceName' | 'enabled'>[] = [
  { id: 'solar_output', label: 'Solar output', confidenceImpact: 'Irradiance confidence affects power score.' },
  { id: 'vegetation', label: 'Vegetation / land-use conflict', confidenceImpact: 'Land-use conflict scoring may degrade.' },
  { id: 'grid', label: 'Grid / transmission proximity', confidenceImpact: 'Grid proximity requires OSM/transmission data.' },
  { id: 'roads', label: 'Roads / access', confidenceImpact: 'Access scoring depends on OSM roads.' },
  { id: 'terrain', label: 'Terrain / slope', confidenceImpact: 'Buildability scoring may be limited.' },
  { id: 'power_loss', label: 'Power-loss risk', confidenceImpact: 'Atmospheric loss models may be partial.' },
  { id: 'atmospheric', label: 'Atmospheric risk', confidenceImpact: 'Dust/soiling risk confidence varies by region.' },
  { id: 'water', label: 'Water feasibility', confidenceImpact: 'Requires GEBCO and/or Copernicus Marine.' },
  { id: 'candidates', label: 'Candidate sites', confidenceImpact: 'Polygons from configured real data sources only.' },
  { id: 'evidence', label: 'Evidence points', confidenceImpact: 'Retrieved evidence locations for scored claims.' },
]

const LAYER_SOURCE_MAP: Record<string, string[]> = {
  solar_output: ['pvgis', 'nrel_nsrdb', 'global_solar_atlas'],
  vegetation: ['global_solar_atlas', 'openstreetmap'],
  grid: ['openstreetmap'],
  roads: ['openstreetmap'],
  terrain: ['gebco', 'global_solar_atlas'],
  power_loss: ['pvgis', 'nrel_nsrdb'],
  atmospheric: ['pvgis', 'nrel_nsrdb'],
  water: ['gebco', 'copernicus_marine'],
  candidates: ['openstreetmap', 'global_solar_atlas'],
  evidence: ['pvgis', 'nrel_nsrdb', 'openstreetmap', 'gebco'],
}

export function useMapLayers(sources: Ref<DataSourceStatus[]>) {
  const enabledLayers = ref<Set<string>>(new Set(['candidates', 'solar_output', 'grid']))

  const layers = computed<MapLayerConfig[]>(() =>
    LAYER_DEFS.map((def) => {
      const linked = LAYER_SOURCE_MAP[def.id] ?? []
      const linkedSources = linked
        .map((id) => sources.value.find((s) => s.id === id))
        .filter(Boolean) as DataSourceStatus[]

      const available = def.id === 'candidates' || linkedSources.some((s) => s.available)
      const degraded =
        def.id !== 'candidates' &&
        linkedSources.length > 0 &&
        linkedSources.some((s) => !s.available) &&
        linkedSources.some((s) => s.available)

      const primarySource = linkedSources.find((s) => s.available) ?? linkedSources[0]

      return {
        ...def,
        available,
        degraded,
        sourceName: primarySource?.label,
        enabled: enabledLayers.value.has(def.id),
      }
    }),
  )

  function toggleLayer(id: string) {
    const next = new Set(enabledLayers.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    enabledLayers.value = next
  }

  function sitesToGeoJSON(sites: SiteWithScore[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: sites.map((site) => ({
        type: 'Feature',
        id: site.id,
        geometry: site.geometry as GeoJSON.Geometry,
        properties: {
          siteId: site.id,
          name: site.name,
          decision: site.scoreBreakdown?.finalDecision ?? 'UNKNOWN',
          score: site.scoreBreakdown?.finalScore ?? 0,
          confidence: site.scoreBreakdown?.confidence ?? 0,
          siteType: site.siteType,
        },
      })),
    }
  }

  return { layers, enabledLayers, toggleLayer, sitesToGeoJSON }
}
