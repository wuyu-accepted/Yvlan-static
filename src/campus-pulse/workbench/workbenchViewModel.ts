import type { ApiProblem } from '../contracts/api.ts'
import {
  ACTIVE_RUNTIME_STATES,
  RUNTIME_STATE_LABELS,
  TERMINAL_RUNTIME_STATES,
} from './workbenchCapabilities.ts'

/**
 * M06 normalization view model. Every value derives from the real backend
 * response; Unknown is never displayed as zero, and canonical work contract
 * fields (BCI-003) come from the server only.
 */

export type WorkbenchAccess = 'interactive' | 'readonly' | 'unavailable'

export interface WorkbenchCounts {
  projects: number | null
  scenarios: number | null
  policies: number | null
  runs: number | null
  evidence: number | null
  sensing: number | null
}

export const EMPTY_UNKNOWN_COUNTS: WorkbenchCounts = {
  projects: null,
  scenarios: null,
  policies: null,
  runs: null,
  evidence: null,
  sensing: null,
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** overview payload -> counts; non-numeric/absent fields stay null (unknown != zero). */
export function countsFromOverview(payload: unknown): WorkbenchCounts {
  const body = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const counts = body.counts ?? body.overview ?? body
  const source = (counts && typeof counts === 'object' ? counts : {}) as Record<string, unknown>
  return {
    projects: numberOrNull(source.projects),
    scenarios: numberOrNull(source.scenarios),
    policies: numberOrNull(source.policies),
    runs: numberOrNull(source.runs),
    evidence: numberOrNull(source.evidence_snapshots),
    sensing: numberOrNull(source.sensing_snapshots),
  }
}

export interface WorkbenchProject {
  project_id: string
  name: string
  governance_domain: string
  objective: string
  evaluation_mode: string
  created_at?: string
  updated_at?: string
}

export function projectFromPayload(item: unknown): WorkbenchProject | null {
  const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  if (typeof row.project_id !== 'string' || !row.project_id) return null
  return {
    project_id: row.project_id,
    name: typeof row.name === 'string' ? row.name : '',
    governance_domain: typeof row.governance_domain === 'string' ? row.governance_domain : '',
    objective: typeof row.objective === 'string' ? row.objective : '',
    evaluation_mode: typeof row.evaluation_mode === 'string' ? row.evaluation_mode : 'descriptive_pilot',
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  }
}

export function projectListFromPayload(payload: unknown): WorkbenchProject[] {
  if (!Array.isArray(payload)) return []
  return payload.map(projectFromPayload).filter((item): item is WorkbenchProject => item !== null)
}

export interface ScenarioSummary {
  scenario_id: string
  name: string
  description: string
  template_key?: string
  evidence_binding_status?: string
  created_at?: string
}

export function scenarioListFromPayload(payload: unknown): ScenarioSummary[] {
  if (!Array.isArray(payload)) return []
  return payload.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      scenario_id: String(row.scenario_id ?? ''),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      template_key: typeof row.template_key === 'string' ? row.template_key : undefined,
      evidence_binding_status: typeof row.evidence_binding_status === 'string' ? row.evidence_binding_status : undefined,
      created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    }
  }).filter((item) => item.scenario_id)
}

export interface PolicySummary {
  policy_id: string
  name: string
  description: string
  template_key?: string
  evaluation_level?: string
  is_baseline?: boolean
  action_count: number
}

export function policyListFromPayload(payload: unknown): PolicySummary[] {
  if (!Array.isArray(payload)) return []
  return payload.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const actions = Array.isArray(row.actions) ? row.actions : []
    return {
      policy_id: String(row.policy_id ?? ''),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      template_key: typeof row.template_key === 'string' ? row.template_key : undefined,
      evaluation_level: typeof row.evaluation_level === 'string' ? row.evaluation_level : undefined,
      is_baseline: row.is_baseline === true,
      action_count: actions.length,
    }
  }).filter((item) => item.policy_id)
}

