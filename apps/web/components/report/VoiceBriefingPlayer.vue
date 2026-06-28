<script setup lang="ts">
defineProps<{
  audioUrl?: string | null
  loading?: boolean
  error?: string | null
  unavailable?: boolean
}>()

defineEmits<{ generate: [] }>()
</script>

<template>
  <UiCard>
    <div class="solux-panel-header">Voice briefing</div>
    <div class="p-4">
      <p v-if="unavailable" class="data-degraded">
        MiniMax unavailable. Voice briefing disabled. Core fatal-flaw screening unaffected.
      </p>
      <template v-else>
        <UiButton v-if="!audioUrl" size="sm" :disabled="loading" @click="$emit('generate')">
          {{ loading ? 'Generating…' : 'Generate briefing' }}
        </UiButton>
        <p v-if="error" class="text-xs text-decision-kill mt-2">{{ error }}</p>
        <audio v-if="audioUrl" :src="audioUrl" controls class="w-full mt-2" />
      </template>
    </div>
  </UiCard>
</template>
