<script setup lang="ts">
import { computed } from 'vue'
import type { ForumInvestigationVM } from './forumInvestigation.ts'
import { metricLabel } from './forumInvestigation.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'

const props = defineProps<{
  investigation: ForumInvestigationVM
  sourceVerified: boolean
  readonly: boolean
}>()

const emit = defineEmits<{
  returnToResult: []
  openResultEvidence: []
}>()

const phaseLabel = computed(() => ({
  baseline: '基线期',
  burst: '事件爆发',
  spread: '讨论扩散',
  decay: '回落沉淀',
  unknown: '阶段未标注',
}[props.investigation.phase] || props.investigation.phase))
</script>

<template>
  <header class="forum-context-header" aria-label="模拟运行上下文">
    <div class="context-identity">
      <p class="context-kicker">SIMULATION RUN / 模拟运行台</p>
      <h1>{{ investigation.scenarioLabel }}</h1>
      <p class="context-line">
        <code>{{ investigation.resultKey }}</code>
        <CpStatusBadge tone="info">{{ investigation.sourceLabel }}</CpStatusBadge>
        <CpStatusBadge :tone="sourceVerified ? 'success' : 'warning'">{{ sourceVerified ? '已验证' : '未验证' }}</CpStatusBadge>
        <CpStatusBadge v-if="readonly" tone="neutral">只读</CpStatusBadge>
        <CpStatusBadge v-if="!investigation.publicationEligible" tone="neutral">审计案例</CpStatusBadge>
      </p>
    </div>
    <div class="context-readout" aria-label="当前时点">
      <dl>
        <div><dt>时间步</dt><dd>Tick {{ investigation.tick }} · {{ phaseLabel }}</dd></div>
        <div><dt>指标</dt><dd>{{ metricLabel(investigation.metric) }}</dd></div>
        <div><dt>组合治理 − 不追加回应（D − Natural）</dt><dd :class="{ neutral: investigation.intervention.delta === null }">
          {{ investigation.intervention.delta === null ? '—' : (investigation.intervention.delta > 0 ? '+' : '') + investigation.intervention.delta }}
        </dd></div>
      </dl>
    </div>
    <div class="context-actions" aria-label="模拟运行操作">
      <button type="button" class="action action--primary" @click="emit('returnToResult')">查看结果分析</button>
      <button type="button" class="action" @click="emit('openResultEvidence')">审计证据</button>
    </div>
  </header>
</template>

<style scoped>
.forum-context-header { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-4); margin-bottom:var(--cp-space-4); }
.context-kicker { margin:0 0 var(--cp-space-1); color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.context-identity h1 { margin:0; font-size:var(--cp-text-2xl); line-height:var(--cp-leading-tight); }
.context-line { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-2); margin:var(--cp-space-2) 0 0; }
.context-line code { padding:var(--cp-space-1) var(--cp-space-2); border:1px solid var(--cp-border-subtle); border-radius:var(--cp-radius-sm); background:var(--cp-surface-subtle); font-size:var(--cp-text-xs); }
.context-readout dl { display:flex; flex-wrap:wrap; gap:var(--cp-space-3); margin:0; }
.context-readout dl > div { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.context-readout dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.context-readout dd { margin:var(--cp-space-1) 0 0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; font-variant-numeric:tabular-nums; }
.context-readout dd.neutral { color:var(--cp-text-secondary); }
.context-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.context-actions .action { display:inline-flex; min-height:var(--cp-control-height); align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.context-actions .action:hover { background:var(--cp-surface-subtle); }
.context-actions .action--primary { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-surface-default); }
.context-actions .action--primary:hover { background:var(--cp-action-primary-hover); }
@media (max-width:767px) {
  .forum-context-header { align-items:flex-start; flex-direction:column; }
}
</style>
