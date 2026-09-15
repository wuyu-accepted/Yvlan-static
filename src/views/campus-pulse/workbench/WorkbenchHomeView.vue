<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import EvidenceBadge from '../../../components/campus-pulse/EvidenceBadge.vue'
import RunExecutionPanel from '../../../components/campus-pulse/RunExecutionPanel.vue'
import WindowedSensingWorkbench from '../../../components/campus-pulse/WindowedSensingWorkbench.vue'
import {
  activateProjectSensingSnapshot,
  bootstrapProject,
  createProject,
  getLiveRuntimeCapability,
  getProjectSensingState,
  getWorkbenchHealth,
  getWorkbenchOverview,
  getWorkbenchReadiness,
  listProjectEvidence,
  listProjectPolicies,
  listProjectRuns,
  listProjectScenarios,
  listProjectSensingSnapshots,
  listProjects,
  planProjectRun,
  readableApiError,
} from '../../../services/campusPulseApi'

const loading = ref(true)
const creating = ref(false)
const bootstrapping = ref(null)
const planningRun = ref(false)
const serviceError = ref('')
const actionError = ref('')
const detailError = ref('')
const actionNotice = ref('')
const sensingActionError = ref('')
const sensingActionNotice = ref('')
const showCreateForm = ref(false)
const health = ref(null)
const readiness = ref(null)
const liveCapability = ref(null)
const liveCapabilityLoading = ref(false)
const liveCapabilityError = ref('')
const workspaceStale = ref(false)
const lastSuccessfulSync = ref(null)
const activatingSensingSnapshotId = ref(null)
const sensingLoadStatus = ref({
  list: 'idle',
  state: 'idle',
})
const overview = ref({
  projects: 0,
  scenarios: 0,
  policies: 0,
  runs: 0,
  reports: 0,
  evidence_snapshots: 0,
  project_evidence_bindings: 0,
  sensing_snapshots: 0,
  project_sensing_bindings: 0,
})
const projects = ref([])
const selectedProjectId = ref(null)
const selectedDetails = ref({
  scenarios: [],
  policies: [],
  runs: [],
  evidence: [],
  sensingSnapshots: [],
  sensingState: null,
})
const detailLoading = ref(false)
const plannedRun = ref(null)
const selectedRuntimeRunId = ref(null)

let refreshRequestGeneration = 0
let detailRequestGeneration = 0
let pendingRunRequest = null

const form = reactive({
  name: '',
  governance_domain: '校园公共沟通',
  objective: '',
  evaluation_mode: 'simulation_stress_test',
  initialize_templates: true,
})

const runForm = reactive({
  scenario_id: '',
  policy_ids: [],
  execution_mode: 'audited_replay',
  agent_count: 48,
  seeds: '20260722, 20261731',
  max_workers: 32,
  token_budget: 2000000,
  model_name: 'gpt-5.6-sol',
  population_release_id: 'persona-release-v1-reviewed-17x3',
})

const connected = computed(
  () => (
    health.value?.status === 'healthy'
    && readiness.value?.status === 'ready'
    && !workspaceStale.value
  ),
)
const selectedProject = computed(() =>
  projects.value.find((project) => project.project_id === selectedProjectId.value),
)
const hasBaseline = computed(() =>
  selectedDetails.value.policies.some((policy) => policy.is_baseline),
)
const reviewedScenarioTemplateKeys = [
  'tongzhou_governance_notice_v2',
  'lecture_external_incident_v2',
]
const reviewedPolicyTemplateKeys = [
  'natural_evolution_v2',
  'combined_governance_v2',
]
const reviewedRuntimeScenarioTemplateKeys = [
  'tongzhou_governance_notice_v2',
  'lecture_external_incident_v2',
]
const runtimePolicyTemplateWhitelist = {
  tongzhou_governance_notice_v2: [
    'natural_evolution_v2',
    'combined_governance_v2',
  ],
  lecture_external_incident_v2: [
    'natural_evolution_v2',
  ],
}
const governanceV2Seeds = [
  20260722,
  20261731,
  20262740,
  20263749,
  20264758,
  20265767,
  20266776,
  20267785,
]
const isGovernanceV2Mode = computed(
  () => runForm.execution_mode === 'adaptive_particle_population',
)
const isYuLanScaleMode = computed(
  () => runForm.execution_mode === 'budgeted_llm_agent_population',
)
const isForumTwinMode = computed(
  () => runForm.execution_mode === 'llm_forum_twin',
)
const isLockedPopulationMode = computed(
  () => isGovernanceV2Mode.value || isYuLanScaleMode.value || isForumTwinMode.value,
)
const reviewedWindowedSensingReleaseKey =
  'campus-forum-windowed-sensing-v1-reviewed'
const reviewedWindowIds = [
  'matched_nonshock_reference',
  'tongzhou_governance_shock',
  'lecture_external_shock',
]
const issueDomainLabels = {
  academic_and_learning: '学习与课程',
  career_and_opportunity: '生涯与机会',
  campus_services_and_rules: '校园服务与规则',
  relationships_and_belonging: '关系与归属',
  wellbeing_and_support: '身心支持',
  consumption_and_exchange: '消费与交易',
  public_discourse_and_norms: '公共讨论与规范',
  leisure_and_culture: '休闲与文化',
  other_or_ambiguous: '其他或语义不明',
}
const stanceLabels = {
  supportive: '支持',
  neutral: '中性',
  concerned: '担忧',
  critical: '批评',
  ambivalent: '矛盾',
}
const determinacyLabels = {
  clear: '含义清楚',
  partially_ambiguous: '部分歧义',
  context_required: '需要语境',
  non_semantic_noise: '非语义噪声',
}
const primaryEvidence = computed(
  () =>
    selectedDetails.value.evidence.find((snapshot) => snapshot.is_primary)
    || selectedDetails.value.evidence[0]
    || null,
)
const hasPrimaryEvidence = computed(() =>
  selectedDetails.value.evidence.some((snapshot) => snapshot.is_primary),
)
const runnableScenarios = computed(() =>
  selectedDetails.value.scenarios.filter(
    (scenario) =>
      scenario.evidence_binding_status === 'sealed'
      && reviewedRuntimeScenarioTemplateKeys.includes(scenario.template_key),
  ),
)
const selectedPlannerScenario = computed(() =>
  selectedDetails.value.scenarios.find(
    (scenario) => scenario.scenario_id === runForm.scenario_id,
  ) || null,
)
const allowedRunPolicies = computed(() => {
  const allowedTemplateKeys = isLockedPopulationMode.value
    ? reviewedPolicyTemplateKeys
    : runtimePolicyTemplateWhitelist[
      selectedPlannerScenario.value?.template_key
    ] || []
  return selectedDetails.value.policies.filter(
    (policy) => allowedTemplateKeys.includes(policy.template_key),
  )
})
const selectedRuntimeRun = computed(() =>
  selectedDetails.value.runs.find(
    (run) => run.run_id === selectedRuntimeRunId.value,
  )
  || (
    plannedRun.value?.run_id === selectedRuntimeRunId.value
      ? plannedRun.value
      : null
  )
  || null,
)
const selectedRuntimeScenario = computed(() => {
  if (!selectedRuntimeRun.value) return null
  return selectedDetails.value.scenarios.find(
    (scenario) => scenario.scenario_id === selectedRuntimeRun.value.scenario_id,
  ) || null
})
const runSeedCount = computed(() => String(runForm.seeds)
  .split(/[\s,，]+/)
  .map((value) => value.trim())
  .filter(Boolean)
  .length)
const plannedAgentTurns = computed(() => {
  if (isLockedPopulationMode.value) return 1_728
  const agents = Number(runForm.agent_count)
  const policies = runForm.policy_ids.length
  if (
    !Number.isSafeInteger(agents)
    || agents < 1
    || runSeedCount.value < 1
    || policies < 1
  ) return null
  return agents * runSeedCount.value * (1 + 3 * policies)
})
const plannedTokenEstimate = computed(() => {
  if (isGovernanceV2Mode.value) return 0
  if (isYuLanScaleMode.value) return 40_000_000
  if (plannedAgentTurns.value === null) return null
  return Math.round(
    plannedAgentTurns.value * (runForm.policy_ids.length >= 2 ? 2527 : 2300),
  )
})
const recommendedRunTokenBudget = computed(() => {
  if (isGovernanceV2Mode.value) return 1_000
  if (isYuLanScaleMode.value) return 40_000_000
  if (plannedTokenEstimate.value === null) return null
  return Math.ceil(plannedTokenEstimate.value * 1.15 / 100000) * 100000
})
const reviewedTemplatesReady = computed(
  () =>
    reviewedScenarioTemplateKeys.every(
      (templateKey) =>
        selectedDetails.value.scenarios.some(
          (scenario) =>
            scenario.template_key === templateKey
            && scenario.evidence_binding_status === 'sealed',
        ),
    )
    && reviewedPolicyTemplateKeys.every(
      (templateKey) =>
        selectedDetails.value.policies.some(
          (policy) => policy.template_key === templateKey,
        ),
    )
    && hasPrimaryEvidence.value
    && projectSensingState.value.status === 'active'
    && (
      projectSensingState.value.snapshot?.release_key
      === reviewedWindowedSensingReleaseKey
    ),
)
const postsEvidenceSource = computed(
  () => primaryEvidence.value?.sources?.find((source) => source.role === 'posts'),
)
const commentsEvidenceSource = computed(
  () => primaryEvidence.value?.sources?.find((source) => source.role === 'comments'),
)
const projectSensingState = computed(
  () => selectedDetails.value.sensingState || {
    status: 'not_configured',
    state_version: 0,
    active_snapshot_id: null,
    activated_at: null,
    snapshot: null,
  },
)
const activeSensingSnapshot = computed(() => {
  const state = projectSensingState.value
  if (state.status !== 'active' || !state.active_snapshot_id) return null
  if (state.snapshot?.snapshot_id === state.active_snapshot_id) {
    return state.snapshot
  }
  const attachedSnapshot = selectedDetails.value.sensingSnapshots.find(
    (snapshot) => snapshot.snapshot_id === state.active_snapshot_id,
  )
  if (attachedSnapshot) return attachedSnapshot
  return null
})
const isWindowedSensingSnapshot = computed(() => {
  const snapshot = activeSensingSnapshot.value
  if (
    snapshot?.release_key !== reviewedWindowedSensingReleaseKey
    || snapshot?.schema_version
      !== 'campus-pulse-windowed-sensing-release-v1'
    || snapshot?.composition_status !== 'sealed'
    || Number(snapshot?.window_count) !== reviewedWindowIds.length
  ) return false
  const availableWindowIds = new Set(
    (Array.isArray(snapshot.windows) ? snapshot.windows : [])
      .map((window) => window.window_id),
  )
  return reviewedWindowIds.every((windowId) => availableWindowIds.has(windowId))
})
const sensingStateIsPartial = computed(() => {
  if (
    sensingLoadStatus.value.list === 'error'
    || sensingLoadStatus.value.state === 'error'
  ) return true
  const state = projectSensingState.value
  if (state.status === 'active' && !activeSensingSnapshot.value) return true
  const serverActiveIds = selectedDetails.value.sensingSnapshots
    .filter((snapshot) => snapshot.is_active)
    .map((snapshot) => snapshot.snapshot_id)
  if (state.status === 'not_configured') return serverActiveIds.length > 0
  return (
    serverActiveIds.length !== 1
    || serverActiveIds[0] !== state.active_snapshot_id
  )
})
const sensingScope = computed(() => activeSensingSnapshot.value?.scope || {})
const sensingWindows = computed(
  () => activeSensingSnapshot.value?.windows || [],
)
const sensingIssueDomains = computed(
  () => activeSensingSnapshot.value?.issue_domains || [],
)
const sensingNeedCells = computed(
  () =>
    activeSensingSnapshot.value?.archetypes
    || activeSensingSnapshot.value?.need_cells
    || [],
)
const sensingReview = computed(
  () => activeSensingSnapshot.value?.review_summary || {},
)
const sensingStanceRows = computed(() => sensingDistributionRows(
  resolveSensingDistribution('stance_counts', 'stance'),
  stanceLabels,
))
const sensingDeterminacyRows = computed(() => sensingDistributionRows(
  resolveSensingDistribution(
    'semantic_determinacy_counts',
    'semantic_determinacy',
  ),
  determinacyLabels,
))
const sensingMonths = computed(() => {
  const explicit = sensingScope.value.months
    || sensingWindows.value.flatMap((window) => window.months || [])
  if (Array.isArray(explicit) && explicit.length) {
    return [...new Set(explicit)].sort()
  }
  return [
    ...new Set(
      sensingNeedCells.value.flatMap(
        (cell) => Object.keys(cell.month_support || {}),
      ),
    ),
  ].sort()
})
const canPlanRun = computed(
  () =>
    runnableScenarios.value.length > 0
    && projectSensingState.value.status === 'active'
    && isWindowedSensingSnapshot.value,
)

const statCards = computed(() => [
  {
    label: '治理项目',
    value: overview.value.projects,
    note: '持久化项目边界',
  },
  {
    label: '冻结情景',
    value: overview.value.scenarios,
    note: '冲击与证据版本',
  },
  {
    label: '政策方案',
    value: overview.value.policies,
    note: '基线与干预分层',
  },
  {
    label: '推演计划',
    value: overview.value.runs,
    note: '可审计输入指纹',
  },
])

function emptySensingState() {
  return {
    status: 'not_configured',
    state_version: 0,
    active_snapshot_id: null,
    activated_at: null,
    snapshot: null,
  }
}

function emptyProjectDetails() {
  return {
    scenarios: [],
    policies: [],
    runs: [],
    evidence: [],
    sensingSnapshots: [],
    sensingState: emptySensingState(),
  }
}

function resolveSensingDistribution(primaryKey, nestedKey) {
  const snapshot = activeSensingSnapshot.value
  if (!snapshot) return {}
  const candidates = [
    snapshot[primaryKey],
    snapshot.distributions?.[nestedKey],
    snapshot.windows?.[0]?.[primaryKey],
    snapshot.windows?.[0]?.distributions?.[nestedKey],
  ]
  const direct = candidates.find(
    (candidate) =>
      Array.isArray(candidate)
      || (candidate && typeof candidate === 'object'),
  )
  if (direct) return direct

  const aggregate = {}
  for (const cell of snapshot.archetypes || snapshot.need_cells || []) {
    const candidate = cell[primaryKey]
      || cell.uncertainty?.[primaryKey]
      || cell.observable_distributions?.[nestedKey]
    if (!candidate || Array.isArray(candidate) || typeof candidate !== 'object') {
      continue
    }
    for (const [key, rawValue] of Object.entries(candidate)) {
      const count = Number(
        typeof rawValue === 'object'
          ? rawValue?.sample_count ?? rawValue?.count
          : rawValue,
      )
      if (Number.isFinite(count)) {
        aggregate[key] = (aggregate[key] || 0) + count
      }
    }
  }
  return aggregate
}

