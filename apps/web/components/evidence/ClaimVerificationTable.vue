<script setup lang="ts">
import type { ClaimVerificationResult } from '~/types/api'

defineProps<{ verification?: ClaimVerificationResult }>()
</script>

<template>
  <UiCard v-if="verification">
    <div class="solux-panel-header">Claim verification</div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-zinc-800 text-zinc-500 text-left">
            <th class="p-3">Claim</th>
            <th class="p-3">Type</th>
            <th class="p-3">Supported</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, i) in verification.claims" :key="i" class="border-b border-zinc-800/60">
            <td class="p-3 text-zinc-300 max-w-md">{{ c.text }}</td>
            <td class="p-3 text-zinc-500">{{ c.claimType }}</td>
            <td class="p-3">
              <span :class="c.supported ? 'text-emerald-400' : 'text-decision-kill'">
                {{ c.supported ? 'Yes' : 'No configured source supports this claim.' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UiCard>
</template>
