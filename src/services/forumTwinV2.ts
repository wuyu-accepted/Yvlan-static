import { apiRequest } from '../campus-pulse/api/http.ts'

export const FORUM_TWIN_V2_AGGREGATE_SCHEMA =
  'campus-pulse-live-aggregate-result-v7'

const RUN_ID = /^run_[0-9a-f]{24}$/
const SHA256 = /^[0-9a-f]{64}$/
const ACTIVATION_MODES = new Set([
  'budgeted_pps',
  'full_population_keyframes',
  'full_population_every_tick',
])
const EXECUTION_PROVENANCE = new Set([
  'emulator_only_development',
  'reviewed_trace_replay',
  'authorized_live_llm',
])
const FORBIDDEN_KEYS = [
  'private_text',
  'private_agent_id',
  'conversation_id',
  'record_level_relationship_edges',
  'relationship_edge_records',
  'raw_prompt',
  'provider_body',
  'api_key',
  'credential',
  'source_id',
  'hidden_truth',
]

export interface ForumTwinV2RiskSignal {
  signal_name: string
  tick: number
  value: number
  change_velocity: number
  severity: 'low' | 'watch' | 'high'
  affected_groups?: string[]
  public_evidence_thread_ids?: string[]
  private_aggregate_event_count?: number
  observable_to_governance?: boolean
  candidate_action_ids?: string[]
  mechanism_details?: Record<string, number>
}

export interface ForumTwinV2RiskResult {
  schema_version: 'campus-pulse-governance-risk-result-v1'
  scenario_id: string
  branch: string
  tick: number
  signals: ForumTwinV2RiskSignal[]
  combined_score: null
  threshold_source: string
  privacy: Record<string, boolean>
  risk_result_sha256: string
}

export interface ForumTwinV2AggregateResult {
  schema_version: typeof FORUM_TWIN_V2_AGGREGATE_SCHEMA
  run_id: string
  launch_fingerprint: string
  plan_sha256: string
  execution_provenance:
    | 'emulator_only_development'
    | 'reviewed_trace_replay'
    | 'authorized_live_llm'
  activation_mode:
    | 'budgeted_pps'
    | 'full_population_keyframes'
    | 'full_population_every_tick'
  publication_eligible: boolean
  public_metrics: Record<string, unknown>
  private_aggregate_metrics: Record<string, unknown>
  risk_results: ForumTwinV2RiskResult[]
  governance: Record<string, unknown>
  census_calibration: Record<string, unknown> | null
  relationship_ablation: Record<string, unknown> | null
  completeness: {
    required_primary_slots: number
    completed_primary_slots: number
    status: string
  }
  usage: Record<string, unknown>
  privacy: {
    contains_private_text: false
    contains_private_agent_ids: false
    contains_relationship_edges: false
    contains_credentials: false
  }
  non_claims: string[]
  result_sha256: string
}

export interface ForumTwinV2Loaded {
  kind: 'forum_twin_v2_aggregate'
  aggregate: ForumTwinV2AggregateResult
  source: { mode: 'api'; label: string; run_id: string }
}

export class ForumTwinV2DataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForumTwinV2DataError'
  }
}

function fail(message: string): never {
  throw new ForumTwinV2DataError(message)
}

function object(value: unknown, path: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${path} 必须是对象`)
  }
  return value as Record<string, any>
}

function exactKeys(value: Record<string, unknown>, keys: string[], path: string) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${path} 字段集合不符合 result-v7 合同`)
  }
}

function finite(value: unknown, path: string, minimum?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    fail(`${path} 必须是合法有限数值`)
  }
  return value
}

function auditPublic(value: unknown, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((child, index) => auditPublic(child, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) fail(`${path} 含非有限数值`)
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase()
    if (FORBIDDEN_KEYS.some((token) => lowered.includes(token)) && child !== false) {
      fail(`${path}.${key} 越过公开结果隐私边界`)
    }
    auditPublic(child, `${path}.${key}`)
  }
}

function validateRiskResult(value: unknown, index: number): ForumTwinV2RiskResult {
  const risk = object(value, `$.risk_results[${index}]`)
  if (risk.schema_version !== 'campus-pulse-governance-risk-result-v1') {
    fail(`$.risk_results[${index}] schema 不匹配`)
  }
  if (!Array.isArray(risk.signals) || risk.signals.length !== 7) {
    fail(`$.risk_results[${index}] 必须包含七类风险信号`)
  }
  const names = new Set<string>()
  risk.signals.forEach((raw: unknown, signalIndex: number) => {
    const signal = object(raw, `$.risk_results[${index}].signals[${signalIndex}]`)
    if (typeof signal.signal_name !== 'string' || names.has(signal.signal_name)) {
      fail(`$.risk_results[${index}] 风险信号名称无效或重复`)
    }
    names.add(signal.signal_name)
    finite(signal.tick, `$.risk_results[${index}].signals[${signalIndex}].tick`, 0)
    finite(signal.value, `$.risk_results[${index}].signals[${signalIndex}].value`, 0)
    finite(signal.change_velocity, `$.risk_results[${index}].signals[${signalIndex}].change_velocity`)
    if (!['low', 'watch', 'high'].includes(signal.severity)) {
      fail(`$.risk_results[${index}] 风险严重度无效`)
    }
  })
  if (!SHA256.test(String(risk.risk_result_sha256 || ''))) {
    fail(`$.risk_results[${index}] 缺少有效摘要`)
  }
  auditPublic(risk, `$.risk_results[${index}]`)
  return risk as ForumTwinV2RiskResult
}

