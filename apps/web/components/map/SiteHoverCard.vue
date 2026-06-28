<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'

defineProps<{ site: SiteWithScore | null }>()
</script>

<template>
  <div v-if="site" class="absolute top-3 right-3 w-56 solux-panel p-3 text-xs shadow-lg">
    <div class="font-medium text-zinc-200">{{ site.name }}</div>
    <div v-if="site.scoreBreakdown" class="mt-1 flex items-center gap-2">
      <UiBadge :label="site.scoreBreakdown.finalDecision" variant="decision" :state="site.scoreBreakdown.finalDecision" />
      <span class="font-mono text-zinc-400">{{ site.scoreBreakdown.finalScore }}</span>
    </div>
    <div class="text-zinc-500 mt-1">{{ siteTypeLabel(site.siteType) }} · {{ site.areaKm2.toFixed(1) }} km²</div>
  </div>
</template>