export interface RunSummary {
  run_id: string
  project_id: string
  scenario_id: string
  execution_mode: string
  status: string
  plan_status: string
  input_fingerprint?: string
  token_budget: number | null
  result_sha256?: string
  created_at?: string
  runtime_summary?: Record<string, unknown>
  effective_runtime_status?: string
  input_snapshot?: Record<string, unknown>
  work_contract?: Record<string, unknown>
}

export function runFromPayload(item: unknown): RunSummary | null {
  const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  if (typeof row.run_id !== 'string' || !row.run_id) return null
  return {
    run_id: row.run_id,
    project_id: String(row.project_id ?? ''),
    scenario_id: String(row.scenario_id ?? ''),
    execution_mode: String(row.execution_mode ?? ''),
    status: String(row.status ?? ''),
    plan_status: String(row.plan_status ?? row.status ?? ''),
    input_fingerprint: typeof row.input_fingerprint === 'string' ? row.input_fingerprint : undefined,
    token_budget: numberOrNull(row.token_budget),
    result_sha256: typeof row.result_sha256 === 'string' ? row.result_sha256 : undefined,
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    runtime_summary: row.runtime_summary && typeof row.runtime_summary === 'object'
      ? row.runtime_summary as Record<string, unknown>
      : undefined,
    effective_runtime_status: typeof row.effective_runtime_status === 'string' ? row.effective_runtime_status : undefined,
    input_snapshot: row.input_snapshot && typeof row.input_snapshot === 'object'
      ? row.input_snapshot as Record<string, unknown>
      : undefined,
    work_contract: row.work_contract && typeof row.work_contract === 'object'
      ? row.work_contract as Record<string, unknown>
      : undefined,
  }
}

export function runListFromPayload(payload: unknown): RunSummary[] {
  if (!Array.isArray(payload)) return []
  return payload.map(runFromPayload).filter((item): item is RunSummary => item !== null)
}

/** Effective runtime status: runtime first, then immutable plan status. */
export function runEffectiveStatus(run: Pick<RunSummary, 'plan_status' | 'effective_runtime_status' | 'status'>): string {
  const runtime = run.effective_runtime_status
  if (runtime && runtime !== 'unknown') return runtime
  const plan = run.plan_status || run.status
  return ACTIVE_RUNTIME_STATES.has(plan) || TERMINAL_RUNTIME_STATES.has(plan) ? plan : plan || 'draft'
}

export function runStateLabel(status: string): string {
  return RUNTIME_STATE_LABELS[status] || status || '未知状态'
}

export function isRunActive(status: string): boolean {
  return ACTIVE_RUNTIME_STATES.has(status)
}

export function isRunTerminal(status: string): boolean {
  return TERMINAL_RUNTIME_STATES.has(status)
}

/**
 * BCI-003 canonical contract: primary slots / request limit / token limit
 * are server values (work_contract), never frontend estimates. If the
 * server has not frozen the contract yet, mark it pending instead of
 * guessing (no more hardcoded 1,728 / 16,544 / 13,056).
 */
export interface PlanContractVM {
  executionMode: string
  primarySlots: number | null
  residentSlots: number | null
  governanceActorSlots: number | null
  requestLimit: number | null
  tokenLimit: number | null
  population: number | null
  tickCount: number | null
  fingerprint: string | null
  serverProvided: boolean
  activationMode: string | null
  keyframeTicks: number[]
  relationshipEnabled: boolean | null
  relationshipAttentionEnabled: boolean | null
  privateChatEnabled: boolean | null
  dynamicGroupsEnabled: boolean | null
  serviceDeskEnabled: boolean | null
  publicAnonymityEnabled: boolean | null
  residentTurnSchemaVersion: string | null
  visibilityPlanSha256: string | null
  publicRankingGlobal: boolean | null
  dynamicsGeneratesLanguage: boolean | null
  publicMessagesPerAgentTickMax: number | null
  publicInteractionsPerAgentTickMax: number | null
  privateActionsPerAgentTickMax: number | null
  privateOriginShareMax: number | null
  privateOverflowCarries: boolean | null
  sameTickTwoPhaseCommit: boolean | null
}

