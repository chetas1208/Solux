<script setup lang="ts">
definePageMeta({ commandTitle: 'Operational readiness' })

const { loading, error, offline, summary, capabilityMatrix, dataCapabilities, coreCapabilities, aiCapabilities, scoringCapabilities, refresh } = useOperationalReadiness()

onMounted(() => refresh(true))
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <LayoutPageHeader
      title="Solux Operational Readiness"
      subtitle="Solux never hides missing data. Missing sources lower confidence or disable specific capabilities."
      actions
    >
      <template #actions>
        <UiButton variant="ghost" size="sm" :disabled="loading" @click="refresh(true)">
          {{ loading ? 'Checking…' : 'Deep check' }}
        </UiButton>
      </template>
    </LayoutPageHeader>

    <LayoutErrorState
      v-if="offline"
      offline
      title="Backend offline"
      :message="error ?? 'Cannot reach Solux API.'"
      retry
      @retry="refresh(true)"
    />

    <StatusOperationalReadinessPanel :summary="summary" />
    <StatusCapabilityMatrix :rows="capabilityMatrix" />
    <StatusDataSourceStatusPanel title="Data coverage" :items="dataCapabilities" />
    <StatusDataSourceStatusPanel title="Core runtime" :items="coreCapabilities" />
    <StatusModelReadinessPanel :items="aiCapabilities" />
    <StatusDataSourceStatusPanel title="Scoring + execution" :items="scoringCapabilities" />
    <StatusSponsorStackPanel />
  </div>
</template>
