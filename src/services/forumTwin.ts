export const FORUM_TWIN_AGGREGATE_SCHEMA =
  'campus-pulse-live-aggregate-result-v6'
export const FORUM_TWIN_DOMAIN_SCHEMA = 'campus-pulse-forum-twin-result-v1'
export const FORUM_TWIN_MANIFEST_SCHEMA =
  'campus-pulse-forum-twin-visualization-v4'
export const FORUM_TWIN_EXECUTION_MODE = 'llm_forum_twin'
export const FORUM_TWIN_DEVELOPMENT_STATUS =
  'forum-twin-development-status.json'
export const FORUM_TWIN_HERO_SHOWCASE =
  'forum-twin-hero-showcase-v1.json'
export const FORUM_TWIN_HERO_SHOWCASE_FILE_HASH =
  'forum-twin-hero-showcase-v1.sha256'

const PRIMARY_SLOT_COUNT = 16_544
const HERO_SCENARIOS = new Set([
  'lecture_external_incident_shock',
  'governance_legitimacy_dispute',
])
const SHA256 = /^[0-9a-f]{64}$/
const RUN_ID = /^run_[0-9a-f]{24}$/
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/
const FORMAL_PROVENANCE = new Set([
  'authorized_live_llm',
  'reviewed_trace_replay',
])
const PUBLIC_ACTIONS = new Set([
  'post',
  'reply',
  'quote',
  'repost',
  'verify',
  'correct',
  'seek_help',
  'report_risk',
  'governance_message',
  'service_receipt',
  'governance_evidence',
])
const ROOT_ACTIONS = new Set(['post', 'governance_message'])
const CLAIM_STATUSES = new Set([
  'unverified',
  'contested',
  'corrected',
  'verified',
  'expired',
])
const THREAD_STATUSES = new Set(['open', 'closed', 'archived'])
const FORBIDDEN_EXACT_KEYS = new Set([
  'agent_id',
  'agent_ids',
  'raw_text',
  'raw_record',
  'raw_prompt',
  'raw_response',
  'provider_body',
  'request_body',
  'response_body',
  'api_key',
  'password',
  'secret',
  'local_path',
  'file_path',
  'sample_identity',
  'selected_identity',
  'private_feed',
  'private_observation',
  'parent_particle_mapping',
  'record_level_edges',
  'hidden_truth',
])
const FORBIDDEN_KEY_PARTS = [
  'source_id',
  'source_identifier',
  'credential',
  'feed_exposure',
]

export type ForumBranchId = 'natural' | 'A' | 'D'
export type FormalProvenance =
  | 'authorized_live_llm'
  | 'reviewed_trace_replay'

export interface ForumMessageProvenance {
  kind: FormalProvenance
  prompt_sha256?: string
  response_sha256?: string
  model?: string
  trace_release_sha256?: string | null
}

/** Normalized public message. Every value comes from a validated backend field. */
export interface ForumMessage {
  message_id: string
  thread_id: string
  scenario_id: string
  branch_id: ForumBranchId
  parent_message_id: string | null
  quote_message_id: string | null
  source_display_id: string
  action: string | null
  visible_text: string
  topic: string | null
  stance: string | null
  emotion: string | null
  evidence_status: string | null
  confidence: number | null
  claim_ids: string[]
  claim_operation: string | null
  correction_target_claim_id: string | null
  created_tick: number
  ttl: number | null
  moderation_status: 'accepted' | null
  provenance: ForumMessageProvenance
  /** Null means this release predates the parallel-interaction contract. */
  interaction_counts?: {
    like: number
    repost: number
    report: number
  } | null
  /** Anonymous interaction deltas. They make tick replay causal without exposing actors. */
  interaction_counts_by_tick?: Array<{
    tick: number
    like: number
    repost: number
    report: number
  }>
  memory_summary?: string
  decision_reason_tags?: string[]
}

/** Normalized thread; message_ids are the exact relation derived from public_messages. */
export interface ForumThread {
  thread_id: string
  board: string
  root_message_id: string
  scenario_id: string
  branch_id: ForumBranchId
  created_tick: number
  status: 'open' | 'closed' | 'archived'
  topic: string
  need: string
  claim_ids: string[]
  participant_count: number
  reply_count: number
  last_active_tick: number | null
  provenance_kind: FormalProvenance
  message_ids: string[]
  /** Exact published cross-branch identity only; never inferred from text similarity. */
  mapped_counterpart_thread_id?: string
}

/** Normalized claim; scenario/branch are derived through its validated thread. */
export interface ForumClaim {
  claim_id: string
  thread_id: string
  created_by_message_id: string
  parent_claim_id: string | null
  scenario_id: string
  branch_id: ForumBranchId
  summary: string
  status: string
  first_seen_tick: number
  last_seen_tick: number
  supporting_message_ids: string[]
  challenging_message_ids: string[]
  correction_target_claim_id: string | null
  evidence_reference: string | null
}

export interface ForumTick {
  tick: number
  phase: 'baseline' | 'burst' | 'spread' | 'decay'
  active_thread_ids: string[]
  activated_residents: number
  activated_governance: number
  public_message_count: number
  claim_count: number
  correction_count: number
  help_request_count: number
  pps_kish_ess: number
  metrics: Record<string, number>
  governance_observation?: Record<string, unknown>
  governance_decision?: Record<string, unknown>
  particle_summary?: Record<string, number>
}

export interface ForumParallelBranch {
  timeline: ForumTick[]
  featured_thread_ids: string[]
}

export interface ResourcePolicyBranchSummary {
  branch: ForumBranchId
  label: string
  messages: number
  helpRequests: number
  riskReports: number
  governanceUptake: number
  serviceClosures: number
  evidenceCards: number
  serviceTickets: number
  outreachObjects: number
  trust: number | null
  concern: number | null
  satisfaction: number | null
}

export interface ResourcePolicyClosedLoop {
  helpMessageId: string
  receiptMessageId: string
  followUpMessageId: string
  helpText: string
  receiptText: string
  followUpText: string
}

export interface ResourcePolicyStory {
  schemaVersion: 'campus-pulse-resource-policy-story-v1'
  scenarioFacts: {
    renovatedDormitories: number
    bedsBefore: number
    bedsAfter: number
    validApplications: number
    announcementGaps: string[]
  }
  branchSummaries: ResourcePolicyBranchSummary[]
  closedLoops: ResourcePolicyClosedLoop[]
  feedMechanism: string
  sharedThroughTick: number
  providerModel: string
  providerCalls: number
  providerTokens: number
  semanticTurns: number
  formatRepairs: number
  unknownOutcomes: number
  resultSha256: string
  primaryFinding: string
}

export interface ForumScenario {
  scenario_id: string
  label: string
  description?: string
}

export interface ForumDisplayProfile {
  display_id: string
  macro_role: string
  micro_role: string
  episode_focus: string
  topic_portfolio: string[]
  need_portfolio: string[]
  interaction_style: string[]
}

export interface ForumTwinDomainResult {
  schema_version: string
  scenarios: ForumScenario[]
  parallel_forums: Record<string, Partial<Record<ForumBranchId, ForumParallelBranch>> & Record<'natural' | 'D', ForumParallelBranch>>
  public_threads: ForumThread[]
  public_messages: ForumMessage[]
  claims: ForumClaim[]
  governance: Record<string, unknown> | unknown[]
  sampling: {
    anchors: number
    pps_budget: number
    scheduler_recall: number
    kish_ess_range: [number, number]
    unique_activated_agents: number
  }
  intervals: Record<string, unknown>
  llm_usage: {
    resident_turns: number
    governance_turns: number
    live_provider_turns: number
    trace_replay_turns: number
    cache_turns: number
    provider_calls: number
    provider_tokens: number
    max_resident_activation: number
    max_total_activation: number
  }
  ecology_validation: Record<string, unknown>
  ablations: Record<string, unknown>
  hero_gates: Record<string, unknown>
  audit: {
    llm_agent_count: number
    particle_count: number
    emulator_public_messages: number
    real_governance_actions: number
    public_display_profiles?: ForumDisplayProfile[]
  }
}

export interface ForumTwinAggregateResult {
  schema_version: string
  run_id: string
  launch_fingerprint: string
  result_kind: string
  plan_sha256: string
  execution_provenance: FormalProvenance
  publication_eligible: boolean
  domain_result: Record<string, unknown>
  visualization_asset: {
    schema_version: string
    manifest_sha256: string
    domain_result_sha256: string
    public_forum_sha256: string
  }
  completeness: {
    status: 'complete' | 'pilot'
    completed_primary_slots: number
    required_primary_slots: number
  }
  budget_usage: Record<string, number>
  usage: Record<string, number>
  privacy: { scan_passed: true; [key: string]: unknown }
  non_claims: string[]
  result_sha256: string
}

export interface ForumTwinAssetDescriptor {
  asset_id: string
  sha256: string
  compressed_bytes: number
}

export interface ForumTwinManifest {
  schema_version: string
  run_id: string
  result_sha256: string
  domain_result_sha256: string
  public_forum_sha256: string
  thread_batches: ForumTwinAssetDescriptor[]
  claim_batches: ForumTwinAssetDescriptor[]
  particle_frames: ForumTwinAssetDescriptor[]
  propagation_matrices: ForumTwinAssetDescriptor[]
  total_compressed_bytes: number
  asset_integrity: {
    verified: true
    verification_method: 'server_sha256' | 'sealed_package_sha256'
  }
  manifest_sha256: string
}

