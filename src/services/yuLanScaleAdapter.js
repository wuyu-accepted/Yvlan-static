import {
  AGGREGATE_SCHEMA as LEGACY_AGGREGATE_SCHEMA,
  DOMAIN_SCHEMA as LEGACY_DOMAIN_SCHEMA,
  VISUALIZATION_SCHEMA as LEGACY_VISUALIZATION_SCHEMA,
  createParticleFrameReader,
  normalizeGovernanceArenaV2,
  validateGovernanceVisualizationV2,
  verifyGovernanceVisualizationBinary,
  verifyGovernanceVisualizationManifest,
} from './governanceArenaV2Adapter.js'

export const YULAN_AGGREGATE_SCHEMA = 'campus-pulse-live-aggregate-result-v5'
export const YULAN_DOMAIN_SCHEMA = 'campus-pulse-llm-governance-result-v3'
export const YULAN_VISUALIZATION_SCHEMA =
  'campus-pulse-llm-population-visualization-v3'
export const YULAN_EXECUTION_MODE = 'budgeted_llm_agent_population'

const FORMAL_PROVENANCE = new Set([
  'reviewed_trace_replay',
  'authorized_live_llm',
])

const FORBIDDEN_PUBLIC_KEYS = new Set([
  'agent_id',
  'agent_ids',
  'anchor_ids',
  'sample_identity',
  'sample_identities',
  'sampled_episode_ids',
  'selected_identities',
  'parent_episode_id',
  'parent_particle_mapping',
  'source_id',
  'source_identifier',
  'raw_text',
  'raw_record',
  'raw_prompt',
  'raw_response',
  'private_message',
  'private_messages',
  'private_observation',
  'private_observations',
  'record_edges',
  'record_level_edges',
  'api_key',
  'password',
  'secret',
  'local_path',
  'file_path',
])

export class YuLanScaleDataError extends Error {
  constructor(message) {
    super(message)
    this.name = 'YuLanScaleDataError'
  }
}

function fail(message) {
  throw new YuLanScaleDataError(message)
}

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${path} 必须是对象`)
  }
  return value
}

function integer(value, path, min = 0) {
  if (!Number.isInteger(value) || value < min) {
    fail(`${path} 必须是大于等于 ${min} 的整数`)
  }
  return value
}

function auditPublic(value, path = '$') {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => auditPublic(item, `${path}[${index}]`))
    return
  }
  Object.entries(value).forEach(([key, child]) => {
    if (FORBIDDEN_PUBLIC_KEYS.has(key.toLowerCase())) {
      fail(`${path}.${key} 是公共结果禁止字段`)
    }
    auditPublic(child, `${path}.${key}`)
  })
}

function usageValue(usage, ...keys) {
  for (const key of keys) {
    if (Number.isFinite(usage?.[key])) return Number(usage[key])
  }
  return 0
}

function exactKeys(value, expected, path) {
  const actual = Object.keys(object(value, path)).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${path} 字段集合不符合冻结合同`)
  }
}

function sha256(value, path) {
  if (!/^[0-9a-f]{64}$/.test(String(value || ''))) {
    fail(`${path} 不是有效 SHA-256`)
  }
  return value
}

function findTick(container, tick) {
  if (!container) return {}
  const timeline = Array.isArray(container)
    ? container
    : container.timeline || container.ticks || []
  return timeline.find((item) => item?.tick === tick) || {}
}

function branchLookup(container, scenarioId, branchId) {
  return (
    container?.[scenarioId]?.[branchId]
    || container?.[scenarioId]?.branches?.[branchId]
    || container?.scenarios?.[scenarioId]?.branches?.[branchId]
    || container?.governance_visible_by_tick?.[scenarioId]?.[branchId]
    || {}
  )
}

