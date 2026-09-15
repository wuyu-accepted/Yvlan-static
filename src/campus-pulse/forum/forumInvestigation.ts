import type {
  ForumBranchId,
  ForumClaim,
  ForumMessage,
  ForumThread,
} from '../contracts/forumTwin.ts'
import type {
  ResultMetricKey,
  ResultTimelinePoint,
  ResultViewModel,
} from '../source/forumTwinAdapter.ts'
import {
  DEFAULT_METRIC,
  normalizeTick,
  type ForumWorkspaceState,
} from './forumWorkspaceState.ts'

/**
 * M05 ForumTwin Investigation — normalized domain view model.
 * Every value derives from the already-verified ResultViewModel forum slice;
 * no pairing, stance, causality or success claim is inferred on the frontend.
 */

export interface BranchTickVM {
  messages: number | null
  threads: number | null
  claims: number | null
  corrections: number | null
  helpRequests: number | null
  activatedResidents: number | null
  activatedGovernance: number | null
  /** Δ = D − Natural for the active metric; sign is descriptive, not a verdict. */
  delta: number | null
}

export type CounterpartVM =
  | { exists: false; reason: string }
  | { exists: true; threadId: string }

export interface ThreadSummaryVM {
  thread: ForumThread
  branch: ForumBranchId
  messageCount: number
  counterpart: CounterpartVM
}

export interface ClaimSummaryVM {
  claim: ForumClaim
  branch: ForumBranchId
  supportCount: number
  challengeCount: number
}

export interface AgentActivityVM {
  displayId: string
  branch: ForumBranchId
  messageCount: number
  firstTick: number
  lastTick: number
  actions: string[]
  topics: string[]
  profileAvailable: boolean
}

export interface GovernanceDecisionVM {
  actor: string
  action: string
  probability: number | null
  noop: boolean
}

export interface GovernanceTickVM {
  tick: number
  decisions: GovernanceDecisionVM[]
  publishedMessages: ForumMessage[]
  responseMessages: ForumMessage[]
  noResponseMessageCount: number
  noopCount: number
  uptake: { completeChains: number; totalChains: number }
  chainsForTick: Array<{ governanceMessageId: string; complete: boolean; residentResponseCount: number }>
}

export interface ForumInvestigationVM {
  resultKey: string
  sourceKey: string
  sourceLabel: string
  scenarioId: string
  scenarioLabel: string
  tickIds: number[]
  tick: number
  tickCorrected: boolean
  phase: string
  metric: ResultMetricKey
  natural: BranchTickVM
  explanation: BranchTickVM
  intervention: BranchTickVM
  threads: Record<ForumBranchId, ThreadSummaryVM[]>
  claims: Record<ForumBranchId, ClaimSummaryVM[]>
  agents: Record<ForumBranchId, AgentActivityVM[]>
  governance: GovernanceTickVM | null
  timeline: ResultTimelinePoint[]
  population: number
  publicationEligible: boolean
}

export function forumScenarioId(result: ResultViewModel): string {
  return result.scope.scenarios[0] || ''
}

export function forumTicks(result: ResultViewModel): number[] {
  return result.scope.tickIds
}

export function phaseAt(result: ResultViewModel, tick: number): string {
  return result.summary.timeline.find((point) => point.tick === tick)?.phase || 'unknown'
}

