<script setup lang="ts">
import type { Decision } from '@solux/shared'

defineProps<{
  decision: Decision
  score?: number
  compact?: boolean
}>()
</script>

<template>
  <div :class="[decisionClass(decision), compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-sm', 'rounded font-semibold inline-flex items-center gap-2']">
    <span>{{ decision }}</span>
    <span v-if="score != null" class="font-mono opacity-80">{{ score }}</span>
  </div>
</template>