export function planContractFromRun(run: unknown): PlanContractVM {
  const row = (run && typeof run === 'object' ? run : {}) as Record<string, unknown>
  const snapshot = (row.input_snapshot && typeof row.input_snapshot === 'object'
    ? row.input_snapshot
    : {}) as Record<string, unknown>
  const v2 = (snapshot.forum_twin_v2 && typeof snapshot.forum_twin_v2 === 'object'
    ? snapshot.forum_twin_v2
    : {}) as Record<string, unknown>
  const legacyForum = (snapshot.forum_twin && typeof snapshot.forum_twin === 'object'
    ? snapshot.forum_twin
    : {}) as Record<string, unknown>
  const visibility = (snapshot.forum_visibility && typeof snapshot.forum_visibility === 'object'
    ? snapshot.forum_visibility
    : {}) as Record<string, unknown>
  const visibilityHarness = (visibility.visibility_harness && typeof visibility.visibility_harness === 'object'
    ? visibility.visibility_harness
    : {}) as Record<string, unknown>
  const visibilityChannels = (visibilityHarness.channels && typeof visibilityHarness.channels === 'object'
    ? visibilityHarness.channels
    : {}) as Record<string, unknown>
  const contract = (row.work_contract && typeof row.work_contract === 'object'
    ? row.work_contract
    : (v2.work_contract && typeof v2.work_contract === 'object'
      ? v2.work_contract
      : (legacyForum.work_contract && typeof legacyForum.work_contract === 'object'
        ? legacyForum.work_contract
        : {}))) as Record<string, unknown>
  const providerLimits = (v2.provider_limits && typeof v2.provider_limits === 'object'
    ? v2.provider_limits
    : {}) as Record<string, unknown>
  const relationships = (v2.relationships && typeof v2.relationships === 'object'
    ? v2.relationships
    : {}) as Record<string, unknown>
  const timeline = (v2.timeline && typeof v2.timeline === 'object'
    ? v2.timeline
    : {}) as Record<string, unknown>
  const population = (v2.population && typeof v2.population === 'object'
    ? v2.population
    : {}) as Record<string, unknown>
  const privacy = (v2.privacy && typeof v2.privacy === 'object'
    ? v2.privacy
    : {}) as Record<string, unknown>
  const activationContract = (v2.activation_contract && typeof v2.activation_contract === 'object'
    ? v2.activation_contract
    : {}) as Record<string, unknown>
  const outputContract = (v2.resident_output_contract && typeof v2.resident_output_contract === 'object'
    ? v2.resident_output_contract
    : {}) as Record<string, unknown>
  const primarySlots = numberOrNull(contract.primary_slots)
  const requestLimit = numberOrNull(contract.request_limit ?? contract.request_hard_limit ?? providerLimits.requests)
  const tokenLimit = numberOrNull(contract.token_limit ?? providerLimits.tokens)
  const serverProvided = primarySlots !== null || requestLimit !== null || tokenLimit !== null
  return {
    executionMode: String(row.execution_mode ?? ''),
    primarySlots,
    residentSlots: numberOrNull(contract.resident_slots),
    governanceActorSlots: numberOrNull(contract.governance_actor_slots),
    requestLimit,
    tokenLimit,
    population: numberOrNull(population.agent_count ?? row.agent_count),
    tickCount: numberOrNull(timeline.tick_count),
    fingerprint: typeof row.input_fingerprint === 'string' ? row.input_fingerprint : null,
    serverProvided,
    activationMode: typeof v2.activation_mode === 'string' ? v2.activation_mode : null,
    keyframeTicks: Array.isArray(timeline.keyframe_ticks)
      ? timeline.keyframe_ticks.filter((value): value is number => Number.isInteger(value))
      : [],
    relationshipEnabled: typeof visibilityHarness.relationship_attention_enabled === 'boolean'
      ? visibilityHarness.relationship_attention_enabled
      : typeof relationships.cross_group_bridge_enabled === 'boolean'
        ? relationships.cross_group_bridge_enabled
        : null,
    relationshipAttentionEnabled: typeof visibilityHarness.relationship_attention_enabled === 'boolean'
      ? visibilityHarness.relationship_attention_enabled
      : null,
    privateChatEnabled: typeof visibilityChannels.friend_chat === 'boolean'
      ? visibilityChannels.friend_chat
      : typeof relationships.private_chat_enabled === 'boolean'
        ? relationships.private_chat_enabled
        : null,
    dynamicGroupsEnabled: typeof visibilityChannels.dynamic_group === 'boolean'
      ? visibilityChannels.dynamic_group
      : typeof relationships.dynamic_groups_enabled === 'boolean'
        ? relationships.dynamic_groups_enabled
        : null,
    serviceDeskEnabled: typeof visibilityChannels.service_desk === 'boolean'
      ? visibilityChannels.service_desk
      : null,
    publicAnonymityEnabled: typeof visibilityHarness.public_anonymity_enabled === 'boolean'
      ? visibilityHarness.public_anonymity_enabled
      : null,
    residentTurnSchemaVersion: typeof visibility.resident_turn_schema_version === 'string'
      ? visibility.resident_turn_schema_version
      : typeof v2.resident_turn_schema_version === 'string'
        ? v2.resident_turn_schema_version
        : null,
    visibilityPlanSha256: typeof visibility.plan_sha256 === 'string'
      ? visibility.plan_sha256
      : null,
    publicRankingGlobal: typeof relationships.public_ranking_is_global === 'boolean'
      ? relationships.public_ranking_is_global
      : null,
    dynamicsGeneratesLanguage: typeof privacy.dynamics_generates_language === 'boolean'
      ? privacy.dynamics_generates_language
      : null,
    publicMessagesPerAgentTickMax: numberOrNull(outputContract.public_messages_per_agent_tick_max),
    publicInteractionsPerAgentTickMax: numberOrNull(outputContract.public_interactions_per_agent_tick_max),
    privateActionsPerAgentTickMax: numberOrNull(outputContract.private_actions_per_agent_tick_max),
    privateOriginShareMax: numberOrNull(activationContract.private_origin_share_of_non_anchor_slots_max),
    privateOverflowCarries: typeof activationContract.private_overflow_carries_to_next_tick === 'boolean'
      ? activationContract.private_overflow_carries_to_next_tick
      : null,
    sameTickTwoPhaseCommit: typeof activationContract.same_tick_two_phase_commit === 'boolean'
      ? activationContract.same_tick_two_phase_commit
      : null,
  }
}

