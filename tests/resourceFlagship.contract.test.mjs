import test from 'node:test'
import assert from 'node:assert/strict'

import { validateResourceFlagshipSummary } from '../src/services/resourceFlagship.ts'

const branches = ['Natural', 'A', 'B', 'C', 'D']
const hash = 'a'.repeat(64)

function fixture() {
  return {
    schema_version: 'campus-pulse-resource-flagship-public-summary-v1',
    scenario_id: 'governance_legitimacy_dispute',
    scenario_title: '暑期住宿床位分配正当性争议',
    run_id: 'run_example',
    model: 'gpt-5.6-luna',
    start_tick: 3,
    end_tick: 15,
    shared_through_tick: 4,
    primary_slots: 2592,
    validation_scope: 'four_seed_full',
    full_scope_complete: true,
    planned_full_seeds: [1, 2, 3, 4],
    cost_controlled_stop_after_three_seeds: false,
    population_size: 1000,
    particle_count: 10000,
    seeds: [1, 2, 3, 4],
    branches,
    branch_labels: Object.fromEntries(branches.map(branch => [branch, `${branch} label`])),
    canonical_seed: 1,
    canonical_branch_summaries: Object.fromEntries(branches.map(branch => [branch, { claims: 4 }])),
    featured_mechanisms: {
      governance_uptake: {
        branch: 'C',
        governance_text: '请公开材料复核规则与答复时限。',
        resident_response_text: '规则更清楚了，但仍需说明查询入口。',
      },
      service_feedback: {
        branch: 'A',
        help_text: '提交申诉后多久答复？',
        receipt_text: '问题已进入服务队列。',
        follow_up_text: '收到回执，请继续说明查询方式。',
      },
    },
    branch_aggregate_summaries: Object.fromEntries(branches.map(branch => [branch, {
      claims: { mean: 4, min: 3, max: 5 },
      resident_public_messages: { mean: 120, min: 110, max: 130 },
    }])),
    paired_state_difference_intervals_95_vs_Natural: Object.fromEntries(branches.slice(1).map(branch => [branch, {
      trust: { mean: 0.01, lower: -0.01, upper: 0.03 },
      concern: { mean: -0.01, lower: -0.03, upper: 0.01 },
      satisfaction: { mean: 0.02, lower: 0.00, upper: 0.04 },
    }])),
    automatic_checks_passed: true,
    story_gate: { correction_chain_present: true },
    story_gate_passed: true,
    usage: { semantic_turns: 2592, provider_calls: 2000, provider_tokens: 12000000, cache_hits: 500, unknown_outcomes: 0 },
    result_sha256: hash,
    artifact_sha256: hash,
  }
}

test('resource flagship summary accepts the frozen four-seed five-world contract', () => {
  const result = validateResourceFlagshipSummary(fixture(), hash)
  assert.equal(result.primary_slots, 2592)
  assert.equal(result.seeds.length, 4)
  assert.equal(result.branch_aggregate_summaries.D.claims.mean, 4)
})

test('resource flagship summary accepts the cost-bounded three-seed product validation', () => {
  const value = fixture()
  value.primary_slots = 2028
  value.validation_scope = 'three_seed_product_validation'
  value.full_scope_complete = false
  value.seeds = [1, 2, 3]
  value.cost_controlled_stop_after_three_seeds = true
  value.usage.semantic_turns = 2028
  const result = validateResourceFlagshipSummary(value, hash)
  assert.equal(result.primary_slots, 2028)
  assert.equal(result.seeds.length, 3)
})

test('resource flagship summary rejects branch drift and private fields', () => {
  const wrongOrder = fixture()
  wrongOrder.branches = [...branches].reverse()
  assert.throws(() => validateResourceFlagshipSummary(wrongOrder, hash), /五分支合同/)

  const privateField = fixture()
  privateField.raw_prompt = 'forbidden'
  assert.throws(() => validateResourceFlagshipSummary(privateField, hash), /公共禁止字段/)
})
