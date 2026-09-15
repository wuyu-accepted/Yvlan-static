import type { RouteLocationRaw } from 'vue-router'
import type { ResultMetricKey, ResultTimelinePoint, ResultViewModel } from '../source/forumTwinAdapter.ts'
import { overviewMetricDefinitions } from '../overview/situationOverview.ts'

/** One delta definition for the whole Results surface: Δ = D − Natural. */
export const RESULT_DELTA_DEFINITION = Object.freeze({
  formula: 'Δ = D − Natural',
  note: '全结果统一使用“治理 D 减去 Natural”；正负只描述模型条件差异，不表示好坏。',
})

export type FactKind = 'fact' | 'derived_fact' | 'evidence_backed_interpretation' | 'candidate_mechanism'

export interface ResultEvidenceRef {
  label: string
  manifestId?: string
  origin?: string
  route: RouteLocationRaw
}

export interface AnalysisFindingVM {
  id: string
  kind: FactKind
  title: string
  detail: string
  scope: { metric?: string; tick?: number; branch?: string }
  evidenceRef?: ResultEvidenceRef
  boundary: string
}

export interface KeyMomentVM {
  id: string
  tick: number
  phase: string
  kind: 'observed' | 'derived' | 'governance'
  label: string
  detail: string
  metric?: string
  delta?: number
}

export interface MetricComparisonRowVM {
  metric: ResultMetricKey
  label: string
  unit: string
  natural: number | null
  explanation: number | null
  intervention: number | null
  delta: number | null
  comparable: boolean
}

export interface MechanismCandidateVM {
  id: string
  label: string
  detail: string
  evidence: string[]
  boundary: string
}

export interface MechanismsVM {
  status: 'available' | 'empty' | 'unavailable' | 'error'
  reason?: string
  divergenceEvents: KeyMomentVM[]
  claimSummary: {
    total: number
    contested: number
    corrected: number
    verified: number
    corrections: number
    helpRequests: number
  } | null
  candidates: MechanismCandidateVM[]
}

export interface GovernanceActionVM {
  id: string
  tick: number | null
  label: string
  detail: string
  kind: 'decision' | 'noop' | 'no_response'
}

export interface GovernanceVM {
  decisionActions: GovernanceActionVM[]
  noopActions: GovernanceActionVM[]
  noResponseActions: GovernanceActionVM[]
  publishedMessages: number
  uptake: { completeChains: number; totalChains: number }
  naturalGovernanceNote: string
}

export interface EvidenceHashRowVM {
  label: string
  value: string
  verified: boolean
}

export interface EvidenceProvenanceRowVM {
  key: string
  label: string
  value: string
}

export interface PublicationGateVM {
  id: string
  label: string
  status: 'passed' | 'failed' | 'unknown'
  reason: string
  evidenceRef?: ResultEvidenceRef
}

export interface EvidenceVM {
  hashChain: EvidenceHashRowVM[]
  provenanceRows: EvidenceProvenanceRowVM[]
  gates: PublicationGateVM[]
  report: { available: boolean; reason: string }
}

export interface ResultAnalysisVM {
  result: ResultViewModel
  deltaDefinition: typeof RESULT_DELTA_DEFINITION
  primaryObservation: {
    metric: ResultMetricKey
    tick: number
    natural: number
    intervention: number
    delta: number
    label: string
    unit: string
  } | null
  keyMoments: KeyMomentVM[]
  findings: AnalysisFindingVM[]
  metricComparison: MetricComparisonRowVM[]
  mechanisms: MechanismsVM
  governance: GovernanceVM
  evidence: EvidenceVM
}

export function metricValueAt(point: ResultTimelinePoint, branch: 'natural' | 'intervention', metric: ResultMetricKey) {
  return point[branch]?.[metric] ?? null
}

function metricDefinition(metric: ResultMetricKey) {
  return overviewMetricDefinitions.find((item) => item.key === metric) ?? overviewMetricDefinitions[0]
}

function phaseAt(result: ResultViewModel, tick: number) {
  return result.summary.timeline.find((point) => point.tick === tick)?.phase || 'unknown'
}