export function metricLabel(metric: ResultMetricKey): string {
  const labels: Record<ResultMetricKey, string> = {
    messages: '公开消息',
    threads: '活跃讨论串',
    claims: '公开 Claim',
    corrections: '纠正',
    help_requests: '求助请求',
  }
  return labels[metric] || metric
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function branchMetrics(result: ResultViewModel, branch: 'natural' | 'A' | 'D', tick: number): BranchTickVM {
  const point = result.summary.timeline.find((item) => item.tick === tick)
  const active = point?.[branch === 'natural' ? 'natural' : branch === 'A' ? 'explanation' : 'intervention']
  const naturalPoint = point?.natural
  const messages = numberOrNull(active?.messages)
  // Δ = D − Natural for the D branch only; sign is descriptive, never a verdict.
  const delta = branch === 'D' && messages !== null && naturalPoint?.messages !== null
    ? messages - numberOrNull(naturalPoint?.messages)!
    : null
  return {
    messages,
    threads: numberOrNull(active?.threads),
    claims: numberOrNull(active?.claims),
    corrections: numberOrNull(active?.corrections),
    helpRequests: numberOrNull(active?.help_requests),
    activatedResidents: null,
    activatedGovernance: null,
    delta,
  }
}

/**
 * M05-BDD-05: counterpart exists only when the published contract maps it.
 * The public ForumTwin contract exposes no cross-branch mapping today, so
 * every object is branch-only and the UI must say so instead of pairing.
 */
export function threadCounterpart(thread: ForumThread): CounterpartVM {
  const mapped = thread.mapped_counterpart_thread_id
  if (typeof mapped === 'string' && mapped) return { exists: true, threadId: mapped }
  return { exists: false, reason: '无公开对应讨论串映射；不会按文本相似度伪造配对。' }
}

export function visibleThreads(result: ResultViewModel, branch: ForumBranchId, tick: number): ThreadSummaryVM[] {
  const slice = result.forum?.threads || []
  return slice
    .filter((thread) => thread.branch_id === branch && thread.created_tick <= tick)
    .sort((left, right) => (
      (right.last_active_tick ?? right.created_tick) - (left.last_active_tick ?? left.created_tick)
      || right.created_tick - left.created_tick
      || left.thread_id.localeCompare(right.thread_id)
    ))
    .map((thread) => ({
      thread,
      branch,
      messageCount: thread.message_ids.length,
      counterpart: threadCounterpart(thread),
    }))
}

export function visibleMessagesForThread(result: ResultViewModel, threadId: string, tick: number, branch?: ForumBranchId): ForumMessage[] {
  const slice = result.forum?.messages || []
  return slice
    .filter((message) => message.thread_id === threadId && message.created_tick <= tick && (!branch || message.branch_id === branch))
    .sort((left, right) => (
      left.created_tick - right.created_tick
      || left.message_id.localeCompare(right.message_id)
    ))
}

export function visibleClaims(result: ResultViewModel, branch: ForumBranchId, tick: number): ClaimSummaryVM[] {
  const slice = result.forum?.claims || []
  return slice
    .filter((claim) => claim.branch_id === branch && claim.first_seen_tick <= tick)
    .sort((left, right) => (
      left.first_seen_tick - right.first_seen_tick
      || left.claim_id.localeCompare(right.claim_id)
    ))
    .map((claim) => ({
      claim,
      branch,
      supportCount: claim.supporting_message_ids.length,
      challengeCount: claim.challenging_message_ids.length,
    }))
}

export function agentActivity(result: ResultViewModel, branch: ForumBranchId, tick: number): AgentActivityVM[] {
  const slice = result.forum?.messages || []
  const groups = new Map<string, ForumMessage[]>()
  for (const message of slice) {
    if (message.branch_id !== branch || message.created_tick > tick) continue
    const list = groups.get(message.source_display_id) || []
    list.push(message)
    groups.set(message.source_display_id, list)
  }
  const profileIds = new Set((result.forum?.profiles || []).map((profile) => profile.display_id))
  return [...groups.entries()]
    .map(([displayId, messages]) => {
      const sorted = [...messages].sort((left, right) => left.created_tick - right.created_tick)
      const actions = [...new Set(sorted.map((message) => message.action).filter((value): value is string => Boolean(value)))]
      const topics = [...new Set(sorted.map((message) => message.topic).filter((value): value is string => Boolean(value)))]
      return {
        displayId,
        branch,
        messageCount: messages.length,
        firstTick: sorted[0].created_tick,
        lastTick: sorted.at(-1)!.created_tick,
        actions,
        topics,
        profileAvailable: profileIds.has(displayId),
      }
    })
    .sort((left, right) => right.messageCount - left.messageCount || left.displayId.localeCompare(right.displayId))
}

/**
 * M05-BDD-08/09: governance at a tick is composed strictly from published
 * decision traces, published governance messages and real response messages.
 * Missing steps are never filled in; noop / no-response are first-class.
 */
export function governanceAtTick(result: ResultViewModel, tick: number): GovernanceTickVM | null {
  const messages = result.forum?.messages || []
  const governanceMessages = messages.filter((message) => (
    message.branch_id === 'D'
    && message.created_tick === tick
    && message.action === 'governance_message'
  )).sort((left, right) => left.message_id.localeCompare(right.message_id))

  const governanceMessageIds = new Set(governanceMessages.map((message) => message.message_id))
  const responseMessages = messages.filter((message) => (
    message.branch_id === 'D'
    && message.parent_message_id !== null
    && governanceMessageIds.has(message.parent_message_id)
    && message.created_tick <= tick
  ))

  const round = (result.forum?.governance?.rounds || []).find((item) => item.tick === tick)
  const decisions: GovernanceDecisionVM[] = round
    ? round.decisions.map((decision) => ({
        actor: decision.actor,
        action: decision.action,
        probability: decision.probability,
        noop: decision.noop,
      }))
    : []
  const noopCount = decisions.filter((decision) => decision.noop).length

  const chainsForTick = (result.forum?.governance?.uptakeChains || []).filter((chain) => (
    governanceMessageIds.has(chain.governanceMessageId)
  ))

  return {
    tick,
    decisions,
    publishedMessages: governanceMessages,
    responseMessages,
    noResponseMessageCount: governanceMessages.filter((message) => (
      !messages.some((candidate) => candidate.parent_message_id === message.message_id)
    )).length,
    noopCount,
    uptake: {
      completeChains: result.summary.governance.uptake.completeChains,
      totalChains: result.summary.governance.uptake.totalChains,
    },
    chainsForTick: chainsForTick.map((chain) => ({
      governanceMessageId: chain.governanceMessageId,
      complete: chain.complete,
      residentResponseCount: chain.residentResponseIds.length,
    })),
  }
}

export function buildForumInvestigation(result: ResultViewModel, state: ForumWorkspaceState): ForumInvestigationVM {
  const tickIds = forumTicks(result)
  const normalized = normalizeTick(state.tick, tickIds)
  const tick = normalized.tick
  const scenarioId = forumScenarioId(result)
  const threads: Record<ForumBranchId, ThreadSummaryVM[]> = {
    natural: visibleThreads(result, 'natural', tick),
    A: visibleThreads(result, 'A', tick),
    D: visibleThreads(result, 'D', tick),
  }
  return {
    resultKey: result.key,
    sourceKey: result.source.key,
    sourceLabel: result.source.label,
    scenarioId,
    scenarioLabel: result.scope.scenarioLabel,
    tickIds,
    tick,
    tickCorrected: normalized.corrected,
    phase: phaseAt(result, tick),
    metric: state.metric,
    natural: branchMetrics(result, 'natural', tick),
    explanation: branchMetrics(result, 'A', tick),
    intervention: branchMetrics(result, 'D', tick),
    threads,
    claims: {
      natural: visibleClaims(result, 'natural', tick),
      A: visibleClaims(result, 'A', tick),
      D: visibleClaims(result, 'D', tick),
    },
    agents: {
      natural: agentActivity(result, 'natural', tick),
      A: agentActivity(result, 'A', tick),
      D: agentActivity(result, 'D', tick),
    },
    governance: governanceAtTick(result, tick),
    timeline: result.summary.timeline,
    population: result.scope.population,
    publicationEligible: result.source.publicationEligible === true,
  }
}
