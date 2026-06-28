<script setup lang="ts">
import type { Decision } from '@solux/shared'

defineProps<{
  decision: Decision
  headline: string
  summary: string
  score: number
  confidence: number
}>()
</script>

<template>
  <div :class="decisionClass(decision)" class="rounded-md p-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-[11px] uppercase tracking-wider opacity-70">Executive decision</div>
        <div class="text-2xl font-bold mt-1">{{ decision }}</div>
        <p class="text-sm mt-2 opacity-90">{{ headline }}</p>
        <p class="text-xs mt-2 opacity-75">{{ decisionLabel(decision) }}</p>
      </div>
      <div class="text-right shrink-0">
        <div class="text-3xl font-mono font-bold">{{ score }}</div>
        <div class="text-[11px] opacity-70">/ 100</div>
        <div class="text-xs mt-1" :class="confidenceClass(confidenceLevel(confidence))">
          {{ confidence }}% confidence
        </div>
      </div>
    </div>
    <p class="text-sm mt-3 opacity-80">{{ summary }}</p>
  </div>
</template>
