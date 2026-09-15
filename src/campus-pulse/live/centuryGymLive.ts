const LIVE_PROGRESS_SCHEMA = 'campus-pulse-forum-live-progress-v1'
const LIVE_TICK_SCHEMA = 'campus-pulse-forum-public-tick-v1'
const SHA256 = /^[a-f0-9]{64}$/
const SESSION_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const BRANCHES = new Set(['shared_baseline', 'Natural', 'A', 'B', 'C', 'D'])
const SCENARIOS = new Set([
  'century_gym_ghost_booking_dispute',
  'governance_legitimacy_dispute',
  'lecture_external_incident_shock',
])

export type LiveScenarioId =
  | 'century_gym_ghost_booking_dispute'
  | 'governance_legitimacy_dispute'
  | 'lecture_external_incident_shock'

export interface LiveProgressEntry {
  branch: string
  tick: number
  path: string
  content_sha256: string
}

export interface LiveProgressManifest {
  schema_version: typeof LIVE_PROGRESS_SCHEMA
  run_id: string
  preflight_sha256: string
  scenario_id: LiveScenarioId
  seed: number
  status: 'running' | 'succeeded' | 'failed' | 'paused' | 'paused_fail_closed'
  committed_ticks: LiveProgressEntry[]
  latest_committed: LiveProgressEntry | null
  result_sha256: string | null
  stop_code: string | null
  contains_private_state: false
  contains_prompt_or_provider_body: false
  display_contract?: {
    schema_version: string
    mode: string
    interface_ticks: number[]
    shared_baseline_through_tick: number
    branch_fork_tick: number
    branches_after_fork: ['Natural', 'D']
    default_branch: 'Natural' | 'D'
    playback_interval_ms: number
    provider_calls_during_playback: 0
    case_center_entry: false
    stages: Array<{
      tick: number
      key: string
      title_zh: string
      title_en: string
      detail_zh: string
      detail_en: string
    }>
  }
  content_sha256: string
}

export interface LivePublicMessage {
  message_id: string
  thread_id: string
  parent_message_id: string | null
  quote_message_id: string | null
  source_agent_display_id: string
  author_visibility?: 'named' | 'anonymous'
  action: string
  visible_text: string
  created_tick: number
  stance: string
  emotion: string
  evidence_status: string
  interaction_counts?: { like: number; repost: number; report: number }
  provenance?: { kind?: string; model?: string; prompt_sha256?: string; response_sha256?: string }
  governance_artifact?: Record<string, unknown> | null
}

export interface LivePublicThread {
  thread_id: string
  topic: string
  need: string
  reply_count: number
  participant_count: number
  last_active_tick: number
}

export interface LivePublicDisplayProfile {
  display_id: string
  macro_role: string
  micro_role?: string
  stable_traits?: string[]
  historical_episode_focus?: string
  historical_episode_usage?: string
  topic_portfolio?: string[]
  need_portfolio?: string[]
  language_style?: { summary?: string; tendencies?: string[] }
  source_profile_v2_bound?: boolean
}

export interface LiveMacroExposure {
  source_to_recipient: string
  exposure_count: number
}

export interface LivePublicBranch {
  branch: string
  messages: LivePublicMessage[]
  threads: LivePublicThread[]
  claims: Array<Record<string, unknown>>
  governance_artifacts: Array<Record<string, unknown>>
  governance_rounds: Array<Record<string, unknown>>
  timeline: Array<Record<string, any>>
  usage?: Record<string, number>
  unique_activated_agents?: number
  activated_macro_roles?: string[]
  public_display_profiles?: LivePublicDisplayProfile[]
  feed_recommendation?: {
    macro_role_matrix?: LiveMacroExposure[]
    delivery_sources?: Record<string, number>
  }
  parallel_interactions?: Record<string, any>
}

