import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const resultPath = resolve('public/campus-pulse-data/resource-policy-live-r1.json')
const hashPath = resolve('public/campus-pulse-data/resource-policy-live-r1.sha256')
const raw = readFileSync(resultPath, 'utf8')
const payload = JSON.parse(raw)
const result = payload.result
const privateSummaryPath = resolve('public/campus-pulse-data/private-channel-summary-public-v1.json')
const privateSummaryRaw = readFileSync(privateSummaryPath, 'utf8')
const privateSummary = JSON.parse(privateSummaryRaw)

test('resource-policy Hero bytes, schema and live-LLM budget are sealed', () => {
  const actual = createHash('sha256').update(raw).digest('hex')
  const expected = readFileSync(hashPath, 'utf8').trim()
  assert.equal(actual, expected)
  assert.equal(result.schema_version, 'campus-pulse-resource-allocation-sandbox-result-v1')
  assert.equal(result.scenario_id, 'governance_legitimacy_dispute')
  assert.equal(result.population_size, 1_000)
  assert.equal(result.particle_count, 10_000)
  assert.equal(result.primary_slots, 492)
  assert.equal(result.resident_slots, 480)
  assert.equal(result.governance_actor_slots, 12)
  assert.equal(payload.launch.model, 'gpt-5.6-luna')
  assert.equal(payload.live_usage.semantic_turns, 492)
  assert.equal(payload.live_usage.provider_calls, 501)
  assert.equal(payload.live_usage.provider_tokens, 3_353_082)
  assert.equal(payload.live_usage.unknown_outcomes, 0)
})

test('resource-policy Hero is a fair Natural/A/D fork with no Dynamics speech or hard-coded winner', () => {
  assert.equal(result.shared_through_tick, 4)
  assert.equal(result.worlds_share_exact_T4_checkpoint, true)
  assert.equal(result.public_feed_mechanism, 'global_hot_top10_plus_latest_v1')
  assert.equal(result.public_feed_personalized, false)
  assert.equal(result.public_feed_relationship_graph_controlled, false)
  assert.equal(result.dynamics_public_messages, 0)
  assert.equal(result.scheme_bonus, 0)
  assert.equal(result.winner_precommitted, false)
  for (const name of ['Natural', 'A', 'D']) {
    const branch = result.branches[name]
    assert.equal(branch.timeline.length, 11)
    assert.equal(branch.emulator_public_messages, 0)
    assert.ok(branch.messages.length > 0)
    assert.ok(branch.messages.every((message) => message.provenance?.kind === 'authorized_live_llm'))
    assert.ok(branch.governance_rounds.every((round) => round.uses_hidden_truth === false))
  }
})

test('resource-policy Hero preserves the non-precommitted mechanism result', () => {
  const branches = result.branches
  assert.deepEqual(
    Object.fromEntries(Object.entries(branches).map(([name, branch]) => [name, branch.messages.length])),
    { A: 183, D: 189, Natural: 182 },
  )
  const complete = (branch, key) => branch.mechanism_chains[key].filter((item) => item.complete)
  assert.equal(complete(branches.Natural, 'help_service_feedback_chains').length, 0)
  assert.equal(complete(branches.A, 'help_service_feedback_chains').length, 0)
  assert.equal(complete(branches.D, 'help_service_feedback_chains').length, 2)
  assert.equal(complete(branches.D, 'governance_uptake_chains').length, 2)
})

test('resource-policy public result excludes secret and raw-content fields', () => {
  const forbidden = new Set([
    'api_key', 'password', 'secret', 'raw_prompt', 'raw_response', 'provider_body',
    'request_body', 'response_body', 'source_id', 'local_path', 'file_path',
    'sample_identity', 'private_feed',
  ])
  const hits = []
  const visit = (value, path = '$') => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`))
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.has(key.toLowerCase())) hits.push(`${path}.${key}`)
      visit(child, `${path}.${key}`)
    }
  }
  visit(payload)
  assert.deepEqual(hits, [])
})

test('resource-policy private-channel companion is sealed, complete and aggregate-only', () => {
  const expected = readFileSync(resolve('public/campus-pulse-data/private-channel-summary-public-v1.sha256'), 'utf8').trim()
  assert.equal(createHash('sha256').update(privateSummaryRaw).digest('hex'), expected)
  assert.equal(privateSummary.schema_version, 'campus-pulse-private-channel-summary-public-v1')
  assert.equal(privateSummary.frozen_public_result_sha256, '5712b0af9a757bc38bb1286b362d868f8e49c7eae5a42108569c9818922b5662')
  assert.equal(privateSummary.frozen_public_timeline_modified, false)
  assert.equal(privateSummary.current_final_run_execution_totals.provider_calls_unknown, 0)
  for (const panel of Object.values(privateSummary.panels)) {
    assert.equal(panel.completed_primary_slots, panel.planned_primary_slots)
    for (const branch of Object.values(panel.branches)) {
      assert.deepEqual(branch.messages_by_tick.map((row) => row.tick), [4, 5, 6, 7, 8, 9, 10])
      assert.deepEqual(branch.channel_messages_by_tick.map((row) => row.tick), [4, 5, 6, 7, 8, 9, 10])
      assert.deepEqual(branch.unique_active_senders_by_tick.map((row) => row.tick), [4, 5, 6, 7, 8, 9, 10])
      assert.ok(branch.channel_messages_by_tick.every((row, index) => row.direct_message_count + row.group_message_count === branch.messages_by_tick[index].message_count))
    }
  }
  const serialized = JSON.stringify(privateSummary).toLowerCase()
  for (const forbidden of ['"agent_id"', '"conversation_id"', '"message_id"', '"visible_text"', '"prompt"', '"api_key"']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden))
  }
})
