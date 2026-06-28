<script setup lang="ts">
import type { EvidenceItem } from '~/types/api'

defineProps<{ item: EvidenceItem | null; open: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open && item" class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/60" @click="$emit('close')" />
      <aside class="relative w-full max-w-md bg-surface-raised border-l border-surface-border h-full overflow-auto">
        <div class="solux-panel-header flex justify-between items-center">
          <span>Evidence detail</span>
          <button type="button" class="text-zinc-500 hover:text-zinc-300" @click="$emit('close')">×</button>
        </div>
        <div class="p-4 text-sm space-y-3">
          <div><span class="text-zinc-500">Source</span><div class="text-zinc-200">{{ item.source }}</div></div>
          <div><span class="text-zinc-500">Description</span><div class="text-zinc-300">{{ item.description }}</div></div>
          <div><span class="text-zinc-500">Value</span><div class="font-mono text-xs text-zinc-400">{{ JSON.stringify(item.value) }}</div></div>
          <div><span class="text-zinc-500">Retrieved</span><div class="font-mono text-xs">{{ item.retrievedAt }}</div></div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
