<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import CpStatePanel from '../components/CpStatePanel.vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { currentLocale, translateInterfaceText } from '../i18n/locale.ts'
import { RESULT_DETAIL_CONTEXT } from './resultDetailContext.ts'
import type { KeyMomentVM, MechanismCandidateVM } from './resultsAnalysis.ts'

const context = inject(RESULT_DETAIL_CONTEXT)
const route = useRoute()
if (!context) throw new Error('MechanismsPage requires ResultDetailLayout context')

const analysis = computed(() => context.analysis.value)
const mechanisms = computed(() => analysis.value?.mechanisms || null)
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => isEnglish.value ? en : zh

const metricLabels:Record<string,string> = {
  messages:'public messages', threads:'active threads', claims:'public claims',
  corrections:'correction messages', help_requests:'help requests',
}

function momentLabel(moment:KeyMomentVM):string {
  return isEnglish.value ? translateInterfaceText(moment.label) : moment.label
}

function momentDetail(moment:KeyMomentVM):string {
  if (!isEnglish.value) return moment.detail
  const metric = metricLabels[moment.metric || ''] || 'the selected metric'
  const delta = typeof moment.delta === 'number' ? `${moment.delta > 0 ? '+' : ''}${moment.delta}` : 'an observed change'
  if (moment.id === 'first-divergence') return `At Tick ${moment.tick} (${moment.phase}), ${metric} first diverged between the two branches: ${delta}.`
  if (moment.id === 'largest-difference') return `The largest observed branch difference in ${metric} was ${delta} at Tick ${moment.tick}.`
  if (moment.id === 'final-difference') return `By Tick ${moment.tick}, cumulative ${metric} differed by ${delta} between the two branches.`
  if (moment.id === 'governance-start') return `A governance decision was recorded for the first time at Tick ${moment.tick}: ${moment.detail.replace(/^Tick \d+ 记录到\s*/, '').replace(/。$/, '')}.`
  return translateInterfaceText(moment.detail)
}

function candidateLabel(candidate:MechanismCandidateVM):string {
  return isEnglish.value ? translateInterfaceText(candidate.label) : candidate.label
}

function candidateDetail(candidate:MechanismCandidateVM):string {
  if (!isEnglish.value) return candidate.detail
  const summary = mechanisms.value?.claimSummary
  const governance = analysis.value?.result.summary.governance
  if (candidate.id === 'claim-divergence-candidate' && summary) return `${summary.total} public claims were observed; ${summary.contested} were questioned and ${summary.corrected} had a correction record.`
  if (candidate.id === 'uptake-pattern-candidate' && governance) return `Of ${governance.publishedMessages} governance messages, ${governance.uptake.completeChains ?? 0} formed a complete uptake chain and ${governance.noResponseMessages} had no recorded resident response.`
  if (candidate.id === 'noop-pattern-candidate' && governance) return `${governance.noopDecisions} governance decision points recorded no outward action.`
  return translateInterfaceText(candidate.detail)
}

function candidateEvidence(candidate:MechanismCandidateVM):string {
  if (!isEnglish.value) return candidate.evidence.join('、')
  if (candidate.id === 'claim-divergence-candidate') return 'Claim status and correction records from the published forum asset'
  if (candidate.id === 'uptake-pattern-candidate') return 'Governance uptake chains'
  if (candidate.id === 'noop-pattern-candidate') return 'Governance decision trace'
  return candidate.evidence.join(', ')
}

function candidateBoundary(candidate:MechanismCandidateVM):string {
  if (!isEnglish.value) return candidate.boundary
  if (candidate.id === 'claim-divergence-candidate') return 'This is an observed pattern. A claim can be questioned and corrected at the same time; neither status proves whether it is true or false.'
  if (candidate.id === 'uptake-pattern-candidate') return 'Uptake chains describe responses inside the simulation only. No response and disputed responses remain first-class outcomes.'
  if (candidate.id === 'noop-pattern-candidate') return 'No outward action is a first-class result and is not presented as either success or failure.'
  return translateInterfaceText(candidate.boundary)
}

function evidenceHref(tick?: number) {
  const query: Record<string, string> = { source: analysis.value!.result.source.key }
  if (typeof route.query.tick === 'string') query.tick = route.query.tick
  if (typeof tick === 'number') query.tick = String(tick)
  return {
    name: 'campus-pulse-result-evidence',
    params: { resultKey: analysis.value!.result.key },
    query,
  }
}

function claimEvidenceLabel() {
  return `${l('已验证的证据清单','Verified evidence manifest')}${typeof route.query.tick === 'string' ? ` · Tick ${route.query.tick}` : ''}`
}
</script>

