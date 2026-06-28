<script setup lang="ts">
import type { EvidenceItem } from '~/types/api'

defineProps<{ evidence: EvidenceItem[] }>()
</script>

<template>
  <section>
    <div class="text-[11px] uppercase text-zinc-500 mb-2">Retrieval timeline</div>
    <div class="border-l border-zinc-700 ml-2 space-y-3">
      <div v-for="item in evidence" :key="item.id" class="pl-4 relative">
        <span class="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-zinc-600" />
        <div class="text-[10px] font-mono text-zinc-600">{{ new Date(item.retrievedAt).toISOString() }}</div>
        <div class="text-xs text-zinc-400">{{ item.description }}</div>
      </div>
      <p v-if="!evidence.length" class="pl-4 text-xs text-zinc-600">Agent step timeline unavailable until screening completes.</p>
    </div>
  </section>
</template>