export interface ForumTwinLoaded {
  aggregate: ForumTwinAggregateResult
  domain: ForumTwinDomainResult
  manifest: ForumTwinManifest
  manifestSha256: string
  threads: ForumThread[]
  messages: ForumMessage[]
  claims: ForumClaim[]
  profiles: ForumDisplayProfile[]
  resourcePolicy?: ResourcePolicyStory
  source: {
    mode: 'offline' | 'api' | 'hero_pilot'
    label: string
    run_id: string | null
  }
}

export interface ForumTwinHeroShowcase {
  schema_version: 'campus-pulse-forum-hero-showcase-v1'
  source_artifact_sha256: string
  source_file_sha256: string
  authorization_fingerprint: string
  execution_provenance: 'authorized_live_llm'
  publication_eligible: false
  disclosure: string
  live_usage: Record<string, unknown>
  result: Record<string, unknown>
}

export interface ForumTwinDevelopmentStatus {
  schema_version: 'campus-pulse-forum-twin-frontend-status-v1'
  generated_at: string
  backend_loop_ready: true
  publication_eligible: false
  model_sha256: string
  population: {
    llm_agents: 1000
    particles: 10000
    current_source: string
  }
  engineering_evidence: {
    scenarios: 2
    branches: 5
    paired_seeds: 8
    ticks: 24
    semantic_slots: 16544
    particle_updates: 17280000
    provider_calls: 0
    public_fixture_messages: 0
    full_result_sha256: string
    evidence_sha256: string
  }
  live_pilot_evidence: {
    parallel_forum_available: boolean
    closed_loop_available: boolean
    real_llm_ablation_available: boolean
    disclosure: string
  }
  blocking_gates: string[]
  claim_boundary: string[]
}

export class ForumTwinDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForumTwinDataError'
  }
}

function fail(message: string): never {
  throw new ForumTwinDataError(message)
}

function object(value: unknown, path: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${path} 必须是对象`)
  }
  return value as Record<string, any>
}

function array(value: unknown, path: string): any[] {
  if (!Array.isArray(value)) fail(`${path} 必须是数组`)
  return value
}

function text(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    fail(`${path} 必须是${allowEmpty ? '' : '非空'}字符串`)
  }
  return value
}

function optionalText(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null
  return text(value, path)
}

function safeId(value: unknown, path: string): string {
  const normalized = text(value, path)
  if (!SAFE_ID.test(normalized)) fail(`${path} 不是安全公开 ID`)
  return normalized
}

function optionalId(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null
  return safeId(value, path)
}

function hash(value: unknown, path: string): string {
  const normalized = text(value, path)
  if (!SHA256.test(normalized)) fail(`${path} 不是有效 SHA-256`)
  return normalized
}

function integer(value: unknown, path: string, min = 0, max?: number): number {
  if (!Number.isInteger(value) || Number(value) < min) {
    fail(`${path} 必须是大于等于 ${min} 的整数`)
  }
  if (max !== undefined && Number(value) > max) fail(`${path} 超过冻结上限 ${max}`)
  return Number(value)
}

function optionalInteger(
  value: unknown,
  path: string,
  min = 0,
  max?: number,
): number | null {
  if (value === null || value === undefined) return null
  return integer(value, path, min, max)
}

function finite(value: unknown, path: string, min?: number, max?: number): number {
  if (!Number.isFinite(value)) fail(`${path} 必须是有限数字`)
  const normalized = Number(value)
  if (min !== undefined && normalized < min) fail(`${path} 低于 ${min}`)
  if (max !== undefined && normalized > max) fail(`${path} 高于 ${max}`)
  return normalized
}

function exactKeys(value: Record<string, any>, keys: string[], path: string) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${path} 字段集合不符合冻结合同`)
  }
}

