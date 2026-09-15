import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import {
  normalizeTick,
  returnToResultLocation,
  workspaceFromQuery,
  workspaceToQuery,
  forumInvestigationLocation,
  DEFAULT_METRIC,
} from '../src/campus-pulse/forum/forumWorkspaceState.ts'
import {
  agentActivity,
  buildForumInvestigation,
  governanceAtTick,
  metricLabel,
  threadCounterpart,
  visibleClaims,
  visibleMessagesForThread,
  visibleThreads,
} from '../src/campus-pulse/forum/forumInvestigation.ts'
import { adaptHeroResult } from '../src/campus-pulse/source/forumTwinAdapter.ts'
import { ResultResolver } from '../src/campus-pulse/source/resultResolver.ts'
import { HERO_SOURCE_KEY, LIVE_SOURCE_KEY } from '../src/campus-pulse/source/registry.ts'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('M05 live evolution contains its wide canvas on narrow viewports', () => {
  const source = read('src/campus-pulse/live/CenturyGymLivePage.vue')
  assert.match(source, /\.live-console\{width:100%;max-width:100%;min-width:0;overflow-x:clip\}/)
  assert.match(source, /\.live-console>\*\{max-width:100%;min-width:0\}/)
})
const H = (character) => character.repeat(64)

function resultFixture(overrides = {}) {
  const timeline = [
    { tick: 0, phase: 'baseline', natural: { messages: 2, threads: 1, claims: 1, corrections: 0, help_requests: 0 }, intervention: { messages: 2, threads: 1, claims: 1, corrections: 0, help_requests: 0 } },
    { tick: 3, phase: 'burst', natural: { messages: 12, threads: 2, claims: 2, corrections: 0, help_requests: 0 }, intervention: { messages: 11, threads: 2, claims: 2, corrections: 0, help_requests: 0 } },
    { tick: 7, phase: 'spread', natural: { messages: 30, threads: 3, claims: 3, corrections: 1, help_requests: 1 }, intervention: { messages: 24, threads: 3, claims: 2, corrections: 1, help_requests: 1 } },
    { tick: 23, phase: 'decay', natural: { messages: 40, threads: 3, claims: 4, corrections: 2, help_requests: 2 }, intervention: { messages: 32, threads: 3, claims: 3, corrections: 2, help_requests: 2 } },
  ]
  const message = (id, thread, branch, tick, extra = {}) => ({
    message_id: id,
    thread_id: thread,
    scenario_id: 'scenario_001',
    branch_id: branch,
    parent_message_id: null,
    quote_message_id: null,
    source_display_id: `FT-${branch === 'D' ? 'D' : 'N'}-${id.slice(-2)}`,
    action: 'post',
    visible_text: `消息 ${id} 文本`,
    topic: '话题A',
    stance: '中立',
    emotion: '平静',
    evidence_status: null,
    confidence: null,
    claim_ids: [],
    claim_operation: null,
    correction_target_claim_id: null,
    created_tick: tick,
    ttl: null,
    moderation_status: 'accepted',
    provenance: { kind: 'authorized_live_llm', model: 'gpt-5.4-mini' },
    ...extra,
  })
  const threads = [
    { thread_id: 't_n1', board: 'board', root_message_id: 'm_n1_1', scenario_id: 'scenario_001', branch_id: 'natural', created_tick: 0, status: 'open', topic: '自然讨论：讲座争议', need: '需要核实', claim_ids: ['c_n1'], participant_count: 4, reply_count: 3, last_active_tick: 7, provenance_kind: 'authorized_live_llm', message_ids: ['m_n1_1', 'm_n1_2'] },
    { thread_id: 't_d1', board: 'board', root_message_id: 'm_d1_1', scenario_id: 'scenario_001', branch_id: 'D', created_tick: 0, status: 'open', topic: '治理分支：讲座争议', need: '需要回应', claim_ids: ['c_d1'], participant_count: 4, reply_count: 2, last_active_tick: 7, provenance_kind: 'authorized_live_llm', message_ids: ['m_d1_1', 'm_d1_2', 'm_d1_g1'] },
    { thread_id: 't_late', board: 'board', root_message_id: 'm_late_1', scenario_id: 'scenario_001', branch_id: 'natural', created_tick: 23, status: 'open', topic: '晚期讨论串', need: '无', claim_ids: [], participant_count: 1, reply_count: 0, last_active_tick: 23, provenance_kind: 'authorized_live_llm', message_ids: ['m_late_1'] },
  ]
  const messages = [
    message('m_n1_1', 't_n1', 'natural', 0),
    message('m_n1_2', 't_n1', 'natural', 3, { parent_message_id: 'm_n1_1' }),
    message('m_d1_1', 't_d1', 'D', 0),
    message('m_d1_g1', 't_d1', 'D', 3, { action: 'governance_message', source_display_id: 'governance:authority', claim_ids: ['c_d1'], visible_text: '治理主体发布核实公告' }),
    message('m_d1_2', 't_d1', 'D', 3, { parent_message_id: 'm_d1_g1', visible_text: '居民回应治理消息' }),
    message('m_late_1', 't_late', 'natural', 23),
  ]
  const claims = [
    { claim_id: 'c_n1', thread_id: 't_n1', created_by_message_id: 'm_n1_1', parent_claim_id: null, scenario_id: 'scenario_001', branch_id: 'natural', summary: '讲座信息需要核实', status: 'contested', first_seen_tick: 3, last_seen_tick: 23, supporting_message_ids: ['m_n1_1'], challenging_message_ids: ['m_n1_2'], correction_target_claim_id: null, evidence_reference: 'hero-r9/claims/c_n1' },
    { claim_id: 'c_d1', thread_id: 't_d1', created_by_message_id: 'm_d1_1', parent_claim_id: null, scenario_id: 'scenario_001', branch_id: 'D', summary: '讲座信息需官方核实', status: 'verified', first_seen_tick: 3, last_seen_tick: 23, supporting_message_ids: ['m_d1_1'], challenging_message_ids: [], correction_target_claim_id: null, evidence_reference: null },
  ]
  const forum = {
    threads,
    claims,
    messages,
    profiles: [],
    governance: {
      rounds: [
        {
          tick: 3,
          decisions: [
            { actor: 'governance_authority', action: 'verified_update', probability: 0.997, noop: false },
            { actor: 'service_operator', action: 'noop', probability: 0.9, noop: true },
          ],
        },
      ],
      uptakeChains: [
        { governanceMessageId: 'm_d1_g1', complete: true, residentResponseIds: ['m_d1_2'] },
        { governanceMessageId: 'm_d1_g0', complete: false, residentResponseIds: [] },
      ],
    },
  }
  return {
    key: 'hero-r9',
    runId: 'hero_pilot_r9_t23',
    source: {
      key: HERO_SOURCE_KEY,
      mode: 'offline_hero',
      label: 'Verified Offline Hero',
      verification: 'verified',
      freshness: { status: 'unknown' },
      availability: { backend: 'unknown', access: 'readonly' },
      provenance: { runId: 'hero_pilot_r9_t23', scenarioId: 'scenario_001', evidenceId: 'hero-r9', origin: 'sealed offline public asset', executionProvenance: 'authorized_live_llm', manifestId: H('a'), manifestAvailable: true, actualHash: H('a') },
      publicationEligible: false,
      boundaries: ['单场景、单种子、T0–T23 paired hero pilot。', '只读展示。'],
      boundarySummary: '只读展示',
    },
    scope: {
      scenarios: ['scenario_001'],
      scenarioLabel: '讲座争议信息进入校园论坛',
      scenarioDescription: '',
      seedCount: 1,
      tickIds: [0, 3, 7, 23],
      population: 1000,
      sharedConditions: ['共享人口', '共享初始状态', '共享事件条件'],
    },
    summary: {
      naturalMessages: 40,
      interventionMessages: 32,
      residentTurns: 100,
      providerTokens: 200,
      timeline,
      governance: {
        publishedMessages: 2,
        noResponseMessages: 1,
        noopDecisions: 1,
        decisionTicks: [{ tick: 3, summary: 'governance_authority: verified_update · 99.7% · service_operator: noop · 90.0%' }],
        uptake: { completeChains: 1, totalChains: 2 },
      },
    },
    capabilities: { threads: true, claims: true, agents: false, particles: false, reports: false },
    provenance: { runId: 'hero_pilot_r9_t23', scenarioId: 'scenario_001', evidenceId: 'hero-r9', origin: 'sealed offline public asset', manifestId: H('a'), manifestAvailable: true, actualHash: H('a') },
    boundaries: ['单场景、单种子、T0–T23 paired hero pilot。'],
    forum,
    ...overrides,
  }
}

