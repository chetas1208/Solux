<script setup lang="ts">
import type { CapabilityMatrixRow } from '~/types/ui'

defineProps<{ rows: CapabilityMatrixRow[] }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Capability matrix</div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-zinc-800 text-zinc-500 text-left">
            <th class="p-3">Capability</th>
            <th class="p-3">State</th>
            <th class="p-3">Required sources</th>
            <th class="p-3">Fallback</th>
            <th class="p-3">Confidence impact</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-b border-zinc-800/60">
            <td class="p-3 text-zinc-300">{{ row.capability }}</td>
            <td class="p-3"><UiBadge :label="row.state" variant="status" :state="row.state" /></td>
            <td class="p-3 text-zinc-500">{{ row.requiredSources }}</td>
            <td class="p-3 text-zinc-500">{{ row.fallback }}</td>
            <td class="p-3 text-zinc-400">{{ row.confidenceImpact }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UiCard>
</template>
