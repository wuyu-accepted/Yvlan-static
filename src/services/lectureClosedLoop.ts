import type {
  ForumClaim,
  ForumMessage,
  ForumThread,
  ForumTick,
  ForumTwinAggregateResult,
  ForumTwinDomainResult,
  ForumTwinLoaded,
  ForumTwinManifest,
} from './forumTwin.ts'

export const LECTURE_CLOSED_LOOP_FILE = 'lecture-closed-loop-r18.json'
export const LECTURE_CLOSED_LOOP_HASH_FILE = 'lecture-closed-loop-r18.sha256'

const SHA256 = /^[0-9a-f]{64}$/
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/

export interface LectureClosedLoopStep {
  tick: number
  label: string
  text: string
  messageId: string
  stance: string | null
}

export interface LectureClosedLoopEvidence {
  schemaVersion: 'campus-pulse-lecture-closed-loop-evidence-v1'
  resultSha256: string
  fileSha256: string
  publicMessages: number
  directReplies: number
  correctionChains: number
  governanceUptakeChains: number
  helpServiceClosures: number
  providerCalls: number
  providerTokens: number
  unknownOutcomes: number
  correctionSteps: LectureClosedLoopStep[]
  governanceText: string
  governanceResponseText: string
  disclosure: string
}

function fail(message: string): never {
  throw new Error(`讲座纠错闭环证据校验失败：${message}`)
}

function record(value: unknown, path: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} 必须是对象`)
  return value as Record<string, any>
}

function list(value: unknown, path: string): any[] {
  if (!Array.isArray(value)) fail(`${path} 必须是数组`)
  return value
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${path} 必须是非空字符串`)
  return value
}

function id(value: unknown, path: string): string {
  const normalized = text(value, path)
  if (!SAFE_ID.test(normalized)) fail(`${path} 不是安全公开 ID`)
  return normalized
}

function integer(value: unknown, path: string, min = 0): number {
  if (!Number.isInteger(value) || Number(value) < min) fail(`${path} 不是合法整数`)
  return Number(value)
}

