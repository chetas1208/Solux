<script setup lang="ts">
import { cn } from '~/utils/cn'
import type { CapabilityState } from '~/types/ui'

const props = defineProps<{
  label: string
  variant?: 'decision' | 'status' | 'default'
  state?: CapabilityState | 'GO' | 'INVESTIGATE' | 'KILL'
}>()

const classes = computed(() => {
  if (props.variant === 'decision' || ['GO', 'INVESTIGATE', 'KILL'].includes(props.state ?? '')) {
    const d = props.state ?? props.label
    if (d === 'GO') return 'decision-go'
    if (d === 'INVESTIGATE') return 'decision-investigate'
    if (d === 'KILL') return 'decision-kill'
  }
  if (props.variant === 'status' && props.state) {
    const map: Record<CapabilityState, string> = {
      READY: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400',
      DEGRADED: 'bg-amber-950/40 border-amber-800/40 text-amber-400',
      UNAVAILABLE: 'bg-zinc-800/60 border-zinc-700 text-zinc-400',
      NOT_CONFIGURED: 'bg-zinc-900 border-zinc-700 text-zinc-500',
      UNKNOWN: 'bg-zinc-800 border-zinc-700 text-zinc-500',
    }
    return map[props.state as CapabilityState] ?? map.UNKNOWN
  }
  return 'bg-zinc-800/60 border-zinc-700 text-zinc-300'
})
</script>

<template>
  <span :class="cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide border', classes)">
    <slot>{{ label }}</slot>
  </span>
</template>
