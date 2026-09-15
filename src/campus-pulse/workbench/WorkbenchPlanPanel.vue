<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { ScenarioSummary, PolicySummary, RunSummary, WorkbenchAccess } from './workbenchViewModel.ts'
import { planContractFromRun, runStateLabel } from './workbenchViewModel.ts'
import {
  EXECUTION_MODE_LABELS,
  FORUM_V2_ACTIVATION_MODES,
  GOVERNANCE_V2_SEEDS,
  populationReleaseForMode,
  policyTemplateAllowed,
  validateTokenBudget,
} from './workbenchCapabilities.ts'
import type { ApiProblem } from '../contracts/api.ts'
import { fieldErrorsFromProblem } from './workbenchViewModel.ts'

const props = defineProps<{
  projectId: string
  access: WorkbenchAccess
  scenarios: ScenarioSummary[] | null
  policies: PolicySummary[] | null
  sensingActive: boolean
  evidenceReady: boolean
  submitting: boolean
  submitError: ApiProblem | null
  submitSuccess: string
  bootstrapSubmitting: boolean
  bootstrapError: string
  bootstrapSuccess: string
  plannedRun: RunSummary | null
}>()

const emit = defineEmits<{
  submit: [payload: Record<string, unknown>]
  refresh: []
  openRun: [runId: string]
  openSection: [section: 'evidence' | 'scenarios' | 'policies']
  bootstrapProject: []
}>()

const form = reactive({
  scenario_id: '',
  execution_mode: 'llm_forum_twin_v2',
  forum_activation_mode: 'budgeted_pps',
  forum_keyframe_ticks: '3, 7, 13, 19',
  forum_public_anonymity_enabled: true,
  forum_relationship_attention_enabled: true,
  forum_friend_chat_enabled: true,
  forum_dynamic_group_enabled: true,
  forum_service_desk_enabled: true,
  policy_ids: [] as string[],
  agent_count: 1_000,
  seeds: '20260722',
  model_name: 'gpt-5.6-luna',
  max_workers: 32,
  token_budget: 1_000,
})

const localErrors = ref<Record<string, string[]>>({})
const serverFieldErrors = computed(() => fieldErrorsFromProblem(props.submitError))
const lockedMode = computed(() => (
  form.execution_mode === 'adaptive_particle_population'
  || form.execution_mode === 'budgeted_llm_agent_population'
  || form.execution_mode === 'llm_forum_twin'
  || form.execution_mode === 'llm_forum_twin_v2'
))
const isForumV2 = computed(() => form.execution_mode === 'llm_forum_twin_v2')
const forumV2TickBudgets = computed(() => Array.from({ length: 24 }, (_, tick) => {
  if (form.forum_activation_mode === 'full_population_every_tick') return 1_000
  if (form.forum_activation_mode === 'full_population_keyframes' && parseKeyframeTicksSafe().includes(tick)) return 1_000
  if (tick <= 1) return 24
  if (tick === 2) return 48
  if (tick <= 7) return 64
  if (tick <= 17) return 48
  return 32
}))
const forumV2PeakBudget = computed(() => Math.max(...forumV2TickBudgets.value, 1))

const selectedScenario = computed(() => (
  (props.scenarios ?? []).find((scenario) => scenario.scenario_id === form.scenario_id) || null
))
const hasScenarios = computed(() => (props.scenarios?.length ?? 0) > 0)

const allowedPolicyTemplateKeys = computed(() => (
  policyTemplateAllowed(selectedScenario.value?.template_key, lockedMode.value)
))

const selectablePolicies = computed(() => {
  const policies = props.policies ?? []
  if (!allowedPolicyTemplateKeys.value.length) return []
  return policies.filter((policy) => (
    policy.template_key && allowedPolicyTemplateKeys.value.includes(policy.template_key)
  ))
})

const budgetContract = computed(() => validateTokenBudget(form.execution_mode, form.token_budget))

const readiness = computed(() => {
  const steps: Array<{ label: string; ok: boolean; note: string }> = [
    { label: '证据绑定', ok: props.evidenceReady, note: props.evidenceReady ? '已绑定' : '缺少证据绑定' },
    { label: '感知激活', ok: props.sensingActive, note: props.sensingActive ? '已激活' : '需要服务端显式激活感知快照' },
    { label: '场景', ok: Boolean(selectedScenario.value), note: selectedScenario.value ? selectedScenario.value.name : '未选择场景' },
    {
      label: '场景证据血缘',
      ok: selectedScenario.value?.evidence_binding_status === 'sealed',
      note: selectedScenario.value?.evidence_binding_status === 'sealed' ? '已封存' : '未封存（不能用于新运行）',
    },
    { label: '政策白名单', ok: selectablePolicies.value.length > 0, note: selectablePolicies.value.length ? selectablePolicies.value.length + ' 个可用方案' : '无可用方案' },
    { label: 'Token 合同', ok: budgetContract.value.ok, note: budgetContract.value.ok ? '符合合同' : (budgetContract.value.reason || '不符合合同') },
  ]
  return steps
})

const canSubmit = computed(() => (
  props.access === 'interactive'
  && readiness.value.every((step) => step.ok)
))

function fieldError(field: string): string {
  return (serverFieldErrors.value[field] ?? localErrors.value[field] ?? [])[0] || ''
}

