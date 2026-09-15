import {
  verifyForumTwinResultFileHash,
  type FormalProvenance,
  type ForumClaim,
  type ForumDisplayProfile,
  type ForumMessage,
  type ForumParallelBranch,
  type ForumThread,
  type ForumTick,
  type ForumTwinAggregateResult,
  type ForumTwinDomainResult,
  type ForumTwinLoaded,
  type ForumTwinManifest,
  type ResourcePolicyBranchSummary,
  type ResourcePolicyClosedLoop,
  type ResourcePolicyStory,
} from './forumTwin.ts'

export const RESOURCE_POLICY_RESULT_FILE = 'resource-policy-live-r1.json'
export const RESOURCE_POLICY_RESULT_HASH_FILE = 'resource-policy-live-r1.sha256'
export const RESOURCE_POLICY_RESULT_KEY = 'resource-policy-r1'

const SHA256 = /^[0-9a-f]{64}$/
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/
const BRANCHES = ['Natural', 'A', 'D'] as const
const FORBIDDEN_PUBLIC_KEYS = new Set([
  'api_key', 'password', 'secret', 'raw_prompt', 'raw_response',
  'provider_body', 'request_body', 'response_body', 'hidden_truth',
  'source_id', 'local_path', 'file_path', 'sample_identity',
])

type SourceBranch = typeof BRANCHES[number]

function fail(message: string): never {
  throw new Error(`资源分配 Hero 校验失败：${message}`)
}

function record(value: unknown, path: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} 必须是对象`)
  return value as Record<string, any>
}

function list(value: unknown, path: string): any[] {
  if (!Array.isArray(value)) fail(`${path} 必须是数组`)
  return value
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) fail(`${path} 必须是字符串`)
  return value
}

function id(value: unknown, path: string): string {
  const normalized = string(value, path)
  if (!SAFE_ID.test(normalized)) fail(`${path} 不是安全公开 ID`)
  return normalized
}

function optionalId(value: unknown, path: string): string | null {
  return value == null ? null : id(value, path)
}

function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) fail(`${path} 不是合法整数`)
  return Number(value)
}

function finite(value: unknown, path: string, min?: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path} 不是有限数字`)
  if (min !== undefined && value < min) fail(`${path} 低于下界`)
  if (max !== undefined && value > max) fail(`${path} 超过上界`)
  return value
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function auditPublic(value: unknown, path = '$result'): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => auditPublic(child, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(key.toLowerCase())) fail(`${path}.${key} 是公共禁止字段`)
    auditPublic(child, `${path}.${key}`)
  }
}

function branchId(source: SourceBranch): 'natural' | 'A' | 'D' {
  return source === 'Natural' ? 'natural' : source
}

function phase(value: unknown, path: string): ForumTick['phase'] {
  if (!['baseline', 'burst', 'spread', 'decay'].includes(String(value))) fail(`${path} 阶段非法`)
  return value as ForumTick['phase']
}