function sensingDistributionRows(value, labels) {
  const sourceRows = Array.isArray(value)
    ? value.map((item) => {
        const key = item.key
          || item.category
          || item.status
          || item.stance
          || item.semantic_determinacy
        return [key, item]
      })
    : Object.entries(value || {})
  const rows = sourceRows
    .filter(([key]) => key)
    .map(([key, rawValue]) => {
      const structured = rawValue && typeof rawValue === 'object'
        ? rawValue
        : {}
      const count = Number(
        structured.sample_count
        ?? structured.count
        ?? rawValue,
      )
      const sharePpm = Number(structured.share_ppm)
      return {
        key,
        label: structured.label || labels[key] || key,
        count: Number.isFinite(count) ? count : null,
        sharePpm: Number.isFinite(sharePpm) ? sharePpm : null,
        suppressed: structured.suppressed === true,
      }
    })
  const total = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.count) ? row.count : 0),
    0,
  )
  return rows.map((row) => ({
    ...row,
    computedShare: total > 0 && Number.isFinite(row.count)
      ? row.count / total
      : null,
  }))
}

function sensingItemCount(item) {
  return item?.sample_count ?? item?.count ?? null
}

function sensingShareLabel(item) {
  if (item?.suppressed === true) return '小样本已抑制'
  const rawSharePpm = item?.estimate_ppm ?? item?.share_ppm
  const sharePpm = rawSharePpm === null || rawSharePpm === undefined
    ? null
    : Number(rawSharePpm)
  if (Number.isFinite(sharePpm)) {
    return `${(sharePpm / 10000).toFixed(1)}% 加权份额`
  }
  const count = Number(sensingItemCount(item))
  const denominator = Number(
    item?.denominator_count
    ?? sensingScope.value.sample_size
    ?? activeSensingSnapshot.value?.sample_size,
  )
  if (Number.isFinite(count) && Number.isFinite(denominator) && denominator > 0) {
    return `${((count / denominator) * 100).toFixed(1)}% 样本构成`
  }
  return '样本构成未提供'
}

function sensingDomainLabel(domain) {
  const domainId = domain?.issue_domain_id
    || domain?.broad_domain
    || domain?.domain_id
  return domain?.label || issueDomainLabels[domainId] || domainId || '未命名议题域'
}

function sensingNeedLabel(cell) {
  return cell?.label
    || cell?.archetype_label
    || cell?.need_label
    || cell?.archetype_id
    || '未命名需求原型'
}

function resetRunPlan() {
  runForm.scenario_id = ''
  runForm.policy_ids = []
  runForm.execution_mode = 'audited_replay'
  runForm.agent_count = 48
  runForm.seeds = '20260722, 20261731'
  runForm.max_workers = 32
  runForm.token_budget = 2000000
  plannedRun.value = null
  selectedRuntimeRunId.value = null
  pendingRunRequest = null
}

function applyPolicyDefaultsForScenario(scenarioId, policies) {
  const scenario = selectedDetails.value.scenarios.find(
    (item) => item.scenario_id === scenarioId,
  )
  const allowedTemplateKeys = isLockedPopulationMode.value
    ? reviewedPolicyTemplateKeys
    : runtimePolicyTemplateWhitelist[scenario?.template_key] || []
  const available = policies.filter(
    (policy) => allowedTemplateKeys.includes(policy.template_key),
  )
  runForm.policy_ids = available.map((policy) => policy.policy_id)
  if (scenario?.template_key === 'lecture_external_incident_v2') {
    runForm.token_budget = 1100000
  } else if (scenario?.template_key === 'tongzhou_governance_notice_v2') {
    runForm.token_budget = 2000000
  }
}

function applyExecutionModeDefaults() {
  if (isForumTwinMode.value) {
    runForm.agent_count = 1_000
    runForm.seeds = governanceV2Seeds.join(', ')
    runForm.max_workers = 32
    runForm.token_budget = 80_000_000
    runForm.model_name = 'gpt-5.4-mini'
    runForm.population_release_id = 'semantic-llm-forum-agent-population-v2-reviewed'
  } else if (isYuLanScaleMode.value) {
    runForm.agent_count = 1_000
    runForm.seeds = governanceV2Seeds.join(', ')
    runForm.max_workers = 32
    runForm.token_budget = 40_000_000
    runForm.model_name = 'campus-pulse-llm-population-model-release-v1'
    runForm.population_release_id = 'semantic-llm-agent-population-v1'
  } else if (isGovernanceV2Mode.value) {
    runForm.agent_count = 1_000
    runForm.seeds = governanceV2Seeds.join(', ')
    runForm.max_workers = 32
    runForm.token_budget = 1_000
    runForm.model_name = 'message-aware-particle-state-space-qre-v2'
    runForm.population_release_id = 'semantic-population-v3-reviewed-1000'
  } else {
    runForm.agent_count = 48
    runForm.seeds = '20260722, 20261731'
    runForm.max_workers = 32
    runForm.token_budget = 2_000_000
    runForm.model_name = 'gpt-5.6-sol'
    runForm.population_release_id = 'persona-release-v1-reviewed-17x3'
  }
  applyPolicyDefaultsForScenario(
    runForm.scenario_id,
    selectedDetails.value.policies,
  )
}

function applyRunPlanDefaults(scenarios, policies) {
  const sealedScenarios = scenarios.filter(
    (scenario) =>
      scenario.evidence_binding_status === 'sealed'
      && reviewedRuntimeScenarioTemplateKeys.includes(scenario.template_key),
  )
  runForm.scenario_id = sealedScenarios[0]?.scenario_id || ''
  applyPolicyDefaultsForScenario(runForm.scenario_id, policies)
}

async function refreshLiveCapability(requestGeneration) {
  liveCapabilityLoading.value = true
  liveCapabilityError.value = ''
  try {
    const capability = await getLiveRuntimeCapability()
    if (requestGeneration !== refreshRequestGeneration) return
    liveCapability.value = capability
    if (Number(capability?.provider_calls_performed) !== 0) {
      liveCapabilityError.value = '资格接口没有证明零Provider调用，当前状态不作为可执行依据。'
    }
  } catch (error) {
    if (requestGeneration !== refreshRequestGeneration) return
    liveCapability.value = null
    liveCapabilityError.value = `Live资格状态暂不可用：${readableApiError(error)}。页面不会推测安装、启用或授权状态。`
  } finally {
    if (requestGeneration === refreshRequestGeneration) {
      liveCapabilityLoading.value = false
    }
  }
}

async function refreshWorkbench() {
  const requestGeneration = ++refreshRequestGeneration
  loading.value = true
  serviceError.value = ''
  void refreshLiveCapability(requestGeneration)
  try {
    const [
      healthData,
      readinessData,
      overviewData,
      projectData,
    ] = await Promise.all([
      getWorkbenchHealth(),
      getWorkbenchReadiness(),
      getWorkbenchOverview(),
      listProjects(),
    ])
    if (requestGeneration !== refreshRequestGeneration) return

    health.value = healthData
    readiness.value = readinessData
    overview.value = overviewData
    projects.value = projectData
    workspaceStale.value = false
    lastSuccessfulSync.value = new Date().toISOString()

    const selectedStillExists = projectData.some(
      (project) => project.project_id === selectedProjectId.value,
    )
    const projectId = selectedStillExists
      ? selectedProjectId.value
      : projectData[0]?.project_id

    if (projectId) {
      await selectProject(projectId)
    } else {
      ++detailRequestGeneration
      selectedProjectId.value = null
      selectedDetails.value = emptyProjectDetails()
      sensingLoadStatus.value = {
        list: 'idle',
        state: 'idle',
      }
      detailLoading.value = false
      resetRunPlan()
    }
  } catch (error) {
    if (requestGeneration !== refreshRequestGeneration) return

    ++detailRequestGeneration
    health.value = null
    readiness.value = null
    liveCapability.value = null
    liveCapabilityLoading.value = false
    liveCapabilityError.value = '工作台连接中断，Live资格状态未同步。'
    workspaceStale.value = true
    serviceError.value = readableApiError(error)
    overview.value = {
      projects: 0,
      scenarios: 0,
      policies: 0,
      runs: 0,
      reports: 0,
      evidence_snapshots: 0,
      project_evidence_bindings: 0,
      sensing_snapshots: 0,
      project_sensing_bindings: 0,
    }
    projects.value = []
    selectedProjectId.value = null
    selectedDetails.value = emptyProjectDetails()
    sensingLoadStatus.value = {
      list: 'idle',
      state: 'idle',
    }
    detailLoading.value = false
    resetRunPlan()
  } finally {
    if (requestGeneration === refreshRequestGeneration) {
      loading.value = false
    }
  }
}

async function selectProject(projectId) {
  const requestGeneration = ++detailRequestGeneration
  selectedProjectId.value = projectId
  detailLoading.value = true
  detailError.value = ''
  sensingActionError.value = ''
  sensingActionNotice.value = ''
  sensingLoadStatus.value = {
    list: 'loading',
    state: 'loading',
  }
  selectedDetails.value = emptyProjectDetails()
  resetRunPlan()
  try {
    const [
      [scenarios, policies, runs, evidence],
      [sensingListResult, sensingStateResult],
    ] = await Promise.all([
      Promise.all([
        listProjectScenarios(projectId),
        listProjectPolicies(projectId),
        listProjectRuns(projectId),
        listProjectEvidence(projectId),
      ]),
      Promise.allSettled([
        listProjectSensingSnapshots(projectId),
        getProjectSensingState(projectId),
      ]),
    ])
    if (
      requestGeneration !== detailRequestGeneration
      || selectedProjectId.value !== projectId
    ) return

    const sensingSnapshots = sensingListResult.status === 'fulfilled'
      && Array.isArray(sensingListResult.value)
      ? sensingListResult.value
      : []
    const sensingState = sensingStateResult.status === 'fulfilled'
      && sensingStateResult.value
      ? sensingStateResult.value
      : emptySensingState()
    sensingLoadStatus.value = {
      list: sensingListResult.status === 'fulfilled' ? 'loaded' : 'error',
      state: sensingStateResult.status === 'fulfilled' ? 'loaded' : 'error',
    }
    selectedDetails.value = {
      scenarios,
      policies,
      runs,
      evidence,
      sensingSnapshots,
      sensingState,
    }
    const sensingErrors = [
      sensingListResult.status === 'rejected'
        ? readableApiError(sensingListResult.reason)
        : '',
      sensingStateResult.status === 'rejected'
        ? readableApiError(sensingStateResult.reason)
        : '',
    ].filter(Boolean)
    if (sensingErrors.length) {
      sensingActionError.value = `感知快照部分加载失败：${
        [...new Set(sensingErrors)].join('；')
      }`
    }
    applyRunPlanDefaults(scenarios, policies)
    selectedRuntimeRunId.value = runs[0]?.run_id || null
  } catch (error) {
    if (
      requestGeneration !== detailRequestGeneration
      || selectedProjectId.value !== projectId
    ) return

    selectedDetails.value = emptyProjectDetails()
    sensingLoadStatus.value = {
      list: 'idle',
      state: 'idle',
    }
    detailError.value = readableApiError(error)
  } finally {
    if (
      requestGeneration === detailRequestGeneration
      && selectedProjectId.value === projectId
    ) {
      detailLoading.value = false
    }
  }
}

function resetForm() {
  form.name = ''
  form.governance_domain = '校园公共沟通'
  form.objective = ''
  form.evaluation_mode = 'simulation_stress_test'
  form.initialize_templates = true
}

async function submitProject() {
  actionError.value = ''
  actionNotice.value = ''
  if (!form.name.trim() || !form.objective.trim()) {
    actionError.value = '请填写项目名称和治理目标'
    return
  }

  const initializeTemplates = form.initialize_templates
  creating.value = true
  let project

  try {
    project = await createProject({
      name: form.name.trim(),
      governance_domain: form.governance_domain.trim(),
      objective: form.objective.trim(),
      evaluation_mode: form.evaluation_mode,
    })
  } catch (error) {
    actionError.value = readableApiError(error)
    creating.value = false
    return
  }

  showCreateForm.value = false
  resetForm()
  selectedProjectId.value = project.project_id
  actionNotice.value = '项目已创建并持久化。'

  if (initializeTemplates) {
    bootstrapping.value = project.project_id
    try {
      await bootstrapProject(project.project_id)
      actionNotice.value = '项目已创建，双冲击与治理基线已初始化。'
    } catch (error) {
      actionError.value = `项目已创建，但模板初始化失败：${readableApiError(error)}。可在项目内重试初始化。`
    } finally {
      bootstrapping.value = null
    }
  }

  await refreshWorkbench()
  creating.value = false
}

async function initializeReviewedTemplates(projectId) {
  bootstrapping.value = projectId
  actionError.value = ''
  actionNotice.value = ''
  try {
    await bootstrapProject(projectId)
    actionNotice.value = '双冲击情景与治理基线已完成幂等初始化。'
    await refreshWorkbench()
  } catch (error) {
    actionError.value = readableApiError(error)
  } finally {
    bootstrapping.value = null
  }
}

async function refreshProjectSensing(projectId) {
  const [listResult, stateResult] = await Promise.allSettled([
    listProjectSensingSnapshots(projectId),
    getProjectSensingState(projectId),
  ])
  if (selectedProjectId.value !== projectId) return

  const current = selectedDetails.value
  const sensingSnapshots = listResult.status === 'fulfilled'
    && Array.isArray(listResult.value)
    ? listResult.value
    : current.sensingSnapshots
  const sensingState = stateResult.status === 'fulfilled'
    && stateResult.value
    ? stateResult.value
    : current.sensingState
  sensingLoadStatus.value = {
    list: listResult.status === 'fulfilled' ? 'loaded' : 'error',
    state: stateResult.status === 'fulfilled' ? 'loaded' : 'error',
  }
  selectedDetails.value = {
    ...current,
    sensingSnapshots,
    sensingState,
  }
  const errors = [
    listResult.status === 'rejected'
      ? readableApiError(listResult.reason)
      : '',
    stateResult.status === 'rejected'
      ? readableApiError(stateResult.reason)
      : '',
  ].filter(Boolean)
  if (errors.length) {
    sensingActionError.value = `感知状态刷新不完整：${
      [...new Set(errors)].join('；')
    }`
  }
}

async function activateSensingSnapshot(snapshotId) {
  const projectId = selectedProjectId.value
  if (!projectId || !snapshotId) return
  if (sensingLoadStatus.value.state !== 'loaded') {
    sensingActionError.value = '服务端感知状态尚未加载，不能猜测当前激活版本。'
    return
  }
  const expectedVersion = Number(projectSensingState.value.state_version)
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    sensingActionError.value = '服务端感知状态版本无效，请刷新后重试。'
    return
  }

  activatingSensingSnapshotId.value = snapshotId
  sensingActionError.value = ''
  sensingActionNotice.value = ''
  try {
    const state = await activateProjectSensingSnapshot(
      projectId,
      snapshotId,
      expectedVersion,
    )
    if (selectedProjectId.value !== projectId) return
    selectedDetails.value = {
      ...selectedDetails.value,
      sensingState: state,
    }
    sensingLoadStatus.value = {
      ...sensingLoadStatus.value,
      state: 'loaded',
    }
    sensingActionNotice.value = '服务端已显式激活该感知版本；新运行将冻结这条血缘。'
    await refreshProjectSensing(projectId)
  } catch (error) {
    if (selectedProjectId.value !== projectId) return
    sensingActionError.value = `激活失败：${readableApiError(error)}。已重新读取服务端状态。`
    await refreshProjectSensing(projectId)
  } finally {
    if (selectedProjectId.value === projectId) {
      activatingSensingSnapshotId.value = null
    }
  }
}

