<script setup lang="ts">
import type { SiteWithScore } from '~/types/api'

const props = defineProps<{
  site: SiteWithScore
  projectId: string
  selected?: boolean
}>()

defineEmits<{ click: [] }>()

const sb = computed(() => props.site.scoreBreakdown)
</script>

<template>
  <div
    class="solux-panel p-3 cursor-pointer transition-colors hover:border-zinc-600"
    :class="selected ? 'border-zinc-500 ring-1 ring-zinc-600' : ''"
    @click="$emit('click')"
  >
    <div class="flex items-start gap-2">
      <UiBadge
        v-if="sb"
        :label="sb.finalDecision"
        variant="decision"
        :state="sb.finalDecision"
        class="shrink-0"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-zinc-200 truncate">{{ site.name }}</span>
          <span class="font-mono text-sm text-zinc-300 shrink-0">{{ sb?.finalScore ?? '—' }}</span>
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-zinc-500">
          <span>{{ siteTypeLabel(site.siteType) }}</span>
          <span :class="sb ? confidenceClass(confidenceLevel(sb.confidence)) : ''">
            {{ sb?.confidence ?? '—' }}% conf
          </span>
          <span>{{ sb?.evidenceIds.length ?? 0 }} evidence</span>
          <span v-if="sb?.missingDataWarnings.length">{{ sb.missingDataWarnings.length }} gaps</span>
        </div>
        <p v-if="sb?.topPositiveFactors[0]" class="text-[11px] text-emerald-500/80 mt-1 truncate">
          + {{ sb.topPositiveFactors[0] }}
        </p>
        <p v-if="sb?.topFatalFlaws[0]" class="text-[11px] text-decision-kill/80 mt-0.5 truncate">
          {{ sb.topFatalFlaws[0] }}
        </p>
      </div>
    </div>
    <NuxtLink
      :to="`/projects/${projectId}/sites/${site.id}`"
      class="block mt-2 text-[11px] text-zinc-400 hover:text-zinc-200"
      @click.stop
    >
      Open fatal-flaw report →
    </NuxtLink>
  </div>
</template>
