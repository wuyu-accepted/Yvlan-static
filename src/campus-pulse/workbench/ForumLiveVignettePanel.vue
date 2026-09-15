<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getForumLiveVignetteStatus,
  prepareForumLiveVignette,
  readableApiError,
  resolveForumLiveVignetteUnknown,
  startForumLiveVignette,
} from '../../services/campusPulseApi'
import { currentLocale } from '../i18n/locale.ts'

type ScenarioId =
  | 'century_gym_ghost_booking_dispute'
  | 'governance_legitimacy_dispute'
  | 'lecture_external_incident_shock'

type RunScope =
  | 'quick_closed_loop'
  | 'resource_public_private_closed_loop'

const props = defineProps<{
  projectId: string
  scenarioId: ScenarioId | null
  scenarioConfigured: boolean
}>()
const emit = defineEmits<{ configureScenario: [] }>()

type VignetteStatus = {
  session_id: string
  run_scope: RunScope
  scenario_id: ScenarioId
  scenario_label_zh: string
  scenario_label_en: string
  preflight_sha256: string
  model: string
  endpoint: string
  authorization_statement: string
  authorization_statement_sha256: string
  primary_slots: number
  resident_slots: number
  governance_actor_slots: number
  provider_request_hard_limit: number
  provider_token_hard_limit: number
  max_residents_one_tick: number
  max_residents_plus_governance_one_tick: number
  expected_committed_ticks: number
  channels: Record<string, boolean>
  sent_fields: string[]
  excluded_fields: string[]
  privacy_scan: { passed?: boolean }
  authorization_recorded: boolean
  running: boolean
  manifest_status: string
  committed_ticks: number
  latest_tick: number | null
  latest_branch: string | null
  stop_code: string | null
  succeeded: boolean
  can_start: boolean
  can_resume: boolean
  unknown_resolution_required: boolean
  unknown_resolution_recorded: boolean
  unknown_replacement_exhausted: boolean
  unknown_attempt_id: string | null
  unknown_resolution_statement_sha256: string
  progress_session_id: string
  progress_base_url: string
  result_summary?: {
    natural: { public_messages: number; reply_count: number }
    governed: {
      public_messages: number
      reply_count: number
      private_conversation_count: number
      private_message_count: number
      private_group_count: number
      anonymous_public_message_count: number
      direct_governance_response_count: number
      complete_governance_uptake_chains: number
      complete_correction_chains: number
    }
    state_delta_D_minus_Natural: {
      trust: number
      concern: number
      satisfaction: number
    }
    provider_calls: number
    provider_tokens: number
    format_repairs: number
    unknown_outcomes: number
  } | null
}

const router = useRouter()
const route = useRoute()
const isEnglish = computed(() => currentLocale.value === 'en-US')
const selectedRunScope = ref<RunScope>('quick_closed_loop')
const preflight = ref<VignetteStatus | null>(null)
const acknowledged = ref(false)
const unknownAcknowledged = ref(false)
const preparing = ref(false)
const starting = ref(false)
const resolvingUnknown = ref(false)
const refreshing = ref(false)
const error = ref('')
let pollTimer: ReturnType<typeof setInterval> | undefined
const SESSION_STORAGE_KEY = 'campus-pulse.quick-live-session.v1'

const scenarios: Array<{ id: ScenarioId; zh: string; en: string; noteZh: string; noteEn: string }> = [
  {
    id:'century_gym_ghost_booking_dispute',
    zh:'世纪馆“幽灵预约”',
    en:'Century Gym ghost booking',
    noteZh:'场地现场空置，但热门时段持续不可预约。',
    noteEn:'Venues appear empty while peak slots remain unavailable.',
  },
  {
    id:'governance_legitimacy_dispute',
    zh:'住宿床位分配争议',
    en:'Housing allocation dispute',
    noteZh:'围绕稀缺床位、资格标准和复核渠道的正当性争议。',
    noteEn:'A legitimacy dispute over scarce beds, criteria, and appeals.',
  },
  {
    id:'lecture_external_incident_shock',
    zh:'讲座冲突事件传播',
    en:'Lecture conflict propagation',
    noteZh:'学生目击冲突后，碎片化叙述在论坛持续传播。',
    noteEn:'Fragmented accounts spread after students witness a conflict.',
  },
]
const selectedScenario = computed(() => props.scenarioId)
const selectedScenarioMeta = computed(() => scenarios.find(item => item.id === selectedScenario.value) || null)
const scenarioReady = computed(() => props.scenarioConfigured && Boolean(selectedScenario.value))