function requiredKeys(value: Record<string, any>, keys: string[], path: string) {
  keys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${path}.${key} 缺失`)
  })
}

function publicStringList(value: unknown, path: string): string[] {
  return array(value, path).map((item, index) => text(item, `${path}[${index}]`))
}

function publicIdList(value: unknown, path: string): string[] {
  const ids = array(value, path).map((item, index) => safeId(item, `${path}[${index}]`))
  if (new Set(ids).size !== ids.length) fail(`${path} 含重复 ID`)
  return ids
}

function auditPublic(value: unknown, path = '$'): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((child, index) => auditPublic(child, `${path}[${index}]`))
    return
  }
  Object.entries(value).forEach(([key, child]) => {
    const lowered = key.toLowerCase()
    if (
      FORBIDDEN_EXACT_KEYS.has(lowered)
      || FORBIDDEN_KEY_PARTS.some((part) => lowered.includes(part))
    ) fail(`${path}.${key} 是公共结果禁止字段`)
    auditPublic(child, `${path}.${key}`)
  })
}

function auditGovernance(value: unknown, path = '$.domain_result.governance'): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((child, index) => auditGovernance(child, `${path}[${index}]`))
    return
  }
  Object.entries(value).forEach(([key, child]) => {
    if (['truth', 'hidden_truth', 'population_truth', 'future_events'].includes(key)) {
      fail(`${path}.${key} 不得进入治理主体公开观测`)
    }
    auditGovernance(child, `${path}.${key}`)
  })
}

function normalizeProfile(value: unknown, path: string): ForumDisplayProfile {
  const profile = object(value, path)
  if (Object.keys(profile).some((key) => key.toLowerCase().includes('evidence_ref'))) {
    fail(`${path} 不得公开 profile evidence 引用`)
  }
  const displayId = profile.display_id ?? profile.synthetic_display_id
  const macroRole = profile.macro_role ?? profile.primary_macro_role
  const microRole = profile.micro_role
    ?? profile.micro_interaction_role
    ?? profile.micro_role_id
  const style = profile.interaction_style
  const interactionStyle = Array.isArray(style)
    ? publicStringList(style, `${path}.interaction_style`)
    : [profile.language_form, profile.reply_function, profile.information_density]
      .filter((item) => item !== undefined && item !== null)
      .map((item, index) => text(item, `${path}.interaction_style[${index}]`))
  return {
    display_id: safeId(displayId, `${path}.display_id`),
    macro_role: text(macroRole, `${path}.macro_role`),
    micro_role: text(microRole, `${path}.micro_role`),
    episode_focus: text(profile.episode_focus, `${path}.episode_focus`),
    topic_portfolio: publicStringList(profile.topic_portfolio, `${path}.topic_portfolio`),
    need_portfolio: Array.isArray(profile.need_portfolio)
      ? publicStringList(profile.need_portfolio, `${path}.need_portfolio`)
      : [],
    interaction_style: interactionStyle,
  }
}

function normalizeProvenance(
  value: unknown,
  path: string,
): ForumMessageProvenance {
  if (typeof value === 'string') {
    if (!FORMAL_PROVENANCE.has(value)) fail(`${path} 不是正式 LLM provenance`)
    return { kind: value as FormalProvenance }
  }
  const provenance = object(value, path)
  if (!FORMAL_PROVENANCE.has(provenance.kind)) fail(`${path}.kind 非法`)
  requiredKeys(provenance, [
    'kind', 'prompt_sha256', 'response_sha256', 'model',
    'trace_release_sha256',
  ], path)
  hash(provenance.prompt_sha256, `${path}.prompt_sha256`)
  hash(provenance.response_sha256, `${path}.response_sha256`)
  text(provenance.model, `${path}.model`)
  if (provenance.kind === 'reviewed_trace_replay') {
    hash(provenance.trace_release_sha256, `${path}.trace_release_sha256`)
  } else if (provenance.trace_release_sha256 !== null) {
    fail(`${path}.trace_release_sha256 只能用于 reviewed replay`)
  }
  return {
    kind: provenance.kind,
    prompt_sha256: provenance.prompt_sha256,
    response_sha256: provenance.response_sha256,
    model: provenance.model,
    trace_release_sha256: provenance.trace_release_sha256,
  }
}

function normalizeMessage(value: unknown, path: string): ForumMessage {
  const message = object(value, path)
  requiredKeys(message, [
    'message_id', 'thread_id', 'scenario_id', 'branch', 'created_tick',
    'agent_display_id', 'visible_text', 'provenance',
  ], path)
  const id = safeId(message.message_id, `${path}.message_id`)
  const branch = safeId(message.branch, `${path}.branch`)
  if (!['natural', 'D'].includes(branch)) fail(`${path}.branch 不是英雄论坛分支`)
  const sourceDisplayId = safeId(message.agent_display_id, `${path}.agent_display_id`)
  if (message.source_agent_display_id !== undefined &&
      message.source_agent_display_id !== sourceDisplayId) {
    fail(`${path}.source_agent_display_id 与 agent_display_id 不一致`)
  }
  const action = optionalText(message.action, `${path}.action`)
  if (action !== null && !PUBLIC_ACTIONS.has(action)) fail(`${path}.action 非法`)
  const visibleText = text(message.visible_text, `${path}.visible_text`)
  const maxLength = action !== null && !ROOT_ACTIONS.has(action) ? 120 : 180
  if ([...visibleText].length > maxLength) fail(`${path}.visible_text 超过 ${maxLength} 字`)
  const parentId = optionalId(message.parent_message_id, `${path}.parent_message_id`)
  const quoteId = optionalId(message.quote_message_id, `${path}.quote_message_id`)
  if (parentId === id || quoteId === id) fail(`${path} 不能自引用`)
  const claimId = optionalId(message.claim_id, `${path}.claim_id`)
  const moderation = optionalText(message.moderation_status, `${path}.moderation_status`)
  if (moderation !== null && moderation !== 'accepted') {
    fail(`${path} superseded 消息不得进入公开结果`)
  }
  const confidence = message.confidence === undefined || message.confidence === null
    ? null
    : finite(message.confidence, `${path}.confidence`, 0, 1)
  const reasonTags = message.decision_reason_tags === undefined
    ? undefined
    : publicStringList(message.decision_reason_tags, `${path}.decision_reason_tags`)
  const createdTick = integer(message.created_tick, `${path}.created_tick`, 0, 23)
  let interactionCounts: ForumMessage['interaction_counts'] = null
  if (message.interaction_counts !== undefined && message.interaction_counts !== null) {
    const counts = object(message.interaction_counts, `${path}.interaction_counts`)
    requiredKeys(counts, ['like', 'repost', 'report'], `${path}.interaction_counts`)
    if (Object.keys(counts).length !== 3) fail(`${path}.interaction_counts 字段漂移`)
    interactionCounts = {
      like: integer(counts.like, `${path}.interaction_counts.like`, 0),
      repost: integer(counts.repost, `${path}.interaction_counts.repost`, 0),
      report: integer(counts.report, `${path}.interaction_counts.report`, 0),
    }
  }
  let interactionCountsByTick: NonNullable<ForumMessage['interaction_counts_by_tick']> = []
  if (message.interaction_counts_by_tick !== undefined) {
    interactionCountsByTick = array(
      message.interaction_counts_by_tick,
      `${path}.interaction_counts_by_tick`,
    ).map((value, index) => {
      const rowPath = `${path}.interaction_counts_by_tick[${index}]`
      const row = object(value, rowPath)
      exactKeys(row, ['tick', 'like', 'repost', 'report'], rowPath)
      return {
        tick: integer(row.tick, `${rowPath}.tick`, createdTick, 23),
        like: integer(row.like, `${rowPath}.like`, 0),
        repost: integer(row.repost, `${rowPath}.repost`, 0),
        report: integer(row.report, `${rowPath}.report`, 0),
      }
    })
    if (interactionCountsByTick.length > 0 && interactionCounts === null) {
      fail(`${path}.interaction_counts_by_tick 缺少对应累计值`)
    }
    if (interactionCountsByTick.some((row, index) => (
      index > 0 && row.tick <= interactionCountsByTick[index - 1].tick
    ))) fail(`${path}.interaction_counts_by_tick 必须按时点严格递增`)
    if (interactionCounts !== null) {
      for (const kind of ['like', 'repost', 'report'] as const) {
        const sum = interactionCountsByTick.reduce((total, row) => total + row[kind], 0)
        if (sum !== interactionCounts[kind]) {
          fail(`${path}.interaction_counts_by_tick.${kind} 与累计值不守恒`)
        }
      }
    }
  }
  return {
    message_id: id,
    thread_id: safeId(message.thread_id, `${path}.thread_id`),
    scenario_id: safeId(message.scenario_id, `${path}.scenario_id`),
    branch_id: branch as ForumBranchId,
    parent_message_id: parentId,
    quote_message_id: quoteId,
    source_display_id: sourceDisplayId,
    action,
    visible_text: visibleText,
    topic: optionalText(message.topic, `${path}.topic`),
    stance: optionalText(message.stance, `${path}.stance`),
    emotion: optionalText(message.emotion, `${path}.emotion`),
    evidence_status: optionalText(message.evidence_status, `${path}.evidence_status`),
    confidence,
    claim_ids: claimId ? [claimId] : [],
    claim_operation: optionalText(message.claim_operation, `${path}.claim_operation`),
    correction_target_claim_id: optionalId(
      message.correction_target_claim_id,
      `${path}.correction_target_claim_id`,
    ),
    created_tick: createdTick,
    ttl: optionalInteger(message.ttl, `${path}.ttl`, 1),
    moderation_status: moderation as 'accepted' | null,
    provenance: normalizeProvenance(message.provenance, `${path}.provenance`),
    interaction_counts: interactionCounts,
    interaction_counts_by_tick: interactionCountsByTick,
    memory_summary: message.memory_summary === undefined
      ? undefined
      : text(message.memory_summary, `${path}.memory_summary`),
    decision_reason_tags: reasonTags,
  }
}

function normalizeThread(
  value: unknown,
  path: string,
  messages: ForumMessage[],
): ForumThread {
  const thread = object(value, path)
  requiredKeys(thread, [
    'thread_id', 'board', 'root_message_id', 'scenario_id', 'created_tick',
    'status', 'topic', 'need', 'claim_ids', 'participant_count',
    'reply_count',
  ], path)
  const id = safeId(thread.thread_id, `${path}.thread_id`)
  const branch = thread.branch ?? thread.branch_id
  if (!['natural', 'D'].includes(branch)) fail(`${path}.branch 不是英雄论坛分支`)
  if (thread.branch !== undefined && thread.branch_id !== undefined &&
      thread.branch !== thread.branch_id) fail(`${path}.branch 字段不一致`)
  if (!THREAD_STATUSES.has(thread.status)) fail(`${path}.status 非法`)
  const rootMessage = messages.find((message) => (
    message.message_id === thread.root_message_id
  ))
  const provenance = thread.provenance_kind ?? rootMessage?.provenance.kind
  if (!FORMAL_PROVENANCE.has(provenance)) fail(`${path}.provenance_kind 非法`)
  return {
    thread_id: id,
    board: text(thread.board, `${path}.board`),
    root_message_id: safeId(thread.root_message_id, `${path}.root_message_id`),
    scenario_id: safeId(thread.scenario_id, `${path}.scenario_id`),
    branch_id: branch,
    created_tick: integer(thread.created_tick, `${path}.created_tick`, 0, 23),
    status: thread.status,
    topic: text(thread.topic, `${path}.topic`),
    need: text(thread.need, `${path}.need`),
    claim_ids: publicIdList(thread.claim_ids, `${path}.claim_ids`),
    participant_count: integer(thread.participant_count, `${path}.participant_count`),
    reply_count: integer(thread.reply_count, `${path}.reply_count`),
    last_active_tick: optionalInteger(
      thread.last_active_tick,
      `${path}.last_active_tick`,
      thread.created_tick,
      23,
    ),
    provenance_kind: provenance,
    message_ids: messages
      .filter((message) => message.thread_id === id)
      .sort((left, right) => (
        left.created_tick - right.created_tick
        || left.message_id.localeCompare(right.message_id)
      ))
      .map((message) => message.message_id),
  }
}

function normalizeClaim(
  value: unknown,
  path: string,
  threadById: Map<string, ForumThread>,
): ForumClaim {
  const claim = object(value, path)
  requiredKeys(claim, [
    'claim_id', 'thread_id', 'claim_summary', 'status', 'first_seen_tick',
    'last_seen_tick', 'created_by_message_id', 'parent_claim_id',
    'supporting_message_ids', 'challenging_message_ids',
    'correction_target_claim_id',
  ], path)
  const id = safeId(claim.claim_id, `${path}.claim_id`)
  const threadId = safeId(claim.thread_id, `${path}.thread_id`)
  const thread = threadById.get(threadId)
  if (!thread) fail(`${path}.thread_id 指向缺失 thread`)
  const parentId = optionalId(claim.parent_claim_id, `${path}.parent_claim_id`)
  const correctionId = optionalId(
    claim.correction_target_claim_id,
    `${path}.correction_target_claim_id`,
  )
  if (parentId === id || correctionId === id) fail(`${path} 不能自引用`)
  if (!CLAIM_STATUSES.has(claim.status)) fail(`${path}.status 非法`)
  if (claim.scenario_id !== undefined && claim.scenario_id !== thread!.scenario_id) {
    fail(`${path}.scenario_id 与 thread 不一致`)
  }
  const rawBranch = claim.branch ?? claim.branch_id
  if (rawBranch !== undefined && rawBranch !== thread!.branch_id) {
    fail(`${path}.branch 与 thread 不一致`)
  }
  return {
    claim_id: id,
    thread_id: threadId,
    created_by_message_id: safeId(
      claim.created_by_message_id,
      `${path}.created_by_message_id`,
    ),
    parent_claim_id: parentId,
    scenario_id: thread!.scenario_id,
    branch_id: thread!.branch_id,
    summary: text(claim.claim_summary, `${path}.claim_summary`),
    status: claim.status,
    first_seen_tick: integer(claim.first_seen_tick, `${path}.first_seen_tick`, 0, 23),
    last_seen_tick: integer(claim.last_seen_tick, `${path}.last_seen_tick`, 0, 23),
    supporting_message_ids: publicIdList(
      claim.supporting_message_ids,
      `${path}.supporting_message_ids`,
    ),
    challenging_message_ids: publicIdList(
      claim.challenging_message_ids,
      `${path}.challenging_message_ids`,
    ),
    correction_target_claim_id: correctionId,
    evidence_reference: optionalText(
      claim.evidence_reference,
      `${path}.evidence_reference`,
    ),
  }
}

function validateTick(value: unknown, path: string, branchId: ForumBranchId): ForumTick {
  const tick = object(value, path)
  requiredKeys(tick, [
    'tick', 'phase', 'active_thread_ids', 'activated_residents',
    'activated_governance', 'public_message_count', 'claim_count',
    'correction_count', 'help_request_count', 'pps_kish_ess', 'metrics',
  ], path)
  const index = integer(tick.tick, `${path}.tick`, 0, 23)
  if (!['baseline', 'burst', 'spread', 'decay'].includes(tick.phase)) {
    fail(`${path}.phase 非法`)
  }
  const expectedResidents = index <= 1 ? 24 : index === 2 ? 48
    : index <= 7 ? 64 : index <= 17 ? 48 : 32
  if (integer(tick.activated_residents, `${path}.activated_residents`, 0, 64)
      !== expectedResidents) fail(`${path}.activated_residents 偏离冻结英雄预算`)
  const expectedActors = branchId === 'D' && [3, 7, 13, 19].includes(index) ? 3 : 0
  if (integer(tick.activated_governance, `${path}.activated_governance`, 0, 3)
      !== expectedActors) fail(`${path}.activated_governance 偏离治理槽位计划`)
  const metrics = object(tick.metrics, `${path}.metrics`)
  Object.entries(metrics).forEach(([key, item]) => finite(item, `${path}.metrics.${key}`))
  if (tick.governance_observation !== undefined) {
    auditGovernance(tick.governance_observation, `${path}.governance_observation`)
  }
  return {
    tick: index,
    phase: tick.phase,
    active_thread_ids: publicIdList(tick.active_thread_ids, `${path}.active_thread_ids`),
    activated_residents: tick.activated_residents,
    activated_governance: tick.activated_governance,
    public_message_count: integer(tick.public_message_count, `${path}.public_message_count`),
    claim_count: integer(tick.claim_count, `${path}.claim_count`),
    correction_count: integer(tick.correction_count, `${path}.correction_count`),
    help_request_count: integer(tick.help_request_count, `${path}.help_request_count`),
    pps_kish_ess: finite(tick.pps_kish_ess, `${path}.pps_kish_ess`, 0, 32),
    metrics: { ...metrics },
    governance_observation: tick.governance_observation,
    governance_decision: tick.governance_decision,
    particle_summary: tick.particle_summary,
  }
}

function normalizeParallelForums(
  value: unknown,
  scenarioIds: string[],
): Record<string, Record<ForumBranchId, ForumParallelBranch>> {
  const forums = object(value, '$.domain_result.parallel_forums')
  const normalized: Record<string, any> = {}
  scenarioIds.forEach((scenarioId) => {
    const scenario = object(forums[scenarioId], `$.domain_result.parallel_forums.${scenarioId}`)
    normalized[scenarioId] = {}
    for (const branchId of ['natural', 'D'] as const) {
      const path = `$.domain_result.parallel_forums.${scenarioId}.${branchId}`
      const branch = object(scenario[branchId], path)
      requiredKeys(branch, ['timeline', 'featured_thread_ids'], path)
      const timeline = array(branch.timeline, `${path}.timeline`)
        .map((item, index) => validateTick(item, `${path}.timeline[${index}]`, branchId))
      if (timeline.length !== 24 || timeline.some((item, index) => item.tick !== index)) {
        fail(`${path}.timeline 必须完整覆盖 Tick 0–23`)
      }
      normalized[scenarioId][branchId] = {
        timeline,
        featured_thread_ids: publicIdList(
          branch.featured_thread_ids,
          `${path}.featured_thread_ids`,
        ),
      }
    }
  })
  return normalized
}

export function validateForumTwinDomain(value: unknown): ForumTwinDomainResult {
  const domain = object(value, '$.domain_result')
  requiredKeys(domain, [
    'schema_version', 'scenarios', 'parallel_forums', 'public_threads',
    'public_messages', 'claims', 'governance', 'sampling', 'intervals',
    'llm_usage', 'ecology_validation', 'ablations', 'hero_gates', 'audit',
  ], '$.domain_result')
  if (domain.schema_version !== FORUM_TWIN_DOMAIN_SCHEMA) {
    fail(`domain_result 必须是 ${FORUM_TWIN_DOMAIN_SCHEMA}`)
  }
  auditPublic(domain, '$.domain_result')
  auditGovernance(domain.governance)
  const scenarios = array(domain.scenarios, '$.domain_result.scenarios').map((item, index) => {
    const scenario = object(item, `$.domain_result.scenarios[${index}]`)
    return {
      scenario_id: safeId(scenario.scenario_id, `$.domain_result.scenarios[${index}].scenario_id`),
      label: text(scenario.label, `$.domain_result.scenarios[${index}].label`),
      description: scenario.description === undefined
        ? undefined
        : text(scenario.description, `$.domain_result.scenarios[${index}].description`),
    }
  })
  if (scenarios.length !== 2 || new Set(scenarios.map((item) => item.scenario_id)).size !== 2) {
    fail('正式结果必须包含两个唯一英雄场景')
  }
  const scenarioIds = scenarios.map((item) => item.scenario_id)
  if (scenarioIds.some((scenarioId) => !HERO_SCENARIOS.has(scenarioId))) {
    fail('场景 ID 不符合冻结的双场景合同')
  }
  const parallelForums = normalizeParallelForums(domain.parallel_forums, scenarioIds)
  const messages = array(domain.public_messages, '$.domain_result.public_messages')
    .map((item, index) => normalizeMessage(item, `$.domain_result.public_messages[${index}]`))
  const messageById = new Map(messages.map((item) => [item.message_id, item]))
  if (messageById.size !== messages.length) fail('公开消息 ID 重复')
  const emissionKeys = messages.map((message) => [
    message.scenario_id,
    message.branch_id,
    message.created_tick,
    message.source_display_id,
  ].join('|'))
  if (new Set(emissionKeys).size !== emissionKeys.length) {
    fail('同一 Agent 在同一场景/分支/tick 产生了多个公开动作')
  }
  const threads = array(domain.public_threads, '$.domain_result.public_threads')
    .map((item, index) => normalizeThread(
      item,
      `$.domain_result.public_threads[${index}]`,
      messages,
    ))
  const threadById = new Map(threads.map((item) => [item.thread_id, item]))
  if (threadById.size !== threads.length) fail('公开 thread ID 重复')
  const claims = array(domain.claims, '$.domain_result.claims')
    .map((item, index) => normalizeClaim(
      item,
      `$.domain_result.claims[${index}]`,
      threadById,
    ))
  const claimById = new Map(claims.map((item) => [item.claim_id, item]))
  if (claimById.size !== claims.length) fail('公开 claim ID 重复')

  messages.forEach((message) => {
    const thread = threadById.get(message.thread_id)
    if (!thread || message.scenario_id !== thread.scenario_id ||
        message.branch_id !== thread.branch_id) {
      fail(`message ${message.message_id} 与 thread 场景/分支不一致`)
    }
    for (const linked of [message.parent_message_id, message.quote_message_id]) {
      if (!linked) continue
      const parent = messageById.get(linked)
      if (!parent || parent.thread_id !== message.thread_id ||
          parent.created_tick >= message.created_tick) {
        fail(`message ${message.message_id} parent/quote 不存在或时间不可见`)
      }
    }
    message.claim_ids.forEach((claimId) => {
      const claim = claimById.get(claimId)
      if (!claim || claim.thread_id !== message.thread_id ||
          claim.first_seen_tick > message.created_tick) {
        fail(`message ${message.message_id} claim 不存在或时间不可见`)
      }
    })
  })
  threads.forEach((thread) => {
    const root = messageById.get(thread.root_message_id)
    if (!root || root.thread_id !== thread.thread_id ||
        root.created_tick !== thread.created_tick || root.parent_message_id !== null) {
      fail(`thread ${thread.thread_id} 缺少合法根帖`)
    }
    if (root.action !== null && !ROOT_ACTIONS.has(root.action)) {
      fail(`thread ${thread.thread_id} 根消息 action 非法`)
    }
    thread.claim_ids.forEach((claimId) => {
      if (!claimById.has(claimId)) fail(`thread ${thread.thread_id} claim 缺失`)
    })
  })
  claims.forEach((claim) => {
    const creator = messageById.get(claim.created_by_message_id)
    if (!creator || creator.thread_id !== claim.thread_id ||
        creator.created_tick !== claim.first_seen_tick) {
      fail(`claim ${claim.claim_id} 创建消息非法`)
    }
    if (claim.last_seen_tick < claim.first_seen_tick) fail(`claim ${claim.claim_id} 时间倒置`)
    for (const linked of [claim.parent_claim_id, claim.correction_target_claim_id]) {
      if (!linked) continue
      const parent = claimById.get(linked)
      if (!parent || parent.thread_id !== claim.thread_id ||
          parent.first_seen_tick >= claim.first_seen_tick) {
        fail(`claim ${claim.claim_id} lineage 非法`)
      }
    }
    for (const messageId of [
      ...claim.supporting_message_ids,
      ...claim.challenging_message_ids,
    ]) {
      const message = messageById.get(messageId)
      if (!message || message.thread_id !== claim.thread_id ||
          message.created_tick > claim.last_seen_tick) {
        fail(`claim ${claim.claim_id} 消息引用非法`)
      }
    }
  })
  scenarioIds.forEach((scenarioId) => {
    for (const branchId of ['natural', 'D'] as const) {
      const branch = parallelForums[scenarioId][branchId]
      for (const id of branch.featured_thread_ids) {
        const thread = threadById.get(id)
        if (!thread || thread.scenario_id !== scenarioId || thread.branch_id !== branchId) {
          fail(`featured thread ${id} 与场景/分支不匹配`)
        }
      }
      branch.timeline.forEach((tick) => tick.active_thread_ids.forEach((id) => {
        const thread = threadById.get(id)
        if (!thread || thread.scenario_id !== scenarioId ||
            thread.branch_id !== branchId || thread.created_tick > tick.tick) {
          fail(`T${tick.tick} active thread ${id} 不存在或时间不可见`)
        }
      }))
    }
  })

  const sampling = object(domain.sampling, '$.domain_result.sampling')
  if (sampling.anchors !== 16 || sampling.pps_budget !== 32) {
    fail('抽样必须是 16 anchors + 32 PPS')
  }
  finite(sampling.scheduler_recall, '$.domain_result.sampling.scheduler_recall', 0.9, 1)
  integer(sampling.unique_activated_agents,
    '$.domain_result.sampling.unique_activated_agents', 500, 1000)
  const ess = array(sampling.kish_ess_range, '$.domain_result.sampling.kish_ess_range')
  if (ess.length !== 2) fail('Kish ESS 必须是二元区间')
  const essMin = finite(ess[0], '$.domain_result.sampling.kish_ess_range[0]', 0, 32)
  finite(ess[1], '$.domain_result.sampling.kish_ess_range[1]', essMin, 32)

  const usage = object(domain.llm_usage, '$.domain_result.llm_usage')
  for (const key of [
    'resident_turns', 'governance_turns', 'live_provider_turns',
    'trace_replay_turns', 'cache_turns', 'provider_calls', 'provider_tokens',
  ]) integer(usage[key], `$.domain_result.llm_usage.${key}`)
  integer(usage.max_resident_activation,
    '$.domain_result.llm_usage.max_resident_activation', 0, 64)
  integer(usage.max_total_activation,
    '$.domain_result.llm_usage.max_total_activation', 0, 67)
  if (usage.live_provider_turns + usage.trace_replay_turns <
      usage.resident_turns + usage.governance_turns) {
    fail('LLM turn provenance 数量不守恒')
  }

  const audit = object(domain.audit, '$.domain_result.audit')
  if (audit.llm_agent_count !== 1000 || audit.particle_count !== 10000) {
    fail('人口必须是 1,000 LLM Agents / 10,000 粒子')
  }
  if (audit.emulator_public_messages !== 0) fail('emulator public messages 必须为 0')
  if (audit.real_governance_actions !== 0) fail('真实治理动作必须为 0')
  const profiles = audit.public_display_profiles === undefined
    ? undefined
    : array(audit.public_display_profiles, '$.domain_result.audit.public_display_profiles')
      .map((profile, index) => normalizeProfile(
        profile,
        `$.domain_result.audit.public_display_profiles[${index}]`,
      ))
  return {
    schema_version: domain.schema_version,
    scenarios,
    parallel_forums: parallelForums,
    public_threads: threads,
    public_messages: messages,
    claims,
    governance: domain.governance,
    sampling: { ...sampling },
    intervals: { ...object(domain.intervals, '$.domain_result.intervals') },
    llm_usage: { ...usage },
    ecology_validation: { ...object(domain.ecology_validation, '$.domain_result.ecology_validation') },
    ablations: { ...object(domain.ablations, '$.domain_result.ablations') },
    hero_gates: { ...object(domain.hero_gates, '$.domain_result.hero_gates') },
    audit: {
      llm_agent_count: audit.llm_agent_count,
      particle_count: audit.particle_count,
      emulator_public_messages: audit.emulator_public_messages,
      real_governance_actions: audit.real_governance_actions,
      public_display_profiles: profiles,
    },
  }
}

export function validateForumTwinAggregate(value: unknown): ForumTwinAggregateResult {
  const aggregate = object(value, '$')
  exactKeys(aggregate, [
    'schema_version', 'run_id', 'launch_fingerprint', 'result_kind',
    'plan_sha256', 'execution_provenance', 'publication_eligible',
    'domain_result', 'visualization_asset', 'completeness', 'budget_usage',
    'usage', 'privacy', 'non_claims', 'result_sha256',
  ], '$')
  if (aggregate.schema_version !== FORUM_TWIN_AGGREGATE_SCHEMA) {
    fail(`aggregate 必须是 ${FORUM_TWIN_AGGREGATE_SCHEMA}`)
  }
  if (!RUN_ID.test(text(aggregate.run_id, '$.run_id'))) fail('$.run_id 格式非法')
  hash(aggregate.launch_fingerprint, '$.launch_fingerprint')
  hash(aggregate.plan_sha256, '$.plan_sha256')
  hash(aggregate.result_sha256, '$.result_sha256')
  if (aggregate.result_kind !== 'llm_forum_twin_simulation') {
    fail('result_kind 不是 LLM ForumTwin')
  }
  if (!FORMAL_PROVENANCE.has(aggregate.execution_provenance) ||
      aggregate.publication_eligible !== true) {
    fail('development/fixture/非正式 provenance 结果拒绝公开读取')
  }
  const visual = object(aggregate.visualization_asset, '$.visualization_asset')
  exactKeys(visual, [
    'schema_version', 'manifest_sha256', 'domain_result_sha256',
    'public_forum_sha256',
  ], '$.visualization_asset')
  if (visual.schema_version !== FORUM_TWIN_MANIFEST_SCHEMA) {
    fail('visualization_asset schema 不匹配')
  }
  for (const key of ['manifest_sha256', 'domain_result_sha256', 'public_forum_sha256']) {
    hash(visual[key], `$.visualization_asset.${key}`)
  }
  const completeness = object(aggregate.completeness, '$.completeness')
  if (completeness.status !== 'complete' ||
      completeness.completed_primary_slots !== PRIMARY_SLOT_COUNT ||
      completeness.required_primary_slots !== PRIMARY_SLOT_COUNT) {
    fail('正式 trace 覆盖或 16,544 槽位不完整')
  }
  const budget = object(aggregate.budget_usage, '$.budget_usage')
  if (budget.primary_slot_limit !== PRIMARY_SLOT_COUNT ||
      budget.provider_request_limit !== 33_088 ||
      budget.provider_token_limit !== 80_000_000 ||
      integer(budget.peak_resident_turns_per_tick,
        '$.budget_usage.peak_resident_turns_per_tick', 0, 64) > 64 ||
      integer(budget.peak_total_turns_per_tick,
        '$.budget_usage.peak_total_turns_per_tick', 0, 67) > 67) {
    fail('ForumTwin Provider 或单轮预算不符合冻结合同')
  }
  const aggregateUsage = object(aggregate.usage, '$.usage')
  const domainUsage = object(aggregate.domain_result, '$.domain_result').llm_usage
  if (aggregateUsage.provider_calls !== undefined &&
      aggregateUsage.provider_calls !== domainUsage.provider_calls) {
    fail('aggregate/domain Provider calls 不守恒')
  }
  if (aggregateUsage.provider_tokens !== undefined &&
      aggregateUsage.provider_tokens !== domainUsage.provider_tokens) {
    fail('aggregate/domain Provider tokens 不守恒')
  }
  if (object(aggregate.privacy, '$.privacy').scan_passed !== true) {
    fail('aggregate 隐私扫描未通过')
  }
  const nonClaims = array(aggregate.non_claims, '$.non_claims')
  if (nonClaims.length < 1) fail('非主张边界缺失')
  nonClaims.forEach((item, index) => text(item, `$.non_claims[${index}]`))
  auditPublic(aggregate, '$')
  validateForumTwinDomain(aggregate.domain_result)
  return aggregate as ForumTwinAggregateResult
}

export function validateForumTwinManifest(value: unknown): ForumTwinManifest {
  const manifest = object(value, '$manifest')
  exactKeys(manifest, [
    'schema_version', 'run_id', 'result_sha256', 'domain_result_sha256',
    'public_forum_sha256', 'thread_batches', 'claim_batches',
    'particle_frames', 'propagation_matrices', 'total_compressed_bytes',
    'asset_integrity', 'manifest_sha256',
  ], '$manifest')
  if (manifest.schema_version !== FORUM_TWIN_MANIFEST_SCHEMA) {
    fail(`manifest 必须是 ${FORUM_TWIN_MANIFEST_SCHEMA}`)
  }
  if (!RUN_ID.test(text(manifest.run_id, '$manifest.run_id'))) {
    fail('$manifest.run_id 格式非法')
  }
  for (const key of [
    'result_sha256', 'domain_result_sha256', 'public_forum_sha256',
    'manifest_sha256',
  ]) hash(manifest[key], `$manifest.${key}`)
  const integrity = object(manifest.asset_integrity, '$manifest.asset_integrity')
  exactKeys(integrity, ['verified', 'verification_method'], '$manifest.asset_integrity')
  if (integrity.verified !== true || ![
    'server_sha256', 'sealed_package_sha256',
  ].includes(integrity.verification_method)) {
    fail('manifest 缺少可信后端/打包器完整性验证标记')
  }
  let total = 0
  for (const group of [
    'thread_batches', 'claim_batches', 'particle_frames',
    'propagation_matrices',
  ] as const) {
    array(manifest[group], `$manifest.${group}`).forEach((item, index) => {
      const descriptor = object(item, `$manifest.${group}[${index}]`)
      exactKeys(descriptor, ['asset_id', 'sha256', 'compressed_bytes'],
        `$manifest.${group}[${index}]`)
      safeId(descriptor.asset_id, `$manifest.${group}[${index}].asset_id`)
      hash(descriptor.sha256, `$manifest.${group}[${index}].sha256`)
      total += integer(descriptor.compressed_bytes,
        `$manifest.${group}[${index}].compressed_bytes`)
    })
  }
  if (integer(manifest.total_compressed_bytes,
    '$manifest.total_compressed_bytes', 0, 100_000_000) !== total) {
    fail('manifest asset bytes 不守恒')
  }
  auditPublic(manifest, '$manifest')
  return manifest as ForumTwinManifest
}

export function validateForumTwinDevelopmentStatus(
  value: unknown,
): ForumTwinDevelopmentStatus {
  const status = object(value, '$status')
  exactKeys(status, [
    'schema_version', 'generated_at', 'backend_loop_ready',
    'publication_eligible', 'model_sha256', 'population',
    'engineering_evidence', 'live_pilot_evidence', 'blocking_gates',
    'claim_boundary',
  ], '$status')
  if (status.schema_version !== 'campus-pulse-forum-twin-frontend-status-v1') {
    fail('ForumTwin development status schema 不匹配')
  }
  if (status.backend_loop_ready !== true || status.publication_eligible !== false) {
    fail('ForumTwin development status 边界非法')
  }
  text(status.generated_at, '$status.generated_at')
  hash(status.model_sha256, '$status.model_sha256')
  const population = object(status.population, '$status.population')
  exactKeys(population, [
    'llm_agents', 'particles', 'current_source',
  ], '$status.population')
  if (population.llm_agents !== 1000 || population.particles !== 10000) {
    fail('ForumTwin development population 必须是 1,000 / 10,000')
  }
  text(population.current_source, '$status.population.current_source')
  const evidence = object(
    status.engineering_evidence,
    '$status.engineering_evidence',
  )
  exactKeys(evidence, [
    'scenarios', 'branches', 'paired_seeds', 'ticks', 'semantic_slots',
    'particle_updates', 'provider_calls', 'public_fixture_messages',
    'full_result_sha256', 'evidence_sha256',
  ], '$status.engineering_evidence')
  const expectedCounts: Record<string, number> = {
    scenarios: 2,
    branches: 5,
    paired_seeds: 8,
    ticks: 24,
    semantic_slots: 16_544,
    particle_updates: 17_280_000,
    provider_calls: 0,
    public_fixture_messages: 0,
  }
  Object.entries(expectedCounts).forEach(([key, expected]) => {
    if (evidence[key] !== expected) {
      fail(`$status.engineering_evidence.${key} 不符合冻结合同`)
    }
  })
  hash(evidence.full_result_sha256, '$status.engineering_evidence.full_result_sha256')
  hash(evidence.evidence_sha256, '$status.engineering_evidence.evidence_sha256')
  const pilots = object(status.live_pilot_evidence, '$status.live_pilot_evidence')
  exactKeys(pilots, [
    'parallel_forum_available', 'closed_loop_available',
    'real_llm_ablation_available', 'disclosure',
  ], '$status.live_pilot_evidence')
  for (const key of [
    'parallel_forum_available', 'closed_loop_available',
    'real_llm_ablation_available',
  ]) {
    if (typeof pilots[key] !== 'boolean') fail(`$status.live_pilot_evidence.${key} 非法`)
  }
  text(pilots.disclosure, '$status.live_pilot_evidence.disclosure')
  publicStringList(status.blocking_gates, '$status.blocking_gates')
  publicStringList(status.claim_boundary, '$status.claim_boundary')
  auditPublic(status, '$status')
  return status as unknown as ForumTwinDevelopmentStatus
}

export function sealForumTwin(
  aggregateValue: unknown,
  manifestValue: unknown,
  manifestSha256Value: unknown,
  source: ForumTwinLoaded['source'],
): ForumTwinLoaded {
  const aggregate = validateForumTwinAggregate(aggregateValue)
  const domain = validateForumTwinDomain(aggregate.domain_result)
  const manifest = validateForumTwinManifest(manifestValue)
  const manifestSha256 = hash(manifestSha256Value, '$manifestSha256')
  const descriptor = aggregate.visualization_asset
  if (manifestSha256 !== descriptor.manifest_sha256 ||
      manifest.manifest_sha256 !== descriptor.manifest_sha256 ||
      manifest.run_id !== aggregate.run_id ||
      manifest.result_sha256 !== aggregate.result_sha256 ||
      manifest.domain_result_sha256 !== descriptor.domain_result_sha256 ||
      manifest.public_forum_sha256 !== descriptor.public_forum_sha256) {
    fail('result → manifest 已验证摘要链不一致')
  }
  return {
    aggregate,
    domain,
    manifest,
    manifestSha256,
    threads: domain.public_threads,
    messages: domain.public_messages,
    claims: domain.claims,
    profiles: domain.audit.public_display_profiles || [],
    source,
  }
}

function assetUrl(file: string): string {
  const base = (import.meta as any).env?.BASE_URL || '/'
  return `${base}campus-pulse-data/${file}`
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('ForumTwin hash input contains a non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => (
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    )).join(',')}}`
  }
  fail('ForumTwin hash input is not JSON-compatible')
}

