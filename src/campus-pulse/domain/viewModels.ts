import type { SourceState } from '../contracts/source.ts'
import type { ForumWorldRuntimeFrame } from '../agent-world/forumWorldRuntime.ts'

export type CampusPulseBranch = 'shared_baseline' | 'Natural' | 'D' | string
export type DataAdapterKind = 'live_api' | 'audited_replay'
export type PrivateContentProvenance = 'live_llm' | 'exact_replay' | 'reviewed_excerpt' | 'aggregate_only'
export type PrivateConversationAccess = 'full_record' | 'reviewed_excerpt' | 'aggregate_only' | 'unavailable'

export interface ProjectViewModel {
  id: string
  name: string
  governanceDomain: string
  researchQuestion: string
  evaluationMode: string
  status: 'draft' | 'ready' | 'running' | 'paused' | 'succeeded' | 'failed' | 'unknown'
  createdAt?: string
  updatedAt?: string
}

export interface PopulationWorldNodeViewModel {
  id: string
  roleId: string
  label: string
  microRole?: string
  active: boolean
}

export interface PopulationWorldRelationshipViewModel {
  id: string
  sourceId: string
  targetId: string
  relationType: string
  count: number
  recordLevel: boolean
}

export interface PopulationWorldViewModel {
  worldId: string
  agentCount: number
  particleCount: number
  nodes: PopulationWorldNodeViewModel[]
  relationships: PopulationWorldRelationshipViewModel[]
  relationshipAccess: 'record_level' | 'aggregate_only' | 'none'
  contentSha256?: string
}

export interface ScenarioViewModel {
  id: string
  name: string
  description: string
  templateKey?: string
  evidenceStatus?: string
}

export interface PolicyActionViewModel {
  id: string
  label: string
  actor?: string
  effectiveTick?: number
  cost?: number
  target?: string
}

export interface PolicyViewModel {
  id: string
  name: string
  description: string
  templateKey?: string
  baseline: boolean
  actionCount: number
  actions: PolicyActionViewModel[]
}

export interface RunPlanViewModel {
  runId: string
  projectId: string
  scenarioId: string
  status: string
  executionMode: string
  tokenBudget: number | null
  primarySlots: number | null
  requestLimit: number | null
  tickCount: number | null
  fingerprint?: string
}

export interface PrivateConversationMessageViewModel {
  id: string
  senderLabel: string
  text: string
  tick: number
  replyToId?: string
  claimStatus?: 'hearsay' | 'speculation' | 'contested' | 'corrected' | 'verified' | 'uncertain'
}

export interface PrivateConversationViewModel {
  id: string
  branch: CampusPulseBranch
  tick: number
  channel: 'private_direct' | 'private_group'
  access: PrivateConversationAccess
  provenance: PrivateContentProvenance
  inspectable: boolean
  sourceLabel?: string
  targetLabel?: string
  relationType?: string
  publicSourceMessageId?: string
  messages: PrivateConversationMessageViewModel[]
  effect?: string
  boundaryNote?: string
}

export interface PrivateActivityAggregateViewModel {
  branch: CampusPulseBranch
  tick: number
  directMessageCount: number
  groupMessageCount: number
  activeSenderCount: number
  access: 'aggregate_only'
  inspectable: false
  boundaryNote: string
}

export interface GovernanceRoundViewModel {
  tick: number
  branch: CampusPulseBranch
  decisions: Array<{ actor: string; action: string; cost?: number; target?: string; noop?: boolean }>
}

export interface RuntimeFrameViewModel {
  runId: string
  projectId?: string
  scenarioId: string
  branch: CampusPulseBranch
  tick: number
  committed: boolean
  sequence?: number
  world: ForumWorldRuntimeFrame | null
  privateConversations: PrivateConversationViewModel[]
  privateAggregate?: PrivateActivityAggregateViewModel
  governance: GovernanceRoundViewModel[]
  risks: Array<{ id: string; label: string; value: number | null; level?: string }>
  source: SourceState
}

/**
 * Result analysis already has a stable public contract. It is re-exported
 * through the domain catalog while the existing result pages migrate in M3.
 */
export type { ResultViewModel } from '../source/forumTwinAdapter.ts'

export interface CampusPulseDataAdapter {
  readonly kind: DataAdapterKind
  readonly sourceKey: string
  readonly immutable: boolean
}
