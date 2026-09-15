<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { RunEventVM, RunSummary, RuntimeSummaryVM, WorkbenchAccess } from './workbenchViewModel.ts'
import {
  isRunActive,
  isRunTerminal,
  planContractFromRun,
  runStateLabel,
} from './workbenchViewModel.ts'
import { CANCEL_REASONS } from './workbenchCapabilities.ts'
import type { ApiProblem } from '../contracts/api.ts'
import AgentWorldPanel from './AgentWorldPanel.vue'

const props = defineProps<{
  run: RunSummary | null
  runtime: RuntimeSummaryVM | null
  runtimeLoading: boolean
  runtimeError: ApiProblem | null
  events: RunEventVM[] | null
  eventsLoading: boolean
  eventsError: ApiProblem | null
  access: WorkbenchAccess
  enqueuing: boolean
  cancelling: boolean
  actionError: ApiProblem | null
  actionNotice: string
  resultSha256?: string
}>()

const emit = defineEmits<{
  enqueue: []
  cancel: [payload: { reason_code: string; expected_state_version: number }]
  refreshRuntime: []
  loadEvents: []
  openResult: []
  openForum: []
  openEvidence: []
  back: []
}>()

const status = computed(() => props.run ? (props.runtime?.status || props.run.effective_runtime_status || props.run.plan_status || 'draft') : 'draft')
const active = computed(() => isRunActive(status.value))
const terminal = computed(() => isRunTerminal(status.value))
const canCancel = computed(() => active.value && props.access === 'interactive')
const canEnqueue = computed(() => status.value === 'draft' && props.access === 'interactive')
const planContract = computed(() => planContractFromRun(props.run))
const isForumTwinV2 = computed(() => props.run?.execution_mode === 'llm_forum_twin_v2')
const activationModeLabel = computed(() => ({
  budgeted_pps: '预算化多方案',
  full_population_keyframes: '全量关键帧',
  full_population_every_tick: '全量逐 Tick',
}[planContract.value.activationMode || ''] || planContract.value.activationMode || '—'))

function eventTick(event:RunEventVM):number|null {
  const payload=event.payload || {}
  for(const value of [payload.tick,(payload.payload as Record<string,unknown>|undefined)?.tick,(payload.detail as Record<string,unknown>|undefined)?.tick]) {
    if(typeof value==='number' && Number.isInteger(value) && value>=0 && value<=23)return value
  }
  return null
}
const latestRuntimeTick=computed(()=>{
  const committed=[...(props.events||[])].reverse().map(eventTick).find((value):value is number=>value!==null)
  if(committed!==undefined)return committed
  return Math.max(0,Math.min(23,Math.floor((props.runtime?.progressFraction||0)*24)))
})
const runtimeBranchLabel=computed(()=>{
  const last=[...(props.events||[])].reverse().find((event)=>typeof event.payload?.branch==='string'||typeof event.payload?.policy_branch==='string')
  return String(last?.payload?.branch||last?.payload?.policy_branch||'')
})

const showCancel = ref(false)
const cancelForm = reactive({ reason_code: 'operator_requested', expected_state_version: 0 })

function openCancel() {
  cancelForm.reason_code = 'operator_requested'
  cancelForm.expected_state_version = props.runtime?.stateVersion ?? 0
  showCancel.value = true
}

function confirmCancel() {
  if (!canCancel.value) return
  emit('cancel', {
    reason_code: cancelForm.reason_code,
    expected_state_version: cancelForm.expected_state_version,
  })
  showCancel.value = false
}

function progressPercent(): number | null {
  if (props.runtime?.progressFraction === null || props.runtime?.progressFraction === undefined) return null
  return Math.round(props.runtime.progressFraction * 100)
}

function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('zh-CN')
    : '—'
}

let pollTimer: ReturnType<typeof setInterval> | undefined
watch(() => [props.run?.run_id, status.value] as const, ([runId, current]) => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined }
  if (runId && isRunActive(current)) {
    pollTimer = setInterval(() => emit('refreshRuntime'), 4000)
  }
})

