<script setup>
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import {
  cancelRun,
  downloadRunAggregateReport,
  enqueueRun,
  getLiveRuntimeCapability,
  getRunAggregateResult,
  getRunRuntime,
  listRunRuntimeEvents,
  readableApiError,
} from '../../services/campusPulseApi'
import {
  YULAN_AGGREGATE_SCHEMA,
  YULAN_EXECUTION_MODE,
} from '../../services/yuLanScaleAdapter'
import EvidenceBadge from './EvidenceBadge.vue'

const props = defineProps({
  run: {
    type: Object,
    required: true,
  },
  scenario: {
    type: Object,
    default: null,
  },
  policies: {
    type: Array,
    default: () => [],
  },
  connected: {
    type: Boolean,
    default: false,
  },
  runtimeAdapterMode: {
    type: String,
    default: 'disabled',
  },
})

const emit = defineEmits(['runtime-updated'])

const RUNTIME_STATES = [
  'queued',
  'leased',
  'running',
  'cancel_requested',
  'succeeded',
  'failed',
  'cancelled',
]
const ACTIVE_STATES = new Set([
  'queued',
  'leased',
  'running',
  'cancel_requested',
])
const TERMINAL_STATES = new Set(['succeeded', 'failed', 'cancelled'])
const STATUS_LABELS = {
  draft: '尚未入队',
  queued: '等待 Worker',
  leased: '已领取',
  running: '执行中',
  cancel_requested: '正在安全取消',
  succeeded: '已完成',
  failed: '执行失败',
  cancelled: '已取消',
}
const EVENT_LABELS = {
  run_queued: '运行已入队',
  runtime_enqueued: '运行已入队',
  lease_claimed: 'Worker 已领取',
  execution_started: '开始执行',
  progress_recorded: '安全进度检查点',
  lease_expired_requeued: '租约过期并恢复排队',
  lease_expired_failed: '租约重试预算耗尽',
  cancel_requested: '收到取消请求',
  run_cancelled: '已安全取消',
  run_failed: '执行失败',
  run_succeeded: '聚合结果已原子封存',
}
const SAFE_EVENT_TYPES = new Set(Object.keys(EVENT_LABELS))
const POLL_DELAYS = [1500, 2500, 4000, 6500, 8000]
const FORMAL_SCENARIOS = {
  tongzhou_governance_notice_v2: new Set([
    'natural_evolution_v2',
    'combined_governance_v2',
  ]),
  lecture_external_incident_v2: new Set([
    'natural_evolution_v2',
  ]),
}
const AGGREGATE_RESULT_V2_SCHEMA = 'campus-pulse-live-aggregate-result-v2'
const GOVERNANCE_RESULT_V4_SCHEMA = 'campus-pulse-live-aggregate-result-v4'
const YULAN_RESULT_KIND = 'budgeted_llm_agent_population_simulation'
const FORUM_TWIN_EXECUTION_MODE = 'llm_forum_twin'
const FORUM_TWIN_RESULT_SCHEMA = 'campus-pulse-live-aggregate-result-v6'
const FORUM_TWIN_RESULT_KIND = 'llm_forum_twin_simulation'
const EXPECTED_AGGREGATE_V2_BOUNDARY = Object.freeze({
  result_kind: 'model_conditional_simulation',
  causal_status: 'not_identified',
  forecast_status: 'not_forecast',
  population_status: 'not_population_estimate',
  individual_status: 'not_individual_truth',
  observed_status: 'not_observed_opinion',
  real_time_status: 'not_real_time',
})
const AGGREGATE_V2_BOUNDARY_LABELS = Object.freeze({
  causal_status: '因果',
  forecast_status: '预测',
  population_status: '总体民意',
  individual_status: '个体事实',
  observed_status: '观测舆情',
  real_time_status: '实时性',
})
const AGGREGATE_V2_POLICY_LABELS = Object.freeze({
  natural_evolution_v2: '自然演化',
  combined_governance_v2: '组合治理',
  shared_calibration_baseline: '共享校准基线',
})
const CAPABILITY_STATE_LABELS = {
  qualified: '资格已安装',
  not_installed: '未安装',
  enabled: '已启用',
  disabled: '未启用',
  installed: '已安装',
  ready: 'ready',
  missing: '授权缺失',
  expired: '授权已过期',
  revoked: '授权已撤销',
  consumed_for_launch: '已绑定本次启动',
  not_live_plan: '非Live计划',
  not_applicable: '不适用',
}
const POSITIVE_CAPABILITY_STATES = new Set([
  'qualified',
  'enabled',
  'installed',
  'ready',
  'consumed_for_launch',
])
const NEUTRAL_CAPABILITY_STATES = new Set([
  'not_live_plan',
  'not_applicable',
])

const runtime = ref(props.run?.runtime_summary || null)
const events = ref([])
const result = ref(null)
const loading = ref(false)
const actionPending = ref('')
const connectionError = ref('')
const eventError = ref('')
const resultError = ref('')
const resultUnavailable = ref(false)
const actionNotice = ref('')
const actionError = ref('')
const reportDownloadPending = ref('')
const reportDownloadNotice = ref('')
const reportDownloadError = ref('')
const reportDownloadUnavailable = ref(false)
const liveCapability = ref(null)
const liveCapabilityLoading = ref(false)
const liveCapabilityError = ref('')
const pollAttempt = ref(0)
const lastRefreshedAt = ref(null)

let pollTimer = null
let requestGeneration = 0
let launchRequest = null

const runtimeRecord = computed(() => (
  runtime.value?.runtime
  || runtime.value?.runtime_state
  || runtime.value
  || null
))
const isYuLanScaleRun = computed(
  () => props.run?.execution_mode === YULAN_EXECUTION_MODE,
)
const isForumTwinRun = computed(
  () => props.run?.execution_mode === FORUM_TWIN_EXECUTION_MODE,
)

const runtimeStatus = computed(() => {
  const value = runtimeRecord.value?.status
    || runtimeRecord.value?.runtime_status
  return RUNTIME_STATES.includes(value) ? value : 'draft'
})

const stateVersion = computed(() => numberOrNull(
  runtimeRecord.value?.state_version
  ?? runtimeRecord.value?.version,
))

const progressRecord = computed(() => (
  runtimeRecord.value?.progress
  || runtimeRecord.value?.budget_usage
  || {}
))

const launchContract = computed(() => (
  runtimeRecord.value?.launch_contract
  || runtime.value?.launch_contract
  || {}
))

const completedTurns = computed(() => numberOrNull(
  runtimeRecord.value?.turns_completed
  ?? runtimeRecord.value?.completed_turns
  ?? progressRecord.value?.completed_turns
  ?? progressRecord.value?.turns_completed
  ?? progressRecord.value?.completed_work_units,
))

const serverTurnLimit = computed(() => numberOrNull(
  runtimeRecord.value?.turn_limit
  ?? launchContract.value?.turn_limit
  ?? progressRecord.value?.turn_limit
  ?? progressRecord.value?.required_work_units,
))

const tokenLimit = computed(() => numberOrNull(
  runtimeRecord.value?.token_limit
  ?? launchContract.value?.token_limit
  ?? props.run?.token_budget,
))

const consumedTokens = computed(() => numberOrNull(
  runtimeRecord.value?.provider_tokens
  ?? runtimeRecord.value?.tokens_used
  ?? runtimeRecord.value?.tokens_consumed
  ?? runtimeRecord.value?.consumed_tokens
  ?? runtimeRecord.value?.provider_reported_or_reserved_tokens
  ?? progressRecord.value?.consumed_tokens
  ?? progressRecord.value?.tokens_used
  ?? progressRecord.value?.tokens_consumed
  ?? progressRecord.value?.token_usage
  ?? progressRecord.value?.total_tokens,
))

const effectiveConcurrency = computed(() => numberOrNull(
  runtimeRecord.value?.effective_concurrency_limit
  ?? launchContract.value?.effective_concurrency_limit
  ?? runtimeRecord.value?.effective_concurrency,
))

const attemptsUsed = computed(() => numberOrNull(
  runtimeRecord.value?.attempts_used
  ?? runtimeRecord.value?.attempt_count
  ?? runtime.value?.attempt_count,
))

const maxAttempts = computed(() => numberOrNull(
  runtimeRecord.value?.max_attempts
  ?? launchContract.value?.max_attempts,
))

const currentStage = computed(() => {
  const seed = runtimeRecord.value?.current_seed
    ?? progressRecord.value?.current_seed
  const policy = runtimeRecord.value?.current_policy_id
    ?? runtimeRecord.value?.current_policy
    ?? progressRecord.value?.current_policy
  const phase = runtimeRecord.value?.current_phase_id
    ?? runtimeRecord.value?.current_phase
    ?? progressRecord.value?.current_phase
  return [seed === undefined ? '' : `种子 ${seed}`, policy, phase]
    .filter(Boolean)
    .join(' · ')
})

const runPolicies = computed(() => {
  const selectedIds = new Set(props.run?.policy_ids || [])
  return props.policies.filter((policy) => selectedIds.has(policy.policy_id))
})

const policyTemplateKeys = computed(
  () => runPolicies.value.map((policy) => policy.template_key).filter(Boolean),
)

const runtimeEligibility = computed(() => {
  if (props.runtimeAdapterMode !== 'deterministic_fake') {
    return {
      eligible: false,
      reason: '服务器尚未显式启用 P3.1 确定性测试 Worker；当前只能查看既有运行，不能把测试夹具冒充治理结果。',
    }
  }
  const governanceV2 = (
    props.run?.execution_mode === 'adaptive_particle_population'
  )
  const yuLanScale = props.run?.execution_mode === YULAN_EXECUTION_MODE
  const forumTwin = props.run?.execution_mode === FORUM_TWIN_EXECUTION_MODE
  const expectedPlanSchema = forumTwin
    ? 'campus-pulse-run-plan-v8'
    : yuLanScale
      ? 'campus-pulse-run-plan-v7'
    : governanceV2
      ? 'campus-pulse-run-plan-v6'
      : 'campus-pulse-run-plan-v3'
  if (props.run?.input_snapshot?.schema_version !== expectedPlanSchema) {
    return {
      eligible: false,
      reason: `只有完整冻结的 ${expectedPlanSchema} 可以进入对应运行时。`,
    }
  }
  if (props.run?.execution_mode === 'live_llm') {
    return {
      eligible: false,
      reason: 'P3.1 明确禁用真实 LLM 适配器；本运行不会由公开 API 启用模型调用。',
    }
  }
  if (
    props.run?.evidence_binding_status
    && props.run.evidence_binding_status !== 'sealed'
  ) {
    return {
      eligible: false,
      reason: '运行缺少封存的源证据绑定。',
    }
  }
  if (
    props.run?.sensing_binding_status
    && props.run.sensing_binding_status !== 'sealed'
  ) {
    return {
      eligible: false,
      reason: '运行缺少封存的民意感知绑定。',
    }
  }
  const scenarioKey = props.scenario?.template_key
  const allowed = FORMAL_SCENARIOS[scenarioKey]
  if (!allowed) {
    return {
      eligible: false,
      reason: 'P3.1 只执行通州治理冲击与讲座外生事件两套正式模板。',
    }
  }
  if (
    !policyTemplateKeys.value.length
    || policyTemplateKeys.value.some(
      (key) => (
          governanceV2 || yuLanScale || forumTwin
          ? !new Set([
            'natural_evolution_v2',
            'combined_governance_v2',
          ]).has(key)
          : !allowed.has(key)
      ),
    )
    || (
      (governanceV2 || yuLanScale || forumTwin)
      && new Set(policyTemplateKeys.value).size !== 2
    )
  ) {
    return {
      eligible: false,
      reason: forumTwin
        ? 'ForumTwin v8 只接受冻结的自然 + 组合治理包装策略；五个内部论坛分支由执行器统一评估。'
        : yuLanScale
        ? 'YuLan-Scale v7 只接受冻结的自然 + 组合包装策略，并由内核评估五个分支。'
        : scenarioKey === 'lecture_external_incident_v2'
        ? '讲座外生事件在 P3.1 只允许“自然演化”基线。'
        : '通州治理冲击只允许“自然演化”和“组合治理”正式方案。',
    }
  }
  return {
    eligible: true,
    reason: forumTwin
      ? 'YuLan ForumTwin v1 · 1,000 LLM agents · 10,000 粒子 · 16,544 slots · 单轮≤67'
      : yuLanScale
      ? 'YuLan-Scale v1 · 1,000 LLM agents · 10,000 粒子 · 1,728 population_branch_tick'
      : governanceV2
      ? 'Governance Arena v2 · 1,728 population_branch_tick · ZERO PROVIDER'
      : scenarioKey === 'lecture_external_incident_v2'
      ? '讲座外生事件 · 仅自然演化基线'
      : '通州治理冲击 · 自然演化 / 组合治理白名单',
  }
})

