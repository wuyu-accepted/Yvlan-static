import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import {
  validateForumTwinV2Aggregate,
  verifyForumTwinV2AggregateHash,
} from './forumTwinV2.ts'

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
  )).join(',')}}`
}

function fixture() {
  const body = {
    schema_version: 'campus-pulse-live-aggregate-result-v7',
    run_id: `run_${'1'.repeat(24)}`,
    launch_fingerprint: '2'.repeat(64),
    plan_sha256: '3'.repeat(64),
    execution_provenance: 'authorized_live_llm',
    activation_mode: 'budgeted_pps',
    publication_eligible: false,
    public_metrics: { population: 1_000, public_messages: 12 },
    private_aggregate_metrics: { private_messages: 8, private_to_public_spillovers: 2 },
    risk_results: [],
    governance: {},
    census_calibration: null,
    relationship_ablation: null,
    completeness: { required_primary_slots: 603, completed_primary_slots: 603, status: 'complete' },
    usage: { provider_calls: 603, provider_tokens: 100_000 },
    privacy: {
      contains_private_text: false,
      contains_private_agent_ids: false,
      contains_relationship_edges: false,
      contains_credentials: false,
    },
    non_claims: ['Synthetic relationships are not real student ties.'],
  }
  return {
    ...body,
    result_sha256: createHash('sha256').update(canonicalJson(body)).digest('hex'),
  }
}

test('ForumTwin v2 browser contract verifies aggregate-only result-v7', async () => {
  const result = validateForumTwinV2Aggregate(fixture())
  assert.equal(await verifyForumTwinV2AggregateHash(result), result.result_sha256)
})

test('ForumTwin v2 browser contract rejects private identities and hash drift', async () => {
  const unsafe = fixture() as any
  unsafe.public_metrics.conversation_id = 'private-conversation'
  assert.throws(() => validateForumTwinV2Aggregate(unsafe), /隐私边界/)

  const drifted = validateForumTwinV2Aggregate(fixture())
  drifted.public_metrics.public_messages = 13
  await assert.rejects(() => verifyForumTwinV2AggregateHash(drifted), /SHA-256/)
})