function observedDeltas(result: ResultViewModel) {
  const deltas: Array<{ metric: ResultMetricKey; tick: number; natural: number; intervention: number; delta: number }> = []
  for (const point of result.summary.timeline) {
    for (const definition of overviewMetricDefinitions) {
      const natural = metricValueAt(point, 'natural', definition.key)
      const intervention = metricValueAt(point, 'intervention', definition.key)
      if (natural === null || intervention === null) continue
      deltas.push({ metric: definition.key, tick: point.tick, natural, intervention, delta: intervention - natural })
    }
  }
  return deltas
}

export function strongestObservedDelta(result: ResultViewModel) {
  const deltas = observedDeltas(result)
  if (!deltas.length) return null
  return deltas.reduce((strongest, candidate) => (
    Math.abs(candidate.delta) > Math.abs(strongest.delta) ? candidate : strongest
  ))
}

export function firstDivergence(result: ResultViewModel) {
  const deltas = observedDeltas(result)
  const nonzero = deltas.filter((item) => item.delta !== 0)
  if (!nonzero.length) return null
  const firstTick = Math.min(...nonzero.map((item) => item.tick))
  return nonzero.find((item) => item.tick === firstTick) ?? null
}

export function finalDeltaFor(result: ResultViewModel, metric: ResultMetricKey = 'messages') {
  const last = result.summary.timeline.at(-1)
  if (!last) return null
  const natural = metricValueAt(last, 'natural', metric)
  const intervention = metricValueAt(last, 'intervention', metric)
  if (natural === null || intervention === null) return null
  return { tick: last.tick, natural, intervention, delta: intervention - natural }
}

function buildKeyMoments(result: ResultViewModel): KeyMomentVM[] {
  const moments: KeyMomentVM[] = []
  const first = firstDivergence(result)
  if (first) {
    const definition = metricDefinition(first.metric)
    moments.push({
      id: 'first-divergence',
      tick: first.tick,
      phase: phaseAt(result, first.tick),
      kind: 'derived',
      label: '首次出现数值差异',
      detail: `Tick ${first.tick}（${phaseAt(result, first.tick)}）的${definition.label}开始出现分支差异：${first.delta > 0 ? '+' : ''}${first.delta} ${definition.unit}。`,
      metric: first.metric,
      delta: first.delta,
    })
  }
  const strongest = strongestObservedDelta(result)
  if (strongest) {
    const definition = metricDefinition(strongest.metric)
    moments.push({
      id: 'largest-difference',
      tick: strongest.tick,
      phase: phaseAt(result, strongest.tick),
      kind: 'derived',
      label: '最大已观察差异',
      detail: `Tick ${strongest.tick} 的${definition.label}差值为 ${strongest.delta > 0 ? '+' : ''}${strongest.delta} ${definition.unit}（Natural ${strongest.natural} / D ${strongest.intervention}）。`,
      metric: strongest.metric,
      delta: strongest.delta,
    })
  }
  const final = finalDeltaFor(result)
  if (final) {
    moments.push({
      id: 'final-difference',
      tick: final.tick,
      phase: phaseAt(result, final.tick),
      kind: 'observed',
      label: '末端累计差异',
      detail: `截至 Tick ${final.tick}，公开消息累计差值为 ${final.delta > 0 ? '+' : ''}${final.delta} 条（Natural ${final.natural} / D ${final.intervention}）。`,
      metric: 'messages',
      delta: final.delta,
    })
  }
  const governanceStart = result.summary.governance.decisionTicks[0]
  if (governanceStart) {
    moments.push({
      id: 'governance-start',
      tick: governanceStart.tick,
      phase: phaseAt(result, governanceStart.tick),
      kind: 'governance',
      label: '治理主体首次形成决策',
      detail: `Tick ${governanceStart.tick} 记录到 ${governanceStart.summary}。`,
    })
  }
  return moments
}

function evidenceRoute(result: ResultViewModel, tick?: number): RouteLocationRaw {
  return {
    name: 'campus-pulse-result-evidence',
    params: { resultKey: result.key },
    query: {
      source: result.source.key,
      ...(typeof tick === 'number' ? { tick: String(tick) } : {}),
    },
  }
}