function composeFormalScenarios(domain) {
  const scenarioIds = [
    'lecture_external_incident_shock',
    'governance_legitimacy_dispute',
  ]
  const branchIds = ['natural', 'A', 'B', 'C', 'D']
  return Object.fromEntries(scenarioIds.map((scenarioId) => {
    const timelineScenario = object(
      domain.timeline_aggregates?.[scenarioId],
      `$.domain_result.timeline_aggregates.${scenarioId}`,
    )
    const governanceScenario = object(
      domain.governance?.[scenarioId],
      `$.domain_result.governance.${scenarioId}`,
    )
    const branches = Object.fromEntries(branchIds.map((branchId) => {
      const timelineCandidate = (
        timelineScenario.branches?.[branchId]
        ?? timelineScenario[branchId]
      )
      const timeline = Array.isArray(timelineCandidate)
        ? timelineCandidate
        : object(
            timelineCandidate,
            `$.domain_result.timeline_aggregates.${scenarioId}.${branchId}`,
          ).timeline
      const governanceBranch = object(
        governanceScenario.branches?.[branchId]
          ?? governanceScenario[branchId],
        `$.domain_result.governance.${scenarioId}.${branchId}`,
      )
      if (!Array.isArray(timeline)) {
        fail(`timeline_aggregates.${scenarioId}.${branchId}.timeline 必须是数组`)
      }
      const messageBranch = branchLookup(
        domain.messaging,
        scenarioId,
        branchId,
      )
      const posteriorBranch = branchLookup(
        domain.observed_posterior,
        scenarioId,
        branchId,
      )
      const uncertaintyBranch = branchLookup(
        domain.uncertainty,
        scenarioId,
        branchId,
      )
      return [branchId, {
        timeline: timeline.map((point) => {
          const message = findTick(messageBranch, point.tick)
          const posterior = findTick(posteriorBranch, point.tick)
          const uncertainty = findTick(uncertaintyBranch, point.tick)
          return {
            ...point,
            observed: point.observed || posterior.observed || posterior.metrics,
            probe: point.probe || posterior.probe,
            actor_observations:
              point.actor_observations || posterior.actor_observations || {},
            uncertainty: point.uncertainty || uncertainty.uncertainty || uncertainty,
            diffusion: point.diffusion || message.diffusion,
            cascade_groups: point.cascade_groups || message.cascade_groups || [],
          }
        }),
        game_rounds: governanceBranch.game_rounds,
        resource: governanceBranch.resource,
      }]
    }))
    return [scenarioId, {
      label: timelineScenario.label || scenarioId,
      branches,
      policy_comparison: (
        governanceScenario.policy_comparison
        ?? domain.branch_differences?.[scenarioId]
      ),
    }]
  }))
}