export interface RuntimeSummaryVM {
  status: string | null
  stateVersion: number | null
  turnsReserved: number | null
  turnsCompleted: number | null
  tokensUsed: number | null
  tokenLimit: number | null
  activeUnits: number | null
  concurrencyLimit: number | null
  attemptCount: number | null
  maxAttempts: number | null
  checkpointSha256: string | null
  updatedAt: string | null
  progressFraction: number | null
}

export function runtimeSummaryFrom(payload: unknown): RuntimeSummaryVM {
  const row = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const summary = (row.runtime ?? row.runtime_state ?? row) as Record<string, unknown>
  const status = typeof summary.status === 'string' ? summary.status : null
  const turnsCompleted = numberOrNull(summary.turns_completed)
  const turnsReserved = numberOrNull(summary.turns_reserved)
  const tokensUsed = numberOrNull(summary.tokens_used)
  const tokenLimit = numberOrNull(summary.token_limit)
  const progressFraction = turnsReserved !== null && turnsReserved > 0 && turnsCompleted !== null
    ? Math.min(1, turnsCompleted / turnsReserved)
    : null
  return {
    status,
    stateVersion: numberOrNull(summary.state_version),
    turnsReserved,
    turnsCompleted,
    tokensUsed,
    tokenLimit,
    activeUnits: numberOrNull(summary.active_units),
    concurrencyLimit: numberOrNull(summary.effective_concurrency_limit),
    attemptCount: numberOrNull(summary.attempt_count),
    maxAttempts: numberOrNull(summary.max_attempts),
    checkpointSha256: typeof summary.checkpoint_sha256 === 'string' ? summary.checkpoint_sha256 : null,
    updatedAt: typeof summary.updated_at === 'string' ? summary.updated_at : null,
    progressFraction,
  }
}