function parseSeeds(): number[] {
  const raw = form.seeds.split(',').map((part) => part.trim()).filter(Boolean)
  if (!raw.length) throw new Error('至少需要一个种子值')
  const seeds = raw.map((value) => Number(value))
  if (seeds.some((seed) => !Number.isInteger(seed) || seed < 0)) throw new Error('种子必须是正整数')
  return seeds
}

function parseKeyframeTicks(): number[] {
  if (form.forum_activation_mode !== 'full_population_keyframes') return []
  const values = form.forum_keyframe_ticks.split(',').map((part) => part.trim()).filter(Boolean).map(Number)
  if (!values.length || values.some((value) => !Number.isInteger(value) || value < 0 || value > 23)) {
    throw new Error('关键帧必须是 0–23 范围内的整数')
  }
  if (new Set(values).size !== values.length) throw new Error('关键帧不能重复')
  return values.sort((left, right) => left - right)
}

function parseKeyframeTicksSafe(): number[] {
  try { return parseKeyframeTicks() } catch { return [] }
}

function validate(): boolean {
  const errors: Record<string, string[]> = {}
  if (!form.scenario_id) errors.scenario_id = ['请选择一个冻结情景']
  else if (selectedScenario.value?.evidence_binding_status !== 'sealed') errors.scenario_id = ['所选情景证据血缘未封存，不能用于新运行']
  if (!form.policy_ids.length) errors.policy_ids = ['至少选择一个政策方案']
  const chosen = (props.policies ?? []).filter((policy) => form.policy_ids.includes(policy.policy_id))
  if (chosen.some((policy) => policy.template_key && !allowedPolicyTemplateKeys.value.includes(policy.template_key))) {
    errors.policy_ids = ['所选方案不在当前情景/模式的白名单内']
  }
  if (form.execution_mode === 'adaptive_particle_population') {
    let seeds: number[]
    try { seeds = parseSeeds() } catch { seeds = [] }
    if (seeds.join(',') !== GOVERNANCE_V2_SEEDS.join(',')) {
      errors.seeds = ['此治理模式需要预设的 8 个配对种子']
    }
  }
  if (form.execution_mode === 'llm_forum_twin_v2' && form.forum_activation_mode === 'full_population_keyframes') {
    try { parseKeyframeTicks() } catch (error) { errors.forum_keyframe_ticks = [(error as Error).message] }
  }
  if (isForumV2.value && form.forum_dynamic_group_enabled && !form.forum_friend_chat_enabled) {
    errors.forum_dynamic_group_enabled = ['动态小群依赖好友私聊通道']
  }
  if (isForumV2.value && form.agent_count !== 1_000) errors.agent_count = ['固定使用 1,000-Agent 世界；调用规模由激活模式控制']
  else if (form.agent_count < 1 || form.agent_count > 1000) errors.agent_count = ['agent 数量必须在 1–1000']
  if (form.max_workers < 1 || form.max_workers > 48) errors.max_workers = ['worker 数量必须在 1–48']
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(form.model_name.trim())) errors.model_name = ['模型名称不符合合同格式']
  if (!budgetContract.value.ok) errors.token_budget = [budgetContract.value.reason || 'token budget 不符合合同']
  localErrors.value = errors
  return Object.keys(errors).length === 0
}

function submit() {
  if (props.access !== 'interactive') return
  if (!validate()) return
  let seeds: number[]
  try {
    seeds = parseSeeds()
  } catch (error) {
    localErrors.value = { seeds: [(error as Error).message] }
    return
  }
  const payload: Record<string, unknown> = {
    scenario_id: form.scenario_id,
    execution_mode: form.execution_mode,
    policy_ids: [...form.policy_ids],
    population_release_id: populationReleaseForMode(form.execution_mode),
    agent_count: Number(form.agent_count),
    seeds,
    model_name: form.model_name.trim(),
    max_workers: Number(form.max_workers),
    token_budget: Number(form.token_budget),
  }
  if (form.execution_mode === 'llm_forum_twin_v2') {
    payload.execution_provenance = 'emulator_only_development'
    payload.forum_activation_mode = form.forum_activation_mode
    payload.forum_keyframe_ticks = parseKeyframeTicks()
    payload.forum_public_anonymity_enabled = form.forum_public_anonymity_enabled
    payload.forum_relationship_attention_enabled = form.forum_relationship_attention_enabled
    payload.forum_friend_chat_enabled = form.forum_friend_chat_enabled
    payload.forum_dynamic_group_enabled = form.forum_dynamic_group_enabled
    payload.forum_service_desk_enabled = form.forum_service_desk_enabled
  }
  emit('submit', payload)
}

function applyExecutionModeDefaults(mode: string) {
  if (mode === 'llm_forum_twin_v2') {
    form.agent_count = 1_000
    form.seeds = '20260722'
    form.model_name = 'gpt-5.6-luna'
    form.token_budget = 1_000
    form.forum_activation_mode = 'budgeted_pps'
    form.forum_public_anonymity_enabled = true
    form.forum_relationship_attention_enabled = true
    form.forum_friend_chat_enabled = true
    form.forum_dynamic_group_enabled = true
    form.forum_service_desk_enabled = true
    return
  }
  if (mode === 'llm_forum_twin') {
    form.agent_count = 1_000
    form.seeds = GOVERNANCE_V2_SEEDS.join(', ')
    form.model_name = 'gpt-5.4-mini'
    form.token_budget = 80_000_000
    return
  }
  if (mode === 'budgeted_llm_agent_population') {
    form.agent_count = 1_000
    form.seeds = GOVERNANCE_V2_SEEDS.join(', ')
    form.model_name = 'gpt-5.6-sol'
    form.token_budget = 40_000_000
    return
  }
  if (mode === 'adaptive_particle_population') {
    form.agent_count = 1_000
    form.seeds = GOVERNANCE_V2_SEEDS.join(', ')
    form.model_name = 'message-aware-particle-state-space-qre-v2'
    form.token_budget = 1_000
    return
  }
  if (mode === 'budgeted_population') {
    form.agent_count = 1_000
    form.seeds = '20260722, 20261731'
    form.model_name = 'deterministic-glm-state-space-v1'
    form.token_budget = 1_000
    return
  }
  form.agent_count = 48
  form.seeds = '20260722, 20261731'
  form.model_name = 'gpt-5.6-sol'
  form.token_budget = 2_000_000
}

