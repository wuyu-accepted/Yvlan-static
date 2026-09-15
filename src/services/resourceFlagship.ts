import { verifyForumTwinResultFileHash } from './forumTwin.ts'

export const RESOURCE_FLAGSHIP_SUMMARY_FILE = 'resource-flagship-summary-v1.json'
export const RESOURCE_FLAGSHIP_SUMMARY_HASH_FILE = 'resource-flagship-summary-v1.sha256'

const BRANCHES = ['Natural', 'A', 'B', 'C', 'D'] as const
const SHA256 = /^[0-9a-f]{64}$/
const FORBIDDEN_PUBLIC_KEYS = new Set([
  'api_key', 'password', 'secret', 'raw_prompt', 'raw_response',
  'provider_body', 'request_body', 'response_body', 'hidden_truth',
  'source_id', 'local_path', 'file_path', 'sample_identity',
])

type Branch = typeof BRANCHES[number]
type Interval = { mean: number; lower: number; upper: number }
type AggregateMetric = { mean: number; min: number; max: number }
type FeaturedMechanisms = {
  governance_uptake: { branch: Branch; governance_text: string; resident_response_text: string }
  service_feedback: { branch: Branch; help_text: string; receipt_text: string; follow_up_text: string }
}

export type ResourceFlagshipSummary = {
  schema_version: 'campus-pulse-resource-flagship-public-summary-v1'
  scenario_id: string
  scenario_title: string
  run_id: string
  model: string
  start_tick: number
  end_tick: number
  shared_through_tick: number
  primary_slots: number
  validation_scope: 'three_seed_product_validation' | 'four_seed_full'
  full_scope_complete: boolean
  planned_full_seeds: number[]
  cost_controlled_stop_after_three_seeds: boolean
  population_size: number
  particle_count: number
  seeds: number[]
  branches: Branch[]
  branch_labels: Record<Branch, string>
  canonical_seed: number
  canonical_branch_summaries: Record<Branch, Record<string, unknown>>
  featured_mechanisms: FeaturedMechanisms
  branch_aggregate_summaries: Record<Branch, Record<string, AggregateMetric>>
  paired_state_difference_intervals_95_vs_Natural: Record<Exclude<Branch, 'Natural'>, Record<string, Interval>>
  automatic_checks_passed: true
  story_gate: Record<string, boolean>
  story_gate_passed: true
  usage: Record<string, number>
  result_sha256: string
  artifact_sha256: string
  file_sha256: string
}

function fail(message: string): never {
  throw new Error(`资源分配主实验校验失败：${message}`)
}

function record(value: unknown, path: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} 必须是对象`)
  return value as Record<string, any>
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path} 必须是有限数字`)
  return value
}

function integer(value: unknown, path: string): number {
  const number = finite(value, path)
  if (!Number.isInteger(number)) fail(`${path} 必须是整数`)
  return number
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${path} 必须是非空字符串`)
  return value
}

function auditPublic(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => auditPublic(item, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(key.toLowerCase())) fail(`${path}.${key} 是公共禁止字段`)
    auditPublic(child, `${path}.${key}`)
  }
}

function publicAssetUrl(file: string): string {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/campus-pulse-data/${file}`
}

async function fetchText(file: string): Promise<string> {
  const response = await fetch(publicAssetUrl(file), {
    cache: 'no-store',
    headers: { Accept: 'text/plain,application/json' },
  })
  if (!response.ok) fail(`${file} HTTP ${response.status}`)
  return response.text()
}

function validateMetric(value: unknown, path: string): AggregateMetric {
  const row = record(value, path)
  const metric = {
    mean: finite(row.mean, `${path}.mean`),
    min: finite(row.min, `${path}.min`),
    max: finite(row.max, `${path}.max`),
  }
  if (metric.min > metric.mean || metric.mean > metric.max) fail(`${path} min/mean/max 次序非法`)
  return metric
}

function validateInterval(value: unknown, path: string): Interval {
  const row = record(value, path)
  const interval = {
    mean: finite(row.mean, `${path}.mean`),
    lower: finite(row.lower, `${path}.lower`),
    upper: finite(row.upper, `${path}.upper`),
  }
  if (interval.lower > interval.mean || interval.mean > interval.upper) fail(`${path} 区间次序非法`)
  return interval
}

