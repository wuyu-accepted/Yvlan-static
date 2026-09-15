import { getResourcePrivateChannelSummary } from './campusPulseApi.js'
import { verifyForumTwinResultFileHash } from './forumTwin.ts'

export const RESOURCE_PRIVATE_CHANNEL_FILE = 'private-channel-summary-public-v1.json'
export const RESOURCE_PRIVATE_CHANNEL_HASH_FILE = 'private-channel-summary-public-v1.sha256'

const SCHEMA = 'campus-pulse-private-channel-summary-public-v1'
const FROZEN_PUBLIC_RESULT_SHA256 = '5712b0af9a757bc38bb1286b362d868f8e49c7eae5a42108569c9818922b5662'
const SHA256 = /^[0-9a-f]{64}$/
const DENIED_KEYS = new Set([
  'agent_id', 'conversation_id', 'message_id', 'visible_text', 'prompt',
  'provider_body', 'api_key', 'source_id', 'relationship_edge',
])

export type ResourcePrivateBranchName = 'Natural' | 'D'

export interface PrivateTickCount {
  tick: number
  message_count: number
}

export interface PrivateChannelTickCount {
  tick: number
  direct_message_count: number
  group_message_count: number
}

export interface PrivateSenderTickCount {
  tick: number
  unique_active_sender_count: number
}

export interface PrivateQualityScreen {
  message_count: number
  exact_duplicate_message_count: number
  exact_duplicate_rate: number
  question_rate: number
  colloquial_marker_rate: number
  defensive_template_rate: number
  unsafe_lexical_hit_count: number
  mean_character_count: number
  max_character_count: number
  screening_method: string
}

export interface PrivateGroupLifecycle {
  status_counts: Record<string, number>
  membership_decisions: Record<string, number>
  message_evidence_statuses: Record<string, number>
  message_emotions: Record<string, number>
  message_stances: Record<string, number>
  public_source_binding_count: number
  targeted_governance_protocol_keyword_hits: number
}

export interface ResourcePrivateBranch {
  conversation_count: number
  direct_conversation_count: number
  group_conversation_count: number
  private_message_count: number
  direct_message_count: number
  group_message_count: number
  unique_active_sender_count: number
  private_claim_count: number
  public_to_private_binding_count: number
  message_actions: Record<string, number>
  evidence_statuses: Record<string, number>
  messages_by_tick: PrivateTickCount[]
  channel_messages_by_tick: PrivateChannelTickCount[]
  unique_active_senders_by_tick: PrivateSenderTickCount[]
  quality_screen: PrivateQualityScreen
  group_lifecycle?: PrivateGroupLifecycle
}

export interface ResourcePrivatePanel {
  result_sha256: string
  plan_sha256: string
  panel_sha256: string
  planned_primary_slots: number
  completed_primary_slots: number
  migrated_primary_slots: number
  migration_provider_called: boolean
  execution: Record<string, number>
  branches: Record<ResourcePrivateBranchName, ResourcePrivateBranch>
}

export interface ResourcePrivateChannelSummary {
  schema_version: typeof SCHEMA
  scenario_id: 'governance_legitimacy_dispute'
  scenario_label_zh: string
  frozen_public_result_sha256: string
  frozen_public_timeline_modified: false
  causal_effect_on_frozen_public_timeline_claimed: false
  execution_provenance: string
  provider: { endpoint_origin: string; model: string; reasoning: string }
  panels: {
    broad_private_panel: ResourcePrivatePanel
    group_lifecycle_panel: ResourcePrivatePanel
  }
  current_final_run_execution_totals: Record<string, number>
  privacy: {
    contains_private_text: false
    contains_agent_identifiers: false
    contains_conversation_or_message_identifiers: false
    contains_prompts_or_provider_bodies: false
    contains_credentials: false
    human_review_required_before_private_excerpt_export: true
  }
  interpretation_boundaries: string[]
  summary_sha256: string
}

function fail(message: string): never {
  throw new Error(`住房私域证据校验失败：${message}`)
}

