<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  actionLabel?: string
  actionTo?: string
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div class="w-10 h-10 rounded border border-dashed border-zinc-600 flex items-center justify-center mb-4">
      <span class="text-zinc-600 text-lg">—</span>
    </div>
    <h3 class="text-sm font-semibold text-zinc-300">{{ title }}</h3>
    <p v-if="description" class="text-xs text-zinc-500 mt-2 max-w-sm">{{ description }}</p>
    <div class="mt-4 flex gap-2">
      <NuxtLink v-if="actionTo" :to="actionTo">
        <UiButton variant="primary" size="sm">{{ actionLabel ?? 'Continue' }}</UiButton>
      </NuxtLink>
      <UiButton v-else-if="actionLabel" variant="primary" size="sm" @click="$emit('action')">
        {{ actionLabel }}
      </UiButton>
    </div>
    <slot />
  </div>
</template>