const livePlanContract = computed(() => liveCapability.value?.plan || null)
const liveAuthorization = computed(
  () => liveCapability.value?.authorization || {},
)
const liveClaimBoundary = computed(
  () => liveCapability.value?.claim_boundary || {},
)
const qualificationProviderCalls = computed(() => numberOrNull(
  liveCapability.value?.provider_calls_performed,
))

const plannedTurnLimit = computed(() => {
  if (
    props.run?.execution_mode === 'adaptive_particle_population'
    || props.run?.execution_mode === YULAN_EXECUTION_MODE
  ) {
    return 1_728
  }
  if (props.run?.execution_mode === FORUM_TWIN_EXECUTION_MODE) return 16_544
  const agents = numberOrNull(props.run?.agent_count)
  const seeds = Array.isArray(props.run?.seeds) ? props.run.seeds.length : 0
  const policies = Array.isArray(props.run?.policy_ids)
    ? props.run.policy_ids.length
    : 0
  if (!agents || !seeds || !policies) return null
  return agents * seeds * (1 + 3 * policies)
})

const empiricalTokenEstimate = computed(() => {
  if (props.run?.execution_mode === 'adaptive_particle_population') return 0
  if (props.run?.execution_mode === YULAN_EXECUTION_MODE) return 40_000_000
  if (props.run?.execution_mode === FORUM_TWIN_EXECUTION_MODE) return 80_000_000
  if (!plannedTurnLimit.value) return null
  const tokensPerTurn = (props.run?.policy_ids?.length || 0) >= 2
    ? 2527
    : 2300
  return Math.round(plannedTurnLimit.value * tokensPerTurn)
})

const recommendedTokenBudget = computed(() => {
  if (props.run?.execution_mode === 'adaptive_particle_population') return 1_000
  if (props.run?.execution_mode === YULAN_EXECUTION_MODE) return 40_000_000
  if (props.run?.execution_mode === FORUM_TWIN_EXECUTION_MODE) return 80_000_000
  if (!empiricalTokenEstimate.value) return null
  return Math.ceil(empiricalTokenEstimate.value * 1.15 / 100000) * 100000
})

const progressPercent = computed(() => {
  if (
    completedTurns.value === null
    || serverTurnLimit.value === null
    || serverTurnLimit.value <= 0
  ) return null
  return Math.min(
    100,
    Math.max(0, completedTurns.value / serverTurnLimit.value * 100),
  )
})

const tokenPercent = computed(() => {
  if (
    consumedTokens.value === null
    || tokenLimit.value === null
    || tokenLimit.value <= 0
  ) return null
  return Math.min(
    100,
    Math.max(0, consumedTokens.value / tokenLimit.value * 100),
  )
})

const isActive = computed(() => ACTIVE_STATES.has(runtimeStatus.value))
const isTerminal = computed(() => TERMINAL_STATES.has(runtimeStatus.value))
const canEnqueue = computed(() => (
  runtimeStatus.value === 'draft'
  && runtimeEligibility.value.eligible
  && props.connected
  && !actionPending.value
))
const canCancel = computed(() => (
  ['queued', 'leased', 'running', 'cancel_requested'].includes(
    runtimeStatus.value,
  )
  && props.connected
  && !actionPending.value
))

const resultBody = computed(() => (
  result.value?.result
  || result.value?.aggregate
  || result.value
  || null
))

const isAggregateResultV2 = computed(() => (
  resultBody.value?.schema_version === AGGREGATE_RESULT_V2_SCHEMA
))
const isGovernanceV2Result = computed(() => (
  resultBody.value?.schema_version === GOVERNANCE_RESULT_V4_SCHEMA
  && resultBody.value?.result_kind
    === 'adaptive_particle_population_model_conditional_simulation'
))
const isYuLanScaleResult = computed(() => (
  resultBody.value?.schema_version === YULAN_AGGREGATE_SCHEMA
  && resultBody.value?.result_kind === YULAN_RESULT_KIND
))
const isForumTwinResult = computed(() => (
  resultBody.value?.schema_version === FORUM_TWIN_RESULT_SCHEMA
  && resultBody.value?.result_kind === FORUM_TWIN_RESULT_KIND
))
const forumTwinProvenance = computed(() => (
  isForumTwinResult.value
    ? resultBody.value?.execution_provenance || ''
    : ''
))
const isForumTwinPublishable = computed(() => (
  isForumTwinResult.value
  && resultBody.value?.publication_eligible === true
  && resultBody.value?.completeness?.status === 'complete'
  && resultBody.value?.completeness?.completed_primary_slots === 16_544
  && resultBody.value?.privacy?.scan_passed === true
  && (
    forumTwinProvenance.value === 'reviewed_trace_replay'
    || forumTwinProvenance.value === 'authorized_live_llm'
  )
))
const governanceV2Domain = computed(
  () => isGovernanceV2Result.value
    ? resultBody.value?.domain_result || {}
    : {},
)
const yuLanScaleProvenance = computed(() => (
  isYuLanScaleResult.value
    ? resultBody.value?.execution_provenance || ''
    : ''
))
const isYuLanScaleDevelopment = computed(() => (
  isYuLanScaleResult.value
  && yuLanScaleProvenance.value === 'emulator_only_development'
))
const isYuLanScalePublishable = computed(() => (
  isYuLanScaleResult.value
  && resultBody.value?.publication_eligible === true
  && (
    yuLanScaleProvenance.value === 'reviewed_trace_replay'
    || yuLanScaleProvenance.value === 'authorized_live_llm'
  )
))

const aggregateV2Execution = computed(() => (
  isAggregateResultV2.value && resultBody.value?.execution
    ? resultBody.value.execution
    : {}
))

const aggregateV2BoundaryEntries = computed(() => {
  const boundary = resultBody.value?.claim_boundary || {}
  return Object.entries(EXPECTED_AGGREGATE_V2_BOUNDARY)
    .filter(([key]) => key !== 'result_kind')
    .map(([key, expected]) => ({
      key,
      label: AGGREGATE_V2_BOUNDARY_LABELS[key] || readableCode(key),
      status: boundary[key] || 'missing',
      expected,
      valid: boundary[key] === expected,
    }))
})

const aggregateV2BoundaryValid = computed(() => {
  if (!isAggregateResultV2.value) return false
  const boundary = resultBody.value?.claim_boundary || {}
  return Object.entries(EXPECTED_AGGREGATE_V2_BOUNDARY).every(
    ([key, expected]) => (
      (key === 'result_kind'
        ? resultBody.value?.result_kind || boundary[key]
        : boundary[key]
      ) === expected
    ),
  )
})

const isAuthorizedLiveV2 = computed(() => (
  isAggregateResultV2.value
  && aggregateV2BoundaryValid.value
  && aggregateV2Execution.value?.execution_provenance === 'authorized_live_llm'
  && aggregateV2Execution.value?.publication_status === 'authorized_live_aggregate'
  && aggregateV2Execution.value?.exportable === true
))
const canDownloadOfficialReport = computed(() => (
  isAuthorizedLiveV2.value
  || isGovernanceV2Result.value
  || isYuLanScalePublishable.value
  || isForumTwinPublishable.value
))

const adapterMode = computed(() => (
  runtimeRecord.value?.adapter_mode
  || launchContract.value?.adapter_mode
  || resultBody.value?.adapter_mode
  || ''
))

const isFixture = computed(() => {
  if (isYuLanScaleResult.value) return false
  if (isForumTwinResult.value) {
    return forumTwinProvenance.value === 'deterministic_fixture'
  }
  if (isAggregateResultV2.value) {
    return aggregateV2Execution.value?.execution_provenance
      === 'deterministic_transport_fixture'
  }
  const fixtureStatus = String(
    resultBody.value?.fixture_status
    || runtimeRecord.value?.fixture_status
    || '',
  ).toLowerCase()
  const adapter = String(adapterMode.value).toLowerCase()
  return (
    fixtureStatus.includes('fixture')
    || fixtureStatus === 'test_only'
    || adapter.includes('fake')
    || adapter.includes('fixture')
    || adapter.includes('deterministic')
  )
})

const resultIdentity = computed(() => (
  resultBody.value?.result_fingerprint
  || resultBody.value?.result_sha256
  || result.value?.result_sha256
  || runtimeRecord.value?.result_sha256
  || ''
))

const resultClaim = computed(() => {
  const boundary = resultBody.value?.claim_boundary || {}
  return {
    kind: resultBody.value?.result_kind
      || boundary.result_kind
      || 'model_conditional_simulation',
    causal: boundary.causal_status
      || resultBody.value?.causal_status
      || 'not_identified',
    forecast: boundary.forecast_status
      || resultBody.value?.forecast_status
      || 'not_forecast',
  }
})

const aggregateV2Breakdowns = computed(() => {
  const rows = resultBody.value?.phase_breakdowns
  if (!isAggregateResultV2.value || !Array.isArray(rows)) return []
  return rows.slice(0, 24).map((row, index) => ({
    id: [
      row.policy_template_key || 'policy',
      row.branch_id || 'branch',
      row.seed ?? index,
      row.phase_id || index,
    ].join('-'),
    policy: AGGREGATE_V2_POLICY_LABELS[row.policy_template_key]
      || readableCode(row.policy_template_key || row.engine_policy_id || 'policy'),
    seed: row.seed ?? '—',
    phase: readableCode(row.phase_id || 'phase'),
    expectedTurns: numberOrNull(row.expected_turns),
    completedTurns: numberOrNull(row.completed_turns),
    stance: leadingAggregateV2Distribution(row.distributions, 'stance'),
    action: leadingAggregateV2Distribution(row.distributions, 'action'),
  }))
})

const aggregateV2VariationRows = computed(() => {
  const rows = resultBody.value?.variation_summary?.entries
  if (!isAggregateResultV2.value || !Array.isArray(rows)) return []
  return rows.slice(0, 32).map((row, index) => ({
    id: [
      row.policy_template_key || row.branch_id || 'policy',
      row.phase_id || 'phase',
      row.dimension_id || index,
    ].join('-'),
    policy: AGGREGATE_V2_POLICY_LABELS[row.policy_template_key]
      || readableCode(row.policy_template_key || row.engine_policy_id || 'policy'),
    phase: readableCode(row.phase_id || 'phase'),
    dimension: row.dimension_id === 'stance' ? '立场' : '行动',
    status: row.status || 'missing',
    seedPairCount: numberOrNull(row.seed_pair_count),
    minimum: numberOrNull(row.minimum_distance_ppm),
    maximum: numberOrNull(row.maximum_distance_ppm),
    mean: numberOrNull(row.mean_distance_ppm),
  }))
})

const aggregateV2Budget = computed(() => (
  isAggregateResultV2.value
    ? resultBody.value?.budget_usage || {}
    : {}
))

const resultBreakdowns = computed(() => {
  const body = resultBody.value
  if (!body) return []
  const candidates = [
    body.breakdowns,
    body.policy_seed_breakdowns,
    body.seed_policy_breakdowns,
    body.aggregates?.breakdowns,
  ]
  const rows = candidates.find(Array.isArray) || []
  return rows.slice(0, 12).map((row, index) => ({
    id: `${row.policy_id || row.policy_key || 'policy'}-${
      row.seed ?? index
    }`,
    policy: row.policy_label
      || runPolicies.value.find(
        (policy) => policy.policy_id === row.policy_id,
      )?.name
      || row.policy_id
      || row.policy_key
      || '受控方案',
    seed: row.seed ?? row.seed_id ?? '—',
    denominator: numberOrNull(row.denominator_count),
    stance: leadingDistributionCell(row.stance_distribution),
    action: leadingDistributionCell(row.action_distribution),
  }))
})

