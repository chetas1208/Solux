<script setup lang="ts">
import type { CapabilityState } from '~/types/ui'

withDefaults(
  defineProps<{
    label: string
    state: CapabilityState
    detail?: string
    fallback?: string
    action?: string
    checkedAt?: string
    expanded?: boolean
  }>(),
  { expanded: false },
)
</script>

<template>
  <div :class="expanded ? 'p-4' : 'p-3'">
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm text-zinc-300">{{ label }}</span>
      <UiBadge :label="state" variant="status" :state="state" />
    </div>
    <template v-if="expanded">
      <p v-if="detail" class="text-xs text-zinc-500 mt-2">{{ detail }}</p>
      <p v-if="fallback" class="text-xs text-zinc-600 mt-1">Fallback: {{ fallback }}</p>
      <p v-if="action" class="text-xs text-amber-500/80 mt-1">{{ action }}</p>
      <p v-if="checkedAt" class="text-[10px] font-mono text-zinc-600 mt-1">Last checked {{ checkedAt }}</p>
    </template>
  </div>
</template>
