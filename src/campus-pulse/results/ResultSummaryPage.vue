<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import OverviewTimeline from '../overview/OverviewTimeline.vue'
import ResourcePolicyStoryPanel from './ResourcePolicyStoryPanel.vue'
import FormalV5EvidencePanel from './FormalV5EvidencePanel.vue'
import ForumTwinV2DecisionPanel from './ForumTwinV2DecisionPanel.vue'
import { RESULT_DETAIL_CONTEXT } from './resultDetailContext.ts'
import type { FactKind } from './resultsAnalysis.ts'
import type { ResultMetricKey } from '../source/forumTwinAdapter.ts'
import { RESULT_DELTA_DEFINITION } from './resultsAnalysis.ts'
import { isEnglish } from '../i18n/locale.ts'
import { branchDisplayName } from './branchPresentation.ts'

const context = inject(RESULT_DETAIL_CONTEXT)
const route = useRoute()
const router = useRouter()
if (!context) throw new Error('ResultSummaryPage requires ResultDetailLayout context')

const analysis = computed(() => context.analysis.value)
const result = computed(() => context.result.value)
const metric = computed<ResultMetricKey>(() => {
  const requested = typeof route.query.metric === 'string' ? route.query.metric : ''
  return analysis.value?.metricComparison.some((item) => item.metric === requested)
    ? requested as ResultMetricKey
    : analysis.value?.primaryObservation?.metric || 'messages'
})
const tick = computed(() => {
  const requested = typeof route.query.tick === 'string' ? Number(route.query.tick) : Number.NaN
  const ids = result.value?.scope.tickIds || []
  return ids.includes(requested) ? requested : null
})
const hasExplanation = computed(() => (result.value?.summary.timeline || []).some((point) => point.explanation !== null))
const branchName=(id:'Natural'|'A'|'D',short=false)=>branchDisplayName(result.value?.key||'',id,isEnglish.value,short)
const comparisonScope = computed(() => isEnglish.value
  ? `${hasExplanation.value ? `${branchName('Natural')}, ${branchName('A')}, and ${branchName('D')}` : `${branchName('Natural')} and ${branchName('D')}`} use the same population, history, and event conditions.`
  : `${hasExplanation.value ? `${branchName('Natural')}、${branchName('A')}与${branchName('D')}` : `${branchName('Natural')}与${branchName('D')}`}使用相同人口、历史和事件条件。`)
const metricLabels: Record<ResultMetricKey, string> = {
  messages: 'Public messages', threads: 'Active threads', claims: 'Public Claims',
  corrections: 'Corrections', help_requests: 'Help requests',
}
const metricRowLabel = (row: { metric: ResultMetricKey; label: string; unit: string }) => isEnglish.value
  ? `${metricLabels[row.metric]} (${row.unit === '条' ? 'items' : 'count'})`
  : `${row.label}（${row.unit}）`
