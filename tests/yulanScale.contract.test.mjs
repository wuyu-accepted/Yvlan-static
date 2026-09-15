import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

import {
  YULAN_AGGREGATE_SCHEMA,
  YULAN_DOMAIN_SCHEMA,
  YULAN_EXECUTION_MODE,
  YULAN_VISUALIZATION_SCHEMA,
  YuLanScaleDataError,
  normalizeYuLanScale,
  verifyYuLanAggregate,
} from '../src/services/yuLanScaleAdapter.js'

globalThis.crypto ??= webcrypto

const pathFor = (relative) => fileURLToPath(
  new URL(relative, import.meta.url),
)
const viewPath = pathFor('../src/views/YuLanScaleView.vue')
const routerPath = pathFor('../src/router/index.js')
const appPath = pathFor('../src/App.vue')
const loaderPath = pathFor('../src/services/yuLanScaleLoader.js')
const adapterPath = pathFor('../src/services/yuLanScaleAdapter.js')
const stylePath = pathFor('../src/styles/yulan-scale.css')
const componentPaths = [
  '../src/components/campus-pulse/yulan-scale/YuLanActivationPanel.vue',
  '../src/components/campus-pulse/yulan-scale/YuLanEvidencePanel.vue',
  '../src/components/campus-pulse/yulan-scale/YuLanAuditPanel.vue',
  '../src/components/campus-pulse/governance-v2/ArenaGamePanel.vue',
].map(pathFor)

const [
  viewSource,
  routerSource,
  appSource,
  loaderSource,
  adapterSource,
  styleSource,
  ...componentSources
] = await Promise.all([
  viewPath,
  routerPath,
  appPath,
  loaderPath,
  adapterPath,
  stylePath,
  ...componentPaths,
].map((path) => readFile(path, 'utf8')))

const METRICS = [
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
]
const SCENARIOS = [
  'lecture_external_incident_shock',
  'governance_legitimacy_dispute',
]
const BRANCHES = ['natural', 'A', 'B', 'C', 'D']

function point(tick) {
  const phase = tick <= 2
    ? 'baseline'
    : tick <= 7
      ? 'burst'
      : tick <= 17 ? 'spread' : 'decay'
  const truth = Object.fromEntries(
    METRICS.map((key, index) => [key, 0.2 + ((tick + index) % 10) * 0.03]),
  )
  return {
    tick,
    phase,
    truth,
    observed: Object.fromEntries(
      Object.entries(truth).map(([key, mean]) => [
        key,
        {
          mean,
          lower: Math.max(0, mean - 0.04),
          upper: Math.min(1, mean + 0.04),
        },
      ]),
    ),
    uncertainty: {
      particle_ess: 8.5,
      resampling_count: Math.floor(tick / 8),
    },
    probe: {
      budget: [2, 7, 13, 19].includes(tick) ? 32 : 0,
      kish_ess: [2, 7, 13, 19].includes(tick) ? 24.5 : 0,
    },
    diffusion: {
      emissions: 30,
      reads: 100,
      reposts: 12,
      corrections: 5,
      cascade_depth: 2,
      correction_delay: 1,
      bridge_share: 0.2,
      exposure_inequality: 0.2,
    },
    cascade_groups: [{
      source_group: 'archetype-01',
      target_group: 'archetype-02',
      rumor: 2,
      verified: 4,
      bridge: true,
    }],
    actor_observations: {},
  }
}

function resources(branch) {
  return branch === 'natural'
    ? {
        opening: 100,
        consumed: 0,
        committed: 0,
        remaining: 100,
        conserved: true,
      }
    : {
        opening: 100,
        consumed: 20,
        committed: 5,
        remaining: 75,
        conserved: true,
      }
}

function rounds() {
  return [3, 7, 13, 19].map((tick) => ({
    tick,
    resource_after_decision: resources('A'),
    decisions: [
      'governance_authority',
      'service_operator',
      'community_bridge',
    ].map((actor) => ({
      actor,
      selected_action: 'wait',
      selected_action_label: '继续观察',
      execution_delay: 0,
      reason: '仅使用当前主体可见的有限聚合信号。',
      candidate_probabilities: { wait: 1 },
    })),
  }))
}