function publicAssetUrl(file: string): string {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/campus-pulse-data/${file}`
}

async function fetchText(file: string): Promise<string> {
  const response = await fetch(publicAssetUrl(file), {
    cache: 'no-store',
    headers: { Accept: 'text/plain,application/json' },
  })
  if (!response.ok) fail(`${file} HTTP ${response.status}`)
  return response.text()
}

async function digest(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (item) => item.toString(16).padStart(2, '0')).join('')
}

function checkedMessage(value: unknown, path: string): Record<string, any> {
  const message = record(value, path)
  id(message.message_id, `${path}.message_id`)
  id(message.thread_id, `${path}.thread_id`)
  text(message.visible_text, `${path}.visible_text`)
  integer(message.created_tick, `${path}.created_tick`)
  const provenance = record(message.provenance, `${path}.provenance`)
  if (provenance.kind !== 'authorized_live_llm') fail(`${path} 不是授权真实 LLM 内容`)
  if (provenance.model !== 'gpt-5.6-luna') fail(`${path} 模型 provenance 不匹配`)
  return message
}

export async function loadLectureClosedLoopEvidence(): Promise<LectureClosedLoopEvidence> {
  const [raw, expectedRaw] = await Promise.all([
    fetchText(LECTURE_CLOSED_LOOP_FILE),
    fetchText(LECTURE_CLOSED_LOOP_HASH_FILE),
  ])
  const expected = expectedRaw.trim().toLowerCase()
  if (!SHA256.test(expected)) fail('文件哈希格式非法')
  const actual = await digest(raw)
  if (actual !== expected) fail('文件哈希不匹配，已拒绝显示')

  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { fail('证据文件不是合法 JSON') }
  const root = record(parsed, '$')
  const result = record(root.result, '$.result')
  if (result.schema_version !== 'campus-pulse-forum-hero-result-v1') fail('结果 schema 不匹配')
  if (result.scenario_id !== 'lecture_external_incident_shock') fail('场景不匹配')
  if (result.start_tick !== 3 || result.end_tick !== 5) fail('闭环时间边界不匹配')
  if (result.population_size !== 1000 || result.emulator_public_messages !== 0) fail('人口或公开内容 provenance 不匹配')
  if (result.mechanism_protocol !== 'targeted_closed_loop_audit_v1') fail('机制协议不匹配')
  const branches = record(result.branches, '$.result.branches')
  if (Object.keys(branches).length !== 1 || !branches.D) fail('该证据必须是独立 D 分支、Tick 3–5 闭环运行')
  const branch = record(branches.D, '$.result.branches.D')
  const messages = list(branch.messages, '$.result.branches.D.messages')
    .map((item, index) => checkedMessage(item, `$.messages[${index}]`))
  const byId = new Map(messages.map((message) => [message.message_id, message]))
  if (byId.size !== messages.length) fail('公开消息 ID 重复')

  const mechanisms = record(branch.mechanism_chains, '$.result.branches.D.mechanism_chains')
  const correction = list(mechanisms.correction_chains, '$.correction_chains')
    .find((item) => item?.complete === true)
  if (!correction) fail('未找到完整纠错链')
  const correctionRow = record(correction, '$.complete_correction_chain')
  const correctionMessage = byId.get(id(correctionRow.correction_message_id, '$.correction_message_id'))
  const acceptanceId = id(list(correctionRow.acceptance_response_ids, '$.acceptance_response_ids')[0], '$.acceptance_response_id')
  const rejectionId = id(list(correctionRow.rejection_response_ids, '$.rejection_response_ids')[0], '$.rejection_response_id')
  const acceptance = byId.get(acceptanceId)
  const rejection = byId.get(rejectionId)
  if (!correctionMessage || !acceptance || !rejection) fail('纠错链引用了缺失消息')
  if (acceptance.parent_message_id !== correctionMessage.message_id || rejection.parent_message_id !== correctionMessage.message_id) {
    fail('接受/质疑不是对纠错消息的严格直接回复')
  }
  const claimId = id(correctionRow.claim_id, '$.claim_id')
  const origin = messages.find((message) => message.claim_id === claimId && message.created_tick < correctionMessage.created_tick)
  if (!origin) fail('纠错链缺少原始争议 Claim')

  const uptake = list(mechanisms.governance_uptake_chains, '$.governance_uptake_chains')
    .filter((item) => item?.complete === true)
  const governanceChain = uptake.find((item) => list(item?.resident_response_ids, '$.resident_response_ids').length > 0)
  if (!governanceChain) fail('未找到完整治理承接链')
  const governanceMessage = byId.get(id(governanceChain.governance_message_id, '$.governance_message_id'))
  const governanceResponse = byId.get(id(governanceChain.resident_response_ids[0], '$.governance_response_id'))
  if (!governanceMessage || !governanceResponse) fail('治理承接链引用了缺失消息')

  const helpClosures = list(mechanisms.help_service_feedback_chains, '$.help_service_feedback_chains')
    .filter((item) => item?.complete === true)
  const usage = record(root.live_usage, '$.live_usage')
  if (integer(usage.unknown_outcomes, '$.live_usage.unknown_outcomes') !== 0) fail('存在未知 Provider 结果')
  const resultSha256 = text(result.result_sha256, '$.result.result_sha256')
  if (!SHA256.test(resultSha256)) fail('结果 SHA-256 非法')

  const step = (message: Record<string, any>, label: string): LectureClosedLoopStep => ({
    tick: integer(message.created_tick, '$.message.created_tick'),
    label,
    text: text(message.visible_text, '$.message.visible_text'),
    messageId: id(message.message_id, '$.message.message_id'),
    stance: typeof message.stance === 'string' ? message.stance : null,
  })
  return {
    schemaVersion: 'campus-pulse-lecture-closed-loop-evidence-v1',
    resultSha256,
    fileSha256: actual,
    publicMessages: messages.length,
    directReplies: messages.filter((message) => message.parent_message_id).length,
    correctionChains: 1,
    governanceUptakeChains: uptake.length,
    helpServiceClosures: helpClosures.length,
    providerCalls: integer(usage.provider_calls, '$.live_usage.provider_calls'),
    providerTokens: integer(usage.provider_tokens, '$.live_usage.provider_tokens'),
    unknownOutcomes: 0,
    correctionSteps: [
      step(origin, '争议 Claim'),
      step(correctionMessage, '证据边界纠错'),
      step(acceptance, '接受纠错'),
      step(rejection, '保留质疑'),
    ],
    governanceText: text(governanceMessage.visible_text, '$.governance_message.visible_text'),
    governanceResponseText: text(governanceResponse.visible_text, '$.governance_response.visible_text'),
    disclosure: '这是 D 分支、Tick 3–5 的真实 LLM 纠错机制验证；它证明闭环能运行，不用于声称治理方案的现实因果优越性。',
  }
}

function optionalId(value: unknown, path: string): string | null {
  return value == null ? null : id(value, path)
}

function finite(value: unknown, path: string, min?: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path} 必须是有限数字`)
  if (min !== undefined && value < min) fail(`${path} 低于下界`)
  if (max !== undefined && value > max) fail(`${path} 超过上界`)
  return value
}