async function sha256Utf8(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle || typeof TextEncoder === 'undefined') {
    fail('This browser cannot verify ForumTwin SHA-256 assets')
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyForumTwinResultFileHash(
  rawJson: string,
  expectedSha256Value: unknown,
): Promise<string> {
  const expected = hash(expectedSha256Value, '$resultFileSha256')
  const actual = await sha256Utf8(rawJson)
  if (actual !== expected) fail('ForumTwin offline result file SHA-256 mismatch')
  return actual
}

export async function verifyForumTwinManifestHash(
  manifestValue: unknown,
  expectedSha256Value: unknown,
): Promise<string> {
  const manifest = validateForumTwinManifest(manifestValue)
  const expected = hash(expectedSha256Value, '$manifestSha256')
  const identity = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => (
      key !== 'manifest_sha256' && key !== 'result_sha256'
    )),
  )
  const actual = await sha256Utf8(canonicalJson(identity))
  if (actual !== expected || manifest.manifest_sha256 !== actual) {
    fail('ForumTwin visualization manifest SHA-256 mismatch')
  }
  return actual
}

async function fetchJsonDocument(url: string, label: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) fail(`${label} 响应异常：HTTP ${response.status}`)
  const rawText = await response.text()
  try {
    return { payload: JSON.parse(rawText), rawText }
  } catch {
    fail(`${label} 不是有效 JSON`)
  }
}

