import type { ResultMetricKey } from '../source/forumTwinAdapter.ts'

/**
 * M05 ForumTwin Investigation Workspace — URL state.
 * Object identity (source/result/tick/thread/claim/agent) is shareable and
 * refresh-restorable; view state (branch view, inspector tab, search) is kept
 * only when it survives navigation meaningfully.
 */

export type ForumBranchView = 'both' | 'natural' | 'A' | 'D'
export type ForumInspectorTab = 'thread' | 'claim' | 'agent' | 'governance' | 'evidence'

export const DEFAULT_METRIC: ResultMetricKey = 'messages'

export interface ForumWorkspaceState {
  source: string
  resultKey: string
  runId?: string
  scenario?: string
  tick?: number
  metric: ResultMetricKey
  branch: ForumBranchView
  q: string
  thread?: string
  claim?: string
  agent?: string
  agentBranch?: 'natural' | 'A' | 'D'
  inspector: ForumInspectorTab
  fallbackFrom?: string
}

function firstString(query: Record<string, unknown>, key: string): string {
  const value = query[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function branchViewFromQuery(value: unknown): ForumBranchView {
  return value === 'natural' || value === 'A' || value === 'D' ? value : 'both'
}

export function branchIdFromQuery(value: unknown): 'natural' | 'A' | 'D' | undefined {
  return value === 'natural' ? 'natural' : value === 'A' ? 'A' : value === 'D' ? 'D' : undefined
}

export function inspectorTabFromQuery(value: unknown): ForumInspectorTab {
  return value === 'thread' || value === 'claim' || value === 'agent' || value === 'governance' || value === 'evidence'
    ? value
    : 'thread'
}

export function metricFromQuery(value: unknown, valid: ResultMetricKey[] = []): ResultMetricKey {
  const requested = typeof value === 'string' ? value as ResultMetricKey : ''
  return valid.includes(requested) ? requested : DEFAULT_METRIC
}

export function workspaceFromQuery(query: Record<string, unknown>, validMetrics: ResultMetricKey[] = []): ForumWorkspaceState {
  const tick = Number(firstString(query, 'tick'))
  return {
    source: firstString(query, 'source'),
    resultKey: firstString(query, 'result'),
    runId: firstString(query, 'run_id') || undefined,
    scenario: firstString(query, 'scenario') || undefined,
    tick: Number.isInteger(tick) && tick >= 0 ? tick : undefined,
    metric: metricFromQuery(query.metric, validMetrics),
    branch: branchViewFromQuery(query.branch),
    q: firstString(query, 'q'),
    thread: firstString(query, 'thread') || undefined,
    claim: firstString(query, 'claim') || undefined,
    agent: firstString(query, 'agent') || undefined,
    agentBranch: branchIdFromQuery(query.agent_branch),
    inspector: inspectorTabFromQuery(query.inspector),
    fallbackFrom: firstString(query, 'fallback_from') || undefined,
  }
}

export function workspaceToQuery(state: ForumWorkspaceState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.source) query.source = state.source
  if (state.resultKey) query.result = state.resultKey
  if (state.runId) query.run_id = state.runId
  if (state.scenario) query.scenario = state.scenario
  if (typeof state.tick === 'number') query.tick = String(state.tick)
  if (state.metric && state.metric !== DEFAULT_METRIC) query.metric = state.metric
  if (state.branch !== 'both') query.branch = state.branch
  if (state.q) query.q = state.q
  if (state.thread) query.thread = state.thread
  if (state.claim) query.claim = state.claim
  if (state.agent) query.agent = state.agent
  if (state.agentBranch) query.agent_branch = state.agentBranch
  if (state.inspector !== 'thread') query.inspector = state.inspector
  if (state.fallbackFrom) query.fallback_from = state.fallbackFrom
  return query
}

/**
 * M05-BDD-01/02: tick is a real manifest tick, never an array index.
 * Invalid tick resolves to the nearest available tick and reports correction.
 */
export function normalizeTick(requested: number | undefined, tickIds: number[]): { tick: number; corrected: boolean } {
  const sorted = [...tickIds].sort((left, right) => left - right)
  if (sorted.length === 0) return { tick: 0, corrected: true }
  if (requested === undefined) return { tick: sorted[0], corrected: false }
  if (sorted.includes(requested)) return { tick: requested, corrected: false }
  const nearest = sorted.reduce((best, tick) => {
    const distance = Math.abs(tick - requested)
    const bestDistance = Math.abs(best - requested)
    // On an exact tie prefer the later tick (forward investigation context).
    return distance < bestDistance || (distance === bestDistance && tick > best) ? tick : best
  }, sorted[0])
  return { tick: nearest, corrected: true }
}

/**
 * M05 -> M04 return path: restore result / source / metric / tick instead of
 * dumping the user back on the results index.
 */
export function returnToResultLocation(state: Pick<ForumWorkspaceState, 'source' | 'resultKey' | 'metric' | 'tick'>) {
  const query: Record<string, string> = { source: state.source }
  if (state.metric && state.metric !== DEFAULT_METRIC) query.metric = state.metric
  if (typeof state.tick === 'number') query.tick = String(state.tick)
  return {
    name: 'campus-pulse-result-summary',
    params: { resultKey: state.resultKey },
    query,
  }
}

export function forumInvestigationLocation(state: Pick<ForumWorkspaceState, 'source' | 'resultKey' | 'runId' | 'metric' | 'tick' | 'branch' | 'q' | 'thread' | 'claim' | 'agent' | 'agentBranch' | 'inspector' | 'scenario'>) {
  return {
    name: 'campus-pulse-forum',
    query: workspaceToQuery({
      source: state.source,
      resultKey: state.resultKey,
      runId: state.runId,
      metric: state.metric,
      tick: state.tick,
      branch: state.branch,
      q: state.q,
      thread: state.thread,
      claim: state.claim,
      agent: state.agent,
      agentBranch: state.agentBranch,
      inspector: state.inspector,
      scenario: state.scenario,
    }),
  }
}