function analysisText(value: string): string {
  if (!isEnglish.value) return value
  const exact: Record<string, string> = {
    '全结果统一使用“治理 D 减去 Natural”；正负只描述模型条件差异，不表示好坏。': 'All results use Active governance D minus Natural; the sign only describes a model-conditioned difference, not whether it is good or bad.',
    '首次出现数值差异': 'First numerical divergence', '最大已观察差异': 'Largest observed difference',
    '末端累计差异': 'Final cumulative difference', '治理主体首次形成决策': 'First governance decision',
    '机械比较同尺度已发布数值；未执行统计显著性检验。': 'Mechanical comparison of published values on the same scale; no statistical significance test was performed.',
    '由已发布序列推导，不表示因果转折。': 'Derived from the published series; this does not imply a causal turning point.',
    '治理消息承接记录可核查': 'Governance-message uptake is auditable',
    '只报告公开结果中的承接链；无响应是一等结果，不推断现实政策效果。': 'Only uptake chains in the public result are reported; no response is a first-class outcome, and no real-world policy effect is inferred.',
    '审计案例注解（仅限当前离线结果）': 'Audit-case annotation (current offline result only)',
    '真实 LLM 平行运行中，主动治理分支形成 4 条居民直接承接链；公开消息由 167 增至 173，Claim 由 22 收敛至 4，模型 trust 由 0.392 升至 0.424、concern 由 0.256 降至 0.229。': 'In the live-LLM parallel run, Active governance formed four direct resident uptake chains; public messages rose from 167 to 173, Claims converged from 22 to 4, model trust rose from 0.392 to 0.424, and concern fell from 0.256 to 0.229.',
    '结果范围': 'Result scope',
    '范围来自结果 manifest；不扩展到全校民意或总体政策效果。': 'Scope comes from the result manifest; it does not extend to campus-wide opinion or overall policy impact.',
  }
  if (exact[value]) return exact[value]
  return value
    .replace(/^Tick (\d+)（([^）]+)）的(.+)开始出现分支差异：([+\-]?\d+) (.+)。$/, 'At Tick $1 ($2), $3 first diverges across branches: $4 $5.')
    .replace(/^Tick (\d+) 的(.+)差值为 ([+\-]?\d+) (.+)（Natural (\d+) \/ D (\d+)）。$/, 'At Tick $1, the $2 difference is $3 $4 (Natural $5 / D $6).')
    .replace(/^截至 Tick (\d+)，公开消息累计差值为 ([+\-]?\d+) 条（Natural (\d+) \/ D (\d+)）。$/, 'By Tick $1, the cumulative public-message difference is $2 (Natural $3 / D $4).')
    .replace(/^Tick (\d+) 记录到 (.+)。$/, 'Tick $1 records $2.')
    .replace(/^最大已观察分支差异位于 Tick (\d+)$/, 'Largest observed branch difference at Tick $1')
    .replace(/^差异自 Tick (\d+) 起可观察$/, 'Divergence is observable from Tick $1')
    .replace(/^(.+)：Natural (\d+) (.+)，治理 D (\d+) (.+)，Δ = D − Natural = ([+\-]?\d+) (.+)。$/, '$1: Natural $2 $3, Active governance D $4 $5, Δ = D − Natural = $6 $7.')
    .replace(/^(.+)在该时点首次出现非零差值（([+\-]?\d+) (.+)）。$/, '$1 first shows a non-zero difference at this Tick ($2 $3).')
    .replace(/^(\d+) 条治理消息具有承接链，其中 (\d+) 条完整承接、(\d+) 条未记录居民响应。$/, '$1 governance messages have uptake chains: $2 complete and $3 with no recorded resident response.')
    .replace(/^注解仅绑定 source=(.+)、result=(.+) 与对应结果哈希；不会出现在其他运行结果。$/, 'The annotation is bound only to source=$1, result=$2, and the corresponding result hash; it will not appear in other run results.')
    .replace(/^(\d+) 个种子 · (\d+) 个合成 LLM Agent · (Tick .+)。$/, '$1 seed(s) · $2 synthetic LLM Agents · $3.')
    .replaceAll('公开消息', 'public messages').replaceAll('活跃讨论串', 'active threads').replaceAll('公开 Claim', 'public Claims')
    .replaceAll(' 条', ' items').replaceAll(' 个', '')
}

const factKindMeta: Record<FactKind, { label: string; tone: 'neutral' | 'info' | 'evidence' | 'warning' }> = {
  fact: { label: '直接事实', tone: 'neutral' },
  derived_fact: { label: '派生事实', tone: 'info' },
  evidence_backed_interpretation: { label: '证据支持的解读', tone: 'evidence' },
  candidate_mechanism: { label: '候选机制', tone: 'warning' },
}

function setMetric(next: ResultMetricKey) {
  router.replace({ query: { ...route.query, metric: next } })
}

function setTick(next: number) {
  router.replace({ query: { ...route.query, tick: String(next) } })
}

function inspectTick(next: number) {
  router.push({
    name: 'campus-pulse-result-evidence',
    params: { resultKey: result.value!.key },
    query: { source: result.value!.source.key, tick: String(next) },
  })
}

function forumHref() {
  const query: Record<string, string> = { source: result.value!.source.key, result: result.value!.key }
  if (result.value!.source.key === 'live-api' && result.value!.runId) query.run_id = result.value!.runId
  if (metric.value) query.metric = metric.value
  const anchorTick = tick.value ?? analysis.value?.primaryObservation?.tick ?? null
  if (anchorTick !== null) query.tick = String(anchorTick)
  return { name: 'campus-pulse-forum', query }
}

function evidenceHref() {
  return {
    name: 'campus-pulse-result-evidence',
    params: { resultKey: result.value!.key },
    query: { source: result.value!.source.key, ...(tick.value !== null ? { tick: String(tick.value) } : {}) },
  }
}
</script>

