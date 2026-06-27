<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { createProject } = useApi()

const prompt = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const EXAMPLES = [
  'Screen Gujarat and Rajasthan for 100 MW solar + 50 MW storage sites. Avoid dense vegetation. Prioritize grid access and low dust loss. Include shallow coastal and reservoir options if feasible.',
  'Find 50 MW floating solar candidates in Karnataka reservoirs. Maximum 2.5 m water depth. Must be within 15 km of a 66 kV+ line.',
  'Identify utility-scale solar sites in Nevada for 200 MW. Avoid protected desert areas. Require road access within 5 km.',
]

async function submit() {
  if (!prompt.value.trim() || loading.value) return
  loading.value = true
  error.value = null
  try {
    const brief = await createProject(prompt.value.trim())
    await router.push(`/projects/${brief.id}`)
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
}

function useExample(ex: string) {
  prompt.value = ex
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-20">
    <div class="mb-12">
      <h1 class="text-4xl font-bold text-slate-100 mb-3">
        Fatal-flaw screening for<br />
        <span class="text-solar">solar site selection</span>
      </h1>
      <p class="text-slate-400 text-sm leading-relaxed max-w-xl">
        Describe your project in plain English. Solux retrieves real solar, grid, and terrain data,
        generates candidate sites, and returns
        <span class="text-green-400 font-semibold">GO</span> /
        <span class="text-amber-400 font-semibold">INVESTIGATE</span> /
        <span class="text-red-400 font-semibold">KILL</span>
        decisions grounded in retrieved evidence — not invented claims.
      </p>
    </div>

    <div class="panel p-4 mb-6">
      <div class="panel-header mb-3">Project requirement</div>
      <textarea
        v-model="prompt"
        rows="5"
        placeholder="E.g. Screen Gujarat and Rajasthan for 100 MW solar + 50 MW storage..."
        class="w-full bg-transparent text-slate-200 text-sm placeholder-slate-600 resize-none outline-none leading-relaxed"
        :disabled="loading"
        @keydown.ctrl.enter="submit"
      />
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
        <span class="text-xs text-slate-600">Ctrl+Enter to submit</span>
        <button
          :disabled="!prompt.trim() || loading"
          class="px-4 py-2 bg-solar text-slate-900 text-sm font-semibold rounded disabled:opacity-40 hover:bg-amber-400 transition-colors"
          @click="submit"
        >
          {{ loading ? 'Creating project...' : 'Screen Sites' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded p-3 text-red-400 text-sm mb-6">
      {{ error }}
    </div>

    <div class="space-y-2">
      <div class="text-xs text-slate-600 uppercase tracking-widest mb-2">Examples</div>
      <button
        v-for="ex in EXAMPLES"
        :key="ex"
        class="block w-full text-left text-xs text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 rounded p-3 transition-all"
        @click="useExample(ex)"
      >
        {{ ex }}
      </button>
    </div>

    <DataSourceStatus class="mt-12" />
  </div>
</template>
