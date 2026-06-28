<script setup lang="ts">
import { cn } from '~/utils/cn'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'default', size: 'md', type: 'button' },
)

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center font-medium transition-colors rounded-md disabled:opacity-40 disabled:pointer-events-none',
    props.size === 'sm' && 'text-xs px-2.5 py-1.5',
    props.size === 'md' && 'text-sm px-3.5 py-2',
    props.size === 'lg' && 'text-sm px-4 py-2.5',
    props.variant === 'default' && 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
    props.variant === 'primary' && 'bg-zinc-100 text-zinc-900 hover:bg-white',
    props.variant === 'ghost' && 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
    props.variant === 'destructive' && 'bg-decision-kill/10 text-decision-kill border border-decision-kill/30 hover:bg-decision-kill/20',
  ),
)
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled">
    <slot />
  </button>
</template>