const lastSafeEvent = computed(() => events.value[events.value.length - 1] || null)
const visibleEvents = computed(() => events.value.slice(-6).reverse())

watch(
  () => props.run?.run_id,
  () => resetForRun(),
  { immediate: true },
)

watch(
  () => props.connected,
  (connected) => {
    if (connected) {
      refreshRuntime({ resetBackoff: true })
      refreshLiveCapability()
    } else {
      clearPoll()
      connectionError.value = '工作台连接已中断；页面不会推测运行进度。'
      liveCapability.value = null
      liveCapabilityError.value = '工作台连接已中断；资格、Provider与授权状态均未同步。'
    }
  },
)

onUnmounted(() => {
  ++requestGeneration
  clearPoll()
})

function resetForRun() {
  ++requestGeneration
  clearPoll()
  runtime.value = props.run?.runtime_summary || null
  events.value = []
  result.value = null
  loading.value = false
  actionPending.value = ''
  connectionError.value = ''
  eventError.value = ''
  resultError.value = ''
  resultUnavailable.value = false
  actionNotice.value = ''
  actionError.value = ''
  reportDownloadPending.value = ''
  reportDownloadNotice.value = ''
  reportDownloadError.value = ''
  reportDownloadUnavailable.value = false
  liveCapability.value = null
  liveCapabilityLoading.value = false
  liveCapabilityError.value = ''
  pollAttempt.value = 0
  lastRefreshedAt.value = null
  launchRequest = null
  if (props.connected && props.run?.run_id) {
    refreshRuntime({ resetBackoff: true })
    refreshLiveCapability()
  }
}

function clearPoll() {
  if (pollTimer !== null) {
    globalThis.clearTimeout(pollTimer)
    pollTimer = null
  }
}

function schedulePoll() {
  clearPoll()
  if (!props.connected || !isActive.value) return
  const delay = POLL_DELAYS[
    Math.min(pollAttempt.value, POLL_DELAYS.length - 1)
  ]
  pollTimer = globalThis.setTimeout(async () => {
    pollAttempt.value = Math.min(
      pollAttempt.value + 1,
      POLL_DELAYS.length - 1,
    )
    await refreshRuntime()
  }, delay)
}

async function refreshLiveCapability() {
  const runId = props.run?.run_id
  if (!runId || !props.connected) return
  const generation = requestGeneration
  liveCapabilityLoading.value = true
  liveCapabilityError.value = ''
  try {
    const capability = await getLiveRuntimeCapability(runId)
    if (generation !== requestGeneration || props.run?.run_id !== runId) return
    liveCapability.value = capability
    if (Number(capability?.provider_calls_performed) !== 0) {
      liveCapabilityError.value = '资格接口没有证明零Provider调用；页面拒绝把该状态显示为已就绪。'
    }
  } catch (error) {
    if (generation !== requestGeneration || props.run?.run_id !== runId) return
    liveCapability.value = null
    liveCapabilityError.value = `Live资格状态暂不可用：${readableApiError(error)}。页面不会猜测资产、Provider或授权状态。`
  } finally {
    if (generation === requestGeneration && props.run?.run_id === runId) {
      liveCapabilityLoading.value = false
    }
  }
}

async function refreshPanel() {
  await Promise.allSettled([
    refreshRuntime({ resetBackoff: true }),
    refreshLiveCapability(),
  ])
}

async function refreshRuntime({ resetBackoff = false } = {}) {
  const runId = props.run?.run_id
  if (!runId || !props.connected) return
  const generation = requestGeneration
  clearPoll()
  if (resetBackoff) pollAttempt.value = 0
  loading.value = runtime.value === null
  connectionError.value = ''

  try {
    const runtimeData = await getRunRuntime(runId)
    if (generation !== requestGeneration || props.run?.run_id !== runId) return
    const priorStatus = runtimeStatus.value
    runtime.value = runtimeData
    lastRefreshedAt.value = new Date().toISOString()
    if (priorStatus !== runtimeStatus.value) pollAttempt.value = 0
    emit('runtime-updated', {
      runId,
      runtime: runtimeData,
    })
    await refreshEvents(runId, generation)
    if (runtimeStatus.value === 'succeeded') {
      await refreshResult(runId, generation)
    } else {
      result.value = null
      resultUnavailable.value = false
      resultError.value = ''
    }
  } catch (error) {
    if (generation !== requestGeneration || props.run?.run_id !== runId) return
    if (error?.response?.status === 404) {
      runtime.value = null
      events.value = []
      result.value = null
      resultUnavailable.value = false
      connectionError.value = ''
    } else {
      connectionError.value = `运行时状态暂不可用：${readableApiError(error)}。页面没有生成替代进度。`
    }
  } finally {
    if (generation === requestGeneration && props.run?.run_id === runId) {
      loading.value = false
      schedulePoll()
    }
  }
}

async function refreshEvents(runId, generation) {
  let afterSequence = events.value.reduce(
    (maximum, event) => Math.max(maximum, eventSequence(event) || 0),
    0,
  )
  try {
    let merged = [...events.value]
    for (let page = 0; page < 10; page += 1) {
      const payload = await listRunRuntimeEvents(runId, {
        afterSequence,
        limit: 100,
      })
      if (
        generation !== requestGeneration
        || props.run?.run_id !== runId
      ) return
      const incoming = Array.isArray(payload)
        ? payload
        : payload?.items || payload?.events || []
      const known = new Set(merged.map((event) => eventSequence(event)))
      merged = [
        ...merged,
        ...incoming.filter(
          (event) => (
            SAFE_EVENT_TYPES.has(eventType(event))
            && !known.has(eventSequence(event))
          ),
        ),
      ]
        .sort((left, right) => (
          (eventSequence(left) || 0) - (eventSequence(right) || 0)
        ))
        .slice(-200)
      const nextSequence = incoming.reduce(
        (maximum, event) => Math.max(
          maximum,
          eventSequence(event) || maximum,
        ),
        afterSequence,
      )
      const hasMore = !Array.isArray(payload) && payload?.has_more === true
      if (!hasMore || !incoming.length || nextSequence <= afterSequence) break
      afterSequence = nextSequence
    }
    events.value = merged
    eventError.value = ''
  } catch (error) {
    if (generation !== requestGeneration || props.run?.run_id !== runId) return
    eventError.value = error?.response?.status === 404
      ? '事件流尚未建立。'
      : `事件流暂不可用：${readableApiError(error)}`
  }
}

async function refreshResult(runId, generation) {
  try {
    const payload = await getRunAggregateResult(runId)
    if (generation !== requestGeneration || props.run?.run_id !== runId) return
    result.value = payload
    resultUnavailable.value = false
    resultError.value = ''
    reportDownloadNotice.value = ''
    reportDownloadError.value = ''
    reportDownloadUnavailable.value = false
  } catch (error) {
    if (generation !== requestGeneration || props.run?.run_id !== runId) return
    result.value = null
    if (error?.response?.status === 404 || error?.response?.status === 409) {
      resultUnavailable.value = true
      resultError.value = ''
    } else {
      resultUnavailable.value = false
      resultError.value = `聚合结果读取失败：${readableApiError(error)}`
    }
  }
}

async function enqueueSelectedRun() {
  if (!canEnqueue.value) return
  const runId = props.run.run_id
  const turnBudget = plannedTurnLimit.value
  if (!Number.isSafeInteger(turnBudget) || turnBudget < 1) {
    actionError.value = '冻结计划无法计算有界智能体轮次，未发起入队。'
    return
  }
  const body = {
    expected_state_version: stateVersion.value ?? 0,
    turn_budget: turnBudget,
    max_attempts: 2,
  }
  const signature = JSON.stringify(body)
  if (!launchRequest || launchRequest.signature !== signature) {
    launchRequest = {
      signature,
      key: globalThis.crypto?.randomUUID?.()
        || `enqueue-${runId}-${Date.now()}`,
    }
  }
  actionPending.value = 'enqueue'
  actionError.value = ''
  actionNotice.value = ''
  try {
    runtime.value = await enqueueRun(runId, body, launchRequest.key)
    launchRequest = null
    actionNotice.value = '运行已进入持久化队列；HTTP 请求本身没有执行模型。'
    pollAttempt.value = 0
    emit('runtime-updated', {
      runId,
      runtime: runtime.value,
    })
    await refreshRuntime({ resetBackoff: true })
  } catch (error) {
    if (error?.response?.status === 409) {
      actionError.value = '运行状态版本已变化，已重新读取服务端状态；请核对后重试。'
      await refreshRuntime({ resetBackoff: true })
    } else {
      actionError.value = readableApiError(error)
    }
  } finally {
    actionPending.value = ''
  }
}

async function cancelSelectedRun() {
  if (!canCancel.value || stateVersion.value === null) return
  const runId = props.run.run_id
  actionPending.value = 'cancel'
  actionError.value = ''
  actionNotice.value = ''
  try {
    runtime.value = await cancelRun(runId, {
      expected_state_version: stateVersion.value,
      reason_code: 'operator_requested',
    })
    actionNotice.value = runtimeStatus.value === 'cancel_requested'
      ? '取消请求已记录；Worker 将在下一个安全边界停止。'
      : '运行已取消。'
    emit('runtime-updated', {
      runId,
      runtime: runtime.value,
    })
    await refreshRuntime({ resetBackoff: true })
  } catch (error) {
    if (error?.response?.status === 409) {
      actionError.value = '取消时状态已变化；已重新读取终态或最新版本。'
      await refreshRuntime({ resetBackoff: true })
    } else {
      actionError.value = readableApiError(error)
    }
  } finally {
    actionPending.value = ''
  }
}

function capabilityStateLabel(value) {
  if (liveCapabilityLoading.value) return '读取中'
  if (!value) return '未读取'
  return CAPABILITY_STATE_LABELS[value] || readableCode(value)
}

function capabilityTone(value) {
  if (liveCapabilityLoading.value || !value) return 'unknown'
  if (POSITIVE_CAPABILITY_STATES.has(value)) return 'ready'
  if (NEUTRAL_CAPABILITY_STATES.has(value)) return 'neutral'
  return 'blocked'
}

function eventSequence(event) {
  return numberOrNull(event?.sequence ?? event?.event_sequence)
}

function eventType(event) {
  return event?.event_type || event?.type || 'runtime_event'
}

function eventLabel(event) {
  const type = eventType(event)
  return EVENT_LABELS[type] || readableCode(type)
}

function eventTime(event) {
  return event?.created_at || event?.occurred_at || event?.timestamp
}

