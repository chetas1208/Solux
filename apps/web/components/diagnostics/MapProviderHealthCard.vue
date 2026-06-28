<script setup lang="ts">
import type { MapProviderStatus } from '~/types/map'
import type { ClientMapProbe } from '~/types/diagnostics'
import { maskPublicKey } from '~/types/diagnostics'

const props = defineProps<{
  provider: MapProviderStatus | ClientMapProbe
  publicKeyHint?: string
}>()

const stateClass = computed(() => {
  switch (props.provider.state) {
    case 'READY':
      return 'status-ready'
    case 'DEGRADED':
      return 'status-degraded'
    case 'NOT_CONFIGURED':
      return 'status-not-configured'
    default:
      return 'status-unavailable'
  }
})
</script>

<template>
  <UiCard class="p-4 space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-zinc-200">{{ provider.name }}</h3>
        <p class="text-[10px] text-zinc-600 mt-0.5 font-mono">{{ provider.id }}</p>
      </div>
      <span class="text-xs font-medium uppercase tracking-wide" :class="stateClass">
        {{ provider.state.replace('_', ' ') }}
      </span>
    </div>

    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
      <dt class="text-zinc-600">Configured</dt>
      <dd class="text-zinc-300">{{ provider.configured ? 'Yes' : 'No' }}</dd>
      <dt class="text-zinc-600">Last tested</dt>
      <dd class="text-zinc-400 font-mono text-[10px]">{{ provider.lastCheckedAt }}</dd>
      <template v-if="publicKeyHint">
        <dt class="text-zinc-600">Public key</dt>
        <dd class="text-zinc-400 font-mono">{{ maskPublicKey(publicKeyHint) }}</dd>
      </template>
    </dl>

    <div>
      <p class="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">What was tested</p>
      <ul class="text-[11px] text-zinc-400 space-y-0.5">
        <li v-for="t in provider.whatWasTested" :key="t">· {{ t }}</li>
      </ul>
    </div>

    <p v-if="'failureReason' in provider && provider.failureReason" class="data-degraded text-[11px]">
      {{ provider.failureReason }}
    </p>

    <template v-if="'fallback' in provider">
      <p class="text-[11px] text-zinc-500">
        <span class="text-zinc-600">Fallback:</span> {{ provider.fallback }}
      </p>
      <p class="text-[11px] text-zinc-500">
        <span class="text-zinc-600">Confidence impact:</span> {{ provider.confidenceImpact }}
      </p>
    </template>
  </UiCard>
</template>