function aggregateV5() {
  const timelineAggregates = {}
  const governance = {}
  for (const scenarioId of SCENARIOS) {
    timelineAggregates[scenarioId] = {
      label: scenarioId,
      branches: Object.fromEntries(BRANCHES.map((branch) => [
        branch,
        { timeline: Array.from({ length: 24 }, (_, tick) => point(tick)) },
      ])),
    }
    governance[scenarioId] = {
      branches: Object.fromEntries(BRANCHES.map((branch) => [
        branch,
        {
          game_rounds: rounds(),
          resource: resources(branch),
        },
      ])),
      policy_comparison: {
        rows: BRANCHES.map((branch, index) => ({
          branch,
          objective_score: index * 0.01,
          resource_cost: index * 5,
        })),
        pareto_branches: ['D'],
      },
    }
  }
  return {
    schema_version: YULAN_AGGREGATE_SCHEMA,
    run_id: 'run_0123456789abcdef01234567',
    launch_fingerprint: 'launch',
    result_kind: 'budgeted_llm_agent_population_simulation',
    plan_sha256: 'a'.repeat(64),
    execution_provenance: 'emulator_only_development',
    publication_eligible: false,
    domain_result: {
      schema_version: YULAN_DOMAIN_SCHEMA,
      population_identity: {
        schema_version: 'semantic-llm-agent-population-v1',
        llm_agent_count: 1_000,
        particles_per_agent: 10,
        particle_count: 10_000,
        population_sha256: 'b'.repeat(64),
      },
      timeline_aggregates: timelineAggregates,
      speaker_opinion: {},
      observed_posterior: {},
      anchor_trajectories: {},
      emulator_residuals: {},
      branch_differences: {},
      uncertainty: {},
      messaging: {},
      governance,
      audit: {
        formal_writeback_mode: 'observation_only',
        qre_temperature: 0.2,
      },
    },
    visualization_asset: {
      schema_version: YULAN_VISUALIZATION_SCHEMA,
      manifest_sha256: 'c'.repeat(64),
      binary_sha256: 'd'.repeat(64),
      byte_length: 9_600_000,
      frame_count: 240,
      record_stride_bytes: 4,
      domain_result_sha256: 'e'.repeat(64),
    },
    completeness: {
      status: 'complete',
      completed_work_units: 1_728,
      required_work_units: 1_728,
      completed_semantic_slots: 0,
      required_semantic_slots: 13_056,
    },
    budget_usage: {
      provider_request_limit: 26_112,
      provider_requests_used: 0,
      provider_token_limit: 40_000_000,
      provider_tokens_used: 0,
      effective_concurrency_limit: 32,
      peak_concurrency: 0,
    },
    usage: {
      resident_llm_turns: 0,
      governance_llm_turns: 0,
      reviewed_trace_replays: 0,
      live_provider_calls: 0,
      cache_hits: 0,
      provider_tokens: 0,
      emulator_updates: 17_280_000,
      real_governance_actions: 0,
    },
    privacy: {
      raw_text_included: false,
      source_identifiers_included: false,
      record_level_edges_included: false,
      sample_identities_included: false,
      parent_particle_mapping_included: false,
      provider_secrets_included: false,
      runtime_paths_included: false,
      private_actor_observations_included: false,
      unreviewed_free_text_included: false,
    },
    non_claims: Array.from({ length: 7 }, (_, index) => `boundary-${index}`),
    result_sha256: 'f'.repeat(64),
  }
}

test('YuLan-Scale is the single primary route and archives remain addressable', () => {
  assert.match(routerSource, /path: '\/campus-pulse'[\s\S]*component: YuLanScaleView/)
  assert.match(routerSource, /path: '\/campus-pulse\/archive\/competition-final'/)
  assert.match(routerSource, /path: '\/campus-pulse\/governance-arena-v2'/)
  assert.doesNotMatch(appSource, /to="\/campus-pulse\/governance-arena-v2"/)
  assert.doesNotMatch(appSource, /to="\/campus-pulse\/mass-sim"/)
})

test('the unified view and its components compile', () => {
  [
    [viewPath, viewSource],
    ...componentPaths.map((path, index) => [path, componentSources[index]]),
  ].forEach(([path, source], index) => {
    const parsed = parse(source, { filename: path })
    assert.deepEqual(parsed.errors, [])
    const script = compileScript(parsed.descriptor, { id: `yulan-${index}` })
    const template = compileTemplate({
      id: `yulan-${index}`,
      filename: path,
      source: parsed.descriptor.template.content,
      compilerOptions: { bindingMetadata: script.bindings },
    })
    assert.deepEqual(template.errors, [])
  })
})

