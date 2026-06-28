<script setup lang="ts">
import type { GlobeSceneState } from '~/types/earth'
import type { GlobeLayerState } from '~/utils/globeLayers'

defineProps<{
  scene: GlobeSceneState
  truncated?: boolean
  layerState?: GlobeLayerState | null
}>()
</script>

<template>
  <div class="solux-panel px-2.5 py-1.5 text-[10px] text-zinc-400 space-y-0.5 max-w-[220px]">
    <div class="flex items-center justify-between gap-2">
      <span class="uppercase tracking-wider text-zinc-500">3D Earth</span>
      <span
        class="font-mono"
        :class="scene.ready ? 'status-ready' : scene.loading ? 'status-degraded' : 'status-unavailable'"
      >
        {{ scene.loading ? 'Loading…' : scene.ready ? 'Active' : 'Offline' }}
      </span>
    </div>
    <template v-if="layerState">
      <p v-if="layerState.ionImagery" class="text-zinc-600">Ion imagery · terrain</p>
      <p v-if="layerState.google3dTiles" class="text-zinc-500">Google 3D mesh active</p>
      <p v-else-if="layerState.google3dError" class="text-zinc-600 leading-snug">Google 3D off</p>
    </template>
    <p v-if="scene.sitesRendered" class="text-zinc-500">
      {{ scene.sitesRendered }}<span v-if="truncated"> / {{ scene.sitesTotal }}</span> candidates
    </p>
  </div>
</template>
