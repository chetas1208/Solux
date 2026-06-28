<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <div class="min-h-screen flex flex-col bg-surface">
    <LayoutTopCommandBar />
    <div class="flex flex-1 min-h-0">
      <LayoutSideNav />
      <main class="flex-1 min-w-0 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