onMounted(() => emit('loadEvents'))
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
  <section class="run-monitor" aria-labelledby="run-monitor-title">
    <header class="monitor-head">
      <div>
        <h2 id="run-monitor-title">{{ run?.run_id ? '运行 ' + run.run_id.slice(0, 12) + '…' : '运行监控' }}</h2>
      </div>
      <CpStatusBadge :tone="status === 'succeeded' ? 'success' : status === 'failed' || status === 'cancelled' ? 'warning' : 'info'">
        {{ runStateLabel(status) }}
      </CpStatusBadge>
    </header>

    <div v-if="actionNotice" class="inline-notice" role="status">{{ actionNotice }}</div>
    <div v-if="actionError" class="inline-error" role="alert">
      {{ actionError.summary }}：{{ actionError.detail }}
    </div>
    <div v-if="runtimeError" class="inline-error" role="alert">
      {{ runtimeError.summary }}：{{ runtimeError.detail }}
      <button type="button" @click="emit('refreshRuntime')">重试</button>
    </div>

    <div class="monitor-grid">
      <dl class="runtime-facts" aria-label="运行时事实">
        <div><dt>状态</dt><dd>{{ runStateLabel(status) }}</dd></div>
        <div><dt>状态版本</dt><dd>{{ runtime?.stateVersion ?? '—' }}</dd></div>
        <div><dt>已完成轮次</dt><dd>{{ formatCount(runtime?.turnsCompleted) }} / {{ formatCount(runtime?.turnsReserved) }}</dd></div>
        <div><dt>Token 使用</dt><dd>{{ formatCount(runtime?.tokensUsed) }} / {{ formatCount(runtime?.tokenLimit) }}</dd></div>
        <div><dt>活跃单元</dt><dd>{{ formatCount(runtime?.activeUnits) }} / {{ formatCount(runtime?.concurrencyLimit) }}</dd></div>
        <div><dt>尝试</dt><dd>{{ formatCount(runtime?.attemptCount) }} / {{ formatCount(runtime?.maxAttempts) }}</dd></div>
      </dl>

      <div class="progress-block" aria-label="运行进度">
        <div class="progress-track" role="progressbar" :aria-valuenow="progressPercent() ?? 0" aria-valuemin="0" aria-valuemax="100" aria-valuetext="已用轮次">
          <span class="progress-fill" :style="{ width: (progressPercent() ?? 0) + '%' }" />
        </div>
        <p class="progress-text">进度 {{ progressPercent() === null ? '—' : progressPercent() + '%' }}</p>
      </div>

      <AgentWorldPanel
        v-if="isForumTwinV2"
        variant="runtime"
        :project-id="run?.project_id || ''"
        :runtime-tick="latestRuntimeTick"
        :runtime-status="status"
        :runtime-branch-label="runtimeBranchLabel"
        :runtime-events="events || []"
        :runtime-turns-completed="runtime?.turnsCompleted"
        :runtime-turns-reserved="runtime?.turnsReserved"
      />

      <section v-if="isForumTwinV2" class="world-contract" aria-labelledby="world-contract-title">
        <header>
          <div><p>AGENT WORLD · RUN CONTRACT</p><h3 id="world-contract-title">本次推演怎样驱动这座 Agent 世界</h3></div>
          <strong>{{ activationModeLabel }}</strong>
        </header>
        <div class="world-contract-stats">
          <span><small>固定人口</small><b>{{ formatCount(planContract.population) }}</b></span>
          <span><small>公开发言上限 / Agent·Tick</small><b>{{ formatCount(planContract.publicMessagesPerAgentTickMax) }}</b></span>
          <span><small>独立互动上限</small><b>{{ formatCount(planContract.publicInteractionsPerAgentTickMax) }}</b></span>
          <span><small>私聊动作上限</small><b>{{ formatCount(planContract.privateActionsPerAgentTickMax) }}</b></span>
        </div>
        <div class="world-contract-flow" aria-label="公开论坛、关系私聊与有限观测治理">
          <article :class="{ enabled: planContract.publicRankingGlobal === true }"><i class="fa-solid fa-ranking-star"/><div><b>全局论坛</b><small>同一热榜前十与最新帖</small></div></article>
          <i class="flow-arrow fa-solid fa-arrow-right"/>
          <article :class="{ enabled: planContract.relationshipEnabled === true && planContract.privateChatEnabled === true }"><i class="fa-solid fa-comments"/><div><b>关系与私聊</b><small>好友、动态小群、跨渠道回流</small></div></article>
          <i class="flow-arrow fa-solid fa-arrow-right"/>
          <article class="enabled"><i class="fa-solid fa-triangle-exclamation"/><div><b>风险与治理</b><small>七类信号、三主体有限观测</small></div></article>
        </div>
        <footer>
          <span><i :class="planContract.publicAnonymityEnabled ? 'on' : ''"/>小喇叭可选匿名 {{ planContract.publicAnonymityEnabled ? '开启' : '关闭' }}</span>
          <span><i :class="planContract.relationshipAttentionEnabled ? 'on' : ''"/>关系注意 {{ planContract.relationshipAttentionEnabled ? '开启' : '关闭' }}</span>
          <span><i :class="planContract.dynamicGroupsEnabled ? 'on' : ''"/>动态小群 {{ planContract.dynamicGroupsEnabled ? '开启' : '关闭' }}</span>
          <span><i :class="planContract.serviceDeskEnabled ? 'on' : ''"/>服务工单 {{ planContract.serviceDeskEnabled ? '开启' : '关闭' }}</span>
          <span><i :class="planContract.sameTickTwoPhaseCommit ? 'on' : ''"/>同 Tick 两阶段提交 {{ planContract.sameTickTwoPhaseCommit ? '开启' : '关闭' }}</span>
          <span v-if="planContract.keyframeTicks.length">全量 Tick：{{ planContract.keyframeTicks.join('、') }}</span>
          <span v-if="planContract.privateOriginShareMax !== null">私聊来源非锚点上限：{{ Math.round(planContract.privateOriginShareMax * 100) }}%</span>
        </footer>
      </section>

      <div class="monitor-actions">
        <button v-if="canEnqueue" type="button" class="primary" :disabled="enqueuing" @click="emit('enqueue')">
          {{ enqueuing ? '入队中…' : '入队运行' }}
        </button>
        <button v-if="canCancel" type="button" class="danger" :disabled="cancelling" @click="openCancel">
          {{ cancelling ? '取消中…' : '取消运行' }}
        </button>
        <button v-if="status === 'succeeded'" type="button" class="primary" @click="emit('openResult')">打开结果</button>
        <button v-if="status === 'succeeded'" type="button" class="secondary" @click="emit('openForum')">调查论坛</button>
        <button v-if="run" type="button" class="secondary" @click="emit('openEvidence')">查看证据</button>
        <button type="button" class="secondary" @click="emit('back')">返回运行列表</button>
      </div>

      <div v-if="status === 'failed'" class="failure-panel" role="alert">
        <strong>运行失败</strong>
        <p>最后 checkpoint 与预算信息保留在下方运行时事实中；不显示空结果。可返回运行列表查看失败事件，或在合同允许时重新计划。</p>
      </div>
      <div v-else-if="status === 'cancelled'" class="failure-panel">
        <strong>运行已取消</strong>
        <p>该运行不会生成正式结果。</p>
      </div>
    </div>

    <div v-if="showCancel" class="cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      <div class="cancel-box">
        <h3 id="cancel-title">取消运行</h3>
        <p>目标运行：<code>{{ run?.run_id }}</code>（状态版本 {{ cancelForm.expected_state_version }}）</p>
        <label class="field">
          <span>取消原因（严格枚举）<em aria-hidden="true">*</em></span>
          <select v-model="cancelForm.reason_code">
            <option v-for="reason in CANCEL_REASONS" :key="reason.code" :value="reason.code">{{ reason.label }}</option>
          </select>
        </label>
        <div class="cancel-actions">
          <button type="button" class="secondary" @click="showCancel = false">放弃</button>
          <button type="button" class="danger" :disabled="cancelling" @click="confirmCancel">{{ cancelling ? '取消中…' : '确认取消' }}</button>
        </div>
      </div>
    </div>

    <section class="events" aria-labelledby="events-title">
      <header class="events-head">
        <h3 id="events-title">运行事件</h3>
        <button type="button" class="refresh" :disabled="eventsLoading" @click="emit('loadEvents')">刷新事件</button>
      </header>
      <div v-if="eventsLoading" class="loading">正在加载事件…</div>
      <div v-else-if="eventsError" class="inline-error" role="alert">
        {{ eventsError.summary }}：{{ eventsError.detail }}
        <button type="button" @click="emit('loadEvents')">重试</button>
      </div>
      <ol v-else-if="events && events.length" class="event-list" aria-live="polite" aria-relevant="additions">
        <li v-for="event in events" :key="event.sequence" class="event">
          <span class="event-seq"><code>#{{ event.sequence }}</code></span>
          <CpStatusBadge tone="neutral">{{ event.kind }}</CpStatusBadge>
          <span class="event-msg">{{ event.message }}</span>
        </li>
      </ol>
      <div v-else class="panel-empty">暂无运行事件。{{ active ? '运行进行中会持续追加。' : '' }}</div>
    </section>
  </section>
