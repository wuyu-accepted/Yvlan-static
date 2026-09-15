<script setup>
defineProps({ label: { type: String, default: '页面工具栏' } })
</script>

<template>
  <div class="cp-toolbar" role="toolbar" :aria-label="label"><slot /></div>
</template>

<style scoped>
.cp-toolbar { display:flex; min-height:var(--cp-control-height); align-items:center; flex-wrap:wrap; gap:var(--cp-space-2); padding:var(--cp-space-2) var(--cp-content-gutter); border-bottom:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
@media (max-width:767px) { .cp-toolbar { padding-inline:var(--cp-space-4); } }
</style>