const state = () => workspaceFromQuery({
  source: HERO_SOURCE_KEY,
  result: 'hero-r9',
  tick: '7',
  metric: 'threads',
  thread: 't_n1',
  inspector: 'thread',
}, ['messages', 'threads', 'claims', 'corrections', 'help_requests'])

test('M05 workspace URL parses and serializes investigation state', () => {
  const parsed = state()
  assert.equal(parsed.source, HERO_SOURCE_KEY)
  assert.equal(parsed.resultKey, 'hero-r9')
  assert.equal(parsed.tick, 7)
  assert.equal(parsed.metric, 'threads')
  assert.equal(parsed.thread, 't_n1')
  assert.equal(parsed.inspector, 'thread')
  const serialized = workspaceToQuery(parsed)
  assert.equal(serialized.tick, '7')
  assert.equal(serialized.metric, 'threads')
  assert.equal(serialized.thread, 't_n1')
  assert.equal(serialized.source, HERO_SOURCE_KEY)
  // View defaults are not serialized as boolean soup.
  assert.equal(serialized.branch, undefined)
  assert.equal(serialized.inspector, undefined)
  assert.equal(serialized.q, undefined)
})

test('M05 tick uses real manifest ticks, never array indices', () => {
  const tickIds = [0, 1, 2, 4, 7, 23]
  assert.deepEqual(normalizeTick(4, tickIds), { tick: 4, corrected: false })
  assert.deepEqual(normalizeTick(undefined, tickIds), { tick: 0, corrected: false })
  assert.deepEqual(normalizeTick(3, tickIds), { tick: 4, corrected: true })
  assert.deepEqual(normalizeTick(100, tickIds), { tick: 23, corrected: true })
  // Non-24-tick result (M05-BDD-02): max tick 12 stops at 12, never 23.
  const short = [0, 1, 2, 4, 12]
  assert.deepEqual(normalizeTick(12, short), { tick: 12, corrected: false })
  assert.deepEqual(normalizeTick(23, short), { tick: 12, corrected: true })
})