async function fetchJson(url: string, label: string): Promise<any> {
  return (await fetchJsonDocument(url, label)).payload
}

async function fetchManifest(url: string, label: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) fail(`${label} 响应异常：HTTP ${response.status}`)
  let payload
  try {
    payload = await response.json()
  } catch {
    fail(`${label} 不是有效 JSON`)
  }
  const headerHash = (
    response.headers.get('x-content-sha256')
    || response.headers.get('etag')?.replace(/^W\//, '').replaceAll('"', '')
    || ''
  )
  return { payload, headerHash }
}

async function fetchHash(url: string, label: string): Promise<string> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'text/plain' },
  })
  if (!response.ok) fail(`${label} 响应异常：HTTP ${response.status}`)
  return hash((await response.text()).trim(), label)
}

function unwrap(value: any, label: string): any {
  if (value?.error) fail(value.error.message || `${label} 请求失败`)
  return value?.data ?? value
}

function heroBranchId(value: string): ForumBranchId {
  if (value === 'Natural') return 'natural'
  if (value === 'D') return 'D'
  fail(`ForumTwin hero branch 非法：${value}`)
}

function normalizeHeroShowcase(value: unknown): ForumTwinHeroShowcase {
  const root = object(value, '$hero')
  exactKeys(root, [
    'schema_version', 'source_artifact_sha256', 'source_file_sha256',
    'authorization_fingerprint', 'execution_provenance', 'publication_eligible',
    'disclosure', 'live_usage', 'result',
  ], '$hero')
  if (root.schema_version !== 'campus-pulse-forum-hero-showcase-v1') {
    fail('ForumTwin hero showcase schema 不匹配')
  }
  for (const key of [
    'source_artifact_sha256', 'source_file_sha256',
    'authorization_fingerprint',
  ]) hash(root[key], `$hero.${key}`)
  if (root.execution_provenance !== 'authorized_live_llm') {
    fail('ForumTwin hero showcase 必须来自 authorized live LLM')
  }
  if (root.publication_eligible !== false) {
    fail('ForumTwin hero pilot 不得标记为正式发布结果')
  }
  text(root.disclosure, '$hero.disclosure')
  auditPublic(root, '$hero')
  const result = object(root.result, '$hero.result')
  if (
    result.schema_version !== 'campus-pulse-forum-hero-result-v1'
    // The sealed run resumed from the shared T2 checkpoint, so the execution
    // frontier starts at T3 even though each paired branch carries T0-T23.
    || result.start_tick !== 3
    || result.end_tick !== 23
    || result.population_size !== 1000
    || result.emulator_public_messages !== 0
  ) fail('ForumTwin hero pilot 冻结规模或公开 provenance 不匹配')
  const branches = object(result.branches, '$hero.result.branches')
  if (!branches.Natural || !branches.D) fail('ForumTwin hero pilot 缺少 Natural/D paired branches')
  return root as ForumTwinHeroShowcase
}