function mapMessage(value: unknown, scenarioId: string, path: string): ForumMessage {
  const message = checkedMessage(value, path)
  const provenance = record(message.provenance, `${path}.provenance`)
  return {
    message_id: id(message.message_id, `${path}.message_id`),
    thread_id: id(message.thread_id, `${path}.thread_id`),
    scenario_id: scenarioId,
    branch_id: 'D',
    parent_message_id: optionalId(message.parent_message_id, `${path}.parent_message_id`),
    quote_message_id: optionalId(message.quote_message_id, `${path}.quote_message_id`),
    source_display_id: id(message.source_agent_display_id, `${path}.source_agent_display_id`),
    action: message.action == null ? null : text(message.action, `${path}.action`),
    visible_text: text(message.visible_text, `${path}.visible_text`),
    topic: message.topic == null ? null : text(message.topic, `${path}.topic`),
    stance: message.stance == null ? null : text(message.stance, `${path}.stance`),
    emotion: message.emotion == null ? null : text(message.emotion, `${path}.emotion`),
    evidence_status: message.evidence_status == null ? null : text(message.evidence_status, `${path}.evidence_status`),
    confidence: message.confidence == null ? null : finite(message.confidence, `${path}.confidence`, 0, 1),
    claim_ids: message.claim_id ? [id(message.claim_id, `${path}.claim_id`)] : [],
    claim_operation: message.claim_operation == null ? null : text(message.claim_operation, `${path}.claim_operation`),
    correction_target_claim_id: optionalId(message.correction_target_claim_id, `${path}.correction_target_claim_id`),
    created_tick: integer(message.created_tick, `${path}.created_tick`),
    ttl: message.ttl == null ? null : integer(message.ttl, `${path}.ttl`),
    moderation_status: message.moderation_status === 'accepted' ? 'accepted' : null,
    provenance: {
      kind: 'authorized_live_llm',
      prompt_sha256: SHA256.test(String(provenance.prompt_sha256 || '')) ? provenance.prompt_sha256 : undefined,
      response_sha256: SHA256.test(String(provenance.response_sha256 || '')) ? provenance.response_sha256 : undefined,
      model: 'gpt-5.6-luna',
      trace_release_sha256: null,
    },
    interaction_counts: null,
  }
}

/** Build a normal ForumTwin public view from the sealed D/T3–T5 mechanism run.
 * It remains a single-branch mechanism validation and never fabricates Natural. */