test('M05 M04 deep link carries result/metric/tick into the forum workspace', () => {
  const query = workspaceToQuery({
    source: LIVE_SOURCE_KEY,
    resultKey: 'run_abc123',
    runId: 'run_abc123',
    metric: 'messages',
    tick: 7,
    branch: 'both',
    q: '',
    inspector: 'thread',
  })
  assert.equal(query.source, LIVE_SOURCE_KEY)
  assert.equal(query.result, 'run_abc123')
  assert.equal(query.run_id, 'run_abc123')
  assert.equal(query.tick, '7')
  const location = forumInvestigationLocation({
    source: LIVE_SOURCE_KEY,
    resultKey: 'run_abc123',
    runId: 'run_abc123',
    metric: 'messages',
    tick: 7,
    branch: 'both',
    q: '',
    inspector: 'thread',
  })
  assert.equal(location.name, 'campus-pulse-forum')
  assert.equal(location.query.tick, '7')
})

test('M05 return path restores result/source/metric/tick instead of the results index', () => {
  const target = returnToResultLocation({ source: HERO_SOURCE_KEY, resultKey: 'hero-r9', metric: 'messages', tick: 7 })
  assert.equal(target.name, 'campus-pulse-result-summary')
  assert.equal(target.params.resultKey, 'hero-r9')
  assert.equal(target.query.source, HERO_SOURCE_KEY)
  assert.equal(target.query.tick, '7')
})

test('M05 same tick compares Natural and D with one neutral delta direction', () => {
  const investigation = buildForumInvestigation(resultFixture(), state())
  assert.equal(investigation.tick, 7)
  assert.equal(investigation.natural.messages, 30)
  assert.equal(investigation.intervention.messages, 24)
  assert.equal(investigation.intervention.delta, -6)
  assert.equal(metricLabel('messages'), '公开消息')
})

test('M05 branch-only items never get a fabricated counterpart', () => {
  const investigation = buildForumInvestigation(resultFixture(), state())
  const thread = investigation.threads.D[0]
  assert.equal(thread.counterpart.exists, false)
  assert.match(thread.counterpart.reason, /无公开对应讨论串|不按文本相似度/)
  const mapped = threadCounterpart({ ...thread.thread, mapped_counterpart_thread_id: 't_n1' })
  assert.deepEqual(mapped, { exists: true, threadId: 't_n1' })
})