function adaptHeroShowcase(showcase: ForumTwinHeroShowcase, digest: string): ForumTwinLoaded {
  const result = showcase.result as any
  const scenarioId = safeId(result.scenario_id, '$hero.result.scenario_id')
  const messages: ForumMessage[] = []
  const threads: ForumThread[] = []
  const claims: ForumClaim[] = []
  const parallel = {} as Record<ForumBranchId, ForumParallelBranch>
  let governanceTurns = 0
  let governanceUptakeCompleteChains = 0
  let governanceUptakeTotalChains = 0
  const governanceUptakeResponseIds = new Set<string>()
  const publicUptakeChains: Array<{ governance_message_id: string; complete: boolean; resident_response_ids: string[] }> = []
  let publicGovernanceRounds: Array<{
    tick: number
    decisions: Array<{ actor: string; selected_action: string; selection_probability: number | null }>
  }> = []

  for (const sourceBranch of ['Natural', 'D']) {
    const branchId = heroBranchId(sourceBranch)
    const branch = object(result.branches[sourceBranch], `$hero.result.branches.${sourceBranch}`)
    if (sourceBranch === 'D') {
      const mechanismChains = object(
        branch.mechanism_chains,
        '$hero.result.branches.D.mechanism_chains',
      )
      const uptakeChains = array(
        mechanismChains.governance_uptake_chains,
        '$hero.result.branches.D.mechanism_chains.governance_uptake_chains',
      )
      governanceUptakeTotalChains = uptakeChains.length
      uptakeChains.forEach((item, index) => {
        const chain = object(item, `$hero.governance_uptake_chains[${index}]`)
        const governanceMessageId = safeId(chain.governance_message_id, '$hero.governance_message_id')
        if (typeof chain.complete !== 'boolean') fail('$hero governance uptake complete 非法')
        if (chain.complete) governanceUptakeCompleteChains += 1
        const residentResponseIds = array(chain.resident_response_ids, '$hero.resident_response_ids')
          .map((id) => safeId(id, '$hero.resident_response_id'))
        residentResponseIds.forEach((id) => governanceUptakeResponseIds.add(id))
        publicUptakeChains.push({
          governance_message_id: governanceMessageId,
          complete: chain.complete,
          resident_response_ids: residentResponseIds,
        })
      })
      publicGovernanceRounds = array(branch.governance_rounds, '$hero.result.branches.D.governance_rounds')
        .map((item, index) => {
          const round = object(item, `$hero.governance_rounds[${index}]`)
          const tick = integer(round.tick, '$hero.governance_rounds.tick', 0, 23)
          const decisions = array(round.decisions, `$hero.governance_rounds[${index}].decisions`)
            .map((decision, decisionIndex) => {
              const record = object(decision, `$hero.governance_rounds[${index}].decisions[${decisionIndex}]`)
              return {
                actor: text(record.actor, '$hero.governance_rounds.actor'),
                selected_action: text(record.selected_action, '$hero.governance_rounds.selected_action'),
                selection_probability: record.selection_probability == null
                  ? null : finite(record.selection_probability, '$hero.governance_rounds.selection_probability', 0, 1),
              }
            })
          return { tick, decisions }
        })
    }
    const sourceMessages = array(branch.messages, `$hero.${sourceBranch}.messages`)
    const branchMessages = sourceMessages.map((item, index): ForumMessage => {
      const message = object(item, `$hero.${sourceBranch}.messages[${index}]`)
      const provenance = object(message.provenance, `$hero.${sourceBranch}.messages[${index}].provenance`)
      if (provenance.kind !== 'authorized_live_llm') fail('Hero 公开消息不是 live LLM')
      return {
        message_id: safeId(message.message_id, '$hero.message_id'),
        thread_id: safeId(message.thread_id, '$hero.thread_id'),
        scenario_id: scenarioId,
        branch_id: branchId,
        parent_message_id: optionalId(message.parent_message_id, '$hero.parent_message_id'),
        quote_message_id: optionalId(message.quote_message_id, '$hero.quote_message_id'),
        source_display_id: safeId(message.source_agent_display_id, '$hero.source_display_id'),
        action: message.action == null ? null : text(message.action, '$hero.action'),
        visible_text: text(message.visible_text, '$hero.visible_text'),
        topic: message.topic == null ? null : text(message.topic, '$hero.topic'),
        stance: message.stance == null ? null : text(message.stance, '$hero.stance'),
        emotion: message.emotion == null ? null : text(message.emotion, '$hero.emotion'),
        evidence_status: message.evidence_status == null
          ? null : text(message.evidence_status, '$hero.evidence_status'),
        confidence: message.confidence == null
          ? null : finite(message.confidence, '$hero.confidence', 0, 1),
        claim_ids: message.claim_id ? [safeId(message.claim_id, '$hero.claim_id')] : [],
        claim_operation: message.claim_operation == null
          ? null : text(message.claim_operation, '$hero.claim_operation'),
        correction_target_claim_id: optionalId(
          message.correction_target_claim_id, '$hero.correction_target_claim_id',
        ),
        created_tick: integer(message.created_tick, '$hero.created_tick', 0, 23),
        ttl: message.ttl == null ? null : integer(message.ttl, '$hero.ttl', 0),
        moderation_status: message.moderation_status === 'accepted' ? 'accepted' : null,
        provenance: {
          kind: 'authorized_live_llm',
          prompt_sha256: provenance.prompt_sha256,
          response_sha256: provenance.response_sha256,
          model: provenance.model,
          trace_release_sha256: provenance.trace_release_sha256,
        },
      }
    })
    messages.push(...branchMessages)

    const branchThreads = array(branch.threads, `$hero.${sourceBranch}.threads`)
      .map((item, index): ForumThread => {
        const thread = object(item, `$hero.${sourceBranch}.threads[${index}]`)
        const threadId = safeId(thread.thread_id, '$hero.thread.thread_id')
        return {
          thread_id: threadId,
          board: text(thread.board, '$hero.thread.board'),
          root_message_id: safeId(thread.root_message_id, '$hero.thread.root_message_id'),
          scenario_id: scenarioId,
          branch_id: branchId,
          created_tick: integer(thread.created_tick, '$hero.thread.created_tick', 0, 23),
          status: thread.status,
          topic: text(thread.topic, '$hero.thread.topic'),
          need: text(thread.need, '$hero.thread.need'),
          claim_ids: array(thread.claim_ids, '$hero.thread.claim_ids').map((id) => safeId(id, '$hero.claim_id')),
          participant_count: integer(thread.participant_count, '$hero.thread.participant_count', 0),
          reply_count: integer(thread.reply_count, '$hero.thread.reply_count', 0),
          last_active_tick: thread.last_active_tick == null
            ? null : integer(thread.last_active_tick, '$hero.thread.last_active_tick', 0, 23),
          provenance_kind: 'authorized_live_llm',
          message_ids: branchMessages.filter((message) => message.thread_id === threadId)
            .map((message) => message.message_id),
        }
      })
    threads.push(...branchThreads)

    for (const item of array(branch.claims, `$hero.${sourceBranch}.claims`)) {
      const claim = object(item, '$hero.claim')
      const threadId = safeId(claim.thread_id, '$hero.claim.thread_id')
      const related = branchMessages.filter((message) => (
        message.thread_id === threadId && message.claim_ids.includes(claim.claim_id)
      ))
      const fallbackRoot = branchThreads.find((thread) => thread.thread_id === threadId)?.root_message_id
      claims.push({
        claim_id: safeId(claim.claim_id, '$hero.claim.claim_id'),
        thread_id: threadId,
        created_by_message_id: related[0]?.message_id || fallbackRoot || branchMessages[0]?.message_id,
        parent_claim_id: optionalId(claim.parent_claim_id, '$hero.claim.parent_claim_id'),
        scenario_id: scenarioId,
        branch_id: branchId,
        summary: text(claim.claim_summary, '$hero.claim.summary'),
        status: text(claim.status, '$hero.claim.status'),
        first_seen_tick: integer(claim.first_seen_tick, '$hero.claim.first_seen_tick', 0, 23),
        last_seen_tick: integer(claim.last_seen_tick, '$hero.claim.last_seen_tick', 0, 23),
        supporting_message_ids: related.map((message) => message.message_id),
        challenging_message_ids: [],
        correction_target_claim_id: optionalId(
          claim.correction_target_claim_id, '$hero.claim.correction_target_claim_id',
        ),
        evidence_reference: null,
      })
    }

    const governanceByTick = new Map<number, any>()
    for (const item of array(branch.governance_rounds, `$hero.${sourceBranch}.governance_rounds`)) {
      const round = object(item, '$hero.governance_round')
      governanceByTick.set(round.tick, round)
      governanceTurns += array(round.decisions, '$hero.governance_round.decisions').length
    }
    const sourceTimeline = array(branch.timeline, `$hero.${sourceBranch}.timeline`)
    const sourceTicks = sourceTimeline.map((item, index) => (
      integer(object(item, `$hero.${sourceBranch}.timeline[${index}]`).tick, '$hero.timeline.tick', 0, 23)
    ))
    if (
      sourceTicks.length !== 24
      || sourceTicks.some((value, index) => value !== index)
    ) fail(`ForumTwin 路演运行 ${sourceBranch} 时间轴必须完整覆盖 Tick 0–23`)
    const timeline = sourceTimeline.map((item): ForumTick => {
      const sourceTick = object(item, '$hero.timeline')
      const atTick = branchMessages.filter((message) => message.created_tick === sourceTick.tick)
      const governance = governanceByTick.get(sourceTick.tick)
      const governanceDecisions = governance
        ? array(governance.decisions, '$hero.governance.decisions')
        : []
      const governanceDecisionSummary: Record<string, unknown> = Object.fromEntries(
        governanceDecisions.map((item, index) => {
          const decision = object(item, `$hero.governance.decisions[${index}]`)
          const actor = text(decision.actor, '$hero.governance.actor')
          const selected = text(decision.selected_action, '$hero.governance.selected_action')
          const probability = finite(
            decision.selection_probability,
            '$hero.governance.selection_probability',
            0,
            1,
          )
          return [actor, `${selected} · ${(probability * 100).toFixed(1)}%`]
        }),
      )
      if (governance) {
        const resources = object(governance.resource_after, '$hero.governance.resource_after')
        governanceDecisionSummary.resource = `committed ${resources.committed} · remaining ${resources.remaining}`
        governanceDecisionSummary.conserved = Boolean(resources.conserved)
      }
      const activeThreads = branchThreads.filter((thread) => thread.created_tick <= sourceTick.tick)
        .sort((a, b) => (b.last_active_tick || b.created_tick) - (a.last_active_tick || a.created_tick))
      const state = { ...object(sourceTick.population_state, '$hero.timeline.population_state') }
      return {
        tick: integer(sourceTick.tick, '$hero.timeline.tick', 0, 23),
        phase: sourceTick.phase,
        active_thread_ids: activeThreads.map((thread) => thread.thread_id),
        activated_residents: atTick.filter((message) => !message.source_display_id.startsWith('governance:')).length,
        activated_governance: governance ? array(governance.decisions, '$hero.governance.decisions').length : 0,
        public_message_count: sourceTick.message_count,
        claim_count: sourceTick.claim_count,
        correction_count: atTick.filter((message) => message.action === 'correct').length,
        help_request_count: atTick.filter((message) => message.action === 'seek_help').length,
        pps_kish_ess: 0,
        metrics: state,
        governance_observation: governance ? {
          finite_observation: true,
          uses_hidden_truth: governance.uses_hidden_truth,
          resource_before: governance.resource_before,
        } : {},
        governance_decision: governanceDecisionSummary,
        particle_summary: state,
      }
    })
    parallel[branchId] = {
      timeline,
      featured_thread_ids: branchThreads.map((thread) => thread.thread_id),
    }
  }

  const usage = showcase.live_usage as any
  const uniqueActivated = Math.max(
    Number((result.branches as any).Natural.unique_activated_agents || 0),
    Number((result.branches as any).D.unique_activated_agents || 0),
  )
  const domain: ForumTwinDomainResult = {
    schema_version: 'campus-pulse-forum-hero-showcase-domain-v1',
    scenarios: [{
      scenario_id: scenarioId,
      label: '讲座争议信息进入校园论坛',
      description: '真实 LLM 单场景 paired hero pilot：Natural 与自适应治理 D。',
    }],
    parallel_forums: { [scenarioId]: parallel },
    public_threads: threads,
    public_messages: messages,
    claims,
    governance: {
      paired_final_difference_D_minus_Natural: result.paired_final_difference_D_minus_Natural,
      governance_uptake_chains: publicUptakeChains,
      governance_rounds: publicGovernanceRounds,
    },
    sampling: {
      anchors: Number(result.anchor_count || 16),
      pps_budget: 32,
      scheduler_recall: 0,
      kish_ess_range: [0, 0],
      unique_activated_agents: uniqueActivated,
    },
    intervals: {},
    llm_usage: {
      resident_turns: Number(usage.semantic_turns || 0),
      governance_turns: governanceTurns,
      live_provider_turns: Number(usage.semantic_turns || 0) + governanceTurns,
      trace_replay_turns: Number(usage.cache_hits || 0),
      cache_turns: Number(usage.cache_hits || 0),
      provider_calls: Number(usage.provider_calls || 0),
      provider_tokens: Number(usage.provider_tokens || 0),
      max_resident_activation: 64,
      max_total_activation: 67,
    },
    ecology_validation: { status: 'not_part_of_this_pilot' },
    ablations: { status: 'separate_evidence' },
    hero_gates: {
      status: 'pilot_reviewed',
      disclosure: showcase.disclosure,
      governance_uptake_total_chains: governanceUptakeTotalChains,
      governance_uptake_complete_chains: governanceUptakeCompleteChains,
      governance_uptake_response_ids: [...governanceUptakeResponseIds].sort(),
    },
    audit: {
      llm_agent_count: 1000,
      particle_count: 10000,
      emulator_public_messages: 0,
      real_governance_actions: Number(result.real_governance_actions || 0),
      public_display_profiles: [],
    },
  }
  const aggregate = {
    schema_version: 'campus-pulse-forum-hero-showcase-v1',
    run_id: 'hero_pilot_r9_t23',
    launch_fingerprint: showcase.authorization_fingerprint,
    result_kind: 'llm_forum_twin_hero_pilot',
    plan_sha256: showcase.source_artifact_sha256,
    execution_provenance: 'authorized_live_llm' as FormalProvenance,
    publication_eligible: false,
    domain_result: domain as unknown as Record<string, unknown>,
    visualization_asset: {
      schema_version: 'campus-pulse-forum-hero-showcase-v1',
      manifest_sha256: digest,
      domain_result_sha256: result.result_sha256,
      public_forum_sha256: showcase.source_artifact_sha256,
    },
    completeness: {
      status: 'pilot' as const,
      completed_primary_slots: Number(usage.semantic_turns || 0),
      required_primary_slots: Number(usage.semantic_turns || 0),
    },
    budget_usage: {},
    usage: {},
    privacy: { scan_passed: true as const },
    non_claims: [showcase.disclosure, ...array(result.non_claims, '$hero.result.non_claims')],
    result_sha256: result.result_sha256,
  }
  const manifest: ForumTwinManifest = {
    schema_version: 'campus-pulse-forum-twin-visualization-v4',
    run_id: aggregate.run_id,
    result_sha256: aggregate.result_sha256,
    domain_result_sha256: result.result_sha256,
    public_forum_sha256: showcase.source_artifact_sha256,
    thread_batches: [], claim_batches: [], particle_frames: [], propagation_matrices: [],
    total_compressed_bytes: 0,
    asset_integrity: { verified: true, verification_method: 'sealed_package_sha256' },
    manifest_sha256: digest,
  }
  return {
    aggregate,
    domain,
    manifest,
    manifestSha256: digest,
    threads,
    messages,
    claims,
    profiles: [],
    source: { mode: 'hero_pilot', label: '已验证离线路演运行 · Tick 0–23', run_id: null },
  }
}

