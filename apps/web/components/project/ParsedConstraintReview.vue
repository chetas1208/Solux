<script setup lang="ts">
import type { ProjectSpec } from '~/types/api'

defineProps<{ spec: ProjectSpec }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Parsed constraints</div>
    <div class="p-4 grid grid-cols-2 gap-3 text-sm">
      <div>
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Region</div>
        <div class="text-zinc-200 mt-0.5">{{ spec.targetRegion }}</div>
      </div>
      <div>
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Country</div>
        <div class="text-zinc-200 mt-0.5">{{ spec.targetCountry }}</div>
      </div>
      <div>
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Project type</div>
        <div class="text-zinc-200 mt-0.5">{{ spec.technology.replace(/_/g, ' ') }}</div>
      </div>
      <div>
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Capacity</div>
        <div class="text-zinc-200 mt-0.5">{{ spec.targetCapacityMW }} MW</div>
      </div>
      <div>
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Land / water preference</div>
        <div class="text-zinc-200 mt-0.5">{{ spec.preferredSiteTypes.map(siteTypeLabel).join(', ') }}</div>
      </div>
      <div>
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Hard avoids</div>
        <div class="text-zinc-200 mt-0.5">
          {{ spec.excludedSiteTypes.length ? spec.excludedSiteTypes.join(', ') : 'None specified' }}
        </div>
      </div>
      <div class="col-span-2">
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Optimization goals</div>
        <div class="text-zinc-400 mt-0.5 text-xs">
          Grid ≤ {{ spec.maxGridDistanceKm }} km · GHI ≥ {{ spec.minGhiKwhM2Day }} kWh/m²/day
          <span v-if="spec.avoidDenseVegetation"> · Avoid dense vegetation</span>
        </div>
      </div>
      <div v-if="spec.additionalConstraints.length" class="col-span-2">
        <div class="text-[11px] text-zinc-500 uppercase tracking-wide">Additional constraints</div>
        <ul class="text-xs text-zinc-400 mt-1 space-y-0.5">
          <li v-for="c in spec.additionalConstraints" :key="c">· {{ c }}</li>
        </ul>
      </div>
    </div>
  </UiCard>
</template>
