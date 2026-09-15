<script setup lang="ts">
import type { ExceptionItemVM } from './situationOverview.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'
defineProps<{ items: ExceptionItemVM[] }>()
const labels = { blocking: '阻断', attention: '需关注', info: '观察' }
const tones = { blocking: 'danger', attention: 'warning', info: 'neutral' }
</script>

<template>
  <section class="overview-panel" aria-labelledby="exception-heading">
    <header><h2 id="exception-heading">关注与例外</h2><span>{{ items.length }} 项</span></header>
    <ul v-if="items.length" class="exception-list">
      <li v-for="item in items" :key="item.id">
        <CpStatusBadge :tone="tones[item.severity]" :icon="item.severity === 'blocking' ? 'fa-circle-exclamation' : item.severity === 'attention' ? 'fa-triangle-exclamation' : 'fa-circle-info'">{{ labels[item.severity] }}</CpStatusBadge>
        <div><strong>{{ item.title }}</strong><p>{{ item.detail }}</p><small v-if="item.evidenceRef"><i class="fa-solid fa-link" aria-hidden="true" /> {{ item.evidenceRef.label }}</small></div>
        <RouterLink :to="item.action" :aria-label="`查看：${item.title}`">查看</RouterLink>
      </li>
    </ul>
    <p v-else class="exception-empty"><i class="fa-solid fa-circle-info" aria-hidden="true" />当前来源未报告待处理异常；这不表示治理成功。</p>
  </section>
</template>

<style scoped>
.overview-panel { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.overview-panel > header { display:flex; min-height:3.5rem; align-items:center; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-2) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.overview-panel h2 { margin:0; font-size:var(--cp-text-lg); }
.overview-panel header > span { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.exception-list { margin:0; padding:0; list-style:none; }
.exception-list li { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:start; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-subtle); }
.exception-list li:last-child { border-bottom:0; }
.exception-list strong { display:block; font-size:var(--cp-text-sm); }
.exception-list p { margin:var(--cp-space-1) 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.exception-list small { color:var(--cp-evidence-text); }
.exception-list a { min-height:var(--cp-control-height); padding:var(--cp-space-1) var(--cp-space-2); font-size:var(--cp-text-sm); font-weight:650; }
.exception-empty { margin:0; padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
</style>
