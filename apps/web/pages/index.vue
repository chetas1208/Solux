<script setup lang="ts">
definePageMeta({ commandTitle: 'Home', layout: 'default' })

const { flyToTarget, flyToRegion } = useGlobeCamera()

onMounted(() => flyToRegion(20, 22, 14_000_000))
</script>

<template>
  <div class="bg-surface min-h-screen">
    <!-- Hero: strict left/right split — no overlap -->
    <section class="relative flex min-h-screen lg:min-h-[100vh]">
      <!-- LEFT: brand + content column -->
      <div class="relative z-10 flex flex-col justify-center w-full lg:w-[46%] px-8 md:px-12 lg:px-14 xl:px-16 py-16 lg:py-20 bg-surface">
        <!-- Brand -->
        <div class="mb-10">
          <h1 class="text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tighter text-white leading-none select-none">
            Solux
          </h1>
          <p class="text-xs uppercase tracking-[0.2em] text-zinc-500 mt-3 font-medium">
            Solar Site Intelligence
          </p>
        </div>

        <!-- Primary headline -->
        <h2 class="text-xl lg:text-2xl font-semibold text-zinc-100 leading-snug max-w-lg mb-4">
          Evidence-backed solar site screening for India and the United States.
        </h2>

        <!-- Subcopy -->
        <p class="text-zinc-400 text-sm leading-relaxed max-w-md mb-2">
          Solux analyzes real geospatial, solar, terrain, grid, water, and environmental data to
          identify the top candidate locations for solar and storage projects.
        </p>
        <p class="text-zinc-600 text-[11px] mb-8 leading-relaxed max-w-sm">
          Every recommendation is tied to evidence, confidence, and source availability.
        </p>

        <!-- Prompt box -->
        <ProjectPromptBox class="max-w-lg" />

        <!-- Secondary CTA -->
        <div class="mt-5 flex items-center gap-4">
          <NuxtLink
            to="/status"
            class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View data readiness →
          </NuxtLink>
          <NuxtLink
            to="/projects"
            class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Past projects →
          </NuxtLink>
        </div>

        <!-- Pipeline breadcrumb -->
        <div class="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-700 select-none">
          <span>Prompt</span><span class="text-zinc-800">›</span>
          <span>Evidence</span><span class="text-zinc-800">›</span>
          <span>3D Earth</span><span class="text-zinc-800">›</span>
          <span>Scoring</span><span class="text-zinc-800">›</span>
          <span>GO / INVESTIGATE / KILL</span><span class="text-zinc-800">›</span>
          <span>Report</span>
        </div>
      </div>

      <!-- RIGHT: globe column — occupies right 54%, absolutely positioned to fill height -->
      <div class="hidden lg:block absolute right-0 top-0 bottom-0 left-[46%] overflow-hidden pointer-events-none lg:pointer-events-auto">
        <!-- Left-edge veil blends globe into content column -->
        <div class="absolute inset-y-0 left-0 w-24 xl:w-32 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
        <!-- Top/bottom veil -->
        <div class="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-surface/70 to-transparent z-10 pointer-events-none" />
        <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface/80 to-transparent z-10 pointer-events-none" />

        <ClientOnly>
          <EarthCesiumGlobe
            :sites="[]"
            :layers="[]"
            :fly-to="flyToTarget"
            class="absolute inset-0 h-full w-full"
          />
          <template #fallback>
            <div class="absolute inset-0 bg-zinc-950 flex items-center justify-center">
              <div class="text-center">
                <div class="w-2 h-2 bg-zinc-600 rounded-full mx-auto mb-3 animate-pulse" />
                <p class="text-[10px] text-zinc-700">Loading 3D Earth…</p>
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <!-- Mobile globe: below content, reduced opacity, no interaction -->
      <div class="lg:hidden absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-15">
        <ClientOnly>
          <EarthCesiumGlobe :sites="[]" :layers="[]" :fly-to="flyToTarget" class="absolute inset-0 h-full" />
        </ClientOnly>
      </div>
    </section>

    <!-- Feature strip -->
    <section class="border-t border-surface-border px-8 md:px-12 py-12 max-w-4xl mx-auto grid sm:grid-cols-3 gap-6">
      <div class="space-y-2">
        <p class="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Real data only</p>
        <p class="text-xs text-zinc-500 leading-relaxed">
          CesiumJS globe with backend-driven candidate overlays. GO / INVESTIGATE / KILL visible at every
          zoom level from real scored geospatial data.
        </p>
      </div>
      <div class="space-y-2">
        <p class="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Evidence first</p>
        <p class="text-xs text-zinc-500 leading-relaxed">
          Every recommendation is grounded in retrieved evidence. Unsupported claims are blocked.
          Missing data lowers confidence — never silently.
        </p>
      </div>
      <div class="space-y-2">
        <p class="text-xs font-semibold text-zinc-200 uppercase tracking-wider">India · United States</p>
        <p class="text-xs text-zinc-500 leading-relaxed">
          584,537 scored H3 candidates across India solar belt and USA Southwest. Deterministic scoring
          with optional model reranking.
        </p>
      </div>
    </section>
  </div>
</template>