function publicAssetUrl(file: string): string {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/campus-pulse-data/${file}`
}

async function fetchText(url: string, label: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'text/plain,application/json' } })
  if (!response.ok) fail(`${label} HTTP ${response.status}`)
  return response.text()
}

function validateRoot(value: unknown): { root: Record<string, any>; result: Record<string, any> } {
  const root = record(value, '$')
  const result = record(root.result, '$.result')
  if (result.schema_version !== 'campus-pulse-resource-allocation-sandbox-result-v1') fail('结果 schema 不匹配')
  if (result.scenario_id !== 'governance_legitimacy_dispute') fail('场景不匹配')
  if (result.population_size !== 1000 || result.particle_count !== 10000) fail('人口或粒子规模不匹配')
  if (result.start_tick !== 3 || result.end_tick !== 10 || result.shared_through_tick !== 4) fail('时间合同不匹配')
  if (result.primary_slots !== 492 || result.resident_slots !== 480 || result.governance_actor_slots !== 12) fail('LLM 槽位合同不匹配')
  if (result.dynamics_public_messages !== 0 || result.scheme_bonus !== 0 || result.winner_precommitted !== false) fail('公开内容或赢家门禁不匹配')
  if (result.public_feed_mechanism !== 'global_hot_top10_plus_latest_v1' || result.public_feed_personalized !== false || result.public_feed_relationship_graph_controlled !== false) fail('公共 Feed 机制不匹配')
  if (result.worlds_share_exact_T4_checkpoint !== true) fail('共享检查点门禁未通过')
  if (root.launch?.model !== 'gpt-5.6-luna') fail('模型 provenance 不匹配')
  if (root.live_usage?.semantic_turns !== 492 || root.live_usage?.unknown_outcomes !== 0) fail('Live 用量或未知结果不匹配')
  if (!SHA256.test(String(result.result_sha256 || ''))) fail('结果 SHA-256 缺失')
  const branches = record(result.branches, '$.result.branches')
  for (const name of BRANCHES) if (!branches[name]) fail(`缺少 ${name} 分支`)
  auditPublic(result)
  return { root, result }
}

function mapMessage(value: unknown, sourceBranch: SourceBranch, scenarioId: string, path: string): ForumMessage {
  const message = record(value, path)
  const provenance = record(message.provenance, `${path}.provenance`)
  if (provenance.kind !== 'authorized_live_llm') fail(`${path} 不是授权 LLM 公开内容`)
  const rawTopic = message.topic == null ? null : string(message.topic, `${path}.topic`)
  const displayTopic = rawTopic === scenarioId || rawTopic === 'governance_legitimacy_dispute'
    ? '暑期住宿床位分配'
    : rawTopic === 'governance' ? '治理回应' : rawTopic
  const createdTick = integer(message.created_tick, `${path}.created_tick`, 0, 10)
  let interactionCounts: ForumMessage['interaction_counts'] = null
  if (message.interaction_counts != null) {
    const counts = record(message.interaction_counts, `${path}.interaction_counts`)
    if (Object.keys(counts).sort().join(',') !== 'like,report,repost') {
      fail(`${path}.interaction_counts 字段漂移`)
    }
    interactionCounts = {
      like: integer(counts.like, `${path}.interaction_counts.like`, 0),
      repost: integer(counts.repost, `${path}.interaction_counts.repost`, 0),
      report: integer(counts.report, `${path}.interaction_counts.report`, 0),
    }
  }
  const interactionCountsByTick: NonNullable<ForumMessage['interaction_counts_by_tick']> = (
    message.interaction_counts_by_tick == null
      ? []
      : list(message.interaction_counts_by_tick, `${path}.interaction_counts_by_tick`).map((value, index) => {
        const rowPath = `${path}.interaction_counts_by_tick[${index}]`
        const row = record(value, rowPath)
        if (Object.keys(row).sort().join(',') !== 'like,report,repost,tick') {
          fail(`${rowPath} 字段漂移`)
        }
        return {
          tick: integer(row.tick, `${rowPath}.tick`, createdTick, 10),
          like: integer(row.like, `${rowPath}.like`, 0),
          repost: integer(row.repost, `${rowPath}.repost`, 0),
          report: integer(row.report, `${rowPath}.report`, 0),
        }
      })
  )
  if (interactionCountsByTick.length > 0 && interactionCounts === null) {
    fail(`${path}.interaction_counts_by_tick 缺少对应累计值`)
  }
  if (interactionCountsByTick.some((row, index) => (
    index > 0 && row.tick <= interactionCountsByTick[index - 1].tick
  ))) fail(`${path}.interaction_counts_by_tick 必须按时点严格递增`)
  if (interactionCounts !== null) {
    for (const kind of ['like', 'repost', 'report'] as const) {
      if (interactionCountsByTick.length > 0 && interactionCountsByTick.reduce(
        (total, row) => total + row[kind], 0,
      ) !== interactionCounts[kind]) fail(`${path}.${kind} 互动总量不守恒`)
    }
  }
  return {
    message_id: id(message.message_id, `${path}.message_id`),
    thread_id: id(message.thread_id, `${path}.thread_id`),
    scenario_id: scenarioId,
    branch_id: branchId(sourceBranch),
    parent_message_id: optionalId(message.parent_message_id, `${path}.parent_message_id`),
    quote_message_id: optionalId(message.quote_message_id, `${path}.quote_message_id`),
    source_display_id: id(message.source_agent_display_id, `${path}.source_agent_display_id`),
    action: message.action == null ? null : string(message.action, `${path}.action`),
    visible_text: string(message.visible_text, `${path}.visible_text`),
    topic: displayTopic,
    stance: message.stance == null ? null : string(message.stance, `${path}.stance`),
    emotion: message.emotion == null ? null : string(message.emotion, `${path}.emotion`),
    evidence_status: message.evidence_status == null ? null : string(message.evidence_status, `${path}.evidence_status`),
    confidence: message.confidence == null ? null : finite(message.confidence, `${path}.confidence`, 0, 1),
    claim_ids: message.claim_id ? [id(message.claim_id, `${path}.claim_id`)] : [],
    claim_operation: message.claim_operation == null ? null : string(message.claim_operation, `${path}.claim_operation`),
    correction_target_claim_id: optionalId(message.correction_target_claim_id, `${path}.correction_target_claim_id`),
    created_tick: createdTick,
    ttl: message.ttl == null ? null : integer(message.ttl, `${path}.ttl`, 0),
    moderation_status: message.moderation_status === 'accepted' ? 'accepted' : null,
    provenance: {
      kind: 'authorized_live_llm',
      prompt_sha256: SHA256.test(String(provenance.prompt_sha256 || '')) ? provenance.prompt_sha256 : undefined,
      response_sha256: SHA256.test(String(provenance.response_sha256 || '')) ? provenance.response_sha256 : undefined,
      model: provenance.model === 'gpt-5.6-luna' ? provenance.model : 'gpt-5.6-luna',
      trace_release_sha256: null,
    },
    interaction_counts: interactionCounts,
    interaction_counts_by_tick: interactionCountsByTick,
  }
}

function mapProfile(value: unknown, path: string): ForumDisplayProfile {
  const profile = record(value, path)
  if (profile.source_profile_v2_bound !== true) fail(`${path} 未绑定 Profile v2`)
  return {
    display_id: id(profile.display_id, `${path}.display_id`),
    macro_role: string(profile.macro_role, `${path}.macro_role`),
    micro_role: string(profile.micro_role, `${path}.micro_role`),
    episode_focus: string(profile.historical_episode_focus, `${path}.historical_episode_focus`),
    topic_portfolio: list(profile.topic_portfolio, `${path}.topic_portfolio`).map((item, index) => string(item, `${path}.topic_portfolio[${index}]`)),
    need_portfolio: list(profile.need_portfolio, `${path}.need_portfolio`).map((item, index) => string(item, `${path}.need_portfolio[${index}]`)),
    interaction_style: list(profile.stable_traits, `${path}.stable_traits`).map((item, index) => string(item, `${path}.stable_traits[${index}]`)),
  }
}

function completeLoops(branch: Record<string, any>, messages: ForumMessage[]): ResourcePolicyClosedLoop[] {
  const chains = list(record(branch.mechanism_chains, '$branch.mechanism_chains').help_service_feedback_chains, '$branch.help_service_feedback_chains')
  const byId = new Map(messages.map((message) => [message.message_id, message]))
  return chains.filter((item) => item?.complete === true).map((item, index) => {
    const chain = record(item, `$branch.help_service_feedback_chains[${index}]`)
    const helpMessageId = id(chain.help_message_id, '$chain.help_message_id')
    const receiptMessageId = id(chain.service_receipt_id, '$chain.service_receipt_id')
    const followUpMessageId = id(chain.follow_up_id, '$chain.follow_up_id')
    const help = byId.get(helpMessageId)
    const receipt = byId.get(receiptMessageId)
    const followUp = byId.get(followUpMessageId)
    if (!help || !receipt || !followUp) fail('完整服务闭环引用了缺失消息')
    return {
      helpMessageId,
      receiptMessageId,
      followUpMessageId,
      helpText: help.visible_text,
      receiptText: receipt.visible_text,
      followUpText: followUp.visible_text,
    }
  })
}

function mapBranch(
  rawBranch: unknown,
  sourceBranch: SourceBranch,
  scenarioId: string,
): {
  parallel: ForumParallelBranch
  messages: ForumMessage[]
  threads: ForumThread[]
  claims: ForumClaim[]
  profiles: ForumDisplayProfile[]
  summary: ResourcePolicyBranchSummary
  rounds: any[]
  uptakeChains: any[]
  helpLoops: ResourcePolicyClosedLoop[]
  artifacts: any[]
} {
  const branch = record(rawBranch, `$.result.branches.${sourceBranch}`)
  if (branch.emulator_public_messages !== 0) fail(`${sourceBranch} 含 emulator 公开内容`)
  const messages = list(branch.messages, `$branch.${sourceBranch}.messages`).map((item, index) => (
    mapMessage(item, sourceBranch, scenarioId, `$branch.${sourceBranch}.messages[${index}]`)
  ))
  const messageIds = new Set(messages.map((message) => message.message_id))
  if (messageIds.size !== messages.length) fail(`${sourceBranch} 消息 ID 重复`)
  const threads = list(branch.threads, `$branch.${sourceBranch}.threads`).map((value, index): ForumThread => {
    const thread = record(value, `$branch.${sourceBranch}.threads[${index}]`)
    const threadId = id(thread.thread_id, '$thread.thread_id')
    const rawTopic = string(thread.topic, '$thread.topic')
    const rawNeed = string(thread.need, '$thread.need')
    const isGovernanceThread = rawTopic === 'governance' || rawNeed === 'public_governance_update'
    const displayTopic = isGovernanceThread
      ? '治理公开回应'
      : rawTopic === scenarioId || rawTopic === 'governance_legitimacy_dispute'
        ? (rawNeed === scenarioId || rawNeed === 'governance_legitimacy_dispute' ? '住宿分配争议' : rawNeed)
        : rawTopic
    const displayNeed = isGovernanceThread ? '证据说明、复核工单与服务信息' : '暑期住宿床位分配'
    const related = messages.filter((message) => message.thread_id === threadId)
    const rootMessageId = id(thread.root_message_id, '$thread.root_message_id')
    if (!related.some((message) => message.message_id === rootMessageId)) fail(`${threadId} 缺少根帖`)
    return {
      thread_id: threadId,
      board: string(thread.board, '$thread.board'),
      root_message_id: rootMessageId,
      scenario_id: scenarioId,
      branch_id: branchId(sourceBranch),
      created_tick: integer(thread.created_tick, '$thread.created_tick', 0, 10),
      status: ['open', 'closed', 'archived'].includes(thread.status) ? thread.status : fail('$thread.status 非法'),
      topic: displayTopic,
      need: displayNeed,
      claim_ids: list(thread.claim_ids, '$thread.claim_ids').map((item, claimIndex) => id(item, `$thread.claim_ids[${claimIndex}]`)),
      participant_count: integer(thread.participant_count, '$thread.participant_count', 0),
      reply_count: integer(thread.reply_count, '$thread.reply_count', 0),
      last_active_tick: thread.last_active_tick == null ? null : integer(thread.last_active_tick, '$thread.last_active_tick', 0, 10),
      provenance_kind: 'authorized_live_llm',
      message_ids: related.map((message) => message.message_id),
    }
  })
  const threadById = new Map(threads.map((thread) => [thread.thread_id, thread]))
  const claims = list(branch.claims, `$branch.${sourceBranch}.claims`).map((value, index): ForumClaim => {
    const claim = record(value, `$branch.${sourceBranch}.claims[${index}]`)
    const claimId = id(claim.claim_id, '$claim.claim_id')
    const threadId = id(claim.thread_id, '$claim.thread_id')
    const thread = threadById.get(threadId)
    if (!thread) fail(`${claimId} 引用了缺失讨论串`)
    const related = messages.filter((message) => message.thread_id === threadId && message.claim_ids.includes(claimId))
    return {
      claim_id: claimId,
      thread_id: threadId,
      created_by_message_id: related[0]?.message_id || thread.root_message_id,
      parent_claim_id: optionalId(claim.parent_claim_id, '$claim.parent_claim_id'),
      scenario_id: scenarioId,
      branch_id: branchId(sourceBranch),
      summary: string(claim.claim_summary, '$claim.claim_summary'),
      status: string(claim.status, '$claim.status'),
      first_seen_tick: integer(claim.first_seen_tick, '$claim.first_seen_tick', 0, 10),
      last_seen_tick: integer(claim.last_seen_tick, '$claim.last_seen_tick', 0, 10),
      supporting_message_ids: related.map((message) => message.message_id),
      challenging_message_ids: [],
      correction_target_claim_id: optionalId(claim.correction_target_claim_id, '$claim.correction_target_claim_id'),
      evidence_reference: null,
    }
  })
  const rounds = list(branch.governance_rounds, `$branch.${sourceBranch}.governance_rounds`)
  const roundsByTick = new Map(rounds.map((item) => [integer(item.tick, '$round.tick', 0, 10), item]))
  const rawTimeline = list(branch.timeline, `$branch.${sourceBranch}.timeline`)
  const timeline = rawTimeline.map((value, index): ForumTick => {
    const item = record(value, `$branch.${sourceBranch}.timeline[${index}]`)
    const tick = integer(item.tick, '$timeline.tick', 0, 10)
    const atTick = messages.filter((message) => message.created_tick === tick)
    const round = roundsByTick.get(tick)
    const decisionSummary: Record<string, unknown> = {}
    if (round) {
      for (const decision of list(round.decisions, '$round.decisions')) {
        const selected = string(decision.selected_action, '$decision.selected_action')
        const probability = numberOrNull(decision.selection_probability)
        decisionSummary[string(decision.actor, '$decision.actor')] = probability == null
          ? selected : `${selected} · ${(probability * 100).toFixed(1)}%`
      }
      const resources = record(round.resource_after, '$round.resource_after')
      decisionSummary.resource = `committed ${resources.committed} · remaining ${resources.remaining}`
      decisionSummary.conserved = resources.conserved === true
    }
    const recovery = item.population_recovery && typeof item.population_recovery === 'object'
      ? item.population_recovery as Record<string, any> : {}
    const kish = numberOrNull(recovery?.pps_population_recovery?.action_greg?.kish_ess) ?? 0
    const metrics = item.population_state && typeof item.population_state === 'object'
      ? { ...item.population_state } : {}
    return {
      tick,
      phase: phase(item.phase, '$timeline.phase'),
      active_thread_ids: threads.filter((thread) => thread.created_tick <= tick).map((thread) => thread.thread_id),
      activated_residents: integer(item.resident_llm_activations ?? 0, '$timeline.resident_llm_activations', 0, 64),
      activated_governance: integer(item.governance_llm_activations ?? 0, '$timeline.governance_llm_activations', 0, 3),
      public_message_count: integer(item.message_count, '$timeline.message_count', 0),
      claim_count: integer(item.claim_count, '$timeline.claim_count', 0),
      correction_count: integer(item.correction_count ?? atTick.filter((message) => message.action === 'correct').length, '$timeline.correction_count', 0),
      help_request_count: integer(item.help_request_count ?? atTick.filter((message) => message.action === 'seek_help').length, '$timeline.help_request_count', 0),
      pps_kish_ess: kish,
      metrics,
      governance_observation: round ? { finite_observation: true, uses_hidden_truth: round.uses_hidden_truth === true } : {},
      governance_decision: decisionSummary,
      particle_summary: metrics,
    }
  })
  const ticks = timeline.map((item) => item.tick)
  if (ticks.length !== 11 || ticks.some((tick, index) => tick !== index)) fail(`${sourceBranch} timeline 必须完整覆盖 Tick 0–10`)
  const profiles = list(branch.public_display_profiles, `$branch.${sourceBranch}.public_display_profiles`).map((item, index) => mapProfile(item, `$profile[${index}]`))
  const artifacts = list(branch.governance_artifacts, `$branch.${sourceBranch}.governance_artifacts`)
  const mechanisms = record(branch.mechanism_chains, `$branch.${sourceBranch}.mechanism_chains`)
  const uptakeChains = list(mechanisms.governance_uptake_chains, '$mechanisms.governance_uptake_chains')
  const helpLoops = completeLoops(branch, messages)
  const final = record(rawTimeline.at(-1), '$timeline.final')
  const state = record(final.population_state, '$timeline.final.population_state')
  const actionCount = (action: string) => messages.filter((message) => message.action === action).length
  const kindCount = (kind: string) => artifacts.filter((artifact) => artifact?.artifact_kind === kind).length
  const summary: ResourcePolicyBranchSummary = {
    branch: branchId(sourceBranch),
    label: string(branch.world_label, '$branch.world_label'),
    messages: integer(final.message_count, '$timeline.final.message_count', 0),
    helpRequests: integer(final.help_request_count ?? actionCount('seek_help'), '$timeline.final.help_request_count', 0),
    riskReports: integer(final.risk_report_count ?? actionCount('report_risk'), '$timeline.final.risk_report_count', 0),
    governanceUptake: uptakeChains.filter((chain) => chain?.complete === true).length,
    serviceClosures: helpLoops.length,
    evidenceCards: kindCount('evidence_card'),
    serviceTickets: kindCount('service_ticket'),
    outreachObjects: kindCount('cross_group_outreach'),
    trust: numberOrNull(state.trust),
    concern: numberOrNull(state.concern),
    satisfaction: numberOrNull(state.satisfaction),
  }
  return {
    parallel: { timeline, featured_thread_ids: threads.map((thread) => thread.thread_id) },
    messages, threads, claims, profiles, summary, rounds, uptakeChains, helpLoops, artifacts,
  }
}

export async function loadResourcePolicyHero(): Promise<ForumTwinLoaded> {
  const [rawText, expectedHash] = await Promise.all([
    fetchText(publicAssetUrl(RESOURCE_POLICY_RESULT_FILE), '资源分配结果'),
    fetchText(publicAssetUrl(RESOURCE_POLICY_RESULT_HASH_FILE), '资源分配结果哈希'),
  ])
  const digest = await verifyForumTwinResultFileHash(rawText, expectedHash.trim().toLowerCase())
  const { root, result } = validateRoot(JSON.parse(rawText))
  const scenarioId = id(result.scenario_id, '$.result.scenario_id')
  const mapped = Object.fromEntries(BRANCHES.map((name) => [name, mapBranch(result.branches[name], name, scenarioId)])) as Record<SourceBranch, ReturnType<typeof mapBranch>>
  const allMessages = BRANCHES.flatMap((name) => mapped[name].messages)
  const allThreads = BRANCHES.flatMap((name) => mapped[name].threads)
  const threadBranches = new Map<string, Set<ForumThread['branch_id']>>()
  allThreads.forEach((thread) => {
    const branches = threadBranches.get(thread.thread_id) || new Set<ForumThread['branch_id']>()
    branches.add(thread.branch_id)
    threadBranches.set(thread.thread_id, branches)
  })
  allThreads.forEach((thread) => {
    if ((threadBranches.get(thread.thread_id)?.size || 0) > 1) thread.mapped_counterpart_thread_id = thread.thread_id
  })
  const allClaims = BRANCHES.flatMap((name) => mapped[name].claims)
  const profilesById = new Map<string, ForumDisplayProfile>()
  BRANCHES.flatMap((name) => mapped[name].profiles).forEach((profile) => profilesById.set(profile.display_id, profile))
  const governanceRounds = mapped.D.rounds.map((round) => ({
    tick: round.tick,
    decisions: list(round.decisions, '$round.decisions').map((decision) => ({
      actor: decision.actor,
      selected_action: decision.selected_action,
      selection_probability: decision.selection_probability,
    })),
  }))
  const governanceUptakeChains = mapped.D.uptakeChains.map((chain) => ({
    governance_message_id: chain.governance_message_id,
    complete: chain.complete === true,
    resident_response_ids: Array.isArray(chain.resident_response_ids) ? chain.resident_response_ids : [],
  }))
  const domain: ForumTwinDomainResult = {
    schema_version: 'campus-pulse-resource-policy-showcase-domain-v1',
    scenarios: [{
      scenario_id: scenarioId,
      label: string(result.scenario_title, '$.result.scenario_title'),
      description: '两栋宿舍翻修导致暑期床位骤减；同一批合成 LLM Agent 在共享论坛历史后进入不回应、只解释、解释加服务闭环三个平行世界。',
    }],
    parallel_forums: {
      [scenarioId]: {
        natural: mapped.Natural.parallel,
        A: mapped.A.parallel,
        D: mapped.D.parallel,
      },
    },
    public_threads: allThreads,
    public_messages: allMessages,
    claims: allClaims,
    governance: {
      governance_rounds: governanceRounds,
      governance_uptake_chains: governanceUptakeChains,
      help_service_feedback_chains: mapped.D.helpLoops,
      branch_A_rounds: mapped.A.rounds,
      branch_A_artifacts: mapped.A.artifacts,
      branch_D_artifacts: mapped.D.artifacts,
    },
    sampling: {
      anchors: 16,
      pps_budget: 4,
      scheduler_recall: 1,
      kish_ess_range: [0, 4],
      unique_activated_agents: Math.max(...BRANCHES.map((name) => Number(result.branches[name].unique_activated_agents || 0))),
    },
    intervals: {},
    llm_usage: {
      resident_turns: integer(result.resident_slots, '$.result.resident_slots', 0),
      governance_turns: integer(result.governance_actor_slots, '$.result.governance_actor_slots', 0),
      live_provider_turns: integer(root.live_usage.semantic_turns, '$.live_usage.semantic_turns', 0),
      trace_replay_turns: integer(root.live_usage.cache_hits, '$.live_usage.cache_hits', 0),
      cache_turns: integer(root.live_usage.cache_hits, '$.live_usage.cache_hits', 0),
      provider_calls: integer(root.live_usage.provider_calls, '$.live_usage.provider_calls', 0),
      provider_tokens: integer(root.live_usage.provider_tokens, '$.live_usage.provider_tokens', 0),
      max_resident_activation: integer(result.resident_budget_per_tick, '$.result.resident_budget_per_tick', 0, 64),
      max_total_activation: integer(result.resident_budget_per_tick, '$.result.resident_budget_per_tick', 0, 64) + 3,
    },
    ecology_validation: { status: 'profile_v2_bound', public_feed_mechanism: result.public_feed_mechanism },
    ablations: { status: 'not_part_of_this_hero' },
    hero_gates: {
      disclosure: '单场景、单固定随机种子、Tick 3–10 的真实 LLM 治理预演；不代表现实政策因果效果或全校民意。',
      shared_through_tick: result.shared_through_tick,
      all_public_content_live_llm: true,
      dynamics_public_messages: result.dynamics_public_messages,
    },
    audit: {
      llm_agent_count: result.population_size,
      particle_count: result.particle_count,
      emulator_public_messages: result.dynamics_public_messages,
      real_governance_actions: 0,
      public_display_profiles: [...profilesById.values()],
    },
  }
  const story: ResourcePolicyStory = {
    schemaVersion: 'campus-pulse-resource-policy-story-v1',
    scenarioFacts: {
      renovatedDormitories: 2,
      bedsBefore: 520,
      bedsAfter: 320,
      validApplications: 536,
      announcementGaps: ['类别间与同类内排序', '材料复核责任人', '申诉入口', '答复时限'],
    },
    branchSummaries: BRANCHES.map((name) => mapped[name].summary),
    closedLoops: mapped.D.helpLoops,
    feedMechanism: result.public_feed_mechanism,
    sharedThroughTick: result.shared_through_tick,
    providerModel: root.launch.model,
    providerCalls: root.live_usage.provider_calls,
    providerTokens: root.live_usage.provider_tokens,
    semanticTurns: root.live_usage.semantic_turns,
    formatRepairs: root.live_usage.format_repairs,
    unknownOutcomes: root.live_usage.unknown_outcomes,
    resultSha256: result.result_sha256,
    primaryFinding: '只解释标准产生了证据卡，却没有一条治理消息被居民直接承接；加入复核工单后出现两条严格服务闭环，但信任没有随之上升，因为稀缺与未完成处理被看得更清楚。',
  }
  const execution = 'authorized_live_llm' as FormalProvenance
  const aggregate: ForumTwinAggregateResult = {
    schema_version: 'campus-pulse-resource-allocation-sandbox-result-v1',
    run_id: string(root.authorization?.run_id || 'resource_policy_live_r1', '$.authorization.run_id'),
    launch_fingerprint: string(root.authorization_fingerprint, '$.authorization_fingerprint'),
    result_kind: 'llm_forum_twin_resource_policy_hero',
    plan_sha256: string(root.authorization?.plan_sha256 || result.profile_release_sha256, '$.authorization.plan_sha256'),
    execution_provenance: execution,
    publication_eligible: false,
    domain_result: domain as unknown as Record<string, unknown>,
    visualization_asset: {
      schema_version: 'campus-pulse-resource-policy-showcase-v1',
      manifest_sha256: digest,
      domain_result_sha256: result.result_sha256,
      public_forum_sha256: digest,
    },
    completeness: { status: 'pilot', completed_primary_slots: result.primary_slots, required_primary_slots: result.primary_slots },
    budget_usage: root.live_usage,
    usage: result.usage,
    privacy: { scan_passed: true },
    non_claims: list(result.non_claims, '$.result.non_claims').map((item, index) => string(item, `$.result.non_claims[${index}]`)),
    result_sha256: result.result_sha256,
  }
  const manifest: ForumTwinManifest = {
    schema_version: 'campus-pulse-forum-twin-visualization-v4',
    run_id: aggregate.run_id,
    result_sha256: result.result_sha256,
    domain_result_sha256: result.result_sha256,
    public_forum_sha256: digest,
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
    threads: allThreads,
    messages: allMessages,
    claims: allClaims,
    profiles: [...profilesById.values()],
    resourcePolicy: story,
    source: { mode: 'hero_pilot', label: '真实 LLM 资源分配路演运行 · Tick 3–10', run_id: aggregate.run_id },
  }
}
