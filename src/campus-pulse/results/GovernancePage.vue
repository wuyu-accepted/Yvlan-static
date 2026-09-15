<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { currentLocale } from '../i18n/locale.ts'
import { RESULT_DETAIL_CONTEXT } from './resultDetailContext.ts'
import type { GovernanceActionVM } from './resultsAnalysis.ts'

const context = inject(RESULT_DETAIL_CONTEXT)
const route = useRoute()
if (!context) throw new Error('GovernancePage requires ResultDetailLayout context')

const governance = computed(() => context.analysis.value?.governance || null)
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => isEnglish.value ? en : zh

function actionTitle(action:GovernanceActionVM):string {
  if (!isEnglish.value) return action.label
  if (action.kind === 'decision') return `Governance decision at Tick ${action.tick}`
  if (action.kind === 'noop') return 'Governance decision with no outward action'
  return 'Unanswered governance message'
}

function actionDetail(action:GovernanceActionVM):string {
  if (!isEnglish.value) return action.detail
  if (action.kind === 'decision') return action.detail
  if (action.kind === 'noop') return `${governance.value?.noopActions.length ?? 0} decision point(s) recorded no outward action.`
  return `Of ${governance.value?.publishedMessages ?? 0} governance messages, ${governance.value?.noResponseActions.length ?? 0} had no recorded resident response.`
}

const governanceNote = computed(() => isEnglish.value
  ? 'The Natural branch does not invoke a governance actor. In the governance branch, no action, no response, challenge, and failure are all shown as first-class outcomes.'
  : governance.value?.naturalGovernanceNote || '')

function evidenceHref(tick?: number | null) {
  const query: Record<string, string> = { source: context!.analysis.value!.result.source.key }
  if (typeof route.query.tick === 'string') query.tick = route.query.tick
  if (typeof tick === 'number') query.tick = String(tick)
  return {
    name: 'campus-pulse-result-evidence',
    params: { resultKey: context!.analysis.value!.result.key },
    query,
  }
}

const actionTone = { decision: 'info', noop: 'warning', no_response: 'danger' } as const
const actionLabel = { decision: '决策', noop: 'noop', no_response: '无响应' } as const
</script>

<template>
  <div v-if="governance" class="governance-page">
    <section class="governance-summary" aria-labelledby="governance-title">
      <header>
        <h2 id="governance-title">治理过程概览</h2>
        <p>动作、时点、目标与观察响应；不表示因果。</p>
      </header>
      <dl>
        <div><dt>治理消息</dt><dd>{{ governance.publishedMessages }}</dd></div>
        <div><dt>完整承接链</dt><dd>{{ governance.uptake.completeChains }} / {{ governance.uptake.totalChains }}</dd></div>
        <div><dt>noop 决策</dt><dd>{{ governance.noopActions.length }}</dd></div>
        <div><dt>未获回应消息</dt><dd>{{ governance.noResponseActions.length }}</dd></div>
      </dl>
    </section>

    <section class="governance-uptake" aria-labelledby="actions-title">
      <header><h2 id="actions-title">治理动作与响应</h2><p>无响应、质疑、失败与 noop 都是一等结果。</p></header>
      <table>
        <thead><tr><th scope="col">类型</th><th scope="col">时点</th><th scope="col">动作 / 观察</th><th scope="col">证据</th></tr></thead>
        <tbody>
          <tr v-for="action in governance.decisionActions" :key="action.id">
            <td><CpStatusBadge :tone="actionTone.decision">{{ actionLabel.decision }}</CpStatusBadge></td>
            <td>Tick {{ action.tick }}</td>
            <td><strong>{{ actionTitle(action) }}</strong><p>{{ actionDetail(action) }}</p></td>
            <td><RouterLink :to="evidenceHref(action.tick)">查看证据</RouterLink></td>
          </tr>
          <tr v-for="action in governance.noopActions" :key="action.id">
            <td><CpStatusBadge :tone="actionTone.noop">{{ actionLabel.noop }}</CpStatusBadge></td>
            <td>—</td>
            <td><strong>{{ actionTitle(action) }}</strong><p>{{ actionDetail(action) }}</p></td>
            <td><RouterLink :to="evidenceHref()">查看证据</RouterLink></td>
          </tr>
          <tr v-for="action in governance.noResponseActions" :key="action.id">
            <td><CpStatusBadge :tone="actionTone.no_response">{{ actionLabel.no_response }}</CpStatusBadge></td>
            <td>—</td>
            <td><strong>{{ actionTitle(action) }}</strong><p>{{ actionDetail(action) }}</p></td>
            <td><RouterLink :to="evidenceHref()">查看证据</RouterLink></td>
          </tr>
        </tbody>
      </table>
      <p v-if="!governance.decisionActions.length && !governance.noopActions.length && !governance.noResponseActions.length" class="governance-empty">
        当前结果未记录治理动作；这本身是观察结果，不补生成成功叙事。
      </p>
    </section>

    <p class="governance-note" role="note">{{ governanceNote }}</p>
  </div>
</template>

<style scoped>
.governance-page { display:grid; gap:var(--cp-space-4); }
.governance-summary, .governance-uptake { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.governance-summary > header { padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.governance-summary h2, .governance-uptake h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-lg); }
.governance-summary > header p, .governance-uptake > header p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.governance-summary dl { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:0; }
.governance-summary dl div { padding:var(--cp-space-3) var(--cp-space-4); border-right:1px solid var(--cp-border-subtle); }
.governance-summary dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.governance-summary dd { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); font-weight:750; font-variant-numeric:tabular-nums; }
.governance-uptake > header { padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.governance-uptake table { width:100%; border-collapse:collapse; font-size:var(--cp-text-sm); }
.governance-uptake th, .governance-uptake td { padding:var(--cp-space-2) var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); text-align:left; vertical-align:top; }
.governance-uptake td strong { display:block; }
.governance-uptake td p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.5; }
.governance-uptake a { color:var(--brand-red); font-weight:700; text-decoration:none; white-space:nowrap; }
.governance-empty { margin:0; padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.governance-note { margin:0; padding:var(--cp-space-2) var(--cp-space-3); border-left:3px solid var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
@media (max-width:767px) { .governance-summary dl { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>