function presentation(domain, aggregate, legacy = false) {
  const usage = domain.usage || {}
  const plan = domain.plan || domain.audit?.run_plan || {}
  const activation = (
    plan.llm_activation
    || plan.activation
    || plan.semantic_activation
    || {}
  )
  const executionProvenance = legacy
    ? 'emulator_only_development'
    : (
        aggregate.execution_provenance
        || domain.execution_provenance
        || plan.execution_provenance
      )
  if (![
    'emulator_only_development',
    'reviewed_trace_replay',
    'authorized_live_llm',
  ].includes(executionProvenance)) {
    fail('execution_provenance 非法或缺失')
  }
  const publicationEligible = legacy
    ? false
    : Boolean(
        aggregate.publication_eligible
        ?? domain.publication_eligible,
      )
  if (publicationEligible && !FORMAL_PROVENANCE.has(executionProvenance)) {
    fail('开发态或 fixture 结果不能具有正式发布资格')
  }
  const fixtureSlots = usageValue(
    usage,
    'fixture_slots',
    'fixture_probe_slots',
  )
  const residentLlmTurns = usageValue(
    usage,
    'resident_llm_turns',
    'resident_llm_turns_completed',
  )
  const governanceLlmTurns = usageValue(
    usage,
    'governance_llm_turns',
    'governance_actor_llm_turns',
    'actor_llm_turns_completed',
  )
  const traceReplayTurns = usageValue(
    usage,
    'trace_replay_turns',
    'reviewed_trace_replay_turns',
    'reviewed_trace_replays',
  )
  if (
    legacy
    && (residentLlmTurns || governanceLlmTurns || traceReplayTurns)
  ) {
    fail('legacy v2 fixture 不得标记为 LLM turn')
  }
  return {
    executionMode: legacy
      ? 'adaptive_particle_population'
      : YULAN_EXECUTION_MODE,
    executionProvenance,
    publicationEligible,
    legacyDevelopmentAsset: legacy,
    identityLabel: legacy
      ? 'LEGACY v2 · EMULATOR DEVELOPMENT ASSET'
      : executionProvenance === 'reviewed_trace_replay'
        ? 'REVIEWED LLM TRACE REPLAY'
        : executionProvenance === 'authorized_live_llm'
          ? 'AUTHORIZED LIVE LLM'
          : 'EMULATOR-ONLY DEVELOPMENT',
    activation: {
      anchorCount: integer(
        activation.anchor_count
          ?? activation.anchors_per_round
          ?? plan.anchor_count
          ?? 16,
        'activation.anchor_count',
      ),
      ppsCount: integer(
        activation.pps_budget
          ?? activation.pps_per_round
          ?? plan.pps_budget
          ?? 32,
        'activation.pps_budget',
      ),
      residentSlotsTotal: integer(
        activation.resident_slot_count
          ?? activation.resident_semantic_slots
          ?? plan.resident_llm_slot_count
          ?? 12_288,
        'activation.resident_slot_count',
      ),
      governanceSlotsTotal: integer(
        activation.governance_slot_count
          ?? activation.governance_semantic_slots
          ?? plan.governance_llm_slot_count
          ?? 768,
        'activation.governance_slot_count',
      ),
      traceSlotsTotal: integer(
        activation.total_slot_count
          ?? activation.primary_semantic_slots
          ?? plan.llm_trace_slot_count
          ?? 13_056,
        'activation.total_slot_count',
      ),
    },
    usage: {
      residentLlmTurns,
      governanceLlmTurns,
      traceReplayTurns,
      providerCalls: usageValue(
        usage,
        'provider_calls',
        'live_provider_calls',
      ),
      providerTokens: usageValue(usage, 'provider_tokens', 'total_tokens'),
      cacheTurns: usageValue(usage, 'cache_turns', 'cache_hits'),
      emulatorUpdates: usageValue(
        usage,
        'emulator_updates',
        'low_cost_particle_tick_updates',
      ),
      fixtureSlots,
      realGovernanceActions: usageValue(usage, 'real_governance_actions'),
    },
  }
}

