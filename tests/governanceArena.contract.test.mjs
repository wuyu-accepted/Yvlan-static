import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from '@vue/compiler-sfc'

const viewPath = fileURLToPath(
  new URL('../src/views/GovernanceArenaView.vue', import.meta.url),
)
const routerPath = fileURLToPath(
  new URL('../src/router/index.js', import.meta.url),
)
const resultPath = fileURLToPath(
  new URL(
    '../public/campus-pulse-data/governance-arena-v1.json',
    import.meta.url,
  ),
)

const [viewSource, routerSource, resultSource] = await Promise.all([
  readFile(viewPath, 'utf8'),
  readFile(routerPath, 'utf8'),
  readFile(resultPath, 'utf8'),
])
const result = JSON.parse(resultSource)

test('governance arena is a valid routed Vue view', () => {
  const parsed = parse(viewSource, { filename: viewPath })
  assert.deepEqual(parsed.errors, [])
  assert.ok(parsed.descriptor.template)
  assert.ok(parsed.descriptor.scriptSetup)
  assert.ok(parsed.descriptor.styles.length)
  assert.match(routerSource, /path: '\/campus-pulse\/governance-arena'/)
  assert.match(routerSource, /component: GovernanceArenaView/)
})

test('public arena identity is frozen, aggregate-only and provider-free', () => {
  assert.equal(
    result.schema_version,
    'campus-pulse-governance-arena-result-v1',
  )
  assert.equal(result.population_identity.population_size, 1000)
  assert.equal(result.population_identity.particle_count, 10_000)
  assert.equal(result.usage.provider_calls, 0)
  assert.equal(result.usage.real_governance_actions, 0)
  assert.match(result.result_sha256, /^[0-9a-f]{64}$/)
  for (const forbidden of [
    '"micro_agent_id"',
    '"source_id"',
    '"edges"',
    '"states"',
    '"raw_text"',
    '"evidence_record_ids"',
    '"api_key"',
    '"password"',
  ]) {
    assert.ok(
      !resultSource.toLowerCase().includes(forbidden),
      `public arena leaked ${forbidden}`,
    )
  }
})

test('both scenarios preserve the paired 16-tick three-branch design', () => {
  assert.deepEqual(
    result.scheme_ids,
    ['natural', 'rapid_transparency', 'participatory_service'],
  )
  for (const scenario of Object.values(result.scenarios)) {
    assert.equal(scenario.paired_seed_count, 8)
    assert.equal(scenario.shared_baseline_sha256_by_seed.length, 8)
    for (const schemeId of result.scheme_ids) {
      const branch = scenario.branches[schemeId]
      assert.equal(branch.timeline.length, 16)
      assert.equal(branch.resource.conserved, true)
      assert.equal(branch.timeline[0].phase, 'baseline')
      assert.equal(branch.timeline[1].phase, 'baseline')
      for (const metric of ['attention', 'concern', 'trust', 'satisfaction']) {
        const drift = Math.abs(
          branch.timeline[1].metrics[metric].mean
          - branch.timeline[0].metrics[metric].mean,
        )
        assert.ok(drift < 0.02, `${schemeId} baseline drifted on ${metric}`)
      }
    }
  }
})

test('information diffusion and bounded multi-actor games are explicit', () => {
  assert.equal(
    result.diffusion_contract.schema_version,
    'campus-pulse-competing-information-diffusion-v1',
  )
  assert.equal(
    result.game_contract.solution_concept,
    'bounded_sequential_best_response',
  )
  assert.equal(result.game_contract.nash_equilibrium_claimed, false)
  for (const scenario of Object.values(result.scenarios)) {
    const natural = scenario.branches.natural.timeline
    assert.ok(
      natural.some(point => point.diffusion.rumor_transmissions > 0),
    )
    for (const schemeId of [
      'rapid_transparency',
      'participatory_service',
    ]) {
      const rounds = scenario.branches[schemeId].game_rounds
      assert.deepEqual(rounds.map(round => round.tick), [3, 7, 11])
      assert.ok(rounds.every(round => round.decisions.length === 3))
      assert.ok(
        rounds.every(round => (
          round.decisions.every(decision => (
            decision.candidate_utilities.length >= 3
          ))
        )),
      )
    }
  }
})

test('conditional recommendation is computed from the frozen objective', () => {
  for (const scenario of Object.values(result.scenarios)) {
    const policy = scenario.policy_comparison
    assert.ok(
      Math.abs(
        Object.values(policy.objective.weights)
          .reduce((sum, value) => sum + Math.abs(value), 0)
        - 1,
      ) < 1e-12,
    )
    const best = [...policy.objective.candidate_evaluations]
      .sort((left, right) => (
        right.objective_score - left.objective_score
        || right.scheme_id.localeCompare(left.scheme_id)
      ))[0]
    assert.equal(
      policy.conditional_recommendation.recommended_scheme_id,
      best.scheme_id,
    )
  }
  assert.equal(
    result.scenarios.lecture_external_incident_shock
      .policy_comparison.conditional_recommendation.recommended_scheme_id,
    'rapid_transparency',
  )
  assert.equal(
    result.scenarios.tongzhou_governance_information_shock
      .policy_comparison.conditional_recommendation.recommended_scheme_id,
    'participatory_service',
  )
})

test('profile gates and opinion audit remain visible and conservative', () => {
  const audit = result.profile_audit
  assert.ok(audit.reviewed_stance_modal_alignment_weight >= 0.95)
  assert.equal(audit.risk_reporting_is_monotonic, true)
  assert.ok(audit.background_signal_population_weight > 0)
  assert.ok(audit.governance_risk_signal_population_weight > 0)
  assert.equal(audit.invented_demographics, false)
  assert.equal(audit.stable_personality_claimed, false)
  for (const requiredText of [
    'archetype-16 禁止行动',
    'archetype-09 仅可读 / 上报',
    '不宣称纳什均衡',
    '结果为模型条件差异，不作因果结论',
    '10,000 粒子仅作视觉压力层',
    'OFFLINE · ZERO PROVIDER',
  ]) {
    assert.ok(viewSource.includes(requiredText), `missing UI boundary: ${requiredText}`)
  }
})

test('current-tick resource accounting is not replaced by final spend', () => {
  assert.match(viewSource, /const resourceAtTick = computed/)
  assert.match(viewSource, /currentRound\.value\?\.resource_after \?\? 100/)
  assert.match(viewSource, /当前已用 \{\{ 100 - resourceAtTick \}\}/)
  assert.doesNotMatch(viewSource, /<strong>\{\{ branch\.resource\.remaining \}\}/)
})
