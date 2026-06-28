<script setup lang="ts">
definePageMeta({ commandTitle: 'Map provider diagnostics' })
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <LayoutPageHeader
      title="Map Provider Diagnostics"
      subtitle="Professional readiness checks for CesiumJS, Google 3D Tiles, MapTiler, and MapLibre fallback. Missing providers degrade visualization only — fatal-flaw scoring remains available."
    />
    <DiagnosticsMapProviderDiagnostics />
  </div>
</template>
