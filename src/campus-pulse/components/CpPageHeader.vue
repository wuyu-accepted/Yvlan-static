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
.cp-page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-6); padding:var(--cp-space-5) var(--cp-content-gutter); border:1px solid var(--cp-border-graphite); border-radius:var(--cp-radius-lg); background:var(--cp-surface-charcoal); color:var(--cp-text-warm); }
.cp-page-header h1 { margin:0; color:var(--cp-text-warm); font-size:clamp(1.75rem,2.5vw,var(--cp-text-3xl)); line-height:1.15; letter-spacing:-.025em; }
.cp-page-header__eyebrow { margin:0 0 var(--cp-space-2); color:var(--cp-text-warm-muted); font-size:var(--cp-text-xs); font-weight:750; letter-spacing:.08em; text-transform:uppercase; }
.cp-page-header__actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
@media (max-width:767px) { .cp-page-header { flex-direction:column; padding:var(--cp-space-4); } }
</style>