function localize(zh: string, en: string): string {
  return isEnglish.value ? en : zh
}

const busy = computed(() => preparing.value || starting.value || resolvingUnknown.value || refreshing.value)
const progress = computed(() => {
  const expected = preflight.value?.expected_committed_ticks || 1
  return Math.min(100, Math.round(((preflight.value?.committed_ticks || 0) / expected) * 100))
})
const stateLabel = computed(() => {
  const value = preflight.value
  if (!value) return localize('尚未准备', 'Not prepared')
  if (value.succeeded) return localize('运行完成', 'Completed')
  if (value.running) return localize('真实 LLM 运行中', 'Live LLM run in progress')
  if (value.stop_code) return localize('已暂停，等待检查', 'Paused for inspection')
  if (value.authorization_recorded) return localize('可断点续跑', 'Ready to resume')
  return localize('待确认启动', 'Awaiting confirmation')
})

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = undefined
}

function beginPolling() {
  stopPolling()
  pollTimer = setInterval(() => { void refreshStatus() }, 1600)
}

async function prepare() {
  if (busy.value || !selectedScenario.value || !scenarioReady.value) return
  preparing.value = true
  error.value = ''
  acknowledged.value = false
  unknownAcknowledged.value = false
  stopPolling()
  try {
    preflight.value = await prepareForumLiveVignette(
      selectedScenario.value,
      selectedRunScope.value,
    ) as VignetteStatus
    localStorage.setItem(SESSION_STORAGE_KEY, preflight.value.session_id)
  } catch (reason) {
    error.value = readableApiError(reason)
  } finally {
    preparing.value = false
  }
}

function chooseRunScope(runScope: RunScope) {
  if (runScope === 'resource_public_private_closed_loop' && selectedScenario.value !== 'governance_legitimacy_dispute') return
  selectedRunScope.value = runScope
  preflight.value = null
  acknowledged.value = false
  unknownAcknowledged.value = false
  error.value = ''
  localStorage.removeItem(SESSION_STORAGE_KEY)
}

async function refreshStatus() {
  const sessionId = preflight.value?.session_id
  if (!sessionId || refreshing.value) return
  refreshing.value = true
  try {
    preflight.value = await getForumLiveVignetteStatus(sessionId) as VignetteStatus
    if (preflight.value.succeeded || preflight.value.stop_code) stopPolling()
  } catch (reason) {
    error.value = readableApiError(reason)
    stopPolling()
  } finally {
    refreshing.value = false
  }
}

async function start() {
  const value = preflight.value
  if (!value || !acknowledged.value || busy.value) return
  starting.value = true
  error.value = ''
  try {
    preflight.value = await startForumLiveVignette(value.session_id, {
      preflight_sha256:value.preflight_sha256,
      authorization_statement_sha256:value.authorization_statement_sha256,
      scope_acknowledged:true,
    }) as VignetteStatus
    beginPolling()
  } catch (reason) {
    error.value = readableApiError(reason)
  } finally {
    starting.value = false
  }
}

async function resolveUnknownAndResume() {
  const value = preflight.value
  if (!value || !unknownAcknowledged.value || busy.value) return
  resolvingUnknown.value = true
  error.value = ''
  try {
    const resolved = await resolveForumLiveVignetteUnknown(value.session_id, {
      preflight_sha256:value.preflight_sha256,
      resolution_statement_sha256:value.unknown_resolution_statement_sha256,
      late_result_rejected:true,
      replacement_limit_acknowledged:1,
    }) as VignetteStatus
    if (!resolved.can_resume) {
      preflight.value = resolved
      throw new Error(localize(
        '未知请求已记录，但当前运行不能安全恢复。',
        'The unknown attempt was recorded, but this run cannot safely resume.',
      ))
    }
    preflight.value = await startForumLiveVignette(resolved.session_id, {
      preflight_sha256:resolved.preflight_sha256,
      authorization_statement_sha256:resolved.authorization_statement_sha256,
      scope_acknowledged:true,
    }) as VignetteStatus
    beginPolling()
  } catch (reason) {
    error.value = readableApiError(reason)
  } finally {
    resolvingUnknown.value = false
  }
}