function evidenceRef(result: ResultViewModel, tick?: number): ResultEvidenceRef | undefined {
  if (result.source.verification !== 'verified') return undefined
  return {
    label: `已验证 manifest${typeof tick === 'number' ? ` · Tick ${tick}` : ''}`,
    manifestId: result.provenance.manifestId,
    origin: result.provenance.origin,
    route: evidenceRoute(result, tick),
  }
}

function buildFindings(result: ResultViewModel): AnalysisFindingVM[] {
  const findings: AnalysisFindingVM[] = []
  const strongest = strongestObservedDelta(result)
  if (strongest) {
    const definition = metricDefinition(strongest.metric)
    findings.push({
      id: 'primary-observation',
      kind: 'derived_fact',
      title: `最大已观察分支差异位于 Tick ${strongest.tick}`,
      detail: `${definition.label}：Natural ${strongest.natural} ${definition.unit}，治理 D ${strongest.intervention} ${definition.unit}，${RESULT_DELTA_DEFINITION.formula} = ${strongest.delta > 0 ? '+' : ''}${strongest.delta} ${definition.unit}。`,
      scope: { metric: strongest.metric, tick: strongest.tick },
      evidenceRef: evidenceRef(result, strongest.tick),
      boundary: '机械比较同尺度已发布数值；未执行统计显著性检验。',
    })
  }
  const first = firstDivergence(result)
  if (first) {
    const definition = metricDefinition(first.metric)
    findings.push({
      id: 'first-divergence-finding',
      kind: 'derived_fact',
      title: `差异自 Tick ${first.tick} 起可观察`,
      detail: `${definition.label}在该时点首次出现非零差值（${first.delta > 0 ? '+' : ''}${first.delta} ${definition.unit}）。`,
      scope: { metric: first.metric, tick: first.tick },
      evidenceRef: evidenceRef(result, first.tick),
      boundary: '由已发布序列推导，不表示因果转折。',
    })
  }
  if (result.heroAnnotation) {
    findings.push({
      id: 'hero-annotation',
      kind: 'evidence_backed_interpretation',
      title: '审计案例注解（仅限当前离线结果）',
      detail: result.heroAnnotation.text,
      scope: {},
      evidenceRef: {
        label: `证据 ${result.heroAnnotation.evidenceId}`,
        manifestId: result.heroAnnotation.manifestId,
        route: evidenceRoute(result),
      },
      boundary: `注解仅绑定 source=${result.source.key}、result=${result.key} 与对应结果哈希；不会出现在其他运行结果。`,
    })
  }
  if (result.summary.governance.publishedMessages > 0) {
    findings.push({
      id: 'governance-uptake-finding',
      kind: 'evidence_backed_interpretation',
      title: '治理消息承接记录可核查',
      detail: `${result.summary.governance.publishedMessages} 条治理消息具有承接链，其中 ${result.summary.governance.uptake.completeChains ?? 0} 条完整承接、${result.summary.governance.noResponseMessages} 条未记录居民响应。`,
      scope: { branch: 'D' },
      evidenceRef: evidenceRef(result),
      boundary: '只报告公开结果中的承接链；无响应是一等结果，不推断现实政策效果。',
    })
  }
  findings.push({
    id: 'scope-fact',
    kind: 'fact',
    title: '结果范围',
    detail: `${result.scope.seedCount || '未声明'} 个种子 · ${result.scope.population || '未声明'} 个合成 LLM Agent · ${result.scope.tickIds.length ? `Tick ${result.scope.tickIds[0]}–${result.scope.tickIds.at(-1)}` : '未发布时间步'}。`,
    scope: {},
    boundary: '范围来自结果 manifest；不扩展到全校民意或总体政策效果。',
  })
  return findings
}

function buildMetricComparison(result: ResultViewModel): MetricComparisonRowVM[] {
  const last = result.summary.timeline.at(-1)
  return overviewMetricDefinitions.map((definition) => {
    const natural = last ? metricValueAt(last, 'natural', definition.key) : null
    const explanation = last?.explanation?.[definition.key] ?? null
    const intervention = last ? metricValueAt(last, 'intervention', definition.key) : null
    const comparable = natural !== null && intervention !== null
    return {
      metric: definition.key,
      label: definition.label,
      unit: definition.unit,
      natural,
      explanation,
      intervention,
      delta: comparable ? intervention! - natural! : null,
      comparable,
    }
  })
}

