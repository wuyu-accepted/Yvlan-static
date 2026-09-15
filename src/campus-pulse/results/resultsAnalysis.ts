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

export type StoryProvenanceKind = FactKind | 'structured_fact' | 'unavailable'
export type StoryStageStatus = 'available' | 'partial' | 'unavailable'

export interface ResultStoryFactVM {
  id: string
  label: string
  labelEn: string
  value: string
  valueEn: string
  provenance: StoryProvenanceKind
  evidenceRef?: ResultEvidenceRef
}

export interface ResultStoryStageVM {
  number: 1 | 2 | 3 | 4 | 5 | 6
  id: 'event-trigger' | 'divergence-point' | 'behavioral-catalysts' | 'governance-efficacy' | 'residual-vulnerabilities' | 'strategic-policy-recommendations'
  title: string
  status: StoryStageStatus
  provenance: StoryProvenanceKind
  finding: string
  findingEn: string
  facts: ResultStoryFactVM[]
  boundary: string
  boundaryEn: string
  evidenceRefs: ResultEvidenceRef[]
  drilldowns: Array<{ label: string; labelEn: string; route: RouteLocationRaw }>
}

export interface ResultStoryVM {
  stages: ResultStoryStageVM[]
  comparison: MetricComparisonRowVM[]
  timeline: ResultTimelinePoint[]
  deltaDefinition: typeof RESULT_DELTA_DEFINITION
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
    hashChain.push({ label: 'Manifest 摘要', value: short(result.provenance.manifestId), verified: result.source.verification === 'verified' })
  }
  if (result.provenance.actualHash) {
    hashChain.push({ label: '校验摘要', value: short(result.provenance.actualHash), verified: result.source.verification === 'verified' })
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
      label: '哈希与 manifest 校验',
      status: result.source.verification === 'verified' ? 'passed' : 'failed',
      reason: result.source.verification === 'verified' ? '内容与声明的 manifest 摘要一致。' : '校验未通过，结果正文已隐藏。',
      evidenceRef: evidence,
    },
    {
      id: 'publication-gate',
      label: '发布门禁',
      status: result.source.publicationEligible === true ? 'passed' : result.source.publicationEligible === false ? 'failed' : 'unknown',
      reason: result.source.publicationEligible === true
        ? '后端声明可发布；正式导出仍需后端再次校验。'
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

function resultRoute(result: ResultViewModel, view: 'mechanisms' | 'governance' | 'evidence' | 'forum', tick?: number): RouteLocationRaw {
  if (view === 'forum') {
    return {
      name: 'campus-pulse-result-forum',
      params: { resultKey: result.key },
      query: { source: result.source.key, ...(typeof tick === 'number' ? { tick: String(tick) } : {}) },
    }
  }
  return {
    name: `campus-pulse-result-${view}`,
    params: { resultKey: result.key },
    query: { source: result.source.key, ...(typeof tick === 'number' ? { tick: String(tick) } : {}) },
  }
}

function uniqueEvidence(refs: Array<ResultEvidenceRef | undefined>): ResultEvidenceRef[] {
  const seen = new Set<string>()
  return refs.filter((ref): ref is ResultEvidenceRef => {
    if (!ref) return false
    const key = `${ref.manifestId || ''}:${JSON.stringify(ref.route)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Builds the six-stage Results story from published facts and existing analysis only. */
export function buildResultStory(analysis: ResultAnalysisVM): ResultStoryVM {
  const result = analysis.result
  const verifiedEvidence = evidenceRef(result)
  const tickStart = result.scope.tickIds[0]
  const tickEnd = result.scope.tickIds.at(-1)
  const first = firstDivergence(result)
  const strongest = strongestObservedDelta(result)
  const final = result.summary.timeline.at(-1)
  const mechanisms = analysis.mechanisms
  const claimSummary = mechanisms.claimSummary
  const story = result.resourcePolicy
  const naturalTrust = final?.natural?.trust
  const governedTrust = final?.intervention?.trust
  const naturalConcern = final?.natural?.concern
  const governedConcern = final?.intervention?.concern
  const authoredIncident = result.scope.scenarioDescription.trim()
  const evidenceAtFirst = first ? evidenceRef(result, first.tick) : verifiedEvidence
  const governanceTick = result.summary.governance.decisionTicks[0]?.tick
  const metricNameEn = (metric: ResultMetricKey) => ({ messages: 'public messages', threads: 'active threads', claims: 'public Claims', corrections: 'corrections', help_requests: 'help requests' })[metric]
  const gapNameEn = (gap: string) => ({
    '类别间与同类内排序': 'cross-category and within-category ranking',
    '材料复核责任人': 'responsibility for supporting-material review',
    '申诉入口': 'appeal channel',
    '答复时限': 'response deadline',
  } as Record<string,string>)[gap] || gap
  const incidentEn = result.scope.scenarios.includes('lecture_external_incident_shock')
    ? 'An external speaker was confirmed to have abused students during a campus lecture and apologized publicly. The parallel forums compare no added response with evidence cards, support channels, and cross-group outreach under limited observation.'
    : result.scope.scenarioLabel

  const eventFacts: ResultStoryFactVM[] = story
    ? [
        { id: 'bed-capacity', label: '床位变化', labelEn: 'Bed capacity', value: `${story.scenarioFacts.bedsBefore} → ${story.scenarioFacts.bedsAfter}`, valueEn: `${story.scenarioFacts.bedsBefore} → ${story.scenarioFacts.bedsAfter}`, provenance: 'structured_fact', evidenceRef: verifiedEvidence },
        { id: 'applications', label: '有效申请', labelEn: 'Valid applications', value: String(story.scenarioFacts.validApplications), valueEn: String(story.scenarioFacts.validApplications), provenance: 'structured_fact', evidenceRef: verifiedEvidence },
        { id: 'information-gaps', label: '公告信息缺口', labelEn: 'Documented notice gaps', value: story.scenarioFacts.announcementGaps.join('、'), valueEn: story.scenarioFacts.announcementGaps.map(gapNameEn).join('; '), provenance: 'structured_fact', evidenceRef: verifiedEvidence },
      ]
    : [
        { id: 'scenario', label: '登记场景', labelEn: 'Registered scenario', value: result.scope.scenarioLabel, valueEn: result.scope.scenarios.includes('lecture_external_incident_shock') ? 'Campus governance response after the lecture abuse incident' : result.scope.scenarioLabel, provenance: 'evidence_backed_interpretation', evidenceRef: verifiedEvidence },
        ...(authoredIncident ? [{ id: 'incident-framing', label: '案例说明', labelEn: 'Authored case framing', value: authoredIncident, valueEn: incidentEn, provenance: 'evidence_backed_interpretation' as const, evidenceRef: verifiedEvidence }] : []),
      ]
  eventFacts.push(
    { id: 'window', label: '观察窗口', labelEn: 'Observation window', value: typeof tickStart === 'number' && typeof tickEnd === 'number' ? `Tick ${tickStart}–${tickEnd}` : '未发布', valueEn: typeof tickStart === 'number' && typeof tickEnd === 'number' ? `Tick ${tickStart}–${tickEnd}` : 'Not published', provenance: 'structured_fact', evidenceRef: verifiedEvidence },
    { id: 'population', label: '合成 Agent', labelEn: 'Synthetic Agents', value: result.scope.population ? String(result.scope.population) : '未发布', valueEn: result.scope.population ? String(result.scope.population) : 'Not published', provenance: 'structured_fact', evidenceRef: verifiedEvidence },
  )

  const divergenceFacts: ResultStoryFactVM[] = []
  if (story) divergenceFacts.push({ id: 'shared-history', label: '共享历史', labelEn: 'Shared history', value: `通过 Tick ${story.sharedThroughTick}`, valueEn: `Through Tick ${story.sharedThroughTick}`, provenance: 'structured_fact', evidenceRef: verifiedEvidence })
  if (first) divergenceFacts.push({
    id: 'first-observed-divergence', label: '首次观察到数值差异', labelEn: 'First observed numeric divergence',
    value: `Tick ${first.tick} · ${metricDefinition(first.metric).label} ${first.delta > 0 ? '+' : ''}${first.delta} ${metricDefinition(first.metric).unit}`,
    valueEn: `Tick ${first.tick} · ${metricNameEn(first.metric)} ${first.delta > 0 ? '+' : ''}${first.delta}`,
    provenance: 'derived_fact', evidenceRef: evidenceAtFirst,
  })
  if (strongest) divergenceFacts.push({
    id: 'strongest-divergence', label: '最大已观察差异', labelEn: 'Largest observed difference',
    value: `Tick ${strongest.tick} · ${metricDefinition(strongest.metric).label} ${strongest.delta > 0 ? '+' : ''}${strongest.delta} ${metricDefinition(strongest.metric).unit}`,
    valueEn: `Tick ${strongest.tick} · ${metricNameEn(strongest.metric)} ${strongest.delta > 0 ? '+' : ''}${strongest.delta}`,
    provenance: 'derived_fact', evidenceRef: evidenceRef(result, strongest.tick),
  })

  const mechanismFacts: ResultStoryFactVM[] = mechanisms.candidates.slice(0, 3).map((candidate) => {
    const candidateEn = candidate.id === 'claim-divergence-candidate' && claimSummary
      ? { label: 'Public Claims show a dispute pattern', value: `${claimSummary.total} public Claims were observed; ${claimSummary.contested} were contested and ${claimSummary.corrected} carried correction records.` }
      : candidate.id === 'uptake-pattern-candidate'
        ? { label: 'Some governance-message uptake chains remain unresolved', value: `${result.summary.governance.publishedMessages} governance messages have uptake chains: ${result.summary.governance.uptake.completeChains} complete and ${result.summary.governance.noResponseMessages} with no recorded resident response.` }
        : { label: 'Governance actors recorded no-action decisions', value: `${result.summary.governance.noopDecisions} decisions were recorded as noop (no external action).` }
    return { id: candidate.id, label: candidate.label, labelEn: candidateEn.label, value: candidate.detail, valueEn: candidateEn.value, provenance: 'candidate_mechanism', evidenceRef: verifiedEvidence }
  })
  if (!mechanismFacts.length && claimSummary) {
    mechanismFacts.push({
      id: 'claim-pattern', label: '已观察 Claim 模式', labelEn: 'Observed Claim pattern',
      value: `${claimSummary.total} 个 Claim；${claimSummary.contested} 个受质疑；${claimSummary.corrected} 个带纠正记录。`,
      valueEn: `${claimSummary.total} Claims; ${claimSummary.contested} contested; ${claimSummary.corrected} with correction records.`,
      provenance: 'candidate_mechanism', evidenceRef: verifiedEvidence,
    })
  }

  const governanceFacts: ResultStoryFactVM[] = [
    { id: 'governance-decisions', label: '治理决策时点', labelEn: 'Governance decision ticks', value: result.summary.governance.decisionTicks.length ? result.summary.governance.decisionTicks.map((item) => `Tick ${item.tick}`).join('、') : '未记录', valueEn: result.summary.governance.decisionTicks.length ? result.summary.governance.decisionTicks.map((item) => `Tick ${item.tick}`).join(', ') : 'Not recorded', provenance: 'structured_fact', evidenceRef: verifiedEvidence },
    { id: 'governance-messages', label: '已发布治理消息', labelEn: 'Published governance messages', value: String(result.summary.governance.publishedMessages), valueEn: String(result.summary.governance.publishedMessages), provenance: 'structured_fact', evidenceRef: verifiedEvidence },
    { id: 'uptake', label: '完整承接链', labelEn: 'Complete uptake chains', value: `${result.summary.governance.uptake.completeChains} / ${result.summary.governance.uptake.totalChains}`, valueEn: `${result.summary.governance.uptake.completeChains} / ${result.summary.governance.uptake.totalChains}`, provenance: 'structured_fact', evidenceRef: verifiedEvidence },
  ]
  if (typeof naturalTrust === 'number' && typeof governedTrust === 'number') governanceFacts.push({ id: 'trust', label: '末端模型 trust', labelEn: 'Final model trust', value: `Natural ${naturalTrust.toFixed(3)} · D ${governedTrust.toFixed(3)}`, valueEn: `Natural ${naturalTrust.toFixed(3)} · D ${governedTrust.toFixed(3)}`, provenance: 'derived_fact', evidenceRef: verifiedEvidence })
  if (typeof naturalConcern === 'number' && typeof governedConcern === 'number') governanceFacts.push({ id: 'concern', label: '末端模型 concern', labelEn: 'Final model concern', value: `Natural ${naturalConcern.toFixed(3)} · D ${governedConcern.toFixed(3)}`, valueEn: `Natural ${naturalConcern.toFixed(3)} · D ${governedConcern.toFixed(3)}`, provenance: 'derived_fact', evidenceRef: verifiedEvidence })

  const residualFacts: ResultStoryFactVM[] = []
  if (story) residualFacts.push({ id: 'scarcity', label: '资源约束', labelEn: 'Resource constraint', value: `${story.scenarioFacts.validApplications} 份有效申请竞争 ${story.scenarioFacts.bedsAfter} 张床位；治理分支不消除稀缺。`, valueEn: `${story.scenarioFacts.validApplications} valid applications compete for ${story.scenarioFacts.bedsAfter} beds; the governance branch does not remove scarcity.`, provenance: 'structured_fact', evidenceRef: verifiedEvidence })
  if (typeof final?.intervention?.claims === 'number') residualFacts.push({ id: 'remaining-claims', label: '治理 D 末端公开 Claim', labelEn: 'Final Governed-D public Claims', value: String(final.intervention.claims), valueEn: String(final.intervention.claims), provenance: 'structured_fact', evidenceRef: verifiedEvidence })
  if (result.summary.governance.noResponseMessages > 0) residualFacts.push({ id: 'no-response', label: '未记录居民响应', labelEn: 'No recorded resident response', value: `${result.summary.governance.noResponseMessages} 条治理消息`, valueEn: `${result.summary.governance.noResponseMessages} governance messages`, provenance: 'structured_fact', evidenceRef: verifiedEvidence })
  if (typeof governedTrust === 'number' && typeof naturalTrust === 'number' && governedTrust <= naturalTrust) residualFacts.push({ id: 'trust-not-recovered', label: '信任未恢复', labelEn: 'Trust not recovered', value: `治理 D ${governedTrust.toFixed(3)} ≤ Natural ${naturalTrust.toFixed(3)}`, valueEn: `Governed D ${governedTrust.toFixed(3)} ≤ Natural ${naturalTrust.toFixed(3)}`, provenance: 'derived_fact', evidenceRef: verifiedEvidence })
  if (!story && typeof governedConcern === 'number') residualFacts.push({ id: 'remaining-concern', label: '治理 D 末端 concern', labelEn: 'Final Governed-D concern', value: governedConcern.toFixed(3), valueEn: governedConcern.toFixed(3), provenance: 'structured_fact', evidenceRef: verifiedEvidence })
  if (!story && typeof final?.intervention?.opposition === 'number') residualFacts.push({ id: 'remaining-opposition', label: '治理 D 末端 opposition', labelEn: 'Final Governed-D opposition', value: final.intervention.opposition.toFixed(3), valueEn: final.intervention.opposition.toFixed(3), provenance: 'structured_fact', evidenceRef: verifiedEvidence })
  if (!residualFacts.length) residualFacts.push({ id: 'evidence-boundary', label: '现实关联', labelEn: 'Real-world linkage', value: result.boundaries[0] || '结果未建立现实世界因果关联。', valueEn: 'The result does not establish a real-world causal relationship.', provenance: 'structured_fact', evidenceRef: verifiedEvidence })

  const stages: ResultStoryStageVM[] = [
    {
      number: 1, id: 'event-trigger', title: 'Event Trigger', status: 'available', provenance: story ? 'structured_fact' : 'evidence_backed_interpretation',
      finding: story
        ? `${story.scenarioFacts.validApplications} 份有效申请面对从 ${story.scenarioFacts.bedsBefore} 降至 ${story.scenarioFacts.bedsAfter} 的床位供给，公告同时存在已记录的信息缺口。`
        : authoredIncident || result.scope.scenarioLabel,
      findingEn: story
        ? `${story.scenarioFacts.validApplications} valid applications face a bed supply reduced from ${story.scenarioFacts.bedsBefore} to ${story.scenarioFacts.bedsAfter}, alongside documented gaps in the notice.`
        : incidentEn,
      facts: eventFacts,
      boundary: story ? '这是合成 Agent 的校园治理预演，不是现实分配结果。' : '事件框架来自登记/编写的案例说明；它不是结构化测量事件记录。',
      boundaryEn: story ? 'This is a campus-governance rehearsal with synthetic Agents, not a real allocation outcome.' : 'The incident framing comes from registered, authored case copy; it is not a structured measured event record.',
      evidenceRefs: uniqueEvidence(eventFacts.map((item) => item.evidenceRef)),
      drilldowns: [{ label: '播放演化过程', labelEn: 'Play evolution', route: resultRoute(result, 'forum', tickStart) }],
    },
    {
      number: 2, id: 'divergence-point', title: 'Divergence Point', status: first ? 'available' : 'partial', provenance: 'derived_fact',
      finding: story
        ? `平行世界共享至 Tick ${story.sharedThroughTick}；之后比较 Natural、方案 A 与治理 D 的已发布序列。`
        : first ? `Tick ${first.tick} 首次出现可观察的数值差异。` : '当前结果没有足够的同尺度序列定位首次数值差异。',
      findingEn: story
        ? `The parallel worlds share history through Tick ${story.sharedThroughTick}; the published Natural, A, and Governed D series are compared after that point.`
        : first ? `The first observed numeric divergence appears at Tick ${first.tick}.` : 'The result does not publish enough same-scale series to locate a first numeric divergence.',
      facts: divergenceFacts,
      boundary: `Derived comparison, not a causal estimate. ${RESULT_DELTA_DEFINITION.formula}；未执行统计显著性检验。`,
      boundaryEn: `Derived comparison, not a causal estimate. ${RESULT_DELTA_DEFINITION.formula}; no statistical significance test was performed.`,
      evidenceRefs: uniqueEvidence(divergenceFacts.map((item) => item.evidenceRef)),
      drilldowns: [{ label: '播放分支演化', labelEn: 'Play branch evolution', route: resultRoute(result, 'forum', first?.tick) }],
    },
    {
      number: 3, id: 'behavioral-catalysts', title: 'Behavioral Catalysts', status: mechanisms.status === 'available' ? 'available' : 'partial', provenance: 'candidate_mechanism',
      finding: mechanismFacts[0]?.value || mechanisms.reason || '未发布足够的行为机制资料。',
      findingEn: mechanismFacts[0]?.valueEn || 'Insufficient behavioral-mechanism evidence was published.',
      facts: mechanismFacts,
      boundary: '这些是已观察行为模式与候选机制，不是经因果识别的驱动因素。',
      boundaryEn: 'These are observed behavioral patterns and candidate mechanisms, not causally identified drivers.',
      evidenceRefs: uniqueEvidence(mechanismFacts.map((item) => item.evidenceRef)),
      drilldowns: [{ label: '查看机制', labelEn: 'View mechanisms', route: resultRoute(result, 'mechanisms') }],
    },
    {
      number: 4, id: 'governance-efficacy', title: 'Governance Efficacy', status: result.summary.governance.decisionTicks.length || result.summary.governance.publishedMessages ? 'available' : 'partial', provenance: 'evidence_backed_interpretation',
      finding: analysis.findings.find((item) => item.id === 'governance-uptake-finding')?.detail || `记录到 ${result.summary.governance.decisionTicks.length} 个治理决策时点与 ${result.summary.governance.publishedMessages} 条治理消息。`,
      findingEn: result.summary.governance.publishedMessages
        ? `${result.summary.governance.publishedMessages} governance messages have uptake chains: ${result.summary.governance.uptake.completeChains} complete and ${result.summary.governance.noResponseMessages} with no recorded resident response.`
        : `${result.summary.governance.decisionTicks.length} governance decision ticks and ${result.summary.governance.publishedMessages} governance messages were recorded.`,
      facts: governanceFacts,
      boundary: '仅报告模型条件下的分支结果与承接记录，不表示现实世界的因果治理成效。',
      boundaryEn: 'Only model-conditioned branch outcomes and uptake records are reported; they do not establish real-world causal efficacy.',
      evidenceRefs: uniqueEvidence([verifiedEvidence, governanceTick === undefined ? undefined : evidenceRef(result, governanceTick)]),
      drilldowns: [{ label: '查看治理', labelEn: 'View governance', route: resultRoute(result, 'governance') }],
    },
    {
      number: 5, id: 'residual-vulnerabilities', title: 'Residual Vulnerabilities', status: residualFacts.length ? 'available' : 'partial', provenance: residualFacts.some((item) => item.provenance === 'derived_fact') ? 'derived_fact' : 'structured_fact',
      finding: residualFacts.map((item) => `${item.label}：${item.value}`).join('；'),
      findingEn: residualFacts.map((item) => `${item.labelEn}: ${item.valueEn}`).join('; '),
      facts: residualFacts,
      boundary: '仅列出结果中仍可核查的未解决条件；不推断额外的制度、安全或现实政策风险。',
      boundaryEn: 'Only verifiable unresolved conditions are listed; no additional institutional, safety, or real-world policy risk is inferred.',
      evidenceRefs: uniqueEvidence(residualFacts.map((item) => item.evidenceRef)),
      drilldowns: [{ label: '核验证据', labelEn: 'Verify evidence', route: resultRoute(result, 'evidence') }],
    },
    {
      number: 6, id: 'strategic-policy-recommendations', title: 'Strategic Policy Recommendations', status: 'unavailable', provenance: 'unavailable',
      finding: 'No verified strategic recommendation was published for this result.',
      findingEn: 'No verified strategic recommendation was published for this result.',
      facts: [],
      boundary: 'Review recorded governance interventions and evidence before drawing policy conclusions.',
      boundaryEn: 'Review recorded governance interventions and evidence before drawing policy conclusions.',
      evidenceRefs: [],
      drilldowns: [{ label: '查看治理', labelEn: 'View governance', route: resultRoute(result, 'governance') }, { label: '核验证据', labelEn: 'Verify evidence', route: resultRoute(result, 'evidence') }],
    },
  ]

  return {
    stages,
    comparison: analysis.metricComparison.filter((row) => row.comparable).slice(0, 5),
    timeline: result.summary.timeline,
    deltaDefinition: RESULT_DELTA_DEFINITION,
  }
}
