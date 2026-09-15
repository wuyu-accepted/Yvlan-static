<script setup lang="ts">
import type { FindingVM } from './situationOverview.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'
defineProps<{ findings: FindingVM[] }>()
</script>

<template>
  <section class="findings-panel" aria-labelledby="findings-heading">
    <header><h2 id="findings-heading">证据支持的观察</h2></header>
    <ol v-if="findings.length">
      <li v-for="finding in findings" :key="finding.id">
        <div class="finding-title"><strong>{{ finding.title }}</strong><CpStatusBadge v-if="finding.evidenceRef" tone="evidence" icon="fa-link">已绑定证据</CpStatusBadge><CpStatusBadge v-else icon="fa-circle-info">未绑定证据</CpStatusBadge></div>
        <p>{{ finding.detail }}</p>
        <small>{{ finding.boundary }}</small>
        <RouterLink v-if="finding.evidenceRef" :to="finding.evidenceRef.action" :aria-label="`查看证据：${finding.title}`">查看 {{ finding.evidenceRef.label }}</RouterLink>
      </li>
    </ol>
    <p v-else class="findings-empty">当前来源没有可由已批准规则生成的观察；系统不会用预设结论补齐。</p>
  </section>
</template>

<style scoped>
.findings-panel { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.findings-panel > header { padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.findings-panel h2 { margin:0; font-size:var(--cp-text-lg); }
.findings-panel ol { margin:0; padding:0; list-style:none; }
.findings-panel li { padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-subtle); }
.findings-panel li:last-child { border-bottom:0; }
.finding-title { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--cp-space-2); }
.finding-title strong { font-size:var(--cp-text-sm); }
.findings-panel li p { margin:var(--cp-space-2) 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:var(--cp-leading-normal); }
.findings-panel li small { display:block; color:var(--cp-text-muted); line-height:var(--cp-leading-normal); }
.findings-panel li a { display:inline-block; margin-top:var(--cp-space-2); font-size:var(--cp-text-xs); font-weight:650; }
.findings-empty { margin:0; padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
</style>