watch(() => form.execution_mode, (mode) => {
  applyExecutionModeDefaults(mode)
  form.policy_ids = form.policy_ids.filter((policyId) => (
    selectablePolicies.value.some((policy) => policy.policy_id === policyId)
  ))
  localErrors.value = {}
})

watch(() => form.forum_friend_chat_enabled, (enabled) => {
  if (!enabled) form.forum_dynamic_group_enabled = false
})

watch(() => props.scenarios, (items) => {
  const available = items ?? []
  if (form.scenario_id && available.some((scenario) => scenario.scenario_id === form.scenario_id)) return
  form.scenario_id = available.find((scenario) => scenario.evidence_binding_status === 'sealed')?.scenario_id || ''
}, { immediate: true, deep: true })

watch(() => props.plannedRun, (run) => {
  if (!run) return
  const contract = planContractFromRun(run)
  if (contract.tokenLimit !== null && contract.tokenLimit > 0) {
    form.token_budget = contract.tokenLimit
  }
})

const contract = computed(() => props.plannedRun ? planContractFromRun(props.plannedRun) : null)
const providerBatches = computed(() => {
  if (!contract.value?.primarySlots || form.max_workers < 1) return null
  return Math.ceil(contract.value.primarySlots / form.max_workers)
})

function formatBudget(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('zh-CN')
}
</script>

