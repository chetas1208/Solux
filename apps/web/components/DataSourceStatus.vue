<script setup lang="ts">
import type { DataSourceStatus } from '@solux/shared'

const { getDataSources } = useApi()
const { data: sources } = await useAsyncData('data-sources', () => getDataSources(), {
  server: false,
  default: () => [] as DataSourceStatus[],
})
</script>

<template>
  <div class="panel">
    <div class="panel-header">Data Source Status</div>
    <div class="p-3 space-y-2">
      <div
        v-for="source in sources"
        :key="source.id"
        class="flex items-start gap-2 text-xs"
      >
        <div
          :class="source.available ? 'bg-green-500' : 'bg-slate-600'"
          class="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
        />
        <div class="flex-1">
          <div :class="source.available ? 'text-slate-300' : 'text-slate-600'">
            {{ source.label }}
          </div>
          <div v-if="!source.available && source.unavailableReason" class="text-slate-700 text-xs mt-0.5">
            {{ source.unavailableReason }}
          </div>
          <div v-else-if="source.coverageDescription" class="text-slate-600">
            {{ source.coverageDescription }}
          </div>
        </div>
      </div>
      <div v-if="!sources?.length" class="text-slate-600 text-xs">
        Could not reach API — check backend is running.
      </div>
    </div>
  </div>
</template>
