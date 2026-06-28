<template>
  <UiCard class="p-4 border-dashed border-zinc-700">
    <h3 class="text-xs font-semibold text-zinc-300 mb-2">API key restrictions</h3>
    <ul class="text-[11px] text-zinc-500 space-y-1.5 leading-relaxed">
      <li>Google Maps Platform keys should restrict HTTP referrers to your Solux deployment domain.</li>
      <li>MapTiler keys should restrict allowed origins in the MapTiler dashboard.</li>
      <li>Cesium ion tokens are tied to your ion account — rotate if exposed.</li>
      <li>Never commit secret keys. Public NUXT_PUBLIC_* vars are visible in the browser bundle.</li>
    </ul>
  </UiCard>
</template>
