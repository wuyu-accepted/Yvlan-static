<script setup>
defineProps({
  variant: { type: String, default: 'secondary' },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
})
</script>

<template>
  <button class="cp-button" :class="`cp-button--${variant}`" :type="type" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.cp-button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font:650 var(--cp-text-sm)/1 var(--cp-font-sans); cursor:pointer; transition:background-color var(--cp-motion-fast) ease,border-color var(--cp-motion-fast) ease,color var(--cp-motion-fast) ease; }
.cp-button:hover:not(:disabled) { border-color:var(--cp-text-secondary); background:var(--cp-surface-subtle); }
.cp-button--primary { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-text-inverse); }
.cp-button--primary:hover:not(:disabled) { border-color:var(--cp-action-primary-hover); background:var(--cp-action-primary-hover); }
.cp-button:disabled { cursor:not-allowed; opacity:.55; }
@media (max-width:767px) { .cp-button { min-height:var(--cp-touch-target); } }
</style>
