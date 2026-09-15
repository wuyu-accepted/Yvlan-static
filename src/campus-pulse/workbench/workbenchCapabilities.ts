/**
 * M06 single source for workbench capabilities (BCI-004).
 * This is a versioned frontend registry until the backend exposes a
 * read-only capability metadata endpoint; the whitelist is NOT copied
 * into multiple components. Any change here must stay in sync with the
 * backend contract (routers/campus_pulse.py) and gets a contract test.
 */

export const EXECUTION_MODE_LABELS: Record<string, string> = {
  audited_replay: '审阅回放（Audited Replay）',
  live_llm: '实时 LLM（Live LLM）',
  budgeted_population: '预算化群体（Budgeted Population）',
  adaptive_particle_population: '自适应粒子人口（Governance V2）',
  budgeted_llm_agent_population: '预算化 LLM Agent 人口（YuLan-Scale）',
  llm_forum_twin: 'LLM ForumTwin（正式）',
  llm_forum_twin_v2: 'ForumTwin v2（关系传播与私聊）',
}

export interface TokenBudgetContract {
  min: number
  /** Required exact budget when the mode has a frozen contract (BCI-001). */
  required?: number
  max: number
}

export function tokenBudgetContractFor(mode: string): TokenBudgetContract {
  if (mode === 'llm_forum_twin') return { min: 1_000, required: 80_000_000, max: 80_000_000 }
  if (mode === 'budgeted_llm_agent_population') return { min: 1_000, required: 40_000_000, max: 40_000_000 }
  if (mode === 'llm_forum_twin_v2') return { min: 1_000, max: 80_000_000 }
  return { min: 1_000, max: 5_000_000 }
}

export function validateTokenBudget(mode: string, budget: number): { ok: boolean; expected?: number; reason?: string } {
  if (!Number.isFinite(budget)) return { ok: false, reason: 'token budget 必须是数字' }
  const contract = tokenBudgetContractFor(mode)
  if (contract.required !== undefined) {
    return budget === contract.required
      ? { ok: true }
      : { ok: false, expected: contract.required, reason: `执行模式 ${mode} 必须使用冻结预算 ${contract.required.toLocaleString('zh-CN')}` }
  }
  if (budget < contract.min || budget > contract.max) {
    return { ok: false, reason: `token budget 必须在 ${contract.min.toLocaleString('zh-CN')}–${contract.max.toLocaleString('zh-CN')} 之间` }
  }
  return { ok: true }
}

export const POPULATION_RELEASE_ID = 'persona-release-v1-reviewed-17x3'
export const POPULATION_RELEASE_BY_MODE: Readonly<Record<string, string>> = Object.freeze({
  audited_replay: POPULATION_RELEASE_ID,
  live_llm: POPULATION_RELEASE_ID,
  budgeted_population: 'semantic-population-v2-reviewed-1000',
  adaptive_particle_population: 'semantic-population-v3-reviewed-1000',
  budgeted_llm_agent_population: 'semantic-llm-agent-population-v1-reviewed',
  llm_forum_twin: 'semantic-llm-forum-agent-population-v2-reviewed',
  llm_forum_twin_v2: 'semantic-llm-forum-agent-population-v2-reviewed',
})

export function populationReleaseForMode(mode: string): string {
  return POPULATION_RELEASE_BY_MODE[mode] || POPULATION_RELEASE_ID
}

export const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/

export const RUNTIME_STATES = [
  'queued',
  'leased',
  'running',
  'cancel_requested',
  'succeeded',
  'failed',
  'cancelled',
] as const

export const ACTIVE_RUNTIME_STATES: ReadonlySet<string> = new Set([
  'queued',
  'leased',
  'running',
  'cancel_requested',
])

export const TERMINAL_RUNTIME_STATES: ReadonlySet<string> = new Set([
  'succeeded',
  'failed',
  'cancelled',
])

export const RUNTIME_STATE_LABELS: Record<string, string> = {
  draft: '尚未入队',
  queued: '等待 Worker',
  leased: '已领取',
  running: '执行中',
  cancel_requested: '正在安全取消',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

export const CANCEL_REASONS: Array<{ code: string; label: string }> = [
  { code: 'operator_requested', label: '操作员请求' },
  { code: 'superseded_run', label: '被新运行取代' },
  { code: 'budget_revision', label: '预算修订' },
]

/**
 * Scenario template -> allowed policy templates. Mirrors the backend
 * execution whitelist (BCI-004): the UI only offers what the runtime
 * can actually accept, and never auto-pairs policies.
 */
export const POLICY_TEMPLATE_WHITELIST: Record<string, string[]> = {
  century_gym_ghost_booking_v1: ['natural_evolution_v2', 'century_gym_combined_governance_v1'],
  tongzhou_governance_notice_v2: ['natural_evolution_v2', 'combined_governance_v2'],
  lecture_external_incident_v2: ['natural_evolution_v2'],
}

export const REVIEWED_POLICY_TEMPLATE_KEYS = [
  'natural_evolution_v2',
  'combined_governance_v2',
  'century_gym_combined_governance_v1',
]

/** Governance V2 locked paired seeds (must match the frozen 8-seed contract). */
export const GOVERNANCE_V2_SEEDS = [
  20260722,
  20261731,
  20262740,
  20263749,
  20264758,
  20265767,
  20266776,
  20267785,
]

export function policyTemplateAllowed(scenarioTemplateKey: string | undefined, lockedMode: boolean): string[] {
  if (!scenarioTemplateKey) return []
  const allowed = POLICY_TEMPLATE_WHITELIST[scenarioTemplateKey]
  if (!allowed) return []
  return lockedMode
    ? REVIEWED_POLICY_TEMPLATE_KEYS.filter((key) => allowed.includes(key))
    : allowed
}

export const FORUM_V2_ACTIVATION_MODES = [
  {
    code: 'budgeted_pps',
    label: '预算化多方案（默认）',
    description: '每个时间步激活 16–64 名居民，是比赛交付和多方案比较的默认模式。',
  },
  {
    code: 'full_population_keyframes',
    label: '全量关键帧',
    description: '企业能力：指定时间步覆盖全部 1,000 名 Agent；当前交付仅做离线机制验证。',
  },
  {
    code: 'full_population_every_tick',
    label: '全量逐时间步',
    description: '企业高预算能力：每个时间步覆盖全部人口；当前交付不自动发起付费调用。',
  },
] as const

export const PROJECT_EVALUATION_MODES: Array<{ code: string; label: string }> = [
  { code: 'simulation_stress_test', label: '仿真压力测试' },
  { code: 'descriptive_pilot', label: '描述性试点' },
]
