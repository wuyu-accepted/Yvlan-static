import type { ForumClaim, ForumMessage, ForumThread, ForumDisplayProfile, ForumTwinLoaded } from '../contracts/forumTwin.ts'
import type { ResourcePolicyStory } from '../../services/forumTwin.ts'
import type { SourceState } from '../contracts/source.ts'
import type {
  ForumTwinV2AggregateResult,
  ForumTwinV2Loaded,
  ForumTwinV2RiskSignal,
} from '../../services/forumTwinV2.ts'
import {
  HERO_SOURCE_KEY,
  HERO_RESULT_KEY,
  LECTURE_HERO_SOURCE_KEY,
  LECTURE_HERO_RESULT_KEY,
  LIVE_SOURCE_KEY,
  getSourceDescriptor,
} from './registry.ts'

export interface ResultGovernanceRoundDecision {
  actor: string
  action: string
  probability: number | null
  noop: boolean
}

export interface ResultGovernanceRound {
  tick: number
  decisions: ResultGovernanceRoundDecision[]
}

export interface ResultGovernanceUptakeChain {
  governanceMessageId: string
  complete: boolean
  residentResponseIds: string[]
}

export interface ResultGovernanceSlice {
  rounds: ResultGovernanceRound[]
  uptakeChains: ResultGovernanceUptakeChain[]
}

/** Published forum slice carried through the resolver for result analysis. */
export interface ResultForumSlice {
  threads: ForumThread[]
  claims: ForumClaim[]
  messages: ForumMessage[]
  profiles: ForumDisplayProfile[]
  governance: ResultGovernanceSlice
}

export interface ResultViewModel {
  key: string
  runId?: string
  source: SourceState
  scope: {
    scenarios: string[]
    scenarioLabel: string
    scenarioDescription: string
    seedCount: number
    tickIds: number[]
    population: number
    sharedConditions: string[]
  }
  summary: {
    naturalMessages: number | null
    explanationMessages: number | null
    interventionMessages: number | null
    residentTurns: number
    providerTokens: number
    timeline: ResultTimelinePoint[]
    governance: {
      publishedMessages: number
      noResponseMessages: number
      noopDecisions: number
      decisionTicks: Array<{ tick: number; summary: string }>
      uptake: { completeChains: number; totalChains: number }
    }
  }
  capabilities: {
    threads: boolean
    claims: boolean
    agents: boolean
    particles: boolean
    reports: boolean
  }
  provenance: SourceState['provenance']
  boundaries: string[]
  slotCompleteness?: {
    completed: number
    required: number
    status: string
  }
  forum?: ResultForumSlice
  resourcePolicy?: ResourcePolicyStory
  forumTwinV2?: ForumTwinV2ResultView
  mechanismSummary?: {
    strictCorrectionChains: number
    governanceUptakeChains: number
    helpServiceClosures: number
  }
  /** Evidence-bound pilot annotation; only present for the sealed offline Hero. */
  heroAnnotation?: { text: string; evidenceId: string; manifestId: string }
}

export interface ForumTwinV2CensusPoint {
  branch: string
  tick: number | null
  budget: number
  actionMae: number | null
  stanceMae: number | null
  topicMae: number | null
  privateActionMae: number | null
  coverage95: number | null
  schedulerRecall: number | null
}

export interface ForumTwinV2RiskTick {
  scenarioId: string
  branch: string
  tick: number
  signals: ForumTwinV2RiskSignal[]
}

export interface ForumTwinV2ResultView {
  activationMode: ForumTwinV2AggregateResult['activation_mode']
  executionProvenance: ForumTwinV2AggregateResult['execution_provenance']
  publicationEligible: boolean
  publicMetrics: Record<string, unknown>
  privateAggregateMetrics: Record<string, unknown>
  riskTimeline: ForumTwinV2RiskTick[]
  censusPoints: ForumTwinV2CensusPoint[]
  censusStatus: string | null
  relationshipAblation: Record<string, unknown> | null
  governance: Record<string, unknown>
  completeness: ForumTwinV2AggregateResult['completeness']
  usage: Record<string, unknown>
}

export type ResultMetricKey = 'messages' | 'threads' | 'claims' | 'corrections' | 'help_requests'