<template>
  <div v-if="analysis && result" class="result-summary-page">
    <FormalV5EvidencePanel v-if="result.resourcePolicy" />
    <ResourcePolicyStoryPanel v-if="result.resourcePolicy" :story="result.resourcePolicy" />
    <ForumTwinV2DecisionPanel v-if="result.forumTwinV2" :result="result.forumTwinV2" />
    <section v-if="!result.resourcePolicy && !result.forumTwinV2" class="summary-grid" aria-labelledby="summary-observation-title">
      <div class="summary-card summary-card--primary">
        <header>
          <h2 id="summary-observation-title">核心观察</h2>
        </header>
        <template v-if="analysis.primaryObservation">
          <p class="primary-label">{{ analysis.primaryObservation.label }}</p>
          <div class="metric-pair">
            <div><span>{{ branchName('Natural',true) }}</span><strong>{{ analysis.primaryObservation.natural }}</strong></div>
            <div><span>{{ branchName('D',true) }}</span><strong>{{ analysis.primaryObservation.intervention }}</strong></div>
            <div class="metric-pair__delta"><span>{{ isEnglish?'Difference':'差值' }}（D − Natural）</span><strong>{{ analysis.primaryObservation.delta > 0 ? '+' : '' }}{{ analysis.primaryObservation.delta }}</strong></div>
          </div>
          <p class="key-moment" data-no-localize>Tick {{ analysis.primaryObservation.tick }} · {{ analysisText(analysis.deltaDefinition.note) }}</p>
        </template>
        <p v-else class="empty-note">当前结果未发布可比较的指标序列。</p>
      </div>

      <div class="summary-card">
        <header><h2>结果范围</h2></header>
        <dl>
          <div><dt>场景</dt><dd>{{ result.scope.scenarioLabel }}</dd></div>
          <div><dt>共享条件</dt><dd data-no-localize>{{ isEnglish ? 'Shared population · shared initial state · shared event conditions' : result.scope.sharedConditions.join(' · ') }}</dd></div>
          <div><dt>种子</dt><dd>{{ result.scope.seedCount }}</dd></div>
          <div><dt>合成 Agent</dt><dd>{{ result.scope.population }}</dd></div>
          <div v-if="result.slotCompleteness">
            <dt>{{ isEnglish ? 'LLM slot completion' : 'LLM 槽位完成度' }}</dt>
            <dd data-no-localize>
              {{ result.slotCompleteness.completed.toLocaleString() }} / {{ result.slotCompleteness.required.toLocaleString() }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="summary-card summary-card--moments">
        <header><h2>关键时点</h2></header>
        <ol v-if="analysis.keyMoments.length" class="key-moments">
          <li v-for="moment in analysis.keyMoments" :key="moment.id">
            <strong data-no-localize>Tick {{ moment.tick }} · {{ analysisText(moment.label) }}</strong>
            <p data-no-localize>{{ analysisText(moment.detail) }}</p>
          </li>
        </ol>
        <p v-else class="empty-note">没有可机械推导的关键时点。</p>
      </div>
    </section>

    <section v-if="!result.resourcePolicy && !result.forumTwinV2" class="findings" aria-labelledby="findings-title">
      <header><h2 id="findings-title">观察与事实边界</h2></header>
      <ul>
        <li v-for="finding in analysis.findings" :key="finding.id" class="finding-row">
          <CpStatusBadge :tone="factKindMeta[finding.kind].tone">{{ factKindMeta[finding.kind].label }}</CpStatusBadge>
          <div class="finding-row__body">
            <strong data-no-localize>{{ analysisText(finding.title) }}</strong>
            <p data-no-localize>{{ analysisText(finding.detail) }}</p>
            <p class="finding-row__boundary" data-no-localize>{{ analysisText(finding.boundary) }}</p>
            <RouterLink v-if="finding.evidenceRef" :to="finding.evidenceRef.route" class="evidence-link">
              <i class="fa-solid fa-circle-check" aria-hidden="true" />{{ finding.evidenceRef.label }}
            </RouterLink>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="!result.forumTwinV2" class="comparison" aria-labelledby="comparison-title">
      <header><h2 id="comparison-title">平行世界的末端比较</h2><p data-no-localize>{{ comparisonScope }}</p></header>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">指标</th><th scope="col">{{ branchName('Natural',true) }}</th><th v-if="hasExplanation" scope="col">{{ branchName('A',true) }}</th><th scope="col">{{ branchName('D',true) }}</th><th scope="col">{{ isEnglish?'Difference':'差值' }}（D − Natural）</th><th scope="col">可比性</th></tr></thead>
          <tbody>
            <tr v-for="row in analysis.metricComparison" :key="row.metric">
              <th scope="row" data-no-localize>{{ metricRowLabel(row) }}</th>
              <td>{{ row.natural ?? '未发布' }}</td>
              <td v-if="hasExplanation">{{ row.explanation ?? '未发布' }}</td>
              <td>{{ row.intervention ?? '未发布' }}</td>
              <td>{{ row.comparable ? `${row.delta! > 0 ? '+' : ''}${row.delta}` : '不可计算' }}</td>
              <td>{{ row.comparable ? '同尺度可比' : 'Not directly comparable' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="!result.forumTwinV2" class="timeline-section" aria-labelledby="timeline-title">
      <header>
        <h2 id="timeline-title">分叉趋势</h2>
        <nav class="timeline-actions" aria-label="趋势时点操作">
          <RouterLink :to="evidenceHref()">查看该时点证据</RouterLink>
          <RouterLink :to="forumHref()">调查论坛</RouterLink>
        </nav>
      </header>
      <OverviewTimeline
        :timeline="result.summary.timeline"
        :metric="metric"
        :tick="tick"
        :result-key="result.key"
        @select-metric="setMetric"
        @select-tick="setTick"
        @inspect="inspectTick"
      />
    </section>
  </div>
</template>

<style scoped>
.result-summary-page { display:grid; width:100%; min-width:0; max-width:100%; gap:var(--cp-space-4); }
.result-summary-page > * { min-width:0; }
.summary-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--cp-space-4); align-items:start; }
.summary-card { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); padding:var(--cp-space-4); min-width:0; }
.summary-card header span, .findings header span { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.summary-card h2, .findings h2, .comparison h2, .timeline-section h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-lg); }
.summary-card--primary { border-top:3px solid var(--cp-action-primary); }
.primary-label { margin:var(--cp-space-3) 0 var(--cp-space-2); color:var(--cp-text-secondary); font-weight:700; }
.metric-pair { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--cp-space-2); }
.metric-pair div { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.metric-pair span { display:block; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.metric-pair strong { display:block; margin-top:var(--cp-space-1); font-size:var(--cp-text-2xl); font-variant-numeric:tabular-nums; }
.metric-pair .metric-pair__delta strong { color:var(--cp-action-primary); }
.key-moment { margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.5; }
.summary-card dl { display:grid; gap:var(--cp-space-2); margin:var(--cp-space-3) 0 0; }
.summary-card dl div { display:flex; justify-content:space-between; gap:var(--cp-space-2); border-bottom:1px solid var(--cp-border-subtle); padding-bottom:var(--cp-space-2); }
.summary-card dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.summary-card dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-xs); font-weight:650; text-align:right; }
.key-moments { margin:var(--cp-space-3) 0 0; padding-left:var(--cp-space-5); }
.key-moments li { margin-bottom:var(--cp-space-2); }
.key-moments strong { font-size:var(--cp-text-sm); }
.key-moments p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.5; }
.empty-note { margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.findings, .comparison, .timeline-section { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.findings > header, .comparison > header, .timeline-section > header { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.findings > header p, .comparison > header p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.findings ul { margin:0; padding:0; list-style:none; }
.finding-row { display:flex; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-top:1px solid var(--cp-border-subtle); }
.finding-row__body { min-width:0; }
.finding-row__body strong { display:block; font-size:var(--cp-text-sm); }
.finding-row__body p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.5; }
.finding-row__boundary { color:var(--cp-text-muted) !important; font-size:var(--cp-text-xs) !important; }
.evidence-link { display:inline-flex; align-items:center; gap:var(--cp-space-1); margin-top:var(--cp-space-2); color:var(--cp-evidence-text); font-size:var(--cp-text-xs); font-weight:700; text-decoration:none; }
.evidence-link i { color:var(--cp-evidence); }
.table-wrap { max-height:24rem; overflow:auto; }
.comparison table { width:100%; border-collapse:collapse; font-size:var(--cp-text-sm); font-variant-numeric:tabular-nums; }
.comparison th, .comparison td { padding:var(--cp-space-2) var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); text-align:right; white-space:nowrap; }
.comparison th:first-child { text-align:left; }
.timeline-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.timeline-actions a { padding:var(--cp-space-1) var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); color:var(--cp-text-primary); font-size:var(--cp-text-xs); font-weight:700; text-decoration:none; }
.timeline-actions a:hover { background:var(--cp-surface-subtle); }
.trend-note { margin:0; padding:var(--cp-space-2) var(--cp-space-4); border-top:1px solid var(--cp-border-subtle); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
@media (max-width:1199px) { .summary-grid { grid-template-columns:1fr; } }
@media (max-width:767px) { .findings > header, .comparison > header, .timeline-section > header { align-items:flex-start; flex-direction:column; } .metric-pair { grid-template-columns:1fr; } }
</style>
    '本注解说明当前运行的结果。': 'This annotation describes the current run.',
  if (value.startsWith('注解仅绑定 source=')) return isEnglish.value ? 'This annotation describes the current run.' : '本注解说明当前运行的结果。'
