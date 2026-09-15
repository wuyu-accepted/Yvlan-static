<script setup>
defineProps({ title: { type: String, required: true }, eyebrow: { type: String, default: '' } })
</script>

<template>
  <header class="cp-page-header">
    <div>
      <p v-if="eyebrow" class="cp-page-header__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <slot name="description" />
    </div>
    <div v-if="$slots.actions" class="cp-page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.cp-page-header { position:relative; display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-6); padding:var(--cp-space-6) var(--cp-content-gutter); overflow:hidden; border:1px solid var(--cp-border-subtle); border-radius:var(--cp-radius-lg); background:var(--cp-surface-default); box-shadow:none; }
.cp-page-header::after { position:absolute; width:12rem; height:12rem; right:-5rem; top:-7rem; border:1px solid var(--cp-tech-line); border-radius:50%; content:''; opacity:.65; }
.cp-page-header h1 { margin:0; color:var(--cp-text-primary); font-size:clamp(1.5rem,2.4vw,2rem); line-height:1.15; letter-spacing:-.025em; }
.cp-page-header__eyebrow { margin:0 0 var(--cp-space-3); color:var(--cp-tech); font-size:var(--cp-text-xs); font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
.cp-page-header__actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
@media (max-width:767px) { .cp-page-header { flex-direction:column; padding:var(--cp-space-4); } }
</style>
