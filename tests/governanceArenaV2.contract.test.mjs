import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

import {
  AGGREGATE_SCHEMA,
  DOMAIN_SCHEMA,
  GovernanceArenaDataError,
  REQUIRED_METRICS,
  REQUIRED_SCHEMES,
  VISUALIZATION_SCHEMA,
  createParticleFrameReader,
  normalizeGovernanceArenaV2,
  validateGovernanceVisualizationV2,
  verifyGovernanceVisualizationBinary,
  verifyGovernanceVisualizationManifest,
} from '../src/services/governanceArenaV2Adapter.js'

const viewPath = fileURLToPath(
  new URL('../src/views/GovernanceArenaV2View.vue', import.meta.url),
)
const routerPath = fileURLToPath(
  new URL('../src/router/index.js', import.meta.url),
)
const appPath = fileURLToPath(
  new URL('../src/App.vue', import.meta.url),
)
const loaderPath = fileURLToPath(
  new URL('../src/services/governanceArenaV2Loader.js', import.meta.url),
)
const workbenchPath = fileURLToPath(
  new URL('../src/views/campus-pulse/workbench/WorkbenchHomeView.vue', import.meta.url),
)
const executionPanelPath = fileURLToPath(
  new URL('../src/components/campus-pulse/RunExecutionPanel.vue', import.meta.url),
)
const componentPaths = [
  'ArenaParticleField.vue',
  'ArenaCascadeGraph.vue',
  'ArenaTruthObservation.vue',
  'ArenaGamePanel.vue',
  'ArenaPolicyChart.vue',
  'ArenaAuditPanel.vue',
].map((name) => fileURLToPath(new URL(
  `../src/components/campus-pulse/governance-v2/${name}`,
  import.meta.url,
)))