export function validateForumTwinV2Aggregate(value: unknown): ForumTwinV2AggregateResult {
  const result = object(value, '$')
  exactKeys(result, [
    'schema_version', 'run_id', 'launch_fingerprint', 'plan_sha256',
    'execution_provenance', 'activation_mode', 'publication_eligible',
    'public_metrics', 'private_aggregate_metrics', 'risk_results',
    'governance', 'census_calibration', 'relationship_ablation', 'completeness', 'usage', 'privacy',
    'non_claims', 'result_sha256',
  ], '$')
  if (result.schema_version !== FORUM_TWIN_V2_AGGREGATE_SCHEMA) fail('结果不是 ForumTwin result-v7')
  if (!RUN_ID.test(String(result.run_id || ''))) fail('run_id 格式非法')
  if (!SHA256.test(String(result.launch_fingerprint || '')) || !SHA256.test(String(result.plan_sha256 || '')) || !SHA256.test(String(result.result_sha256 || ''))) {
    fail('result-v7 摘要字段非法')
  }
  if (!EXECUTION_PROVENANCE.has(result.execution_provenance) || !ACTIVATION_MODES.has(result.activation_mode)) {
    fail('result-v7 执行来源或激活模式非法')
  }
  if (typeof result.publication_eligible !== 'boolean') fail('publication_eligible 必须是布尔值')
  object(result.public_metrics, '$.public_metrics')
  object(result.private_aggregate_metrics, '$.private_aggregate_metrics')
  object(result.governance, '$.governance')
  if (result.relationship_ablation !== null) {
    const ablation = object(result.relationship_ablation, '$.relationship_ablation')
    if (ablation.schema_version !== 'campus-pulse-forum-relationship-ablation-public-result-v1') {
      fail('relationship_ablation schema 非法')
    }
    if (!SHA256.test(String(ablation.public_result_sha256 || ''))) {
      fail('relationship_ablation 缺少有效摘要')
    }
  }
  object(result.usage, '$.usage')
  const completeness = object(result.completeness, '$.completeness')
  exactKeys(completeness, ['required_primary_slots', 'completed_primary_slots', 'status'], '$.completeness')
  const required = finite(completeness.required_primary_slots, '$.completeness.required_primary_slots', 0)
  const completed = finite(completeness.completed_primary_slots, '$.completeness.completed_primary_slots', 0)
  if (!Number.isInteger(required) || !Number.isInteger(completed) || completed > required) fail('槽位完成度不守恒')
  const privacy = object(result.privacy, '$.privacy')
  exactKeys(privacy, [
    'contains_private_text', 'contains_private_agent_ids',
    'contains_relationship_edges', 'contains_credentials',
  ], '$.privacy')
  if (Object.values(privacy).some((flag) => flag !== false)) fail('公开结果隐私扫描未通过')
  if (!Array.isArray(result.risk_results)) fail('risk_results 必须是数组')
  result.risk_results = result.risk_results.map(validateRiskResult)
  if (!Array.isArray(result.non_claims) || result.non_claims.some((item: unknown) => typeof item !== 'string')) {
    fail('non_claims 必须是字符串数组')
  }
  auditPublic(result)
  return result as ForumTwinV2AggregateResult
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
  )).join(',')}}`
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyForumTwinV2AggregateHash(result: ForumTwinV2AggregateResult): Promise<string> {
  const body = Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'result_sha256'))
  const actual = await sha256(canonicalJson(body))
  if (actual !== result.result_sha256) fail('ForumTwin result-v7 SHA-256 校验失败')
  return actual
}

export async function loadForumTwinV2(runId: string): Promise<ForumTwinV2Loaded> {
  if (!RUN_ID.test(runId)) fail('run_id 格式非法，已拒绝加载')
  const envelope = await apiRequest<Record<string, unknown>>({
    method: 'GET',
    url: `/runs/${encodeURIComponent(runId)}/result`,
  })
  const candidate = envelope.result ?? envelope
  const aggregate = validateForumTwinV2Aggregate(candidate)
  if (aggregate.run_id !== runId) fail('result-v7 与请求的 run_id 不一致')
  await verifyForumTwinV2AggregateHash(aggregate)
  return {
    kind: 'forum_twin_v2_aggregate',
    aggregate,
    source: { mode: 'api', label: `RUN ${runId}`, run_id: runId },
  }
}

export function isForumTwinV2Loaded(value: unknown): value is ForumTwinV2Loaded {
  return Boolean(value && typeof value === 'object' && (value as ForumTwinV2Loaded).kind === 'forum_twin_v2_aggregate')
}
