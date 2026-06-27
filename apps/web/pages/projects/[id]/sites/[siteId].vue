<script setup lang="ts">
const route = useRoute()
const projectId = route.params['id'] as string
const siteId = route.params['siteId'] as string
const { getSiteReport, generateBriefing } = useApi()

const { data, pending, error } = await useAsyncData(`site-${siteId}`, () => getSiteReport(siteId))

const briefing = ref<{ audioUrl: string | null; transcript: string } | null>(null)
const briefingLoading = ref(false)
const briefingError = ref<string | null>(null)

async function requestBriefing() {
  briefingLoading.value = true
  briefingError.value = null
  try {
    briefing.value = await generateBriefing(siteId)
  } catch (err) {
    briefingError.value = String(err)
  } finally {
    briefingLoading.value = false
  }
}

function decisionClass(d: string) {
  if (d === 'GO') return 'decision-go'
  if (d === 'INVESTIGATE') return 'decision-investigate'
  return 'decision-kill'
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8">
    <div class="text-xs text-slate-600 mb-6">
      <NuxtLink :to="`/projects/${projectId}`" class="hover:text-slate-400">← Project</NuxtLink>
    </div>

    <div v-if="pending" class="text-slate-500 text-sm">Loading report...</div>
    <div v-else-if="error" class="text-red-400 text-sm">{{ error }}</div>
    <div v-else-if="data">
      <!-- Decision Banner -->
      <div :class="decisionClass(data.decision.decision)" class="rounded-lg p-4 mb-6 flex items-center justify-between">
        <div>
          <div class="text-xs uppercase tracking-widest mb-1 opacity-70">Fatal-Flaw Decision</div>
          <div class="text-2xl font-bold">{{ data.decision.decision }}</div>
          <div class="text-sm mt-1 opacity-90">{{ data.decision.headline }}</div>
        </div>
        <div class="text-right">
          <div class="text-3xl font-mono font-bold">{{ data.decision.scoreBreakdown.finalScore }}</div>
          <div class="text-xs opacity-70">/ 100</div>
          <div class="text-xs mt-1 opacity-70">{{ data.decision.scoreBreakdown.confidence }}% confidence</div>
        </div>
      </div>

      <!-- Kill Triggers -->
      <div v-if="data.decision.killTriggers.length" class="panel mb-4">
        <div class="panel-header">Fatal Flaws</div>
        <div class="p-3 space-y-2">
          <div
            v-for="flaw in data.decision.killTriggers"
            :key="flaw.description"
            class="flex items-start gap-2 text-sm text-red-400"
          >
            <span class="mt-0.5">✕</span>
            <div>
              <span class="text-xs text-slate-500 uppercase">{{ flaw.dimension }}</span>
              <div>{{ flaw.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Score Breakdown -->
      <ScoreBreakdown :score="data.decision.scoreBreakdown" class="mb-4" />

      <!-- AI Report -->
      <div v-if="data.aiReport" class="panel mb-4">
        <div class="panel-header">AI Analysis</div>
        <div class="p-4 text-sm text-slate-300 space-y-4">
          <p>{{ (data.aiReport as { executiveSummary?: string }).executiveSummary }}</p>
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-widest mb-2">Key Findings</div>
            <ul class="space-y-1 text-slate-400 text-xs">
              <li v-for="f in (data.aiReport as { keyFindings?: string[] }).keyFindings" :key="f" class="flex gap-2">
                <span class="text-slate-600">›</span>{{ f }}
              </li>
            </ul>
          </div>
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-widest mb-2">Next Steps</div>
            <ul class="space-y-1 text-slate-400 text-xs">
              <li v-for="s in (data.aiReport as { recommendedNextSteps?: string[] }).recommendedNextSteps" :key="s" class="flex gap-2">
                <span class="text-solar">→</span>{{ s }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Missing Data Warnings -->
      <div v-if="data.decision.scoreBreakdown.missingDataWarnings.length" class="panel mb-4">
        <div class="panel-header">Missing Data</div>
        <div class="p-3 space-y-1">
          <div
            v-for="w in data.decision.scoreBreakdown.missingDataWarnings"
            :key="w"
            class="data-missing"
          >
            {{ w }}
          </div>
        </div>
      </div>

      <!-- Evidence Trace -->
      <EvidenceTrace :evidence="data.evidence" class="mb-4" />

      <!-- MiniMax Briefing -->
      <div class="panel">
        <div class="panel-header">60-Second Executive Briefing</div>
        <div class="p-4">
          <div v-if="!data.miniMaxAvailable" class="data-missing">
            MiniMax not configured — set MINIMAX_API_KEY and MINIMAX_GROUP_ID to enable spoken briefings
          </div>
          <div v-else>
            <button
              v-if="!briefing"
              :disabled="briefingLoading"
              class="px-3 py-1.5 bg-slate-700 text-slate-200 text-xs rounded hover:bg-slate-600 disabled:opacity-40"
              @click="requestBriefing"
            >
              {{ briefingLoading ? 'Generating...' : 'Generate Spoken Briefing' }}
            </button>
            <div v-if="briefingError" class="text-red-400 text-xs mt-2">{{ briefingError }}</div>
            <div v-if="briefing">
              <audio v-if="briefing.audioUrl" :src="briefing.audioUrl" controls class="w-full mt-2" />
              <div class="text-xs text-slate-500 mt-2 leading-relaxed">{{ briefing.transcript }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