function numberOrNull(value) {
  if (
    value === null
    || value === undefined
    || value === ''
    || typeof value === 'boolean'
  ) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatNumber(value) {
  const number = numberOrNull(value)
  if (number === null) return '—'
  return new Intl.NumberFormat('zh-CN').format(number)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function shortIdentity(value) {
  if (!value) return '—'
  const text = String(value)
  return text.length > 24
    ? `${text.slice(0, 12)}…${text.slice(-8)}`
    : text
}

function readableCode(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function leadingDistributionCell(cells) {
  if (!Array.isArray(cells) || !cells.length) return null
  return cells.reduce((leading, cell) => (
    numberOrNull(cell?.share_ppm) > numberOrNull(leading?.share_ppm)
      ? cell
      : leading
  ), cells[0])
}

function distributionSummary(cell, kind) {
  if (!cell) return `${kind}分布不可用`
  const labels = kind === '立场'
    ? {
        supportive: '支持',
        neutral: '中性',
        concerned: '担忧',
        critical: '批评',
      }
    : {
        ignore: '忽略',
        read: '阅读',
        comment: '评论',
        post: '发帖',
        seek_help: '求助',
        report_risk: '报告风险',
      }
  const share = numberOrNull(cell.share_ppm)
  return `${kind}主项 ${labels[cell.category] || readableCode(cell.category)} ${
    share === null ? '—' : `${(share / 10000).toFixed(1)}%`
  }`
}

function leadingAggregateV2Distribution(distributions, dimensionId) {
  if (!Array.isArray(distributions)) return null
  const distribution = distributions.find(
    (candidate) => candidate?.dimension_id === dimensionId,
  )
  if (
    !distribution
    || distribution.status !== 'complete'
    || !Array.isArray(distribution.cells)
    || !distribution.cells.length
  ) return null
  const leading = distribution.cells.reduce((current, cell) => (
    (numberOrNull(cell?.ppm) ?? -1) > (numberOrNull(current?.ppm) ?? -1)
      ? cell
      : current
  ), distribution.cells[0])
  return {
    category: leading.category_id,
    share_ppm: numberOrNull(leading.ppm),
    total_count: numberOrNull(distribution.total_count),
  }
}

function formatPpm(value) {
  const parsed = numberOrNull(value)
  return parsed === null ? '—' : `${(parsed / 10000).toFixed(1)}%`
}

async function requestAggregateReport(format) {
  if (
    !canDownloadOfficialReport.value
    || !props.connected
    || reportDownloadPending.value
    || reportDownloadUnavailable.value
  ) return
  const runId = props.run?.run_id
  if (!runId) return
  reportDownloadPending.value = format
  reportDownloadNotice.value = ''
  reportDownloadError.value = ''
  try {
    const response = await downloadRunAggregateReport(runId, format)
    const expectedType = format === 'html' ? 'text/html' : 'application/json'
    const contentType = String(response?.headers?.['content-type'] || '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    if (contentType !== expectedType) {
      throw new Error(`报告类型校验失败：期望 ${expectedType}`)
    }
    const payload = response?.data
    const reportBlob = payload instanceof Blob
      ? payload
      : new Blob([payload], { type: `${expectedType}; charset=utf-8` })
    if (!reportBlob.size) throw new Error('服务端返回了空报告')
    const objectUrl = globalThis.URL.createObjectURL(reportBlob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `campus-pulse-${runId}.${format}`
    anchor.rel = 'noopener'
    anchor.click()
    globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(objectUrl), 0)
    reportDownloadNotice.value = `已下载服务端校验的 ${format.toUpperCase()} 报告。`
  } catch (error) {
    const status = error?.response?.status
    if ([404, 409, 501].includes(status)) {
      reportDownloadUnavailable.value = true
      reportDownloadError.value = '后端报告下载路由尚未开放；未生成或伪造文件。'
    } else {
      const detail = error?.response
        ? readableApiError(error)
        : error?.message || readableApiError(error)
      reportDownloadError.value = `报告下载失败：${detail}；未生成替代文件。`
    }
  } finally {
    reportDownloadPending.value = ''
  }
}
</script>

<template>
  <section class="runtime-panel" aria-label="异步多智能体运行控制">
    <header class="runtime-heading">
      <div>
        <h3>异步多智能体运行控制</h3>
        <p>
          入队、租约、恢复与结果提交均由服务端记录；页面只展示已返回的真实状态。
        </p>
      </div>
      <div class="runtime-heading-meta">
        <EvidenceBadge
          :tone="
            runtimeStatus === 'succeeded'
              ? 'observed'
              : runtimeStatus === 'failed' || runtimeStatus === 'cancelled'
                ? 'offline'
                : 'model'
          "
          :label="STATUS_LABELS[runtimeStatus]"
        />
        <small>state_version {{ stateVersion === null ? '—' : stateVersion }}</small>
        <code>{{ shortIdentity(run.run_id) }}</code>
      </div>
    </header>

    <div
      v-if="!runtimeEligibility.eligible"
      class="runtime-alert blocked"
      role="note"
    >
      <strong>当前计划不可进入 P3.1 运行时</strong>
      <span>{{ runtimeEligibility.reason }}</span>
    </div>
    <div v-else class="runtime-whitelist">
      <span>EXECUTION WHITELIST</span>
      <strong>{{ runtimeEligibility.reason }}</strong>
      <small>P3.1 使用服务端确定性 fake executor，真实 LLM 适配器保持关闭。</small>
    </div>

    <section
      v-if="isYuLanScaleRun"
      class="aggregate-v2-section yulan-scale-runtime-contract"
      aria-label="YuLan-Scale v7 冻结运行合同"
    >
      <div class="aggregate-v2-section-heading">
        <strong>YuLan-Scale v7 冻结运行合同</strong>
        <small>
          1,000 个主体均有 LLM 人物、记忆与调用合同；预算化激活不表示每 tick 调用 1,000 次 Provider。
        </small>
      </div>
      <div class="aggregate-v2-budget-grid">
        <article>
          <span>LLM agents</span>
          <strong>1,000</strong>
        </article>
        <article>
          <span>SMC particles</span>
          <strong>10,000</strong>
        </article>
        <article>
          <span>paired seeds / branches</span>
          <strong>8 / 5</strong>
        </article>
        <article>
          <span>每轮 activation</span>
          <strong>16 anchors + 32 PPS</strong>
        </article>
        <article>
          <span>居民 / 治理槽位</span>
          <strong>12,288 / 768</strong>
        </article>
        <article>
          <span>emulator updates</span>
          <strong>17,280,000</strong>
        </article>
      </div>
    </section>

    <section
      class="live-capability-panel"
      aria-label="当前运行的Live LLM资格合同"
    >
      <div class="live-capability-heading">
        <div>
          <span>P3.2b / DETERMINISTIC RUNTIME</span>
          <strong>确定性夹具与真实模型单次授权分层</strong>
        </div>
        <small>
          {{
            qualificationProviderCalls === 0
              ? '资格阶段Provider调用 0 次'
              : qualificationProviderCalls === null
                ? '零调用状态未读取'
                : '资格状态异常：返回非零调用'
          }}
        </small>
      </div>

      <div
        v-if="liveCapabilityError"
        class="runtime-alert error"
        role="status"
      >
        {{ liveCapabilityError }}
      </div>

      <div class="live-capability-states">
        <article
          :class="
            capabilityTone(
              liveCapability?.deterministic_fixture?.executor_state,
            )
          "
        >
          <span>确定性夹具执行器</span>
          <strong>
            {{
              liveCapability?.deterministic_fixture?.executor_state
                === 'installed'
                ? '执行器已安装'
                : '执行器状态未确认'
            }}
          </strong>
          <small>零Provider · 可恢复 · 不可导出为治理结论</small>
        </article>
        <article
          :class="capabilityTone(liveCapability?.asset_bundle?.state)"
        >
          <span>审阅资产</span>
          <strong>
            {{
              liveCapability?.asset_bundle?.state === 'qualified'
                ? '资格资产已安装'
                : liveCapability?.asset_bundle?.state === 'not_installed'
                  ? '资格资产未安装'
                  : capabilityStateLabel(
                    liveCapability?.asset_bundle?.state,
                  )
            }}
          </strong>
          <small>
            {{
              shortIdentity(
                liveCapability?.asset_bundle?.bundle_fingerprint,
              )
            }}
          </small>
        </article>
        <article
          :class="capabilityTone(liveCapability?.provider_profile_state)"
        >
          <span>Provider配置</span>
          <strong>
            {{
              liveCapability?.provider_profile_state === 'disabled'
                ? 'Provider未启用'
                : liveCapability?.provider_profile_state === 'not_installed'
                  ? 'Provider未安装'
                  : liveCapability?.provider_profile_state === 'enabled'
                    ? 'Provider已启用'
                    : capabilityStateLabel(
                      liveCapability?.provider_profile_state,
                    )
            }}
          </strong>
          <small>
            全局闸门 {{ liveCapability?.live_gate || '未读取' }} ·
            {{ liveCapability?.provider_profile?.requested_model || '模型未读取' }}
          </small>
        </article>
        <article
          :class="capabilityTone(liveAuthorization.state)"
        >
          <span>本运行单次授权</span>
          <strong>{{ capabilityStateLabel(liveAuthorization.state) }}</strong>
          <small>
            调用上限 {{ formatNumber(liveAuthorization.provider_call_cap) }} ·
            Token上限 {{ formatNumber(liveAuthorization.token_cap) }}
          </small>
        </article>
        <article
          :class="capabilityTone(liveCapability?.executor_state)"
        >
          <span>真实Provider执行器</span>
          <strong>
            {{
              liveCapability?.executor_state === 'not_installed'
                ? 'P3.2c尚未接入'
                : capabilityStateLabel(liveCapability?.executor_state)
            }}
          </strong>
          <small>
            {{
              liveCapability?.live_enqueue_ready
                ? '资格与授权允许显式入队'
                : `不可Live入队 · ${
                  liveCapability?.live_enqueue_blocker || '阻断原因未读取'
                }`
            }}
          </small>
        </article>
      </div>

      <div class="live-contract-metrics" aria-label="Live计划硬合同">
        <article>
          <span>Expected turns</span>
          <strong>
            {{ formatNumber(livePlanContract?.expected_agent_turns) }}
          </strong>
          <small>服务端冻结的智能体决策轮次</small>
        </article>
        <article>
          <span>Cold calls</span>
          <strong>
            {{ formatNumber(livePlanContract?.expected_cold_provider_calls) }}
          </strong>
          <small>冷缓存预期Provider调用</small>
        </article>
        <article>
          <span>Hard call cap</span>
          <strong>
            {{ formatNumber(livePlanContract?.provider_call_limit) }}
          </strong>
          <small>
            授权有效上限 {{ formatNumber(liveAuthorization.provider_call_cap) }}
          </small>
        </article>
        <article>
          <span>Hard Token cap</span>
          <strong>{{ formatNumber(livePlanContract?.token_limit) }}</strong>
          <small>
            授权有效上限 {{ formatNumber(liveAuthorization.token_cap) }}
          </small>
        </article>
        <article>
          <span>Effective workers</span>
          <strong>
            {{ formatNumber(livePlanContract?.effective_max_workers) }}
          </strong>
          <small>计划、智能体与服务端上限的最小值</small>
        </article>
      </div>

      <p class="live-claim-boundary">
        资格读取、计划冻结与授权检查均不执行模型；当前接口报告
        {{ formatNumber(qualificationProviderCalls) }} 次Provider调用。
        即使后续执行，结果仍为模型条件模拟、非因果识别、非预测，
        不代表总体民意或个体事实。本面板不提供合成发言浏览。
        <code>
          causal={{ liveClaimBoundary.causal_status || 'not_identified' }} ·
          forecast={{ liveClaimBoundary.forecast_status || 'not_evaluated' }}
        </code>
      </p>
    </section>

    <div v-if="isFixture" class="fixture-notice" role="note">
      <strong>TEST FIXTURE / 测试夹具</strong>
      <span>
        此输出只验证异步队列、预算、取消与恢复链路，不能作为治理发现、政策效果或舆情判断。
      </span>
    </div>

    <div class="runtime-state-rail" aria-label="运行时七状态">
      <div
        v-for="state in RUNTIME_STATES"
        :key="state"
        class="runtime-state"
        :class="{ current: runtimeStatus === state }"
      >
        <span />
        <small>{{ STATUS_LABELS[state] }}</small>
      </div>
    </div>

    <div class="runtime-metrics">
      <article>
        <span>服务端轮次进度</span>
        <strong v-if="completedTurns !== null && serverTurnLimit !== null">
          {{ formatNumber(completedTurns) }} / {{ formatNumber(serverTurnLimit) }}
        </strong>
        <strong v-else>等待服务端计数</strong>
        <div class="metric-track" aria-hidden="true">
          <span
            v-if="progressPercent !== null"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <small>
          {{
            currentStage
              ? currentStage
              : `计划轮次上限 ${formatNumber(plannedTurnLimit)}`
          }}
        </small>
      </article>

      <article>
        <span>Token 硬预算</span>
        <strong>
          {{
            consumedTokens === null
              ? `尚无消耗回报 / ${formatNumber(tokenLimit)}`
              : `${formatNumber(consumedTokens)} / ${formatNumber(tokenLimit)}`
          }}
        </strong>
        <div class="metric-track token" aria-hidden="true">
          <span
            v-if="tokenPercent !== null"
            :style="{ width: `${tokenPercent}%` }"
          />
        </div>
        <small>
          历史生成量估算约 {{ formatNumber(empiricalTokenEstimate) }}；
          建议上限 {{ formatNumber(recommendedTokenBudget) }}
        </small>
      </article>

      <article>
        <span>有效并发上限</span>
        <strong>
          {{
            effectiveConcurrency === null
              ? '入队后由服务端确认'
              : formatNumber(effectiveConcurrency)
          }}
        </strong>
        <small>
          冻结计划 {{ formatNumber(run.max_workers) }} Workers ·
          {{ formatNumber(run.agent_count) }} 智能体
        </small>
      </article>

      <article>
        <span>尝试与恢复</span>
        <strong>
          {{
            attemptsUsed === null
              ? '尚未建立 attempt'
              : `${formatNumber(attemptsUsed)} / ${formatNumber(maxAttempts)}`
          }}
        </strong>
        <small>
          {{
            lastSafeEvent
              ? eventLabel(lastSafeEvent)
              : '没有伪造租约、心跳或恢复事件'
          }}
        </small>
      </article>
    </div>

    <div v-if="connectionError" class="runtime-alert error" role="status">
      {{ connectionError }}
    </div>
    <div v-if="actionError" class="runtime-alert error" role="status">
      {{ actionError }}
    </div>
    <div v-if="actionNotice" class="runtime-alert success" role="status">
      {{ actionNotice }}
    </div>

    <div class="runtime-actions">
      <div>
        <span v-if="loading">正在读取服务端状态…</span>
        <span v-else-if="lastRefreshedAt">
          最近同步 {{ formatDate(lastRefreshedAt) }}
          <template v-if="isActive">
            · 有界轮询 {{ POLL_DELAYS[
              Math.min(pollAttempt, POLL_DELAYS.length - 1)
            ] / 1000 }} 秒
          </template>
        </span>
        <span v-else>尚未建立运行时记录</span>
      </div>
      <button
        class="secondary-action"
        type="button"
        :disabled="!connected || Boolean(actionPending)"
        @click="refreshPanel"
      >
        刷新运行与资格
      </button>
      <button
        v-if="runtimeStatus === 'draft'"
        class="primary-action"
        type="button"
        :disabled="!canEnqueue"
        @click="enqueueSelectedRun"
      >
        {{ actionPending === 'enqueue' ? '正在入队…' : '显式入队' }}
      </button>
      <button
        v-else-if="canCancel"
        class="danger-action"
        type="button"
        :disabled="runtimeStatus === 'cancel_requested'"
        @click="cancelSelectedRun"
      >
        {{
          runtimeStatus === 'cancel_requested'
            ? '等待安全取消'
            : actionPending === 'cancel'
              ? '正在提交取消…'
              : '安全取消'
        }}
      </button>
    </div>

    <div class="runtime-lower-grid">
      <section class="event-panel">
        <div class="subsection-heading">
          <div>
            <span>SAFE EVENT STREAM</span>
            <strong>服务端安全事件</strong>
          </div>
          <small>仅显示受控类型、序号与时间</small>
        </div>
        <div v-if="eventError" class="empty-runtime-state">
          {{ eventError }}
        </div>
        <ol v-else-if="visibleEvents.length" class="event-list">
          <li v-for="event in visibleEvents" :key="eventSequence(event)">
            <span>#{{ eventSequence(event) }}</span>
            <strong>{{ eventLabel(event) }}</strong>
            <time>{{ formatDate(eventTime(event)) }}</time>
          </li>
        </ol>
        <div v-else class="empty-runtime-state">
          尚无事件。未入队计划不会被推断为已经执行。
        </div>
      </section>

      <section class="result-panel">
        <div class="subsection-heading">
          <div>
            <span>AGGREGATE RESULT</span>
            <strong>聚合优先结果</strong>
          </div>
          <small v-if="resultIdentity">
            {{ shortIdentity(resultIdentity) }}
          </small>
        </div>

        <div
          v-if="runtimeStatus !== 'succeeded'"
          class="empty-runtime-state"
        >
          {{
            runtimeStatus === 'failed'
              ? '失败运行不会被提升为完整结果。'
              : runtimeStatus === 'cancelled'
                ? '已取消运行没有治理结果。'
                : '只有原子提交成功的终态运行才显示聚合结果。'
          }}
        </div>
        <div v-else-if="resultError" class="runtime-alert error">
          {{ resultError }}
        </div>
        <div v-else-if="resultUnavailable" class="empty-runtime-state result-missing">
          <strong>终态已返回，但聚合结果暂不可用</strong>
          <span>页面不会用本地 fixture 或旧运行填补；请刷新或检查服务端原子提交。</span>
        </div>
        <div v-else-if="resultBody" class="result-content">
          <template v-if="isForumTwinResult">
            <div
              class="aggregate-v2-warning"
              :class="isForumTwinPublishable ? 'live' : 'blocked'"
              role="note"
            >
              <strong>
                {{
                  isForumTwinPublishable
                    ? forumTwinProvenance === 'reviewed_trace_replay'
                      ? 'ForumTwin v1 · 已审阅 Trace 回放'
                      : 'ForumTwin v1 · 已验证 Live LLM'
                    : 'ForumTwin v1 · 开发状态 / 不完整'
                }}
              </strong>
              <span v-if="isForumTwinPublishable">
                result-v6 已完成 16,544 个语义槽位，并通过 provenance、隐私和摘要链门禁。
              </span>
              <span v-else>
                当前结果只能用于工程、恢复或质量验证；前端不会把 fixture、开发态或不完整 trace
                提升为公开论坛，也不会启用正式报告下载。
              </span>
            </div>

            <div class="claim-boundary aggregate-v2-claim">
              <span>campus-pulse-live-aggregate-result-v6</span>
              <strong>1,000 LLM Forum Agents × 10,000 SMC particles</strong>
              <small>
                2 场景 · Natural/A/B/C/D · 24 时点 · 8 配对种子 ·
                16 anchors + 32 PPS
              </small>
            </div>

            <section class="aggregate-v2-section">
              <div class="aggregate-v2-section-heading">
                <strong>ForumTwin v8 完整性与预算</strong>
                <small>公开文字只能来自 authorized live LLM 或 exact reviewed trace。</small>
              </div>
              <div class="aggregate-v2-budget-grid yulan-scale-ledger">
                <article>
                  <span>完成语义槽位</span>
                  <strong>
                    {{ formatNumber(resultBody.completeness?.completed_primary_slots) }}
                    /
                    {{ formatNumber(resultBody.completeness?.required_primary_slots) }}
                  </strong>
                  <small>正式门槛 16,544 / 16,544</small>
                </article>
                <article>
                  <span>居民 / 治理 LLM turns</span>
                  <strong>
                    {{ formatNumber(resultBody.domain_result?.llm_usage?.resident_turns) }}
                    /
                    {{ formatNumber(resultBody.domain_result?.llm_usage?.governance_turns) }}
                  </strong>
                </article>
                <article>
                  <span>Provider calls / tokens</span>
                  <strong>
                    {{ formatNumber(resultBody.domain_result?.llm_usage?.provider_calls) }}
                    /
                    {{ formatNumber(resultBody.domain_result?.llm_usage?.provider_tokens) }}
                  </strong>
                </article>
                <article>
                  <span>单轮居民 / 总激活峰值</span>
                  <strong>
                    {{ formatNumber(resultBody.budget_usage?.peak_resident_turns_per_tick) }}
                    /
                    {{ formatNumber(resultBody.budget_usage?.peak_total_turns_per_tick) }}
                  </strong>
                  <small>冻结上限 64 / 67</small>
                </article>
                <article>
                  <span>Unique activated</span>
                  <strong>
                    {{ formatNumber(resultBody.domain_result?.sampling?.unique_activated_agents) }}
                  </strong>
                  <small>英雄场景门禁 ≥ 500</small>
                </article>
                <article>
                  <span>Scheduler recall</span>
                  <strong>
                    {{
                      resultBody.domain_result?.sampling?.scheduler_recall === undefined
                        ? '—'
                        : `${(Number(resultBody.domain_result.sampling.scheduler_recall) * 100).toFixed(1)}%`
                    }}
                  </strong>
                  <small>门禁 ≥ 90%</small>
                </article>
                <article>
                  <span>Emulator public messages</span>
                  <strong>{{ formatNumber(resultBody.domain_result?.audit?.emulator_public_messages) }}</strong>
                  <small>必须为 0</small>
                </article>
                <article>
                  <span>真实治理动作</span>
                  <strong>{{ formatNumber(resultBody.domain_result?.audit?.real_governance_actions) }}</strong>
                  <small>必须为 0</small>
                </article>
              </div>
            </section>

            <div class="aggregate-v2-downloads">
              <div>
                <strong>平行论坛结果与正式报告</strong>
                <small v-if="isForumTwinPublishable">
                  服务端仍会在读取页面和下载报告时再次验证 result、manifest 和隐私门禁。
                </small>
                <small v-else>
                  当前运行没有正式公开资格；页面不加载旧结果或本地随机数据补位。
                </small>
              </div>
              <router-link
                v-if="isForumTwinPublishable"
                :to="{
                  path: '/campus-pulse/forum',
                  query: { run_id: props.run.run_id },
                }"
              >
                打开 ForumTwin 平行论坛
              </router-link>
              <span v-else class="runtime-alert blocked">
                平行论坛已锁定，等待完整 reviewed/live result-v6
              </span>
              <button
                type="button"
                :disabled="
                  !canDownloadOfficialReport
                  || Boolean(reportDownloadPending)
                  || reportDownloadUnavailable
                "
                @click="requestAggregateReport('json')"
              >
                {{ reportDownloadPending === 'json' ? '请求中…' : '下载正式 JSON' }}
              </button>
              <button
                type="button"
                :disabled="
                  !canDownloadOfficialReport
                  || Boolean(reportDownloadPending)
                  || reportDownloadUnavailable
                "
                @click="requestAggregateReport('html')"
              >
                {{ reportDownloadPending === 'html' ? '请求中…' : '下载正式 HTML' }}
              </button>
            </div>
          </template>

          <template v-else-if="isYuLanScaleResult">
            <div
              class="aggregate-v2-warning"
              :class="isYuLanScaleDevelopment ? 'blocked' : 'live'"
              role="note"
            >
              <strong>
                {{
                  isYuLanScaleDevelopment
                    ? 'YuLan-Scale v1 · 仅 Emulator 开发状态'
                    : yuLanScaleProvenance === 'reviewed_trace_replay'
                      ? 'YuLan-Scale v1 · 已审阅 Trace 回放'
                      : 'YuLan-Scale v1 · 已验证 Live LLM'
                }}
              </strong>
              <span v-if="isYuLanScaleDevelopment">
                1,728 个工作单元可用于内核、恢复与性能验证；真实 LLM turns 为 0，
                publication_eligible=false，禁止下载正式报告或构建正式发布包。
              </span>
              <span v-else>
                只有完成 13,056 个预算化 LLM 槽位并通过服务端发布门禁的
                reviewed trace / authorized live 结果才能下载正式报告。
              </span>
            </div>

            <div class="claim-boundary aggregate-v2-claim">
              <span>campus-pulse-live-aggregate-result-v5</span>
              <strong>统一 1,000 LLM agents × 10 SMC particles</strong>
              <small>
                2 场景 · 5 分支 · 24 时点 · 8 配对种子 ·
                16 anchors + 32 PPS / 激活轮
              </small>
            </div>

            <section class="aggregate-v2-section">
              <div class="aggregate-v2-section-heading">
                <strong>v7 预算化 LLM 多智能体账本</strong>
                <small>
                  replay、cache、live Provider 与 emulator 由服务端分别计数；
                  fixture 不属于 result-v5 正式 provenance。
                </small>
              </div>
              <div class="aggregate-v2-budget-grid yulan-scale-ledger">
                <article>
                  <span>LLM agents / 粒子</span>
                  <strong>1,000 / 10,000</strong>
                  <small>episode 主体 / 状态不确定性样本</small>
                </article>
                <article>
                  <span>工作单元</span>
                  <strong>
                    {{ formatNumber(resultBody.completeness?.completed_work_units) }}
                    /
                    {{ formatNumber(resultBody.completeness?.required_work_units) }}
                  </strong>
                  <small>population_branch_tick</small>
                </article>
                <article>
                  <span>语义槽位</span>
                  <strong>
                    {{ formatNumber(resultBody.completeness?.completed_semantic_slots) }}
                    /
                    {{ formatNumber(resultBody.completeness?.required_semantic_slots) }}
                  </strong>
                  <small>居民 12,288 + 治理主体 768</small>
                </article>
                <article>
                  <span>本轮预算</span>
                  <strong>16 anchors + 32 PPS</strong>
                  <small>锚点不进入 GREG/HT 总体估计</small>
                </article>
                <article>
                  <span>居民 / 治理 LLM turns</span>
                  <strong>
                    {{ formatNumber(resultBody.usage?.resident_llm_turns) }}
                    /
                    {{ formatNumber(resultBody.usage?.governance_llm_turns) }}
                  </strong>
                </article>
                <article>
                  <span>trace replay / cache</span>
                  <strong>
                    {{ formatNumber(resultBody.usage?.reviewed_trace_replays) }}
                    /
                    {{ formatNumber(resultBody.usage?.cache_hits) }}
                  </strong>
                </article>
                <article>
                  <span>live Provider / tokens</span>
                  <strong>
                    {{ formatNumber(resultBody.usage?.live_provider_calls) }}
                    /
                    {{ formatNumber(resultBody.usage?.provider_tokens) }}
                  </strong>
                </article>
                <article>
                  <span>emulator 更新</span>
                  <strong>{{ formatNumber(resultBody.usage?.emulator_updates) }}</strong>
                  <small>冻结的 LLM 行为代理执行量</small>
                </article>
              </div>
            </section>

            <section class="aggregate-v2-section">
              <div class="aggregate-v2-section-heading">
                <strong>Provider 风险预算</strong>
                <small>预留上限不等于实际调用；资格检查本身不调用 Provider。</small>
              </div>
              <div class="aggregate-v2-budget-grid">
                <article>
                  <span>requests used / limit</span>
                  <strong>
                    {{ formatNumber(resultBody.budget_usage?.provider_requests_used) }}
                    /
                    {{ formatNumber(resultBody.budget_usage?.provider_request_limit) }}
                  </strong>
                </article>
                <article>
                  <span>tokens used / limit</span>
                  <strong>
                    {{ formatNumber(resultBody.budget_usage?.provider_tokens_used) }}
                    /
                    {{ formatNumber(resultBody.budget_usage?.provider_token_limit) }}
                  </strong>
                </article>
                <article>
                  <span>execution provenance</span>
                  <strong>{{ readableCode(yuLanScaleProvenance) }}</strong>
                </article>
                <article>
                  <span>publication eligible</span>
                  <strong>{{ resultBody.publication_eligible === true ? 'YES' : 'NO' }}</strong>
                </article>
              </div>
            </section>

            <div class="aggregate-v2-downloads">
              <div>
                <strong>结果与正式报告</strong>
                <small v-if="isYuLanScalePublishable">
                  服务端已返回 publication_eligible=true；报告仍由后端再次校验后生成。
                </small>
                <small v-else>
                  当前 provenance 不具备发布资格；页面不会生成本地报告或用 fixture 替代。
                </small>
              </div>
              <router-link
                :to="{
                  path: '/campus-pulse/archive/yulan-scale-v1',
                  query: { run_id: props.run.run_id },
                }"
              >
                打开 YuLan-Scale 结果
              </router-link>
              <button
                type="button"
                :disabled="
                  !canDownloadOfficialReport
                  || Boolean(reportDownloadPending)
                  || reportDownloadUnavailable
                "
                @click="requestAggregateReport('json')"
              >
                {{ reportDownloadPending === 'json' ? '请求中…' : '下载正式 JSON' }}
              </button>
              <button
                type="button"
                :disabled="
                  !canDownloadOfficialReport
                  || Boolean(reportDownloadPending)
                  || reportDownloadUnavailable
                "
                @click="requestAggregateReport('html')"
              >
                {{ reportDownloadPending === 'html' ? '请求中…' : '下载正式 HTML' }}
              </button>
            </div>
            <p
              v-if="isYuLanScaleDevelopment"
              class="runtime-alert blocked aggregate-v2-download-state"
              role="status"
            >
              DEVELOPMENT-ONLY：真实 LLM turns 0；正式报告下载已在客户端禁用，
              后端仍必须独立拒绝。
            </p>
            <p
              v-if="reportDownloadError"
              class="runtime-alert error aggregate-v2-download-state"
              role="alert"
            >
              {{ reportDownloadError }}
            </p>
            <p
              v-if="reportDownloadNotice"
              class="runtime-alert success aggregate-v2-download-state"
              role="status"
            >
              {{ reportDownloadNotice }}
            </p>
          </template>

          <template v-else-if="isGovernanceV2Result">
            <div class="aggregate-v2-warning live" role="note">
              <strong>GOVERNANCE ARENA v2 · ZERO PROVIDER</strong>
              <span>
                这是审计过的千体混合驱动模型运行：fixture 探针是语义传感器，
                不是实时 LLM 调用，也不是现实治理行动。
              </span>
            </div>
            <div class="claim-boundary aggregate-v2-claim">
              <span>campus-pulse-live-aggregate-result-v4</span>
              <strong>1,000 episode parents × 10 SMC particles</strong>
              <small>
                两场景 · 五分支 · 24 时点 · 8 配对种子 ·
                非因果政策效果
              </small>
            </div>
            <section class="aggregate-v2-section">
              <div class="aggregate-v2-section-heading">
                <strong>v2 冻结运行账本</strong>
                <small>结果、manifest 与匿名量化帧均由服务端哈希绑定</small>
              </div>
              <div class="aggregate-v2-budget-grid">
                <article>
                  <span>工作单元</span>
                  <strong>
                    {{ formatNumber(resultBody.completeness?.completed_turns) }}
                    /
                    {{ formatNumber(resultBody.completeness?.required_turns) }}
                  </strong>
                </article>
                <article>
                  <span>冻结语义槽位</span>
                  <strong>{{ formatNumber(resultBody.usage?.fixture_semantic_slots) }}</strong>
                </article>
                <article>
                  <span>Provider calls / tokens</span>
                  <strong>
                    {{ formatNumber(resultBody.usage?.provider_calls) }}
                    /
                    {{ formatNumber(resultBody.usage?.provider_tokens) }}
                  </strong>
                </article>
                <article>
                  <span>粒子帧 / 粒子数</span>
                  <strong>
                    {{ formatNumber(resultBody.visualization_asset?.frame_count) }}
                    /
                    {{ formatNumber(governanceV2Domain.population_identity?.particle_count) }}
                  </strong>
                </article>
              </div>
            </section>
            <div class="aggregate-v2-downloads">
              <div>
                <strong>结果与审计报告</strong>
                <small>结果页以本次 run_id 读取已校验结果和真实量化粒子帧。</small>
              </div>
              <router-link
                :to="{
                  path: '/campus-pulse/governance-arena-v2',
                  query: { run_id: props.run.run_id },
                }"
              >
                打开 v2 结果
              </router-link>
              <button
                type="button"
                :disabled="Boolean(reportDownloadPending) || reportDownloadUnavailable"
                @click="requestAggregateReport('json')"
              >
                {{ reportDownloadPending === 'json' ? '请求中…' : '下载 JSON' }}
              </button>
              <button
                type="button"
                :disabled="Boolean(reportDownloadPending) || reportDownloadUnavailable"
                @click="requestAggregateReport('html')"
              >
                {{ reportDownloadPending === 'html' ? '请求中…' : '下载 HTML' }}
              </button>
            </div>
            <p
              v-if="reportDownloadError"
              class="runtime-alert error aggregate-v2-download-state"
              role="alert"
            >
              {{ reportDownloadError }}
            </p>
            <p
              v-if="reportDownloadNotice"
              class="runtime-alert success aggregate-v2-download-state"
              role="status"
            >
              {{ reportDownloadNotice }}
            </p>
          </template>

          <template v-else-if="isAggregateResultV2">
            <div
              v-if="isFixture"
              class="aggregate-v2-warning fixture"
              role="alert"
            >
              <strong>确定性测试夹具 / DETERMINISTIC TEST FIXTURE</strong>
              <span>
                仅用于验证传输、聚合与页面链路，不可作为治理结论、政策效果或真实舆情判断。
              </span>
            </div>
            <div
              v-else-if="isAuthorizedLiveV2"
              class="aggregate-v2-warning live"
              role="note"
            >
              <strong>授权 LIVE 聚合结果</strong>
              <span>仅展示策略×种子×阶段的群体聚合，不展示任何合成发言、人物画像或来源标识。</span>
            </div>
            <div v-else class="aggregate-v2-warning blocked" role="alert">
              <strong>结果发布边界未通过</strong>
              <span>执行来源、发布状态或可信度边界不完整；页面禁止解释和下载。</span>
            </div>

            <div class="claim-boundary aggregate-v2-claim">
              <span>结果层级 model_conditional_simulation</span>
              <strong>模型条件模拟 · 非因果识别 · 非预测 · 非总体民意</strong>
              <small>
                {{
                  aggregateV2BoundaryValid
                    ? '可信度边界合同完整'
                    : '可信度边界合同不匹配'
                }}
              </small>
              <div class="aggregate-v2-boundary-list">
                <span
                  v-for="entry in aggregateV2BoundaryEntries"
                  :key="entry.key"
                  :class="{ invalid: !entry.valid }"
                >
                  {{ entry.label }}={{ entry.status }}
                </span>
              </div>
            </div>

            <section class="aggregate-v2-section">
              <div class="aggregate-v2-section-heading">
                <strong>执行预算与消耗边界</strong>
                <small>只读服务端计数，不根据缺失值推算</small>
              </div>
              <div class="aggregate-v2-budget-grid">
                <article>
                  <span>智能体轮次</span>
                  <strong>
                    {{ formatNumber(aggregateV2Budget.turns_completed) }} /
                    {{ formatNumber(aggregateV2Budget.expected_agent_turns) }}
                  </strong>
                </article>
                <article>
                  <span>
                    {{ isDeterministicFixtureV2 ? '夹具 transport 调用' : 'Provider 调用' }}
                  </span>
                  <strong>
                    {{ formatNumber(aggregateV2Budget.provider_calls_completed) }} /
                    {{ formatNumber(aggregateV2Budget.effective_provider_call_limit) }}
                  </strong>
                  <small>
                    known {{ formatNumber(aggregateV2Budget.provider_calls_known) }} ·
                    unknown {{ formatNumber(aggregateV2Budget.provider_calls_unknown) }}
                  </small>
                </article>
                <article>
                  <span>
                    {{ isDeterministicFixtureV2 ? '合成 Token 账本' : '风险计费 Token' }}
                  </span>
                  <strong>
                    {{ formatNumber(aggregateV2Budget.risk_charged_tokens) }} /
                    {{ formatNumber(aggregateV2Budget.effective_token_limit) }}
                  </strong>
                  <small>
                    {{ isDeterministicFixtureV2 ? 'synthetic reported' : 'provider reported' }}
                    {{ formatNumber(aggregateV2Budget.provider_reported_tokens) }}
                  </small>
                </article>
                <article>
                  <span>并发峰值</span>
                  <strong>
                    {{ formatNumber(aggregateV2Budget.peak_concurrency) }} /
                    {{ formatNumber(aggregateV2Budget.effective_concurrency_limit) }}
                  </strong>
                  <small>
                    cache hits {{ formatNumber(aggregateV2Budget.cache_hits) }} ·
                    active {{ formatNumber(aggregateV2Budget.active_attempts) }}
                  </small>
                </article>
              </div>
              <p class="aggregate-v2-budget-note">
                调用上限：plan
                {{ formatNumber(aggregateV2Budget.plan_provider_call_limit) }} ·
                authorization
                {{ formatNumber(aggregateV2Budget.authorization_provider_call_cap) }} ·
                reserved
                {{ formatNumber(aggregateV2Budget.provider_calls_reserved) }}；
                Token 上限：plan
                {{ formatNumber(aggregateV2Budget.plan_token_limit) }} ·
                authorization
                {{ formatNumber(aggregateV2Budget.authorization_token_cap) }} ·
                in-flight
                {{ formatNumber(aggregateV2Budget.tokens_in_flight) }}。
              </p>
            </section>

            <section class="aggregate-v2-section">
              <div class="aggregate-v2-section-heading">
                <strong>策略 × 种子 × 阶段聚合对比</strong>
                <small>仅呈现 complete 分布的主项与分母</small>
              </div>
              <div v-if="aggregateV2Breakdowns.length" class="aggregate-v2-breakdowns">
                <article
                  v-for="row in aggregateV2Breakdowns"
                  :key="row.id"
                >
                  <span>{{ row.policy }} · seed {{ row.seed }} · {{ row.phase }}</span>
                  <strong>{{ distributionSummary(row.stance, '立场') }}</strong>
                  <strong>{{ distributionSummary(row.action, '行动') }}</strong>
                  <small>
                    turns {{ formatNumber(row.completedTurns) }} /
                    {{ formatNumber(row.expectedTurns) }} ·
                    分母
                    {{ formatNumber(row.stance?.total_count ?? row.action?.total_count) }}
                  </small>
                </article>
              </div>
              <p v-else class="result-contract-note">
                没有可发布的阶段聚合；页面不推导缺失分布。
              </p>
            </section>

            <section class="aggregate-v2-section">
              <div class="aggregate-v2-section-heading">
                <strong>跨种子 variation</strong>
                <small>距离越高，结果对随机种子越敏感</small>
              </div>
              <div v-if="aggregateV2VariationRows.length" class="aggregate-v2-variation">
                <article
                  v-for="row in aggregateV2VariationRows"
                  :key="row.id"
                >
                  <span>{{ row.policy }} · {{ row.phase }} · {{ row.dimension }}</span>
                  <strong>mean {{ formatPpm(row.mean) }}</strong>
                  <small>
                    range {{ formatPpm(row.minimum) }}–{{ formatPpm(row.maximum) }} ·
                    seed pairs {{ formatNumber(row.seedPairCount) }} ·
                    {{ row.status }}
                  </small>
                </article>
              </div>
              <p v-else class="result-contract-note">
                当前聚合合同没有可发布的跨种子 variation。
              </p>
            </section>

            <div v-if="isFixture" class="aggregate-v2-downloads fixture-only">
              <button class="export-disabled" type="button" disabled>
                确定性测试夹具不可下载，也不可作为治理结论
              </button>
            </div>
            <div
              v-else-if="isAuthorizedLiveV2"
              class="aggregate-v2-downloads"
            >
              <div>
                <strong>服务端报告下载</strong>
                <small>
                  仅请求固定报告路由；后端未开放时明确失败，不在浏览器生成替代报告。
                </small>
              </div>
              <button
                type="button"
                :disabled="Boolean(reportDownloadPending) || reportDownloadUnavailable"
                @click="requestAggregateReport('json')"
              >
                {{ reportDownloadPending === 'json' ? '请求中…' : '下载 JSON' }}
              </button>
              <button
                type="button"
                :disabled="Boolean(reportDownloadPending) || reportDownloadUnavailable"
                @click="requestAggregateReport('html')"
              >
                {{ reportDownloadPending === 'html' ? '请求中…' : '下载 HTML' }}
              </button>
            </div>
            <button v-else class="export-disabled" type="button" disabled>
              发布或可信度边界未通过，报告不可下载
            </button>
            <p
              v-if="reportDownloadError"
              class="runtime-alert error aggregate-v2-download-state"
              role="alert"
            >
              {{ reportDownloadError }}
            </p>
            <p
              v-if="reportDownloadNotice"
              class="runtime-alert success aggregate-v2-download-state"
              role="status"
            >
              {{ reportDownloadNotice }}
            </p>
          </template>

          <template v-else>
            <div class="claim-boundary">
              <span>结果层级 {{ resultClaim.kind }}</span>
              <strong>模型条件模拟 · 非因果识别 · 非预测</strong>
              <small>
                causal_status={{ resultClaim.causal }} ·
                forecast_status={{ resultClaim.forecast }}
              </small>
            </div>

            <div v-if="resultBreakdowns.length" class="breakdown-list">
              <article
                v-for="row in resultBreakdowns"
                :key="row.id"
              >
                <span>{{ row.policy }} · 种子 {{ row.seed }}</span>
                <strong>{{ distributionSummary(row.stance, '立场') }}</strong>
                <strong>{{ distributionSummary(row.action, '行动') }}</strong>
                <small>
                  {{ formatNumber(row.denominator) }} 个智能体 ·
                  模型条件 · 非因果 · 非预测
                </small>
              </article>
            </div>
            <p v-else class="result-contract-note">
              聚合合同已返回，但没有可公开的政策—种子分解；页面不推导缺失分布。
            </p>

            <button class="export-disabled" type="button" disabled>
              {{
                isFixture
                  ? '测试夹具禁止导出为治理结论'
                  : 'P3.1 聚合结果导出尚未开放'
              }}
            </button>
          </template>
        </div>
        <div v-else class="empty-runtime-state">
          正在等候服务端返回已校验的聚合结果。
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.runtime-panel {
  background:
    radial-gradient(circle at 88% 0%, rgba(117, 226, 189, 0.08), transparent 32%),
    rgba(7, 24, 20, 0.72);
  border: 1px solid rgba(174, 232, 209, 0.12);
  border-radius: 1.1rem;
  color: #eaf9f2;
  margin-top: 1.1rem;
  overflow: hidden;
  padding: 1.2rem;
}