test('M05 thread visibility is tick-scoped and selection restores messages', () => {
  const fixture = resultFixture()
  const investigation = buildForumInvestigation(fixture, state())
  const naturalThreads = investigation.threads.natural.map((item) => item.thread.thread_id)
  assert.ok(naturalThreads.includes('t_n1'))
  assert.ok(!naturalThreads.includes('t_late'), 'thread created at T23 must not appear at T7')
  const messages = visibleMessagesForThread(fixture, 't_n1', 7)
  assert.deepEqual(messages.map((item) => item.message_id), ['m_n1_1', 'm_n1_2'])
  assert.ok(messages.every((item) => item.created_tick <= 7))
})

test('M05 claim lineage uses only published relations and keeps evidence reference', () => {
  const fixture = resultFixture()
  const claims = visibleClaims(fixture, 'natural', 7)
  const claim = claims.find((item) => item.claim.claim_id === 'c_n1')
  assert.ok(claim)
  assert.equal(claim.supportCount, 1)
  assert.equal(claim.challengeCount, 1)
  assert.equal(claim.claim.evidence_reference, 'hero-r9/claims/c_n1')
  const noRef = claims[0].claim
  void noRef
})

test('M05 agent activity exposes only public display fields with the synthetic boundary', () => {
  const fixture = resultFixture()
  const natural = agentActivity(fixture, 'natural', 7)
  assert.ok(natural.some((item) => item.displayId === 'FT-N-_1'))
  assert.equal(natural[0].branch, 'natural')
  const serialized = JSON.stringify(natural)
  assert.doesNotMatch(serialized, /source_id|source_identifier|credential|raw_text|api_key|private/i)
  const agent = read('src/campus-pulse/forum/AgentExplain.vue')
  assert.match(agent, /合成 Agent，不是真实学生/)
  assert.match(agent, /不展示原始正文来源标识|隐私边界/)
})

test('M05 published cases share the dynamic Agent world and inspectable dossiers', () => {
  const page = read('src/campus-pulse/forum/ForumInvestigationPage.vue')
  const world = read('src/campus-pulse/agent-world/CaseAgentEvolution.vue')
  const runtime = read('src/campus-pulse/agent-world/ForumWorldRuntimeStage.vue')
  assert.match(page, /CaseAgentEvolution/)
  assert.ok(
    page.indexOf('<CaseAgentEvolution') < page.indexOf('<LiveForumStage'),
    'the Agent world must render above the forum feed',
  )
  assert.match(world, /currentSpeakerNodes/)
  assert.match(world, /replyEdges/)
  assert.match(world, /Strict parent direct reply/i)
  assert.match(world, /private_direct/)
  assert.match(world, /private_group/)
  assert.match(world, /ForumWorldRuntimeStage/)
  assert.match(world, /AgentDossierDrawer/)
  assert.match(world, /loadForumAgentWorldPublic/)
  assert.match(runtime, /class="edge-hit"/)
  assert.match(runtime, /@keydown\.space\.prevent="selectEdge\(edge\)"/)
  assert.match(runtime, /runtime-world__inspector/)
  assert.match(runtime, /查看 Profile、Persona、Prompt、记忆与历史/)
})

test('M05 published Agent world has a hash-verified offline projection', () => {
  const assetPath = resolve('public/campus-pulse-data/forum-agent-world-public-v1.json')
  const raw = readFileSync(assetPath)
  const expected = read('public/campus-pulse-data/forum-agent-world-public-v1.sha256').trim()
  assert.equal(createHash('sha256').update(raw).digest('hex'), expected)
  const world = JSON.parse(raw.toString('utf8'))
  assert.equal(world.schema_version, 'campus-pulse-forum-agent-world-public-v1')
  assert.equal(world.population.agent_count, 1000)
  assert.equal(world.population.particle_count, 10000)
  assert.equal(world.population.representative_agents.length, 116)
  assert.equal(world.relationships.record_level_edges_public, false)
  assert.equal(world.privacy.contains_agent_ids, false)
  assert.equal(world.privacy.contains_private_text, false)
})

test('M05 governance at tick shows decisions, messages, response, noop and no-response', () => {
  const fixture = resultFixture()
  const governance = governanceAtTick(fixture, 3)
  assert.ok(governance)
  assert.equal(governance.decisions.length, 2)
  assert.equal(governance.decisions[0].action, 'verified_update')
  assert.equal(governance.decisions[1].noop, true)
  assert.equal(governance.noopCount, 1)
  assert.equal(governance.publishedMessages.length, 1)
  assert.equal(governance.responseMessages.length, 1)
  assert.equal(governance.chainsForTick.length, 1)
  assert.equal(governance.chainsForTick[0].complete, true)
  assert.equal(governance.chainsForTick[0].residentResponseCount, 1)
  assert.equal(governance.uptake.completeChains, 1)
})

