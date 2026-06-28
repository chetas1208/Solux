<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <header class="command-bar px-4 h-11 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3 min-w-0">
      <NuxtLink to="/" class="font-semibold text-sm tracking-tight text-zinc-100 shrink-0">
        SOLUX
      </NuxtLink>
      <span class="text-zinc-600 text-xs hidden sm:inline">/</span>
      <span v-if="route.meta.commandTitle" class="text-xs text-zinc-400 truncate hidden sm:inline">
        {{ route.meta.commandTitle }}
      </span>
    </div>
    <div class="flex items-center gap-2 text-xs">
      <NuxtLink to="/diagnostics/maps" class="text-zinc-500 hover:text-zinc-300 transition-colors">
        Map diagnostics
      </NuxtLink>
      <span class="text-zinc-700">|</span>
      <NuxtLink to="/status" class="text-zinc-500 hover:text-zinc-300 transition-colors">
        Readiness
      </NuxtLink>
      <span class="text-zinc-700">|</span>
      <NuxtLink to="/projects" class="text-zinc-500 hover:text-zinc-300 transition-colors">
        Projects
      </NuxtLink>
    </div>
  </header>
</template>
