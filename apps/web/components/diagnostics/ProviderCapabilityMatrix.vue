<script setup lang="ts">
import type { MapDiagnosticsSnapshot } from '~/types/diagnostics'

const props = defineProps<{ snapshot: MapDiagnosticsSnapshot }>()

const rows = computed(() => {
  const backend = props.snapshot.backend?.providers ?? []
  const client = props.snapshot.client
  return [...backend, ...client]
})
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Provider capability matrix</div>
    <div class="overflow-x-auto">
      <table class="w-full text-[11px]">
        <thead>
          <tr class="text-zinc-600 border-b border-surface-border">
            <th class="text-left px-4 py-2 font-medium">Provider</th>
            <th class="text-left px-4 py-2 font-medium">State</th>
            <th class="text-left px-4 py-2 font-medium">Configured</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-b border-surface-border/50">
            <td class="px-4 py-2 text-zinc-300">{{ row.name }}</td>
            <td class="px-4 py-2 font-mono" :class="`status-${row.state.toLowerCase().replace('_', '-')}`">
              {{ row.state }}
            </td>
            <td class="px-4 py-2 text-zinc-500">{{ row.configured ? 'Yes' : 'No' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UiCard>
</template>
