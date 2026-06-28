<script setup lang="ts">
defineProps<{
  title?: string
  message: string
  offline?: boolean
  retry?: boolean
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="p-4 rounded-md border border-decision-kill/30 bg-decision-kill-muted">
    <div class="text-sm font-medium text-decision-kill">
      {{ title ?? (offline ? 'Backend offline' : 'Error') }}
    </div>
    <p class="text-xs text-red-300/80 mt-1">{{ message }}</p>
    <UiButton
      v-if="retry"
      variant="ghost"
      size="sm"
      class="mt-3"
      @click="$emit('retry')"
    >
      Retry
    </UiButton>
  </div>
</template>
