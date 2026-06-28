<script setup lang="ts">
/** Full-viewport layout for 3D Earth command center — no scroll on main. */
</script>

<template>
  <div class="h-screen flex flex-col bg-surface overflow-hidden">
    <LayoutTopCommandBar />
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <LayoutSideNav />
      <main class="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
        <slot />
      </main>
    </div>
  </div>
</template>
