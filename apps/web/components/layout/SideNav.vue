<script setup lang="ts">
const links = [
  { to: '/', label: 'Home' },
  { to: '/projects', label: 'Projects' },
  { to: '/status', label: 'Readiness' },
]
</script>

<template>
  <aside class="hidden lg:flex w-44 shrink-0 flex-col border-r border-surface-border bg-surface-raised">
    <nav class="p-3 space-y-0.5">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="block px-2.5 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
        active-class="!text-zinc-100 bg-zinc-800/80"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>
    <div class="mt-auto p-3 border-t border-surface-border">
      <p class="text-[10px] text-zinc-600 leading-relaxed">
        Evidence-backed fatal-flaw screening. Missing data lowers confidence.
      </p>
    </div>
  </aside>
</template>
