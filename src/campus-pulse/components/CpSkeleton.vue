<script setup>
defineProps({ rows: { type: Number, default: 4 } })
</script>

<template>
  <div class="cp-skeleton" aria-hidden="true">
    <span class="cp-skeleton__title" />
    <span v-for="row in rows" :key="row" class="cp-skeleton__row" :style="{ width: `${Math.max(46, 96 - row * 9)}%` }" />
  </div>
</template>

<style scoped>
.cp-skeleton { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-6); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.cp-skeleton span { display:block; height:.75rem; border-radius:var(--cp-radius-sm); background:var(--cp-border-default); animation:cp-skeleton-pulse 1.4s ease-in-out infinite alternate; }
.cp-skeleton__title { width:32%; height:1.25rem !important; }
@keyframes cp-skeleton-pulse { to { opacity:.45; } }
</style>
