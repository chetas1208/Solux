<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <header class="command-bar px-4 h-11 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3 min-w-0">
      <NuxtLink to="/" class="font-bold text-sm tracking-tighter text-zinc-100 shrink-0 hover:text-white transition-colors">
        SOLUX
      </NuxtLink>
      <span v-if="route.meta.commandTitle" class="text-zinc-700 text-xs">/</span>
      <span v-if="route.meta.commandTitle" class="text-xs text-zinc-400 truncate hidden sm:inline">
        {{ route.meta.commandTitle }}
      </span>
    </div>
    <div class="flex items-center gap-2 text-[11px] text-zinc-600">
      <span class="hidden sm:inline">Evidence first. Decisions second.</span>
    </div>
  </header>
</template>