export interface ResultBranchMetrics {
  messages: number | null
  threads: number | null
  claims: number | null
  corrections: number | null
  help_requests: number | null
  attention: number | null
  concern: number | null
  trust: number | null
  satisfaction: number | null
  support: number | null
  opposition: number | null
}

export interface ResultTimelinePoint {
  tick: number
  phase: string
  natural: ResultBranchMetrics | null
  explanation: ResultBranchMetrics | null
  intervention: ResultBranchMetrics | null
}

function tickIds(loaded: ForumTwinLoaded): number[] {
  const scenarioId = loaded.domain.scenarios[0]?.scenario_id
  if (!scenarioId) return []
  const forum = loaded.domain.parallel_forums[scenarioId]
  const timeline = forum?.natural?.timeline || forum?.A?.timeline || forum?.D?.timeline || []
  return timeline.map((tick) => tick.tick)
}

function finalMessages(loaded: ForumTwinLoaded, branch: 'natural' | 'A' | 'D'): number | null {
  const scenarioId = loaded.domain.scenarios[0]?.scenario_id
  const timeline = scenarioId ? loaded.domain.parallel_forums[scenarioId]?.[branch]?.timeline : []
  return timeline?.at(-1)?.public_message_count ?? null
}

function branchMetrics(tick: any): ResultBranchMetrics | null {
  if (!tick) return null
  const optionalNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
  const state = tick.metrics && typeof tick.metrics === 'object' ? tick.metrics : {}
  return {
    messages: optionalNumber(tick.public_message_count),
    threads: Array.isArray(tick.active_thread_ids) ? tick.active_thread_ids.length : null,
    claims: optionalNumber(tick.claim_count),
    corrections: optionalNumber(tick.correction_count),
    help_requests: optionalNumber(tick.help_request_count),
    attention: optionalNumber(state.attention),
    concern: optionalNumber(state.concern),
    trust: optionalNumber(state.trust),
    satisfaction: optionalNumber(state.satisfaction),
    support: optionalNumber(state.support),
    opposition: optionalNumber(state.opposition),
  }
}

function timeline(loaded: ForumTwinLoaded): ResultTimelinePoint[] {
  const scenarioId = loaded.domain.scenarios[0]?.scenario_id
  const forum = scenarioId ? loaded.domain.parallel_forums[scenarioId] : undefined
  const natural = new Map((forum?.natural.timeline || []).map((point) => [point.tick, point]))
  const explanation = new Map((forum?.A?.timeline || []).map((point) => [point.tick, point]))
  const intervention = new Map((forum?.D.timeline || []).map((point) => [point.tick, point]))
  return [...new Set([...natural.keys(), ...explanation.keys(), ...intervention.keys()])]
    .sort((left, right) => left - right)
    .map((tick) => ({
      tick,
      phase: natural.get(tick)?.phase || explanation.get(tick)?.phase || intervention.get(tick)?.phase || 'unknown',
      natural: branchMetrics(natural.get(tick)),
      explanation: branchMetrics(explanation.get(tick)),
      intervention: branchMetrics(intervention.get(tick)),
    }))
}

function governanceSignals(loaded: ForumTwinLoaded) {
  let publishedMessages = 0
  let noResponseMessages = 0
  let noopDecisions = 0
  let totalChains = 0
  let completeChains = 0
  const visit = (value: unknown, key = '') => {
    if (Array.isArray(value)) {
      if (key === 'governance_uptake_chains') {
        publishedMessages += value.length
        totalChains += value.length
        completeChains += value.filter((item: any) => item?.complete === true).length
        noResponseMessages += value.filter((item: any) => Array.isArray(item?.resident_response_ids) && item.resident_response_ids.length === 0).length
      }
      value.forEach((item) => visit(item))
      return
    }
    if (!value || typeof value !== 'object') return
    for (const [childKey, childValue] of Object.entries(value)) {
      if (childKey === 'selected_action' && childValue === 'noop') noopDecisions += 1
      visit(childValue, childKey)
    }
  }
  visit(loaded.domain.governance)
  return {
    publishedMessages,
    noResponseMessages,
    noopDecisions,
    uptake: { completeChains, totalChains },
  }
}