<template>
  <section class="plan-panel" aria-labelledby="plan-title">
    <header class="panel-head">
      <div>
        <h2 id="plan-title">运行计划与合同</h2>
      </div>
      <button type="button" class="refresh" :disabled="props.access !== 'interactive'" @click="emit('refresh')">刷新</button>
    </header>

    <p v-if="access === 'unavailable' || access === 'readonly'" class="readonly-note">
      当前为{{ access === 'unavailable' ? '只读（后端不可用）' : '只读' }}状态：计划提交已禁用。
    </p>

    <div class="readiness" aria-label="计划就绪状态">
      <div v-for="step in readiness" :key="step.label" class="readiness-step" :class="{ ok: step.ok, bad: !step.ok }">
        <span class="dot" aria-hidden="true" />
        <strong>{{ step.label }}</strong>
        <small>{{ step.note }}</small>
      </div>
    </div>

    <p v-if="submitSuccess" class="inline-success" role="status">{{ submitSuccess }}</p>
    <div v-if="submitError" class="inline-error" role="alert">
      {{ submitError.summary }}：{{ submitError.detail }}
      <p v-if="Object.keys(serverFieldErrors).length" class="field-errors">字段错误：
        <span v-for="(messages, field) in serverFieldErrors" :key="field"><code>{{ field }}</code>: {{ messages.join('；') }}</span>
      </p>
    </div>

    <section v-if="!hasScenarios" class="setup-empty" aria-labelledby="missing-scenario-title">
      <span class="setup-empty__icon" aria-hidden="true"><i class="fa-solid fa-map-location-dot" /></span>
      <div>
        <h3 id="missing-scenario-title">先初始化运行场景</h3>
        <p>这个项目尚未绑定运行所需的审阅场景、治理方案与人口。点击初始化后，“冻结情景”即可选择。</p>
        <p v-if="bootstrapSuccess" class="setup-success" role="status">{{ bootstrapSuccess }}</p>
        <p v-if="bootstrapError" class="setup-error" role="alert">{{ bootstrapError }}</p>
      </div>
      <div class="setup-empty__actions">
        <button type="button" :disabled="access !== 'interactive' || bootstrapSubmitting" @click="emit('bootstrapProject')">
          {{ bootstrapSubmitting ? '初始化中…' : '初始化场景与治理方案' }}
        </button>
        <button type="button" class="secondary" :disabled="access !== 'interactive' || bootstrapSubmitting" @click="emit('openSection', 'scenarios')">手动创建场景</button>
      </div>
    </section>

    <form class="plan-form" novalidate @submit.prevent="submit">
      <label class="field">
        <span>冻结情景 <em aria-hidden="true">*</em></span>
        <select v-model="form.scenario_id" name="scenario_id" :disabled="access !== 'interactive' || !hasScenarios" :aria-invalid="Boolean(fieldError('scenario_id'))">
          <option value="" disabled>{{ hasScenarios ? '选择情景' : '尚未创建情景' }}</option>
          <option v-for="scenario in scenarios ?? []" :key="scenario.scenario_id" :value="scenario.scenario_id">
            {{ scenario.name }}{{ scenario.evidence_binding_status === 'sealed' ? '' : '（未封存）' }}
          </option>
        </select>
        <span v-if="hasScenarios" class="field-hint">仅列出当前项目中已经创建的情景；未封存项会明确标记。</span>
        <span v-if="fieldError('scenario_id')" class="field-error" role="alert">{{ fieldError('scenario_id') }}</span>
      </label>

      <aside class="provider-shortcut">
        <div><i class="fa-solid fa-key" aria-hidden="true" /><span><strong>模型调用配置</strong><small>在运行前填写 API Key、Base URL、模型名、并发、超时与推理模式。</small></span></div>
        <RouterLink to="/campus-pulse/system?tab=provider">配置模型与 API</RouterLink>
      </aside>

      <label class="field">
        <span>执行模式 <em aria-hidden="true">*</em></span>
        <select v-model="form.execution_mode" name="execution_mode" :disabled="access !== 'interactive'">
          <option v-for="(label, mode) in EXECUTION_MODE_LABELS" :key="mode" :value="mode">{{ label }}</option>
        </select>
      </label>

      <fieldset v-if="form.execution_mode === 'llm_forum_twin_v2'" class="field activation-modes">
        <legend>LLM 激活策略</legend>
        <label v-for="mode in FORUM_V2_ACTIVATION_MODES" :key="mode.code" class="activation-choice" :class="{ selected: form.forum_activation_mode === mode.code }">
          <input v-model="form.forum_activation_mode" type="radio" name="forum_activation_mode" :value="mode.code" />
          <span><strong>{{ mode.label }}</strong><small>{{ mode.description }}</small></span>
        </label>
        <label v-if="form.forum_activation_mode === 'full_population_keyframes'" class="field keyframes">
          <span>全量关键帧（0–23，逗号分隔）</span>
          <input v-model="form.forum_keyframe_ticks" name="forum_keyframe_ticks" type="text" />
          <span v-if="fieldError('forum_keyframe_ticks')" class="field-error">{{ fieldError('forum_keyframe_ticks') }}</span>
        </label>
        <div class="v2-boundary">
          <span><i class="fa-solid fa-ranking-star" /> 公共榜单全局一致</span>
          <span><i class="fa-solid fa-user-group" /> 合成关系影响打开与承接</span>
          <span><i class="fa-solid fa-comments" /> 公开表达与私聊均由 LLM 产生</span>
        </div>
        <section class="channel-contract" aria-labelledby="channel-contract-title">
          <header>
            <div><p>SOCIAL VISIBILITY HARNESS</p><h3 id="channel-contract-title">选择本次推演开放的社会交互机制</h3></div>
            <strong>同一小喇叭 · 四通道</strong>
          </header>
          <div class="channel-grid">
            <label class="channel-choice locked">
              <input type="checkbox" checked disabled />
              <span><b>公共论坛</b><small>全局热榜前十与最新帖；所有 Agent 排名一致</small></span>
            </label>
            <label class="channel-choice">
              <input v-model="form.forum_relationship_attention_enabled" type="checkbox" />
              <span><b>关系注意</b><small>关系只改变打开、通知和承接，不暗改公共排名</small></span>
            </label>
            <label class="channel-choice">
              <input v-model="form.forum_friend_chat_enabled" type="checkbox" />
              <span><b>好友私聊</b><small>公开帖子可转述给好友；私聊文字不提供给治理主体</small></span>
            </label>
            <label class="channel-choice" :class="{ disabled: !form.forum_friend_chat_enabled }">
              <input v-model="form.forum_dynamic_group_enabled" type="checkbox" :disabled="!form.forum_friend_chat_enabled" />
              <span><b>动态小群</b><small>邀请、接受、拒绝、退出与跨渠道 Claim 均保留时序</small></span>
            </label>
            <label class="channel-choice">
              <input v-model="form.forum_service_desk_enabled" type="checkbox" />
              <span><b>服务工单</b><small>求助、SLA、证据卡与可审计回执形成服务闭环</small></span>
            </label>
            <label class="channel-choice anonymity">
              <input v-model="form.forum_public_anonymity_enabled" type="checkbox" />
              <span><b>小喇叭可选匿名</b><small>仍是普通帖子/评论；怕熟人认出或表达敏感诉求时可隐藏作者头像</small></span>
            </label>
          </div>
          <p v-if="fieldError('forum_dynamic_group_enabled')" class="field-error" role="alert">{{ fieldError('forum_dynamic_group_enabled') }}</p>
          <p class="channel-note">匿名只改变公开作者显示，不创建第二个“树洞”；消息仍遵守同一热榜、回复、引用、Claim 与审核规则。</p>
        </section>
        <section class="world-contract" aria-labelledby="world-contract-title">
          <header>
            <div><p>AGENT WORLD CONTRACT</p><h3 id="world-contract-title">固定人口世界与事件利益叠加</h3></div>
            <strong>1,000 <small>persistent Agents</small></strong>
          </header>
          <div class="world-contract__stats">
            <span><b>17</b> 宏观角色</span><span><b>120</b> 微角色</span><span><b>8,000</b> 合成关系</span><span><b>10,000</b> 状态粒子</span>
          </div>
          <p>Profile、Persona、记忆种子和关系世界固定；所选事件只叠加资源需求、直接影响、时间紧迫性、申诉成本等情景利益位置。</p>
          <div class="world-mechanisms">
            <span><i class="fa-solid fa-check" /> 关系注意</span>
            <span><i class="fa-solid fa-check" /> 好友私聊</span>
            <span><i class="fa-solid fa-check" /> 动态小群</span>
            <span><i class="fa-solid fa-check" /> 跨群桥接</span>
            <span><i class="fa-solid fa-check" /> 七类风险雷达</span>
            <span><i class="fa-solid fa-check" /> 三主体有限观测治理</span>
          </div>
        </section>
        <section class="activation-contract" aria-labelledby="activation-contract-title">
          <header><div><p>ACTIVATION SCHEDULER</p><h3 id="activation-contract-title">风险感知 · 关系承接 · 分层轮换 PPS</h3></div></header>
          <div class="activation-pipeline"><span><b>01</b>16 个纵向锚点</span><i class="fa-solid fa-arrow-right"/><span><b>02</b>回复 / 纠错 / 求助 / 私聊队列</span><i class="fa-solid fa-arrow-right"/><span><b>03</b>设计权重 × 不确定性 × 轮换</span></div>
          <div class="budget-strip" aria-label="24 个时间步的居民 LLM 激活上限">
            <i v-for="(budget,tick) in forumV2TickBudgets" :key="tick" :style="{ height:`${Math.max(10, budget / forumV2PeakBudget * 100)}%` }" :title="`Tick ${tick}: ${budget} Agent`"><span>{{ tick }}</span></i>
          </div>
          <p>私聊来源最多占非 Anchor 名额的 40%；溢出进入下一 Tick，Dynamics 不代写任何公开或私聊文本。</p>
        </section>
      </fieldset>

      <fieldset class="field policies" aria-label="政策方案">
        <legend>政策方案 <em aria-hidden="true">*</em></legend>
        <p v-if="!selectablePolicies.length" class="muted">当前情景/模式没有可用政策方案（白名单）。</p>
        <label v-for="policy in selectablePolicies" :key="policy.policy_id" class="choice">
          <input v-model="form.policy_ids" type="checkbox" :value="policy.policy_id" :disabled="access !== 'interactive'" />
          <span>{{ policy.name }}</span>
        </label>
        <span v-if="fieldError('policy_ids')" class="field-error" role="alert">{{ fieldError('policy_ids') }}</span>
      </fieldset>

      <div class="form-grid">
        <label class="field">
          <span>{{ isForumV2 ? '固定人口世界' : 'Agent 数量' }}</span>
          <input v-model.number="form.agent_count" type="number" name="agent_count" min="1" max="1000" :readonly="isForumV2" :disabled="access !== 'interactive'" />
          <span v-if="isForumV2" class="field-hint">人口不随项目复制或重建；预算模式只改变本 Tick 激活人数。</span>
          <span v-if="fieldError('agent_count')" class="field-error" role="alert">{{ fieldError('agent_count') }}</span>
        </label>
        <label class="field">
          <span>最大 Worker</span>
          <input v-model.number="form.max_workers" type="number" name="max_workers" min="1" max="48" :disabled="access !== 'interactive'" />
          <span v-if="fieldError('max_workers')" class="field-error" role="alert">{{ fieldError('max_workers') }}</span>
        </label>
        <label class="field">
          <span>模型</span>
          <input v-model="form.model_name" type="text" name="model_name" :disabled="access !== 'interactive'" />
          <span v-if="fieldError('model_name')" class="field-error" role="alert">{{ fieldError('model_name') }}</span>
        </label>
        <label class="field">
          <span>种子（逗号分隔）</span>
          <input v-model="form.seeds" type="text" name="seeds" :disabled="access !== 'interactive'" />
          <span v-if="fieldError('seeds')" class="field-error" role="alert">{{ fieldError('seeds') }}</span>
        </label>
        <label class="field">
          <span>Token 预算</span>
          <input v-model.number="form.token_budget" type="number" name="token_budget" min="1000" step="1000" :disabled="access !== 'interactive'" />
          <span v-if="fieldError('token_budget')" class="field-error" role="alert">{{ fieldError('token_budget') }}</span>
          <span v-else-if="!budgetContract.ok" class="field-error" role="alert">{{ budgetContract.reason }}</span>
        </label>
      </div>

      <div class="form-actions">
        <button type="submit" class="primary" :disabled="!canSubmit || submitting">
          {{ submitting ? '提交中…' : '冻结运行计划' }}
        </button>
        <p v-if="!canSubmit && access === 'interactive'" class="submit-note">
          就绪项全部满足后即可提交；未满足项已在上方标出。
        </p>
      </div>
    </form>

    <section v-if="contract" class="contract-preview" aria-labelledby="contract-title">
      <header>
        <div>
          <h3 id="contract-title">服务端冻结合同</h3>
        </div>
        <CpStatusBadge :tone="contract.serverProvided ? 'evidence' : 'warning'">
          {{ contract.serverProvided ? '已由服务端冻结' : '待服务端冻结' }}
        </CpStatusBadge>
      </header>
      <dl>
        <div><dt>执行模式</dt><dd>{{ EXECUTION_MODE_LABELS[contract.executionMode] || contract.executionMode }}</dd></div>
        <div><dt>人口发布</dt><dd><code>{{ populationReleaseForMode(form.execution_mode) }}</code></dd></div>
        <div v-if="contract.population !== null"><dt>LLM Agent 人口</dt><dd>{{ formatBudget(contract.population) }}</dd></div>
        <div v-if="contract.tickCount !== null"><dt>时间步</dt><dd>{{ formatBudget(contract.tickCount) }}</dd></div>
        <div><dt>主槽位</dt><dd>{{ formatBudget(contract.primarySlots) }}</dd></div>
        <div v-if="contract.residentSlots !== null"><dt>居民槽位</dt><dd>{{ formatBudget(contract.residentSlots) }}</dd></div>
        <div v-if="contract.governanceActorSlots !== null"><dt>治理主体槽位</dt><dd>{{ formatBudget(contract.governanceActorSlots) }}</dd></div>
        <div><dt>请求上限</dt><dd>{{ formatBudget(contract.requestLimit) }}</dd></div>
        <div><dt>Token 上限</dt><dd>{{ formatBudget(contract.tokenLimit) }}</dd></div>
        <div v-if="contract.activationMode"><dt>激活策略</dt><dd>{{ FORUM_V2_ACTIVATION_MODES.find((item) => item.code === contract.activationMode)?.label || contract.activationMode }}</dd></div>
        <div v-if="contract.activationMode"><dt>关键帧</dt><dd>{{ contract.keyframeTicks.length ? contract.keyframeTicks.join(' / ') : '无' }}</dd></div>
        <div v-if="contract.privateChatEnabled !== null"><dt>关系与私聊</dt><dd>{{ contract.relationshipEnabled && contract.privateChatEnabled ? '已启用' : '未启用' }}</dd></div>
        <div v-if="contract.dynamicGroupsEnabled !== null"><dt>动态小群</dt><dd>{{ contract.dynamicGroupsEnabled ? '已启用' : '未启用' }}</dd></div>
        <div v-if="contract.serviceDeskEnabled !== null"><dt>服务工单</dt><dd>{{ contract.serviceDeskEnabled ? '已启用' : '未启用' }}</dd></div>
        <div v-if="contract.publicAnonymityEnabled !== null"><dt>小喇叭匿名</dt><dd>{{ contract.publicAnonymityEnabled ? '公开发言可选匿名' : '仅实名显示' }}</dd></div>
        <div v-if="contract.residentTurnSchemaVersion"><dt>居民输出合同</dt><dd><code>{{ contract.residentTurnSchemaVersion }}</code></dd></div>
        <div v-if="contract.publicRankingGlobal !== null"><dt>公共榜单</dt><dd>{{ contract.publicRankingGlobal ? '全局热榜前十 + 最新帖' : '合同不匹配' }}</dd></div>
        <div><dt>输入指纹</dt><dd><code>{{ contract.fingerprint ? contract.fingerprint.slice(0, 16) + '…' : '—' }}</code></dd></div>
      </dl>
      <aside v-if="contract.activationMode" class="v2-contract-detail" aria-label="输出与执行设置">
        <div>
          <strong>语言输出合同</strong>
          <span v-if="contract.publicMessagesPerAgentTickMax !== null && contract.privateActionsPerAgentTickMax !== null && contract.publicInteractionsPerAgentTickMax !== null">每名 Agent 每 Tick 最多 {{ contract.publicMessagesPerAgentTickMax }} 条公开消息、{{ contract.privateActionsPerAgentTickMax }} 个私聊动作和 {{ contract.publicInteractionsPerAgentTickMax }} 个独立互动。</span>
          <span v-else>待服务端冻结输出上限。</span>
        </div>
        <div v-if="contract.publicAnonymityEnabled !== null">
          <strong>公开作者显示</strong>
          <span>{{ contract.publicAnonymityEnabled ? 'Agent 可依人物、议题敏感度和被熟人识别成本，在同一小喇叭帖子/评论中选择实名或匿名。' : '本次计划不允许匿名显示。' }}</span>
        </div>
        <div>
          <strong>确定性提交</strong>
          <span>{{ contract.sameTickTwoPhaseCommit ? '同一 Tick 先冻结所有输入，再统一提交；并发返回顺序不改变下一 Tick。' : '待服务端冻结提交合同。' }}</span>
        </div>
        <div>
          <strong>私聊激活配额</strong>
          <span v-if="contract.privateOriginShareMax !== null">私聊来源最多占非 Anchor 槽位的 {{ Math.round(contract.privateOriginShareMax * 100) }}%；{{ contract.privateOverflowCarries ? '超额互动延至下一 Tick' : '超额处理未冻结' }}。</span>
          <span v-else>待服务端冻结私聊配额。</span>
        </div>
        <div>
          <strong>调用批次</strong>
          <span>{{ providerBatches === null ? '待服务端冻结槽位' : `按当前并发上限至少 ${providerBatches.toLocaleString('zh-CN')} 批` }}；实际耗时由 Provider 延迟决定。</span>
        </div>
        <div>
          <strong>公开导出</strong>
          <span>仅发布论坛聚合、七类风险、治理决策和经审阅摘录；不导出私聊原文、成员身份或关系边。</span>
        </div>
        <div v-if="contract.dynamicsGeneratesLanguage !== null">
          <strong>Dynamics 语言</strong>
          <span>{{ contract.dynamicsGeneratesLanguage ? '合同异常：允许生成语言' : '严格为 0；所有公开与私聊文字来自 LLM / exact replay' }}</span>
        </div>
      </aside>
      <p v-if="plannedRun" class="contract-actions">
        <button type="button" class="link" @click="emit('openRun', plannedRun.run_id)">查看该运行（入队 / 监控）</button>
        <span class="muted">计划已冻结；当前没有调用模型，也没有消耗 Token。</span>
      </p>
    </section>
  </section>