test('M05 hero governance chains are exposed from the sealed asset', () => {
  const hero = JSON.parse(read('public/campus-pulse-data/forum-twin-hero-showcase-v1.json'))
  const chains = hero.result.branches.D.mechanism_chains.governance_uptake_chains
  assert.equal(chains.length, 7)
  assert.equal(chains.filter((chain) => chain.complete).length, 4)
  assert.equal(chains.filter((chain) => chain.resident_response_ids.length === 0).length, 3)
  const service = read('src/services/forumTwin.ts')
  assert.match(service, /governance_uptake_chains: publicUptakeChains/)
  assert.match(service, /governance_rounds: publicGovernanceRounds/)
  // The adapter turns exposed chains/rounds into the result governance slice.
  const loaded = {
    aggregate: { run_id: 'hero_pilot_r9_t23', publication_eligible: false, execution_provenance: 'authorized_live_llm', domain_result: { audit: { llm_agent_count: 1000 } }, result_sha256: H('r') },
    domain: {
      scenarios: [{ scenario_id: 'scenario_001', label: '讲座争议信息进入校园论坛' }],
      parallel_forums: { scenario_001: { natural: { timeline: [] }, D: { timeline: [] } } },
      llm_usage: { resident_turns: 0, provider_tokens: 0, governance_turns: 0 },
      audit: { public_display_profiles: [] },
      governance: {
        paired_final_difference_D_minus_Natural: -18,
        governance_uptake_chains: [
          { governance_message_id: 'g1', complete: true, resident_response_ids: ['r1', 'r2'] },
          { governance_message_id: 'g2', complete: false, resident_response_ids: [] },
          { governance_message_id: 'g3', complete: true, resident_response_ids: ['r3'] },
        ],
        governance_rounds: [
          { tick: 3, decisions: [
            { actor: 'governance_authority', selected_action: 'verified_update', selection_probability: 0.997 },
            { actor: 'service_operator', selected_action: 'noop', selection_probability: 0.9 },
          ] },
        ],
      },
    },
    manifest: { manifest_sha256: H('m'), run_id: 'hero_pilot_r9_t23', result_sha256: H('r'), domain_result_sha256: H('d'), public_forum_sha256: H('f'), thread_batches: [], claim_batches: [], particle_frames: [], propagation_matrices: [], total_compressed_bytes: 0, asset_integrity: { verified: true, verification_method: 'sealed_package_sha256' } },
    manifestSha256: H('m'),
    threads: [],
    messages: [],
    claims: [],
    profiles: [],
    source: { mode: 'hero_pilot', label: 'Verified Offline Hero · T0–T23', run_id: null },
  }
  const view = adaptHeroResult(loaded)
  assert.equal(view.summary.governance.publishedMessages, 3)
  assert.equal(view.summary.governance.uptake.completeChains, 2)
  assert.equal(view.summary.governance.noResponseMessages, 1)
  assert.equal(view.summary.governance.noopDecisions, 1)
  assert.equal(view.forum?.governance.rounds[0].decisions[1].noop, true)
})

test('M05 empty tick keeps timeline/metrics and reports a real per-branch empty', () => {
  const fixture = resultFixture()
  const emptyState = workspaceFromQuery({ source: HERO_SOURCE_KEY, result: 'hero-r9', tick: '0' }, ['messages'])
  const investigation = buildForumInvestigation(fixture, emptyState)
  assert.equal(investigation.tick, 0)
  assert.equal(investigation.threads.natural.length, 1)
  assert.equal(investigation.threads.D.length, 1)
  const branch = read('src/campus-pulse/forum/BranchPane.vue')
  assert.match(branch, /时点无匹配讨论串/)
  assert.match(branch, /不会回退到最近非空时点/)
})