function parseSeeds() {
  const values = String(runForm.seeds)
    .split(/[\s,，]+/)
    .map((value) => value.trim())
    .filter(Boolean)

  if (!isLockedPopulationMode.value && (values.length < 1 || values.length > 5)) {
    throw new Error('随机种子需要填写1至5个整数')
  }

  const seeds = values.map((value) => Number(value))
  if (seeds.some((value) => !Number.isSafeInteger(value))) {
    throw new Error('随机种子必须是安全整数，并使用逗号分隔')
  }
  if (
    isLockedPopulationMode.value
    && (
      seeds.length !== governanceV2Seeds.length
      || seeds.some((seed, index) => seed !== governanceV2Seeds[index])
    )
  ) {
    throw new Error('千体模式必须使用冻结的 8 个配对种子')
  }
  return seeds
}

async function submitRunPlan() {
  actionError.value = ''
  actionNotice.value = ''
  plannedRun.value = null

  const projectId = selectedProjectId.value
  if (!projectId || !runForm.scenario_id) {
    actionError.value = '请先选择一个冻结情景'
    return
  }
  const selectedScenario = selectedDetails.value.scenarios.find(
    (scenario) => scenario.scenario_id === runForm.scenario_id,
  )
  if (selectedScenario?.evidence_binding_status !== 'sealed') {
    actionError.value = '历史未绑定情景不能用于新运行，请选择证据血缘已封存的情景'
    return
  }
  const allowedPolicyTemplates = new Set(
    isLockedPopulationMode.value
      ? reviewedPolicyTemplateKeys
      : runtimePolicyTemplateWhitelist[selectedScenario?.template_key] || [],
  )
  const selectedPolicies = selectedDetails.value.policies.filter(
    (policy) => runForm.policy_ids.includes(policy.policy_id),
  )
  if (
    !allowedPolicyTemplates.size
    || selectedPolicies.length !== runForm.policy_ids.length
    || selectedPolicies.some(
      (policy) => !allowedPolicyTemplates.has(policy.template_key),
    )
  ) {
    actionError.value = selectedScenario?.template_key
      === 'lecture_external_incident_v2'
      ? '讲座外生事件只允许自然演化基线；组合治理不在正式验收白名单。'
      : '当前情景或政策组合不在 P3.1 正式执行白名单。'
    return
  }
  if (
    projectSensingState.value.status !== 'active'
    || !activeSensingSnapshot.value
  ) {
    actionError.value = '请先由服务端显式激活一个已附加的民意感知快照'
    return
  }
  if (!runForm.policy_ids.length) {
    actionError.value = '请至少选择一个政策方案'
    return
  }

  let seeds
  try {
    seeds = parseSeeds()
  } catch (error) {
    actionError.value = error.message
    return
  }

  planningRun.value = true
  try {
    const payload = {
      scenario_id: runForm.scenario_id,
      policy_ids: [...runForm.policy_ids],
      execution_mode: runForm.execution_mode,
      population_release_id: runForm.population_release_id,
      agent_count: Number(runForm.agent_count),
      seeds,
      model_name: runForm.model_name,
      max_workers: Number(runForm.max_workers),
      token_budget: Number(runForm.token_budget),
    }
    const requestSignature = JSON.stringify(payload)
    if (
      !pendingRunRequest
      || pendingRunRequest.projectId !== projectId
      || pendingRunRequest.signature !== requestSignature
    ) {
      pendingRunRequest = {
        projectId,
        signature: requestSignature,
        key: globalThis.crypto?.randomUUID?.()
          || `run-${projectId}-${Date.now()}`,
      }
    }
    const run = await planProjectRun(
      projectId,
      payload,
      pendingRunRequest.key,
    )

    if (selectedProjectId.value !== projectId) return
    plannedRun.value = run
    selectedRuntimeRunId.value = run.run_id
    selectedDetails.value = {
      ...selectedDetails.value,
      runs: [
        run,
        ...selectedDetails.value.runs.filter(
          (existingRun) => existingRun.run_id !== run.run_id,
        ),
      ],
    }
    overview.value = {
      ...overview.value,
      runs: overview.value.runs + 1,
    }
    actionNotice.value = '运行计划已冻结；当前没有调用模型，也没有消耗Token。'
    pendingRunRequest = null
  } catch (error) {
    actionError.value = readableApiError(error)
  } finally {
    planningRun.value = false
  }
}

