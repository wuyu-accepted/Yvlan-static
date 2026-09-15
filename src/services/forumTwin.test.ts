import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FORUM_TWIN_AGGREGATE_SCHEMA,
  FORUM_TWIN_DOMAIN_SCHEMA,
  FORUM_TWIN_MANIFEST_SCHEMA,
  ForumTwinDataError,
  sealForumTwin,
  validateForumTwinAggregate,
  validateForumTwinDevelopmentStatus,
  validateForumTwinDomain,
  verifyForumTwinManifestHash,
  verifyForumTwinResultFileHash,
} from './forumTwin.ts'
import { createHash } from 'node:crypto'

const h = (character: string) => character.repeat(64)
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
const canonical = (value: any): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value).sort().map(key => (
    `${JSON.stringify(key)}:${canonical(value[key])}`
  )).join(',')}}`
}
const scenarios = [
  {
    scenario_id: 'lecture_external_incident_shock',
    label: '外部不确定事件传播',
  },
  {
    scenario_id: 'governance_legitimacy_dispute',
    label: '治理正当性争议',
  },
]

function fixture() {
  const public_threads: any[] = []
  const public_messages: any[] = []
  const claims: any[] = []
  const parallel_forums: Record<string, any> = {}
  for (const scenario of scenarios) {
    parallel_forums[scenario.scenario_id] = {}
    for (const branch of ['natural', 'D']) {
      const suffix = `${scenario.scenario_id}-${branch}`
      const threadId = `thread:${suffix}`
      const messageId = `message:${suffix}`
      const claimId = `claim:${suffix}`
      const displayId = `FT:${suffix}`
      public_messages.push({
        schema: 'campus-pulse-forum-message-v1',
        message_id: messageId,
        thread_id: threadId,
        scenario_id: scenario.scenario_id,
        branch,
        agent_display_id: displayId,
        source_agent_display_id: displayId,
        parent_message_id: null,
        quote_message_id: null,
        action: 'post',
        visible_text: '这是经过审阅的合成论坛消息。',
        topic: '校园事件',
        stance: 'uncertain',
        emotion: 'concerned',
        evidence_status: 'unverified',
        confidence: 0.5,
        claim_id: claimId,
        claim_operation: 'create',
        correction_target_claim_id: null,
        created_tick: 0,
        ttl: 24,
        moderation_status: 'accepted',
        provenance: 'authorized_live_llm',
      })
      public_threads.push({
        thread_id: threadId,
        board: '校园广场',
        root_message_id: messageId,
        scenario_id: scenario.scenario_id,
        branch,
        created_tick: 0,
        status: 'open',
        topic: '校园事件',
        need: '求证',
        claim_ids: [claimId],
        participant_count: 1,
        reply_count: 0,
        last_active_tick: 23,
        provenance_kind: 'authorized_live_llm',
      })
      claims.push({
        claim_id: claimId,
        thread_id: threadId,
        claim_summary: '一个待核验的合成主张',
        status: 'unverified',
        first_seen_tick: 0,
        last_seen_tick: 23,
        created_by_message_id: messageId,
        parent_claim_id: null,
        supporting_message_ids: [messageId],
        challenging_message_ids: [],
        correction_target_claim_id: null,
        evidence_reference: null,
      })
      parallel_forums[scenario.scenario_id][branch] = {
        featured_thread_ids: [threadId],
        timeline: Array.from({ length: 24 }, (_, tick) => ({
          tick,
          phase: tick < 3 ? 'baseline' : tick < 8 ? 'burst' : tick < 18 ? 'spread' : 'decay',
          active_thread_ids: [threadId],
          activated_residents: tick < 2 ? 24 : tick === 2 ? 48 : tick < 8 ? 64 : tick < 18 ? 48 : 32,
          activated_governance: branch === 'D' && [3, 7, 13, 19].includes(tick) ? 3 : 0,
          public_message_count: 1,
          claim_count: 1,
          correction_count: 0,
          help_request_count: 0,
          pps_kish_ess: 24,
          metrics: { concern: 0.5, trust: 0.5 },
        })),
      }
    }
  }
  const domain = {
    schema_version: FORUM_TWIN_DOMAIN_SCHEMA,
    scenarios,
    parallel_forums,
    public_threads,
    public_messages,
    claims,
    governance: [],
    sampling: {
      anchors: 16,
      pps_budget: 32,
      scheduler_recall: 0.94,
      kish_ess_range: [20, 28],
      unique_activated_agents: 520,
    },
    intervals: {},
    llm_usage: {
      resident_turns: 15776,
      governance_turns: 768,
      live_provider_turns: 16544,
      trace_replay_turns: 0,
      cache_turns: 0,
      provider_calls: 16544,
      provider_tokens: 100000,
      max_resident_activation: 64,
      max_total_activation: 67,
    },
    ecology_validation: {},
    ablations: {},
    hero_gates: {},
    audit: {
      llm_agent_count: 1000,
      particle_count: 10000,
      emulator_public_messages: 0,
      real_governance_actions: 0,
      public_display_profiles: [{
        display_id: 'FT:profile:1',
        primary_macro_role: '求证者',
        micro_interaction_role: '谨慎追问者',
        episode_focus: '先核对证据，再决定是否转发',
        topic_portfolio: ['校园事件'],
        need_portfolio: ['可信信息'],
        language_form: '短句',
        reply_function: '追问',
        information_density: '中等',
      }],
    },
  }
  const aggregate = {
    schema_version: FORUM_TWIN_AGGREGATE_SCHEMA,
    run_id: `run_${'1'.repeat(24)}`,
    launch_fingerprint: h('1'),
    result_kind: 'llm_forum_twin_simulation',
    plan_sha256: h('2'),
    execution_provenance: 'authorized_live_llm',
    publication_eligible: true,
    domain_result: domain,
    visualization_asset: {
      schema_version: FORUM_TWIN_MANIFEST_SCHEMA,
      manifest_sha256: h('3'),
      domain_result_sha256: h('4'),
      public_forum_sha256: h('5'),
    },
    completeness: {
      status: 'complete',
      completed_primary_slots: 16544,
      required_primary_slots: 16544,
    },
    budget_usage: {
      primary_slot_limit: 16544,
      provider_request_limit: 33088,
      provider_token_limit: 80000000,
      peak_resident_turns_per_tick: 64,
      peak_total_turns_per_tick: 67,
    },
    usage: { provider_calls: 16544, provider_tokens: 100000 },
    privacy: { scan_passed: true },
    non_claims: ['Synthetic LLM agents are not real students.'],
    result_sha256: h('6'),
  }
  const asset = { asset_id: 'thread-batch-1', sha256: h('7'), compressed_bytes: 123 }
  const manifest = {
    schema_version: FORUM_TWIN_MANIFEST_SCHEMA,
    run_id: aggregate.run_id,
    result_sha256: h('6'),
    domain_result_sha256: h('4'),
    public_forum_sha256: h('5'),
    thread_batches: [asset],
    claim_batches: [],
    particle_frames: [],
    propagation_matrices: [],
    total_compressed_bytes: 123,
    asset_integrity: {
      verified: true,
      verification_method: 'sealed_package_sha256',
    },
    manifest_sha256: h('3'),
  }
  return { aggregate, domain, manifest }
}

test('maps backend public_view/result field names without fabricating content', () => {
  const { aggregate, manifest } = fixture()
  const loaded = sealForumTwin(aggregate, manifest, h('3'), {
    mode: 'offline', label: 'TEST', run_id: null,
  })
  const message = loaded.messages[0]
  const thread = loaded.threads[0]
  const claim = loaded.claims[0]
  assert.equal(message.source_display_id, aggregate.domain_result.public_messages[0].agent_display_id)
  assert.deepEqual(message.claim_ids, [aggregate.domain_result.public_messages[0].claim_id])
  assert.equal(message.provenance.kind, 'authorized_live_llm')
  assert.deepEqual(thread.message_ids, [message.message_id])
  assert.equal(thread.branch_id, aggregate.domain_result.public_threads[0].branch)
  assert.equal(claim.summary, aggregate.domain_result.claims[0].claim_summary)
  assert.equal(claim.scenario_id, thread.scenario_id)
  assert.equal(loaded.profiles[0].macro_role, '求证者')
  assert.deepEqual(loaded.profiles[0].interaction_style, ['短句', '追问', '中等'])
})

test('accepts the frozen result envelope and 16,544-slot contract', () => {
  const { aggregate } = fixture()
  assert.equal(validateForumTwinAggregate(aggregate).publication_eligible, true)
})

test('maps the pure ForumMessage public_view provenance object', () => {
  const { domain } = fixture()
  domain.public_messages[0].provenance = {
    kind: 'authorized_live_llm',
    prompt_sha256: h('a'),
    response_sha256: h('b'),
    model: 'gpt-5.4-mini',
    trace_release_sha256: null,
  }
  const normalized = validateForumTwinDomain(domain)
  assert.equal(normalized.public_messages[0].provenance.response_sha256, h('b'))
  assert.equal(normalized.public_messages[0].provenance.model, 'gpt-5.4-mini')
})

test('rejects mismatched source display aliases', () => {
  const { domain } = fixture()
  domain.public_messages[0].source_agent_display_id = 'FT:other'
  assert.throws(() => validateForumTwinDomain(domain), /不一致/)
})

test('rejects a duplicate public action by one agent in one tick', () => {
  const { domain } = fixture()
  const duplicate = structuredClone(domain.public_messages[0])
  duplicate.message_id = 'message:duplicate'
  domain.public_messages.push(duplicate)
  assert.throws(() => validateForumTwinDomain(domain), /多个公开动作/)
})

test('rejects superseded messages from public results', () => {
  const { domain } = fixture()
  domain.public_messages[0].moderation_status = 'superseded'
  assert.throws(() => validateForumTwinDomain(domain), /superseded/)
})

test('rejects development provenance and hidden governance truth', () => {
  const first = fixture()
  first.aggregate.execution_provenance = 'emulator_only_development'
  assert.throws(() => validateForumTwinAggregate(first.aggregate), ForumTwinDataError)
  const second = fixture()
  second.domain.governance = [{ hidden_truth: { concern: 0.9 } }]
  assert.throws(() => validateForumTwinDomain(second.domain), /禁止字段|不得进入治理主体/)
})

test('rejects a mismatched result-to-manifest digest chain', () => {
  const { aggregate, manifest } = fixture()
  manifest.public_forum_sha256 = h('9')
  assert.throws(() => sealForumTwin(aggregate, manifest, h('3'), {
    mode: 'offline', label: 'TEST', run_id: null,
  }), /摘要链不一致/)
})

test('recomputes the stable visualization manifest identity', async () => {
  const { manifest } = fixture()
  const identity = Object.fromEntries(Object.entries(manifest).filter(([key]) => (
    key !== 'manifest_sha256' && key !== 'result_sha256'
  )))
  const expected = sha(canonical(identity))
  manifest.manifest_sha256 = expected
  assert.equal(await verifyForumTwinManifestHash(manifest, expected), expected)
  manifest.total_compressed_bytes += 1
  await assert.rejects(
    () => verifyForumTwinManifestHash(manifest, expected),
    ForumTwinDataError,
  )
})

test('recomputes the exact offline result file bytes', async () => {
  const raw = '{"publication_eligible":true}'
  const expected = sha(raw)
  assert.equal(await verifyForumTwinResultFileHash(raw, expected), expected)
  await assert.rejects(
    () => verifyForumTwinResultFileHash(`${raw}\n`, expected),
    /result file SHA-256 mismatch/,
  )
})

test('accepts only the disclosed development backend status', () => {
  const status = {
    schema_version: 'campus-pulse-forum-twin-frontend-status-v1',
    generated_at: '2026-08-07',
    backend_loop_ready: true,
    publication_eligible: false,
    model_sha256: h('a'),
    population: {
      llm_agents: 1000,
      particles: 10000,
      current_source: 'reviewed_1000_episode_population_bridge',
    },
    engineering_evidence: {
      scenarios: 2,
      branches: 5,
      paired_seeds: 8,
      ticks: 24,
      semantic_slots: 16544,
      particle_updates: 17280000,
      provider_calls: 0,
      public_fixture_messages: 0,
      full_result_sha256: h('b'),
      evidence_sha256: h('c'),
    },
    live_pilot_evidence: {
      parallel_forum_available: true,
      closed_loop_available: true,
      real_llm_ablation_available: true,
      disclosure: '独立证据，不进行实验拼接。',
    },
    blocking_gates: ['remote_corpus_snapshot'],
    claim_boundary: ['开发状态不包含论坛文字。'],
  }
  assert.equal(validateForumTwinDevelopmentStatus(status).backend_loop_ready, true)
  assert.throws(() => validateForumTwinDevelopmentStatus({
    ...status,
    publication_eligible: true,
  }), /边界非法/)
  assert.throws(() => validateForumTwinDevelopmentStatus({
    ...status,
    engineering_evidence: {
      ...status.engineering_evidence,
      public_fixture_messages: 1,
    },
  }), /不符合冻结合同/)
})
