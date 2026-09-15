import {
  verifyForumTwinResultFileHash,
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
} from './forumTwin.ts'

export const LECTURE_HERO_RESULT_FILE = 'lecture-open-choice-r4.json'
export const LECTURE_HERO_RESULT_HASH_FILE = 'lecture-open-choice-r4.sha256'

const SHA256 = /^[0-9a-f]{64}$/
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/
const BRANCHES = ['Natural', 'D'] as const
type SourceBranch = typeof BRANCHES[number]

const FORBIDDEN_PUBLIC_KEYS = new Set([
  'api_key', 'password', 'secret', 'raw_prompt', 'raw_response', 'provider_body',
  'request_body', 'response_body', 'hidden_truth', 'source_id', 'local_path',
  'file_path', 'sample_identity',
])

function fail(message: string): never {
  throw new Error(`讲座 Hero 校验失败：${message}`)
}

function record(value: unknown, path: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} 必须是对象`)
  return value as Record<string, any>
}

function list(value: unknown, path: string): any[] {
  if (!Array.isArray(value)) fail(`${path} 必须是数组`)
  return value
}

function text(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) fail(`${path} 必须是字符串`)
  return value
}

function identifier(value: unknown, path: string): string {
  const valueText = text(value, path)
  if (!SAFE_ID.test(valueText)) fail(`${path} 不是安全公开 ID`)
  return valueText
}

function optionalIdentifier(value: unknown, path: string): string | null {
  return value == null ? null : identifier(value, path)
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

function numericRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])))
}

function auditPublic(value: unknown, path = '$.result'): void {
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
  const usage = record(root.live_usage, '$.live_usage')
  if (result.schema_version !== 'campus-pulse-forum-hero-result-v1') fail('结果 schema 不匹配')
  if (result.scenario_id !== 'lecture_external_incident_shock') fail('场景不匹配')
  if (result.population_size !== 1000 || result.particle_count !== 10000) fail('人口或粒子规模不匹配')
  if (result.start_tick !== 3 || result.end_tick !== 10) fail('时间合同不匹配')
  if (JSON.stringify(result.branches_executed) !== JSON.stringify(BRANCHES)) fail('Natural/D 分支合同不匹配')
  if (result.dynamics_public_messages !== 0 || result.emulator_public_messages !== 0) fail('后台模型生成了公开内容')
  if (result.public_feed_mechanism !== 'global_hot_top10_plus_latest_v1') fail('公共 Feed 机制不匹配')
  if (result.forum_feed_graph_controlled !== false || result.targeted_capability_panel_used !== false) fail('公开排序或定向能力面板合同漂移')
  if (root.launch?.model !== 'gpt-5.6-luna') fail('模型 provenance 不匹配')
  if (usage.semantic_turns !== 390 || usage.unknown_outcomes !== 0) fail('Live 槽位或未知结果不匹配')
  if (!SHA256.test(String(result.result_sha256 || ''))) fail('结果 SHA-256 缺失')
  const branches = record(result.branches, '$.result.branches')
  for (const branch of BRANCHES) if (!branches[branch]) fail(`缺少 ${branch} 分支`)
  auditPublic(result)
  return { root, result }
}

function branchId(branch: SourceBranch): 'natural' | 'D' {
  return branch === 'Natural' ? 'natural' : 'D'
}

function mapMessage(value: unknown, branch: SourceBranch, scenarioId: string, path: string): ForumMessage {
  const message = record(value, path)
  const provenance = record(message.provenance, `${path}.provenance`)
  if (provenance.kind !== 'authorized_live_llm' || provenance.model !== 'gpt-5.6-luna') {
    fail(`${path} 不是 gpt-5.6-luna 授权公开内容`)
  }
  const createdTick = integer(message.created_tick, `${path}.created_tick`, 3, 10)
  const interaction = message.interaction_counts == null
    ? null
    : {
        like: integer(message.interaction_counts.like, `${path}.interaction_counts.like`),
        repost: integer(message.interaction_counts.repost, `${path}.interaction_counts.repost`),
        report: integer(message.interaction_counts.report, `${path}.interaction_counts.report`),
      }
  const byTick = message.interaction_counts_by_tick == null
    ? []
    : list(message.interaction_counts_by_tick, `${path}.interaction_counts_by_tick`).map((row, index) => ({
        tick: integer(row.tick, `${path}.interaction_counts_by_tick[${index}].tick`, createdTick, 10),
        like: integer(row.like, `${path}.interaction_counts_by_tick[${index}].like`),
        repost: integer(row.repost, `${path}.interaction_counts_by_tick[${index}].repost`),
        report: integer(row.report, `${path}.interaction_counts_by_tick[${index}].report`),
      }))
  if (interaction && byTick.length) {
    for (const key of ['like', 'repost', 'report'] as const) {
      if (byTick.reduce((total, row) => total + row[key], 0) !== interaction[key]) fail(`${path}.${key} 互动总量不守恒`)
    }
  }
  return {
    message_id: identifier(message.message_id, `${path}.message_id`),
    thread_id: identifier(message.thread_id, `${path}.thread_id`),
    scenario_id: scenarioId,
    branch_id: branchId(branch),
    parent_message_id: optionalIdentifier(message.parent_message_id, `${path}.parent_message_id`),
    quote_message_id: optionalIdentifier(message.quote_message_id, `${path}.quote_message_id`),
    source_display_id: identifier(message.source_agent_display_id, `${path}.source_agent_display_id`),
    action: message.action == null ? null : text(message.action, `${path}.action`),
    visible_text: text(message.visible_text, `${path}.visible_text`),
    topic: message.topic == null ? null : text(message.topic, `${path}.topic`),
    stance: message.stance == null ? null : text(message.stance, `${path}.stance`),
    emotion: message.emotion == null ? null : text(message.emotion, `${path}.emotion`),
    evidence_status: message.evidence_status == null ? null : text(message.evidence_status, `${path}.evidence_status`),
    confidence: message.confidence == null ? null : finite(message.confidence, `${path}.confidence`, 0, 1),
    claim_ids: message.claim_id == null ? [] : [identifier(message.claim_id, `${path}.claim_id`)],
    claim_operation: message.claim_operation == null ? null : text(message.claim_operation, `${path}.claim_operation`),
    correction_target_claim_id: optionalIdentifier(message.correction_target_claim_id, `${path}.correction_target_claim_id`),
    created_tick: createdTick,
    ttl: message.ttl == null ? null : integer(message.ttl, `${path}.ttl`),
    moderation_status: message.moderation_status === 'accepted' ? 'accepted' : null,
    provenance: {
      kind: 'authorized_live_llm',
      prompt_sha256: SHA256.test(String(provenance.prompt_sha256 || '')) ? provenance.prompt_sha256 : undefined,
      response_sha256: SHA256.test(String(provenance.response_sha256 || '')) ? provenance.response_sha256 : undefined,
      model: 'gpt-5.6-luna',
      trace_release_sha256: null,
    },
    interaction_counts: interaction,
    interaction_counts_by_tick: byTick,
    memory_summary: typeof message.memory_summary === 'string' ? message.memory_summary : undefined,
    decision_reason_tags: Array.isArray(message.decision_reason_tags)
      ? message.decision_reason_tags.filter((item: unknown): item is string => typeof item === 'string')
      : undefined,
  }
}

function mapProfile(value: unknown, path: string): ForumDisplayProfile {
  const profile = record(value, path)
  const language = profile.language_style && typeof profile.language_style === 'object'
    ? profile.language_style as Record<string, unknown>
    : {}
  return {
    display_id: identifier(profile.display_id, `${path}.display_id`),
    macro_role: text(profile.macro_role, `${path}.macro_role`),
    micro_role: text(profile.micro_role, `${path}.micro_role`),
    episode_focus: text(profile.historical_episode_focus, `${path}.historical_episode_focus`),
    topic_portfolio: list(profile.topic_portfolio || [], `${path}.topic_portfolio`).filter((item): item is string => typeof item === 'string'),
    need_portfolio: list(profile.need_portfolio || [], `${path}.need_portfolio`).filter((item): item is string => typeof item === 'string'),
    interaction_style: Array.isArray(language.tendencies)
      ? language.tendencies.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

function mapBranch(value: unknown, branch: SourceBranch, scenarioId: string) {
  const source = record(value, `$.result.branches.${branch}`)
  const messages = list(source.messages, `$.result.branches.${branch}.messages`)
    .map((message, index) => mapMessage(message, branch, scenarioId, `$message.${branch}[${index}]`))
  const messagesByThread = new Map<string, string[]>()
  messages.forEach((message) => messagesByThread.set(message.thread_id, [...(messagesByThread.get(message.thread_id) || []), message.message_id]))
  const threads: ForumThread[] = list(source.threads, `$.result.branches.${branch}.threads`).map((value, index) => {
    const thread = record(value, `$thread.${branch}[${index}]`)
    return {
      thread_id: identifier(thread.thread_id, `$thread.${branch}[${index}].thread_id`),
      board: text(thread.board, `$thread.${branch}[${index}].board`),
      root_message_id: identifier(thread.root_message_id, `$thread.${branch}[${index}].root_message_id`),
      scenario_id: scenarioId,
      branch_id: branchId(branch),
      created_tick: integer(thread.created_tick, `$thread.${branch}[${index}].created_tick`, 3, 10),
      status: ['open', 'closed', 'archived'].includes(thread.status) ? thread.status : 'open',
      topic: text(thread.topic, `$thread.${branch}[${index}].topic`),
      need: text(thread.need, `$thread.${branch}[${index}].need`),
      claim_ids: list(thread.claim_ids || [], `$thread.${branch}[${index}].claim_ids`).map((idValue, claimIndex) => identifier(idValue, `$thread.${branch}[${index}].claim_ids[${claimIndex}]`)),
      participant_count: integer(thread.participant_count, `$thread.${branch}[${index}].participant_count`),
      reply_count: integer(thread.reply_count, `$thread.${branch}[${index}].reply_count`),
      last_active_tick: thread.last_active_tick == null ? null : integer(thread.last_active_tick, `$thread.${branch}[${index}].last_active_tick`, 3, 10),
      provenance_kind: 'authorized_live_llm',
      message_ids: messagesByThread.get(thread.thread_id) || [],
    }
  })
  const threadMap = new Map(threads.map((thread) => [thread.thread_id, thread]))
  const claims: ForumClaim[] = list(source.claims, `$.result.branches.${branch}.claims`).map((value, index) => {
    const claim = record(value, `$claim.${branch}[${index}]`)
    const claimId = identifier(claim.claim_id, `$claim.${branch}[${index}].claim_id`)
    const threadId = identifier(claim.thread_id, `$claim.${branch}[${index}].thread_id`)
    if (!threadMap.has(threadId)) fail(`Claim ${claimId} 引用了不存在的讨论串`)
    const claimMessages = messages.filter((message) => message.claim_ids.includes(claimId))
    const creator = claimMessages.sort((left, right) => left.created_tick - right.created_tick)[0]
    return {
      claim_id: claimId,
      thread_id: threadId,
      created_by_message_id: creator?.message_id || threadMap.get(threadId)!.root_message_id,
      parent_claim_id: optionalIdentifier(claim.parent_claim_id, `$claim.${branch}[${index}].parent_claim_id`),
      scenario_id: scenarioId,
      branch_id: branchId(branch),
      summary: text(claim.claim_summary, `$claim.${branch}[${index}].claim_summary`),
      status: text(claim.status, `$claim.${branch}[${index}].status`),
      first_seen_tick: integer(claim.first_seen_tick, `$claim.${branch}[${index}].first_seen_tick`, 3, 10),
      last_seen_tick: integer(claim.last_seen_tick, `$claim.${branch}[${index}].last_seen_tick`, 3, 10),
      supporting_message_ids: claimMessages.filter((message) => !['challenge', 'correct'].includes(message.claim_operation || '')).map((message) => message.message_id),
      challenging_message_ids: claimMessages.filter((message) => ['challenge', 'correct'].includes(message.claim_operation || '')).map((message) => message.message_id),
      correction_target_claim_id: optionalIdentifier(claim.correction_target_claim_id, `$claim.${branch}[${index}].correction_target_claim_id`),
      evidence_reference: null,
    }
  })
  const rounds = list(source.governance_rounds || [], `$.result.branches.${branch}.governance_rounds`)
  const roundByTick = new Map(rounds.map((round) => [Number(round.tick), round]))
  const timeline: ForumTick[] = list(source.timeline, `$.result.branches.${branch}.timeline`).map((value, index) => {
    const row = record(value, `$timeline.${branch}[${index}]`)
    const tick = integer(row.tick, `$timeline.${branch}[${index}].tick`, 0, 10)
    const phaseValue = ['baseline', 'burst', 'spread', 'decay'].includes(row.phase) ? row.phase : fail(`T${tick} 阶段非法`)
    const pps = row.pps_population_recovery && typeof row.pps_population_recovery === 'object' ? row.pps_population_recovery : {}
    const round = roundByTick.get(tick)
    const decisions = Array.isArray(round?.decisions) ? round.decisions : []
    const governanceDecision = Object.fromEntries(decisions.map((decision: Record<string, unknown>) => [String(decision.actor), String(decision.selected_action)]))
    return {
      tick,
      phase: phaseValue,
      active_thread_ids: threads.filter((thread) => thread.created_tick <= tick).map((thread) => thread.thread_id),
      activated_residents: Number(row.resident_llm_activations || 0),
      activated_governance: Number(row.governance_llm_activations || 0),
      public_message_count: integer(row.message_count, `$timeline.${branch}[${index}].message_count`),
      claim_count: integer(row.claim_count, `$timeline.${branch}[${index}].claim_count`),
      correction_count: integer(row.correction_count || 0, `$timeline.${branch}[${index}].correction_count`),
      help_request_count: integer(row.help_request_count || 0, `$timeline.${branch}[${index}].help_request_count`),
      pps_kish_ess: typeof pps.partial_pooling?.kish_ess === 'number' ? pps.partial_pooling.kish_ess : 0,
      metrics: { ...numericRecord(row.population_state), ...numericRecord(row.interaction_counts) },
      governance_observation: round ? { finite_observation: true, uses_hidden_truth: round.uses_hidden_truth === true } : {},
      governance_decision: governanceDecision,
      particle_summary: numericRecord(row.population_state),
    }
  })
  if (timeline.length !== 11 || timeline.some((row, index) => row.tick !== index)) fail(`${branch} 时间轴必须完整覆盖 Tick 0–10`)
  return {
    parallel: { timeline, featured_thread_ids: threads.map((thread) => thread.thread_id) } as ForumParallelBranch,
    messages,
    threads,
    claims,
    profiles: list(source.public_display_profiles, `$.result.branches.${branch}.public_display_profiles`)
      .map((profile, index) => mapProfile(profile, `$profile.${branch}[${index}]`)),
    rounds,
    artifacts: list(source.governance_artifacts || [], `$.result.branches.${branch}.governance_artifacts`),
    mechanisms: record(source.mechanism_chains || {}, `$.result.branches.${branch}.mechanism_chains`),
  }
}

export async function loadLectureHero(): Promise<ForumTwinLoaded> {
  const [rawText, expectedHash] = await Promise.all([
    fetchText(publicAssetUrl(LECTURE_HERO_RESULT_FILE), '讲座结果'),
    fetchText(publicAssetUrl(LECTURE_HERO_RESULT_HASH_FILE), '讲座结果哈希'),
  ])
  const digest = await verifyForumTwinResultFileHash(rawText, expectedHash.trim().toLowerCase())
  const { root, result } = validateRoot(JSON.parse(rawText))
  const scenarioId = result.scenario_id as string
  const natural = mapBranch(result.branches.Natural, 'Natural', scenarioId)
  const intervention = mapBranch(result.branches.D, 'D', scenarioId)
  const allMessages = [...natural.messages, ...intervention.messages]
  const allThreads = [...natural.threads, ...intervention.threads]
  const allClaims = [...natural.claims, ...intervention.claims]
  const profiles = [...new Map([...natural.profiles, ...intervention.profiles].map((profile) => [profile.display_id, profile])).values()]
  const governanceTurns = intervention.rounds.reduce((total, round) => total + (Array.isArray(round.decisions) ? round.decisions.length : 0), 0)
  const usage = root.live_usage as Record<string, number>
  const uptake = Array.isArray(intervention.mechanisms.governance_uptake_chains)
    ? intervention.mechanisms.governance_uptake_chains
    : []
  const rounds = intervention.rounds
  const domain: ForumTwinDomainResult = {
    schema_version: 'campus-pulse-forum-twin-result-v6',
    scenarios: [{
      scenario_id: scenarioId,
      label: '讲座辱骂事件后的校园治理回应',
      description: '校外讲者在校园讲座中被确认辱骂学生并公开道歉；平行论坛比较不追加治理回应与有限观测下的证据卡、支持渠道和跨群触达。',
    }],
    parallel_forums: { [scenarioId]: { natural: natural.parallel, D: intervention.parallel } },
    public_threads: allThreads,
    public_messages: allMessages,
    claims: allClaims,
    governance: {
      governance_rounds: rounds,
      governance_uptake_chains: uptake,
      correction_chains: Array.isArray(intervention.mechanisms.correction_chains)
        ? intervention.mechanisms.correction_chains : [],
      help_service_feedback_chains: Array.isArray(intervention.mechanisms.help_service_feedback_chains)
        ? intervention.mechanisms.help_service_feedback_chains : [],
    },
    sampling: {
      anchors: Number(result.anchor_count || 16),
      pps_budget: 32,
      scheduler_recall: 1,
      kish_ess_range: [0, 32],
      unique_activated_agents: Number(result.unique_activated_agents_across_branches || 0),
    },
    intervals: {},
    llm_usage: {
      resident_turns: Number(usage.semantic_turns || 0) - governanceTurns,
      governance_turns: governanceTurns,
      live_provider_turns: Number(usage.semantic_turns || 0),
      trace_replay_turns: Number(usage.cache_hits || 0),
      cache_turns: Number(usage.cache_hits || 0),
      provider_calls: Number(usage.provider_calls || 0),
      provider_tokens: Number(usage.provider_tokens || 0),
      max_resident_activation: 48,
      max_total_activation: 51,
    },
    ecology_validation: { status: 'profile_v2_bound', public_feed_mechanism: result.public_feed_mechanism },
    ablations: { status: 'not_part_of_this_pilot' },
    hero_gates: {
      status: 'reviewed_open_choice_pilot',
      disclosure: '真实 LLM 开放选择运行；D 形成 4 条居民对治理消息的严格直接承接，但没有形成完整纠错接受链或求助服务闭环。',
      governance_uptake_total_chains: uptake.length,
      governance_uptake_complete_chains: uptake.filter((chain: any) => chain.complete === true).length,
    },
    audit: {
      llm_agent_count: 1000,
      particle_count: 10000,
      emulator_public_messages: 0,
      real_governance_actions: Number(result.real_governance_actions || 0),
      public_display_profiles: profiles,
    },
  }
  const resultSha = result.result_sha256 as string
  const runId = String(root.authorization?.run_id || 'lecture_open_choice_r4')
  const aggregate: ForumTwinAggregateResult = {
    schema_version: 'campus-pulse-live-aggregate-result-v6',
    run_id: runId,
    launch_fingerprint: String(root.authorization_fingerprint || resultSha),
    result_kind: 'llm_forum_twin_hero_pilot',
    plan_sha256: String(root.authorization?.plan_sha256 || resultSha),
    execution_provenance: 'authorized_live_llm',
    publication_eligible: false,
    domain_result: domain as unknown as Record<string, unknown>,
    visualization_asset: {
      schema_version: 'campus-pulse-forum-twin-visualization-v4',
      manifest_sha256: digest,
      domain_result_sha256: resultSha,
      public_forum_sha256: digest,
    },
    completeness: { status: 'pilot', completed_primary_slots: 390, required_primary_slots: 390 },
    budget_usage: { provider_tokens: Number(usage.provider_tokens || 0) },
    usage: { provider_calls: Number(usage.provider_calls || 0) },
    privacy: { scan_passed: true },
    non_claims: Array.isArray(result.non_claims) ? result.non_claims : [],
    result_sha256: resultSha,
  }
  const manifest: ForumTwinManifest = {
    schema_version: 'campus-pulse-forum-twin-visualization-v4',
    run_id: runId,
    result_sha256: resultSha,
    domain_result_sha256: resultSha,
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
    profiles,
    source: { mode: 'hero_pilot', label: '已校验真实 LLM 讲座治理案例 · Tick 0–10', run_id: null },
  }
}