test('result-v5 exposes one 1000-agent LLM population without inflating fixture turns', () => {
  const normalized = normalizeYuLanScale(aggregateV5())
  assert.equal(normalized.release.executionMode, YULAN_EXECUTION_MODE)
  assert.equal(normalized.release.executionProvenance, 'emulator_only_development')
  assert.equal(normalized.release.publicationEligible, false)
  assert.equal(normalized.release.activation.anchorCount, 16)
  assert.equal(normalized.release.activation.ppsCount, 32)
  assert.equal(normalized.release.activation.traceSlotsTotal, 13_056)
  assert.equal(normalized.release.usage.residentLlmTurns, 0)
  assert.equal(normalized.release.usage.governanceLlmTurns, 0)
  assert.equal(
    normalized.domain.scenarios.lecture_external_incident_shock
      .branches.D.timeline.length,
    24,
  )

  const leaked = aggregateV5()
  leaked.domain_result.anchor_ids = ['private']
  assert.throws(() => normalizeYuLanScale(leaked), YuLanScaleDataError)
})

test('offline result hashes use the exact Python-canonical response bytes', async () => {
  const digest = (value) => createHash('sha256').update(value).digest('hex')
  const domainRaw = '{"opening":100.0}'
  const domainHash = digest(domainRaw)
  const resultBodyRaw = `{"domain_result":${domainRaw},"schema_version":"${YULAN_AGGREGATE_SCHEMA}","visualization_asset":{"domain_result_sha256":"${domainHash}"}}`
  const resultHash = digest(resultBodyRaw)
  const raw = `{"domain_result":${domainRaw},"result_sha256":"${resultHash}","schema_version":"${YULAN_AGGREGATE_SCHEMA}","visualization_asset":{"domain_result_sha256":"${domainHash}"}}`
  const payload = JSON.parse(raw)
  Object.defineProperty(payload, '__rawCanonicalJson', {
    value: raw,
    configurable: true,
    enumerable: false,
  })
  await verifyYuLanAggregate(payload)

  Object.defineProperty(payload, '__rawCanonicalJson', {
    value: raw.replace('100.0', '101.0'),
    configurable: true,
    enumerable: false,
  })
  await assert.rejects(
    () => verifyYuLanAggregate(payload),
    YuLanScaleDataError,
  )
})

test('development provenance cannot claim publication eligibility', () => {
  const invalid = aggregateV5()
  invalid.publication_eligible = true
  assert.throws(
    () => normalizeYuLanScale(invalid),
    /发布资格与执行 provenance 矛盾/,
  )
})

test('loader and UI preserve provenance and fail-closed boundaries', () => {
  for (const marker of [
    'yulan-scale-v1.json',
    'LEGACY v2 · DEVELOPMENT COMPATIBILITY',
    'normalizeYuLanScale',
    'verifyYuLanVisualizationManifest',
    'verifyYuLanVisualizationBinary',
  ]) {
    assert.ok(
      `${loaderSource}\n${adapterSource}`.includes(marker),
      `missing loader marker: ${marker}`,
    )
  }
  for (const text of [
    '1,000 个持久 LLM 智能体',
    '16 个纵向锚点 + 32 个轮换 PPS',
    '不属于 LLM turns',
    'LLM 行为代理',
    '三主体 LLM 治理协调',
    '真实 LLM / 审阅 trace',
    '不作真实政策因果结论',
  ]) {
    assert.ok(
      `${viewSource}\n${componentSources.join('\n')}`.includes(text),
      `missing UI boundary: ${text}`,
    )
  }
})

test('390×844 layout has an explicit no-overflow mobile contract', () => {
  assert.match(styleSource, /@media \(max-width: 420px\)/)
  assert.match(styleSource, /width: calc\(100% - 20px\)/)
  assert.match(styleSource, /overflow-x: hidden/)
  assert.match(
    styleSource,
    /body\.yulan-scale-active\)[\s\S]*height: auto;[\s\S]*overflow-y: auto;/,
  )
  assert.doesNotMatch(styleSource, /min-width:\s*[4-9]\d\dpx/)
})
