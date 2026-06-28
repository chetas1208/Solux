<script setup lang="ts">
import type { ClaimVerificationResult } from '~/types/api'

const props = defineProps<{
  score?: number
  verification?: ClaimVerificationResult
}>()

const displayScore = computed(() => props.verification?.hallucinationScore ?? props.score)
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Hallucination score</div>
    <div class="p-4">
      <template v-if="displayScore != null">
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-mono" :class="displayScore < 0.2 ? 'text-emerald-400' : displayScore < 0.5 ? 'text-amber-400' : 'text-red-400'">
            {{ (displayScore * 100).toFixed(1) }}%
          </span>
          <span class="text-xs text-zinc-500">unsupported claim fraction</span>
        </div>
        <p v-if="verification" class="text-xs text-zinc-500 mt-2">
          {{ verification.supportedClaims }} / {{ verification.totalClaims }} claims grounded in retrieved evidence.
        </p>
        <p class="text-xs text-zinc-600 mt-1">This recommendation is grounded in retrieved evidence.</p>
      </template>
      <p v-else class="data-degraded">Verification not available for this report.</p>
    </div>
  </UiCard>
</template>