function claimStatus(result: ResultViewModel) {
  const claims = result.forum?.claims || []
  const statusOf = (value: string) => String(value || '').toLowerCase()
  return {
    total: claims.length,
    contested: claims.filter((claim) => /contest|challenge|dispute/.test(statusOf(claim.status))).length,
    corrected: claims.filter((claim) => Boolean(claim.correction_target_claim_id) || /correct/.test(statusOf(claim.status))).length,
    verified: claims.filter((claim) => /verify|confirm|accept/.test(statusOf(claim.status))).length,
  }
}

function buildMechanisms(result: ResultViewModel): MechanismsVM {
  const divergenceEvents = buildKeyMoments(result)
  const claimSummary = result.forum
    ? {
        ...claimStatus(result),
        corrections: result.summary.timeline.reduce((sum, point) => sum + (point.natural?.corrections ?? 0) + (point.intervention?.corrections ?? 0), 0),
        helpRequests: result.summary.timeline.reduce((sum, point) => sum + (point.natural?.help_requests ?? 0) + (point.intervention?.help_requests ?? 0), 0),
      }
    : null
  const candidates: MechanismCandidateVM[] = []
  if (claimSummary && claimSummary.total > 0) {
    candidates.push({
      id: 'claim-divergence-candidate',
      label: '公开 Claim 存在争议结构',
      detail: `观察到 ${claimSummary.total} 个公开 Claim，其中 ${claimSummary.contested} 个被质疑、${claimSummary.corrected} 个带纠正记录。`,
      evidence: ['claim 状态与纠正记录来自已发布 forum 资产'],
      boundary: '这是已观察模式；质疑与纠正可并存，不表示结论正误。',
    })
  }
  if (result.summary.governance.publishedMessages > 0) {
    candidates.push({
      id: 'uptake-pattern-candidate',
      label: '治理消息承接存在未响应链',
      detail: `${result.summary.governance.publishedMessages} 条治理消息中，${result.summary.governance.uptake.completeChains ?? 0} 条完整承接、${result.summary.governance.noResponseMessages} 条未记录居民响应。`,
      evidence: ['governance_uptake_chains'],
      boundary: '承接链只描述模型条件内的响应记录；无响应与质疑保留为一等结果。',
    })
  }
  if (result.summary.governance.noopDecisions > 0) {
    candidates.push({
      id: 'noop-pattern-candidate',
      label: '治理主体存在 noop 决策',
      detail: `观察到 ${result.summary.governance.noopDecisions} 次 noop（不动作）决策时点。`,
      evidence: ['governance decision trace'],
      boundary: 'noop 是一等结果，不包装为成功或失败。',
    })
  }
  if (!result.forum) {
    return {
      status: 'unavailable',
      reason: '当前结果未携带公开 Claim 资产；无法生成机制摘要。',
      divergenceEvents,
      claimSummary: null,
      candidates: [],
    }
  }
  if (!claimSummary || claimSummary.total === 0) {
    return {
      status: 'empty',
      reason: '本结果未发布 Claim 资产；不会用 0 Claim 生成成功叙事。',
      divergenceEvents,
      claimSummary,
      candidates,
    }
  }
  return {
    status: 'available',
    divergenceEvents,
    claimSummary,
    candidates,
  }
}