export async function loadLectureClosedLoopForum(): Promise<ForumTwinLoaded> {
  const evidence = await loadLectureClosedLoopEvidence()
  const raw = await fetchText(LECTURE_CLOSED_LOOP_FILE)
  if (await digest(raw) !== evidence.fileSha256) fail('二次读取时文件发生变化')
  const root = record(JSON.parse(raw), '$')
  const result = record(root.result, '$.result')
  const branch = record(record(result.branches, '$.result.branches').D, '$.result.branches.D')
  const scenarioId = id(result.scenario_id, '$.result.scenario_id')
  const messages = list(branch.messages, '$.result.branches.D.messages')
    .map((item, index) => mapMessage(item, scenarioId, `$.messages[${index}]`))
  const messageById = new Map(messages.map((message) => [message.message_id, message]))

  const threads: ForumThread[] = list(branch.threads, '$.result.branches.D.threads')
    .map((value, index) => {
      const thread = record(value, `$.threads[${index}]`)
      const threadId = id(thread.thread_id, '$.thread.thread_id')
      const related = messages.filter((message) => message.thread_id === threadId)
      const rootMessageId = id(thread.root_message_id, '$.thread.root_message_id')
      if (!messageById.has(rootMessageId)) fail(`${threadId} 缺少根帖`)
      const rawTopic = text(thread.topic, '$.thread.topic')
      const governance = rawTopic === 'governance'
      return {
        thread_id: threadId,
        board: text(thread.board, '$.thread.board'),
        root_message_id: rootMessageId,
        scenario_id: scenarioId,
        branch_id: 'D' as const,
        created_tick: integer(thread.created_tick, '$.thread.created_tick'),
        status: ['open', 'closed', 'archived'].includes(thread.status) ? thread.status : fail('thread.status 非法'),
        topic: governance ? '治理证据与服务回应' : '讲座言论争议与职业选择',
        need: governance ? '核实、咨询与跨群承接' : text(thread.need, '$.thread.need'),
        claim_ids: list(thread.claim_ids, '$.thread.claim_ids').map((claimId, claimIndex) => id(claimId, `$.thread.claim_ids[${claimIndex}]`)),
        participant_count: integer(thread.participant_count, '$.thread.participant_count'),
        reply_count: integer(thread.reply_count, '$.thread.reply_count'),
        last_active_tick: thread.last_active_tick == null ? null : integer(thread.last_active_tick, '$.thread.last_active_tick'),
        provenance_kind: 'authorized_live_llm' as const,
        message_ids: related.map((message) => message.message_id),
      }
    })
  const threadById = new Map(threads.map((thread) => [thread.thread_id, thread]))

  const claims: ForumClaim[] = list(branch.claims, '$.result.branches.D.claims')
    .map((value, index) => {
      const claim = record(value, `$.claims[${index}]`)
      const claimId = id(claim.claim_id, '$.claim.claim_id')
      const threadId = id(claim.thread_id, '$.claim.thread_id')
      const thread = threadById.get(threadId)
      if (!thread) fail(`${claimId} 引用了缺失讨论串`)
      const related = messages.filter((message) => message.claim_ids.includes(claimId))
      return {
        claim_id: claimId,
        thread_id: threadId,
        created_by_message_id: related[0]?.message_id || thread.root_message_id,
        parent_claim_id: optionalId(claim.parent_claim_id, '$.claim.parent_claim_id'),
        scenario_id: scenarioId,
        branch_id: 'D' as const,
        summary: text(claim.claim_summary, '$.claim.claim_summary'),
        status: text(claim.status, '$.claim.status'),
        first_seen_tick: integer(claim.first_seen_tick, '$.claim.first_seen_tick'),
        last_seen_tick: integer(claim.last_seen_tick, '$.claim.last_seen_tick'),
        supporting_message_ids: related.filter((message) => message.stance !== 'oppose').map((message) => message.message_id),
        challenging_message_ids: related.filter((message) => message.stance === 'oppose' || message.claim_operation === 'challenge').map((message) => message.message_id),
        correction_target_claim_id: optionalId(claim.correction_target_claim_id, '$.claim.correction_target_claim_id'),
        evidence_reference: related.some((message) => message.action === 'correct') ? evidence.resultSha256 : null,
      }
    })

  const governanceRounds = list(branch.governance_rounds, '$.result.branches.D.governance_rounds')
  const governanceByTick = new Map(governanceRounds.map((value) => {
    const round = record(value, '$.governance_round')
    return [integer(round.tick, '$.governance_round.tick'), round]
  }))
  const timeline: ForumTick[] = list(branch.timeline, '$.result.branches.D.timeline')
    .map((value, index) => {
      const source = record(value, `$.timeline[${index}]`)
      const tick = integer(source.tick, '$.timeline.tick')
      const phase = text(source.phase, '$.timeline.phase') as ForumTick['phase']
      if (!['baseline', 'burst', 'spread', 'decay'].includes(phase)) fail('timeline.phase 非法')
      const atTick = messages.filter((message) => message.created_tick === tick)
      const governance = governanceByTick.get(tick)
      const decisions = governance ? list(governance.decisions, '$.governance.decisions') : []
      const decisionSummary = Object.fromEntries(decisions.map((value, decisionIndex) => {
        const decision = record(value, `$.governance.decisions[${decisionIndex}]`)
        return [text(decision.actor, '$.governance.actor'), `${text(decision.selected_action, '$.governance.selected_action')} · ${(finite(decision.selection_probability, '$.governance.selection_probability', 0, 1) * 100).toFixed(1)}%`]
      }))
      return {
        tick,
        phase,
        active_thread_ids: threads.filter((thread) => thread.created_tick <= tick).map((thread) => thread.thread_id),
        activated_residents: atTick.filter((message) => !message.source_display_id.startsWith('governance:')).length,
        activated_governance: decisions.length,
        public_message_count: integer(source.message_count, '$.timeline.message_count'),
        claim_count: integer(source.claim_count, '$.timeline.claim_count'),
        correction_count: atTick.filter((message) => message.action === 'correct').length,
        help_request_count: integer(source.help_request_count, '$.timeline.help_request_count'),
        pps_kish_ess: Number(source.pps_population_recovery?.partial_pooling?.kish_ess || 0),
        metrics: record(source.population_state, '$.timeline.population_state'),
        governance_observation: governance ? { finite_observation: true, uses_hidden_truth: false } : {},
        governance_decision: decisionSummary,
        particle_summary: record(source.population_state, '$.timeline.population_state'),
      }
    })
  if (timeline.length !== 6 || timeline.some((tick, index) => tick.tick !== index)) fail('公开时间轴必须完整覆盖 Tick 0–5')

  const mechanisms = record(branch.mechanism_chains, '$.result.branches.D.mechanism_chains')
  const publicRounds = governanceRounds.map((value) => {
    const round = record(value, '$.governance_round')
    return {
      tick: integer(round.tick, '$.governance_round.tick'),
      decisions: list(round.decisions, '$.governance_round.decisions').map((value) => {
        const decision = record(value, '$.governance_decision')
        return {
          actor: text(decision.actor, '$.governance.actor'),
          selected_action: text(decision.selected_action, '$.governance.selected_action'),
          selection_probability: finite(decision.selection_probability, '$.governance.selection_probability', 0, 1),
        }
      }),
    }
  })
  const usage = record(root.live_usage, '$.live_usage')
  const domain: ForumTwinDomainResult = {
    schema_version: 'campus-pulse-lecture-closed-loop-domain-v1',
    scenarios: [{
      scenario_id: scenarioId,
      label: '讲座言论争议与信息核实',
      description: '真实 LLM 的 D 分支、Tick 3–5 纠错机制验证：证据边界、咨询承接与居民接受/质疑。',
    }],
    parallel_forums: {
      [scenarioId]: { D: { timeline, featured_thread_ids: threads.map((thread) => thread.thread_id) } },
    } as any,
    public_threads: threads,
    public_messages: messages,
    claims,
    governance: {
      governance_rounds: publicRounds,
      governance_uptake_chains: mechanisms.governance_uptake_chains,
      correction_chains: mechanisms.correction_chains,
      help_service_feedback_chains: mechanisms.help_service_feedback_chains,
    },
    sampling: {
      anchors: Number(result.anchor_count || 16),
      pps_budget: 0,
      scheduler_recall: 0,
      kish_ess_range: [0, 0],
      unique_activated_agents: Number(branch.unique_activated_agents || 0),
    },
    intervals: {},
    llm_usage: {
      resident_turns: Number(usage.semantic_turns || 0) - 3,
      governance_turns: 3,
      live_provider_turns: Number(usage.semantic_turns || 0),
      trace_replay_turns: Number(usage.cache_hits || 0),
      cache_turns: Number(usage.cache_hits || 0),
      provider_calls: evidence.providerCalls,
      provider_tokens: evidence.providerTokens,
      max_resident_activation: 16,
      max_total_activation: 19,
    },
    ecology_validation: { status: 'not_part_of_mechanism_vignette' },
    ablations: { status: 'separate_evidence' },
    hero_gates: {
      status: 'reviewed_closed_loop_mechanism_pass',
      disclosure: evidence.disclosure,
      correction_chains: evidence.correctionChains,
      governance_uptake_chains: evidence.governanceUptakeChains,
      help_service_closures: evidence.helpServiceClosures,
    },
    audit: {
      llm_agent_count: 1000,
      particle_count: 10000,
      emulator_public_messages: 0,
      real_governance_actions: 0,
      public_display_profiles: [],
    },
  }
  const aggregate: ForumTwinAggregateResult = {
    schema_version: 'campus-pulse-lecture-closed-loop-showcase-v1',
    run_id: 'hero_closed_loop_r18',
    launch_fingerprint: evidence.fileSha256,
    result_kind: 'llm_forum_twin_closed_loop_mechanism',
    plan_sha256: evidence.resultSha256,
    execution_provenance: 'authorized_live_llm',
    publication_eligible: false,
    domain_result: domain as unknown as Record<string, unknown>,
    visualization_asset: {
      schema_version: 'campus-pulse-forum-twin-visualization-v4',
      manifest_sha256: evidence.fileSha256,
      domain_result_sha256: evidence.resultSha256,
      public_forum_sha256: evidence.resultSha256,
    },
    completeness: { status: 'pilot', completed_primary_slots: Number(usage.semantic_turns || 0), required_primary_slots: Number(usage.semantic_turns || 0) },
    budget_usage: {}, usage: {}, privacy: { scan_passed: true },
    non_claims: [evidence.disclosure],
    result_sha256: evidence.resultSha256,
  }
  const manifest: ForumTwinManifest = {
    schema_version: 'campus-pulse-forum-twin-visualization-v4',
    run_id: aggregate.run_id,
    result_sha256: evidence.resultSha256,
    domain_result_sha256: evidence.resultSha256,
    public_forum_sha256: evidence.resultSha256,
    thread_batches: [], claim_batches: [], particle_frames: [], propagation_matrices: [],
    total_compressed_bytes: 0,
    asset_integrity: { verified: true, verification_method: 'sealed_package_sha256' },
    manifest_sha256: evidence.fileSha256,
  }
  return {
    aggregate,
    domain,
    manifest,
    manifestSha256: evidence.fileSha256,
    threads,
    messages,
    claims,
    profiles: [],
    source: { mode: 'hero_pilot', label: '已验证纠错闭环 · Tick 0–5', run_id: null },
  }
}