export async function loadForumTwinHeroShowcase(): Promise<ForumTwinLoaded> {
  const [document, expectedHash] = await Promise.all([
    fetchJsonDocument(assetUrl(FORUM_TWIN_HERO_SHOWCASE), 'ForumTwin hero showcase'),
    fetchHash(assetUrl(FORUM_TWIN_HERO_SHOWCASE_FILE_HASH), 'ForumTwin hero showcase 文件哈希'),
  ])
  const digest = await verifyForumTwinResultFileHash(document.rawText, expectedHash)
  return adaptHeroShowcase(normalizeHeroShowcase(document.payload), digest)
}

async function loadApi(runId: string): Promise<ForumTwinLoaded> {
  if (!RUN_ID.test(runId)) fail('run_id 格式非法，已拒绝加载')
  const base = `/api/campus-pulse/v1/runs/${encodeURIComponent(runId)}`
  const [resultEnvelope, manifestResponse] = await Promise.all([
    fetchJson(`${base}/result`, 'ForumTwin run result'),
    fetchManifest(`${base}/forum-twin/manifest`, 'ForumTwin run manifest'),
  ])
  const resultData = unwrap(resultEnvelope, 'ForumTwin result')
  const manifestData = unwrap(manifestResponse.payload, 'ForumTwin manifest')
  await verifyForumTwinManifestHash(manifestData, manifestResponse.headerHash)
  return sealForumTwin(
    resultData.result ?? resultData,
    manifestData,
    manifestResponse.headerHash,
    { mode: 'api', label: `RUN ${runId}`, run_id: runId },
  )
}

export async function loadForumTwin(runId: string): Promise<ForumTwinLoaded> {
  if (!runId) {
    fail('ForumTwin source must be explicit; use loadForumTwinHeroShowcase for offline Hero')
  }
  return loadApi(runId)
}

export async function loadForumTwinDevelopmentStatus(): Promise<ForumTwinDevelopmentStatus> {
  const value = await fetchJson(
    assetUrl(FORUM_TWIN_DEVELOPMENT_STATUS),
    'ForumTwin development status',
  )
  return validateForumTwinDevelopmentStatus(value)
}