function governanceDecisionTicks(loaded: ForumTwinLoaded): Array<{ tick: number; summary: string }> {
  const scenarioId = loaded.domain.scenarios[0]?.scenario_id
  const timeline = scenarioId
    ? loaded.domain.parallel_forums[scenarioId]?.['D'].timeline || []
    : []
  const ticks: Array<{ tick: number; summary: string }> = []
  for (const tick of timeline) {
    const decision = tick.governance_decision
    if (!decision || typeof decision !== 'object' || Object.keys(decision).length === 0) continue
    const parts = Object.entries(decision)
      .filter(([key]) => !['resource', 'conserved'].includes(key))
      .map(([actor, action]) => `${actor}: ${String(action)}`)
    ticks.push({ tick: tick.tick, summary: parts.join(' · ') })
  }
  return ticks
}

function governanceSlice(loaded: ForumTwinLoaded): ResultGovernanceSlice {
  const rounds: ResultGovernanceRound[] = []
  const uptakeChains: ResultGovernanceUptakeChain[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      if (value === (loaded.domain.governance as any)?.governance_rounds) {
        value.forEach((item) => {
          const round = item as Record<string, unknown>
          const tick = typeof round.tick === 'number' ? round.tick : Number.NaN
          if (!Number.isFinite(tick)) return
          const decisions = Array.isArray(round.decisions)
            ? (round.decisions as Array<Record<string, unknown>>).map((decision) => ({
                actor: typeof decision.actor === 'string' ? decision.actor : '',
                action: typeof decision.selected_action === 'string' ? decision.selected_action : '',
                probability: typeof decision.selection_probability === 'number'
                  ? decision.selection_probability : null,
                noop: decision.selected_action === 'noop',
              }))
            : []
          rounds.push({ tick, decisions })
        })
        return
      }
      if (value === (loaded.domain.governance as any)?.governance_uptake_chains) {
        value.forEach((item) => {
          const chain = item as Record<string, unknown>
          if (typeof chain.governance_message_id !== 'string') return
          uptakeChains.push({
            governanceMessageId: chain.governance_message_id,
            complete: chain.complete === true,
            residentResponseIds: Array.isArray(chain.resident_response_ids)
              ? chain.resident_response_ids.filter((id): id is string => typeof id === 'string')
              : [],
          })
        })
        return
      }
      value.forEach((child) => visit(child))
      return
    }
    if (!value || typeof value !== 'object') return
    for (const child of Object.values(value as Record<string, unknown>)) visit(child)
  }
  visit(loaded.domain.governance)
  return { rounds, uptakeChains }
}

function forumSlice(loaded: ForumTwinLoaded): ResultForumSlice {
  return {
    threads: loaded.threads,
    claims: loaded.claims,
    messages: loaded.messages,
    profiles: loaded.profiles,
    governance: governanceSlice(loaded),
  }
}