.runtime-heading,
.runtime-actions,
.subsection-heading {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
}

.runtime-heading {
  gap: 1.4rem;
}

.subsection-heading span,
.runtime-whitelist > span {
  color: #76e2bd;
  font-size: 0.67rem;
  font-weight: 800;
  letter-spacing: 0.11em;
  margin: 0 0 0.35rem;
}

.runtime-heading h3 {
  font-family: Georgia, 'Noto Serif SC', serif;
  font-size: 1.25rem;
  margin: 0;
}

.runtime-heading > div > p {
  color: #88a99e;
  font-size: 0.78rem;
  line-height: 1.6;
  margin: 0.45rem 0 0;
}

.runtime-heading-meta {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 11rem;
}

.runtime-heading-meta code,
.runtime-heading-meta small {
  color: #6f9085;
  font-size: 0.67rem;
}

.runtime-whitelist,
.fixture-notice,
.runtime-alert {
  border-radius: 0.78rem;
  margin-top: 1rem;
  padding: 0.8rem 0.9rem;
}

.runtime-whitelist {
  background: rgba(112, 225, 187, 0.06);
  border: 1px solid rgba(112, 225, 187, 0.14);
  display: grid;
  gap: 0.22rem;
}

.runtime-whitelist strong {
  color: #dff8ee;
  font-size: 0.86rem;
}