export interface RunEventVM {
  sequence: number
  kind: string
  message: string
  at: string
  payload: Record<string, unknown>
}

export function runEventsFromPayload(payload: unknown): RunEventVM[] {
  const envelope = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const list = Array.isArray(payload) ? payload : Array.isArray(envelope.items) ? envelope.items : []
  return list
    .map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const sequence = numberOrNull(row.sequence)
      if (sequence === null) return null
      const detail = row.detail && typeof row.detail === 'object'
        ? row.detail as Record<string, unknown>
        : null
      const nestedPayload = row.payload && typeof row.payload === 'object'
        ? row.payload as Record<string, unknown>
        : null
      const eventPayload = detail ?? nestedPayload ?? row
      return {
        sequence,
        kind: String(row.kind ?? row.event_type ?? 'event'),
        message: String(row.message ?? eventPayload.message ?? (typeof row.detail === 'string' ? row.detail : '')),
        at: typeof row.at === 'string' ? row.at : typeof row.created_at === 'string' ? row.created_at : '',
        // The backend's public event contract places Tick, branch, visible
        // output and world_edges in `detail`.  Normalizing here keeps every
        // workbench consumer on the same runtime-frame contract.
        payload: eventPayload,
      }
    })
    .filter((item): item is RunEventVM => item !== null)
    .sort((left, right) => left.sequence - right.sequence)
}

export function dedupeEvents(events: RunEventVM[]): RunEventVM[] {
  const seen = new Set<number>()
  const result: RunEventVM[] = []
  for (const event of events) {
    if (seen.has(event.sequence)) continue
    seen.add(event.sequence)
    result.push(event)
  }
  return result.sort((left, right) => left.sequence - right.sequence)
}

export interface EvidenceBindingVM {
  snapshotId: string
  title: string
  manifestSha256?: string
  schemaVersion?: string
  primary: boolean
}

export function evidenceBindingsFromPayload(payload: unknown): EvidenceBindingVM[] {
  const list = Array.isArray(payload) ? payload : []
  return list.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const snapshot = (row.snapshot ?? row.evidence_snapshot ?? row) as Record<string, unknown>
    return {
      snapshotId: String(row.snapshot_id ?? snapshot.snapshot_id ?? ''),
      title: String(row.title ?? snapshot.title ?? row.name ?? ''),
      manifestSha256: typeof row.manifest_sha256 === 'string' ? row.manifest_sha256 : undefined,
      schemaVersion: typeof row.schema_version === 'string' ? row.schema_version : undefined,
      primary: row.is_primary === true || row.make_primary === true,
    }
  }).filter((item) => item.snapshotId)
}

export interface SensingStateVM {
  status: string
  stateVersion: number | null
  activeSnapshotId?: string
  activeSnapshotTitle?: string
}

export function sensingStateFromPayload(payload: unknown): SensingStateVM {
  const row = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  return {
    status: String(row.status ?? 'unknown'),
    stateVersion: numberOrNull(row.state_version),
    activeSnapshotId: typeof row.active_snapshot_id === 'string' ? row.active_snapshot_id : undefined,
    activeSnapshotTitle: typeof row.active_snapshot_title === 'string' ? row.active_snapshot_title : undefined,
  }
}

export type MutationState<T> =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; data: T }
  | { status: 'conflict'; problem: ApiProblem }
  | { status: 'invalid'; fieldErrors: Record<string, string[]> }
  | { status: 'error'; problem: ApiProblem }