function openProviderSettings() {
  router.push({ name:'campus-pulse-system', query:{ tab:'provider' } })
}

function openLiveConsole() {
  const value = preflight.value
  if (!value) return
  router.push({
    name:'campus-pulse-live-world',
    query:{
      session:value.progress_session_id,
      progress_base:value.progress_base_url,
      scenario:value.scenario_id,
      live:'1',
    },
  })
}

onMounted(async () => {
  const queryValue = Array.isArray(route.query.live_session)
    ? route.query.live_session[0]
    : route.query.live_session
  const sessionId = String(
    queryValue || localStorage.getItem(SESSION_STORAGE_KEY) || '',
  )
  if (!/^forum-vignette-[a-z0-9]{12}$/.test(sessionId)) return
  try {
    preflight.value = await getForumLiveVignetteStatus(sessionId) as VignetteStatus
    if (preflight.value.scenario_id !== selectedScenario.value) {
      preflight.value = null
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }
    selectedRunScope.value = preflight.value.run_scope || 'quick_closed_loop'
    if (preflight.value.running) beginPolling()
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }
})

watch(() => props.scenarioId, () => {
  stopPolling()
  preflight.value = null
  acknowledged.value = false
  unknownAcknowledged.value = false
  selectedRunScope.value = 'quick_closed_loop'
  localStorage.removeItem(SESSION_STORAGE_KEY)
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <section class="vignette" aria-labelledby="vignette-title">
    <header class="vignette__head">
      <div>
        <span>LIVE LLM · COST-BOUNDED</span>
        <h3 id="vignette-title">{{ localize('一键真实 LLM 推演', 'One-click live LLM simulation') }}</h3>
        <p>{{ localize('使用当前项目的已配置事件，选择运行深度后冻结预算、启动 Agent、保存检查点，并把论坛、私聊和治理结果逐时间步送到实时运行台。', 'Use this project’s configured event, choose a run depth, then freeze the budget, start agents, save checkpoints, and stream committed results to the live console.') }}</p>
      </div>
      <div class="vignette__head-actions">
        <button type="button" class="config-link" @click="openProviderSettings">{{ localize('模型与 API', 'Model & API') }}</button>
        <strong class="state" :class="{ active:preflight?.running, done:preflight?.succeeded }">{{ stateLabel }}</strong>
      </div>
    </header>

    <div v-if="scenarioReady && selectedScenarioMeta" class="scenario-context">
      <div><span>{{ localize('当前项目事件', 'Current project event') }}</span><b>{{ localize(selectedScenarioMeta.zh,selectedScenarioMeta.en) }}</b><p>{{ localize(selectedScenarioMeta.noteZh,selectedScenarioMeta.noteEn) }}</p></div>
      <button type="button" :disabled="busy || Boolean(preflight?.authorization_recorded)" @click="emit('configureScenario')">{{ localize('前往情景设计', 'Open scenario design') }}</button>
    </div>
    <div v-else class="scenario-missing" role="status"><div><b>{{ localize('尚未配置可运行事件', 'No runnable event configured') }}</b><p>{{ localize('请先在“情景设计”中完成当前项目的事件和时间线；这里不会自动替换成其他案例。', 'Configure this project’s event and timeline first. This panel will not substitute another case.') }}</p></div><button type="button" @click="emit('configureScenario')">{{ localize('配置情景', 'Configure scenario') }}</button></div>

    <div v-if="scenarioReady" class="scope-picker" :class="{single:selectedScenario!=='governance_legitimacy_dispute'}" role="radiogroup" :aria-label="localize('选择运行深度', 'Select run depth')">
      <button
        type="button"
        role="radio"
        :aria-checked="selectedRunScope === 'quick_closed_loop'"
        :class="{ selected:selectedRunScope === 'quick_closed_loop' }"
        :disabled="busy || Boolean(preflight?.authorization_recorded)"
        @click="chooseRunScope('quick_closed_loop')"
      >
        <span>QUICK LOOP</span>
        <b>{{ localize('快速闭环', 'Quick closed loop') }}</b>
        <small>{{ localize('118 槽 · Tick 3–6 · 公开论坛与治理，用于配置校验和现场试跑。', '118 slots · Tick 3–6 · public forum and governance, for configuration checks and live rehearsals.') }}</small>
      </button>
      <button
        v-if="selectedScenario === 'governance_legitimacy_dispute'"
        type="button"
        role="radio"
        :aria-checked="selectedRunScope === 'resource_public_private_closed_loop'"
        :class="{ selected:selectedRunScope === 'resource_public_private_closed_loop' }"
        :disabled="busy || Boolean(preflight?.authorization_recorded)"
        @click="chooseRunScope('resource_public_private_closed_loop')"
      >
        <span>FORUMTWIN V4</span>
        <b>{{ localize('公域—私域主实验', 'Public–private main experiment') }}</b>
        <small>{{ localize('358 槽 · Tick 3–10 · 关系注意、好友私聊、动态群聊、匿名表达与七类风险。', '358 slots · Tick 3–10 · relationship attention, friend chats, dynamic groups, anonymity, and seven risk signals.') }}</small>
      </button>
    </div>

    <div v-if="!preflight" class="prepare-row">
      <div>
        <strong>{{ localize('先冻结运行合同', 'Freeze the run contract first') }}</strong>
        <span>{{ localize('核对调用预算和发送内容，确认后即可启动。', 'Review the call budget and transmitted fields, then confirm to start.') }}</span>
      </div>
      <button type="button" class="primary" :disabled="busy || !scenarioReady" @click="prepare">
        {{ preparing ? localize('正在生成…', 'Preparing…') : localize('生成 Preflight', 'Generate preflight') }}
      </button>
    </div>

    <template v-else>
      <div class="contract-grid">
        <div><span>{{ localize('真实 LLM 槽位', 'Live LLM slots') }}</span><strong>{{ preflight.primary_slots }}</strong><small>{{ preflight.resident_slots }} resident + {{ preflight.governance_actor_slots }} actor</small></div>
        <div><span>{{ localize('单时间步上限', 'Per-tick cap') }}</span><strong>{{ preflight.max_residents_plus_governance_one_tick }}</strong><small>{{ preflight.max_residents_one_tick }} resident + 3 actor</small></div>
        <div><span>{{ localize('请求硬上限', 'Request hard limit') }}</span><strong>{{ preflight.provider_request_hard_limit }}</strong><small>{{ localize('unknown 不自动补发', 'no automatic resend after unknown') }}</small></div>
        <div><span>Token hard limit</span><strong>{{ (preflight.provider_token_hard_limit / 1_000_000).toFixed(1) }}M</strong><small>{{ preflight.model }} · reasoning none</small></div>
      </div>

      <div class="hash-row">
        <span>{{ localize('运行前检查', 'Pre-run check') }}</span>
        <i :class="preflight.privacy_scan?.passed ? 'pass' : 'fail'">{{ preflight.privacy_scan?.passed ? localize('隐私扫描通过', 'Privacy scan passed') : localize('未通过', 'Failed') }}</i>
      </div>

      <details class="scope-detail">
        <summary>{{ localize('查看发送字段与排除字段', 'View sent and excluded fields') }}</summary>
        <div>
          <section><strong>{{ localize('允许发送', 'Sent') }}</strong><ul><li v-for="field in preflight.sent_fields" :key="field">{{ field }}</li></ul></section>
          <section><strong>{{ localize('明确排除', 'Excluded') }}</strong><ul><li v-for="field in preflight.excluded_fields" :key="field">{{ field }}</li></ul></section>
        </div>
      </details>

      <label v-if="!preflight.authorization_recorded" class="acknowledgement">
        <input v-model="acknowledged" type="checkbox">
        <span>{{ localize('我已核对上述模型、范围和硬预算，并同意本次一次性运行。', 'I reviewed the model, scope, and hard limits above and approve this single run.') }}</span>
      </label>

      <div v-if="preflight.authorization_recorded" class="progress-block">
        <div><strong>{{ stateLabel }}</strong><span>{{ preflight.committed_ticks }}/{{ preflight.expected_committed_ticks }} {{ localize('个公开检查点', 'public checkpoints') }}<template v-if="preflight.latest_tick !== null"> · Tick {{ preflight.latest_tick }} / {{ preflight.latest_branch }}</template></span></div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ width:`${progress}%` }" /></div>
        <p v-if="preflight.stop_code" role="alert">{{ localize('运行已按合同暂停：', 'Run paused by contract: ') }}{{ preflight.stop_code }}</p>
      </div>

      <section v-if="preflight.unknown_resolution_required" class="unknown-resolution" aria-labelledby="unknown-resolution-title">
        <div>
          <strong id="unknown-resolution-title">{{ localize('Provider 返回状态未知', 'Provider outcome is unknown') }}</strong>
          <p>{{ localize('系统已经暂停且没有自动重试。只有明确放弃迟到结果后，才会用完全相同的脱敏 Prompt 补发一次。', 'The run paused without an automatic retry. It can resend the exact same de-identified prompt once only after you explicitly abandon any late result.') }}</p>
          <code v-if="preflight.unknown_attempt_id">{{ preflight.unknown_attempt_id }}</code>
        </div>
        <label>
          <input v-model="unknownAcknowledged" type="checkbox">
          <span>{{ localize('我永久弃用旧请求的迟到结果，并接受两次请求都可能计费；若补发仍未知则停止。', 'I permanently reject any late result, accept that both requests may be billed, and require the run to stop if the replacement is also unknown.') }}</span>
        </label>
        <button type="button" class="primary" :disabled="busy || !unknownAcknowledged" @click="resolveUnknownAndResume">
          {{ resolvingUnknown ? localize('正在记录并恢复…', 'Recording and resuming…') : localize('弃用旧请求并补发一次', 'Abandon and resend once') }}
        </button>
      </section>

      <p v-if="preflight.unknown_replacement_exhausted" class="unknown-exhausted" role="alert">{{ localize('替代请求再次返回未知状态，本次运行已按合同停止。', 'The replacement request also returned an unknown outcome, so this run is stopped by contract.') }}</p>

      <section v-if="preflight.succeeded && preflight.result_summary" class="outcome" aria-labelledby="vignette-outcome-title">
        <header>
          <div>
            <span>{{ localize('本次运行结论', 'Outcome of this run') }}</span>
            <h4 id="vignette-outcome-title">{{ localize('治理进入了居民对话', 'Governance entered resident dialogue') }}</h4>
          </div>
          <small>{{ preflight.result_summary.provider_calls }} calls · {{ preflight.result_summary.provider_tokens.toLocaleString() }} tokens · {{ preflight.result_summary.unknown_outcomes }} unknown</small>
        </header>
        <div class="outcome__grid">
          <div><span>Natural / D {{ localize('公开消息', 'messages') }}</span><strong>{{ preflight.result_summary.natural.public_messages }} / {{ preflight.result_summary.governed.public_messages }}</strong></div>
          <div><span>{{ localize('居民直接承接治理', 'Direct governance responses') }}</span><strong>{{ preflight.result_summary.governed.direct_governance_response_count }}</strong></div>
          <div><span>{{ localize('治理链 / 纠错链', 'Uptake / correction chains') }}</span><strong>{{ preflight.result_summary.governed.complete_governance_uptake_chains }} / {{ preflight.result_summary.governed.complete_correction_chains }}</strong></div>
          <div><span>Δ trust / concern</span><strong>{{ preflight.result_summary.state_delta_D_minus_Natural.trust >= 0 ? '+' : '' }}{{ preflight.result_summary.state_delta_D_minus_Natural.trust.toFixed(3) }} / {{ preflight.result_summary.state_delta_D_minus_Natural.concern >= 0 ? '+' : '' }}{{ preflight.result_summary.state_delta_D_minus_Natural.concern.toFixed(3) }}</strong></div>
          <div v-if="preflight.run_scope === 'resource_public_private_closed_loop'"><span>{{ localize('私聊 / 动态群', 'Private messages / groups') }}</span><strong>{{ preflight.result_summary.governed.private_message_count }} / {{ preflight.result_summary.governed.private_group_count }}</strong></div>
          <div v-if="preflight.run_scope === 'resource_public_private_closed_loop'"><span>{{ localize('匿名公开表达', 'Anonymous public messages') }}</span><strong>{{ preflight.result_summary.governed.anonymous_public_message_count }}</strong></div>
        </div>
        <p>{{ localize('D 没有通过压低发言制造效果；居民继续追问释放时限、核销记录与责任角色。', 'D did not create an effect by suppressing speech; residents kept pressing for release deadlines, check-in records, and accountable roles.') }}</p>
      </section>

      <div class="actions">
        <button
          v-if="preflight.can_start || preflight.can_resume"
          type="button"
          class="primary"
          :disabled="busy || (!preflight.authorization_recorded && !acknowledged)"
          @click="start"
        >
          {{ starting ? localize('正在启动…', 'Starting…') : preflight.can_resume ? localize('从账本继续', 'Resume from ledger') : localize('启动真实 LLM 推演', 'Start live LLM run') }}
        </button>
        <button v-if="preflight.authorization_recorded" type="button" @click="openLiveConsole">{{ localize('打开实时运行台', 'Open live console') }}</button>
        <button type="button" :disabled="busy" @click="refreshStatus">{{ localize('刷新状态', 'Refresh status') }}</button>
        <button v-if="!preflight.authorization_recorded" type="button" :disabled="busy" @click="preflight = null; acknowledged = false">{{ localize('重新选择', 'Choose again') }}</button>
      </div>
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.vignette{display:grid;gap:var(--cp-space-4);padding:var(--cp-space-5);border:1px solid color-mix(in srgb,var(--cp-action-primary) 36%,var(--cp-border-default));border-radius:var(--cp-radius-md);background:linear-gradient(135deg,var(--cp-surface-default),color-mix(in srgb,var(--cp-surface-selected) 72%,var(--cp-surface-default)));box-shadow:var(--cp-shadow-card)}
.vignette__head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--cp-space-4)}.vignette__head span{color:var(--cp-action-primary);font:800 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.09em}.vignette__head h3{margin:.45rem 0 .25rem;font-size:var(--cp-text-lg)}.vignette__head p{max-width:52rem;margin:0;color:var(--cp-text-secondary);font-size:var(--cp-text-sm);line-height:1.6}.vignette__head-actions{display:flex;align-items:center;gap:var(--cp-space-2)}.config-link{min-height:2rem;padding:0 .75rem;border:1px solid var(--cp-border-default);border-radius:999px;background:var(--cp-surface-default);color:var(--cp-text-secondary);font-size:var(--cp-text-xs);font-weight:750;cursor:pointer}.state{flex:none;padding:.4rem .7rem;border:1px solid var(--cp-border-default);border-radius:999px;color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.state.active{border-color:var(--cp-warning);color:var(--cp-warning)}.state.done{border-color:var(--cp-success);color:var(--cp-success)}
.scenario-context,.scenario-missing{display:flex;align-items:center;justify-content:space-between;gap:var(--cp-space-4);padding:var(--cp-space-4);border:1px solid var(--cp-border-default);border-left:4px solid var(--cp-action-primary);background:var(--cp-surface-default)}.scenario-context>div,.scenario-missing>div{display:grid;gap:.35rem}.scenario-context span{color:var(--cp-action-primary);font:800 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.08em}.scenario-context b,.scenario-missing b{font-size:var(--cp-text-md)}.scenario-context p,.scenario-missing p{margin:0;color:var(--cp-text-secondary);font-size:var(--cp-text-xs);line-height:1.55}.scenario-context button,.scenario-missing button{flex:none;min-height:var(--cp-control-height);padding:0 var(--cp-space-3);border:1px solid var(--cp-border-strong);border-radius:var(--cp-radius-sm);background:var(--cp-surface-subtle);color:var(--cp-action-primary);font-weight:700;cursor:pointer}.scenario-missing{border-left-color:var(--cp-warning);background:var(--cp-warning-surface)}
.scope-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--cp-space-2)}.scope-picker button{position:relative;display:grid;gap:.35rem;min-width:0;padding:var(--cp-space-3) var(--cp-space-4);border:1px solid var(--cp-border-default);border-radius:var(--cp-radius-sm);background:var(--cp-surface-default);color:var(--cp-text-primary);text-align:left;cursor:pointer}.scope-picker button.selected{border-color:var(--cp-action-primary);box-shadow:inset 0 0 0 1px var(--cp-action-primary);background:linear-gradient(135deg,var(--cp-surface-selected),var(--cp-surface-default))}.scope-picker button:disabled{cursor:not-allowed;opacity:.55}.scope-picker span{color:var(--cp-action-primary);font:800 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.08em}.scope-picker b{font-size:var(--cp-text-md)}.scope-picker small{color:var(--cp-text-secondary);font-size:var(--cp-text-xs);line-height:1.5}.scope-picker i{color:var(--cp-warning);font-size:var(--cp-text-xs);font-style:normal}
.scope-picker.single{grid-template-columns:1fr}.scope-picker.single button{max-width:none}
.prepare-row{display:flex;align-items:center;justify-content:space-between;gap:var(--cp-space-4);padding:var(--cp-space-4);border:1px dashed var(--cp-border-strong);background:var(--cp-surface-default)}.prepare-row>div{display:grid;gap:.25rem}.prepare-row span{color:var(--cp-text-secondary);font-size:var(--cp-text-xs)}
.contract-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--cp-space-2)}.contract-grid>div{display:grid;gap:.2rem;padding:var(--cp-space-3);border:1px solid var(--cp-border-subtle);background:var(--cp-surface-default)}.contract-grid span,.contract-grid small{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.contract-grid strong{font:800 var(--cp-text-xl)/1.2 var(--cp-font-mono)}
.hash-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--cp-space-2);padding:var(--cp-space-2) var(--cp-space-3);background:var(--cp-surface-inverse);color:var(--cp-text-inverse);font-size:var(--cp-text-xs)}.hash-row code{min-width:0;overflow:hidden;color:inherit;font-family:var(--cp-font-mono);text-overflow:ellipsis;white-space:nowrap}.hash-row i{font-style:normal}.hash-row .pass{color:#8ee3ad}.hash-row .fail{color:#ff9b9b}
.scope-detail{border:1px solid var(--cp-border-default);background:var(--cp-surface-default)}.scope-detail summary{padding:var(--cp-space-3);font-size:var(--cp-text-sm);font-weight:750;cursor:pointer}.scope-detail>div{display:grid;grid-template-columns:1fr 1fr;gap:var(--cp-space-4);padding:0 var(--cp-space-4) var(--cp-space-4);border-top:1px solid var(--cp-border-subtle)}.scope-detail section{padding-top:var(--cp-space-3)}.scope-detail ul{margin:.5rem 0 0;padding-left:1.1rem;color:var(--cp-text-secondary);font-size:var(--cp-text-xs);line-height:1.55}
.acknowledgement{display:flex;align-items:flex-start;gap:var(--cp-space-2);padding:var(--cp-space-3);border-left:3px solid var(--cp-warning);background:var(--cp-warning-surface);font-size:var(--cp-text-sm);line-height:1.5}.acknowledgement input{width:1.1rem;height:1.1rem;margin-top:.1rem;accent-color:var(--cp-action-primary)}
.progress-block{display:grid;gap:var(--cp-space-2)}.progress-block>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:var(--cp-space-3);font-size:var(--cp-text-sm)}.progress-block span{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.progress-track{height:.5rem;overflow:hidden;border-radius:999px;background:var(--cp-border-subtle)}.progress-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--cp-action-primary),#ef7d4f);transition:width .4s ease}.progress-block p,.error{margin:0;padding:var(--cp-space-2) var(--cp-space-3);border-left:3px solid var(--cp-danger);background:var(--cp-danger-surface);color:var(--cp-danger);font-size:var(--cp-text-xs)}
.unknown-resolution{display:grid;grid-template-columns:minmax(0,1fr) minmax(20rem,1.3fr) auto;align-items:center;gap:var(--cp-space-3);padding:var(--cp-space-4);border:1px solid var(--cp-warning);background:var(--cp-warning-surface)}.unknown-resolution>div{display:grid;gap:.3rem}.unknown-resolution p{margin:0;color:var(--cp-text-secondary);font-size:var(--cp-text-xs);line-height:1.5}.unknown-resolution code{font-size:var(--cp-text-xs)}.unknown-resolution label{display:flex;align-items:flex-start;gap:.55rem;color:var(--cp-text-secondary);font-size:var(--cp-text-xs);line-height:1.5}.unknown-resolution input{width:1.05rem;height:1.05rem;margin-top:.1rem;accent-color:var(--cp-action-primary)}.unknown-exhausted{margin:0;padding:var(--cp-space-3);border-left:3px solid var(--cp-danger);background:var(--cp-danger-surface);color:var(--cp-danger);font-size:var(--cp-text-sm)}
.outcome{display:grid;gap:var(--cp-space-3);padding:var(--cp-space-4);border:1px solid color-mix(in srgb,var(--cp-success) 45%,var(--cp-border-default));border-radius:var(--cp-radius-sm);background:linear-gradient(135deg,color-mix(in srgb,var(--cp-success) 8%,var(--cp-surface-default)),var(--cp-surface-default))}.outcome>header{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-3)}.outcome>header span{color:var(--cp-success);font:800 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.08em}.outcome h4{margin:.35rem 0 0;font-size:var(--cp-text-lg)}.outcome>header small{color:var(--cp-text-muted);font:var(--cp-text-xs)/1.4 var(--cp-font-mono)}.outcome__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--cp-space-2)}.outcome__grid>div{display:grid;gap:.35rem;padding:var(--cp-space-3);border:1px solid var(--cp-border-subtle);background:var(--cp-surface-default)}.outcome__grid span{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.outcome__grid strong{font:800 var(--cp-text-lg)/1.2 var(--cp-font-mono)}.outcome>p{margin:0;color:var(--cp-text-secondary);font-size:var(--cp-text-sm);line-height:1.6}
.actions{display:flex;flex-wrap:wrap;gap:var(--cp-space-2)}.actions button,.primary{min-height:var(--cp-control-height);padding:0 var(--cp-space-3);border:1px solid var(--cp-border-strong);border-radius:var(--cp-radius-sm);background:var(--cp-surface-default);color:var(--cp-text-primary);font-weight:750;cursor:pointer}.actions .primary,.primary{border-color:var(--cp-action-primary);background:var(--cp-action-primary);color:var(--cp-text-inverse)}.actions button:disabled,.primary:disabled{cursor:not-allowed;opacity:.5}
@media(max-width:900px){.scenario-grid,.contract-grid,.outcome__grid{grid-template-columns:1fr 1fr}.vignette__head{flex-direction:column}.vignette__head-actions{width:100%;justify-content:space-between}.unknown-resolution{grid-template-columns:1fr}.state{align-self:flex-start}}
@media(max-width:620px){.vignette{padding:var(--cp-space-4)}.scenario-context,.scenario-missing{align-items:flex-start;flex-direction:column}.scope-picker,.contract-grid,.scope-detail>div,.outcome__grid{grid-template-columns:1fr}.prepare-row,.outcome>header{align-items:flex-start;flex-direction:column}.prepare-row .primary,.actions button{width:100%}.hash-row{grid-template-columns:1fr}.hash-row code{white-space:normal;overflow-wrap:anywhere}}
@media(prefers-reduced-motion:reduce){.progress-track i{transition:none}}
</style>