</template>

<style scoped>
.run-monitor { display:grid; gap:var(--cp-space-4); }
.monitor-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.monitor-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.monitor-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.inline-notice, .inline-error { margin:0; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-warning); background:var(--cp-warning-surface); color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.inline-error { border-color:var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); }
.monitor-grid { display:grid; gap:var(--cp-space-3); }
.runtime-facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(10rem,1fr)); gap:var(--cp-space-2); margin:0; }
.runtime-facts div { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-default); }
.runtime-facts dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.runtime-facts dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; font-variant-numeric:tabular-nums; }
.progress-track { height:.6rem; border-radius:var(--cp-radius-sm); background:var(--cp-surface-subtle); border:1px solid var(--cp-border-subtle); overflow:hidden; }
.progress-fill { display:block; height:100%; background:var(--cp-action-primary); }
.progress-text { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.world-contract { display:grid; gap:var(--cp-space-3); padding:clamp(1rem,2vw,1.5rem); border:1px solid #d9d1cc; background:linear-gradient(145deg,#171315,#24191d); color:#fff; overflow:hidden; }
.world-contract header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.world-contract header p { margin:0 0 .35rem; color:#e6b96d; font:700 .66rem var(--cp-font-mono); letter-spacing:.13em; }
.world-contract header h3 { margin:0; color:#fff; font-size:1.05rem; }
.world-contract header strong { padding:.42rem .65rem; border:1px solid rgba(230,185,109,.45); color:#f5d69c; font-size:.72rem; white-space:nowrap; }
.world-contract-stats { display:grid; grid-template-columns:repeat(4,1fr); border-block:1px solid rgba(255,255,255,.14); }
.world-contract-stats span { display:grid; gap:.25rem; padding:.8rem; border-right:1px solid rgba(255,255,255,.14); }
.world-contract-stats span:last-child { border-right:0; }
.world-contract-stats small { color:#a99da1; font-size:.62rem; }
.world-contract-stats b { color:#fff; font:750 1.2rem var(--cp-font-sans); }
.world-contract-flow { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; align-items:center; gap:.65rem; }
.world-contract-flow article { display:flex; align-items:center; gap:.7rem; min-height:4.1rem; padding:.75rem; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); opacity:.42; }
.world-contract-flow article.enabled { border-color:rgba(216,0,61,.55); background:linear-gradient(120deg,rgba(216,0,61,.18),rgba(255,255,255,.04)); opacity:1; }
.world-contract-flow article>i { display:grid; width:2rem; height:2rem; flex:none; place-items:center; border-radius:50%; background:#c00035; }
.world-contract-flow article div { display:grid; gap:.2rem; }
.world-contract-flow article b { font-size:.76rem; }
.world-contract-flow article small { color:#bfb2b6; font-size:.6rem; line-height:1.45; }
.flow-arrow { color:#7a696f; }
.world-contract footer { display:flex; flex-wrap:wrap; gap:.55rem 1.1rem; color:#bfb2b6; font-size:.62rem; }
.world-contract footer span { display:flex; align-items:center; gap:.35rem; }
.world-contract footer i { width:.42rem; height:.42rem; border-radius:50%; background:#5d5155; }
.world-contract footer i.on { background:#39c77b; box-shadow:0 0 0 .22rem rgba(57,199,123,.12); }
.monitor-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.monitor-actions button, .refresh, .cancel-actions button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.primary { border-color:var(--cp-action-primary) !important; background:var(--cp-action-primary); color:var(--cp-surface-default); }
.primary:hover { background:var(--cp-action-primary-hover); }
.secondary { background:var(--cp-surface-default); color:var(--cp-text-primary); }
.danger { border-color:var(--cp-danger) !important; background:var(--cp-surface-default); color:var(--cp-danger); }
button:disabled { opacity:.5; cursor:not-allowed; }
.failure-panel { padding:var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); }
.failure-panel p { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-sm); }
.cancel-dialog { position:fixed; inset:0; z-index:var(--cp-z-drawer); display:flex; align-items:center; justify-content:center; padding:var(--cp-space-4); background:var(--cp-overlay); }
.cancel-box { width:min(100%,28rem); display:grid; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.cancel-box h3 { margin:0; font-size:var(--cp-text-md); }
.cancel-box p { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.cancel-box code { font-family:var(--cp-font-mono); }
.field { display:grid; gap:var(--cp-space-1); }
.field > span { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.field em { color:var(--cp-danger); font-style:normal; }
.field select { min-height:var(--cp-control-height); padding:var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.cancel-actions { display:flex; justify-content:flex-end; gap:var(--cp-space-2); }
.events { display:grid; gap:var(--cp-space-2); }
.events-head { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-2); }
.events-head h3 { margin:0; font-size:var(--cp-text-md); }
.loading { padding:var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.event-list { display:grid; gap:var(--cp-space-1); margin:0; padding:0; list-style:none; }
.event { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-2); padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-subtle); font-size:var(--cp-text-sm); }
.event-seq code { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.event-msg { min-width:0; color:var(--cp-text-primary); }
.panel-empty { padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
@media (max-width:767px) { .runtime-facts,.world-contract-stats { grid-template-columns:1fr 1fr; } .world-contract-stats span:nth-child(2){border-right:0}.world-contract-flow{grid-template-columns:1fr}.flow-arrow{justify-self:center;transform:rotate(90deg)}.world-contract header{flex-direction:column}.world-contract header strong{white-space:normal} }
</style>
