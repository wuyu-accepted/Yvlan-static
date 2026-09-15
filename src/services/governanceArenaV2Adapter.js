const AGGREGATE_SCHEMA = 'campus-pulse-live-aggregate-result-v4'
const DOMAIN_SCHEMA = 'campus-pulse-governance-arena-result-v2'
const VISUALIZATION_SCHEMA = 'campus-pulse-governance-visualization-v2'

const REQUIRED_SCENARIOS = Object.freeze([
  'lecture_external_incident_shock',
  'governance_legitimacy_dispute',
])

const REQUIRED_SCHEMES = Object.freeze(['natural', 'A', 'B', 'C', 'D'])

const REQUIRED_METRICS = Object.freeze([
  'attention',
  'concern',
  'trust',
  'satisfaction',
  'support',
  'opposition',
  'activity',
  'voice_gap',
  'service_strain',
  'rumor_belief',
  'verified_belief',
])

const FORBIDDEN_PUBLIC_KEYS = new Set([
  '_private_artifacts',
  'agent_id',
  'micro_agent_id',
  'parent_episode_id',
  'sample_identity',
  'sample_identities',
  'sampled_episode_ids',
  'selected_identities',
  'source_id',
  'source_identifier',
  'raw_text',
  'raw_record',
  'private_message',
  'private_messages',
  'private_observations',
  'record_edges',
  'record_level_edges',
  'api_key',
  'password',
  'secret',
  'local_path',
  'file_path',
])

export class GovernanceArenaDataError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GovernanceArenaDataError'
  }
}

function fail(message) {
  throw new GovernanceArenaDataError(message)
}

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${path} 必须是对象`)
  }
  return value
}

function array(value, path) {
  if (!Array.isArray(value)) fail(`${path} 必须是数组`)
  return value
}

function finite(value, path, { min = -Infinity, max = Infinity } = {}) {
  if (!Number.isFinite(value) || value < min || value > max) {
    fail(`${path} 必须是 ${min}–${max} 范围内的有限数值`)
  }
  return value
}

function integer(value, path, { min = 0, max = Infinity } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${path} 必须是 ${min}–${max} 范围内的整数`)
  }
  return value
}

