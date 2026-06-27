<script setup lang="ts">
import type { ProjectBrief } from '@solux/shared'

const { listProjects } = useApi()
const { data: projects, pending, error } = await useAsyncData('projects', () => listProjects())
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 py-10">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-lg font-semibold text-slate-200">Screening Projects</h2>
      <NuxtLink
        to="/"
        class="text-xs px-3 py-1.5 bg-solar text-slate-900 rounded font-semibold hover:bg-amber-400 transition-colors"
      >
        + New Project
      </NuxtLink>
    </div>

    <div v-if="pending" class="text-slate-500 text-sm">Loading...</div>
    <div v-else-if="error" class="text-red-400 text-sm">{{ error }}</div>
    <div v-else-if="!projects?.length" class="text-slate-600 text-sm">
      No projects yet. <NuxtLink to="/" class="text-solar hover:underline">Create one</NuxtLink>.
    </div>
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="p in projects"
        :key="p.id"
        :to="`/projects/${p.id}`"
        class="panel flex items-start gap-4 p-4 hover:border-slate-500 transition-colors block"
      >
        <div class="flex-1 min-w-0">
          <div class="text-sm text-slate-200 truncate">{{ p.rawPrompt }}</div>
          <div class="text-xs text-slate-600 mt-1">{{ new Date(p.createdAt).toLocaleString() }}</div>
        </div>
        <div class="text-xs text-slate-500 shrink-0">→</div>
      </NuxtLink>
    </div>
  </div>
</template>