function handleRuntimeUpdated({ runId, runtime }) {
  if (!runId || !runtime) return
  const runtimeSummary = runtime.runtime
    || runtime.runtime_state
    || runtime
  if (!runtimeSummary?.status) return

  const mergeRuntimeSummary = (run) => {
    if (!run || run.run_id !== runId) return run
    return {
      ...run,
      // simulation_runs.status is the immutable plan state. Runtime progress
      // is projected alongside it and must never overwrite that field.
      plan_status: run.plan_status || run.status,
      runtime_summary: runtimeSummary,
      effective_runtime_status: runtimeSummary.status,
    }
  }

  selectedDetails.value = {
    ...selectedDetails.value,
    runs: selectedDetails.value.runs.map(mergeRuntimeSummary),
  }
  plannedRun.value = mergeRuntimeSummary(plannedRun.value)
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatPercent(value, digits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return `${(number * 100).toFixed(digits)}%`
}

function formatDistributionShare(row) {
  if (row?.suppressed) return '已抑制'
  if (Number.isFinite(row?.sharePpm)) {
    return `${(row.sharePpm / 10000).toFixed(1)}%`
  }
  return formatPercent(row?.computedShare)
}

function formatCount(value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('zh-CN').format(number)
}

function reviewCount(...keys) {
  for (const key of keys) {
    const rawValue = sensingReview.value?.[key]
    if (rawValue === null || rawValue === undefined || rawValue === '') continue
    const value = Number(rawValue)
    if (Number.isFinite(value)) return formatCount(value)
  }
  return '—'
}

function sensingClaimStatus(key, expected) {
  const boundary = activeSensingSnapshot.value?.claim_boundary
  const directValue = activeSensingSnapshot.value?.[key]
  const boundaryValue = (
    boundary
    && !Array.isArray(boundary)
    && typeof boundary === 'object'
      ? boundary[key]
      : null
  )
  const value = directValue ?? boundaryValue
  return value === null || value === undefined || value === ''
    ? `未返回（合同：${expected}）`
    : value
}

function shortHash(value) {
  if (!value) return '—'
  return `${String(value).slice(0, 12)}…${String(value).slice(-8)}`
}

onMounted(() => {
  document.title = 'CampusPulse · LLM 平行论坛运行工作台'
  document.body.classList.add('campus-pulse-workbench-active')
  refreshWorkbench()
})

onUnmounted(() => {
  ++refreshRequestGeneration
  ++detailRequestGeneration
  document.body.classList.remove('campus-pulse-workbench-active')
})
</script>

<template>
  <div class="workbench-page">
    <div class="workbench-main">
      <header class="topbar">
        <div>
          <h1>推演工作台</h1>
          <p>创建项目、绑定证据、配置场景、生成计划并监控运行。</p>
        </div>
        <div class="topbar-actions">
          <EvidenceBadge
            :tone="connected ? 'observed' : 'offline'"
            :label="
              connected
                ? '内部服务已连接'
                : workspaceStale
                  ? '服务中断 · 等待重连'
                  : '服务未连接'
            "
          />
          <span v-if="lastSuccessfulSync" class="last-sync">
            上次同步 {{ formatDate(lastSuccessfulSync) }}
          </span>
          <span class="deployment-tier">部署等级 {{ health?.deployment_tier || '未连接' }}</span>
          <button
            class="refresh-button"
            type="button"
            :disabled="loading"
            @click="refreshWorkbench"
          >
            {{ loading ? '同步中…' : '刷新' }}
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="!connected"
            @click="showCreateForm = true"
          >
            + 新建推演项目
          </button>
        </div>
      </header>

      <section v-if="serviceError" class="service-alert" role="status">
        <div>
          <strong>{{ serviceError }}</strong>
          <p>
            当前只读视图没有连接后端 API；已校验的离线结果仍可查看。
            创建、运行和恢复项目需要同时启动 CampusPulse 后端服务。
            <template v-if="lastSuccessfulSync">
              上次成功同步于 {{ formatDate(lastSuccessfulSync) }}。为避免展示过期状态，
              当前视图已暂时隐藏在线记录；服务恢复后刷新即可重新载入，持久化数据不会被删除。
            </template>
          </p>
        </div>
        <router-link to="/campus-pulse/results">打开离线结果</router-link>
      </section>

      <nav class="workflow-guide" aria-label="工作台流程">
        <a href="#project-step"><b>1</b><span>项目</span><small>定义治理问题</small></a>
        <a href="#evidence-step"><b>2</b><span>证据</span><small>绑定数据与人口</small></a>
        <a href="#scenario-step"><b>3</b><span>场景</span><small>选择事件与政策</small></a>
        <a href="#plan-step"><b>4</b><span>运行</span><small>冻结计划并入队</small></a>
        <a href="#runtime-step"><b>5</b><span>结果</span><small>监控、恢复与报告</small></a>
      </nav>

      <section class="stats-grid" aria-label="工作台统计">
        <article v-for="stat in statCards" :key="stat.label" class="stat-card">
          <span>{{ stat.label }}</span>
          <strong>{{ loading ? '—' : stat.value }}</strong>
          <small>{{ stat.note }}</small>
        </article>
      </section>

      <section class="workspace-grid">
        <article id="project-step" class="projects-panel">
          <div class="section-heading">
            <div>
              <h2>治理项目</h2>
            </div>
            <span>{{ projects.length }} 个项目</span>
          </div>

          <div v-if="loading" class="empty-state">
            正在读取持久化工作区……
          </div>
          <div v-else-if="!connected" class="empty-state">
            连接内部API后可创建和恢复项目。
          </div>
          <div v-else-if="projects.length === 0" class="empty-state">
            <strong>从一个明确治理问题开始</strong>
            <p>创建项目后可一键加载已经审阅的双冲击情景与政策基线。</p>
            <button type="button" @click="showCreateForm = true">
              创建第一个项目
            </button>
          </div>
          <div v-else class="project-list">
            <button
              v-for="project in projects"
              :key="project.project_id"
              class="project-row"
              :class="{ selected: project.project_id === selectedProjectId }"
              type="button"
              @click="selectProject(project.project_id)"
            >
              <span class="project-glyph">{{ project.name.slice(0, 1) }}</span>
              <span class="project-copy">
                <strong>{{ project.name }}</strong>
                <small>{{ project.governance_domain }}</small>
              </span>
              <span class="project-meta">
                <em>{{ project.evaluation_mode === 'simulation_stress_test' ? '仿真压力测试' : '描述性试点' }}</em>
                <small>{{ formatDate(project.updated_at) }}</small>
              </span>
            </button>
          </div>
        </article>

        <article class="project-detail">
          <div v-if="actionNotice" class="inline-notice" role="status">
            {{ actionNotice }}
          </div>
          <div v-if="actionError" class="inline-error" role="alert">
            {{ actionError }}
          </div>
          <div v-if="detailError" class="inline-error" role="alert">
            项目详情加载失败：{{ detailError }}
          </div>

          <template v-if="selectedProject">
            <div class="section-heading detail-heading">
              <div>
                <h2>{{ selectedProject.name }}</h2>
              </div>
              <EvidenceBadge
                tone="model"
                :label="
                  selectedProject.evaluation_mode === 'simulation_stress_test'
                    ? '模型条件评估'
                    : '描述性试点'
                "
              />
            </div>

            <p class="project-objective">{{ selectedProject.objective }}</p>

            <div v-if="detailLoading" class="detail-loading">
              正在加载项目结构……
            </div>
            <template v-else>
              <div class="entity-summary">
                <div>
                  <span>冻结情景</span>
                  <strong>{{ selectedDetails.scenarios.length }}</strong>
                </div>
                <div>
                  <span>政策方案</span>
                  <strong>{{ selectedDetails.policies.length }}</strong>
                </div>
                <div>
                  <span>推演计划</span>
                  <strong>{{ selectedDetails.runs.length }}</strong>
                </div>
                <div>
                  <span>证据快照</span>
                  <strong>{{ selectedDetails.evidence.length }}</strong>
                </div>
                <div>
                  <span>感知快照</span>
                  <strong>{{ selectedDetails.sensingSnapshots.length }}</strong>
                </div>
              </div>

              <div
                v-if="!reviewedTemplatesReady"
                class="bootstrap-card"
              >
                <div>
                  <span>REVIEWED STARTER</span>
                  <strong>加载双冲击与治理基线</strong>
                  <p>
                    通州治理行动、讲座外生事件、自然演化和组合治理，
                    以及回溯性审阅感知基线，均使用当前正式发布。再次执行会幂等补齐；
                    若同版本记录已被改写则拒绝覆盖，历史版本继续只读保留。
                  </p>
                </div>
                <button
                  type="button"
                  :disabled="bootstrapping === selectedProject.project_id"
                  @click="initializeReviewedTemplates(selectedProject.project_id)"
                >
                  {{
                    bootstrapping === selectedProject.project_id
                      ? '正在初始化…'
                      : '初始化模板'
                  }}
                </button>
              </div>

              <section
                v-if="primaryEvidence"
                id="evidence-step"
                class="evidence-panel"
                aria-label="项目证据快照"
              >
                  <div class="evidence-panel-heading">
                    <div>
                      <span>EVIDENCE / SEALED</span>
                      <strong>{{ primaryEvidence.label }}</strong>
                      <p>
                        证据注册流程仅登记两张授权源表的整文件哈希与审阅聚合，
                        不导入原始行。
                      </p>
                    </div>
                    <div class="evidence-badges">
                      <EvidenceBadge tone="observed" label="审阅源哈希已登记" />
                      <EvidenceBadge tone="model" label="非因果效果" />
                    </div>
                  </div>

                  <div class="evidence-kpis">
                    <article>
                      <span>帖子记录</span>
                      <strong>{{ formatCount(postsEvidenceSource?.rows) }}</strong>
                      <small>{{ shortHash(postsEvidenceSource?.sha256) }}</small>
                    </article>
                    <article>
                      <span>评论记录</span>
                      <strong>{{ formatCount(commentsEvidenceSource?.rows) }}</strong>
                      <small>{{ shortHash(commentsEvidenceSource?.sha256) }}</small>
                    </article>
                    <article>
                      <span>评论—帖子关联率</span>
                      <strong>
                        {{ formatPercent(primaryEvidence.quality.comment_linkage_rate, 2) }}
                      </strong>
                      <small>评论日期100%继承帖子日期，不能测响应速度</small>
                    </article>
                    <article>
                      <span>经过时间检验的主张</span>
                      <strong>
                        {{ primaryEvidence.claim_coverage.tested_claim_families }}
                        /
                        {{ primaryEvidence.claim_coverage.total_claim_families }}
                      </strong>
                      <small>这是证据覆盖数，不是模型准确率</small>
                    </article>
                  </div>

                  <div class="evidence-lineage">
                    <div>
                      <span>覆盖范围</span>
                      <strong>
                        {{ primaryEvidence.time_start }}
                        →
                        {{ primaryEvidence.time_end_exclusive }}
                      </strong>
                    </div>
                    <div>
                      <span>数据快照</span>
                      <code :title="primaryEvidence.snapshot_id">
                        {{ shortHash(primaryEvidence.snapshot_id) }}
                      </code>
                    </div>
                    <div>
                      <span>安全清单</span>
                      <code :title="primaryEvidence.manifest_sha256">
                        {{ shortHash(primaryEvidence.manifest_sha256) }}
                      </code>
                    </div>
                    <div>
                      <span>隐私状态</span>
                      <strong>证据注册流程不导入原始行</strong>
                    </div>
                  </div>

                  <p class="evidence-limit">
                    证据支持历史冲击形状、帖子获得评论的概率和累计评论分布校准；
                    不支持干预因果效果、真实扩散速度、个体预测或人口公平结论。
                  </p>
                </section>

                <section
                  class="sensing-panel"
                  aria-label="民意感知快照"
                >
                  <div class="sensing-panel-heading">
                    <div>
                      <span>SENSING / REVIEWED AGGREGATE</span>
                      <strong>民意感知快照</strong>
                      <p>
                        回答“固定历史窗口里讨论了什么、匹配段与冲击窗口有何差异”，
                        与上方“数据从哪里来”的证据快照分开；它不是实时监测。
                      </p>
                    </div>
                    <div class="evidence-badges">
                      <EvidenceBadge
                        :tone="activeSensingSnapshot ? 'review' : 'offline'"
                        :label="
                          activeSensingSnapshot
                            ? '服务端显式激活'
                            : '尚未配置激活版本'
                        "
                      />
                      <EvidenceBadge tone="model" label="历史episode份额 · 非人口比例" />
                    </div>
                  </div>

                  <div
                    v-if="sensingActionNotice"
                    class="sensing-inline-notice"
                    role="status"
                  >
                    {{ sensingActionNotice }}
                  </div>
                  <div
                    v-if="sensingActionError"
                    class="sensing-inline-error"
                    role="alert"
                  >
                    {{ sensingActionError }}
                  </div>
                  <div
                    v-if="sensingStateIsPartial"
                    class="sensing-inline-warning"
                    role="status"
                  >
                    感知列表与服务端激活状态尚未完整一致。页面不会根据列表顺序、
                    创建时间或“第一项”推断当前版本；请刷新或重新执行项目初始化。
                  </div>

                  <div
                    v-if="
                      sensingLoadStatus.list === 'loading'
                      || sensingLoadStatus.state === 'loading'
                    "
                    class="sensing-empty"
                  >
                    正在分别读取项目快照列表与服务端激活状态……
                  </div>

                  <template v-else>
                    <div
                      v-if="selectedDetails.sensingSnapshots.length"
                      class="sensing-version-list"
                      aria-label="已附加的感知版本"
                    >
                      <article
                        v-for="snapshot in selectedDetails.sensingSnapshots"
                        :key="snapshot.snapshot_id"
                        :class="{
                          active:
                            projectSensingState.active_snapshot_id
                            === snapshot.snapshot_id,
                        }"
                      >
                        <div>
                          <span>
                            {{
                              projectSensingState.active_snapshot_id
                                === snapshot.snapshot_id
                                ? 'ACTIVE / SERVER STATE'
                                : 'ATTACHED / INACTIVE'
                            }}
                          </span>
                          <strong>
                            {{ snapshot.label || snapshot.release_key || '已附加感知快照' }}
                          </strong>
                          <small :title="snapshot.snapshot_id">
                            {{ shortHash(snapshot.snapshot_id) }}
                            ·
                            {{ formatCount(snapshot.scope?.sample_size ?? snapshot.sample_size) }}
                            条样本episode
                          </small>
                        </div>
                        <button
                          class="secondary-button"
                          type="button"
                          :disabled="
                            projectSensingState.active_snapshot_id
                              === snapshot.snapshot_id
                            || sensingLoadStatus.state !== 'loaded'
                            || activatingSensingSnapshotId !== null
                          "
                          @click="activateSensingSnapshot(snapshot.snapshot_id)"
                        >
                          {{
                            activatingSensingSnapshotId === snapshot.snapshot_id
                              ? '激活中…'
                              : projectSensingState.active_snapshot_id
                                  === snapshot.snapshot_id
                                ? '当前版本'
                                : '显式激活'
                          }}
                        </button>
                      </article>
                    </div>

                    <div
                      v-if="
                        !activeSensingSnapshot
                        && selectedDetails.sensingSnapshots.length === 0
                      "
                      class="sensing-empty"
                    >
                      <strong>项目尚未附加民意感知快照</strong>
                      <p>
                        初始化审阅模板后，服务端会注册、附加并通过显式CAS激活正式聚合发布；
                        单独附加其他版本仍不会暗中切换当前状态。
                      </p>
                    </div>
                    <div
                      v-else-if="!activeSensingSnapshot"
                      class="sensing-empty"
                    >
                      <strong>已附加，但未显式激活</strong>
                      <p>
                        请选择一个版本并通过服务端状态版本进行CAS激活。
                        在此之前，新运行不会猜测要使用哪个快照。
                      </p>
                    </div>

                    <template v-else>
                      <WindowedSensingWorkbench
                        v-if="isWindowedSensingSnapshot"
                        :snapshot="activeSensingSnapshot"
                      />

                      <template v-else>
                      <div class="sensing-kpis">
                        <article>
                          <span>审阅样本episode</span>
                          <strong>
                            {{
                              formatCount(
                                sensingScope.sample_size
                                ?? activeSensingSnapshot.sample_size,
                              )
                            }}
                          </strong>
                          <small>分析单位：论坛帖子episode，不是唯一用户</small>
                        </article>
                        <article>
                          <span>议题域代理</span>
                          <strong>{{ sensingIssueDomains.length }} / 9</strong>
                          <small>审阅taxonomy的broad_domain，不是当前事件发现</small>
                        </article>
                        <article>
                          <span>需求 / 行为人群</span>
                          <strong>{{ sensingNeedCells.length }} / 17</strong>
                          <small>用于映射仿真人群先验，不推断人口属性</small>
                        </article>
                        <article>
                          <span>服务端状态版本</span>
                          <strong>v{{ projectSensingState.state_version }}</strong>
                          <small>
                            {{
                              projectSensingState.activated_at
                                ? `激活于 ${formatDate(projectSensingState.activated_at)}`
                                : '未记录激活时间'
                            }}
                          </small>
                        </article>
                      </div>

                      <div class="sensing-scope">
                        <div>
                          <span>感知范围</span>
                          <strong>
                            {{
                              sensingScope.label
                              || sensingWindows[0]?.label
                              || '回溯性代表人群审阅样本'
                            }}
                          </strong>
                          <small>
                            {{
                              sensingScope.start_inclusive
                              || sensingWindows[0]?.start_inclusive
                              || '范围起点未提供'
                            }}
                            →
                            {{
                              sensingScope.end_exclusive
                              || sensingWindows[0]?.end_exclusive
                              || '范围终点未提供'
                            }}
                          </small>
                        </div>
                        <div>
                          <span>估计方式</span>
                          <strong>
                            {{
                              sensingScope.estimation_mode
                              || sensingClaimStatus(
                                'estimation_mode',
                                'descriptive_stratified_sample_only',
                              )
                            }}
                          </strong>
                          <small>疑难语言被有意过采样，不能外推为论坛总体比例</small>
                        </div>
                        <div>
                          <span>血缘指纹</span>
                          <code :title="activeSensingSnapshot.manifest_sha256">
                            {{ shortHash(activeSensingSnapshot.manifest_sha256) }}
                          </code>
                          <small>新运行将冻结此感知发布与上游审阅产物</small>
                        </div>
                      </div>

                      <div class="sensing-status-strip">
                        <span>
                          unit
                          <code>
                            {{
                              sensingScope.unit_of_analysis
                              || sensingClaimStatus(
                                'unit_of_analysis',
                                'forum_post_episode',
                              )
                            }}
                          </code>
                        </span>
                        <span>
                          stance target
                          <code>
                            {{
                              sensingClaimStatus(
                                'stance_target_status',
                                'not_coded',
                              )
                            }}
                          </code>
                        </span>
                        <span>
                          forecast
                          <code>
                            {{
                              sensingClaimStatus(
                                'forecast_status',
                                'not_evaluated',
                              )
                            }}
                          </code>
                        </span>
                        <span>
                          causal
                          <code>
                            {{
                              sensingClaimStatus(
                                'causal_status',
                                'not_identified',
                              )
                            }}
                          </code>
                        </span>
                        <span>
                          risk validity
                          <code>
                            {{
                              sensingClaimStatus(
                                'risk_validity',
                                'model_assisted_descriptive_only',
                              )
                            }}
                          </code>
                        </span>
                      </div>

                      <div v-if="sensingMonths.length" class="sensing-months">
                        <span>样本月份覆盖</span>
                        <div>
                          <small
                            v-for="month in sensingMonths"
                            :key="month"
                          >
                            {{ month }}
                          </small>
                        </div>
                        <p>
                          这里只表示各月有样本支持，不构造月份×立场趋势。
                        </p>
                      </div>

                      <div class="sensing-section-heading">
                        <div>
                          <span>九类议题域代理</span>
                          <small>sample count / sample share</small>
                        </div>
                        <p>
                          比例只描述这
                          {{
                            formatCount(
                              sensingScope.sample_size
                              ?? activeSensingSnapshot.sample_size,
                            )
                          }}
                          条分层语义样本的构成。
                        </p>
                      </div>
                      <div
                        v-if="sensingIssueDomains.length"
                        class="sensing-domain-grid"
                      >
                        <article
                          v-for="domain in sensingIssueDomains"
                          :key="
                            domain.issue_domain_id
                            || domain.broad_domain
                            || domain.domain_id
                          "
                        >
                          <span>
                            {{
                              domain.issue_domain_id
                              || domain.broad_domain
                              || domain.domain_id
                            }}
                          </span>
                          <strong>{{ sensingDomainLabel(domain) }}</strong>
                          <div>
                            <b>{{ formatCount(sensingItemCount(domain)) }}</b>
                            <small>{{ sensingShareLabel(domain) }}</small>
                          </div>
                        </article>
                      </div>
                      <div v-else class="sensing-missing-field">
                        当前激活状态已返回，但九类议题域聚合尚未完整提供。
                      </div>

                      <div class="sensing-two-column">
                        <section>
                          <div class="sensing-section-heading compact">
                            <div>
                              <span>立场构成</span>
                              <small>五类受控标签</small>
                            </div>
                          </div>
                          <div
                            v-if="sensingStanceRows.length"
                            class="sensing-distribution"
                          >
                            <div
                              v-for="row in sensingStanceRows"
                              :key="row.key"
                            >
                              <span>{{ row.label }}</span>
                              <strong>{{ formatCount(row.count) }}</strong>
                              <small>{{ formatDistributionShare(row) }}</small>
                            </div>
                          </div>
                          <p v-else class="sensing-missing-field">
                            当前响应未提供立场聚合。
                          </p>
                          <p class="sensing-boundary-note">
                            本发布没有编码 <code>stance_target</code>。
                            “支持/担忧/批评”不能被解释为对学校、政策或事件的确定立场。
                          </p>
                        </section>

                        <section>
                          <div class="sensing-section-heading compact">
                            <div>
                              <span>语义不确定性</span>
                              <small>不与审阅覆盖合成信任分</small>
                            </div>
                          </div>
                          <div
                            v-if="sensingDeterminacyRows.length"
                            class="sensing-distribution"
                          >
                            <div
                              v-for="row in sensingDeterminacyRows"
                              :key="row.key"
                            >
                              <span>{{ row.label }}</span>
                              <strong>{{ formatCount(row.count) }}</strong>
                              <small>{{ formatDistributionShare(row) }}</small>
                            </div>
                          </div>
                          <p v-else class="sensing-missing-field">
                            当前响应未提供语义确定性聚合。
                          </p>
                          <p class="sensing-boundary-note">
                            模型置信度、边界样本、人工复核依据和审阅者确定性分别保留，
                            不制造一个不透明“准确率”。
                          </p>
                        </section>
                      </div>

                      <div class="sensing-section-heading">
                        <div>
                          <span>17类需求 / 行为人群</span>
                          <small>reviewed archetype → simulation prior</small>
                        </div>
                        <p>同一人可在不同情境表现为不同episode，不是持久身份画像。</p>
                      </div>
                      <div
                        v-if="sensingNeedCells.length"
                        class="sensing-need-grid"
                      >
                        <article
                          v-for="cell in sensingNeedCells"
                          :key="cell.archetype_id || cell.need_id"
                        >
                          <div class="sensing-need-title">
                            <span>{{ cell.archetype_id || cell.need_id }}</span>
                            <small>
                              {{ formatCount(sensingItemCount(cell)) }} 条 ·
                              {{ sensingShareLabel(cell) }}
                            </small>
                          </div>
                          <strong>{{ sensingNeedLabel(cell) }}</strong>
                          <p>
                            {{ cell.core_need || cell.primary_need || '核心诉求字段未提供' }}
                          </p>
                          <dl>
                            <div>
                              <dt>期待回应</dt>
                              <dd>
                                {{
                                  cell.expected_response
                                  || cell.response_expectation
                                  || '未提供'
                                }}
                              </dd>
                            </div>
                            <div>
                              <dt>治理关联</dt>
                              <dd>{{ cell.governance_relevance || '未提供' }}</dd>
                            </div>
                          </dl>
                        </article>
                      </div>
                      <div v-else class="sensing-missing-field">
                        当前激活状态已返回，但17类需求 / 行为人群聚合尚未完整提供。
                      </div>

                      <div class="sensing-review-grid">
                        <section>
                          <span>REVIEW COVERAGE</span>
                          <strong>人工复核覆盖如何构成</strong>
                          <div class="sensing-review-metrics">
                            <div>
                              <b>
                                {{
                                  reviewCount(
                                    'directly_adjudicated_count',
                                    'directly_adjudicated',
                                  )
                                }}
                              </b>
                              <small>逐条语义裁决</small>
                            </div>
                            <div>
                              <b>
                                {{
                                  reviewCount(
                                    'hard_pair_direct_review_coverage',
                                    'hard_pairs_reviewed',
                                    'hard_pair_count',
                                  )
                                }}
                              </b>
                              <small>难边界逐条审阅</small>
                            </div>
                            <div>
                              <b>
                                {{
                                  reviewCount(
                                    'primary_assignment_change_count',
                                    'changed_primary_assignments',
                                  )
                                }}
                              </b>
                              <small>主要分类被修订</small>
                            </div>
                            <div>
                              <b>
                                {{
                                  reviewCount(
                                    'base_model_boundary_count',
                                    'base_boundary_count',
                                    'boundary_case_count',
                                  )
                                }}
                              </b>
                              <small>基础模型边界样本</small>
                            </div>
                          </div>
                          <p>
                            状态为 <code>{{ activeSensingSnapshot.status }}</code>。
                            这不等于1,000条全部逐条人工评分；未逐条裁决部分来自分层簇证据审阅。
                          </p>
                        </section>

                        <section>
                          <span>PRIVACY / NON-CLAIMS</span>
                          <strong>发布层只保留安全聚合</strong>
                          <ul>
                            <li>不含原帖、评论、语义改写、示例、源ID或输入指纹。</li>
                            <li>样本构成不是全体学生、论坛读者或唯一用户总体比例。</li>
                            <li>
                              当前 P2.2 兼容快照不含两组目标冲击窗口，不能据此比较；
                              P2.3正式视图才执行两组匹配描述性对照。
                            </li>
                            <li>不是实时监测，不预测事件、绝对热度、传播速度或个体风险。</li>
                            <li>不识别政策因果效果，也不证明某项治理行动有效。</li>
                          </ul>
                          <div class="sensing-privacy-state">
                            <span>服务端隐私状态</span>
                            <code>
                              {{
                                activeSensingSnapshot.privacy?.publication_mode
                                || activeSensingSnapshot.privacy?.privacy_mode
                                || activeSensingSnapshot.privacy_mode
                                || (
                                  activeSensingSnapshot.privacy?.aggregate_only
                                    ? 'aggregate_only'
                                    : '字段未提供'
                                )
                              }}
                            </code>
                          </div>
                        </section>
                      </div>

                      <div class="sensing-next-slice">
                        <span>LEGACY / UPGRADE REQUIRED</span>
                        <strong>当前项目仍在单窗口兼容版本</strong>
                        <p>
                          重新执行项目初始化即可安全切换到P2.3正式包；服务端会保留旧快照，
                          并用CAS激活三窗口聚合版本，不会覆盖既有运行血缘。
                        </p>
                      </div>
                      </template>
                    </template>
                  </template>
                </section>

                <div id="scenario-step" class="detail-block">
                  <div class="detail-block-heading">
                    <span>冲击情景</span>
                    <small>同一人口 · 不同机制</small>
                  </div>
                  <div class="scenario-cards">
                    <article
                      v-for="scenario in selectedDetails.scenarios"
                      :key="scenario.scenario_id"
                      :class="{
                        'legacy-scenario':
                          scenario.evidence_binding_status !== 'sealed',
                      }"
                    >
                      <span>{{ scenario.shock_origin === 'governance_action' ? '治理行动' : '外生事件' }}</span>
                      <strong>{{ scenario.name }}</strong>
                      <small>
                        {{ scenario.phases.length }}阶段 ·
                        {{
                          scenario.evidence_binding_status === 'sealed'
                            ? '数据与分析血缘已封存'
                            : '历史情景·证据未完整绑定'
                          }}
                      </small>
                      <p
                        v-if="scenario.evidence_binding_status !== 'sealed'"
                        class="legacy-warning"
                      >
                        此历史记录仅供审计查看；缺少封存证据血缘，不能用于创建新运行。
                      </p>
                    </article>
                  </div>
                </div>

                <div class="detail-block">
                  <div class="detail-block-heading">
                    <span>治理方案</span>
                    <small>
                      {{ hasBaseline ? '基线已就绪' : '缺少基线' }}
                    </small>
                  </div>
                  <div class="policy-list">
                    <div
                      v-for="policy in selectedDetails.policies"
                      :key="policy.policy_id"
                    >
                      <span>
                        {{
                          reviewedPolicyTemplateKeys.includes(policy.template_key)
                            ? '当前审阅版'
                            : '历史 / 自定义'
                        }}
                      </span>
                      <strong>{{ policy.name }}</strong>
                      <small>
                        {{
                          policy.actions.length
                            ? `${policy.actions.length}项治理承诺`
                            : '无追加治理动作'
                        }}
                      </small>
                    </div>
                  </div>
                </div>

                <section
                  class="live-qualification-summary"
                  aria-label="P3.2b确定性运行与Live LLM资格状态"
                >
                  <div class="live-qualification-heading">
                    <div>
                      <span>P3.2b / DETERMINISTIC RUNTIME</span>
                      <strong>确定性夹具执行器 · Live LLM 资格分层</strong>
                    </div>
                    <EvidenceBadge
                      :tone="
                        liveCapabilityError
                          ? 'offline'
                          : liveCapability?.planning_ready
                            ? 'review'
                            : 'model'
                      "
                      :label="
                        liveCapabilityLoading
                          ? '正在读取资格'
                          : liveCapability?.planning_ready
                            ? '计划资格已安装'
                            : '资格尚未就绪'
                      "
                    />
                  </div>
                  <div class="live-qualification-grid">
                    <article>
                      <span>审阅资产</span>
                      <strong>
                        {{
                          liveCapabilityLoading
                            ? '读取中'
                            : liveCapability?.asset_bundle?.state === 'qualified'
                              ? '资格资产已安装'
                              : '资格资产未安装'
                        }}
                      </strong>
                      <small>
                        {{
                          shortHash(
                            liveCapability?.asset_bundle?.bundle_fingerprint,
                          )
                        }}
                      </small>
                    </article>
                    <article>
                      <span>确定性夹具执行器</span>
                      <strong>
                        {{
                          liveCapabilityLoading
                            ? '读取中'
                            : liveCapability?.deterministic_fixture
                                ?.executor_state === 'installed'
                              ? '执行器已安装'
                              : '执行器状态未确认'
                        }}
                      </strong>
                      <small>零Provider · 可恢复 · 不可作为治理结论外发</small>
                    </article>
                    <article>
                      <span>Provider配置</span>
                      <strong>
                        {{
                          liveCapabilityLoading
                            ? '读取中'
                            : liveCapability?.provider_profile_state === 'enabled'
                              ? 'Provider已启用'
                              : liveCapability?.provider_profile_state === 'disabled'
                                ? 'Provider未启用'
                                : 'Provider资格未安装'
                        }}
                      </strong>
                      <small>
                        全局闸门
                        {{ liveCapability?.live_gate || '未读取' }}
                      </small>
                    </article>
                    <article>
                      <span>真实Provider执行器</span>
                      <strong>
                        {{
                          liveCapabilityLoading
                            ? '读取中'
                            : liveCapability?.executor_state === 'installed'
                              ? '执行器已安装'
                              : 'P3.2c尚未接入'
                        }}
                      </strong>
                      <small>
                        {{
                          liveCapability?.live_enqueue_ready
                            ? '可进入显式授权入队'
                            : '需新的显式授权，当前不可Live入队'
                        }}
                      </small>
                    </article>
                    <article>
                      <span>资格阶段Provider调用</span>
                      <strong>
                        {{
                          liveCapability?.provider_calls_performed === 0
                            ? '0 次'
                            : '未证明为0'
                        }}
                      </strong>
                      <small>读取、规划和资格检查不执行模型</small>
                    </article>
                  </div>
                  <p
                    v-if="liveCapabilityError"
                    class="live-qualification-error"
                    role="status"
                  >
                    {{ liveCapabilityError }}
                  </p>
                  <p class="live-qualification-boundary">
                    确定性夹具只验证执行、恢复和聚合合同，不是治理发现且禁止外发。
                    即使未来完成单次授权，输出仍是模型条件模拟，不是因果效果或预测；
                    本工作台不提供合成发言浏览。
                  </p>
                </section>

                <form
                  v-if="canPlanRun"
                  id="plan-step"
                  class="run-planner"
                  @submit.prevent="submitRunPlan"
                >
                  <div class="run-planner-heading">
                    <div>
                      <span>RUN PLAN / AUDITABLE DRAFT</span>
                      <strong>冻结一次可审计推演计划</strong>
                      <p>
                        此步骤只保存情景、政策和执行参数，不调用模型，也不消耗Token。
                      </p>
                    </div>
                    <EvidenceBadge tone="model" label="仅创建计划" />
                  </div>

                  <div class="run-form-grid">
                    <label>
                      <span>冲击情景</span>
                      <select
                        v-model="runForm.scenario_id"
                        required
                        @change="
                          applyPolicyDefaultsForScenario(
                            runForm.scenario_id,
                            selectedDetails.policies,
                          )
                        "
                      >
                        <option
                          v-for="scenario in runnableScenarios"
                          :key="scenario.scenario_id"
                          :value="scenario.scenario_id"
                        >
                          {{ scenario.name }}
                        </option>
                      </select>
                    </label>

                    <label>
                      <span>执行模式</span>
                      <select
                        v-model="runForm.execution_mode"
                        @change="applyExecutionModeDefaults"
                      >
                        <option value="audited_replay">
                          审计回放
                        </option>
                        <option value="adaptive_particle_population">
                          Governance Arena v2（1,000×10 / ZERO PROVIDER）
                        </option>
                        <option value="budgeted_llm_agent_population">
                          YuLan-Scale v1（1,000 LLM agents / 预算化激活）
                        </option>
                        <option value="llm_forum_twin">
                          YuLan ForumTwin v1（1,000 LLM论坛智能体 / 单轮≤67）
                        </option>
                        <option value="live_llm" disabled>
                          实时LLM（需独立授权，当前不可入队）
                        </option>
                      </select>
                    </label>

                    <label>
                      <span>智能体数量</span>
                      <input
                        v-model.number="runForm.agent_count"
                        type="number"
                        min="1"
                        :max="isLockedPopulationMode ? 1000 : 200"
                        :disabled="isLockedPopulationMode"
                        required
                      >
                    </label>

                    <label>
                      <span>并行Workers</span>
                      <input
                        v-model.number="runForm.max_workers"
                        type="number"
                        min="1"
                        max="48"
                        :disabled="isLockedPopulationMode"
                        required
                      >
                    </label>

                    <label>
                      <span>
                        {{ isLockedPopulationMode ? '随机种子（固定 8 个）' : '随机种子（1–5个）' }}
                      </span>
                      <input
                        v-model="runForm.seeds"
                        type="text"
                        placeholder="20260722, 20261731"
                        :disabled="isLockedPopulationMode"
                        required
                      >
                    </label>

                    <label>
                      <span>Token预算上限</span>
                      <input
                        v-model.number="runForm.token_budget"
                        type="number"
                        min="1000"
                        :max="isForumTwinMode ? 80000000 : (isYuLanScaleMode ? 40000000 : 5000000)"
                        step="1000"
                        :disabled="isLockedPopulationMode"
                        required
                      >
                    </label>
                  </div>

                  <fieldset class="policy-selector">
                    <legend>
                      {{
                        isLockedPopulationMode
                          ? '运行包装策略（锁定自然 + 组合；内核评估 Natural/A/B/C/D）'
                          : '政策方案（至少选择1项）'
                      }}
                    </legend>
                    <label
                      v-for="policy in allowedRunPolicies"
                      :key="policy.policy_id"
                    >
                      <input
                        v-model="runForm.policy_ids"
                        type="checkbox"
                        :value="policy.policy_id"
                        :disabled="isLockedPopulationMode"
                      >
                      <span>
                        <strong>{{ policy.name }}</strong>
                        <small>
                          {{
                            `${
                              reviewedPolicyTemplateKeys.includes(policy.template_key)
                                ? '当前审阅版'
                                : '历史/自定义'
                            } · ${
                              policy.is_baseline
                                ? '自然演化基线'
                                : '治理干预方案'
                            }`
                          }}
                        </small>
                      </span>
                    </label>
                  </fieldset>
                  <p class="runtime-policy-note">
                    {{
                      isYuLanScaleMode
                        ? 'v7 在同一冻结人口上运行双场景与 Natural/A/B/C/D；这里的两项是服务端兼容包装策略。'
                        : selectedPlannerScenario?.template_key
                          === 'lecture_external_incident_v2'
                          ? '讲座外生事件只开放自然演化基线；组合治理不进入本情景。'
                          : '通州治理冲击开放自然演化与组合治理两套正式方案。'
                    }}
                  </p>

                  <div class="run-contract">
                    <span>人口版本 {{ runForm.population_release_id }}</span>
                    <span>
                      感知版本
                      {{ shortHash(projectSensingState.active_snapshot_id) }}
                    </span>
                    <span>模型 {{ runForm.model_name }}</span>
                    <span>
                      计划 {{ formatCount(plannedAgentTurns) }}
                      {{ isLockedPopulationMode ? '个 population_branch_tick 工作单元' : '轮' }} ·
                      {{
                        isYuLanScaleMode
                          ? '16 anchors + 32 PPS / 轮 · 13,056 个预算化 LLM 槽位'
                          : isGovernanceV2Mode
                            ? '8,192 个冻结 fixture 语义槽位 · Provider 0'
                          : `历史生成量估算约 ${formatCount(plannedTokenEstimate)} Token`
                      }}
                    </span>
                    <span>
                      建议硬预算 {{ formatCount(recommendedRunTokenBudget) }}
                      <template v-if="Number(runForm.token_budget) < recommendedRunTokenBudget">
                        · 当前预算偏紧
                      </template>
                    </span>
                  </div>

                  <div class="run-actions">
                    <p>
                      保存后状态为 <strong>draft</strong>；后续只有独立Worker才能执行。
                    </p>
                    <button
                      class="primary-button"
                      type="submit"
                      :disabled="planningRun || !runForm.policy_ids.length"
                    >
                      {{ planningRun ? '正在冻结计划…' : '创建运行计划' }}
                    </button>
                  </div>

                  <div v-if="plannedRun" class="planned-run-result" role="status">
                    <div>
                      <span>计划状态</span>
                      <strong>{{ plannedRun.status }}</strong>
                    </div>
                    <div>
                      <span>运行ID</span>
                      <code>{{ plannedRun.run_id }}</code>
                    </div>
                    <div class="fingerprint-row">
                      <span>不可变输入指纹</span>
                      <code>{{ plannedRun.input_fingerprint }}</code>
                    </div>
                    <div class="fingerprint-row">
                      <span>源证据快照</span>
                      <code>
                        {{
                          plannedRun.source_evidence
                            ? plannedRun.source_evidence.snapshot_id
                            : 'legacy_unbound'
                        }}
                      </code>
                    </div>
                    <div class="fingerprint-row">
                      <span>民意感知快照</span>
                      <code>
                        {{
                          plannedRun.sensing_snapshot?.snapshot_id
                          || plannedRun.sensing_evidence?.snapshot_id
                          || plannedRun.input_snapshot?.sensing?.snapshot_id
                          || 'sensing_unbound'
                        }}
                      </code>
                    </div>
                    <p>已持久化运行计划；模型调用次数为0，当前Token消耗为0。</p>
                  </div>

                </form>
                <div v-else class="run-unavailable" role="note">
                  <span>RUN PLAN / READ ONLY</span>
                  <strong>
                    {{
                      runnableScenarios.length
                        ? '需要显式激活民意感知快照'
                        : '当前没有可用于新运行的封存情景'
                    }}
                  </strong>
                  <p>
                    {{
                      runnableScenarios.length
                        ? '新运行不会根据附加列表猜测版本。服务端state返回active且快照详情完整后，计划器才会开放。'
                        : '历史未绑定情景会继续保留并逐条显示，但不会进入运行选择。完成审阅模板初始化或创建证据血缘已封存的情景后，运行计划器才会开放。'
                    }}
                  </p>
                </div>
                <div
                  v-if="selectedDetails.runs.length"
                  class="run-history"
                  aria-label="最近运行计划"
                >
                  <div class="detail-block-heading">
                    <span>最近运行计划</span>
                    <small>刷新后仍由持久化API恢复</small>
                  </div>
                  <article
                    v-for="run in selectedDetails.runs.slice(0, 5)"
                    :key="run.run_id"
                    :class="{ selected: selectedRuntimeRunId === run.run_id }"
                  >
                    <div>
                      <span>
                        {{
                          run.execution_mode === 'live_llm'
                            ? 'LIVE LLM PLAN'
                            : run.execution_mode === 'llm_forum_twin'
                              ? 'YULAN FORUMTWIN v1 · 16,544 SLOTS'
                            : run.execution_mode === 'budgeted_llm_agent_population'
                              ? 'YULAN-SCALE v1 · 1,000 LLM AGENTS'
                            : run.execution_mode === 'adaptive_particle_population'
                              ? 'GOVERNANCE ARENA v2 · 1,728 UNITS'
                              : 'AUDITED REPLAY'
                        }}
                      </span>
                      <strong>
                        {{ run.effective_runtime_status || run.status }}
                        · {{ run.agent_count }}智能体
                      </strong>
                      <small>
                        plan_status={{ run.plan_status || run.status }}
                      </small>
                      <small>{{ formatDate(run.created_at) }}</small>
                      <small>
                        {{
                          run.evidence_binding_status === 'sealed'
                            ? `证据 ${shortHash(run.source_evidence?.snapshot_id)}`
                            : '历史运行·证据未完整绑定'
                        }}
                      </small>
                      <small>
                        {{
                          run.sensing_binding_status === 'sealed'
                            ? `感知 ${shortHash(
                                run.sensing_snapshot?.snapshot_id
                                || run.sensing_evidence?.snapshot_id,
                              )}`
                            : '历史运行·sensing_unbound'
                        }}
                      </small>
                    </div>
                    <aside class="run-history-actions">
                      <code :title="run.input_fingerprint">
                        {{
                          run.input_fingerprint
                            ? `${run.input_fingerprint.slice(0, 16)}…`
                            : 'fingerprint_unavailable'
                        }}
                      </code>
                      <button
                        type="button"
                        :aria-pressed="selectedRuntimeRunId === run.run_id"
                        @click="selectedRuntimeRunId = run.run_id"
                      >
                        {{
                          selectedRuntimeRunId === run.run_id
                            ? '正在查看'
                            : '查看运行控制'
                        }}
                      </button>
                    </aside>
                  </article>
                </div>
                <div id="runtime-step">
                  <RunExecutionPanel
                    v-if="selectedRuntimeRun"
                    :key="selectedRuntimeRun.run_id"
                    :run="selectedRuntimeRun"
                    :scenario="selectedRuntimeScenario"
                    :policies="selectedDetails.policies"
                    :connected="connected"
                    :runtime-adapter-mode="health?.runtime_adapter_mode || 'disabled'"
                    @runtime-updated="handleRuntimeUpdated"
                  />
                  <div v-else class="runtime-empty-guide">
                    <span>STEP 5 / RUNTIME & RESULT</span>
                    <strong>选中一条运行计划后，这里显示实时状态</strong>
                    <p>包括队列、执行进度、LLM / trace / cache 用量、事件日志、取消、结果分析与报告下载。</p>
                  </div>
                </div>
            </template>
          </template>

          <div v-else class="detail-placeholder">
            <span>治理工作台</span>
            <strong>选择或创建一个项目</strong>
            <p>所有在线记录都来自持久化API，不使用前端伪造项目。</p>
          </div>
        </article>
      </section>

    </div>

    <div
      v-if="showCreateForm"
      class="modal-backdrop"
      role="presentation"
      @click.self="showCreateForm = false"
    >
      <form class="create-modal" @submit.prevent="submitProject">
        <div class="modal-heading">
          <div>
            <h2>建立治理问题边界</h2>
          </div>
          <button
            aria-label="关闭"
            class="close-button"
            type="button"
            @click="showCreateForm = false"
          >
            ×
          </button>
        </div>

        <label>
          <span>项目名称</span>
          <input
            v-model="form.name"
            maxlength="120"
            placeholder="例如：校区安排公共沟通压力测试"
          >
        </label>

        <label>
          <span>治理领域</span>
          <input v-model="form.governance_domain" maxlength="80">
        </label>

        <label>
          <span>治理目标</span>
          <textarea
            v-model="form.objective"
            maxlength="800"
            rows="4"
            placeholder="说明要比较的治理方案、关注的人群与不可越过的结论边界。"
          />
        </label>

        <label>
          <span>评估层级</span>
          <select v-model="form.evaluation_mode">
            <option value="simulation_stress_test">模型条件下仿真压力测试</option>
            <option value="descriptive_pilot">真实试点描述性评估</option>
          </select>
        </label>

        <label class="checkbox-row">
          <input v-model="form.initialize_templates" type="checkbox">
          <span>
            <strong>加载已审阅双冲击模板</strong>
            <small>只加载聚合证据与治理方案，不复制原始帖子。</small>
          </span>
        </label>

        <div v-if="actionError" class="inline-error">{{ actionError }}</div>

        <div class="modal-actions">
          <button
            class="secondary-button"
            type="button"
            @click="showCreateForm = false"
          >
            取消
          </button>
          <button class="primary-button" type="submit" :disabled="creating">
            {{ creating ? '正在创建…' : '创建项目' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
}

.workbench-page {
  background: #08130f;
  color: #eafff6;
  display: block;
  font-family:
    Inter, 'Noto Sans SC', 'Microsoft YaHei', system-ui, sans-serif;
  min-height: 100%;
}

.workbench-main {
  background:
    radial-gradient(circle at 92% 2%, rgba(114, 225, 188, 0.09), transparent 28rem),
    linear-gradient(180deg, #0a1814, #07120f 62%);
  min-width: 0;
  padding: 1.8rem clamp(1rem, 2.5vw, 2.7rem) 4rem;
}

.topbar {
  align-items: center;
  display: flex;
  gap: 1.5rem;
  justify-content: space-between;
}

.topbar h1 {
  font-family: var(--cp-font-sans);
  font-size: clamp(1.35rem, 2.4vw, 2rem);
  font-weight: 500;
  margin: 0;
}

.topbar > div:first-child > p {
  margin: 0.35rem 0 0;
  color: #66877c;
  font-size: 0.75rem;
}

.topbar-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: flex-end;
}

.last-sync,
.deployment-tier {
  color: #66877c;
  font-size: 0.66rem;
  white-space: nowrap;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.primary-button,
.secondary-button,
.refresh-button {
  border-radius: 0.62rem;
  font-size: 0.76rem;
  font-weight: 700;
  min-height: 2.45rem;
  padding: 0.6rem 0.92rem;
}

.primary-button {
  background: #74e1bd;
  border: 1px solid #74e1bd;
  color: #092019;
}

.secondary-button,
.refresh-button {
  background: transparent;
  border: 1px solid rgba(190, 241, 220, 0.18);
  color: #b7d2c8;
}

.service-alert {
  align-items: center;
  background: rgba(255, 132, 105, 0.08);
  border: 1px solid rgba(255, 146, 121, 0.25);
  border-radius: 0.85rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: 1.3rem;
  padding: 0.9rem 1rem;
}

.service-alert strong {
  color: #ffaf99;
  font-size: 0.82rem;
}

.service-alert p {
  color: #9db5ac;
  font-size: 0.73rem;
  line-height: 1.55;
  margin: 0.3rem 0 0;
}

.service-alert a {
  color: #ffb49f;
  flex: 0 0 auto;
  font-size: 0.75rem;
}

.stats-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 0.9rem;
}

.stat-card {
  background: rgba(11, 31, 25, 0.78);
  border: 1px solid rgba(166, 234, 210, 0.1);
  border-radius: 0.85rem;
  display: grid;
  gap: 0.45rem;
  padding: 1rem;
}

.stat-card span,
.stat-card small {
  color: #6f9084;
  font-size: 0.7rem;
}

.stat-card strong {
  color: #effff8;
  font-family: Georgia, serif;
  font-size: 1.75rem;
  font-weight: 500;
}

.workspace-grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: minmax(17rem, 0.78fr) minmax(0, 1.35fr);
  margin-top: 2.2rem;
}

