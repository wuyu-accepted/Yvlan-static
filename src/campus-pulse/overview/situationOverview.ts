import type { RouteLocationRaw } from 'vue-router'
import type { ResultMetricKey, ResultTimelinePoint, ResultViewModel } from '../source/forumTwinAdapter.ts'

export const overviewMetricDefinitions = [
  { key: 'messages', label: '公开消息', unit: '条' },
  { key: 'threads', label: '活跃讨论串', unit: '个' },
  { key: 'claims', label: '公开 Claim', unit: '个' },
  { key: 'corrections', label: '纠正', unit: '条' },
  { key: 'help_requests', label: '求助请求', unit: '条' },
] as const

export interface EvidenceRefVM {
  label: string
  manifestId?: string
  origin?: string
  action: RouteLocationRaw
}

export interface ExceptionItemVM {
  id: string
  kind: 'run_failure' | 'verification' | 'publication' | 'divergence' | 'no_response' | 'stale' | 'contract'
  severity: 'blocking' | 'attention' | 'info'
  title: string
  detail: string
  scope: { tick?: number; branch?: string; threadId?: string; claimId?: string }
  evidenceRef?: EvidenceRefVM
  action: RouteLocationRaw
}

export interface FindingVM {
  id: string
  title: string
  detail: string
  tick?: number
  evidenceRef?: EvidenceRefVM
  boundary: string
}

export interface SituationOverviewVM {
  result: ResultViewModel
  title: string
  scopeLabel: string
  observationWindow: string
  pilotBoundary: string
  metrics: typeof overviewMetricDefinitions
  timeline: ResultTimelinePoint[]
  exceptions: ExceptionItemVM[]
  findings: FindingVM[]
  defaultMetric: ResultMetricKey
  defaultTick: number | null
}

function resultQuery(result: ResultViewModel, tick?: number) {
  return {
    source: result.source.key,
    ...(result.source.key === 'live-api' && result.runId ? { result: result.runId } : { result: result.key }),
    ...(typeof tick === 'number' ? { tick: String(tick) } : {}),
  }
}

export function resultSummaryLocation(result: ResultViewModel, tick?: number): RouteLocationRaw {
  return {
    name: 'campus-pulse-result-summary',
    params: { resultKey: result.key },
    query: resultQuery(result, tick),
  }
}

export function forumLocation(result: ResultViewModel, tick?: number): RouteLocationRaw {
  return {
    name: 'campus-pulse-forum',
    query: {
      source: result.source.key,
      ...(result.source.key === 'live-api' && result.runId ? { run_id: result.runId } : {}),
      ...(typeof tick === 'number' ? { tick: String(tick) } : {}),
    },
  }
}

function evidenceRef(result: ResultViewModel, tick?: number): EvidenceRefVM | undefined {
  if (result.source.verification !== 'verified') return undefined
  return {
    label: `已验证 manifest${typeof tick === 'number' ? ` · Tick ${tick}` : ''}`,
    manifestId: result.provenance.manifestId,
    origin: result.provenance.origin,
    action: { name: 'campus-pulse-system', query: resultQuery(result, tick) },
  }
}

export function metricValue(point: ResultTimelinePoint, branch: 'natural' | 'explanation' | 'intervention', metric: ResultMetricKey) {
  return point[branch]?.[metric] ?? null
}

export function strongestObservedDifference(result: ResultViewModel) {
  let strongest: { metric: ResultMetricKey; tick: number; natural: number; intervention: number; delta: number } | null = null
  for (const point of result.summary.timeline) {
    for (const definition of overviewMetricDefinitions) {
      const natural = metricValue(point, 'natural', definition.key)
      const intervention = metricValue(point, 'intervention', definition.key)
      if (natural === null || intervention === null) continue
      const candidate = { metric: definition.key, tick: point.tick, natural, intervention, delta: intervention - natural }
      if (!strongest || Math.abs(candidate.delta) > Math.abs(strongest.delta)) strongest = candidate
    }
  }
  return strongest
}

