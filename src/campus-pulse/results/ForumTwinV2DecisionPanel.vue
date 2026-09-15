<script setup lang="ts">
import { computed } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { ForumTwinV2ResultView } from '../source/forumTwinAdapter.ts'

const props = defineProps<{ result: ForumTwinV2ResultView }>()

const RISK_LABELS: Record<string, string> = {
  unsupported_claim_velocity: '无依据 Claim 增速',
  private_to_public_spillover: '私聊猜测回流',
  contested_claim_share: '争议 Claim 占比',
  cross_group_exposure_gap: '跨群触达缺口',
  correction_penetration_and_delay: '纠错穿透与延迟',
  help_backlog_and_sla_breach: '求助积压与 SLA',
  governance_observation_gap: '治理观测差',
}

const ACTIVATION_LABELS: Record<string, string> = {
  budgeted_pps: '预算化多方案',
  full_population_keyframes: '全量关键帧',
  full_population_every_tick: '全量逐时间步',
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = number(source[key])
    if (value !== null) return value
  }
  return null
}

function integer(value: number | null): string {
  return value === null ? '未发布' : Math.round(value).toLocaleString('zh-CN')
}

function percent(value: number | null): string {
  return value === null ? '未发布' : `${(value * 100).toFixed(1)}%`
}

const latestTick = computed(() => Math.max(-1, ...props.result.riskTimeline.map((item) => item.tick)))
const latestRisk = computed(() => props.result.riskTimeline.filter((item) => item.tick === latestTick.value))
const riskSignals = computed(() => {
  const preferred = latestRisk.value.find((item) => item.branch === 'D') || latestRisk.value[0]
  return preferred?.signals || []
})
const publicMessages = computed(() => firstNumber(props.result.publicMetrics, [
  'public_messages', 'message_count', 'public_message_count',
]))
const publicInteractions = computed(() => firstNumber(props.result.publicMetrics, [
  'public_interactions', 'interaction_count',
]))
const privateMessages = computed(() => firstNumber(props.result.privateAggregateMetrics, [
  'private_messages', 'message_count', 'private_message_count',
]))
const groupCount = computed(() => firstNumber(props.result.privateAggregateMetrics, [
  'private_groups', 'group_conversations', 'active_group_count',
]))
const spillovers = computed(() => firstNumber(props.result.privateAggregateMetrics, [
  'private_to_public_spillovers', 'spillover_count',
]))
const correctionPenetration = computed(() => firstNumber(props.result.privateAggregateMetrics, [
  'correction_penetration', 'correction_private_penetration',
]))
const privateBacklog = computed(() => firstNumber(props.result.privateAggregateMetrics, [
  'pending_private_activations', 'private_activation_backlog',
]))
const reviewedPrivateExcerpts = computed(() => {
  const raw = props.result.privateAggregateMetrics.reviewed_excerpts
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    if (row.review_status !== 'approved' || typeof row.excerpt !== 'string') return []
    const excerpt = row.excerpt.trim().slice(0, 240)
    if (!excerpt) return []
    return [{
      excerpt,
      tick: number(row.tick),
      channel: typeof row.channel === 'string' ? row.channel : 'private',
      mechanism: typeof row.mechanism === 'string' ? row.mechanism : 'private_discussion',
    }]
  }).slice(0, 6)
})

const censusRows = computed(() => {
  const grouped = new Map<number, typeof props.result.censusPoints>()
  for (const point of props.result.censusPoints) {
    const values = grouped.get(point.budget) || []
    values.push(point)
    grouped.set(point.budget, values)
  }
  return [...grouped.entries()].sort(([left], [right]) => left - right).map(([budget, values]) => {
    const average = (selector: (value: typeof values[number]) => number | null) => {
      const available = values.map(selector).filter((value): value is number => value !== null)
      return available.length ? available.reduce((total, value) => total + value, 0) / available.length : null
    }
    return {
      budget,
      actionMae: average((value) => value.actionMae),
      stanceMae: average((value) => value.stanceMae),
      topicMae: average((value) => value.topicMae),
      privateActionMae: average((value) => value.privateActionMae),
      coverage95: average((value) => value.coverage95),
      schedulerRecall: average((value) => value.schedulerRecall),
    }
  })
})

const progress = computed(() => {
  const required = props.result.completeness.required_primary_slots
  return required > 0 ? props.result.completeness.completed_primary_slots / required : 0
})

