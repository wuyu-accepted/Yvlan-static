import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  aggregatePrivateActivity,
  assertInspectablePrivateConversation,
  canInspectPrivateConversation,
} from '../src/campus-pulse/domain/privateContent.ts'
import { liveApiAdapter } from '../src/campus-pulse/adapters/liveApiAdapter.ts'
import {
  adaptCenturyGymSocialWorld,
  reviewedExcerptViewModel,
} from '../src/campus-pulse/adapters/auditedReplayAdapter.ts'

test('aggregate-only private activity can never open a conversation inspector', () => {
  const aggregate = aggregatePrivateActivity({
    branch: 'D',
    tick: 6,
    directMessageCount: 42,
    groupMessageCount: 3,
    activeSenderCount: 24,
    boundaryNote: 'Aggregate counts only.',
  })
  assert.equal(aggregate.access, 'aggregate_only')
  assert.equal(aggregate.inspectable, false)

  const disguised = {
    id: '', branch: 'D', tick: 6, channel: 'private_direct' as const,
    access: 'aggregate_only' as const, provenance: 'aggregate_only' as const,
    inspectable: true, messages: [],
  }
  assert.equal(canInspectPrivateConversation(disguised), false)
  assert.throws(() => assertInspectablePrivateConversation(disguised), /stable identifier/)
})

test('an approved synthetic excerpt becomes an inspectable reviewed excerpt', () => {
  const value = reviewedExcerptViewModel({
    excerpt_id: 'reviewed-1', branch: 'Natural', tick: 6,
    channel: 'private_group', source_role_id: 'role-a', target_role_id: 'role-b',
    relation_type: 'familiar_peer', mechanism: 'retelling',
    public_source_message_id: 'public-1', review_status: 'approved',
    provenance_kind: 'human_reviewed_synthetic_mechanism_excerpt',
    text_zh: '这是一条经过审阅的合成摘录。', text_en: 'A reviewed synthetic excerpt.',
    effect_zh: '弱猜测继续传播。', effect_en: 'A weak claim keeps spreading.',
  })
  assert.equal(value.access, 'reviewed_excerpt')
  assert.equal(value.provenance, 'reviewed_excerpt')
  assert.equal(canInspectPrivateConversation(value), true)
  assert.match(value.boundaryNote || '', /不是真人对话/)
})

test('Century Gym replay adapter rejects raw or unreviewed private content', () => {
  const payload = {
    schema_version: 'campus-pulse-century-gym-social-world-v1',
    scenario_id: 'century_gym_ghost_booking_dispute',
    source_manifest_sha256: 'a'.repeat(64), content_sha256: 'b'.repeat(64), frames: [],
    privacy: {
      public_safe: true, reviewed_excerpts_only: true, contains_agent_ids: false,
      contains_conversation_ids: false, contains_record_level_relationship_edges: false,
      contains_raw_private_runtime_text: false,
    },
    reviewed_excerpts: [{
      excerpt_id: 'excerpt-1', branch: 'D', tick: 7, channel: 'private_direct',
      source_role_id: 'role-a', target_role_id: 'role-b', relation_type: 'close_friend',
      mechanism: 'correction', public_source_message_id: 'post-1', review_status: 'pending',
      provenance_kind: 'human_reviewed_synthetic_mechanism_excerpt',
      text_zh: '待审阅', text_en: 'Pending', effect_zh: '无', effect_en: 'None',
    }],
  }
  assert.throws(() => adaptCenturyGymSocialWorld(payload), /Only human-approved/)
  payload.reviewed_excerpts[0].review_status = 'approved'
  assert.equal(adaptCenturyGymSocialWorld(payload).reviewed_excerpts.length, 1)
  payload.privacy.contains_raw_private_runtime_text = true
  assert.throws(() => adaptCenturyGymSocialWorld(payload), /privacy contract/)
})

test('the bundled Century Gym replay exposes exactly its 12 approved excerpts', async () => {
  const raw = await readFile(new URL('../../../evidence/century-gym-demo-v2/social-world-v1.json', import.meta.url), 'utf8')
  const release = adaptCenturyGymSocialWorld(JSON.parse(raw))
  assert.equal(release.reviewed_excerpts.length, 12)
  assert.equal(new Set(release.reviewed_excerpts.map((item) => item.excerpt_id)).size, 12)
  assert.ok(release.reviewed_excerpts.every((item) => item.review_status === 'approved'))
})

test('Live API adapter normalizes the existing workbench contracts without inventing server limits', () => {
  const project = liveApiAdapter.project({
    project_id: 'project-1', name: 'Campus case', governance_domain: 'housing',
    objective: 'Compare branches', evaluation_mode: 'descriptive_pilot', status: 'ready',
  })
  assert.deepEqual({ id: project.id, status: project.status }, { id: 'project-1', status: 'ready' })

  const run = liveApiAdapter.runPlan({
    run_id: 'run-1', project_id: 'project-1', scenario_id: 'scenario-1',
    execution_mode: 'llm_forum_twin_v2', status: 'draft', plan_status: 'draft',
  })
  assert.equal(run.primarySlots, null)
  assert.equal(run.requestLimit, null)
  assert.equal(run.tickCount, null)
})

test('Live API adapter exposes record-level synthetic chat only to an authorized operator', () => {
  const payload = {
    operator_authorized: true,
    conversation_id: 'conversation-1',
    branch: 'D', tick: 6, channel: 'private_direct', provenance: 'live_llm',
    source_display_id: 'CP-001', target_display_id: 'CP-002', relation_type: 'close_friend',
    messages: [{ message_id: 'private-1', sender_display_id: 'CP-001', visible_text: '你看到那条帖子了吗？', tick: 6 }],
  }
  const conversation = liveApiAdapter.privateConversation(payload)
  assert.equal(conversation.access, 'full_record')
  assert.equal(canInspectPrivateConversation(conversation), true)
  assert.throws(() => liveApiAdapter.privateConversation({ ...payload, operator_authorized: false }), /operator authorization/)
  assert.throws(() => liveApiAdapter.privateConversation({ ...payload, provenance: 'aggregate_only' }), /provenance/)
})

test('housing aggregate panel contains no fabricated node or edge generation', async () => {
  const source = await readFile(new URL('../src/campus-pulse/results/ResourcePrivateChannelPanel.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /stableHash|directEdges|groupEdges|rankedNodeIds/)
  assert.match(source, /AGGREGATE-ONLY PRIVATE ACTIVITY/)
  assert.match(source, /不根据计数推造发送者、关系或对话/)
})