export function buildExceptionItems(result: ResultViewModel): ExceptionItemVM[] {
  const items: ExceptionItemVM[] = []
  const evidence = evidenceRef(result)
  if (result.source.publicationEligible === false) {
    items.push({
      id: 'publication-boundary', kind: 'publication', severity: 'attention',
      title: '当前结果不可正式发布',
      detail: '结果仍可用于受限审阅；发布门禁未通过不等于结果无效。',
      scope: {}, evidenceRef: evidence, action: { name: 'campus-pulse-system', query: resultQuery(result) },
    })
  }
  if (result.summary.governance.noResponseMessages > 0) {
    items.push({
      id: 'governance-no-response', kind: 'no_response', severity: 'attention',
      title: '存在未获居民回应的治理消息',
      detail: `${result.summary.governance.publishedMessages} 条治理消息中，${result.summary.governance.noResponseMessages} 条未记录居民回应。`,
      scope: { branch: 'D' }, evidenceRef: evidence, action: forumLocation(result),
    })
  }
  const strongest = strongestObservedDifference(result)
  if (strongest && strongest.delta !== 0) {
    const definition = overviewMetricDefinitions.find((item) => item.key === strongest.metric)!
    items.push({
      id: `observed-divergence-${strongest.metric}-${strongest.tick}`, kind: 'divergence', severity: 'info',
      title: '已观察到最大的分支数值差异',
      detail: `Tick ${strongest.tick} 的${definition.label}差值为 ${strongest.delta > 0 ? '+' : ''}${strongest.delta} ${definition.unit}；这里只描述模型条件差异，不判断好坏或统计显著性。`,
      scope: { tick: strongest.tick }, evidenceRef: evidenceRef(result, strongest.tick), action: resultSummaryLocation(result, strongest.tick),
    })
  }
  return items
}

export function buildSituationOverview(result: ResultViewModel): SituationOverviewVM {
  const timeline = result.summary.timeline
  const strongest = strongestObservedDifference(result)
  const findingEvidence = evidenceRef(result, strongest?.tick)
  const tickIds = timeline.map((point) => point.tick)
  const observationWindow = tickIds.length ? `Tick ${tickIds[0]}–${tickIds.at(-1)}` : '未发布时间步'
  const metric = strongest?.metric || 'messages'
  const definition = overviewMetricDefinitions.find((item) => item.key === metric)!
  const findings: FindingVM[] = []
  if (strongest) {
    findings.push({
      id: 'strongest-observed-difference',
      title: `最大已观察差异位于 Tick ${strongest.tick}`,
      detail: `${definition.label}：Natural ${strongest.natural} ${definition.unit}，治理 D ${strongest.intervention} ${definition.unit}，差值 ${strongest.delta > 0 ? '+' : ''}${strongest.delta} ${definition.unit}。`,
      tick: strongest.tick,
      evidenceRef: findingEvidence,
      boundary: '机械比较已发布的同尺度数值；未执行统计显著性检验。',
    })
  }
  if (result.summary.governance.publishedMessages > 0) {
    findings.push({
      id: 'governance-uptake-observation',
      title: '治理消息承接记录可核查',
      detail: `${result.summary.governance.publishedMessages} 条治理消息具有承接链，其中 ${result.summary.governance.noResponseMessages} 条没有居民回应。`,
      evidenceRef: evidenceRef(result),
      boundary: '只报告公开结果中的承接链；无响应是一等结果，不推断现实政策效果。',
    })
  }
  return {
    result,
    title: result.scope.scenarioLabel,
    scopeLabel: `${result.scope.seedCount || '未声明'} 个种子 · ${result.scope.population || '未声明'} 个合成 LLM Agent`,
    observationWindow,
    pilotBoundary: result.source.mode === 'offline_hero'
      ? '单场景、单种子的离线审计案例；不代表全校民意或总体政策效果。'
      : result.source.boundarySummary,
    metrics: overviewMetricDefinitions,
    timeline,
    exceptions: buildExceptionItems(result),
    findings,
    defaultMetric: metric,
    defaultTick: strongest?.tick ?? tickIds.at(-1) ?? null,
  }
}
