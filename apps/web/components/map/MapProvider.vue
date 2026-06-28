<script setup lang="ts">
/** Map provider abstraction — MapTiler via MapLibre when key configured. */
defineProps<{ configured?: boolean }>()
</script>

<template>
  <slot />
</template>
