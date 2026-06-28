<script setup lang="ts">
definePageMeta({ commandTitle: 'Home' })

const { flyToTarget, flyToRegion } = useGlobeCamera()
onMounted(() => flyToRegion(10, 25, 18_000_000))
</script>

<template>
  <div>
    <section class="relative border-b border-surface-border overflow-hidden">
      <div class="absolute inset-0 h-[420px] lg:h-[480px]">
        <ClientOnly>
          <EarthCesiumGlobe
            :sites="[]"
            :layers="[]"
            :fly-to="flyToTarget"
            class="h-full"
          />
          <template #fallback>
            <div class="h-full bg-zinc-950 flex items-center justify-center">
              <p class="text-xs text-zinc-600">Loading 3D Earth workspace…</p>
            </div>
          </template>
        </ClientOnly>
        <div class="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent pointer-events-none" />
      </div>
      <div class="relative px-6 pt-8 pb-12 lg:pb-16 max-w-5xl mx-auto min-h-[420px] lg:min-h-[480px] flex flex-col justify-end">
        <p class="text-xs uppercase tracking-widest text-zinc-500 mb-4">Solux</p>
        <h1 class="text-3xl lg:text-5xl font-semibold text-zinc-100 tracking-tight max-w-2xl">
          Kill bad solar sites before they kill your budget.
        </h1>
        <p class="text-zinc-400 mt-4 max-w-xl text-sm leading-relaxed">
          Evidence-backed fatal-flaw screening for solar and storage sites across land and water.
          Solar across land and water — useful output, not just sunlight.
        </p>
        <div class="flex flex-wrap gap-3 mt-8">
          <NuxtLink to="/projects">
            <UiButton variant="primary" size="lg">Create screening project</UiButton>
          </NuxtLink>
          <NuxtLink to="/diagnostics/maps">
            <UiButton variant="default" size="lg">Check map readiness</UiButton>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="px-6 py-12 max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
      <UiCard class="p-4">
        <h3 class="text-sm font-semibold text-zinc-200">3D Earth Screening Workspace</h3>
        <p class="text-xs text-zinc-500 mt-2 leading-relaxed">
          CesiumJS globe with backend-driven candidate overlays. GO / INVESTIGATE / KILL visible at every zoom level.
        </p>
      </UiCard>
      <UiCard class="p-4">
        <h3 class="text-sm font-semibold text-zinc-200">Evidence-first decisions</h3>
        <p class="text-xs text-zinc-500 mt-2 leading-relaxed">
          This recommendation is grounded in retrieved evidence. Unsupported claims are blocked.
        </p>
      </UiCard>
      <UiCard class="p-4">
        <h3 class="text-sm font-semibold text-zinc-200">Missing data lowers confidence</h3>
        <p class="text-xs text-zinc-500 mt-2 leading-relaxed">
          Unavailable sources are surfaced honestly. Visualization can degrade — scoring does not.
        </p>
      </UiCard>
    </section>

    <section class="px-6 pb-16 max-w-5xl mx-auto">
      <div class="solux-panel px-4 py-3 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
        <span class="text-zinc-400">Prompt</span><span>→</span>
        <span class="text-zinc-400">Evidence</span><span>→</span>
        <span class="text-zinc-400">3D Earth</span><span>→</span>
        <span class="text-zinc-400">Scoring</span><span>→</span>
        <span class="text-zinc-400">GO / INVESTIGATE / KILL</span><span>→</span>
        <span class="text-zinc-400">Report</span>
      </div>
    </section>

    <section class="px-6 pb-20 max-w-3xl mx-auto">
      <ProjectPromptBox />
    </section>
  </div>
</template>