test('M05 thread rows reserve independent title, badge and metadata regions', () => {
  const branch = read('src/campus-pulse/forum/BranchPane.vue')
  assert.match(branch, /grid-template-areas:'main badge' 'meta meta'/)
  assert.match(branch, /thread-row__meta[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/)
  assert.match(branch, /grid-area:badge/)
  assert.match(branch, /@container \(max-width:28rem\)/)
})

test('M05 CASE 02 governance handoff messages have bundled offline translations', () => {
  const lecture = JSON.parse(read('public/campus-pulse-data/lecture-open-choice-r4.json'))
  const translations = JSON.parse(read('src/campus-pulse/i18n/contentTranslations.en.json')).translations
  const branch = lecture.result.branches.D
  const messages = new Map(branch.messages.map((message) => [message.message_id, message]))
  const chains = branch.mechanism_chains.governance_uptake_chains
  const ids = chains.flatMap((chain) => [chain.governance_message_id, ...chain.resident_response_ids])
  assert.ok(ids.length >= 10, 'featured handoff should contain multiple stages')
  for (const id of ids) {
    const message = messages.get(id)
    assert.ok(message, `handoff message ${id} must exist`)
    assert.ok(translations[message.visible_text], `handoff message ${id} needs an offline translation`)
  }
})

test('M05 CASE 02 featured four-stage player stays fully translatable offline', () => {
  const lecture = JSON.parse(read('public/campus-pulse-data/lecture-open-choice-r4.json'))
  const translations = JSON.parse(read('src/campus-pulse/i18n/contentTranslations.en.json')).translations
  const naturalMessages = lecture.result.branches.Natural.messages
  const branch = lecture.result.branches.D
  const messages = new Map(branch.messages.map((message) => [message.message_id, message]))
  const complete = branch.mechanism_chains.governance_uptake_chains
    .find((chain) => chain.complete && chain.resident_response_ids.length)
  assert.ok(complete, 'featured handoff requires a complete uptake chain')
  const governance = messages.get(complete.governance_message_id)
  const response = messages.get(complete.resident_response_ids[0])
  const firstResident = [...naturalMessages].sort((left, right) => left.created_tick - right.created_tick)[0]
  const later = branch.messages.find((message) => (
    message.thread_id === response.thread_id && message.created_tick > response.created_tick
  ))
  const stages = [firstResident, governance, response, later]
  assert.equal(stages.length, 4)
  for (const [index, message] of stages.entries()) {
    assert.ok(message, `player stage ${index + 1} must resolve to a message`)
    assert.ok(translations[message.visible_text], `player stage ${index + 1} needs an offline translation`)
  }
})

test('M05 CASE 02 Tick 10 new posts stay fully translatable offline', () => {
  const lecture = JSON.parse(read('public/campus-pulse-data/lecture-open-choice-r4.json'))
  const translations = JSON.parse(read('src/campus-pulse/i18n/contentTranslations.en.json')).translations
  const tickTenMessages = ['Natural', 'D'].flatMap((branch) => (
    lecture.result.branches[branch].messages.filter((message) => message.created_tick === 10)
  ))
  assert.equal(tickTenMessages.length, 46, 'CASE 02 should expose all 46 Tick 10 new posts')
  for (const message of tickTenMessages) {
    assert.ok(translations[message.visible_text], `Tick 10 message ${message.message_id} needs an offline translation`)
  }
})

test('M05 every comment in every bundled Case Center tick has an offline translation', () => {
  const translations = JSON.parse(read('src/campus-pulse/i18n/contentTranslations.en.json')).translations
  const files = ['resource-policy-live-r1.json', 'lecture-open-choice-r4.json']
  let commentCount = 0
  for (const file of files) {
    const artifact = JSON.parse(read(`public/campus-pulse-data/${file}`))
    for (const branch of Object.values(artifact.result.branches)) {
      for (const message of branch.messages) {
        commentCount += 1
        assert.ok(translations[message.visible_text], `${file} message ${message.message_id} needs an offline translation`)
      }
    }
  }
  assert.ok(commentCount >= 800, 'the offline catalog must cover both complete Case Center traces')
})

test('M05 translation controls own their locale labels without DOM relocalization', () => {
  const component = read('src/campus-pulse/i18n/ContentTranslation.vue')
  const catalog = JSON.parse(read('src/campus-pulse/i18n/uiCatalog.zh-en.json')).translations
  assert.match(component, /class="content-translation" data-no-localize/)
  assert.match(component, /'Translate to English'/)
  assert.match(component, /'Hide translation'/)
  assert.equal(catalog['译为英文 / Translate'], undefined)
  assert.equal(catalog['收起翻译 / Hide'], undefined)
})

test('M05 missing trace and live errors fail closed without silent fallback', async () => {
  const noForum = resultFixture({ forum: undefined })
  const page = read('src/campus-pulse/forum/ForumInvestigationPage.vue')
  assert.match(page, /该结果没有可回放的公开论坛轨迹/)
  assert.match(page, /切换到经校验的离线审计案例/)
  assert.match(page, /fallback_from/)
  const resolver = new ResultResolver()
  const missingRun = await resolver.resolve(LIVE_SOURCE_KEY)
  assert.equal(missingRun.status, 'error')
  if (missingRun.status === 'error') {
    assert.equal(missingRun.problem.code, 'run_id_required')
    assert.equal(missingRun.problem.sourceImpact, 'unavailable')
  }
  void noForum
})

test('M05 URL keeps selection and inspector while tick playback uses replace semantics', () => {
  const serialized = workspaceToQuery({ source: HERO_SOURCE_KEY, resultKey: 'hero-r9', tick: 7, metric: DEFAULT_METRIC, branch: 'both', q: '', thread: 't_n1', inspector: 'thread' })
  assert.equal(serialized.thread, 't_n1')
  assert.equal(serialized.inspector, undefined, 'default inspector tab is not serialized')
  const page = read('src/campus-pulse/forum/ForumInvestigationPage.vue')
  assert.match(page, /\(\) => route\.query\.source/)
  assert.match(page, /\(\) => route\.query\.result/)
  assert.doesNotMatch(page, /\(\) => \[route\.query\.source/)
})

test('M05 selection and inspector expose accessible semantics', () => {
  const branch = read('src/campus-pulse/forum/BranchPane.vue')
  const inspector = read('src/campus-pulse/forum/ContextInspector.vue')
  const toolbar = read('src/campus-pulse/forum/ForumToolbar.vue')
  assert.match(branch, /role="option"/)
  assert.match(branch, /aria-selected/)
  assert.match(inspector, /role="dialog"/)
  assert.match(inspector, /aria-label="调查对象 Inspector"/)
  assert.match(inspector, /event\.key === 'Escape'/)
  assert.match(inspector, /previouslyFocused/)
  assert.match(toolbar, /role="toolbar"/)
  assert.match(toolbar, /aria-pressed/)
  assert.match(toolbar, /selectTick/)
  const stage = read('src/campus-pulse/forum/LiveForumStage.vue')
  assert.match(stage, /实时热榜/)
  assert.match(stage, /支持性回复/)
  assert.match(stage, /点赞未采集/)
  assert.match(stage, /点赞、静默转发和举报是独立多选/)
  assert.match(stage, /messageInteractionDelta/)
  assert.match(stage, /interaction_counts_by_tick/)
  assert.match(stage, /举报只进入风控、不抬高热度/)
  assert.match(stage, /threads\.slice\(0, 10\)/)
  assert.match(stage, /展开全部/)
})

test('M05 forum components parse and compile', () => {
  const directory = resolve('src/campus-pulse/forum')
  const files = readFileSync(resolve('src/campus-pulse/forum/manifest.txt'), 'utf8').trim().split(/\r?\n/).filter(Boolean)
  void directory
  for (const file of files) {
    const fullPath = resolve('src/campus-pulse/forum', file)
    const source = readFileSync(fullPath, 'utf8')
    const relative = file
    const parsed = parse(source, { filename: fullPath })
    assert.deepEqual(parsed.errors, [], `${relative} parse errors`)
    const id = `m05-${relative.length}`
    const script = parsed.descriptor.scriptSetup
      ? compileScript(parsed.descriptor, { id })
      : undefined
    const template = compileTemplate({
      id,
      filename: fullPath,
      source: parsed.descriptor.template?.content || '',
      compilerOptions: { bindingMetadata: script?.bindings },
    })
    assert.deepEqual(template.errors, [], `${relative} template errors`)
  }
})

test('M05 live console preserves the Tick 0-10 Century Gym replay and accepts bounded live scenarios', () => {
  const router = read('src/router/index.js')
  const pagePath = resolve('src/campus-pulse/live/CenturyGymLivePage.vue')
  const page = readFileSync(pagePath, 'utf8')
  const parsed = parse(page, { filename: pagePath })
  assert.deepEqual(parsed.errors, [])
  const script = compileScript(parsed.descriptor, { id: 'm05-century-gym-live' })
  const template = compileTemplate({
    id: 'm05-century-gym-live',
    filename: pagePath,
    source: parsed.descriptor.template?.content || '',
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  assert.match(router, /path: '\/campus-pulse\/live\/century-gym'/)
  assert.match(router, /name: 'campus-pulse-century-gym-live'/)
  assert.match(page, /GLOBAL HOT TOP 10/)
  assert.match(page, /TransitionGroup/)
  assert.match(page, /正在准备现场模拟/)
  assert.match(page, /播放推演/)
  assert.match(page, /Tick 0–10/)
  assert.match(page, /demoStarted/)
  assert.match(page, /selectedBranch/)
  assert.match(page, /artifact_kind/)
  assert.match(page, /century-gym-demo/)
  assert.match(page, /运行数据已校验/)
  assert.doesNotMatch(page, /治理让讨论收敛到可核验问题/)
  assert.doesNotMatch(page, /Claim 收敛/)
  assert.doesNotMatch(page, /directUptake/)
  assert.match(page, /governance_legitimacy_dispute/)
  assert.match(page, /lecture_external_incident_shock/)
  assert.match(page, /isLiveOperator/)
  assert.match(page, /LIVE AGENT WORLD/)
  assert.match(page, /getCenturyGymSocialWorld/)
  assert.match(page, /getForumTwinV2AgentWorld/)
  assert.match(page, /selectedWorldEdge/)
  assert.match(page, /reviewed_excerpts_only/)
  assert.match(page, /公开曝光/)
  assert.match(page, /好友私聊对话/)
  assert.match(page, /这段私聊改变了什么/)
  assert.match(page, /112 个微角色投影节点|liveMicroNodes\.length/)
  assert.match(page, /本 Tick 触达节点/)
  assert.match(page, /publicReachedMicroNodeIds/)
  assert.match(page, /privateReachedMicroNodeIds/)
  assert.match(page, /llmMicroNodeIds/)
  assert.match(page, /BACKGROUND_WORLD_ROLE_ID = 'archetype-16'/)
  assert.doesNotMatch(page, /activeWorldRoleIds/)

  const progressRoot = '../../evidence/century-gym-demo-v2/public-progress'
  const progress = JSON.parse(read(`${progressRoot}/latest.json`))
  assert.equal(progress.status, 'succeeded')
  assert.equal(progress.committed_ticks.length, 17)
  assert.equal(progress.display_contract.schema_version, 'campus-pulse-century-gym-display-v1')
  assert.equal(progress.display_contract.mode, 'operator_started_verified_tick_replay')
  assert.deepEqual(progress.display_contract.interface_ticks, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(progress.display_contract.branch_fork_tick, 5)
  assert.deepEqual(progress.display_contract.branches_after_fork, ['Natural', 'D'])
  assert.equal(progress.display_contract.provider_calls_during_playback, 0)
  assert.equal(progress.display_contract.case_center_entry, false)
  assert.deepEqual([...new Set(progress.committed_ticks.map((entry) => entry.tick))], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  for (const tick of [0, 1, 2]) {
    const entry = progress.committed_ticks.find((candidate) => candidate.tick === tick && candidate.branch === 'shared_baseline')
    assert.ok(entry, `Tick ${tick} shared baseline must exist`)
    const snapshot = JSON.parse(read(`${progressRoot}/${entry.path}`))
    assert.equal(snapshot.public_branch.messages.length, 0)
    assert.equal(snapshot.public_branch.threads.length, 0)
    assert.equal(snapshot.public_branch.claims.length, 0)
    assert.equal(snapshot.public_branch.usage.provider_calls, 0)
    assert.equal(snapshot.public_branch.timeline.at(-1).tick, tick)
  }

  const socialWorld = JSON.parse(read('../../evidence/century-gym-demo-v2/social-world-v1.json'))
  assert.equal(socialWorld.schema_version, 'campus-pulse-century-gym-social-world-v1')
  assert.equal(socialWorld.source_manifest_sha256, progress.content_sha256)
  assert.equal(socialWorld.frames.length, 17)
  assert.equal(socialWorld.reviewed_excerpts.length, 12)
  assert.equal(socialWorld.provenance.provider_calls, 0)
  assert.equal(socialWorld.privacy.reviewed_excerpts_only, true)
  assert.equal(socialWorld.privacy.contains_agent_ids, false)
  assert.equal(socialWorld.privacy.contains_conversation_ids, false)
  assert.ok(socialWorld.reviewed_excerpts.every((row) => row.review_status === 'approved' && row.effect_zh && row.effect_en))
})