.runtime-whitelist small {
  color: #799b90;
  line-height: 1.5;
}

.live-capability-panel {
  background:
    linear-gradient(130deg, rgba(119, 151, 241, 0.09), transparent 46%),
    rgba(5, 18, 24, 0.72);
  border: 1px solid rgba(141, 176, 241, 0.16);
  border-radius: 0.82rem;
  margin-top: 1rem;
  padding: 0.9rem;
}

.live-capability-heading {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.live-capability-heading span,
.live-capability-heading strong {
  display: block;
}

.live-capability-heading span {
  color: #9ab9ff;
  font-size: 0.61rem;
  font-weight: 800;
  letter-spacing: 0.11em;
}

.live-capability-heading strong {
  font-size: 0.88rem;
  margin-top: 0.3rem;
}

.live-capability-heading small {
  color: #8296ba;
  font-size: 0.63rem;
  text-align: right;
}

.live-capability-states,
.live-contract-metrics {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.72rem;
}

.live-capability-states {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.live-contract-metrics {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.live-capability-states article,
.live-contract-metrics article {
  background: rgba(7, 22, 28, 0.76);
  border: 1px solid rgba(151, 182, 239, 0.1);
  border-radius: 0.62rem;
  min-width: 0;
  padding: 0.64rem;
}

.live-capability-states article.ready {
  border-color: rgba(112, 225, 187, 0.24);
}

.live-capability-states article.blocked {
  border-color: rgba(255, 143, 116, 0.22);
}

.live-capability-states article.neutral,
.live-capability-states article.unknown {
  border-color: rgba(169, 149, 255, 0.16);
}

.live-capability-states span,
.live-capability-states small,
.live-contract-metrics span,
.live-contract-metrics small {
  color: #6f87a6;
  display: block;
  font-size: 0.59rem;
  line-height: 1.45;
}

.live-capability-states strong,
.live-contract-metrics strong {
  display: block;
  font-size: 0.74rem;
  line-height: 1.45;
  margin-top: 0.28rem;
  overflow-wrap: anywhere;
}

.live-capability-states article.ready strong {
  color: #b9efdd;
}

.live-capability-states article.blocked strong {
  color: #ffb39f;
}

.live-capability-states small,
.live-contract-metrics small {
  margin-top: 0.3rem;
  overflow-wrap: anywhere;
}

.live-contract-metrics strong {
  color: #cbd8fb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.86rem;
}

.live-claim-boundary {
  border-top: 1px solid rgba(145, 177, 238, 0.1);
  color: #768da9;
  font-size: 0.65rem;
  line-height: 1.6;
  margin: 0.72rem 0 0;
  padding-top: 0.62rem;
}

.live-claim-boundary code {
  color: #9eb4df;
  display: block;
  margin-top: 0.24rem;
  overflow-wrap: anywhere;
}

.fixture-notice {
  align-items: center;
  background: rgba(244, 188, 106, 0.1);
  border: 1px solid rgba(244, 188, 106, 0.28);
  color: #f4cf94;
  display: flex;
  font-size: 0.77rem;
  gap: 0.8rem;
  line-height: 1.5;
}

.fixture-notice strong {
  flex: 0 0 auto;
  letter-spacing: 0.08em;
}

.runtime-state-rail {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin: 1.15rem 0;
}

.runtime-state {
  align-items: center;
  color: #58766c;
  display: flex;
  gap: 0.36rem;
  min-width: 0;
}

.runtime-state > span {
  background: #284039;
  border-radius: 50%;
  flex: 0 0 auto;
  height: 0.45rem;
  width: 0.45rem;
}

.runtime-state small {
  font-size: 0.62rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-state.current {
  color: #baf2de;
}

.runtime-state.current > span {
  background: #76e2bd;
  box-shadow: 0 0 0 4px rgba(118, 226, 189, 0.11);
}

.runtime-metrics {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.runtime-metrics article,
.event-panel,
.result-panel {
  background: rgba(6, 19, 16, 0.68);
  border: 1px solid rgba(179, 233, 211, 0.1);
  border-radius: 0.85rem;
}

.runtime-metrics article {
  min-width: 0;
  padding: 0.85rem;
}

.runtime-metrics article > span {
  color: #719187;
  display: block;
  font-size: 0.66rem;
}

.runtime-metrics strong {
  display: block;
  font-size: 0.86rem;
  line-height: 1.4;
  margin-top: 0.35rem;
  overflow-wrap: anywhere;
}

.runtime-metrics small {
  color: #66877c;
  display: block;
  font-size: 0.63rem;
  line-height: 1.45;
  margin-top: 0.42rem;
}

.metric-track {
  background: #172e27;
  border-radius: 999px;
  height: 0.26rem;
  margin-top: 0.55rem;
  overflow: hidden;
}

.metric-track span {
  background: #76e2bd;
  display: block;
  height: 100%;
}

.metric-track.token span {
  background: #a995ff;
}

.runtime-alert {
  font-size: 0.76rem;
  line-height: 1.5;
}

.runtime-alert.blocked,
.runtime-alert.error {
  background: rgba(255, 143, 116, 0.08);
  border: 1px solid rgba(255, 143, 116, 0.2);
  color: #ffb19d;
}

.runtime-alert.blocked {
  display: grid;
  gap: 0.25rem;
}

.runtime-alert.success {
  background: rgba(112, 225, 187, 0.08);
  border: 1px solid rgba(112, 225, 187, 0.18);
  color: #a9eed6;
}

.runtime-actions {
  align-items: center;
  border-bottom: 1px solid rgba(178, 231, 210, 0.1);
  gap: 0.55rem;
  margin-top: 1rem;
  padding-bottom: 1rem;
}

.runtime-actions > div {
  color: #6c8c81;
  flex: 1;
  font-size: 0.68rem;
  line-height: 1.5;
}

.runtime-actions button {
  border-radius: 0.62rem;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  min-height: 2.25rem;
  padding: 0.52rem 0.78rem;
}

.runtime-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.secondary-action {
  background: transparent;
  border: 1px solid rgba(178, 231, 210, 0.18);
  color: #a5c7bb;
}

.primary-action {
  background: #76e2bd;
  border: 1px solid #76e2bd;
  color: #082019;
}

.danger-action {
  background: rgba(255, 143, 116, 0.08);
  border: 1px solid rgba(255, 143, 116, 0.3);
  color: #ffad97;
}

.runtime-lower-grid {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  margin-top: 1rem;
}

.event-panel,
.result-panel {
  min-width: 0;
  padding: 0.9rem;
}

.subsection-heading {
  gap: 0.8rem;
}

.subsection-heading strong {
  display: block;
  font-size: 0.85rem;
}

.subsection-heading small {
  color: #628278;
  font-size: 0.61rem;
  overflow-wrap: anywhere;
  text-align: right;
}

.event-list {
  display: grid;
  gap: 0.45rem;
  list-style: none;
  margin: 0.8rem 0 0;
  padding: 0;
}

.event-list li {
  align-items: center;
  border-top: 1px solid rgba(174, 230, 208, 0.07);
  display: grid;
  gap: 0.5rem;
  grid-template-columns: 2.6rem minmax(0, 1fr) auto;
  padding-top: 0.45rem;
}

.event-list li > span,
.event-list time {
  color: #607e74;
  font-size: 0.61rem;
}

.event-list strong {
  font-size: 0.72rem;
}

.empty-runtime-state {
  color: #6f8e83;
  display: grid;
  font-size: 0.72rem;
  gap: 0.35rem;
  line-height: 1.6;
  margin-top: 0.8rem;
  min-height: 4.6rem;
  place-content: center;
  text-align: center;
}

.result-missing strong {
  color: #f4cf94;
}

.result-content {
  margin-top: 0.8rem;
}

.aggregate-v2-warning {
  border: 1px solid;
  border-radius: 0.68rem;
  display: grid;
  font-size: 0.68rem;
  gap: 0.22rem;
  line-height: 1.55;
  margin-bottom: 0.7rem;
  padding: 0.68rem;
}

.aggregate-v2-warning.fixture {
  background: rgba(255, 164, 91, 0.12);
  border-color: rgba(255, 183, 114, 0.5);
  color: #ffd09e;
}

.aggregate-v2-warning.live {
  background: rgba(112, 225, 187, 0.08);
  border-color: rgba(112, 225, 187, 0.24);
  color: #a9eed6;
}

.aggregate-v2-warning.blocked {
  background: rgba(255, 143, 116, 0.08);
  border-color: rgba(255, 143, 116, 0.25);
  color: #ffb19d;
}

.claim-boundary {
  background: rgba(169, 149, 255, 0.08);
  border: 1px solid rgba(169, 149, 255, 0.17);
  border-radius: 0.68rem;
  display: grid;
  gap: 0.2rem;
  padding: 0.7rem;
}

.claim-boundary span,
.claim-boundary small {
  color: #9a8fc9;
  font-size: 0.62rem;
  overflow-wrap: anywhere;
}

.claim-boundary strong {
  color: #d9d1ff;
  font-size: 0.8rem;
}

.aggregate-v2-boundary-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  margin-top: 0.35rem;
}

.aggregate-v2-boundary-list span {
  background: rgba(169, 149, 255, 0.08);
  border: 1px solid rgba(169, 149, 255, 0.16);
  border-radius: 999px;
  color: #b4a9e9;
  padding: 0.2rem 0.36rem;
}

.aggregate-v2-boundary-list span.invalid {
  border-color: rgba(255, 143, 116, 0.35);
  color: #ffad97;
}

.aggregate-v2-section {
  border-top: 1px solid rgba(178, 232, 210, 0.08);
  margin-top: 0.75rem;
  padding-top: 0.7rem;
}

.aggregate-v2-section-heading {
  align-items: baseline;
  display: flex;
  gap: 0.65rem;
  justify-content: space-between;
}

.aggregate-v2-section-heading strong {
  font-size: 0.76rem;
}

.aggregate-v2-section-heading small {
  color: #66877c;
  font-size: 0.6rem;
  text-align: right;
}

.aggregate-v2-budget-grid {
  display: grid;
  gap: 0.42rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.55rem;
}

.aggregate-v2-budget-grid article,
.aggregate-v2-breakdowns article,
.aggregate-v2-variation article {
  border: 1px solid rgba(178, 232, 210, 0.08);
  border-radius: 0.58rem;
  display: grid;
  gap: 0.18rem;
  min-width: 0;
  padding: 0.55rem;
}

.aggregate-v2-budget-grid span,
.aggregate-v2-budget-grid small,
.aggregate-v2-breakdowns span,
.aggregate-v2-breakdowns small,
.aggregate-v2-variation span,
.aggregate-v2-variation small {
  color: #6f8e84;
  font-size: 0.6rem;
  overflow-wrap: anywhere;
}

.aggregate-v2-budget-grid strong,
.aggregate-v2-breakdowns strong,
.aggregate-v2-variation strong {
  font-size: 0.72rem;
}

.aggregate-v2-budget-note {
  color: #66877c;
  font-size: 0.6rem;
  line-height: 1.55;
  margin: 0.45rem 0 0;
}

.aggregate-v2-breakdowns,
.aggregate-v2-variation {
  display: grid;
  gap: 0.42rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.55rem;
  max-height: 22rem;
  overflow: auto;
  padding-right: 0.12rem;
}

.aggregate-v2-downloads {
  align-items: center;
  border-top: 1px solid rgba(178, 232, 210, 0.08);
  display: flex;
  gap: 0.45rem;
  margin-top: 0.75rem;
  padding-top: 0.7rem;
}

.aggregate-v2-downloads > div {
  display: grid;
  flex: 1;
  gap: 0.18rem;
}

.aggregate-v2-downloads strong {
  font-size: 0.72rem;
}

.aggregate-v2-downloads small {
  color: #6f8e84;
  font-size: 0.6rem;
  line-height: 1.5;
}

.aggregate-v2-downloads button,
.aggregate-v2-downloads > a {
  background: transparent;
  border: 1px solid rgba(112, 225, 187, 0.28);
  border-radius: 0.55rem;
  color: #a9eed6;
  cursor: pointer;
  font-size: 0.66rem;
  min-height: 2rem;
  padding: 0.4rem 0.56rem;
  text-align: center;
  text-decoration: none;
}

.aggregate-v2-downloads button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.aggregate-v2-downloads.fixture-only {
  display: block;
}

.aggregate-v2-download-state {
  margin-top: 0.55rem;
}

.breakdown-list {
  display: grid;
  gap: 0.42rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.7rem;
}

.breakdown-list article {
  border: 1px solid rgba(178, 232, 210, 0.08);
  border-radius: 0.6rem;
  display: grid;
  gap: 0.18rem;
  min-width: 0;
  padding: 0.58rem;
}

.breakdown-list span,
.breakdown-list small {
  color: #6f8e84;
  font-size: 0.61rem;
  overflow-wrap: anywhere;
}

.breakdown-list strong {
  font-size: 0.75rem;
}

.result-contract-note {
  color: #77978c;
  font-size: 0.7rem;
  line-height: 1.55;
}

.export-disabled {
  background: transparent;
  border: 1px dashed rgba(244, 188, 106, 0.25);
  border-radius: 0.6rem;
  color: #947e5d;
  cursor: not-allowed;
  font-size: 0.68rem;
  margin-top: 0.7rem;
  padding: 0.52rem 0.7rem;
  width: 100%;
}

@media (max-width: 980px) {
  .runtime-state-rail {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .runtime-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .live-capability-states {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .live-contract-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .runtime-lower-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .runtime-panel {
    padding: 0.9rem;
  }

  .runtime-heading,
  .runtime-actions,
  .fixture-notice,
  .live-capability-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .runtime-heading-meta {
    align-items: flex-start;
    min-width: 0;
  }

  .runtime-state-rail,
  .runtime-metrics,
  .breakdown-list,
  .aggregate-v2-budget-grid,
  .aggregate-v2-breakdowns,
  .aggregate-v2-variation,
  .live-capability-states,
  .live-contract-metrics {
    grid-template-columns: 1fr;
  }

  .aggregate-v2-downloads,
  .aggregate-v2-section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .runtime-state small {
    white-space: normal;
  }

  .runtime-actions button {
    width: 100%;
  }

  .event-list li {
    grid-template-columns: 2.5rem minmax(0, 1fr);
  }

  .event-list time {
    grid-column: 2;
  }
}

/* Match the product shell while preserving all runtime states. */
.runtime-panel {
  background: #ffffff;
  border-color: #dcdcdc;
  border-radius: 0;
  border-top: 4px solid #ae0b2a;
  color: #111111;
}
.subsection-heading span,
.runtime-whitelist > span,
.live-capability-heading span { color: #ae0b2a; }
.runtime-heading h3,
.runtime-whitelist strong,
.live-capability-heading strong,
.subsection-heading strong,
.aggregate-v2-section-heading strong,
.aggregate-v2-downloads strong,
.breakdown-list strong { color: #111111; }
.runtime-heading > div > p,
.runtime-heading-meta code,
.runtime-heading-meta small,
.runtime-whitelist small,
.live-capability-heading small,
.live-claim-boundary,
.runtime-metrics span,
.runtime-metrics small,
.subsection-heading small,
.empty-runtime-state,
.claim-boundary span,
.claim-boundary small,
.aggregate-v2-section-heading small,
.aggregate-v2-budget-grid span,
.aggregate-v2-budget-grid small,
.aggregate-v2-breakdowns span,
.aggregate-v2-breakdowns small,
.aggregate-v2-variation span,
.aggregate-v2-variation small,
.breakdown-list span,
.breakdown-list small,
.result-contract-note { color: #727272; }
.runtime-whitelist,
.live-capability-panel,
.runtime-metrics article,
.event-panel,
.result-panel,
.live-capability-states article,
.live-contract-metrics article,
.aggregate-v2-budget-grid article,
.aggregate-v2-breakdowns article,
.aggregate-v2-variation article,
.breakdown-list article,
.aggregate-v2-downloads,
.claim-boundary {
  background: #fafafa;
  border-color: #dedede;
  border-radius: 0;
  color: #111111;
}
.live-capability-panel { border-left: 4px solid #9b8a5c; }
.live-capability-states article.ready { border-color: #9b8a5c; }
.live-capability-states article.blocked { border-color: #ae0b2a; }
.live-capability-states article.ready strong { color: #526e32; }
.live-capability-states article.blocked strong { color: #ae0b2a; }
.live-capability-states strong,
.live-contract-metrics strong { color: #111111; }
.runtime-state { color: #8a8a8a; }
.runtime-state > span { background: #c4c4c4; }
.runtime-state.current { color: #ae0b2a; }
.runtime-state.current > span { background: #ae0b2a; box-shadow: 0 0 0 3px #f9d9e0; }
.runtime-metrics strong { color: #111111; }
.metric-track { background: #e7e7e7; }
.metric-track span { background: #ae0b2a; }
.metric-track.token span { background: #9b8a5c; }
.secondary-action { background: #ffffff; border-color: #cfcfcf; color: #333333; }
.primary-action { background: #ae0b2a; border-color: #ae0b2a; color: #ffffff; }
.danger-action { background: #fff3f5; border-color: #dba9b4; color: #ae0b2a; }
.event-list li { background: #ffffff; border-color: #e1e1e1; color: #333333; }
.fixture-notice { background: #fff6e7; border-color: #e8c784; color: #8b6416; }
.runtime-alert.success { background: #f3f8ef; border-color: #b3cb9e; color: #4d6c34; }
.runtime-alert.blocked,
.runtime-alert.error { background: #fff3f5; border-color: #dcadb7; color: #ae0b2a; }
.aggregate-v2-downloads button,
.aggregate-v2-downloads > a { background: #111111; border-color: #111111; color: #ffffff; }
.export-disabled { border-color: #d8bf84; border-radius: 0; color: #8a6e2f; }
</style>
