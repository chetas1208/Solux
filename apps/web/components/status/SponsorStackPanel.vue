<script setup lang="ts">
const sponsors = [
  { name: 'Gemini', role: 'Planner, parser, verifier', state: 'NOT_CONFIGURED' as const },
  { name: 'MongoDB', role: 'Project / evidence / geospatial store', state: 'READY' as const },
  { name: 'MiniMax', role: 'Voice briefing', state: 'NOT_CONFIGURED' as const },
  { name: 'DigitalOcean', role: 'Deployment / report storage', state: 'UNKNOWN' as const },
  { name: 'Mojo', role: 'Scoring kernel path', state: 'NOT_CONFIGURED' as const },
  { name: 'CesiumJS', role: '3D Earth visualization engine', state: 'READY' as const },
  { name: 'Google 3D Tiles', role: 'Optional photorealistic mesh layer', state: 'NOT_CONFIGURED' as const },
  { name: 'MapTiler / MapLibre', role: '2D fallback basemap', state: 'NOT_CONFIGURED' as const },
]
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Sponsor stack</div>
    <div class="grid sm:grid-cols-2 gap-px bg-zinc-800">
      <div v-for="s in sponsors" :key="s.name" class="bg-surface-raised p-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-zinc-200">{{ s.name }}</span>
          <UiBadge :label="s.state" variant="status" :state="s.state" />
        </div>
        <p class="text-xs text-zinc-500 mt-1">{{ s.role }}</p>
      </div>
    </div>
  </UiCard>
</template>
