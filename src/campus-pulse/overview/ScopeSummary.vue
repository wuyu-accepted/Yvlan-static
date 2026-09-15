<script setup lang="ts">
import { computed } from 'vue'
import type { ResultMetricKey } from '../source/forumTwinAdapter.ts'
import { metricValue, type SituationOverviewVM } from './situationOverview.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { isEnglish } from '../i18n/locale.ts'
import { branchDisplayName } from '../results/branchPresentation.ts'

const props = defineProps<{ overview: SituationOverviewVM; metric: ResultMetricKey; tick: number | null }>()
const selected = computed(() => props.overview.timeline.find((point) => point.tick === props.tick) || props.overview.timeline.at(-1) || null)
const metricDefinition = computed(() => props.overview.metrics.find((item) => item.key === props.metric)!)
const natural = computed(() => selected.value ? metricValue(selected.value, 'natural', props.metric) : null)
const explanation = computed(() => selected.value ? metricValue(selected.value, 'explanation', props.metric) : null)
const intervention = computed(() => selected.value ? metricValue(selected.value, 'intervention', props.metric) : null)
const delta = computed(() => natural.value === null || intervention.value === null ? null : intervention.value - natural.value)
const branchName=(id:'Natural'|'A'|'D')=>branchDisplayName(props.overview.result.key,id,isEnglish.value,true)
</script>

<template>
  <section class="scope-summary" aria-labelledby="situation-heading">
    <div class="scope-summary__copy">
      <div class="scope-summary__label">
        <CpStatusBadge :tone="overview.result.source.mode === 'offline_hero' ? 'warning' : 'info'" icon="fa-database">
          {{ overview.result.source.label }}
        </CpStatusBadge>
        <CpStatusBadge v-if="overview.result.source.verification === 'verified'" tone="evidence" icon="fa-shield-halved">已验证</CpStatusBadge>
      </div>
      <h2 id="situation-heading">{{ overview.title }}</h2>
      <dl>
        <div><dt>观察窗口</dt><dd>{{ overview.observationWindow }}</dd></div>
        <div><dt>比较范围</dt><dd>{{ overview.scopeLabel }}</dd></div>
        <div><dt>运行</dt><dd :title="overview.result.runId">{{ overview.result.runId || '未声明' }}</dd></div>
      </dl>
    </div>
    <div class="metric-pair" aria-live="polite">
      <span>{{ selected ? `Tick ${selected.tick} · ${metricDefinition.label}` : metricDefinition.label }}</span>
      <div><strong>{{ branchName('Natural') }}</strong><b>{{ natural ?? '未发布' }}</b><small>{{ natural === null ? '' : metricDefinition.unit }}</small></div>
      <div><strong>{{ branchName('A') }}</strong><b>{{ explanation ?? '未发布' }}</b><small>{{ explanation === null ? '' : metricDefinition.unit }}</small></div>
      <div><strong>{{ branchName('D') }}</strong><b>{{ intervention ?? '未发布' }}</b><small>{{ intervention === null ? '' : metricDefinition.unit }}</small></div>
      <p>{{ isEnglish?'Combined response minus no added response':'组合治理减去不追加回应' }}（D − Natural）：<strong>{{ delta === null ? '不可计算' : `${delta > 0 ? '+' : ''}${delta} ${metricDefinition.unit}` }}</strong></p>
    </div>
  </section>
</template>

<style scoped>
.scope-summary { display:grid; grid-template-columns:minmax(0,1fr) minmax(17rem,.42fr); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.scope-summary__copy { min-width:0; padding:var(--cp-space-4); }
.scope-summary__label { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.scope-summary h2 { margin:var(--cp-space-3) 0 var(--cp-space-1); font-size:var(--cp-text-xl); line-height:var(--cp-leading-tight); }
.scope-summary dl { display:flex; flex-wrap:wrap; gap:var(--cp-space-3) var(--cp-space-6); margin:var(--cp-space-4) 0 0; }
.scope-summary dl div { min-width:8rem; }
.scope-summary dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.scope-summary dd { max-width:22rem; overflow:hidden; margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-sm); font-weight:650; text-overflow:ellipsis; white-space:nowrap; }
.metric-pair { display:grid; grid-template-columns:repeat(3,1fr); align-content:center; border-left:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.metric-pair > span,.metric-pair > p { grid-column:1/-1; margin:0; padding:var(--cp-space-2) var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.metric-pair > div { padding:var(--cp-space-3); border-block:1px solid var(--cp-border-default); }
.metric-pair > div + div { border-left:1px solid var(--cp-border-default); }
.metric-pair strong,.metric-pair b,.metric-pair small { display:block; }
.metric-pair strong { font-size:var(--cp-text-xs); }
.metric-pair b { margin-top:var(--cp-space-1); font:650 var(--cp-text-2xl)/1.2 var(--cp-font-sans); font-variant-numeric:tabular-nums; }
.metric-pair small { color:var(--cp-text-muted); }
@media (max-width:767px) { .scope-summary { grid-template-columns:1fr; } .metric-pair { border-top:1px solid var(--cp-border-default); border-left:0; } }
</style>
