<script setup lang="ts">
import type { CapabilityItem } from '~/types/ui'

defineProps<{ title: string; items: CapabilityItem[] }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">{{ title }}</div>
    <div class="divide-y divide-zinc-800">
      <StatusStatusHealthCard
        v-for="item in items"
        :key="item.id"
        :label="item.name"
        :state="item.state"
        :detail="item.confidenceImpact"
        :fallback="item.fallbackBehavior"
        :action="item.actionNeeded"
        :checked-at="item.lastCheckedAt"
        expanded
      />
    </div>
  </UiCard>
</template>
