<script setup lang="ts">
definePageMeta({ commandTitle: 'Home' })
</script>

<template>
  <div>
    <section class="px-6 py-16 lg:py-24 max-w-5xl mx-auto">
      <p class="text-xs uppercase tracking-widest text-zinc-500 mb-4">Solux</p>
      <h1 class="text-3xl lg:text-4xl font-semibold text-zinc-100 tracking-tight max-w-2xl">
        Kill bad solar sites before they kill your budget.
      </h1>
      <p class="text-zinc-500 mt-4 max-w-xl text-sm leading-relaxed">
        Evidence-backed fatal-flaw screening for solar and storage sites across land and water.
        Solar across land and water — useful output, not just sunlight.
      </p>
      <div class="flex flex-wrap gap-3 mt-8">
        <NuxtLink to="/projects">
          <UiButton variant="primary" size="lg">Create screening project</UiButton>
        </NuxtLink>
        <NuxtLink to="/status">
          <UiButton variant="default" size="lg">View system readiness</UiButton>
        </NuxtLink>
      </div>
    </section>

    <section class="px-6 pb-12 max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
      <UiCard class="p-4">
        <h3 class="text-sm font-semibold text-zinc-200">Useful output, not just sunlight</h3>
        <p class="text-xs text-zinc-500 mt-2 leading-relaxed">
          Solux retrieves real grid, terrain, and irradiance data — then flags fatal flaws before you commit capital.
        </p>
      </UiCard>
      <UiCard class="p-4">
        <h3 class="text-sm font-semibold text-zinc-200">GO / INVESTIGATE / KILL decisions</h3>
        <p class="text-xs text-zinc-500 mt-2 leading-relaxed">
          Every candidate gets an evidence-backed decision — not a vanity irradiance score.
        </p>
      </UiCard>
      <UiCard class="p-4">
        <h3 class="text-sm font-semibold text-zinc-200">Missing data lowers confidence</h3>
        <p class="text-xs text-zinc-500 mt-2 leading-relaxed">
          Unavailable sources are surfaced honestly. Confidence drops when layers are missing — never hidden.
        </p>
      </UiCard>
    </section>

    <section class="px-6 pb-16 max-w-5xl mx-auto">
      <div class="solux-panel px-4 py-3 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
        <span class="text-zinc-400">Prompt</span><span>→</span>
        <span class="text-zinc-400">Evidence</span><span>→</span>
        <span class="text-zinc-400">Scoring</span><span>→</span>
        <span class="text-zinc-400">Decision</span><span>→</span>
        <span class="text-zinc-400">Report</span>
      </div>
    </section>

    <section class="px-6 pb-20 max-w-3xl mx-auto">
      <ProjectPromptBox />
    </section>
  </div>
</template>