export function adaptHeroResult(loaded: ForumTwinLoaded, fetchedAt = new Date().toISOString()): ResultViewModel {
  const descriptor = getSourceDescriptor(HERO_SOURCE_KEY)!
  const scenarioId = loaded.domain.scenarios[0]?.scenario_id
  const source: SourceState = {
    key: descriptor.key,
    mode: descriptor.mode,
    label: descriptor.label,
    verification: 'verified',
    freshness: { status: 'unknown', fetchedAt },
    availability: { backend: 'unknown', access: 'readonly' },
    provenance: {
      runId: loaded.aggregate.run_id,
      scenarioId,
      evidenceId: 'resource-policy-live-r1',
      provider: 'gpt-5.6-luna',
      origin: 'sealed offline public asset',
      executionProvenance: loaded.aggregate.execution_provenance,
      manifestId: loaded.manifestSha256,
      manifestAvailable: true,
      actualHash: loaded.manifestSha256,
    },
    publicationEligible: false,
    boundaries: descriptor.boundaries,
    boundarySummary: descriptor.boundaries.join(' '),
  }
  return {
    key: HERO_RESULT_KEY,
    runId: loaded.aggregate.run_id,
    source,
    scope: {
      scenarios: scenarioId ? [scenarioId] : [],
      scenarioLabel: loaded.domain.scenarios[0]?.label || scenarioId || '未命名场景',
      scenarioDescription: loaded.domain.scenarios[0]?.description || '',
      seedCount: 1,
      tickIds: tickIds(loaded),
      population: Number(loaded.aggregate.domain_result?.audit?.llm_agent_count || 0),
      sharedConditions: ['共享人口', '共享初始状态', '共享事件条件'],
    },
    summary: {
      naturalMessages: finalMessages(loaded, 'natural'),
      explanationMessages: finalMessages(loaded, 'A'),
      interventionMessages: finalMessages(loaded, 'D'),
      residentTurns: loaded.domain.llm_usage.resident_turns,
      providerTokens: loaded.domain.llm_usage.provider_tokens,
      timeline: timeline(loaded),
      governance: {
        ...governanceSignals(loaded),
        decisionTicks: governanceDecisionTicks(loaded),
      },
    },
    capabilities: {
      threads: loaded.threads.length > 0,
      claims: loaded.claims.length > 0,
      agents: loaded.profiles.length > 0,
      particles: false,
      reports: false,
    },
    provenance: source.provenance,
    boundaries: descriptor.boundaries,
    ...(loaded.aggregate.completeness ? {
      slotCompleteness: {
        completed: loaded.aggregate.completeness.completed_primary_slots,
        required: loaded.aggregate.completeness.required_primary_slots,
        status: loaded.aggregate.completeness.status,
      },
    } : {}),
    forum: forumSlice(loaded),
    resourcePolicy: loaded.resourcePolicy,
    heroAnnotation: {
      text: String((loaded.domain.hero_gates as any)?.disclosure || descriptor.boundaries[0]),
      evidenceId: 'resource-policy-live-r1',
      manifestId: loaded.manifestSha256,
    },
  }
}

/** Reviewed real-LLM open-choice lecture pilot. It is a paired Natural/D
 * model-conditioned rehearsal, never a causal policy estimate. */
export function adaptLectureHeroResult(
  loaded: ForumTwinLoaded,
  fetchedAt = new Date().toISOString(),
): ResultViewModel {
  const base = adaptHeroResult(loaded, fetchedAt)
  const descriptor = getSourceDescriptor(LECTURE_HERO_SOURCE_KEY)!
  const source: SourceState = {
    ...base.source,
    key: descriptor.key,
    mode: descriptor.mode,
    label: descriptor.label,
    provenance: {
      ...base.source.provenance,
      evidenceId: 'lecture-open-choice-r4',
      origin: 'sealed reviewed live-LLM open-choice pilot',
    },
    publicationEligible: false,
    boundaries: descriptor.boundaries,
    boundarySummary: descriptor.boundaries.join(' '),
  }
  const governance = loaded.domain.governance as Record<string, unknown>
  const completeCount = (key: string) => Array.isArray(governance?.[key])
    ? (governance[key] as Array<Record<string, unknown>>).filter((item) => item?.complete === true).length
    : 0
  return {
    ...base,
    key: LECTURE_HERO_RESULT_KEY,
    source,
    provenance: source.provenance,
    boundaries: descriptor.boundaries,
    resourcePolicy: undefined,
    mechanismSummary: {
      strictCorrectionChains: completeCount('correction_chains'),
      governanceUptakeChains: completeCount('governance_uptake_chains'),
      helpServiceClosures: completeCount('help_service_feedback_chains'),
    },
    heroAnnotation: {
      text: '真实 LLM 平行运行中，主动治理分支形成 4 条居民直接承接链；公开消息由 167 增至 173，Claim 由 22 收敛至 4，模型 trust 由 0.392 升至 0.424、concern 由 0.256 降至 0.229。',
      evidenceId: 'lecture-open-choice-r4',
      manifestId: loaded.manifestSha256,
    },
  }
}