function normalizeFormalV5(payload) {
  const aggregate = object(payload, '$')
  exactKeys(aggregate, [
    'schema_version',
    'run_id',
    'launch_fingerprint',
    'result_kind',
    'plan_sha256',
    'execution_provenance',
    'publication_eligible',
    'domain_result',
    'visualization_asset',
    'completeness',
    'budget_usage',
    'usage',
    'privacy',
    'non_claims',
    'result_sha256',
  ], '$')
  if (aggregate.schema_version !== YULAN_AGGREGATE_SCHEMA) {
    fail(`公共结果外壳必须是 ${YULAN_AGGREGATE_SCHEMA}`)
  }
  if (
    aggregate.result_kind !== 'budgeted_llm_agent_population_simulation'
  ) {
    fail('result_kind 不是预算化 LLM 智能体人口模拟')
  }
  sha256(aggregate.plan_sha256, '$.plan_sha256')
  sha256(aggregate.result_sha256, '$.result_sha256')
  if (!/^run_[0-9a-f]{24}$/.test(String(aggregate.run_id || ''))) {
    fail('run_id 不符合冻结格式')
  }
  const domain = object(aggregate.domain_result, '$.domain_result')
  exactKeys(domain, [
    'schema_version',
    'population_identity',
    'timeline_aggregates',
    'speaker_opinion',
    'observed_posterior',
    'anchor_trajectories',
    'emulator_residuals',
    'branch_differences',
    'uncertainty',
    'messaging',
    'governance',
    'audit',
  ], '$.domain_result')
  if (domain.schema_version !== YULAN_DOMAIN_SCHEMA) {
    fail(`domain_result 必须是 ${YULAN_DOMAIN_SCHEMA}`)
  }
  auditPublic(domain)
  const completeness = object(aggregate.completeness, '$.completeness')
  exactKeys(completeness, [
    'status',
    'completed_work_units',
    'required_work_units',
    'completed_semantic_slots',
    'required_semantic_slots',
  ], '$.completeness')
  if (
    completeness.status !== 'complete'
    || completeness.completed_work_units !== 1_728
    || completeness.required_work_units !== 1_728
    || completeness.required_semantic_slots !== 13_056
  ) {
    fail('result-v5 工作单元或语义槽位不完整')
  }
  const usage = object(aggregate.usage, '$.usage')
  exactKeys(usage, [
    'resident_llm_turns',
    'governance_llm_turns',
    'reviewed_trace_replays',
    'live_provider_calls',
    'cache_hits',
    'provider_tokens',
    'emulator_updates',
    'real_governance_actions',
  ], '$.usage')
  if (
    usage.emulator_updates !== 17_280_000
    || usage.real_governance_actions !== 0
    || usage.resident_llm_turns + usage.governance_llm_turns
      !== completeness.completed_semantic_slots
  ) {
    fail('result-v5 使用量不守恒')
  }
  const budget = object(aggregate.budget_usage, '$.budget_usage')
  exactKeys(budget, [
    'provider_request_limit',
    'provider_requests_used',
    'provider_token_limit',
    'provider_tokens_used',
    'effective_concurrency_limit',
    'peak_concurrency',
  ], '$.budget_usage')
  if (
    budget.provider_request_limit !== 26_112
    || budget.provider_token_limit !== 40_000_000
    || budget.provider_requests_used < 0
    || budget.provider_requests_used > budget.provider_request_limit
    || budget.provider_tokens_used < 0
    || budget.provider_tokens_used > budget.provider_token_limit
    || usage.provider_tokens !== budget.provider_tokens_used
  ) {
    fail('result-v5 Provider 预算不合法')
  }
  const provenance = aggregate.execution_provenance
  const completedSlots = completeness.completed_semantic_slots
  const validPublicationMode = (
    provenance === 'emulator_only_development'
      ? (
          aggregate.publication_eligible === false
          && completedSlots === 0
          && usage.resident_llm_turns === 0
          && usage.governance_llm_turns === 0
          && usage.reviewed_trace_replays === 0
          && usage.live_provider_calls === 0
          && budget.provider_requests_used === 0
          && budget.provider_tokens_used === 0
        )
      : provenance === 'reviewed_trace_replay'
        ? (
            aggregate.publication_eligible === true
            && completedSlots === 13_056
            && usage.resident_llm_turns === 12_288
            && usage.governance_llm_turns === 768
            && usage.reviewed_trace_replays === 13_056
            && usage.live_provider_calls === 0
            && budget.provider_requests_used === 0
            && budget.provider_tokens_used === 0
          )
        : provenance === 'authorized_live_llm'
          ? (
              aggregate.publication_eligible === true
              && completedSlots === 13_056
              && usage.resident_llm_turns === 12_288
              && usage.governance_llm_turns === 768
              && usage.reviewed_trace_replays === 0
              && usage.live_provider_calls >= 13_056
              && usage.live_provider_calls === budget.provider_requests_used
            )
          : false
  )
  if (!validPublicationMode) {
    fail('result-v5 发布资格与执行 provenance 矛盾')
  }
  const privacy = object(aggregate.privacy, '$.privacy')
  exactKeys(privacy, [
    'raw_text_included',
    'source_identifiers_included',
    'record_level_edges_included',
    'sample_identities_included',
    'parent_particle_mapping_included',
    'provider_secrets_included',
    'runtime_paths_included',
    'private_actor_observations_included',
    'unreviewed_free_text_included',
  ], '$.privacy')
  if (Object.values(privacy).some((value) => value !== false)) {
    fail('result-v5 隐私边界非法')
  }
  if (
    !Array.isArray(aggregate.non_claims)
    || aggregate.non_claims.length < 7
  ) {
    fail('result-v5 非主张不完整')
  }
  const population = object(
    domain.population_identity,
    '$.domain_result.population_identity',
  )
  const agentCount = (
    population.llm_agent_count
    ?? population.agent_count
    ?? population.parent_count
  )
  const particlesPerAgent = (
    population.particles_per_agent
    ?? population.particles_per_parent
  )
  if (
    agentCount !== 1_000
    || population.particle_count !== 10_000
    || particlesPerAgent !== 10
  ) {
    fail('人口合同必须为 1,000 LLM agents × 10 particles')
  }
  const scenarios = composeFormalScenarios(domain)
  const visual = object(aggregate.visualization_asset, '$.visualization_asset')
  exactKeys(visual, [
    'schema_version',
    'manifest_sha256',
    'binary_sha256',
    'byte_length',
    'frame_count',
    'record_stride_bytes',
    'domain_result_sha256',
  ], '$.visualization_asset')
  if (visual.schema_version !== YULAN_VISUALIZATION_SCHEMA) {
    fail(`visualization_asset 必须是 ${YULAN_VISUALIZATION_SCHEMA}`)
  }

  // The timeline and frame geometry remain compatible with the mature v2
  // visual components, while the public result keeps its new domain layout.
  const compatibilityEnvelope = {
    ...aggregate,
    schema_version: LEGACY_AGGREGATE_SCHEMA,
    result_kind:
      'adaptive_particle_population_model_conditional_simulation',
    visualization_asset: {
      ...visual,
      domain_result_sha256: visual.domain_result_sha256,
    },
    domain_result: {
      schema_version: LEGACY_DOMAIN_SCHEMA,
      result_sha256: visual.domain_result_sha256,
      population_identity: {
        ...population,
        population_size: agentCount,
        parent_count: agentCount,
        particles_per_parent: particlesPerAgent,
        population_sha256:
          population.population_sha256 || aggregate.plan_sha256,
      },
      plan: {
        branches: ['natural', 'A', 'B', 'C', 'D'],
        scenario_ids: [
          'lecture_external_incident_shock',
          'governance_legitimacy_dispute',
        ],
        seeds: Array.from({ length: 8 }, (_, index) => 20_260_730 + index),
        formal_writeback_mode:
          domain.audit?.formal_writeback_mode || 'observation_only',
        dynamics: {
          timeline: Array.from({ length: 24 }, (_, tick) => ({ tick })),
        },
        sampling: { probe_ticks: [2, 7, 13, 19] },
        game: {
          decision_ticks: [3, 7, 13, 19],
          selected_temperature:
            domain.audit?.qre_temperature ?? 0.2,
        },
      },
      scenarios,
      usage: {
        provider_calls: 0,
        real_governance_actions: 0,
        low_cost_particle_tick_updates: usage.emulator_updates,
      },
      method_gates: domain.audit?.method_gates || {},
    },
  }
  const normalized = normalizeGovernanceArenaV2(compatibilityEnvelope)
  normalized.aggregate = aggregate
  normalized.domain = {
    ...normalized.domain,
    schema_version: YULAN_DOMAIN_SCHEMA,
    population_identity: {
      ...normalized.domain.population_identity,
      agent_count: agentCount,
    },
    usage: {
      ...usage,
      low_cost_particle_updates: usage.emulator_updates,
    },
    speaker_opinion: domain.speaker_opinion,
    anchor_trajectories: domain.anchor_trajectories,
    emulator_residuals: domain.emulator_residuals,
    branch_differences: domain.branch_differences,
    audit: domain.audit,
    result_sections: {
      speaker_opinion: domain.speaker_opinion,
      anchor_trajectories: domain.anchor_trajectories,
      emulator_residuals: domain.emulator_residuals,
      branch_differences: domain.branch_differences,
    },
  }
  const release = presentation(normalized.domain, aggregate, false)
  if (release.executionMode !== YULAN_EXECUTION_MODE) {
    fail(`execution_mode 必须是 ${YULAN_EXECUTION_MODE}`)
  }
  if (
    release.activation.anchorCount !== 16
    || release.activation.ppsCount !== 32
    || release.activation.residentSlotsTotal !== 12_288
    || release.activation.governanceSlotsTotal !== 768
    || release.activation.traceSlotsTotal !== 13_056
  ) {
    fail('LLM 激活预算不符合 16 anchors + 32 PPS / 13,056 slots')
  }
  return { ...normalized, release }
}

