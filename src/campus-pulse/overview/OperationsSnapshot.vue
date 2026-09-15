<script setup lang="ts">
import { computed } from 'vue'
import type { OverviewOperationsVM } from './overviewQuery.ts'
import CpStatePanel from '../components/CpStatePanel.vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'

const props = defineProps<{ operations: OverviewOperationsVM }>()
defineEmits<{ retry: [] }>()
const fields = [
  ['projects', '项目'], ['runs', '运行'], ['reports', '报告'], ['evidence_snapshots', '证据快照'],
] as const
const readinessLabel = computed(() => props.operations.readiness?.status === 'ready' ? '服务门禁就绪' : props.operations.readiness ? '服务门禁未就绪' : '服务状态未知')
</script>

<template>
  <section class="operations-panel" aria-labelledby="operations-heading">
    <header><h2 id="operations-heading">运行与项目状态</h2><CpStatusBadge :tone="operations.readiness?.status === 'ready' ? 'success' : 'warning'" :icon="operations.readiness?.status === 'ready' ? 'fa-circle-check' : 'fa-triangle-exclamation'">{{ readinessLabel }}</CpStatusBadge></header>
    <div v-if="operations.counts" class="operation-counts">
      <dl v-for="([key, label]) in fields" :key="key"><dt>{{ label }}</dt><dd>{{ operations.counts[key] ?? 0 }}</dd></dl>
    </div>
    <p v-if="operations.evidenceBoundary" class="operations-boundary"><i class="fa-solid fa-shield-halved" aria-hidden="true" />{{ operations.evidenceBoundary }}</p>
    <CpStatePanel v-if="operations.problems.length" class="operations-problem" variant="partial" title="运行状态仅部分可用" :detail="`${operations.problems.length} 个辅助请求失败；已验证结果仍可继续审阅。`" primary-label="重试运行状态" @primary="$emit('retry')" />
    <p v-if="operations.projects.length" class="project-summary">{{ operations.projects.length }} 个项目可在工作台继续处理。</p>
    <p v-else-if="!operations.problems.length" class="project-summary">暂无项目，可前往工作台创建。</p>
  </section>
</template>

<style scoped>
.operations-panel { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.operations-panel > header { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.operations-panel h2 { margin:0; font-size:var(--cp-text-lg); }
.operation-counts { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border-bottom:1px solid var(--cp-border-subtle); }
.operation-counts dl { margin:0; padding:var(--cp-space-3) var(--cp-space-4); border-right:1px solid var(--cp-border-subtle); }
.operation-counts dl:last-child { border-right:0; }
.operation-counts dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.operation-counts dd { margin:var(--cp-space-1) 0 0; font:650 var(--cp-text-xl)/1.2 var(--cp-font-sans); font-variant-numeric:tabular-nums; }
.operations-boundary,.project-summary { margin:0; padding:var(--cp-space-3) var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.operations-boundary { display:flex; gap:var(--cp-space-2); border-bottom:1px solid var(--cp-border-subtle); color:var(--cp-evidence-text); }
.operations-problem { max-width:none; margin:var(--cp-space-3); }
@media (max-width:599px) { .operations-panel > header { align-items:flex-start; flex-direction:column; } .operation-counts { grid-template-columns:1fr 1fr; } .operation-counts dl:nth-child(2) { border-right:0; } .operation-counts dl:nth-child(-n+2) { border-bottom:1px solid var(--cp-border-subtle); } }
</style>