export function adaptFormalResult(loaded: ForumTwinLoaded, runId: string, fetchedAt = new Date().toISOString()): ResultViewModel {
  const descriptor = getSourceDescriptor(LIVE_SOURCE_KEY)!
  const scenarioId = loaded.domain.scenarios[0]?.scenario_id
  const executionProvenance = loaded.aggregate.execution_provenance
  const source: SourceState = {
    key: descriptor.key,
    mode: descriptor.mode,
    label: descriptor.label,
    verification: 'verified',
    freshness: { status: 'unknown', fetchedAt },
    availability: { backend: 'available', access: 'readonly' },
    provenance: {
      runId,
      scenarioId,
      origin: 'CampusPulse result API',
      executionProvenance,
      manifestId: loaded.manifestSha256,
      manifestAvailable: true,
      actualHash: loaded.manifestSha256,
    },
    publicationEligible: Boolean(loaded.aggregate.publication_eligible),
    boundaries: [
      ...descriptor.boundaries,
      executionProvenance === 'reviewed_trace_replay'
        ? '该结果由 Live API 交付，但执行来源是 reviewed trace replay。'
        : `执行 provenance：${executionProvenance}。`,
    ],
    boundarySummary: `Live API 已返回并通过结果/manifest 校验；执行 provenance：${executionProvenance}。`,
  }
  return {
    key: runId,
    runId,
    source,
    scope: {
      scenarios: scenarioId ? [scenarioId] : [],
      scenarioLabel: loaded.domain.scenarios[0]?.label || scenarioId || '未命名场景',
      scenarioDescription: loaded.domain.scenarios[0]?.description || '',
      seedCount: Array.isArray((loaded.aggregate as any).seeds) ? (loaded.aggregate as any).seeds.length : 0,
      tickIds: tickIds(loaded),
      population: Number(loaded.aggregate.domain_result?.audit?.llm_agent_count || 0),
      sharedConditions: ['共享人口', '共享初始状态', '共享事件条件'],
    },
    summary: {
      naturalMessages: finalMessages(loaded, 'natural'),
      explanationMessages: finalMessages(loaded, 'A'),
      interventionMessages: finalMessages(loaded, 'D'),
      residentTurns: loaded.domain.llm_usage.resident_turns,
      providerTokens: loaded.domain.llm_usage.provider_tokens,
      timeline: timeline(loaded),
      governance: {
        ...governanceSignals(loaded),
        decisionTicks: governanceDecisionTicks(loaded),
      },
    },
    capabilities: {
      threads: loaded.threads.length > 0,
      claims: loaded.claims.length > 0,
      agents: loaded.profiles.length > 0,
      particles: Boolean((loaded.aggregate.domain_result as any)?.particles),
      reports: Boolean(loaded.aggregate.publication_eligible),
    },
    provenance: source.provenance,
    boundaries: source.boundaries,
    forum: forumSlice(loaded),
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function censusPoints(value: unknown): ForumTwinV2CensusPoint[] {
  if (!value || typeof value !== 'object') return []
  const calibration = value as Record<string, unknown>
  const rounds = Array.isArray(calibration.round_results)
    ? calibration.round_results
    : [{ branch: 'all', tick: null, calibration }]
  const points: ForumTwinV2CensusPoint[] = []
  for (const rawRound of rounds) {
    if (!rawRound || typeof rawRound !== 'object') continue
    const round = rawRound as Record<string, unknown>
    const nested = round.calibration && typeof round.calibration === 'object'
      ? round.calibration as Record<string, unknown>
      : round
    if (!Array.isArray(nested.budgets)) continue
    for (const rawBudget of nested.budgets) {
      if (!rawBudget || typeof rawBudget !== 'object') continue
      const budget = rawBudget as Record<string, unknown>
      const fields = budget.field_mae && typeof budget.field_mae === 'object'
        ? budget.field_mae as Record<string, unknown>
        : {}
      const budgetValue = finiteNumber(budget.budget)
      if (budgetValue === null) continue
      points.push({
        branch: typeof round.branch === 'string' ? round.branch : 'all',
        tick: finiteNumber(round.tick),
        budget: budgetValue,
        actionMae: finiteNumber(fields.action),
        stanceMae: finiteNumber(fields.stance),
        topicMae: finiteNumber(fields.topic),
        privateActionMae: finiteNumber(fields.private_action),
        coverage95: finiteNumber(budget.coverage_95),
        schedulerRecall: finiteNumber(budget.public_action_scheduler_recall),
      })
    }
  }
  return points.sort((left, right) => (
    left.branch.localeCompare(right.branch)
    || (left.tick ?? -1) - (right.tick ?? -1)
    || left.budget - right.budget
  ))
}

/** Aggregate-only v9/result-v7 adapter. Record-level relationships and private
 * conversations never enter this view model. */
export function adaptForumTwinV2Result(
  loaded: ForumTwinV2Loaded,
  fetchedAt = new Date().toISOString(),
): ResultViewModel {
  const aggregate = loaded.aggregate
  const descriptor = getSourceDescriptor(LIVE_SOURCE_KEY)!
  const riskTimeline: ForumTwinV2RiskTick[] = aggregate.risk_results
    .map((risk) => ({
      scenarioId: risk.scenario_id,
      branch: risk.branch,
      tick: risk.tick,
      signals: risk.signals,
    }))
    .sort((left, right) => left.tick - right.tick || left.branch.localeCompare(right.branch))
  const scenarioIds = [...new Set(riskTimeline.map((item) => item.scenarioId))]
  const publicMetrics = aggregate.public_metrics
  const usage = aggregate.usage
  const source: SourceState = {
    key: descriptor.key,
    mode: descriptor.mode,
    label: descriptor.label,
    verification: 'verified',
    freshness: { status: 'unknown', fetchedAt },
    availability: { backend: 'available', access: 'readonly' },
    provenance: {
      runId: aggregate.run_id,
      scenarioId: scenarioIds[0],
      origin: 'CampusPulse result-v7 API',
      executionProvenance: aggregate.execution_provenance,
      manifestAvailable: false,
      actualHash: aggregate.result_sha256,
    },
    publicationEligible: aggregate.publication_eligible,
    boundaries: [...descriptor.boundaries],
    boundarySummary: 'Result-v7 已通过结构、隐私字段与 SHA-256 校验。',
  }
  const population = finiteNumber(publicMetrics.population)
    ?? finiteNumber(publicMetrics.planned_population)
    ?? finiteNumber(publicMetrics.agent_count)
    ?? 1_000
  return {
    key: aggregate.run_id,
    runId: aggregate.run_id,
    source,
    scope: {
      scenarios: scenarioIds,
      scenarioLabel: typeof publicMetrics.scenario_label === 'string'
        ? publicMetrics.scenario_label
        : scenarioIds[0] || 'ForumTwin v2 运行',
      scenarioDescription: typeof publicMetrics.scenario_description === 'string'
        ? publicMetrics.scenario_description
        : '',
      seedCount: finiteNumber(publicMetrics.seed_count) ?? 1,
      tickIds: [...new Set(riskTimeline.map((item) => item.tick))].sort((a, b) => a - b),
      population,
      sharedConditions: ['共享公开榜单', '合成关系注意层', '公开论坛与私聊双层传播'],
    },
    summary: {
      naturalMessages: finiteNumber(publicMetrics.natural_messages),
      explanationMessages: finiteNumber(publicMetrics.explanation_messages),
      interventionMessages: finiteNumber(publicMetrics.intervention_messages),
      residentTurns: finiteNumber(usage.resident_turns) ?? 0,
      providerTokens: finiteNumber(usage.provider_tokens) ?? 0,
      timeline: [],
      governance: {
        publishedMessages: finiteNumber((aggregate.governance as Record<string, unknown>).published_messages) ?? 0,
        noResponseMessages: finiteNumber((aggregate.governance as Record<string, unknown>).no_response_messages) ?? 0,
        noopDecisions: finiteNumber((aggregate.governance as Record<string, unknown>).noop_decisions) ?? 0,
        decisionTicks: [],
        uptake: { completeChains: 0, totalChains: 0 },
      },
    },
    capabilities: {
      threads: false,
      claims: false,
      agents: false,
      particles: false,
      reports: aggregate.publication_eligible,
    },
    provenance: source.provenance,
    boundaries: source.boundaries,
    forumTwinV2: {
      activationMode: aggregate.activation_mode,
      executionProvenance: aggregate.execution_provenance,
      publicationEligible: aggregate.publication_eligible,
      publicMetrics: aggregate.public_metrics,
      privateAggregateMetrics: aggregate.private_aggregate_metrics,
      riskTimeline,
      censusPoints: censusPoints(aggregate.census_calibration),
      censusStatus: aggregate.census_calibration && typeof aggregate.census_calibration.status === 'string'
        ? aggregate.census_calibration.status
        : null,
      relationshipAblation: aggregate.relationship_ablation,
      governance: aggregate.governance,
      completeness: aggregate.completeness,
      usage: aggregate.usage,
    },
  }
}