.projects-panel,
.project-detail {
  background: rgba(8, 25, 20, 0.74);
  border: 1px solid rgba(166, 234, 210, 0.1);
  border-radius: 1rem;
}

.projects-panel,
.project-detail {
  min-height: 29rem;
  padding: 1.1rem;
}

.section-heading {
  align-items: flex-end;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.section-heading h2 {
  font-family: var(--cp-font-sans);
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0;
}

.section-heading > span {
  color: #6c8d82;
  font-size: 0.7rem;
}

.project-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.project-row {
  align-items: center;
  background: rgba(18, 43, 35, 0.44);
  border: 1px solid transparent;
  border-radius: 0.78rem;
  color: inherit;
  display: grid;
  gap: 0.72rem;
  grid-template-columns: auto 1fr auto;
  padding: 0.8rem;
  text-align: left;
  width: 100%;
}

.project-row:hover,
.project-row.selected {
  background: rgba(73, 151, 124, 0.13);
  border-color: rgba(113, 224, 188, 0.22);
}

.project-glyph {
  align-items: center;
  background: #173a30;
  border-radius: 0.65rem;
  color: #77e0bd;
  display: inline-flex;
  font-family: Georgia, serif;
  height: 2.4rem;
  justify-content: center;
  width: 2.4rem;
}

.project-copy strong,
.project-copy small,
.project-meta em,
.project-meta small {
  display: block;
}

.project-copy strong {
  font-size: 0.83rem;
}

.project-copy small,
.project-meta small {
  color: #66887c;
  font-size: 0.66rem;
  margin-top: 0.28rem;
}

.project-meta {
  text-align: right;
}

.project-meta em {
  color: #d0ae73;
  font-size: 0.62rem;
  font-style: normal;
}

.empty-state,
.detail-placeholder,
.detail-loading {
  align-items: center;
  color: #6f9185;
  display: flex;
  flex-direction: column;
  font-size: 0.78rem;
  justify-content: center;
  min-height: 21rem;
  text-align: center;
}

.empty-state strong,
.detail-placeholder strong {
  color: #cfe7dd;
  font-family: Georgia, 'Noto Serif SC', serif;
  font-size: 1.1rem;
}

.empty-state p,
.detail-placeholder p {
  line-height: 1.7;
  max-width: 26rem;
}

.empty-state button {
  background: transparent;
  border: 1px solid rgba(113, 224, 188, 0.28);
  border-radius: 0.6rem;
  color: #77dfbc;
  padding: 0.55rem 0.9rem;
}

.detail-heading {
  align-items: center;
}

.project-objective {
  border-bottom: 1px solid rgba(166, 234, 210, 0.09);
  color: #88a89d;
  font-size: 0.76rem;
  line-height: 1.7;
  margin: 0.9rem 0 0;
  padding-bottom: 1rem;
}

.entity-summary {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 1rem;
}

.entity-summary div {
  background: #0d241d;
  border-radius: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.72rem;
}

.entity-summary span {
  color: #6c9083;
  font-size: 0.65rem;
}

.entity-summary strong {
  font-family: Georgia, serif;
  font-size: 1.25rem;
}

.bootstrap-card,
.next-step-card {
  align-items: center;
  background:
    linear-gradient(125deg, rgba(99, 209, 173, 0.1), transparent),
    #0b211a;
  border: 1px solid rgba(113, 224, 188, 0.16);
  border-radius: 0.78rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: 1rem;
  padding: 1rem;
}

.bootstrap-card span,
.next-step-card span {
  color: #70d9b5;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

.bootstrap-card strong,
.next-step-card strong {
  display: block;
  font-size: 0.82rem;
  margin-top: 0.36rem;
}

.bootstrap-card p,
.next-step-card p {
  color: #6f9286;
  font-size: 0.68rem;
  line-height: 1.6;
  margin: 0.4rem 0 0;
}

.bootstrap-card button,
.next-step-card button {
  background: #70dfba;
  border: 0;
  border-radius: 0.58rem;
  color: #082019;
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-weight: 750;
  padding: 0.62rem 0.82rem;
}

.evidence-panel {
  background:
    radial-gradient(circle at 100% 0, rgba(112, 223, 186, 0.09), transparent 42%),
    #0a1d17;
  border: 1px solid rgba(112, 223, 186, 0.17);
  border-radius: 0.82rem;
  margin-top: 1rem;
  padding: 1rem;
}

.evidence-panel-heading {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.evidence-panel-heading > div:first-child > span {
  color: #70dfba;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

.evidence-panel-heading strong {
  display: block;
  font-size: 0.88rem;
  margin-top: 0.35rem;
}

.evidence-panel-heading p {
  color: #75968a;
  font-size: 0.67rem;
  line-height: 1.65;
  margin: 0.4rem 0 0;
  max-width: 38rem;
}

.evidence-badges {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
}

.evidence-kpis,
.evidence-lineage {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 0.85rem;
}

.evidence-kpis article,
.evidence-lineage > div {
  background: rgba(19, 48, 39, 0.64);
  border-radius: 0.62rem;
  min-width: 0;
  padding: 0.72rem;
}

.evidence-kpis span,
.evidence-lineage span {
  color: #6d9083;
  display: block;
  font-size: 0.61rem;
}

.evidence-kpis strong,
.evidence-lineage strong,
.evidence-lineage code {
  color: #dcefe7;
  display: block;
  font-size: 0.73rem;
  margin-top: 0.32rem;
  overflow-wrap: anywhere;
}

.evidence-kpis strong {
  color: #7de3c0;
  font-family: Georgia, serif;
  font-size: 1rem;
}

.evidence-kpis small {
  color: #58796e;
  display: block;
  font-size: 0.57rem;
  line-height: 1.45;
  margin-top: 0.3rem;
  overflow-wrap: anywhere;
}

.evidence-lineage code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
}

.evidence-limit {
  border-top: 1px solid rgba(166, 234, 210, 0.09);
  color: #78988d;
  font-size: 0.63rem;
  line-height: 1.65;
  margin: 0.85rem 0 0;
  padding-top: 0.75rem;
}

.sensing-panel {
  background:
    radial-gradient(circle at 0 0, rgba(111, 158, 236, 0.13), transparent 35%),
    linear-gradient(145deg, rgba(19, 38, 52, 0.94), rgba(8, 25, 20, 0.96));
  border: 1px solid rgba(137, 182, 238, 0.2);
  border-radius: 0.9rem;
  margin-top: 1rem;
  overflow: hidden;
  padding: 1rem;
}

.sensing-panel-heading {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.sensing-panel-heading > div:first-child > span,
.sensing-review-grid > section > span,
.sensing-next-slice > span {
  color: #8fb9ef;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

.sensing-panel-heading strong {
  display: block;
  font-size: 0.9rem;
  margin-top: 0.35rem;
}

.sensing-panel-heading p {
  color: #799b9e;
  font-size: 0.68rem;
  line-height: 1.65;
  margin: 0.42rem 0 0;
  max-width: 39rem;
}

.sensing-inline-notice,
.sensing-inline-error,
.sensing-inline-warning {
  border-radius: 0.62rem;
  font-size: 0.66rem;
  line-height: 1.6;
  margin-top: 0.75rem;
  padding: 0.7rem 0.78rem;
}

.sensing-inline-notice {
  background: rgba(96, 203, 167, 0.09);
  border: 1px solid rgba(113, 224, 188, 0.18);
  color: #8be9c8;
}

.sensing-inline-error {
  background: rgba(255, 135, 106, 0.08);
  border: 1px solid rgba(255, 135, 106, 0.2);
  color: #ffb29f;
}

.sensing-inline-warning {
  background: rgba(236, 174, 91, 0.08);
  border: 1px solid rgba(236, 174, 91, 0.2);
  color: #e7bf85;
}

.sensing-version-list {
  display: grid;
  gap: 0.48rem;
  margin-top: 0.8rem;
}

.sensing-version-list article {
  align-items: center;
  background: rgba(10, 27, 32, 0.75);
  border: 1px solid rgba(137, 182, 238, 0.12);
  border-radius: 0.68rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 0.72rem;
}

.sensing-version-list article.active {
  background: rgba(74, 127, 175, 0.12);
  border-color: rgba(143, 185, 239, 0.32);
}

.sensing-version-list article > div {
  min-width: 0;
}

.sensing-version-list span,
.sensing-version-list strong,
.sensing-version-list small {
  display: block;
}

.sensing-version-list span {
  color: #82aeda;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.56rem;
}

.sensing-version-list strong {
  font-size: 0.72rem;
  margin-top: 0.28rem;
}

.sensing-version-list small {
  color: #66898c;
  font-size: 0.6rem;
  margin-top: 0.28rem;
  overflow-wrap: anywhere;
}

.sensing-empty {
  align-items: center;
  background: rgba(8, 25, 27, 0.58);
  border: 1px dashed rgba(137, 182, 238, 0.18);
  border-radius: 0.7rem;
  color: #6f9295;
  display: flex;
  flex-direction: column;
  font-size: 0.7rem;
  justify-content: center;
  margin-top: 0.8rem;
  min-height: 7rem;
  padding: 1rem;
  text-align: center;
}

.sensing-empty strong {
  color: #c9dce2;
  font-size: 0.8rem;
}

.sensing-empty p {
  line-height: 1.65;
  margin: 0.45rem 0 0;
  max-width: 33rem;
}

.sensing-kpis,
.sensing-scope {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 0.85rem;
}

.sensing-kpis article,
.sensing-scope > div {
  background: rgba(15, 39, 42, 0.72);
  border: 1px solid rgba(137, 182, 238, 0.08);
  border-radius: 0.64rem;
  min-width: 0;
  padding: 0.72rem;
}

.sensing-kpis span,
.sensing-scope span,
.sensing-months > span,
.sensing-privacy-state span {
  color: #6e919a;
  display: block;
  font-size: 0.6rem;
}

.sensing-kpis strong {
  color: #9ec6f4;
  display: block;
  font-family: Georgia, serif;
  font-size: 1.05rem;
  font-weight: 500;
  margin-top: 0.3rem;
}

.sensing-kpis small,
.sensing-scope small {
  color: #5f7e82;
  display: block;
  font-size: 0.57rem;
  line-height: 1.5;
  margin-top: 0.3rem;
}

.sensing-scope {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.sensing-scope strong,
.sensing-scope code {
  color: #d6e8eb;
  display: block;
  font-size: 0.68rem;
  margin-top: 0.32rem;
  overflow-wrap: anywhere;
}

.sensing-scope code,
.sensing-boundary-note code,
.sensing-review-grid code,
.sensing-privacy-state code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.sensing-status-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.34rem;
  margin-top: 0.55rem;
}

.sensing-status-strip span {
  background: rgba(111, 158, 236, 0.08);
  border: 1px solid rgba(137, 182, 238, 0.1);
  border-radius: 999px;
  color: #64858c;
  font-size: 0.53rem;
  padding: 0.28rem 0.48rem;
}

.sensing-status-strip code {
  color: #9bbcd3;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-left: 0.2rem;
}

.sensing-months {
  background: rgba(11, 31, 34, 0.55);
  border-radius: 0.64rem;
  margin-top: 0.6rem;
  padding: 0.7rem;
}

.sensing-months > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin-top: 0.42rem;
}

.sensing-months small {
  background: rgba(111, 158, 236, 0.1);
  border: 1px solid rgba(137, 182, 238, 0.12);
  border-radius: 999px;
  color: #94b4c6;
  font-size: 0.56rem;
  padding: 0.22rem 0.44rem;
}

.sensing-months p {
  color: #58777b;
  font-size: 0.57rem;
  margin: 0.45rem 0 0;
}

.sensing-section-heading {
  align-items: flex-end;
  border-top: 1px solid rgba(137, 182, 238, 0.1);
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-top: 0.9rem;
  padding-top: 0.8rem;
}

.sensing-section-heading.compact {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}

.sensing-section-heading span,
.sensing-section-heading small {
  display: block;
}

.sensing-section-heading span {
  color: #d7e7ec;
  font-size: 0.72rem;
  font-weight: 700;
}

.sensing-section-heading small,
.sensing-section-heading p {
  color: #5f7f84;
  font-size: 0.58rem;
}

.sensing-section-heading small {
  margin-top: 0.28rem;
}

.sensing-section-heading p {
  margin: 0;
}

.sensing-domain-grid {
  display: grid;
  gap: 0.48rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.6rem;
}

.sensing-domain-grid article {
  background: rgba(13, 35, 38, 0.75);
  border: 1px solid rgba(137, 182, 238, 0.09);
  border-radius: 0.64rem;
  min-width: 0;
  padding: 0.68rem;
}

.sensing-domain-grid article > span {
  color: #688b9c;
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.53rem;
  overflow-wrap: anywhere;
}

.sensing-domain-grid article > strong {
  display: block;
  font-size: 0.7rem;
  margin-top: 0.3rem;
}

.sensing-domain-grid article > div {
  align-items: baseline;
  display: flex;
  gap: 0.45rem;
  justify-content: space-between;
  margin-top: 0.55rem;
}

.sensing-domain-grid b {
  color: #a6cdf7;
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
}

.sensing-domain-grid small {
  color: #628184;
  font-size: 0.55rem;
  text-align: right;
}

.sensing-missing-field {
  background: rgba(82, 59, 31, 0.35);
  border: 1px solid rgba(224, 173, 99, 0.14);
  border-radius: 0.6rem;
  color: #b5966c;
  font-size: 0.62rem;
  line-height: 1.55;
  margin-top: 0.58rem;
  padding: 0.65rem;
}

.sensing-two-column,
.sensing-review-grid {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.8rem;
}

.sensing-two-column > section,
.sensing-review-grid > section {
  background: rgba(10, 29, 32, 0.68);
  border: 1px solid rgba(137, 182, 238, 0.09);
  border-radius: 0.68rem;
  min-width: 0;
  padding: 0.72rem;
}

.sensing-distribution {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.58rem;
}

.sensing-distribution > div {
  background: rgba(24, 50, 52, 0.6);
  border-radius: 0.52rem;
  display: grid;
  gap: 0.22rem;
  grid-template-columns: 1fr auto;
  padding: 0.52rem;
}

.sensing-distribution span,
.sensing-distribution small {
  color: #729397;
  font-size: 0.56rem;
}

.sensing-distribution strong {
  color: #cae1e8;
  font-size: 0.7rem;
}

.sensing-distribution small {
  grid-column: 1 / -1;
}

.sensing-boundary-note {
  border-top: 1px solid rgba(137, 182, 238, 0.08);
  color: #6c8b91;
  font-size: 0.59rem;
  line-height: 1.6;
  margin: 0.62rem 0 0;
  padding-top: 0.58rem;
}

.sensing-boundary-note code {
  color: #9fc2da;
}

.sensing-need-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.62rem;
}

.sensing-need-grid article {
  background: rgba(11, 31, 34, 0.7);
  border: 1px solid rgba(137, 182, 238, 0.08);
  border-radius: 0.66rem;
  min-width: 0;
  padding: 0.7rem;
}

.sensing-need-title {
  align-items: center;
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
}

.sensing-need-title span {
  color: #80a9d2;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.54rem;
}

.sensing-need-title small {
  color: #66868a;
  font-size: 0.54rem;
  text-align: right;
}

.sensing-need-grid article > strong {
  display: block;
  font-size: 0.72rem;
  margin-top: 0.36rem;
}

.sensing-need-grid article > p {
  color: #78999b;
  font-size: 0.6rem;
  line-height: 1.55;
  margin: 0.38rem 0 0;
}

.sensing-need-grid dl {
  border-top: 1px solid rgba(137, 182, 238, 0.08);
  display: grid;
  gap: 0.4rem;
  margin: 0.55rem 0 0;
  padding-top: 0.52rem;
}

.sensing-need-grid dl > div {
  display: grid;
  gap: 0.25rem;
  grid-template-columns: 4rem 1fr;
}

.sensing-need-grid dt,
.sensing-need-grid dd {
  font-size: 0.56rem;
  line-height: 1.45;
  margin: 0;
}

.sensing-need-grid dt {
  color: #587a7d;
}

.sensing-need-grid dd {
  color: #829fa3;
}

.sensing-review-grid > section > strong {
  display: block;
  font-size: 0.75rem;
  margin-top: 0.32rem;
}

.sensing-review-grid > section > p,
.sensing-review-grid li {
  color: #6e8c91;
  font-size: 0.59rem;
  line-height: 1.62;
}

.sensing-review-grid > section > p {
  margin: 0.6rem 0 0;
}

.sensing-review-grid ul {
  margin: 0.58rem 0 0;
  padding-left: 1.05rem;
}

.sensing-review-metrics {
  display: grid;
  gap: 0.38rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.58rem;
}

.sensing-review-metrics > div {
  background: rgba(24, 50, 52, 0.62);
  border-radius: 0.52rem;
  padding: 0.52rem;
}

.sensing-review-metrics b,
.sensing-review-metrics small {
  display: block;
}

.sensing-review-metrics b {
  color: #a4c9ed;
  font-family: Georgia, serif;
  font-size: 0.92rem;
  font-weight: 500;
}

.sensing-review-metrics small {
  color: #638287;
  font-size: 0.54rem;
  margin-top: 0.22rem;
}

.sensing-privacy-state {
  border-top: 1px solid rgba(137, 182, 238, 0.08);
  margin-top: 0.6rem;
  padding-top: 0.55rem;
}

.sensing-privacy-state code {
  color: #9ebed4;
  display: block;
  font-size: 0.6rem;
  margin-top: 0.28rem;
  overflow-wrap: anywhere;
}

.sensing-next-slice {
  background:
    linear-gradient(120deg, rgba(91, 137, 198, 0.12), transparent),
    rgba(10, 28, 34, 0.82);
  border: 1px solid rgba(137, 182, 238, 0.16);
  border-radius: 0.68rem;
  margin-top: 0.7rem;
  padding: 0.75rem;
}

.sensing-next-slice strong {
  display: block;
  font-size: 0.73rem;
  margin-top: 0.3rem;
}

.sensing-next-slice p {
  color: #6c8e94;
  font-size: 0.6rem;
  line-height: 1.6;
  margin: 0.36rem 0 0;
}

.detail-block {
  margin-top: 1rem;
}

.detail-block-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.55rem;
}

.detail-block-heading span {
  color: #cfe7dd;
  font-size: 0.75rem;
  font-weight: 700;
}

.detail-block-heading small {
  color: #5f8175;
  font-size: 0.63rem;
}

.scenario-cards,
.policy-list {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.scenario-cards article,
.policy-list div {
  background: rgba(14, 38, 30, 0.7);
  border: 1px solid rgba(166, 234, 210, 0.08);
  border-radius: 0.65rem;
  display: grid;
  gap: 0.35rem;
  padding: 0.72rem;
}

.scenario-cards span,
.policy-list span {
  color: #d0a966;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.58rem;
}

.scenario-cards strong,
.policy-list strong {
  font-size: 0.74rem;
}

.scenario-cards small,
.policy-list small {
  color: #638277;
  font-size: 0.62rem;
}

.scenario-cards article.legacy-scenario {
  background: rgba(62, 38, 24, 0.48);
  border-color: rgba(240, 165, 105, 0.28);
}

.legacy-warning {
  border-top: 1px solid rgba(240, 165, 105, 0.18);
  color: #d7a77f;
  font-size: 0.61rem;
  line-height: 1.55;
  margin: 0.18rem 0 0;
  padding-top: 0.48rem;
}

.live-qualification-summary {
  background:
    linear-gradient(125deg, rgba(113, 148, 232, 0.1), transparent 46%),
    rgba(8, 25, 31, 0.82);
  border: 1px solid rgba(137, 182, 238, 0.16);
  border-radius: 0.82rem;
  margin-top: 1rem;
  padding: 0.9rem;
}

.live-qualification-heading {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.live-qualification-heading span,
.live-qualification-heading strong {
  display: block;
}

.live-qualification-heading span {
  color: #83aef0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
}

.live-qualification-heading strong {
  font-size: 0.82rem;
  margin-top: 0.35rem;
}

.live-qualification-grid {
  display: grid;
  gap: 0.48rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 0.75rem;
}

.live-qualification-grid article {
  background: rgba(8, 24, 29, 0.72);
  border: 1px solid rgba(137, 182, 238, 0.09);
  border-radius: 0.62rem;
  min-width: 0;
  padding: 0.65rem;
}

.live-qualification-grid span,
.live-qualification-grid small {
  color: #668691;
  display: block;
  font-size: 0.56rem;
}

.live-qualification-grid strong {
  display: block;
  font-size: 0.7rem;
  margin-top: 0.28rem;
  overflow-wrap: anywhere;
}

.live-qualification-grid small {
  margin-top: 0.3rem;
  overflow-wrap: anywhere;
}

.live-qualification-error,
.live-qualification-boundary {
  font-size: 0.6rem;
  line-height: 1.6;
  margin: 0.65rem 0 0;
}

.live-qualification-error {
  background: rgba(255, 135, 106, 0.08);
  border-radius: 0.52rem;
  color: #ffb29f;
  padding: 0.58rem;
}

.live-qualification-boundary {
  border-top: 1px solid rgba(137, 182, 238, 0.08);
  color: #708e98;
  padding-top: 0.58rem;
}

.run-planner {
  background:
    linear-gradient(135deg, rgba(91, 196, 161, 0.08), transparent 44%),
    #091d17;
  border: 1px solid rgba(113, 224, 188, 0.15);
  border-radius: 0.82rem;
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
}

.run-unavailable {
  background: rgba(47, 34, 25, 0.46);
  border: 1px solid rgba(240, 165, 105, 0.2);
  border-radius: 0.82rem;
  margin-top: 1rem;
  padding: 1rem;
}

.run-unavailable > span {
  color: #d7a77f;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

.run-unavailable strong {
  display: block;
  font-size: 0.84rem;
  margin-top: 0.38rem;
}

.run-unavailable p {
  color: #9d806c;
  font-size: 0.66rem;
  line-height: 1.65;
  margin: 0.45rem 0 0;
}

.run-planner-heading {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.run-planner-heading > div > span {
  color: #70d9b5;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

.run-planner-heading strong {
  display: block;
  font-size: 0.88rem;
  margin-top: 0.38rem;
}

.run-planner-heading p,
.run-actions p {
  color: #6f9286;
  font-size: 0.68rem;
  line-height: 1.6;
  margin: 0.4rem 0 0;
}

.run-form-grid {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.run-form-grid label > span,
.policy-selector legend {
  color: #7f9d92;
  display: block;
  font-size: 0.65rem;
  margin-bottom: 0.38rem;
}

.run-form-grid input,
.run-form-grid select {
  background: #06140f;
  border: 1px solid rgba(166, 234, 210, 0.13);
  border-radius: 0.56rem;
  box-sizing: border-box;
  color: #eafff6;
  min-height: 2.45rem;
  padding: 0.58rem 0.68rem;
  width: 100%;
}

.run-form-grid input:focus,
.run-form-grid select:focus {
  border-color: rgba(113, 224, 188, 0.52);
}

.policy-selector {
  border: 0;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  min-width: 0;
  padding: 0;
}

.policy-selector legend {
  grid-column: 1 / -1;
  padding: 0;
}

.policy-selector label {
  align-items: flex-start;
  background: rgba(15, 42, 33, 0.68);
  border: 1px solid rgba(166, 234, 210, 0.08);
  border-radius: 0.62rem;
  cursor: pointer;
  display: flex;
  gap: 0.55rem;
  padding: 0.68rem;
}

.policy-selector input {
  accent-color: #72deb9;
  margin-top: 0.12rem;
}

.policy-selector strong,
.policy-selector small {
  display: block;
}

.policy-selector strong {
  color: #d8eee5;
  font-size: 0.7rem;
}

.policy-selector small {
  color: #648478;
  font-size: 0.61rem;
  margin-top: 0.28rem;
}

.runtime-policy-note {
  background: rgba(117, 226, 189, 0.05);
  border-left: 2px solid rgba(117, 226, 189, 0.5);
  color: #83a99b;
  font-size: 0.68rem;
  line-height: 1.55;
  margin: 0;
  padding: 0.58rem 0.7rem;
}

.run-contract {
  color: #66877c;
  display: flex;
  flex-wrap: wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.58rem;
  gap: 0.45rem 0.85rem;
}

.run-actions {
  align-items: center;
  border-top: 1px solid rgba(166, 234, 210, 0.08);
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding-top: 0.85rem;
}

.run-actions p {
  margin: 0;
}

.planned-run-result {
  background: rgba(80, 175, 143, 0.08);
  border: 1px solid rgba(113, 224, 188, 0.18);
  border-radius: 0.7rem;
  display: grid;
  gap: 0.62rem;
  grid-template-columns: minmax(6rem, 0.35fr) minmax(0, 1fr);
  padding: 0.8rem;
}

.planned-run-result div {
  display: grid;
  gap: 0.25rem;
}

.planned-run-result span {
  color: #66877c;
  font-size: 0.6rem;
}

.planned-run-result strong {
  color: #74e1bd;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  text-transform: uppercase;
}

.planned-run-result code {
  color: #c8e3d8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  overflow-wrap: anywhere;
}

.planned-run-result .fingerprint-row,
.planned-run-result p {
  grid-column: 1 / -1;
}

.planned-run-result p {
  color: #73a694;
  font-size: 0.64rem;
  line-height: 1.55;
  margin: 0;
}

.run-history {
  border-top: 1px solid rgba(166, 234, 210, 0.09);
  display: grid;
  gap: 0.5rem;
  padding-top: 0.85rem;
}

.run-history article {
  align-items: center;
  background: rgba(8, 24, 19, 0.6);
  border: 1px solid rgba(166, 234, 210, 0.08);
  border-radius: 0.64rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 0.72rem;
}

.run-history article.selected {
  background: rgba(83, 180, 148, 0.08);
  border-color: rgba(117, 226, 189, 0.28);
}

.run-history article > div {
  display: grid;
  gap: 0.22rem;
}

.run-history article span,
.run-history article small {
  color: #6d9184;
  font-size: 0.61rem;
}

.run-history article strong {
  font-size: 0.72rem;
}

.run-history code {
  color: #78dcb9;
  font-size: 0.63rem;
  overflow-wrap: anywhere;
}

.run-history-actions {
  align-items: flex-end;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 0.48rem;
}

.run-history-actions button {
  background: transparent;
  border: 1px solid rgba(117, 226, 189, 0.2);
  border-radius: 0.48rem;
  color: #8fcdb8;
  cursor: pointer;
  font-size: 0.63rem;
  padding: 0.38rem 0.55rem;
}

.run-history-actions button[aria-pressed='true'] {
  background: rgba(117, 226, 189, 0.1);
  color: #b8f0dd;
}

.inline-notice,
.inline-error {
  border-radius: 0.6rem;
  font-size: 0.72rem;
  margin-bottom: 0.8rem;
  padding: 0.7rem;
}

.inline-notice {
  background: rgba(91, 196, 161, 0.08);
  border: 1px solid rgba(113, 224, 188, 0.18);
  color: #8be9c8;
}

.inline-error {
  background: rgba(255, 135, 106, 0.08);
  border: 1px solid rgba(255, 135, 106, 0.2);
  color: #ffb29f;
}

.modal-backdrop {
  align-items: center;
  background: rgba(2, 8, 6, 0.78);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 1rem;
  position: fixed;
  z-index: 100;
}

.create-modal {
  background:
    radial-gradient(circle at 100% 0, rgba(114, 225, 188, 0.1), transparent 40%),
    #0b1e18;
  border: 1px solid rgba(166, 234, 210, 0.17);
  border-radius: 1rem;
  box-shadow: 0 2rem 6rem rgba(0, 0, 0, 0.45);
  display: grid;
  gap: 0.9rem;
  max-height: calc(100vh - 2rem);
  max-width: 36rem;
  overflow-y: auto;
  padding: 1.25rem;
  width: 100%;
}

.modal-heading {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
}

.modal-heading h2 {
  font-family: Georgia, 'Noto Serif SC', serif;
  font-size: 1.35rem;
  font-weight: 500;
  margin: 0;
}

.close-button {
  background: transparent;
  border: 0;
  color: #79988e;
  font-size: 1.4rem;
}

.create-modal label > span {
  color: #8eaaa0;
  display: block;
  font-size: 0.69rem;
  margin-bottom: 0.42rem;
}

.create-modal input,
.create-modal textarea,
.create-modal select {
  background: #071611;
  border: 1px solid rgba(166, 234, 210, 0.14);
  border-radius: 0.58rem;
  box-sizing: border-box;
  color: #eafff6;
  padding: 0.68rem 0.75rem;
  resize: vertical;
  width: 100%;
}

.create-modal input:focus,
.create-modal textarea:focus,
.create-modal select:focus {
  border-color: rgba(113, 224, 188, 0.55);
}

.checkbox-row {
  align-items: flex-start;
  background: rgba(67, 142, 117, 0.08);
  border-radius: 0.65rem;
  display: flex;
  gap: 0.65rem;
  padding: 0.75rem;
}

.checkbox-row input {
  margin-top: 0.15rem;
  width: auto;
}

.checkbox-row > span {
  margin: 0 !important;
}

.checkbox-row strong,
.checkbox-row small {
  display: block;
}

.checkbox-row strong {
  color: #cde5dc;
  font-size: 0.73rem;
}

.checkbox-row small {
  color: #67877b;
  font-size: 0.64rem;
  margin-top: 0.26rem;
}

.modal-actions {
  display: flex;
  gap: 0.65rem;
  justify-content: flex-end;
  padding-top: 0.3rem;
}

@media (max-width: 1080px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .workbench-page {
    grid-template-columns: minmax(0, 1fr);
  }

  .workbench-main {
    box-sizing: border-box;
    max-width: 100%;
    padding-top: 1.1rem;
  }

  .workbench-page :deep(.workbench-sidebar) {
    box-sizing: border-box;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
  }
}

@media (max-width: 680px) {
  .topbar,
  .service-alert {
    align-items: flex-start;
    flex-direction: column;
  }

  .topbar-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .primary-button {
    flex: 1;
  }

  .topbar-actions .primary-button {
    flex-basis: 100%;
    width: 100%;
  }

  .stats-grid,
  .entity-summary,
  .evidence-kpis,
  .evidence-lineage,
  .sensing-kpis,
  .sensing-domain-grid,
  .scenario-cards,
  .policy-list,
  .live-qualification-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sensing-scope,
  .sensing-two-column,
  .sensing-review-grid,
  .sensing-need-grid {
    grid-template-columns: 1fr;
  }

  .project-row {
    grid-template-columns: auto 1fr;
  }

  .project-meta {
    display: none;
  }

  .bootstrap-card,
  .next-step-card,
  .evidence-panel-heading,
  .sensing-panel-heading,
  .sensing-version-list article,
  .sensing-section-heading,
  .sensing-need-title,
  .run-planner-heading,
  .run-actions,
  .run-history article {
    align-items: flex-start;
    flex-direction: column;
  }

  .run-actions .primary-button {
    width: 100%;
  }

  .run-history-actions {
    align-items: flex-start;
    width: 100%;
  }
}

@media (max-width: 430px) {
  .stats-grid,
  .entity-summary,
  .evidence-kpis,
  .evidence-lineage,
  .sensing-kpis,
  .sensing-domain-grid,
  .sensing-distribution,
  .sensing-review-metrics,
  .scenario-cards,
  .policy-list,
  .live-qualification-grid,
  .run-form-grid,
  .policy-selector,
  .planned-run-result {
    grid-template-columns: 1fr;
  }

  .planned-run-result .fingerprint-row,
  .planned-run-result p {
    grid-column: 1;
  }
}

/* Product skin: preserve the existing API workflow inside the CampusPulse shell. */
.workbench-page {
  background: #f0f2f5;
  color: #111111;
}

.workbench-main {
  background: #f0f2f5;
  padding: 1.6rem clamp(1rem, 2.5vw, 2.5rem) 3rem;
}

.topbar h1,
.section-heading h2,
.project-detail h2 { color: #111111; font-family: var(--cp-font-sans); }
.last-sync,
.deployment-tier { color: #777777; }
.primary-button { background: #ae0b2a; border-color: #ae0b2a; color: #ffffff; }
.secondary-button,
.refresh-button { background: #ffffff; border-color: #cfcfcf; color: #333333; }
.service-alert { background: #fff7f8; border-color: #e7bec7; border-radius: 0; }
.service-alert strong,
.service-alert a { color: #ae0b2a; }
.service-alert p { color: #6d6d6d; }
.workflow-guide {
  background: #ffffff;
  border: 1px solid #dcdcdc;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 0.9rem;
}
.workflow-guide a {
  align-items: center;
  border-right: 1px solid #e1e1e1;
  color: #111111;
  display: grid;
  gap: 0.2rem 0.65rem;
  grid-template-columns: 1.65rem 1fr;
  padding: 0.85rem;
  text-decoration: none;
}
.workflow-guide a:last-child { border-right: 0; }
.workflow-guide b {
  align-items: center;
  background: #ae0b2a;
  color: #ffffff;
  display: flex;
  font-size: 0.65rem;
  grid-row: 1 / 3;
  height: 1.65rem;
  justify-content: center;
}
.workflow-guide span { font-size: 0.72rem; font-weight: 750; }
.workflow-guide small { color: #888888; font-size: 0.58rem; }

.stat-card,
.projects-panel,
.project-detail,
.evidence-panel,
.sensing-panel,
.detail-block,
.live-qualification-summary,
.run-planner,
.run-unavailable,
.runtime-empty-guide,
.bootstrap-card,
.next-step-card {
  background: #ffffff;
  border-color: #dcdcdc;
  border-radius: 0;
  color: #111111;
}
.stat-card span,
.stat-card small,
.section-heading > span,
.project-objective,
.detail-block-heading small,
.entity-summary span,
.entity-summary small,
.evidence-panel p,
.sensing-panel p,
.run-planner p,
.run-unavailable p,
.runtime-empty-guide p { color: #707070; }
.stat-card strong,
.entity-summary strong,
.evidence-kpis strong,
.sensing-kpis strong,
.detail-block-heading span,
.bootstrap-card strong,
.run-planner strong,
.run-unavailable strong,
.runtime-empty-guide strong { color: #111111; }
.project-row,
.scenario-cards article,
.policy-list > div,
.evidence-kpis article,
.evidence-lineage > div,
.sensing-kpis article,
.sensing-version-list article,
.live-qualification-grid article,
.run-history article,
.entity-summary > div,
.planned-run-result > div,
.sensing-scope > div,
.sensing-two-column > section,
.sensing-review-grid > section {
  background: #fafafa;
  border-color: #dedede;
  border-radius: 0;
  color: #111111;
}
.project-row:hover,
.project-row.selected,
.run-history article.selected { background: #fce8ec; border-color: #ae0b2a; }
.project-glyph { background: #ae0b2a; color: #ffffff; }
.project-copy strong,
.scenario-cards strong,
.policy-list strong,
.sensing-version-list strong,
.run-history strong { color: #111111; }
.project-copy small,
.project-meta small,
.scenario-cards small,
.policy-list small,
.run-history small { color: #777777; }
.project-meta em,
.evidence-panel-heading > div > span,
.sensing-panel-heading > div > span,
.live-qualification-heading > div > span,
.run-planner-heading > div > span,
.runtime-empty-guide > span { color: #ae0b2a; }
.evidence-panel,
.sensing-panel,
.run-planner { border-top: 4px solid #ae0b2a; }
.live-qualification-summary { border-left: 4px solid #9b8a5c; }
.run-contract,
.sensing-status-strip,
.evidence-limit,
.live-qualification-boundary { background: #f7f7f7; border-color: #dedede; color: #666666; }
.run-form-grid input,
.run-form-grid select,
.create-modal input,
.create-modal textarea,
.create-modal select { background: #ffffff; border-color: #cfcfcf; color: #111111; }
.policy-selector { border-color: #d9d9d9; }
.policy-selector label { background: #fafafa; border-color: #dfdfdf; }
.policy-selector label strong { color: #111111; }
.policy-selector label small { color: #777777; }
.empty-state,
.detail-placeholder,
.detail-loading { color: #777777; }
.runtime-empty-guide { margin-top: 1rem; padding: 1.2rem; }
.runtime-empty-guide span,
.runtime-empty-guide strong { display: block; }
.runtime-empty-guide span { font: 800 0.62rem ui-monospace, monospace; letter-spacing: 0.11em; }
.runtime-empty-guide strong { font-size: 0.85rem; margin-top: 0.38rem; }
.runtime-empty-guide p { font-size: 0.68rem; line-height: 1.6; margin: 0.45rem 0 0; }
.modal-backdrop { background: rgba(0, 0, 0, 0.68); }
.create-modal { background: #ffffff; border-color: #dedede; border-radius: 0; color: #111111; }
.modal-heading h2,
.create-modal label > span,
.checkbox-row strong { color: #111111; }
.checkbox-row { background: #faf3f5; border-radius: 0; }
.checkbox-row small { color: #777777; }

@media (max-width: 1080px) {
  .workflow-guide { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .workflow-guide a { border-bottom: 1px solid #e1e1e1; }
}
@media (max-width: 900px) {
  .workbench-page { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 600px) {
  .workflow-guide { grid-template-columns: 1fr 1fr; }
}
</style>
