<script setup>
defineProps({
  tone: { type: String, default: 'neutral' },
  icon: { type: String, default: '' },
})
</script>

<template>
  <span class="cp-status-badge" :class="`cp-status-badge--${tone}`">
    <i v-if="icon" class="fa-solid" :class="icon" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.cp-status-badge { display:inline-flex; min-height:1.5rem; align-items:center; gap:var(--cp-space-1); padding:.125rem var(--cp-space-2); border:1px solid var(--cp-border-default); border-radius:999px; background:var(--cp-surface-subtle); color:var(--cp-text-secondary); font:650 var(--cp-text-xs)/1.25 var(--cp-font-sans); white-space:nowrap; }
.cp-status-badge--evidence { border-color:var(--cp-evidence); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); }
.cp-status-badge--info { border-color:var(--cp-info); background:var(--cp-info-surface); color:var(--cp-info); }
.cp-status-badge--success { border-color:var(--cp-success); background:var(--cp-success-surface); color:var(--cp-success); }
.cp-status-badge--warning { border-color:var(--cp-warning); background:var(--cp-warning-surface); color:var(--cp-warning); }
.cp-status-badge--danger { border-color:var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); }
</style>