const ablation = computed(() => props.result.relationshipAblation)
const ablationConditions = computed(() => {
  const source = ablation.value?.condition_metrics
  if (!source || typeof source !== 'object' || Array.isArray(source)) return []
  const labels: Record<string, string> = {
    full_system: '完整系统',
    private_chat_disabled: '关闭私聊',
    relationship_attention_disabled: '关闭关系注意',
    cross_group_bridge_disabled: '关闭跨群桥接',
  }
  return Object.entries(source as Record<string, unknown>).map(([key, raw]) => {
    const value = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {}
    return {
      key,
      label: labels[key] || key,
      persona: number(value.persona_consistency),
      context: number(value.direct_context_uptake),
      diversity: number(value.semantic_diversity),
      spillovers: number(value.private_to_public_spillovers),
      exposureGap: number(value.mean_cross_group_exposure_gap),
    }
  })
})

function severityTone(severity: string): 'neutral' | 'warning' | 'danger' {
  return severity === 'high' ? 'danger' : severity === 'watch' ? 'warning' : 'neutral'
}
</script>

<template>
  <section class="v2-decision-panel" aria-labelledby="forum-v2-result-title">
    <header class="v2-head">
      <div>
        <p>FORUMTWIN V2 · MULTI-CHANNEL GOVERNANCE</p>
        <h2 id="forum-v2-result-title">公开论坛、好友私聊与治理响应</h2>
        <span>风险按七类机制分别报告，不压缩成一个不可解释的总分。</span>
      </div>
      <dl>
        <div><dt>运行模式</dt><dd>{{ ACTIVATION_LABELS[result.activationMode] || result.activationMode }}</dd></div>
        <div><dt>执行来源</dt><dd>{{ result.executionProvenance }}</dd></div>
        <div><dt>槽位完成度</dt><dd>{{ result.completeness.completed_primary_slots.toLocaleString('zh-CN') }} / {{ result.completeness.required_primary_slots.toLocaleString('zh-CN') }}</dd></div>
      </dl>
    </header>

    <div class="completion" role="progressbar" aria-label="LLM 槽位完成度" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progress * 100)">
      <span :style="{ width: `${Math.min(100, progress * 100)}%` }" />
    </div>

    <div class="channel-grid">
      <article>
        <header><span>PUBLIC</span><strong>公开论坛</strong></header>
        <dl>
          <div><dt>公开帖子与回复</dt><dd>{{ integer(publicMessages) }}</dd></div>
          <div><dt>点赞 / 转发 / 举报</dt><dd>{{ integer(publicInteractions) }}</dd></div>
        </dl>
      </article>
      <article>
        <header><span>PRIVATE</span><strong>好友与动态小群</strong></header>
        <dl>
          <div><dt>私聊消息</dt><dd>{{ integer(privateMessages) }}</dd></div>
          <div><dt>动态小群</dt><dd>{{ integer(groupCount) }}</dd></div>
          <div><dt>待处理私聊</dt><dd>{{ integer(privateBacklog) }}</dd></div>
        </dl>
      </article>
      <article class="channel-grid__bridge">
        <header><span>SPILLOVER</span><strong>跨渠道机制</strong></header>
        <dl>
          <div><dt>私聊猜测回流公开</dt><dd>{{ integer(spillovers) }}</dd></div>
          <div><dt>纠错进入私聊比例</dt><dd>{{ percent(correctionPenetration) }}</dd></div>
        </dl>
      </article>
    </div>

    <section v-if="reviewedPrivateExcerpts.length" class="reviewed-private" aria-labelledby="reviewed-private-title">
      <header><div><p>REVIEWED SYNTHETIC EXCERPTS</p><h3 id="reviewed-private-title">经审阅的合成私聊片段</h3></div><span>仅展示人工批准、匿名化的机制片段</span></header>
      <div><blockquote v-for="(item,index) in reviewedPrivateExcerpts" :key="`${item.tick}-${index}`"><p>“{{ item.excerpt }}”</p><footer><span>Tick {{ item.tick ?? '—' }}</span><b>{{ item.channel }} · {{ item.mechanism }}</b></footer></blockquote></div>
    </section>

    <section class="risk-board" aria-labelledby="risk-board-title">
      <header>
        <div><p>RISK RADAR</p><h3 id="risk-board-title">Tick {{ latestTick < 0 ? '—' : latestTick }} 风险截面</h3></div>
        <span>阈值来自共享 baseline 的冻结分位数</span>
      </header>
      <div v-if="riskSignals.length" class="risk-list">
        <article v-for="signal in riskSignals" :key="signal.signal_name">
          <div class="risk-label">
            <strong>{{ RISK_LABELS[signal.signal_name] || signal.signal_name }}</strong>
            <CpStatusBadge :tone="severityTone(signal.severity)">{{ signal.severity }}</CpStatusBadge>
          </div>
          <div class="risk-track"><span :style="{ width: `${Math.min(100, Math.max(0, signal.value * 100))}%` }" /></div>
          <footer><b>{{ percent(signal.value) }}</b><span>Δ {{ signal.change_velocity >= 0 ? '+' : '' }}{{ (signal.change_velocity * 100).toFixed(1) }} pp</span></footer>
        </article>
      </div>
      <p v-else class="empty">当前结果没有发布风险时间线。</p>
    </section>

    <section class="census" aria-labelledby="census-title">
      <header>
        <div><p>CENSUS CALIBRATION</p><h3 id="census-title">预算化激活与 200-Agent census 的误差</h3></div>
        <CpStatusBadge :tone="result.censusStatus === 'pass' ? 'evidence' : 'neutral'">{{ result.censusStatus || '尚未发布' }}</CpStatusBadge>
      </header>
      <div v-if="censusRows.length" class="table-wrap">
        <table>
          <thead><tr><th scope="col">每轮预算</th><th scope="col">Action MAE</th><th scope="col">Stance MAE</th><th scope="col">Topic MAE</th><th scope="col">Private MAE</th><th scope="col">95% 覆盖率</th><th scope="col">行动召回</th></tr></thead>
          <tbody>
            <tr v-for="row in censusRows" :key="row.budget">
              <th scope="row">B={{ row.budget }}</th>
              <td>{{ row.actionMae === null ? '—' : row.actionMae.toFixed(3) }}</td>
              <td>{{ row.stanceMae === null ? '—' : row.stanceMae.toFixed(3) }}</td>
              <td>{{ row.topicMae === null ? '—' : row.topicMae.toFixed(3) }}</td>
              <td>{{ row.privateActionMae === null ? '—' : row.privateActionMae.toFixed(3) }}</td>
              <td>{{ percent(row.coverage95) }}</td>
              <td>{{ percent(row.schedulerRecall) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty">当前交付按成本策略不运行 603 槽付费 census；工具链和精度门禁保留。</p>
    </section>

    <section class="census" aria-labelledby="ablation-title">
      <header>
        <div><p>RELATIONSHIP ABLATION</p><h3 id="ablation-title">关系、私聊与跨群桥接是否真正改变传播</h3></div>
        <CpStatusBadge :tone="ablation?.status === 'pass' ? 'evidence' : 'neutral'">{{ ablation?.status || '尚未发布' }}</CpStatusBadge>
      </header>
      <div v-if="ablationConditions.length" class="table-wrap">
        <table>
          <thead><tr><th scope="col">条件</th><th scope="col">人物一致性</th><th scope="col">上下文承接</th><th scope="col">语义多样性</th><th scope="col">私聊回流</th><th scope="col">跨群暴露缺口</th></tr></thead>
          <tbody>
            <tr v-for="row in ablationConditions" :key="row.key">
              <th scope="row">{{ row.label }}</th>
              <td>{{ percent(row.persona) }}</td>
              <td>{{ percent(row.context) }}</td>
              <td>{{ percent(row.diversity) }}</td>
              <td>{{ integer(row.spillovers) }}</td>
              <td>{{ percent(row.exposureGap) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty">真实 LLM 关系消融已按成本策略暂停；工具链与门禁保留，不生成替代数据。</p>
    </section>
  </section>
</template>

<style scoped>
.v2-decision-panel{display:grid;gap:var(--cp-space-4);padding:var(--cp-space-5);border:1px solid var(--cp-border-default);background:linear-gradient(145deg,color-mix(in srgb,var(--cp-surface-default) 94%,var(--cp-action-primary)),var(--cp-surface-default))}
.v2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--cp-space-5)}
.v2-head p,.risk-board header p,.census header p{margin:0;color:var(--cp-action-primary);font:750 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.1em}
.v2-head h2,.risk-board h3,.census h3{margin:.4rem 0 0}.v2-head>div>span,.risk-board>header>span{display:block;margin-top:.45rem;color:var(--cp-text-muted);font-size:var(--cp-text-xs)}
.v2-head dl{display:grid;min-width:24rem;margin:0;border:1px solid var(--cp-border-default);background:var(--cp-surface-raised)}
.v2-head dl div{display:flex;justify-content:space-between;gap:var(--cp-space-3);padding:.55rem var(--cp-space-3);border-bottom:1px solid var(--cp-border-subtle)}.v2-head dl div:last-child{border:0}.v2-head dt{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.v2-head dd{margin:0;font:700 var(--cp-text-xs)/1.4 var(--cp-font-mono);text-align:right}
.completion{height:.3rem;overflow:hidden;background:var(--cp-border-subtle)}.completion span{display:block;height:100%;background:linear-gradient(90deg,var(--cp-action-primary),var(--cp-success));transition:width .35s ease}
.channel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--cp-space-3)}.channel-grid article{border:1px solid var(--cp-border-default);background:var(--cp-surface-raised)}.channel-grid article header{display:flex;align-items:baseline;justify-content:space-between;padding:var(--cp-space-3);border-bottom:1px solid var(--cp-border-subtle)}.channel-grid article header span{color:var(--cp-action-primary);font:750 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.08em}.channel-grid dl{margin:0}.channel-grid dl div{display:flex;justify-content:space-between;gap:var(--cp-space-3);padding:.65rem var(--cp-space-3);border-bottom:1px solid var(--cp-border-subtle)}.channel-grid dl div:last-child{border:0}.channel-grid dt{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.channel-grid dd{margin:0;font-weight:760;font-variant-numeric:tabular-nums}
.risk-board,.census{border:1px solid var(--cp-border-default);background:var(--cp-surface-default)}.risk-board>header,.census>header{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-4);padding:var(--cp-space-3) var(--cp-space-4);border-bottom:1px solid var(--cp-border-default)}
.reviewed-private{border:1px solid var(--cp-border-default);background:linear-gradient(145deg,var(--cp-surface-subtle),var(--cp-surface-default))}.reviewed-private>header{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-3);padding:var(--cp-space-3) var(--cp-space-4);border-bottom:1px solid var(--cp-border-default)}.reviewed-private header p{margin:0;color:var(--cp-action-primary);font:750 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.1em}.reviewed-private h3{margin:.35rem 0 0}.reviewed-private>header>span{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.reviewed-private>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--cp-border-subtle)}.reviewed-private blockquote{margin:0;padding:var(--cp-space-4);background:var(--cp-surface-default)}.reviewed-private blockquote p{margin:0;color:var(--cp-text-primary);font-size:var(--cp-text-sm);line-height:1.75}.reviewed-private blockquote footer{display:flex;justify-content:space-between;gap:var(--cp-space-2);margin-top:var(--cp-space-3);color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.reviewed-private blockquote b{color:var(--cp-action-primary);font-weight:650}
.risk-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0}.risk-list article{padding:var(--cp-space-3) var(--cp-space-4);border-right:1px solid var(--cp-border-subtle);border-bottom:1px solid var(--cp-border-subtle)}.risk-list article:nth-child(2n){border-right:0}.risk-label,.risk-list footer{display:flex;align-items:center;justify-content:space-between;gap:var(--cp-space-2)}.risk-label strong{font-size:var(--cp-text-sm)}.risk-track{height:.36rem;margin:.65rem 0;background:var(--cp-surface-subtle)}.risk-track span{display:block;height:100%;background:var(--cp-action-primary)}.risk-list footer{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.risk-list footer b{color:var(--cp-text-primary);font-variant-numeric:tabular-nums}
.table-wrap{overflow:auto}.census table{width:100%;border-collapse:collapse;font-size:var(--cp-text-xs);font-variant-numeric:tabular-nums}.census th,.census td{padding:.7rem var(--cp-space-3);border-bottom:1px solid var(--cp-border-subtle);text-align:right;white-space:nowrap}.census th:first-child{text-align:left}.empty{margin:0;padding:var(--cp-space-4);color:var(--cp-text-muted);font-size:var(--cp-text-sm)}
@media(max-width:1000px){.v2-head{flex-direction:column}.v2-head dl{width:100%;min-width:0}.channel-grid{grid-template-columns:1fr 1fr}.channel-grid__bridge{grid-column:1/-1}}
@media(max-width:640px){.v2-decision-panel{padding:var(--cp-space-3)}.channel-grid,.risk-list,.reviewed-private>div{grid-template-columns:1fr}.channel-grid__bridge{grid-column:auto}.risk-list article{border-right:0}.risk-board>header,.census>header,.reviewed-private>header{align-items:flex-start;flex-direction:column}}
</style>