function publicAssetUrl(file: string): string {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/campus-pulse-data/${file}`
}

function auditPublic(value: unknown, path = '$'): void {
  if (Array.isArray(value)) return value.forEach((child, index) => auditPublic(child, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase()
    if (DENIED_KEYS.has(lower) || /_(agent|conversation|message|source)_id$/.test(lower)) {
      fail(`${path}.${key} 是禁止公开字段`)
    }
    auditPublic(child, `${path}.${key}`)
  }
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) fail(`${path} 必须是非负整数`)
  return Number(value)
}

function validateBranch(value: unknown, path: string, requireGroup: boolean): ResourcePrivateBranch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} 必须是对象`)
  const branch = value as Record<string, any>
  for (const key of [
    'conversation_count', 'direct_conversation_count', 'group_conversation_count',
    'private_message_count', 'direct_message_count', 'group_message_count',
    'unique_active_sender_count', 'private_claim_count', 'public_to_private_binding_count',
  ]) nonNegativeInteger(branch[key], `${path}.${key}`)
  if (!Array.isArray(branch.messages_by_tick) || branch.messages_by_tick.length !== 7) fail(`${path}.messages_by_tick 长度错误`)
  const ticks = branch.messages_by_tick.map((row: any, index: number) => {
    if (!row || typeof row !== 'object' || row.tick !== index + 4) fail(`${path}.messages_by_tick 时点错误`)
    return { tick: row.tick, message_count: nonNegativeInteger(row.message_count, `${path}.messages_by_tick[${index}]`) }
  })
  branch.messages_by_tick = ticks
  if (!Array.isArray(branch.channel_messages_by_tick) || !Array.isArray(branch.unique_active_senders_by_tick)) fail(`${path} 缺少渠道/活跃发送者时间线`)
  branch.channel_messages_by_tick = branch.channel_messages_by_tick.map((row: any, index: number) => {
    if (!row || row.tick !== index + 4) fail(`${path}.channel_messages_by_tick 时点错误`)
    const direct = nonNegativeInteger(row.direct_message_count, `${path}.channel_messages_by_tick[${index}].direct`)
    const group = nonNegativeInteger(row.group_message_count, `${path}.channel_messages_by_tick[${index}].group`)
    if (direct + group !== ticks[index].message_count) fail(`${path}.channel_messages_by_tick 不守恒`)
    return { tick: row.tick, direct_message_count: direct, group_message_count: group }
  })
  branch.unique_active_senders_by_tick = branch.unique_active_senders_by_tick.map((row: any, index: number) => {
    if (!row || row.tick !== index + 4) fail(`${path}.unique_active_senders_by_tick 时点错误`)
    return { tick: row.tick, unique_active_sender_count: nonNegativeInteger(row.unique_active_sender_count, `${path}.unique_active_senders_by_tick[${index}]`) }
  })
  if (!branch.quality_screen || branch.quality_screen.unsafe_lexical_hit_count !== 0 || branch.quality_screen.exact_duplicate_message_count !== 0) {
    fail(`${path} 未通过公开质量门禁`)
  }
  if (requireGroup && !branch.group_lifecycle) fail(`${path}.group_lifecycle 缺失`)
  return branch as ResourcePrivateBranch
}

async function validateSummary(value: unknown): Promise<ResourcePrivateChannelSummary> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('根节点必须是对象')
  const root = value as Record<string, any>
  if (root.schema_version !== SCHEMA || root.scenario_id !== 'governance_legitimacy_dispute') fail('schema 或场景不匹配')
  if (root.frozen_public_result_sha256 !== FROZEN_PUBLIC_RESULT_SHA256 || root.frozen_public_timeline_modified !== false) fail('公开时间线绑定不匹配')
  if (root.causal_effect_on_frozen_public_timeline_claimed !== false) fail('结果超出因果边界')
  if (!SHA256.test(String(root.summary_sha256 || ''))) fail('summary SHA-256 缺失')
  // The backend recomputes the Python canonical-object digest before serving.
  // The offline path separately verifies the exact JSON file bytes below.
  if (!root.panels?.broad_private_panel || !root.panels?.group_lifecycle_panel) fail('私聊面板不完整')
  for (const [panelName, requireGroup] of [['broad_private_panel', false], ['group_lifecycle_panel', true]] as const) {
    const panel = root.panels[panelName]
    if (panel.planned_primary_slots !== panel.completed_primary_slots) fail(`${panelName} 未完成`)
    if (!panel.branches?.Natural || !panel.branches?.D) fail(`${panelName} 分支不完整`)
    panel.branches.Natural = validateBranch(panel.branches.Natural, `${panelName}.Natural`, requireGroup)
    panel.branches.D = validateBranch(panel.branches.D, `${panelName}.D`, requireGroup)
  }
  if (root.current_final_run_execution_totals?.provider_calls_unknown !== 0 || root.current_final_run_execution_totals?.tokens_in_flight !== 0 || root.current_final_run_execution_totals?.unsettled_or_failed_attempts !== 0) fail('Provider 账本未结清')
  const privacy = root.privacy || {}
  for (const key of ['contains_private_text', 'contains_agent_identifiers', 'contains_conversation_or_message_identifiers', 'contains_prompts_or_provider_bodies', 'contains_credentials']) {
    if (privacy[key] !== false) fail(`隐私字段 ${key} 不合格`)
  }
  if (privacy.human_review_required_before_private_excerpt_export !== true) fail('私聊摘录审阅门禁缺失')
  auditPublic(root)
  return root as ResourcePrivateChannelSummary
}

async function loadStatic(): Promise<ResourcePrivateChannelSummary> {
  const [jsonResponse, hashResponse] = await Promise.all([
    fetch(publicAssetUrl(RESOURCE_PRIVATE_CHANNEL_FILE), { cache: 'no-store' }),
    fetch(publicAssetUrl(RESOURCE_PRIVATE_CHANNEL_HASH_FILE), { cache: 'no-store' }),
  ])
  if (!jsonResponse.ok || !hashResponse.ok) fail('公开资产不可读取')
  const [raw, expected] = await Promise.all([jsonResponse.text(), hashResponse.text()])
  await verifyForumTwinResultFileHash(raw, expected.trim())
  return validateSummary(JSON.parse(raw))
}

export async function loadResourcePrivateChannelSummary(
  source: 'live' | 'offline' = 'live',
): Promise<ResourcePrivateChannelSummary> {
  // The source selector is part of the evidence contract. An offline result
  // must not probe a live endpoint first, and a live result must not silently
  // substitute a bundled artifact after an API failure.
  if (source === 'offline') return loadStatic()
  return validateSummary(await getResourcePrivateChannelSummary())
}