function sha256(value, path) {
  if (!/^[0-9a-f]{64}$/.test(String(value || ''))) {
    fail(`${path} 不是有效 SHA-256`)
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

function metric(value, path, intervalRequired = false) {
  if (typeof value === 'number') {
    if (intervalRequired) fail(`${path} 缺少 mean/lower/upper`)
    const mean = finite(value, path, { min: 0, max: 1 })
    return { mean, lower: mean, upper: mean }
  }
  const item = object(value, path)
  const mean = finite(item.mean, `${path}.mean`, { min: 0, max: 1 })
  const lower = finite(item.lower, `${path}.lower`, { min: 0, max: 1 })
  const upper = finite(item.upper, `${path}.upper`, { min: 0, max: 1 })
  if (lower > mean || mean > upper) fail(`${path} 区间次序错误`)
  return { mean, lower, upper }
}

function normalizePoint(value, index, path) {
  const point = object(value, path)
  if (point.tick !== index) fail(`${path}.tick 必须与数组索引一致`)
  if (!['baseline', 'burst', 'spread', 'decay'].includes(point.phase)) {
    fail(`${path}.phase 非法`)
  }
  const truthSource = object(point.truth, `${path}.truth`)
  const observedSource = object(point.observed, `${path}.observed`)
  const truth = {}
  const observed = {}
  REQUIRED_METRICS.forEach((key) => {
    truth[key] = metric(truthSource[key], `${path}.truth.${key}`).mean
    observed[key] = metric(
      observedSource[key],
      `${path}.observed.${key}`,
      true,
    )
  })
  const uncertainty = object(point.uncertainty, `${path}.uncertainty`)
  const probe = object(point.probe, `${path}.probe`)
  const diffusion = object(point.diffusion, `${path}.diffusion`)
  const cascadeGroups = array(
    point.cascade_groups || [],
    `${path}.cascade_groups`,
  ).map((edge, edgeIndex) => {
    const edgePath = `${path}.cascade_groups[${edgeIndex}]`
    object(edge, edgePath)
    if (!edge.source_group || !edge.target_group) {
      fail(`${edgePath} 缺少匿名群体端点`)
    }
    return {
      source_group: String(edge.source_group),
      target_group: String(edge.target_group),
      rumor: finite(edge.rumor, `${edgePath}.rumor`, { min: 0 }),
      verified: finite(edge.verified, `${edgePath}.verified`, { min: 0 }),
      bridge: Boolean(edge.bridge),
    }
  })
  const normalizedDiffusion = {}
  for (const key of [
    'emissions',
    'reads',
    'reposts',
    'corrections',
    'cascade_depth',
    'correction_delay',
  ]) {
    normalizedDiffusion[key] = finite(
      diffusion[key],
      `${path}.diffusion.${key}`,
      { min: 0 },
    )
  }
  for (const key of ['bridge_share', 'exposure_inequality']) {
    normalizedDiffusion[key] = finite(
      diffusion[key],
      `${path}.diffusion.${key}`,
      { min: 0, max: 1 },
    )
  }
  return {
    ...point,
    truth,
    observed,
    uncertainty: {
      particle_ess: finite(
        uncertainty.particle_ess,
        `${path}.uncertainty.particle_ess`,
        { min: 0, max: 10 },
      ),
      resampling_count: integer(
        uncertainty.resampling_count,
        `${path}.uncertainty.resampling_count`,
        { min: 0 },
      ),
    },
    probe: {
      ...probe,
      budget: integer(probe.budget, `${path}.probe.budget`, {
        min: 0,
        max: 32,
      }),
      kish_ess: finite(probe.kish_ess, `${path}.probe.kish_ess`, {
        min: 0,
        max: 32,
      }),
    },
    diffusion: normalizedDiffusion,
    cascade_groups: cascadeGroups,
  }
}

function normalizeDecision(value, path) {
  const decision = object(value, path)
  if (
    ![
      'governance_authority',
      'service_operator',
      'community_bridge',
    ].includes(decision.actor)
  ) {
    fail(`${path}.actor 非法`)
  }
  if ('truth' in decision || 'truth_state' in decision) {
    fail(`${path} 泄露隐藏真值给治理主体`)
  }
  const candidates = object(
    decision.candidate_probabilities,
    `${path}.candidate_probabilities`,
  )
  const candidateProbabilities = Object.entries(candidates).map(
    ([actionId, probability]) => ({
      action_id: actionId,
      action_label: actionId,
      probability: finite(
        probability,
        `${path}.candidate_probabilities.${actionId}`,
        { min: 0, max: 1 },
      ),
    }),
  )
  const total = candidateProbabilities.reduce(
    (sum, item) => sum + item.probability,
    0,
  )
  if (Math.abs(total - 1) > 1e-4) fail(`${path} 候选概率不守恒`)
  return {
    ...decision,
    delay_ticks: integer(
      decision.execution_delay,
      `${path}.execution_delay`,
      { min: 0, max: 23 },
    ),
    candidate_probabilities: candidateProbabilities,
  }
}

function resource(value, path) {
  const item = object(value, path)
  const opening = finite(item.opening, `${path}.opening`, { min: 0 })
  const consumed = finite(item.consumed, `${path}.consumed`, { min: 0 })
  const committed = finite(item.committed, `${path}.committed`, { min: 0 })
  const remaining = finite(item.remaining, `${path}.remaining`, { min: 0 })
  if (Math.abs(opening - consumed - committed - remaining) > 1e-8) {
    fail(`${path} 不满足 opening = consumed + committed + remaining`)
  }
  if (item.conserved !== true) fail(`${path}.conserved 必须为 true`)
  return { ...item, opening, consumed, committed, remaining }
}

function normalizeRounds(value, schemeId, path) {
  const rounds = array(value, path)
  // YuLan-Scale keeps Natural genuinely intervention-free: it has no
  // governance actor turns or decision rounds.  Historical v2 assets used
  // four explicit no-op rounds, so retain that shape for compatibility.
  const expectedTicks = (
    schemeId === 'natural' && rounds.length === 0
      ? []
      : [3, 7, 13, 19]
  )
  if (
    rounds.length !== expectedTicks.length
    || rounds.some((round, index) => round.tick !== expectedTicks[index])
  ) {
    fail(`${path} 决策时点不符合冻结合同`)
  }
  return rounds.map((round, roundIndex) => {
    const roundPath = `${path}[${roundIndex}]`
    const decisions = array(
      round.decisions,
      `${roundPath}.decisions`,
    ).map((decision, index) => (
      normalizeDecision(decision, `${roundPath}.decisions[${index}]`)
    ))
    if (decisions.length !== 3) fail(`${roundPath} 必须包含三个主体`)
    return {
      ...round,
      decisions,
      resource_after: resource(
        round.resource_after_decision,
        `${roundPath}.resource_after_decision`,
      ),
    }
  })
}

function normalizeBranch(value, schemeId, path) {
  const branch = object(value, path)
  const timeline = array(branch.timeline, `${path}.timeline`)
  if (timeline.length !== 24) fail(`${path}.timeline 必须为 24 时点`)
  return {
    ...branch,
    timeline: timeline.map((point, index) => (
      normalizePoint(point, index, `${path}.timeline[${index}]`)
    )),
    game_rounds: normalizeRounds(
      branch.game_rounds,
      schemeId,
      `${path}.game_rounds`,
    ),
    resource: resource(branch.resource, `${path}.resource`),
  }
}

export function normalizeGovernanceArenaV2(payload) {
  const aggregate = object(payload, '$')
  if (aggregate.schema_version !== AGGREGATE_SCHEMA) {
    fail(`公共结果外壳必须是 ${AGGREGATE_SCHEMA}`)
  }
  sha256(aggregate.result_sha256, '$.result_sha256')
  if (aggregate.result_kind !== 'adaptive_particle_population_model_conditional_simulation') {
    fail('result-v4 result_kind 非法')
  }
  const domain = object(aggregate.domain_result, '$.domain_result')
  if (domain.schema_version !== DOMAIN_SCHEMA) {
    fail(`domain_result 必须是 ${DOMAIN_SCHEMA}`)
  }
  sha256(domain.result_sha256, '$.domain_result.result_sha256')
  auditPublic(domain)

  const visual = object(
    aggregate.visualization_asset,
    '$.visualization_asset',
  )
  sha256(
    visual.domain_result_sha256,
    '$.visualization_asset.domain_result_sha256',
  )
  sha256(visual.binary_sha256, '$.visualization_asset.binary_sha256')
  integer(visual.byte_length, '$.visualization_asset.byte_length', {
    min: 1,
    max: 25 * 1024 * 1024,
  })
  if (visual.record_stride_bytes !== 4 || visual.frame_count !== 240) {
    fail('result-v4 visualization_asset 的 stride/frame_count 非法')
  }

  const population = object(
    domain.population_identity,
    '$.domain_result.population_identity',
  )
  if (
    population.parent_count !== 1_000
    || population.particle_count !== 10_000
    || population.particles_per_parent !== 10
  ) {
    fail('人口合同必须为 1,000 parents × 10 particles')
  }
  sha256(
    population.population_sha256,
    '$.domain_result.population_identity.population_sha256',
  )
  const plan = object(domain.plan, '$.domain_result.plan')
  if (
    JSON.stringify(plan.branches) !== JSON.stringify(REQUIRED_SCHEMES)
    || JSON.stringify(plan.scenario_ids) !== JSON.stringify(REQUIRED_SCENARIOS)
    || !Array.isArray(plan.seeds)
    || plan.seeds.length !== 8
  ) {
    fail('场景、五分支或配对种子合同不一致')
  }
  if (
    JSON.stringify(plan.sampling?.probe_ticks) !== '[2,7,13,19]'
    || JSON.stringify(plan.game?.decision_ticks) !== '[3,7,13,19]'
    || plan.dynamics?.timeline?.length !== 24
  ) {
    fail('24 时点、探针点或决策点不符合冻结合同')
  }
  if (
    domain.usage?.provider_calls !== 0
    || domain.usage?.real_governance_actions !== 0
  ) {
    fail('v2 冻结发布必须 ZERO PROVIDER / ZERO REAL ACTIONS')
  }

  const scenarios = object(domain.scenarios, '$.domain_result.scenarios')
  const scenarioKeys = Object.keys(scenarios)
  if (
    scenarioKeys.length !== REQUIRED_SCENARIOS.length
    || REQUIRED_SCENARIOS.some((scenarioId) => !scenarioKeys.includes(scenarioId))
  ) {
    fail('正式结果场景身份不一致')
  }
  const normalizedScenarios = {}
  REQUIRED_SCENARIOS.forEach((scenarioId) => {
    const path = `$.domain_result.scenarios.${scenarioId}`
    const scenario = object(scenarios[scenarioId], path)
    const branches = object(scenario.branches, `${path}.branches`)
    const comparison = object(
      scenario.policy_comparison,
      `${path}.policy_comparison`,
    )
    const comparisonRows = array(
      comparison.rows,
      `${path}.policy_comparison.rows`,
    ).map((row) => ({
      ...row,
      scheme_id: row.branch,
      impact_gain: row.objective_score,
      resource_consumed: row.resource_cost,
    }))
    const paretoBranches = array(
      comparison.pareto_branches,
      `${path}.policy_comparison.pareto_branches`,
    )
    normalizedScenarios[scenarioId] = {
      ...scenario,
      paired_seed_count: 8,
      branches: Object.fromEntries(
        REQUIRED_SCHEMES.map((schemeId) => [
          schemeId,
          normalizeBranch(
            branches[schemeId],
            schemeId,
            `${path}.branches.${schemeId}`,
          ),
        ]),
      ),
      policy_comparison: {
        ...comparison,
        rows: comparisonRows,
        pareto_front: comparisonRows.filter(
          (row) => paretoBranches.includes(row.scheme_id),
        ),
      },
    }
  })

  return {
    aggregate,
    domain: {
      ...domain,
      scheme_ids: [...REQUIRED_SCHEMES],
      timeline_contract: {
        tick_count: 24,
        decision_ticks: [3, 7, 13, 19],
        probe_ticks: [2, 7, 13, 19],
      },
      population_identity: {
        ...population,
        population_size: population.parent_count,
      },
      usage: {
        ...domain.usage,
        low_cost_particle_updates: domain.usage.low_cost_particle_tick_updates,
      },
      calibration: domain.method_gates?.calibration,
      writeback_evaluation: {
        formal_mode: plan.formal_writeback_mode,
        gate: domain.method_gates?.writeback,
      },
      game_contract: {
        qre_temperature: plan.game.selected_temperature,
      },
      scenarios: normalizedScenarios,
    },
  }
}

export function validateGovernanceVisualizationV2(
  manifestPayload,
  aggregate,
) {
  const manifest = object(manifestPayload, '$.visualization')
  if (manifest.schema_version !== VISUALIZATION_SCHEMA) {
    fail(`visualization 必须是 ${VISUALIZATION_SCHEMA}`)
  }
  if (
    manifest.run_id !== aggregate.run_id
    || manifest.outer_result_sha256 !== aggregate.result_sha256
    || manifest.domain_result_sha256
      !== aggregate.visualization_asset.domain_result_sha256
    || manifest.binary_sha256 !== aggregate.visualization_asset.binary_sha256
    || manifest.byte_length !== aggregate.visualization_asset.byte_length
    || manifest.record_stride_bytes !== 4
    || manifest.frame_count !== 240
  ) {
    fail('visualization manifest 与 result-v4 绑定不一致')
  }
  sha256(manifest.binary_sha256, '$.visualization.binary_sha256')
  const frames = array(manifest.frames, '$.visualization.frames')
  if (frames.length !== 240) fail('visualization 必须索引 240 个帧')
  let expectedOffset = 0
  const seen = new Set()
  frames.forEach((frame, index) => {
    const path = `$.visualization.frames[${index}]`
    object(frame, path)
    const key = `${frame.scenario_id}:${frame.policy_branch}:${frame.tick}`
    if (
      frame.index !== index
      || !REQUIRED_SCENARIOS.includes(frame.scenario_id)
      || !REQUIRED_SCHEMES.includes(frame.policy_branch)
      || !Number.isInteger(frame.tick)
      || frame.tick < 0
      || frame.tick > 23
      || seen.has(key)
      || frame.offset !== expectedOffset
      || frame.length !== 40_000
    ) {
      fail(`${path} 不符合匿名量化帧索引合同`)
    }
    seen.add(key)
    expectedOffset += frame.length
  })
  if (expectedOffset !== manifest.byte_length) {
    fail('visualization frame byte ranges 不守恒')
  }
  return manifest
}

async function sha256Hex(arrayBuffer) {
  if (!globalThis.crypto?.subtle) {
    fail('当前浏览器不支持安全哈希校验')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer)
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
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

export async function verifyGovernanceVisualizationManifest(
  manifest,
  expectedSha256,
) {
  sha256(expectedSha256, 'visualization manifest response hash')
  const bytes = new TextEncoder().encode(`${canonicalJson(manifest)}\n`)
  const actualHash = await sha256Hex(bytes.buffer)
  if (actualHash !== expectedSha256) {
    fail('visualization manifest 响应哈希校验失败')
  }
  return manifest
}

export async function verifyGovernanceVisualizationBinary(
  arrayBuffer,
  manifest,
) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    fail('visualization binary 不是 ArrayBuffer')
  }
  if (arrayBuffer.byteLength !== manifest.byte_length) {
    fail('visualization binary 长度与 manifest 不一致')
  }
  const actualHash = await sha256Hex(arrayBuffer)
  if (actualHash !== manifest.binary_sha256) {
    fail('visualization binary SHA-256 校验失败')
  }
  return arrayBuffer
}

export function createParticleFrameReader(arrayBuffer, manifest) {
  const data = new DataView(arrayBuffer)
  const frameIndex = new Map(
    manifest.frames.map((entry) => [
      `${entry.scenario_id}:${entry.policy_branch}:${entry.tick}`,
      entry,
    ]),
  )
  return {
    count: 10_000,
    readLayout(ordinal) {
      integer(ordinal, 'particle ordinal', { min: 0, max: 9_999 })
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const angle = ordinal * goldenAngle
      const radius = Math.sqrt((ordinal + 0.5) / 10_000) * 0.47
      return {
        x: 0.5 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(angle) * radius * 0.78,
      }
    },
    readFrame(scenarioId, schemeId, tick) {
      const entry = frameIndex.get(`${scenarioId}:${schemeId}:${tick}`)
      if (!entry) fail('请求的量化粒子帧不存在')
      return {
        entry,
        read(ordinal) {
          integer(ordinal, 'particle frame ordinal', { min: 0, max: 9_999 })
          const offset = entry.offset + ordinal * manifest.record_stride_bytes
          return {
            belief: (data.getUint8(offset) - 127) / 127,
            attention: data.getUint8(offset + 1) / 255,
            weight_bin: data.getUint8(offset + 2),
            public_action: data.getUint8(offset + 3),
          }
        },
      }
    },
  }
}

export {
  AGGREGATE_SCHEMA,
  DOMAIN_SCHEMA,
  REQUIRED_METRICS,
  REQUIRED_SCENARIOS,
  REQUIRED_SCHEMES,
  VISUALIZATION_SCHEMA,
}