function normalizeLegacyV2(payload) {
  const normalized = normalizeGovernanceArenaV2(payload)
  return {
    ...normalized,
    release: presentation(normalized.domain, normalized.aggregate, true),
  }
}

export function normalizeYuLanScale(payload) {
  if (payload?.schema_version === YULAN_AGGREGATE_SCHEMA) {
    return normalizeFormalV5(payload)
  }
  if (payload?.schema_version === LEGACY_AGGREGATE_SCHEMA) {
    return normalizeLegacyV2(payload)
  }
  fail(
    `不支持的结果合同：需要 ${YULAN_AGGREGATE_SCHEMA}`
      + `（开发期兼容 ${LEGACY_AGGREGATE_SCHEMA}）`,
  )
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(',')}}`
  }
  return JSON.stringify(value)
}

async function hashCanonical(value) {
  if (!globalThis.crypto?.subtle) {
    fail('当前浏览器不支持安全哈希校验')
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(value)),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function hashUtf8(value) {
  if (!globalThis.crypto?.subtle) {
    fail('当前浏览器不支持安全哈希校验')
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function extractCanonicalObject(rawJson, propertyName) {
  const token = `${JSON.stringify(propertyName)}:`
  const tokenIndex = rawJson.indexOf(token)
  if (tokenIndex < 0 || rawJson.indexOf(token, tokenIndex + 1) >= 0) {
    fail(`${propertyName} 原始字节定位失败`)
  }
  const start = tokenIndex + token.length
  if (rawJson[start] !== '{') fail(`${propertyName} 原始值不是对象`)
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < rawJson.length; index += 1) {
    const character = rawJson[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return rawJson.slice(start, index + 1)
    }
  }
  fail(`${propertyName} 原始对象不完整`)
}

function removeOuterResultHash(rawJson, expectedHash) {
  const member = `"result_sha256":"${expectedHash}"`
  const index = rawJson.indexOf(member)
  if (index < 0 || rawJson.indexOf(member, index + 1) >= 0) {
    fail('result_sha256 原始字节定位失败')
  }
  if (rawJson[index - 1] === ',') {
    return rawJson.slice(0, index - 1) + rawJson.slice(index + member.length)
  }
  if (rawJson[index + member.length] === ',') {
    return rawJson.slice(0, index)
      + rawJson.slice(index + member.length + 1)
  }
  fail('result_sha256 不是外层 JSON 成员')
}

export async function verifyYuLanAggregate(aggregate) {
  if (aggregate.schema_version !== YULAN_AGGREGATE_SCHEMA) return aggregate
  const rawCanonicalJson = aggregate.__rawCanonicalJson?.trim()
  const domainHash = rawCanonicalJson
    ? await hashUtf8(extractCanonicalObject(rawCanonicalJson, 'domain_result'))
    : await hashCanonical(aggregate.domain_result)
  if (
    domainHash
    !== aggregate.visualization_asset.domain_result_sha256
  ) {
    fail('domain-result-v3 SHA-256 校验失败')
  }
  const {
    result_sha256: expectedResultHash,
    ...resultBody
  } = aggregate
  const resultHash = rawCanonicalJson
    ? await hashUtf8(
        removeOuterResultHash(rawCanonicalJson, expectedResultHash),
      )
    : await hashCanonical(resultBody)
  if (resultHash !== expectedResultHash) {
    fail('aggregate-result-v5 SHA-256 校验失败')
  }
  return aggregate
}

export function validateYuLanVisualization(manifestPayload, aggregate) {
  if (manifestPayload?.schema_version === LEGACY_VISUALIZATION_SCHEMA) {
    return validateGovernanceVisualizationV2(manifestPayload, aggregate)
  }
  if (manifestPayload?.schema_version !== YULAN_VISUALIZATION_SCHEMA) {
    fail(`visualization 必须是 ${YULAN_VISUALIZATION_SCHEMA}`)
  }
  const compatibilityAggregate = {
    ...aggregate,
    schema_version: LEGACY_AGGREGATE_SCHEMA,
    visualization_asset: {
      ...aggregate.visualization_asset,
      domain_result_sha256:
        aggregate.visualization_asset.domain_result_sha256,
    },
  }
  const compatibilityManifest = {
    ...manifestPayload,
    schema_version: LEGACY_VISUALIZATION_SCHEMA,
  }
  const validated = validateGovernanceVisualizationV2(
    compatibilityManifest,
    compatibilityAggregate,
  )
  return {
    ...validated,
    schema_version: YULAN_VISUALIZATION_SCHEMA,
  }
}

export {
  createParticleFrameReader,
  verifyGovernanceVisualizationBinary as verifyYuLanVisualizationBinary,
  verifyGovernanceVisualizationManifest as verifyYuLanVisualizationManifest,
}
