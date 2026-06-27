<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <nav class="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <NuxtLink to="/" class="flex items-center gap-2">
        <span class="text-solar font-bold text-lg tracking-tight">SOLUX</span>
        <span class="text-slate-500 text-xs">/ site screening</span>
      </NuxtLink>
      <div class="flex items-center gap-4 text-xs text-slate-500">
        <NuxtLink to="/projects" class="hover:text-slate-300 transition-colors">Projects</NuxtLink>
        <span class="text-slate-700">|</span>
        <span>v0.1.0</span>
      </div>
    </nav>
    <NuxtPage />
  </div>
</template>
