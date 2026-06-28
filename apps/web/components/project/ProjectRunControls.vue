<script setup lang="ts">
defineProps<{
  canParse: boolean
  canScreen: boolean
  parsing: boolean
  screening: boolean
}>()

defineEmits<{ parse: []; screen: [] }>()
</script>

<template>
  <div class="p-3 space-y-2">
    <UiButton
      v-if="canParse"
      variant="primary"
      class="w-full"
      :disabled="parsing"
      @click="$emit('parse')"
    >
      {{ parsing ? 'Parsing with Gemini…' : 'Confirm & parse constraints' }}
    </UiButton>
    <UiButton
      v-if="canScreen"
      variant="primary"
      class="w-full"
      :disabled="screening"
      @click="$emit('screen')"
    >
      {{ screening ? 'Screening in progress…' : 'Start fatal-flaw screening' }}
    </UiButton>
    <p v-if="screening" class="text-[11px] text-zinc-500">
      Fetching real data sources. Degraded sources will lower confidence — no synthetic progress.
    </p>
  </div>
</template>
