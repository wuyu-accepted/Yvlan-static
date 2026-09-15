<script setup lang="ts">
import { computed } from 'vue'
import type { ResourceFlagshipSummary } from '../../services/resourceFlagship.ts'
import ContentTranslation from '../i18n/ContentTranslation.vue'
import { currentLocale } from '../i18n/locale.ts'
import { branchDisplayName } from './branchPresentation.ts'

const props = defineProps<{ summary: ResourceFlagshipSummary }>()
const branches = ['Natural', 'A', 'B', 'C', 'D'] as const
type Branch = typeof branches[number]

const isEnglish = computed(() => currentLocale.value === 'en-US')
const branchLabel = (branch: Branch) => (
  branchDisplayName('resource-policy-r1', branch, isEnglish.value)
)
const metric = (branch: Branch, name: string) => (
  props.summary.branch_aggregate_summaries[branch]?.[name]?.mean ?? null
)
const interval = (branch: Branch, name: string) => (
  branch === 'Natural'
    ? null
    : props.summary.paired_state_difference_intervals_95_vs_Natural[branch]?.[name] || null
)
const formatNumber = (value: number | null, digits = 1) => (
  value === null ? '—' : value.toFixed(digits)
)
const formatPp = (value: number | null | undefined) => (
  typeof value !== 'number' ? '—' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}`
)
</script>

<template>
  <section class="flagship-panel" aria-labelledby="flagship-title">
    <header class="flagship-head">
      <div>
        <p>{{ summary.seeds.length }}-SEED PAIRED VALIDATION</p>
        <h2 id="flagship-title">暑期住宿床位分配：五种治理机制对照</h2>
        <span>同一人口、同一事件和同一外生随机数下，比较不干预、规则解释、服务承接、跨群触达与动态组合。</span>
        <small class="comparison-note">同预算比较组：不追加治理回应与组合治理；标准解释、服务承接与跨群触达。跨组消息量不作为政策效果。</small>
      </div>
      <dl>
        <div><dt>LLM 槽位</dt><dd>{{ summary.primary_slots.toLocaleString() }}</dd></div>
        <div><dt>配对种子</dt><dd>{{ summary.seeds.length }}</dd></div>
        <div><dt>时间范围</dt><dd>Tick {{ summary.start_tick }}–{{ summary.end_tick }}</dd></div>
      </dl>
    </header>

    <div class="branch-grid" aria-label="五种治理分支的配对种子平均结果">
      <article v-for="branch in branches" :key="branch" :class="`branch-${branch.toLowerCase()}`">
        <header><strong>{{ branchLabel(branch) }}</strong><code>{{ branch === 'Natural' ? 'Natural' : isEnglish ? `Plan ${branch}` : `方案 ${branch}` }}</code></header>
        <dl>
          <div><dt>平均居民发言</dt><dd>{{ formatNumber(metric(branch, 'resident_public_messages')) }}</dd></div>
          <div><dt>平均 Claim</dt><dd>{{ formatNumber(metric(branch, 'claims')) }}</dd></div>
          <div><dt>治理承接链</dt><dd>{{ formatNumber(metric(branch, 'complete_governance_uptake_chains')) }}</dd></div>
          <div><dt>服务闭环</dt><dd>{{ formatNumber(metric(branch, 'complete_help_service_feedback_chains')) }}</dd></div>
        </dl>
      </article>
    </div>

    <div class="mechanism-grid">
      <article>
        <header><span>CLOSED LOOP 01</span><strong>治理信息被居民继续追问</strong></header>
        <div class="message-step message-step--governance">
          <small>{{ summary.featured_mechanisms.governance_uptake.branch }} · {{ isEnglish ? 'Governance message' : '治理消息' }}</small>
          <p data-content-language="zh">{{ summary.featured_mechanisms.governance_uptake.governance_text }}</p>
          <ContentTranslation :text="summary.featured_mechanisms.governance_uptake.governance_text" />
        </div>
        <div class="message-step">
          <small>居民直接回复</small>
          <p data-content-language="zh">{{ summary.featured_mechanisms.governance_uptake.resident_response_text }}</p>
          <ContentTranslation :text="summary.featured_mechanisms.governance_uptake.resident_response_text" />
        </div>
      </article>
      <article>
        <header><span>CLOSED LOOP 02</span><strong>求助进入服务队列并产生后续反馈</strong></header>
        <div v-for="step in [
          ['居民求助', summary.featured_mechanisms.service_feedback.help_text],
          ['服务回执', summary.featured_mechanisms.service_feedback.receipt_text],
          ['居民后续反馈', summary.featured_mechanisms.service_feedback.follow_up_text],
        ]" :key="step[0]" class="message-step">
          <small>{{ step[0] }}</small>
          <p data-content-language="zh">{{ step[1] }}</p>
          <ContentTranslation :text="step[1]" />
        </div>
      </article>
    </div>

    <div class="paired-panel">
      <header>
        <div><p>PAIRED DIFFERENCE</p><h3>相对“不追加治理回应”的模型状态差异</h3></div>
        <span>均值与 95% 配对区间，单位：百分点</span>
      </header>
      <div class="paired-table" role="table" aria-label="各治理方案相对不追加治理回应的配对状态差异">
        <div class="paired-row paired-row--head" role="row">
          <span role="columnheader">方案</span><span role="columnheader">trust</span><span role="columnheader">concern</span><span role="columnheader">satisfaction</span>
        </div>
        <div v-for="branch in branches.slice(1)" :key="branch" class="paired-row" role="row">
          <strong role="cell">{{ branchLabel(branch) }}</strong>
          <span v-for="name in ['trust','concern','satisfaction']" :key="name" role="cell">
            <b>{{ formatPp(interval(branch, name)?.mean) }}</b>
            <small>[{{ formatPp(interval(branch, name)?.lower) }}, {{ formatPp(interval(branch, name)?.upper) }}]</small>
          </span>
        </div>
      </div>
      <footer>
        <span>区间跨过 0 时，不把方向解释为跨种子稳定效果。</span>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.flagship-panel{display:grid;gap:var(--cp-space-4);padding:var(--cp-space-5);border:1px solid var(--cp-border-default);border-top:4px solid var(--cp-action-primary);background:var(--cp-surface-default);box-shadow:var(--cp-shadow-card)}
.flagship-head{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-5)}
.flagship-head>div{max-width:55rem}.flagship-head p,.paired-panel header p{margin:0 0 var(--cp-space-1);color:var(--cp-action-primary);font:750 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.09em}.flagship-head h2{margin:0;font-size:var(--cp-text-2xl);line-height:var(--cp-leading-tight)}.flagship-head>div>span{display:block;margin-top:var(--cp-space-2);color:var(--cp-text-secondary);font-size:var(--cp-text-sm);line-height:1.65}
.comparison-note{display:block;margin-top:.45rem;color:var(--cp-text-muted);font-size:var(--cp-text-xs);line-height:1.5}
.flagship-head>dl{display:flex;margin:0;border:1px solid var(--cp-border-default)}.flagship-head>dl div{min-width:7.5rem;padding:var(--cp-space-3);border-right:1px solid var(--cp-border-subtle)}.flagship-head>dl div:last-child{border-right:0}.flagship-head dt{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.flagship-head dd{margin:var(--cp-space-1) 0 0;font-size:var(--cp-text-lg);font-weight:780;font-variant-numeric:tabular-nums}
.branch-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:var(--cp-space-2)}.branch-grid article{--branch:#777b82;overflow:hidden;border:1px solid var(--cp-border-default);background:var(--cp-surface-raised)}.branch-grid article::before{display:block;height:.25rem;background:var(--branch);content:''}.branch-grid .branch-a{--branch:#b48a45}.branch-grid .branch-b{--branch:#32745a}.branch-grid .branch-c{--branch:#356b86}.branch-grid .branch-d{--branch:var(--cp-action-primary)}.branch-grid header{display:grid;min-height:5.2rem;align-content:start;gap:.35rem;padding:var(--cp-space-3);border-bottom:1px solid var(--cp-border-subtle)}.branch-grid header strong{color:var(--branch);font-size:var(--cp-text-sm);line-height:1.45}.branch-grid header code{width:max-content;padding:.15rem .4rem;border:1px solid currentColor;border-radius:999px;color:var(--cp-text-muted);background:transparent;font:700 .66rem/1.2 var(--cp-font-mono)}.branch-grid dl{display:grid;margin:0}.branch-grid dl div{display:flex;align-items:baseline;justify-content:space-between;gap:var(--cp-space-2);padding:.6rem var(--cp-space-3);border-bottom:1px solid var(--cp-border-subtle)}.branch-grid dl div:last-child{border-bottom:0}.branch-grid dt{color:var(--cp-text-muted);font-size:.68rem}.branch-grid dd{margin:0;font-size:var(--cp-text-sm);font-weight:760;font-variant-numeric:tabular-nums}
.mechanism-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--cp-space-3)}.mechanism-grid>article{overflow:hidden;border:1px solid var(--cp-border-default);background:var(--cp-surface-raised)}.mechanism-grid>article>header{display:flex;align-items:center;justify-content:space-between;gap:var(--cp-space-3);padding:var(--cp-space-3) var(--cp-space-4);border-bottom:1px solid var(--cp-border-default)}.mechanism-grid>article>header span{color:var(--cp-action-primary);font:750 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.08em}.mechanism-grid>article>header strong{font-size:var(--cp-text-sm)}.message-step{padding:var(--cp-space-3) var(--cp-space-4);border-bottom:1px solid var(--cp-border-subtle)}.message-step:last-child{border-bottom:0}.message-step--governance{background:var(--cp-surface-selected)}.message-step small{color:var(--cp-text-muted);font-size:var(--cp-text-xs);font-weight:700}.message-step p{margin:.35rem 0 .55rem;color:var(--cp-text-primary);font-size:var(--cp-text-sm);line-height:1.65}
.paired-panel{overflow:hidden;border:1px solid var(--cp-border-default);background:var(--cp-surface-subtle)}.paired-panel>header{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-4);padding:var(--cp-space-3) var(--cp-space-4);border-bottom:1px solid var(--cp-border-default)}.paired-panel h3{margin:0;font-size:var(--cp-text-lg)}.paired-panel>header>span,.paired-panel footer{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.paired-table{background:var(--cp-surface-default)}.paired-row{display:grid;grid-template-columns:minmax(13rem,1.4fr) repeat(3,minmax(10rem,1fr));border-bottom:1px solid var(--cp-border-subtle)}.paired-row:last-child{border-bottom:0}.paired-row>span,.paired-row>strong{display:grid;gap:.15rem;padding:.72rem var(--cp-space-3);border-right:1px solid var(--cp-border-subtle)}.paired-row>*:last-child{border-right:0}.paired-row>strong{font-size:var(--cp-text-xs)}.paired-row span b{font-size:var(--cp-text-sm);font-variant-numeric:tabular-nums}.paired-row span small{color:var(--cp-text-muted);font-size:.65rem;font-variant-numeric:tabular-nums}.paired-row--head{background:var(--cp-surface-subtle);color:var(--cp-text-muted);font-size:var(--cp-text-xs);font-weight:700}.paired-panel footer{display:flex;justify-content:space-between;gap:var(--cp-space-3);padding:var(--cp-space-3) var(--cp-space-4);border-top:1px solid var(--cp-border-default)}.paired-panel footer a{color:var(--cp-action-primary);font-weight:700}
@media(max-width:1200px){.flagship-head{align-items:flex-start;flex-direction:column}.branch-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.paired-table{overflow-x:auto}.paired-row{min-width:52rem}}
@media(max-width:720px){.flagship-panel{padding:var(--cp-space-4)}.flagship-head>dl{display:grid;width:100%;grid-template-columns:repeat(3,minmax(0,1fr))}.flagship-head>dl div{min-width:0}.branch-grid{grid-template-columns:1fr 1fr}.mechanism-grid{grid-template-columns:1fr}.paired-panel footer{align-items:flex-start;flex-direction:column}}
@media(max-width:430px){.branch-grid{grid-template-columns:1fr}.flagship-head>dl{grid-template-columns:1fr}.flagship-head>dl div{border-right:0;border-bottom:1px solid var(--cp-border-subtle)}.flagship-head>dl div:last-child{border-bottom:0}}
</style>