export function validateResourceFlagshipSummary(value: unknown, fileSha256: string): ResourceFlagshipSummary {
  const root = record(value, '$')
  auditPublic(root)
  if (root.schema_version !== 'campus-pulse-resource-flagship-public-summary-v1') fail('schema 不匹配')
  if (root.scenario_id !== 'governance_legitimacy_dispute') fail('场景不匹配')
  const primarySlots = integer(root.primary_slots, '$.primary_slots')
  if (integer(root.population_size, '$.population_size') !== 1000) fail('Agent 人口不匹配')
  if (integer(root.particle_count, '$.particle_count') !== 10000) fail('粒子数量不匹配')
  if (integer(root.start_tick, '$.start_tick') !== 3 || integer(root.end_tick, '$.end_tick') !== 15) fail('时间合同不匹配')
  if (integer(root.shared_through_tick, '$.shared_through_tick') !== 4) fail('共享前缀不匹配')
  if (!Array.isArray(root.seeds) || new Set(root.seeds).size !== root.seeds.length) fail('配对种子必须互不重复')
  if (!Array.isArray(root.planned_full_seeds) || root.planned_full_seeds.length !== 4 || new Set(root.planned_full_seeds).size !== 4) fail('完整计划必须包含四个不同种子')
  if (root.validation_scope === 'three_seed_product_validation') {
    if (primarySlots !== 2028 || root.seeds.length !== 3 || root.full_scope_complete !== false || root.cost_controlled_stop_after_three_seeds !== true) fail('三种子产品验证合同不匹配')
  } else if (root.validation_scope === 'four_seed_full') {
    if (primarySlots !== 2592 || root.seeds.length !== 4 || root.full_scope_complete !== true || root.cost_controlled_stop_after_three_seeds !== false) fail('四种子完整合同不匹配')
  } else {
    fail('验证范围不匹配')
  }
  if (!Array.isArray(root.branches) || root.branches.join(',') !== BRANCHES.join(',')) fail('五分支合同不匹配')
  if (root.automatic_checks_passed !== true || root.story_gate_passed !== true) fail('结果门禁未通过')
  const labels = record(root.branch_labels, '$.branch_labels')
  const canonical = record(root.canonical_branch_summaries, '$.canonical_branch_summaries')
  const featured = record(root.featured_mechanisms, '$.featured_mechanisms')
  const governanceUptake = record(featured.governance_uptake, '$.featured_mechanisms.governance_uptake')
  const serviceFeedback = record(featured.service_feedback, '$.featured_mechanisms.service_feedback')
  const featuredMechanisms: FeaturedMechanisms = {
    governance_uptake: {
      branch: string(governanceUptake.branch, '$.featured_mechanisms.governance_uptake.branch') as Branch,
      governance_text: string(governanceUptake.governance_text, '$.featured_mechanisms.governance_uptake.governance_text'),
      resident_response_text: string(governanceUptake.resident_response_text, '$.featured_mechanisms.governance_uptake.resident_response_text'),
    },
    service_feedback: {
      branch: string(serviceFeedback.branch, '$.featured_mechanisms.service_feedback.branch') as Branch,
      help_text: string(serviceFeedback.help_text, '$.featured_mechanisms.service_feedback.help_text'),
      receipt_text: string(serviceFeedback.receipt_text, '$.featured_mechanisms.service_feedback.receipt_text'),
      follow_up_text: string(serviceFeedback.follow_up_text, '$.featured_mechanisms.service_feedback.follow_up_text'),
    },
  }
  if (!BRANCHES.includes(featuredMechanisms.governance_uptake.branch) || !BRANCHES.includes(featuredMechanisms.service_feedback.branch)) fail('精选机制链分支非法')
  const aggregates = record(root.branch_aggregate_summaries, '$.branch_aggregate_summaries')
  const typedAggregates = Object.fromEntries(BRANCHES.map((branch) => {
    const metrics = record(aggregates[branch], `$.branch_aggregate_summaries.${branch}`)
    return [branch, Object.fromEntries(Object.entries(metrics).map(([name, metric]) => (
      [name, validateMetric(metric, `$.branch_aggregate_summaries.${branch}.${name}`)]
    )))]
  })) as ResourceFlagshipSummary['branch_aggregate_summaries']
  const intervals = record(root.paired_state_difference_intervals_95_vs_Natural, '$.paired_state_difference_intervals_95_vs_Natural')
  const typedIntervals = Object.fromEntries(BRANCHES.slice(1).map((branch) => {
    const metrics = record(intervals[branch], `$.paired_state_difference_intervals_95_vs_Natural.${branch}`)
    return [branch, Object.fromEntries(Object.entries(metrics).map(([name, interval]) => (
      [name, validateInterval(interval, `$.paired_state_difference_intervals_95_vs_Natural.${branch}.${name}`)]
    )))]
  })) as ResourceFlagshipSummary['paired_state_difference_intervals_95_vs_Natural']
  if (!SHA256.test(fileSha256) || !SHA256.test(string(root.result_sha256, '$.result_sha256')) || !SHA256.test(string(root.artifact_sha256, '$.artifact_sha256'))) fail('SHA-256 缺失')
  return {
    ...root,
    seeds: root.seeds.map((item: unknown, index: number) => integer(item, `$.seeds[${index}]`)),
    planned_full_seeds: root.planned_full_seeds.map((item: unknown, index: number) => integer(item, `$.planned_full_seeds[${index}]`)),
    branches: [...BRANCHES],
    branch_labels: Object.fromEntries(BRANCHES.map((branch) => [branch, string(labels[branch], `$.branch_labels.${branch}`)])) as Record<Branch, string>,
    canonical_branch_summaries: Object.fromEntries(BRANCHES.map((branch) => [branch, record(canonical[branch], `$.canonical_branch_summaries.${branch}`)])) as ResourceFlagshipSummary['canonical_branch_summaries'],
    featured_mechanisms: featuredMechanisms,
    branch_aggregate_summaries: typedAggregates,
    paired_state_difference_intervals_95_vs_Natural: typedIntervals,
    usage: Object.fromEntries(Object.entries(record(root.usage, '$.usage')).map(([key, item]) => [key, integer(item, `$.usage.${key}`)])),
    file_sha256: fileSha256,
  } as ResourceFlagshipSummary
}

export async function loadResourceFlagshipSummary(): Promise<ResourceFlagshipSummary> {
  const [raw, hashFile] = await Promise.all([
    fetchText(RESOURCE_FLAGSHIP_SUMMARY_FILE),
    fetchText(RESOURCE_FLAGSHIP_SUMMARY_HASH_FILE),
  ])
  const expectedHash = hashFile.trim().split(/\s+/)[0]?.toLowerCase()
  const fileSha256 = await verifyForumTwinResultFileHash(raw, expectedHash)
  return validateResourceFlagshipSummary(JSON.parse(raw), fileSha256)
}