export interface LivePublicTick {
  schema_version: typeof LIVE_TICK_SCHEMA
  scenario_id: LiveScenarioId
  seed: number
  branch: string
  tick: number
  tick_committed: true
  public_content_provenance_rule?: string
  dynamics_public_messages?: number
  public_branch: LivePublicBranch
  content_sha256: string
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('实时进度包含非有限数值')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  throw new Error('实时进度包含不支持的值')
}

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('浏览器不能校验实时进度 SHA-256')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function verifyContentHash(value: Record<string, unknown>): Promise<void> {
  const expected = String(value.content_sha256 || '')
  if (!SHA256.test(expected)) throw new Error('实时进度缺少有效内容哈希')
  const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'content_sha256'))
  if (await sha256(canonicalJson(body)) !== expected) throw new Error('实时进度内容哈希不匹配')
}

function normalizedBaseUrl(value: string): string {
  const url = new URL(value || 'http://127.0.0.1:8766')
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('实时进度服务必须位于本机')
  }
  if (url.username || url.password || url.search || url.hash) throw new Error('实时进度地址格式无效')
  return url.origin
}

async function getJson(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, { cache:'no-store', signal, headers:{ Accept:'application/json' } })
  if (!response.ok) {
    const error = new Error(response.status === 404 ? '运行尚未提交公开时间步' : `实时进度服务返回 ${response.status}`)
    ;(error as Error & { status?:number }).status = response.status
    throw error
  }
  const payload = await response.json()
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('实时进度响应不是 JSON 对象')
  const transportHash = response.headers.get('X-Content-SHA256') || ''
  if (!SHA256.test(transportHash) || transportHash !== String(payload.content_sha256 || '')) {
    throw new Error('实时进度传输哈希不匹配')
  }
  return payload
}

export async function loadLiveManifest(session: string, baseUrl: string, signal?: AbortSignal): Promise<LiveProgressManifest> {
  if (!SESSION_ID.test(session)) throw new Error('实时运行标识无效')
  const value = await getJson(`${normalizedBaseUrl(baseUrl)}/sessions/${session}/manifest`, signal)
  // Manifest values are integers/strings/booleans, so browser and Python
  // canonical JSON are byte-identical and can be independently recomputed.
  await verifyContentHash(value)
  if (
    value.schema_version !== LIVE_PROGRESS_SCHEMA
    || !SCENARIOS.has(String(value.scenario_id))
    || value.contains_private_state !== false
    || value.contains_prompt_or_provider_body !== false
    || !Array.isArray(value.committed_ticks)
  ) throw new Error('实时进度 manifest 合同不匹配')
  const entries = value.committed_ticks as Array<Record<string, unknown>>
  if (entries.some((entry) => (
    !BRANCHES.has(String(entry.branch))
    || !Number.isInteger(entry.tick)
    || Number(entry.tick) < 0
    || Number(entry.tick) > 23
    || entry.path !== `${entry.branch}/T${String(entry.tick).padStart(2, '0')}.json`
    || !SHA256.test(String(entry.content_sha256 || ''))
  ))) throw new Error('实时进度游标合同不匹配')
  return value as unknown as LiveProgressManifest
}

export async function loadLiveTick(
  session: string,
  baseUrl: string,
  entry: LiveProgressEntry,
  signal?: AbortSignal,
): Promise<LivePublicTick> {
  if (!SESSION_ID.test(session) || !BRANCHES.has(entry.branch) || !Number.isInteger(entry.tick)) throw new Error('实时时间步游标无效')
  const value = await getJson(`${normalizedBaseUrl(baseUrl)}/sessions/${session}/ticks/${entry.branch}/${entry.tick}`, signal)
  // Tick payloads include Python floats. JSON.parse intentionally loses the
  // lexical distinction between 1 and 1.0, so the read-only progress server
  // verifies canonical content before serving and binds that digest to the
  // response header; the browser then verifies header → payload → manifest.
  if (
    value.schema_version !== LIVE_TICK_SCHEMA
    || !SCENARIOS.has(String(value.scenario_id))
    || value.branch !== entry.branch
    || value.tick !== entry.tick
    || value.tick_committed !== true
    || value.content_sha256 !== entry.content_sha256
    || !value.public_branch
    || typeof value.public_branch !== 'object'
  ) throw new Error('实时公开时间步合同不匹配')
  return value as unknown as LivePublicTick
}