/** 409/412 -> CAS / version conflict; never auto-overwrite. */
export function isCasConflict(problem: ApiProblem | null | undefined): boolean {
  if (!problem) return false
  return problem.status === 409 || problem.status === 412
    || problem.code === 'WorkbenchConflictError'
    || problem.code === 'WorkbenchPreconditionError'
}

/** A uniqueness conflict is user input, not a stale state/version conflict. */
export function isDuplicateProjectConflict(problem: ApiProblem | null | undefined): boolean {
  if (!problem || problem.status !== 409 || problem.code !== 'WorkbenchConflictError') return false
  return problem.detail === '已存在同名项目，请修改项目名称。'
}

export function fieldErrorsFromProblem(problem: ApiProblem | null | undefined): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of problem?.fieldErrors ?? []) {
    const field = issue.field || 'form'
    const list = result[field] ?? []
    list.push(issue.message)
    result[field] = list
  }
  return result
}

/**
 * Shared UX pre-validation (server remains the final validator).
 * Mirrors routers/campus_pulse.py request contracts so the UI fails early
 * without duplicating the whitelist; the backend still rejects any drift.
 */
export const SCENARIO_PHASE_IDS = ['baseline', 'burst', 'spread', 'decay']

export function validateScenarioPhases(phases: unknown): { ok: boolean; reason?: string } {
  if (!Array.isArray(phases) || phases.length !== 4) {
    return { ok: false, reason: '必须严格包含 4 个阶段' }
  }
  const ids = phases.map((phase) => String((phase as Record<string, unknown>)?.phase_id ?? ''))
  if (ids.join(',') !== SCENARIO_PHASE_IDS.join(',')) {
    return { ok: false, reason: '阶段顺序必须为 baseline → burst → spread → decay' }
  }
  for (const phase of phases) {
    const row = (phase && typeof phase === 'object' ? phase : {}) as Record<string, unknown>
    const label = typeof row.label === 'string' ? row.label : ''
    const window = typeof row.window === 'string' ? row.window : ''
    if (!label.trim() || label.length > 40) return { ok: false, reason: '每个阶段需要 label（1–40 字符）' }
    if (!window.trim() || window.length > 80) return { ok: false, reason: '每个阶段需要 window（1–80 字符）' }
  }
  return { ok: true }
}

export function validatePolicyActions(actions: unknown): { ok: boolean; reason?: string } {
  if (!Array.isArray(actions) || actions.length > 12) {
    return { ok: false, reason: '动作数量必须在 0–12' }
  }
  for (const action of actions) {
    const row = (action && typeof action === 'object' ? action : {}) as Record<string, unknown>
    const actionId = String(row.action_id ?? '')
    const label = typeof row.label === 'string' ? row.label : ''
    const commitment = typeof row.commitment === 'string' ? row.commitment : ''
    if (!/^[a-z][a-z0-9_]{2,39}$/.test(actionId)) {
      return { ok: false, reason: 'action_id 必须是小写字母/数字/下划线（3–40 字符）' }
    }
    if (!label.trim() || label.length > 80) return { ok: false, reason: '动作 label 必须为 1–80 字符' }
    if (!commitment.trim() || commitment.length > 500) return { ok: false, reason: '动作 commitment 必须为 1–500 字符' }
  }
  return { ok: true }
}

export interface ProjectFormInput {
  name?: string
  governance_domain?: string
  objective?: string
}

export function validateProjectForm(input: ProjectFormInput): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const name = input.name?.trim() ?? ''
  const domain = input.governance_domain?.trim() ?? ''
  const objective = input.objective?.trim() ?? ''
  if (!name) errors.name = ['项目名称不能为空']
  else if (name.length > 120) errors.name = ['项目名称不能超过 120 个字符']
  if (!domain) errors.governance_domain = ['治理领域不能为空']
  else if (domain.length > 80) errors.governance_domain = ['治理领域不能超过 80 个字符']
  if (!objective) errors.objective = ['治理目标不能为空']
  else if (objective.length > 800) errors.objective = ['治理目标不能超过 800 个字符']
  return errors
}