function buildGovernance(result: ResultViewModel): GovernanceVM {
  const decisionActions = result.summary.governance.decisionTicks.map((item, index) => ({
    id: `decision-${item.tick}-${index}`,
    tick: item.tick,
    label: `Tick ${item.tick} 治理决策`,
    detail: item.summary,
    kind: 'decision' as const,
  }))
  const noopActions = result.summary.governance.noopDecisions > 0
    ? [{ id: 'noop-summary', tick: null, label: 'noop 决策', detail: `${result.summary.governance.noopDecisions} 次决策为 noop（未采取对外动作）。`, kind: 'noop' as const }]
    : []
  const noResponseActions = result.summary.governance.noResponseMessages > 0
    ? [{ id: 'no-response-summary', tick: null, label: '未获回应的治理消息', detail: `${result.summary.governance.publishedMessages} 条治理消息中，${result.summary.governance.noResponseMessages} 条未记录居民响应。`, kind: 'no_response' as const }]
    : []
  return {
    decisionActions,
    noopActions,
    noResponseActions,
    publishedMessages: result.summary.governance.publishedMessages,
    uptake: result.summary.governance.uptake,
    naturalGovernanceNote: 'Natural 分支不调用治理主体；治理分支的 noop、无响应、质疑与失败均按一等结果展示。',
  }
}

function buildEvidence(result: ResultViewModel): EvidenceVM {
  const short = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '未提供'
  const hashChain: EvidenceHashRowVM[] = []
  if (result.provenance.manifestId) {
    hashChain.push({ label: '数据清单', value: short(result.provenance.manifestId), verified: result.source.verification === 'verified' })
  }
  if (result.provenance.actualHash) {
    hashChain.push({ label: '结果文件', value: short(result.provenance.actualHash), verified: result.source.verification === 'verified' })
  }
  const provenanceRows: EvidenceProvenanceRowVM[] = [
    { key: 'runId', label: 'Run', value: result.provenance.runId || '离线资产' },
    { key: 'scenarioId', label: 'Scenario', value: result.provenance.scenarioId || '未声明' },
    { key: 'evidenceId', label: 'Evidence', value: result.provenance.evidenceId || '未声明' },
    { key: 'provider', label: 'Provider', value: result.provenance.provider || '未声明' },
    { key: 'origin', label: '来源', value: result.provenance.origin || '未声明' },
    { key: 'executionProvenance', label: '执行来源', value: result.provenance.executionProvenance || '未声明' },
    { key: 'manifestAvailable', label: 'Manifest', value: result.provenance.manifestAvailable ? '可用' : '缺失' },
  ]
  const evidence = evidenceRef(result)
  const gates: PublicationGateVM[] = [
    {
      id: 'verification-gate',
      label: '文件完整性',
      status: result.source.verification === 'verified' ? 'passed' : 'failed',
      reason: result.source.verification === 'verified' ? '结果文件与来源记录一致。' : '校验未通过，结果正文已隐藏。',
      evidenceRef: evidence,
    },
    {
      id: 'publication-gate',
      label: '发布门禁',
      status: result.source.publicationEligible === true ? 'passed' : result.source.publicationEligible === false ? 'failed' : 'unknown',
      reason: result.source.publicationEligible === true
        ? '当前记录标记为可发布；正式导出前仍需再次校验。'
        : result.source.publicationEligible === false
          ? '当前结果不可正式发布；仍可受限审阅。'
          : '服务端未声明发布资格。',
      evidenceRef: evidence,
    },
  ]
  const reportAvailable = result.source.publicationEligible === true && result.capabilities.reports
  return {
    hashChain,
    provenanceRows,
    gates,
    report: reportAvailable
      ? { available: true, reason: '可通过服务端发布门禁导出。' }
      : { available: false, reason: result.source.publicationEligible === false ? '发布门禁未通过，正式报告不可用。' : '该结果未启用报告导出能力。' },
  }
}

export function buildResultAnalysis(result: ResultViewModel): ResultAnalysisVM {
  const strongest = strongestObservedDelta(result)
  const primaryObservation = strongest
    ? {
        metric: strongest.metric,
        tick: strongest.tick,
        natural: strongest.natural,
        intervention: strongest.intervention,
        delta: strongest.delta,
        label: metricDefinition(strongest.metric).label,
        unit: metricDefinition(strongest.metric).unit,
      }
    : null
  return {
    result,
    deltaDefinition: RESULT_DELTA_DEFINITION,
    primaryObservation,
    keyMoments: buildKeyMoments(result),
    findings: buildFindings(result),
    metricComparison: buildMetricComparison(result),
    mechanisms: buildMechanisms(result),
    governance: buildGovernance(result),
    evidence: buildEvidence(result),
  }
}
