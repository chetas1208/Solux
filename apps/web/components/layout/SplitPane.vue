<script setup lang="ts">
defineProps<{
  leftWidth?: string
  rightWidth?: string
}>()
</script>

<template>
  <div class="flex flex-col lg:flex-row min-h-0 flex-1 h-full">
    <div
      v-if="$slots.left"
      class="shrink-0 border-b lg:border-b-0 lg:border-r border-surface-border overflow-auto"
      :style="{ width: leftWidth ?? '280px' }"
    >
      <slot name="left" />
    </div>
    <div class="flex-1 min-w-0 min-h-0 flex flex-col">
      <slot />
    </div>
    <div
      v-if="$slots.right"
      class="shrink-0 border-t lg:border-t-0 lg:border-l border-surface-border overflow-auto"
      :style="{ width: rightWidth ?? '320px' }"
    >
      <slot name="right" />
    </div>
  </div>
</template>
