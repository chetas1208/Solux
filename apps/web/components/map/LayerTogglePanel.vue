<script setup lang="ts">
import type { MapLayerConfig } from '~/types/ui'

defineProps<{ layers: MapLayerConfig[] }>()
defineEmits<{ toggle: [string] }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Layers</div>
    <div class="p-2 space-y-1 max-h-64 overflow-auto">
      <button
        v-for="layer in layers"
        :key="layer.id"
        type="button"
        class="w-full text-left px-2 py-1.5 rounded text-xs flex items-start gap-2 hover:bg-zinc-800/60"
        :class="layer.enabled ? 'text-zinc-200' : 'text-zinc-500'"
        @click="$emit('toggle', layer.id)"
      >
        <span
          class="w-2 h-2 rounded-full mt-1 shrink-0"
          :class="layer.available ? (layer.degraded ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-zinc-600'"
        />
        <span>
          <span class="block">{{ layer.label }}</span>
          <span v-if="layer.sourceName" class="text-[10px] text-zinc-600">{{ layer.sourceName }}</span>
          <span v-if="!layer.available" class="text-[10px] text-zinc-600 block">Confidence reduced — unavailable</span>
        </span>
      </button>
    </div>
  </UiCard>
</template>