</template>

<style scoped>
.plan-panel { display:grid; gap:var(--cp-space-4); }
.panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.panel-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.panel-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.refresh { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.refresh:disabled { opacity:.5; cursor:not-allowed; }
.readonly-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.readiness { display:grid; grid-template-columns:repeat(auto-fit,minmax(11rem,1fr)); gap:var(--cp-space-2); }
.readiness-step { display:grid; gap:var(--cp-space-1); padding:var(--cp-space-3); border:1px solid var(--cp-border-default); }
.readiness-step.ok { border-left:3px solid var(--cp-success); }
.readiness-step.bad { border-left:3px solid var(--cp-warning); }
.readiness-step .dot { width:.55rem; height:.55rem; border-radius:50%; background:var(--cp-border-strong); }
.readiness-step.ok .dot { background:var(--cp-success); }
.readiness-step.bad .dot { background:var(--cp-warning); }
.readiness-step strong { font-size:var(--cp-text-sm); }
.readiness-step small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.inline-error, .inline-success { margin:0; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.inline-success { border-color:var(--cp-success); background:var(--cp-success-surface); color:var(--cp-success); }
.setup-empty { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid color-mix(in srgb,var(--cp-warning) 45%,var(--cp-border-default)); border-radius:var(--cp-radius-md); background:var(--cp-warning-surface); }
.setup-empty__icon { display:grid; width:2.6rem; height:2.6rem; place-items:center; border-radius:50%; background:var(--cp-surface-default); color:var(--cp-warning); }
.setup-empty h3,.setup-empty p { margin:0; }
.setup-empty h3 { font-size:var(--cp-text-md); }
.setup-empty p { margin-top:var(--cp-space-1); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.55; }
.setup-empty button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-action-primary); border-radius:var(--cp-radius-sm); background:var(--cp-action-primary); color:var(--cp-surface-default); font-weight:700; cursor:pointer; }
.setup-empty__actions { display:grid; gap:var(--cp-space-2); }
.setup-empty button.secondary { border-color:var(--cp-border-strong); background:transparent; color:var(--cp-text-primary); }
.setup-empty .setup-success { color:var(--cp-success); font-weight:650; }
.setup-empty .setup-error { color:var(--cp-danger); font-weight:650; }
.setup-empty button:disabled { opacity:.5; cursor:not-allowed; }
.field-errors { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xs); }
.field-errors span { display:block; }
.plan-form { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); }
.field { display:grid; gap:var(--cp-space-1); }
.field > span, .field legend { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.field em { color:var(--cp-danger); font-style:normal; }
.field select, .field input { min-height:var(--cp-control-height); padding:var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.field:disabled, .field select:disabled, .field input:disabled { opacity:.6; }
.field-hint { color:var(--cp-text-muted) !important; font-size:var(--cp-text-xs) !important; font-weight:500 !important; }
.provider-shortcut { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); background:var(--cp-surface-subtle); }
.provider-shortcut > div { display:flex; min-width:0; align-items:center; gap:var(--cp-space-3); }
.provider-shortcut > div > i { display:grid; width:2.15rem; height:2.15rem; flex:none; place-items:center; border-radius:50%; background:var(--cp-surface-selected); color:var(--cp-action-primary); }
.provider-shortcut span { display:grid; gap:.1rem; }
.provider-shortcut strong { font-size:var(--cp-text-sm); }
.provider-shortcut small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.provider-shortcut a { flex:none; color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:700; }
.policies { margin:0; padding:0; border:0; }
.policies legend { padding:0; }
.activation-modes { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--cp-space-2); padding:0; border:0; }
.activation-modes > legend { grid-column:1/-1; }
.activation-choice { display:grid; grid-template-columns:auto 1fr; align-items:start; gap:var(--cp-space-2); min-height:6rem; padding:var(--cp-space-3); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); cursor:pointer; }
.activation-choice.selected { border-color:var(--cp-action-primary); background:var(--cp-surface-selected); box-shadow:inset 0 0 0 1px var(--cp-action-primary); }
.activation-choice span { display:grid; gap:var(--cp-space-1); }
.activation-choice strong { color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.activation-choice small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.5; }
.activation-modes .keyframes,.v2-boundary { grid-column:1/-1; }
.v2-boundary { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); padding:var(--cp-space-3); background:var(--cp-surface-subtle); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.v2-boundary span { display:inline-flex; align-items:center; gap:.35rem; }
.world-contract,.activation-contract,.channel-contract { grid-column:1/-1; padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:linear-gradient(145deg,var(--cp-surface-default),var(--cp-surface-subtle)); }
.world-contract header,.activation-contract header,.channel-contract header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.world-contract header p,.activation-contract header p,.channel-contract header p { margin:0 0 .3rem; color:var(--cp-action-primary); font:750 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.1em; }
.world-contract h3,.activation-contract h3,.channel-contract h3 { margin:0; font-size:var(--cp-text-md); }
.channel-contract header>strong { padding:.35rem .55rem; border:1px solid var(--cp-border-subtle); color:var(--cp-text-secondary); font:650 var(--cp-text-xs)/1.2 var(--cp-font-mono); }
.channel-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--cp-space-2); margin-top:var(--cp-space-3); }
.channel-choice { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:start; gap:var(--cp-space-2); min-height:4.3rem; padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-default); cursor:pointer; }
.channel-choice:has(input:checked) { border-color:color-mix(in srgb,var(--cp-action-primary) 55%,var(--cp-border-default)); background:var(--cp-surface-selected); }
.channel-choice.locked,.channel-choice.disabled { cursor:default; opacity:.68; }
.channel-choice.anonymity { border-left:3px solid var(--cp-action-primary); }
.channel-choice span { display:grid; gap:.25rem; }
.channel-choice b { font-size:var(--cp-text-sm); }
.channel-choice small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.45; }
.channel-note { margin:var(--cp-space-3) 0 0; padding-top:var(--cp-space-2); border-top:1px solid var(--cp-border-subtle); color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.55; }
.world-contract header>strong { color:var(--cp-action-primary); font-size:2rem; }
.world-contract header small { display:block; color:var(--cp-text-muted); font:600 var(--cp-text-xs)/1.2 var(--cp-font-mono); }
.world-contract__stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; margin-top:var(--cp-space-3); background:var(--cp-border-subtle); }
.world-contract__stats span { display:grid; padding:var(--cp-space-2); background:var(--cp-surface-default); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.world-contract__stats b { color:var(--cp-text-primary); font-size:var(--cp-text-lg); }
.world-contract>p,.activation-contract>p { margin:var(--cp-space-3) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.6; }
.world-mechanisms { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); margin-top:var(--cp-space-3); }
.world-mechanisms span { display:inline-flex; align-items:center; gap:.35rem; padding:.4rem .55rem; border:1px solid var(--cp-border-subtle); background:var(--cp-surface-default); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.world-mechanisms i { color:var(--cp-success); }
.activation-contract header code { padding:.35rem .5rem; border:1px solid var(--cp-border-subtle); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.activation-pipeline { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-2); margin-top:var(--cp-space-3); }
.activation-pipeline span { display:flex; align-items:center; gap:.45rem; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.activation-pipeline b { display:grid; width:1.6rem; height:1.6rem; place-items:center; border-radius:50%; background:var(--cp-text-primary); color:var(--cp-surface-default); font:700 .6rem var(--cp-font-mono); }
.activation-pipeline>i { color:var(--cp-border-strong); font-size:var(--cp-text-xs); }
.budget-strip { display:flex; align-items:flex-end; gap:3px; height:5rem; margin:var(--cp-space-4) 0 1.35rem; padding-top:.4rem; border-bottom:1px solid var(--cp-border-strong); }
.budget-strip>i { position:relative; min-width:4px; flex:1; background:linear-gradient(180deg,var(--cp-action-primary),color-mix(in srgb,var(--cp-action-primary) 35%,var(--cp-surface-subtle))); transition:height .25s; }
.budget-strip span { position:absolute; bottom:-1.2rem; left:50%; color:var(--cp-text-muted); font:500 .5rem var(--cp-font-mono); transform:translateX(-50%); }
.field input:read-only { border-style:dashed; background:var(--cp-surface-subtle); color:var(--cp-text-secondary); }
.choice { display:flex; align-items:center; gap:var(--cp-space-2); padding:var(--cp-space-1) 0; font-size:var(--cp-text-sm); }
.muted { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.field-error { color:var(--cp-danger); font-size:var(--cp-text-xs); }
.form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(12rem,1fr)); gap:var(--cp-space-3); }
.form-actions { display:flex; flex-direction:column; gap:var(--cp-space-1); }
.form-actions .primary { min-height:var(--cp-control-height); padding:0 var(--cp-space-4); border:1px solid var(--cp-action-primary); border-radius:var(--cp-radius-sm); background:var(--cp-action-primary); color:var(--cp-surface-default); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.form-actions .primary:hover { background:var(--cp-action-primary-hover); }
.form-actions .primary:disabled { opacity:.5; cursor:not-allowed; }
.submit-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.contract-preview { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-evidence); background:var(--cp-evidence-surface); }
.contract-preview header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.contract-preview header p { margin:0; color:var(--cp-evidence-text); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.contract-preview h3 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-md); }
.contract-preview dl { display:grid; grid-template-columns:repeat(auto-fit,minmax(10rem,1fr)); gap:var(--cp-space-2); margin:0; }
.v2-contract-detail { display:grid; grid-template-columns:repeat(auto-fit,minmax(13rem,1fr)); gap:1px; margin-top:var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-border-subtle); }
.v2-contract-detail div { display:grid; gap:var(--cp-space-1); padding:var(--cp-space-3); background:var(--cp-surface-default); }
.v2-contract-detail strong { font-size:var(--cp-text-xs); }
.v2-contract-detail span { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.55; }
.contract-preview dl div { padding:var(--cp-space-2) var(--cp-space-3); background:var(--cp-surface-default); border:1px solid var(--cp-border-subtle); }
.contract-preview dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.contract-preview dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; font-variant-numeric:tabular-nums; }
.contract-actions { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-2); margin:0; }
.link { border:0; padding:0; background:none; color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:650; text-decoration:underline; cursor:pointer; }
@media (max-width:767px) { .form-grid,.activation-modes,.channel-grid { grid-template-columns:1fr; } .setup-empty { grid-template-columns:auto 1fr; } .setup-empty button { grid-column:1 / -1; width:100%; } .provider-shortcut { align-items:flex-start; flex-direction:column; } .world-contract__stats { grid-template-columns:1fr 1fr; } .activation-pipeline { align-items:stretch; flex-direction:column; } .activation-pipeline>i { align-self:center; transform:rotate(90deg); } .activation-contract header,.channel-contract header { flex-direction:column; } }
</style>
