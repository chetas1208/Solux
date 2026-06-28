<script setup lang="ts">
import { cn } from '~/utils/cn'

defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('solux-panel', $props.class)">
    <slot />
  </div>
</template>