const [
  viewSource,
  routerSource,
  appSource,
  loaderSource,
  workbenchSource,
  executionPanelSource,
  ...componentSources
] = await Promise.all([
  readFile(viewPath, 'utf8'),
  readFile(routerPath, 'utf8'),
  readFile(appPath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(workbenchPath, 'utf8'),
  readFile(executionPanelPath, 'utf8'),
  ...componentPaths.map((path) => readFile(path, 'utf8')),
])

function hashBuffer(value) {
  return createHash('sha256').update(value).digest('hex')
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

function interval(value) {
  return {
    mean: value,
    lower: Math.max(0, value - 0.04),
    upper: Math.min(1, value + 0.04),
  }
}

function timelinePoint(tick) {
  const phase = tick <= 2
    ? 'baseline'
    : tick <= 7
      ? 'burst'
      : tick <= 17
        ? 'spread'
        : 'decay'
  const truth = Object.fromEntries(
    REQUIRED_METRICS.map((key, index) => [
      key,
      0.25 + ((tick + index) % 9) * 0.025,
    ]),
  )
  return {
    tick,
    phase,
    truth,
    observed: Object.fromEntries(
      Object.entries(truth).map(([key, value]) => [key, interval(value)]),
    ),
    uncertainty: {
      particle_ess: 8.7 - tick * 0.01,
      resampling_count: Math.floor(tick / 8),
    },
    probe: {
      budget: [2, 7, 13, 19].includes(tick) ? 32 : 0,
      kish_ess: [2, 7, 13, 19].includes(tick) ? 25.2 : 0,
    },
    diffusion: {
      emissions: 40 + tick,
      reads: 100 + tick * 2,
      reposts: 14 + tick,
      corrections: 4 + tick / 2,
      cascade_depth: 2 + tick / 10,
      bridge_share: 0.22,
      correction_delay: 1.5,
      exposure_inequality: 0.18,
    },
    cascade_groups: [{
      source_group: 'archetype-01',
      target_group: 'archetype-02',
      rumor: 4,
      verified: 7,
      bridge: true,
    }],
    actor_observations: {
      governance_authority: {
        signal_label: '延迟公开讨论',
        delay_ticks: 1,
        coverage: 0.4,
      },
    },
  }
}

function gameRounds() {
  return [3, 7, 13, 19].map((tick) => ({
    tick,
    resource_after_decision: {
      opening: 100,
      consumed: tick,
      committed: 4,
      remaining: 96 - tick,
      conserved: true,
    },
    decisions: [
      'governance_authority',
      'service_operator',
      'community_bridge',
    ].map((actor) => ({
      actor,
      selected_action: 'bounded_action',
      selected_action_label: '受限治理行动',
      execution_delay: 1,
      reason: '仅依据主体可见的聚合信号。',
      candidate_probabilities: {
        bounded_action: 0.7,
        wait: 0.3,
      },
    })),
  }))
}

function branch(schemeId) {
  return {
    timeline: Array.from({ length: 24 }, (_, tick) => timelinePoint(tick)),
    game_rounds: gameRounds(),
    resource: schemeId === 'natural'
      ? {
          opening: 100,
          consumed: 0,
          committed: 0,
          remaining: 100,
          conserved: true,
        }
      : {
          opening: 100,
          consumed: 28,
          committed: 4,
          remaining: 68,
          conserved: true,
        },
  }
}

function scenario() {
  return {
    label: '冻结压力场景',
    paired_seed_count: 8,
    branches: Object.fromEntries(
      REQUIRED_SCHEMES.map((schemeId) => [schemeId, branch(schemeId)]),
    ),
    policy_comparison: {
      rows: REQUIRED_SCHEMES.map((schemeId, index) => ({
        branch: schemeId,
        concern_auc_reduction: index * 0.02,
        rumor_auc_reduction: index * 0.01,
        end_trust_gain: index * 0.005,
        end_voice_gap: 0.1,
        resource_cost: index * 12,
        objective_score: index * 0.02,
      })),
      pareto_branches: ['D'],
      pareto_front: ['D'],
    },
  }
}

function fixtureEnvelope(binaryHash, byteLength) {
  const domain = {
    schema_version: DOMAIN_SCHEMA,
    result_sha256: 'b'.repeat(64),
    population_identity: {
      population_size: 1_000,
      particle_count: 10_000,
      parent_count: 1_000,
      particles_per_parent: 10,
      population_sha256: 'c'.repeat(64),
    },
    plan: {
      branches: [...REQUIRED_SCHEMES],
      scenario_ids: [
        'lecture_external_incident_shock',
        'governance_legitimacy_dispute',
      ],
      seeds: Array.from({ length: 8 }, (_, index) => 20_260_730 + index),
      formal_writeback_mode: 'observation_only',
      dynamics: {
        timeline: Array.from({ length: 24 }, (_, tick) => ({ tick })),
      },
      sampling: { probe_ticks: [2, 7, 13, 19] },
      game: {
        decision_ticks: [3, 7, 13, 19],
        selected_temperature: 0.2,
      },
    },
    scenarios: {
      lecture_external_incident_shock: scenario(),
      governance_legitimacy_dispute: scenario(),
    },
    usage: {
      provider_calls: 0,
      real_governance_actions: 0,
      low_cost_particle_tick_updates: 17_280_000,
      fixture_probe_slots: 8_192,
    },
    method_gates: {
      calibration: {
        status: 'identity_fallback_due_to_missing_paired_calibration_evidence',
      },
      writeback: { passed: true },
    },
  }
  return {
    schema_version: AGGREGATE_SCHEMA,
    run_id: 'run_0123456789abcdef01234567',
    result_kind: 'adaptive_particle_population_model_conditional_simulation',
    result_sha256: 'a'.repeat(64),
    visualization_asset: {
      domain_result_sha256: 'd'.repeat(64),
      binary_sha256: binaryHash,
      byte_length: byteLength,
      record_stride_bytes: 4,
      frame_count: 240,
    },
    domain_result: domain,
  }
}

function fixtureBinary() {
  const frameBytes = 10_000 * 4
  const buffer = new ArrayBuffer(frameBytes * 240)
  const view = new DataView(buffer)
  view.setUint8(0, 191)
  view.setUint8(1, 200)
  view.setUint8(2, 128)
  view.setUint8(3, 1)
  return buffer
}

function fixtureManifest(envelope, binaryHash, byteLength) {
  const frameBytes = 10_000 * 4
  const index = []
  let frameOrdinal = 0
  for (const scenarioId of Object.keys(envelope.domain_result.scenarios)) {
    for (const schemeId of REQUIRED_SCHEMES) {
      for (let tick = 0; tick < 24; tick += 1) {
        index.push({
          index: frameOrdinal,
          scenario_id: scenarioId,
          policy_branch: schemeId,
          tick,
          offset: frameBytes * frameOrdinal,
          length: frameBytes,
        })
        frameOrdinal += 1
      }
    }
  }
  const manifest = {
    schema_version: VISUALIZATION_SCHEMA,
    run_id: envelope.run_id,
    outer_result_sha256: envelope.result_sha256,
    domain_result_sha256: envelope.visualization_asset.domain_result_sha256,
    binary_sha256: binaryHash,
    byte_length: byteLength,
    record_stride_bytes: 4,
    frame_count: 240,
    frames: index,
  }
  return manifest
}

test('v2 is a componentized routed view and the main entry points to it', () => {
  [
    [viewPath, viewSource],
    [workbenchPath, workbenchSource],
    [executionPanelPath, executionPanelSource],
    ...componentPaths.map((path, index) => [path, componentSources[index]]),
  ].forEach(([path, source], index) => {
    const parsed = parse(source, { filename: path })
    assert.deepEqual(parsed.errors, [])
    assert.ok(parsed.descriptor.template)
    assert.ok(parsed.descriptor.scriptSetup)
    assert.ok(parsed.descriptor.styles.length)
    const script = compileScript(parsed.descriptor, { id: `arena-v2-${index}` })
    const template = compileTemplate({
      id: `arena-v2-${index}`,
      filename: path,
      source: parsed.descriptor.template.content,
      compilerOptions: {
        bindingMetadata: script.bindings,
      },
    })
    assert.deepEqual(template.errors, [])
  })
  for (const component of [
    'ArenaParticleField',
    'ArenaCascadeGraph',
    'ArenaTruthObservation',
    'ArenaGamePanel',
    'ArenaPolicyChart',
    'ArenaAuditPanel',
  ]) {
    assert.match(viewSource, new RegExp(component))
  }
  assert.match(routerSource, /path: '\/campus-pulse\/governance-arena-v2'/)
  assert.match(routerSource, /component: GovernanceArenaV2View/)
  assert.match(routerSource, /path: '\/campus-pulse\/governance-arena'/)
  assert.doesNotMatch(appSource, /to="\/campus-pulse\/governance-arena-v2"/)
  assert.match(routerSource, /path: '\/campus-pulse\/archive\/competition-final'/)
  assert.match(loaderSource, /resultPayload\?\.result \|\| resultPayload/)
  assert.match(workbenchSource, /value="adaptive_particle_population"/)
  assert.match(workbenchSource, /1_728/)
  assert.match(executionPanelSource, /GOVERNANCE_RESULT_V4_SCHEMA/)
  assert.match(executionPanelSource, /query: \{ run_id: props\.run\.run_id \}/)
})

test('result-v4 adapter enforces five branches, 24 ticks and aggregate-only privacy', () => {
  const binary = fixtureBinary()
  const binaryHash = hashBuffer(Buffer.from(binary))
  const envelope = fixtureEnvelope(binaryHash, binary.byteLength)
  const normalized = normalizeGovernanceArenaV2(envelope)
  assert.equal(normalized.domain.schema_version, DOMAIN_SCHEMA)
  assert.equal(normalized.domain.scenarios.lecture_external_incident_shock
    .branches.D.timeline.length, 24)
  assert.throws(
    () => normalizeGovernanceArenaV2(envelope.domain_result),
    GovernanceArenaDataError,
  )
  const leaked = structuredClone(envelope)
  leaked.domain_result.sampled_episode_ids = ['hidden']
  assert.throws(
    () => normalizeGovernanceArenaV2(leaked),
    /公共结果禁止字段/,
  )
})

test('result → response-hashed manifest → binary chain fails closed and reads real frames', async () => {
  const binary = fixtureBinary()
  const binaryHash = hashBuffer(Buffer.from(binary))
  const envelope = fixtureEnvelope(binaryHash, binary.byteLength)
  const normalized = normalizeGovernanceArenaV2(envelope)
  const manifest = fixtureManifest(envelope, binaryHash, binary.byteLength)
  const manifestHash = hashBuffer(
    Buffer.from(`${canonicalJson(manifest)}\n`),
  )
  const validated = validateGovernanceVisualizationV2(
    manifest,
    normalized.aggregate,
  )
  await verifyGovernanceVisualizationManifest(validated, manifestHash)
  await verifyGovernanceVisualizationBinary(binary, validated)
  const reader = createParticleFrameReader(binary, validated)
  assert.equal(reader.count, 10_000)
  assert.ok(Math.abs(reader.readLayout(0).x - 0.5) < 0.01)
  const frame = reader.readFrame(
    'lecture_external_incident_shock',
    'natural',
    0,
  )
  assert.ok(Math.abs(frame.read(0).belief - (64 / 127)) < 1e-12)
  assert.equal(frame.read(0).public_action, 1)

  const corruptBinary = binary.slice(0)
  new Uint8Array(corruptBinary)[100] ^= 1
  await assert.rejects(
    verifyGovernanceVisualizationBinary(corruptBinary, validated),
    /SHA-256/,
  )
  const corruptManifest = structuredClone(validated)
  corruptManifest.frames[0].tick = 1
  await assert.rejects(
    verifyGovernanceVisualizationManifest(corruptManifest, manifestHash),
    /响应哈希/,
  )
})

test('mobile styles prevent fixed desktop columns at 390×844', () => {
  assert.match(viewSource, /@media \(max-width: 420px\)/)
  assert.match(viewSource, /width: calc\(100% - 20px\)/)
  assert.match(viewSource, /overflow-x: hidden/)
  assert.doesNotMatch(viewSource, /min-width:\s*[4-9]\d\dpx/)
})

test('the demo states the hybrid-driver and zero-provider boundaries', () => {
  for (const requiredText of [
    '真实状态粒子',
    '预算化语义观测',
    '普通模型更新',
    'Provider / 真实动作',
    'ZERO PROVIDER',
    '1,000 个审阅论坛 episode，不是真实学生',
    '10,000 个状态粒子，不计独立证据',
    '模型条件差异，不作因果结论',
  ]) {
    assert.ok(viewSource.includes(requiredText), `missing boundary: ${requiredText}`)
  }
})

test('result-v4 accepts canonical JSON scenario object-key ordering', () => {
  const binary = fixtureBinary()
  const binaryHash = hashBuffer(Buffer.from(binary))
  const envelope = fixtureEnvelope(binaryHash, binary.byteLength)
  envelope.domain_result.scenarios = Object.fromEntries(
    Object.entries(envelope.domain_result.scenarios).sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  )
  const normalized = normalizeGovernanceArenaV2(envelope)
  assert.deepEqual(
    Object.keys(normalized.domain.scenarios),
    ['lecture_external_incident_shock', 'governance_legitimacy_dispute'],
  )
})
