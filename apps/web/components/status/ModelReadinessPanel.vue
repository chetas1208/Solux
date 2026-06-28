<script setup lang="ts">
import type { CapabilityItem } from '~/types/ui'

defineProps<{ items: CapabilityItem[] }>()
</script>

<template>
  <StatusDataSourceStatusPanel title="AI + model layer" :items="items" />
</template>
