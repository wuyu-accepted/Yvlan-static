<script setup>
defineProps({
  label: { type: String, required: true },
  expanded: { type: Boolean, default: undefined },
  controls: { type: String, default: undefined },
})
</script>

<template>
  <button class="cp-icon-button" type="button" :aria-label="label" :aria-expanded="expanded" :aria-controls="controls">
    <slot />
  </button>
</template>

<style scoped>
.cp-icon-button { display:inline-grid; width:var(--cp-touch-target); min-width:var(--cp-touch-target); height:var(--cp-touch-target); place-items:center; border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.cp-icon-button:hover { border-color:var(--cp-border-strong); background:var(--cp-surface-subtle); }
</style>