<template>
  <div v-if="analysis && mechanisms" class="mechanisms-page">
    <section class="mechanisms-intro" aria-labelledby="mechanisms-title">
      <header>
        <h2 id="mechanisms-title">候选机制与观察模式</h2>
        <p>候选解释，不证明因果。</p>
      </header>
    </section>

    <section class="moment-table" aria-labelledby="divergence-title">
      <header><h2 id="divergence-title">分叉事件表</h2></header>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Tick</th><th scope="col">阶段</th><th scope="col">类型</th><th scope="col">观察 / 派生</th><th scope="col">证据</th></tr></thead>
          <tbody>
            <tr v-for="moment in mechanisms.divergenceEvents" :key="moment.id">
              <th scope="row">Tick {{ moment.tick }}</th>
              <td>{{ moment.phase }}</td>
              <td>{{ moment.kind === 'governance' ? '治理时点' : moment.kind === 'derived' ? '派生' : '观察' }}</td>
              <td><strong>{{ momentLabel(moment) }}</strong><p>{{ momentDetail(moment) }}</p></td>
              <td><RouterLink :to="evidenceHref(moment.tick)">查看证据</RouterLink></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!mechanisms.divergenceEvents.length" class="panel-empty">没有可机械推导的分叉事件。</p>
      </div>
    </section>

    <CpStatePanel
      v-if="mechanisms.status === 'unavailable' || mechanisms.status === 'error'"
      :variant="mechanisms.status === 'error' ? 'error' : 'empty'"
      :title="mechanisms.status === 'error' ? 'Claim 资产加载失败' : 'Mechanisms 不可用'"
      :detail="mechanisms.reason || '当前结果未提供公开 Claim 资产。'"
      :primary-label="mechanisms.status === 'error' ? '重试' : ''"
      @primary="context.reload"
    />

    <section v-else class="claim-summary" aria-labelledby="claim-title">
      <header><h2 id="claim-title">Claim 摘要</h2></header>
      <dl v-if="mechanisms.claimSummary">
        <div><dt>公开 Claim</dt><dd>{{ mechanisms.claimSummary.total }}</dd></div>
        <div><dt>被质疑</dt><dd>{{ mechanisms.claimSummary.contested }}</dd></div>
        <div><dt>带纠正记录</dt><dd>{{ mechanisms.claimSummary.corrected }}</dd></div>
        <div><dt>已验证</dt><dd>{{ mechanisms.claimSummary.verified }}</dd></div>
        <div><dt>纠正消息</dt><dd>{{ mechanisms.claimSummary.corrections }}</dd></div>
        <div><dt>求助请求</dt><dd>{{ mechanisms.claimSummary.helpRequests }}</dd></div>
      </dl>
      <p v-else class="panel-empty">{{ mechanisms.reason || '本结果未发布 Claim 资产。' }}</p>
    </section>

    <section v-if="mechanisms.candidates.length" class="candidates" aria-labelledby="candidates-title">
      <header><h2 id="candidates-title">候选模式</h2></header>
      <ul>
        <li v-for="candidate in mechanisms.candidates" :key="candidate.id" class="candidate-row">
          <div class="candidate-row__body">
            <strong>{{ candidateLabel(candidate) }}</strong>
            <p>{{ candidateDetail(candidate) }}</p>
            <p class="candidate-row__evidence"><i class="fa-solid fa-circle-check" aria-hidden="true" /> {{ l('支撑材料：','Evidence: ') }}{{ candidateEvidence(candidate) }}</p>
            <p class="candidate-row__boundary">{{ l('边界：','Boundary: ') }}{{ candidateBoundary(candidate) }}</p>
          </div>
          <CpStatusBadge tone="warning">候选</CpStatusBadge>
        </li>
      </ul>
      <p class="claim-evidence-note">
        <RouterLink :to="evidenceHref()"><i class="fa-solid fa-circle-check" aria-hidden="true" />{{ claimEvidenceLabel() }}</RouterLink>
      </p>
    </section>

    <section v-else-if="mechanisms.status === 'empty'" class="panel-empty-section" role="status">
      <p>当前结果未发布 Claim 资产。</p>
    </section>
  </div>
</template>

<style scoped>
.mechanisms-page { display:grid; gap:var(--cp-space-4); }
.mechanisms-intro, .moment-table, .claim-summary, .candidates { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.mechanisms-intro > header { padding:var(--cp-space-3) var(--cp-space-4); }
.mechanisms-intro h2, .moment-table h2, .claim-summary h2, .candidates h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-lg); }
.mechanisms-intro p, .moment-table header p, .claim-summary header p, .candidates header p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.moment-table > header, .claim-summary > header, .candidates > header { padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.table-wrap { max-height:26rem; overflow:auto; }
.moment-table table { width:100%; border-collapse:collapse; font-size:var(--cp-text-sm); font-variant-numeric:tabular-nums; }
.moment-table th, .moment-table td { padding:var(--cp-space-2) var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); text-align:left; vertical-align:top; }
.moment-table td strong { display:block; }
.moment-table td p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.5; }
.moment-table a { color:var(--brand-red); font-weight:700; text-decoration:none; white-space:nowrap; }
.claim-summary dl { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); margin:0; }
.claim-summary dl div { padding:var(--cp-space-3) var(--cp-space-4); border-right:1px solid var(--cp-border-subtle); border-bottom:1px solid var(--cp-border-subtle); }
.claim-summary dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.claim-summary dd { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); font-weight:750; font-variant-numeric:tabular-nums; }
.panel-empty, .panel-empty-section p { margin:0; padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.panel-empty-section { border:1px dashed var(--cp-border-strong); background:var(--cp-surface-subtle); }
.candidates ul { margin:0; padding:0; list-style:none; }
.candidate-row { display:flex; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-top:1px solid var(--cp-border-subtle); }
.candidate-row__body { min-width:0; }
.candidate-row__body strong { display:block; font-size:var(--cp-text-sm); }
.candidate-row__body p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.5; }
.candidate-row__evidence { color:var(--cp-evidence-text) !important; font-size:var(--cp-text-xs) !important; }
.candidate-row__evidence i { color:var(--cp-evidence); }
.candidate-row__boundary { color:var(--cp-text-muted) !important; font-size:var(--cp-text-xs) !important; }
.claim-evidence-note { margin:0; padding:var(--cp-space-3) var(--cp-space-4); border-top:1px solid var(--cp-border-subtle); }
.claim-evidence-note a { color:var(--cp-evidence-text); font-size:var(--cp-text-xs); font-weight:700; text-decoration:none; }
.claim-evidence-note i { color:var(--cp-evidence); margin-right:var(--cp-space-1); }
@media (max-width:1023px) { .claim-summary dl { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width:479px) { .claim-summary dl { grid-template-columns:repeat(2,minmax(0,1fr)); } .candidate-row { flex-direction:column; } }
</style>
