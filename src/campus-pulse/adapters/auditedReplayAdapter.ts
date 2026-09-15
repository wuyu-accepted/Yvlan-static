import type { ForumTwinLoaded } from '../contracts/forumTwin.ts'
import {
  adaptHeroResult,
  adaptLectureHeroResult,
  type ResultViewModel,
} from '../source/forumTwinAdapter.ts'
import type {
  CampusPulseDataAdapter,
  PrivateActivityAggregateViewModel,
  PrivateConversationViewModel,
} from '../domain/viewModels.ts'
import { aggregatePrivateActivity, assertInspectablePrivateConversation } from '../domain/privateContent.ts'
import type {
  ResourcePrivateBranchName,
  ResourcePrivateChannelSummary,
} from '../../services/resourcePrivateChannels.ts'
import { HERO_SOURCE_KEY } from '../source/registry.ts'

export interface ReviewedPrivateExcerpt {
  excerpt_id: string
  branch: 'shared_baseline' | 'Natural' | 'D'
  tick: number
  channel: 'private_direct' | 'private_group'
  source_role_id: string
  target_role_id: string
  relation_type: string
  mechanism: string
  public_source_message_id: string
  review_status: 'approved'
  provenance_kind: 'human_reviewed_synthetic_mechanism_excerpt'
  text_zh: string
  text_en: string
  effect_zh: string
  effect_en: string
}

export interface PrivateWorldEdge {
  source_role_id: string
  target_role_id: string
  relation_type: string
  channel: 'private_direct' | 'private_group'
  message_count: number
  excerpt_ids: string[]
}

export interface SocialWorldFrame {
  branch: 'shared_baseline' | 'Natural' | 'D'
  tick: number
  private_messages_total: number
  private_messages_this_tick: number
  active_group_count: number
  public_to_private_forwards: number
  governance_to_private_forwards: number
  edges: PrivateWorldEdge[]
}

export interface SocialWorldRelease {
  schema_version: 'campus-pulse-century-gym-social-world-v1'
  scenario_id: 'century_gym_ghost_booking_dispute'
  source_manifest_sha256: string
  frames: SocialWorldFrame[]
  reviewed_excerpts: ReviewedPrivateExcerpt[]
  privacy: Record<string, boolean>
  content_sha256: string
}

function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Audited replay payload must be an object.')
  return value as Record<string, any>
}

const PRIVATE_DENIED_KEYS = new Set(['agent_id', 'conversation_id', 'message_id', 'visible_text', 'raw_text', 'prompt', 'provider_body', 'api_key'])

function assertPublicSafe(value: unknown, path = '$'): void {
  if (Array.isArray(value)) return value.forEach((item, index) => assertPublicSafe(item, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_DENIED_KEYS.has(key.toLowerCase())) throw new TypeError(`Private replay field is not public-safe: ${path}.${key}`)
    assertPublicSafe(child, `${path}.${key}`)
  }
}

function validateExcerpt(value: unknown, ids: Set<string>): ReviewedPrivateExcerpt {
  const row = object(value)
  if (!row.excerpt_id || ids.has(row.excerpt_id)) throw new TypeError('Reviewed excerpt identifiers must be present and unique.')
  ids.add(row.excerpt_id)
  if (row.review_status !== 'approved' || row.provenance_kind !== 'human_reviewed_synthetic_mechanism_excerpt') {
    throw new TypeError('Only human-approved synthetic excerpts may enter an audited replay.')
  }
  if (!['private_direct', 'private_group'].includes(row.channel) || !['shared_baseline', 'Natural', 'D'].includes(row.branch)) {
    throw new TypeError('Reviewed excerpt branch or channel is invalid.')
  }
  if (!Number.isInteger(row.tick) || !String(row.text_zh || '').trim() || !String(row.text_en || '').trim()) {
    throw new TypeError('Reviewed excerpt must carry a Tick and bilingual text.')
  }
  return row as ReviewedPrivateExcerpt
}

export function adaptCenturyGymSocialWorld(payload: unknown): SocialWorldRelease {
  const root = object(payload)
  if (root.schema_version !== 'campus-pulse-century-gym-social-world-v1' || root.scenario_id !== 'century_gym_ghost_booking_dispute') {
    throw new TypeError('Century Gym social-world schema mismatch.')
  }
  const privacy = object(root.privacy)
  if (privacy.public_safe !== true || privacy.reviewed_excerpts_only !== true
    || privacy.contains_agent_ids !== false || privacy.contains_conversation_ids !== false
    || privacy.contains_record_level_relationship_edges !== false || privacy.contains_raw_private_runtime_text !== false) {
    throw new TypeError('Century Gym social-world privacy contract mismatch.')
  }
  if (!Array.isArray(root.frames) || !Array.isArray(root.reviewed_excerpts)) throw new TypeError('Century Gym social-world frames or excerpts are missing.')
  if (!/^[0-9a-f]{64}$/.test(String(root.content_sha256 || '')) || !/^[0-9a-f]{64}$/.test(String(root.source_manifest_sha256 || ''))) {
    throw new TypeError('Century Gym social-world digest chain is missing.')
  }
  assertPublicSafe(root)
  const ids = new Set<string>()
  const reviewed = root.reviewed_excerpts.map((item: unknown) => validateExcerpt(item, ids))
  root.frames.forEach((frameValue: unknown) => {
    const frame = object(frameValue)
    if (!Number.isInteger(frame.tick) || !['shared_baseline', 'Natural', 'D'].includes(frame.branch) || !Array.isArray(frame.edges)) {
      throw new TypeError('Century Gym social-world frame is invalid.')
    }
    frame.edges.forEach((edgeValue: unknown) => {
      const edge = object(edgeValue)
      if (!edge.source_role_id || !edge.target_role_id || !Array.isArray(edge.excerpt_ids)) throw new TypeError('Replay edge must remain role-level and list reviewed excerpt IDs.')
      if (edge.excerpt_ids.some((id: unknown) => typeof id !== 'string' || !ids.has(id))) throw new TypeError('Replay edge references an unapproved private excerpt.')
    })
  })
  return {
    ...root,
    reviewed_excerpts: reviewed,
  } as SocialWorldRelease
}

export function reviewedExcerptViewModel(excerpt: ReviewedPrivateExcerpt, locale: 'zh-CN' | 'en-US' = 'zh-CN'): PrivateConversationViewModel {
  return assertInspectablePrivateConversation({
    id: excerpt.excerpt_id,
    branch: excerpt.branch,
    tick: excerpt.tick,
    channel: excerpt.channel,
    access: 'reviewed_excerpt',
    provenance: 'reviewed_excerpt',
    inspectable: true,
    sourceLabel: excerpt.source_role_id,
    targetLabel: excerpt.target_role_id,
    relationType: excerpt.relation_type,
    publicSourceMessageId: excerpt.public_source_message_id,
    messages: [{
      id: `${excerpt.excerpt_id}:message`,
      senderLabel: excerpt.source_role_id,
      text: locale === 'en-US' ? excerpt.text_en : excerpt.text_zh,
      tick: excerpt.tick,
    }],
    effect: locale === 'en-US' ? excerpt.effect_en : excerpt.effect_zh,
    boundaryNote: locale === 'en-US'
      ? 'Human-approved excerpt from a synthetic private-channel run; it is not a real-person conversation.'
      : '来自合成私域运行的人工批准摘录，不是真人对话。',
  })
}

export function adaptHousingPrivateActivity(
  summary: ResourcePrivateChannelSummary,
  branch: ResourcePrivateBranchName,
  tick: number,
  panel: 'broad_private_panel' | 'group_lifecycle_panel',
): PrivateActivityAggregateViewModel {
  const branchData = summary.panels[panel].branches[branch]
  const channel = branchData.channel_messages_by_tick.find((row) => row.tick === tick)
  const senders = branchData.unique_active_senders_by_tick.find((row) => row.tick === tick)
  if (!channel || !senders) throw new TypeError('Housing private aggregate does not contain the requested Tick.')
  return aggregatePrivateActivity({
    branch,
    tick,
    directMessageCount: channel.direct_message_count,
    groupMessageCount: channel.group_message_count,
    activeSenderCount: senders.unique_active_sender_count,
    boundaryNote: 'Aggregate-only housing evidence; no sender, relationship, conversation or message record is published.',
  })
}

export class AuditedReplayAdapter implements CampusPulseDataAdapter {
  readonly kind = 'audited_replay' as const
  readonly sourceKey: string
  readonly immutable = true

  constructor(sourceKey = HERO_SOURCE_KEY) {
    this.sourceKey = sourceKey
  }

  result(kind: 'hero' | 'lecture', loaded: ForumTwinLoaded): ResultViewModel {
    return kind === 'lecture' ? adaptLectureHeroResult(loaded) : adaptHeroResult(loaded)
  }

  centuryGymSocialWorld(payload: unknown): SocialWorldRelease {
    return adaptCenturyGymSocialWorld(payload)
  }

  housingPrivateActivity(
    summary: ResourcePrivateChannelSummary,
    branch: ResourcePrivateBranchName,
    tick: number,
    panel: 'broad_private_panel' | 'group_lifecycle_panel',
  ): PrivateActivityAggregateViewModel {
    return adaptHousingPrivateActivity(summary, branch, tick, panel)
  }
}

export const auditedReplayAdapter = new AuditedReplayAdapter()
