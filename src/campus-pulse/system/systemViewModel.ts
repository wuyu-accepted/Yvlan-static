/**
 * M07 System / Evidence / Readiness workspace — view model.
 * Every gate derives from a real backend payload (health/readiness/live
 * capability) or a verified public asset. Unknown is never rendered as
 * ready, and static architecture claims are kept out of the live status.
 */

export type GateStatus = 'ready' | 'degraded' | 'blocked' | 'unknown'

export type ApiProbeStatus = 'checking' | 'available' | 'degraded' | 'unavailable'

export interface ReadinessGateVM {
  id: string
  label: string
  status: GateStatus
  detail: string
  nextAction: string
  checkedAt: string
}

export interface RuntimeCapabilityVM {
  key: string
  label: string
  value: string
  note?: string
}

export interface OfflineAssetVM {
  id: string
  label: string
  status: 'checking' | 'verified' | 'missing' | 'mismatch' | 'failed'
  detail: string
  expectedSha256?: string
  actualSha256?: string
  schemaVersion?: string
  publicationEligible?: boolean
}

export interface SystemStatusVM {
  api: {
    status: ApiProbeStatus
    detail: string
    lastCheckedAt: string
    retryable: boolean
  }
  gates: ReadinessGateVM[]
  runtimeCapabilities: RuntimeCapabilityVM[]
  offlineAssets: OfflineAssetVM[]
  versions: Array<{ label: string; value: string }>
  freshness: 'fresh' | 'stale'
}

export function nowIso(): string {
  return new Date().toISOString()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function checksOf(readiness: unknown): Record<string, unknown> {
  return asRecord(asRecord(readiness).checks)
}

/**
 * Map the real /readiness + /live-runtime/capability payloads into a
 * single set of non-overlapping gates. Each status has label + next
 * action; nothing is merged into one green card.
 */
export function gatesFromPayloads(
  health: unknown,
  readiness: unknown,
  capability: unknown,
  checkedAt: string,
): ReadinessGateVM[] {
  const healthRow = asRecord(health)
  const readyRow = asRecord(readiness)
  const checks = checksOf(readiness)
  const cap = asRecord(capability)
  const fixture = asRecord(cap.deterministic_fixture)
  const bundle = asRecord(cap.asset_bundle)

  const gate = (
    id: string,
    label: string,
    status: GateStatus,
    detail: string,
    nextAction: string,
  ): ReadinessGateVM => ({ id, label, status, detail, nextAction, checkedAt })

  const gates: ReadinessGateVM[] = []

  gates.push(gate(
    'backend_api',
    '后端 API',
    healthRow.status ? 'ready' : 'unknown',
    healthRow.status === 'healthy'
      ? 'health 探测正常'
      : healthRow.status
        ? 'health 返回非预期状态'
        : '未获得 health 响应',
    healthRow.status ? '无需操作' : '启动 CampusPulse 后端或保持只读',
  ))

  const database = asString(checks.database)
  gates.push(gate(
    'database',
    '工作台数据库',
    database === 'ready' ? 'ready' : database === 'not_ready' ? 'blocked' : 'unknown',
    database === 'ready' ? 'SQLite 就绪且为 WAL 模式' : database ? '数据库未就绪' : '未声明',
    database === 'ready' ? '无需操作' : '检查后端存储初始化',
  ))

  const schema = asString(checks.schema)
  gates.push(gate(
    'schema',
    '数据存储',
    schema === 'current' ? 'ready' : schema === 'migration_required' ? 'blocked' : 'unknown',
    schema === 'current' ? '数据存储就绪' : schema ? '需要迁移' : '未声明',
    schema === 'current' ? '无需操作' : '由后端执行迁移后再操作',
  ))

  const adapter = asString(checks.runtime_adapter)
  gates.push(gate(
    'runtime_adapter',
    'Runtime Adapter',
    adapter === 'enabled' ? 'ready' : adapter === 'disabled_by_configuration' ? 'degraded' : 'unknown',
    adapter === 'enabled' ? '启用了受控 runtime adapter' : adapter === 'disabled_by_configuration' ? '按配置禁用（不影响离线/只读）' : '未声明',
    adapter === 'enabled' ? '无需操作' : '如需入队运行，需后端启用 runtime adapter',
  ))

  const heartbeat = asString(checks.worker_heartbeat)
  gates.push(gate(
    'worker_heartbeat',
    'Worker 心跳',
    heartbeat === 'current' ? 'ready' : heartbeat === 'not_required' ? 'ready' : heartbeat ? 'degraded' : 'unknown',
    heartbeat === 'current' ? 'Worker 心跳正常' : heartbeat === 'not_required' ? '未启用 runtime，不要求心跳' : heartbeat ? '心跳异常' : '未声明',
    heartbeat === 'current' || heartbeat === 'not_required' ? '无需操作' : '检查 runtime worker 状态',
  ))

  const runtimeEnqueue = readyRow.runtime_enqueue_ready
  gates.push(gate(
    'runtime_enqueue',
    'Runtime 入队',
    runtimeEnqueue === true ? 'ready' : runtimeEnqueue === false ? 'blocked' : 'unknown',
    runtimeEnqueue === true ? '可入队执行' : runtimeEnqueue === false ? '当前不可入队（只读或 runtime 未就绪）' : '未声明',
    runtimeEnqueue === true ? '无需操作' : '保持只读；由后端开通 runtime 后入队',
  ))

  const liveGate = asString(readyRow.live_llm_gate)
  gates.push(gate(
    'live_llm_gate',
    'Live LLM 门禁',
    liveGate === 'enabled' ? 'ready' : liveGate === 'disabled' ? 'degraded' : 'unknown',
    liveGate === 'enabled' ? '服务端已开启 live LLM 门禁（仅限授权流程）' : liveGate === 'disabled' ? '服务端禁用 live LLM（离线/回放不受影响）' : '未声明',
    liveGate === 'enabled' ? '仍需完整授权流程' : '正式 live 运行需后端决策启用',
  ))

  const qualification = asString(cap.qualification)
  gates.push(gate(
    'planning_qualification',
    'Live 计划资格',
    qualification === 'ready' ? 'ready' : qualification === 'not_ready' ? 'blocked' : 'unknown',
    qualification === 'ready' ? 'Reviewed live 资产与 provider 已就位' : qualification === 'not_ready' ? '资产包或 provider 未就位' : '未声明',
    qualification === 'ready' ? '可进入授权流程' : '安装 reviewed live 资产（后端操作）',
  ))

  const providerState = asString(cap.provider_profile_state)
  gates.push(gate(
    'provider_profile',
    'Provider Profile',
    providerState === 'enabled' ? 'ready' : providerState === 'disabled' ? 'degraded' : providerState === 'not_installed' ? 'blocked' : 'unknown',
    providerState === 'enabled' ? '已注册并启用' : providerState === 'disabled' ? '已注册但禁用' : providerState === 'not_installed' ? '未安装' : '未声明',
    providerState === 'enabled' ? '需授权后使用' : '注册/启用 provider profile（后端操作）',
  ))

  const executorState = asString(cap.executor_state)
  gates.push(gate(
    'provider_executor',
    'Provider Executor',
    executorState === 'installed' ? 'ready' : executorState === 'not_installed' ? 'degraded' : 'unknown',
    executorState === 'installed' ? '确定性 fixture 路径可用' : executorState === 'not_installed' ? '运行组件待安装' : '未声明',
    executorState === 'installed' ? '不允许对外 Provider 调用' : '安装授权 executor（外部依赖）',
  ))

  const liveEnqueue = cap.live_enqueue_ready
  const blocker = asString(cap.live_enqueue_blocker)
  gates.push(gate(
    'live_enqueue',
    '正式 Live 入队',
    liveEnqueue === true ? 'ready' : liveEnqueue === false ? 'blocked' : 'unknown',
    liveEnqueue === true ? '正式 live 可入队' : liveEnqueue === false ? '当前不可入队：' + (blocker || 'authorized runtime 未安装') : '未声明',
    liveEnqueue === true ? '无需操作' : '配置运行组件后可启动新模拟',
  ))

  const fixtureState = asString(fixture.executor_state)
  gates.push(gate(
    'deterministic_fixture',
    '确定性 Fixture',
    fixtureState === 'installed' ? 'ready' : fixtureState ? 'degraded' : 'unknown',
    fixtureState === 'installed' ? '本地测试执行器可用' : fixtureState ? 'fixture 未就位' : '未声明',
    fixtureState === 'installed' ? '用于离线回放与演示' : '安装确定性 fixture',
  ))

  const bundleState = asString(bundle.state)
  gates.push(gate(
    'asset_bundle',
    'Reviewed 资产包',
    bundleState === 'qualified' ? 'ready' : bundleState === 'not_installed' ? 'blocked' : 'unknown',
    bundleState === 'qualified' ? '资产包指纹匹配' : bundleState === 'not_installed' ? '资产包未安装' : '未声明',
    bundleState === 'qualified' ? '无需操作' : '安装 reviewed live asset bundle',
  ))

  return gates
}

export function runtimeCapabilitiesFrom(capability: unknown): RuntimeCapabilityVM[] {
  const cap = asRecord(capability)
  const fixture = asRecord(cap.deterministic_fixture)
  const bundle = asRecord(cap.asset_bundle)
  const mapping = asRecord(cap.template_mapping)
  const items: RuntimeCapabilityVM[] = []
  const add = (key: string, label: string, value: string, note?: string) => {
    items.push({ key, label, value, note })
  }
  add('phase', '阶段', asString(cap.phase) || '未声明')
  add('schema_version', 'Capability Schema', asString(cap.capability_schema_version) || '未声明')
  add('qualification', '资格', asString(cap.qualification) || '未声明')
  add('live_gate', 'Live 门禁', asString(cap.live_gate) || '未声明')
  add('provider_profile', 'Provider Profile', asString(cap.provider_profile_state) || '未声明')
  add('executor', 'Executor', asString(cap.executor_state) || '未声明')
  add('live_enqueue', '正式 Live 入队', cap.live_enqueue_ready === true ? '可入队' : cap.live_enqueue_ready === false ? '不可入队' : '未声明',
    cap.live_enqueue_ready === false ? '阻断：' + (asString(cap.live_enqueue_blocker) || 'authorized runtime 未安装') : undefined)
  add('fixture', '确定性 Fixture', asString(fixture.executor_state) || '未声明',
    fixture.provider_calls_permitted === false ? '不允许 Provider 调用' : undefined)
  add('asset_bundle', '资产包', (asString(bundle.bundle_id) || '—') + ' · ' + (asString(bundle.state) || '未声明'))
  add('template_mapping', '模板映射', asString(mapping.mapping_id) || '未声明')
  return items
}

export function versionsFromPayloads(health: unknown, readiness: unknown, capability: unknown): Array<{ label: string; value: string }> {
  const h = asRecord(health)
  const r = asRecord(readiness)
  const c = asRecord(capability)
  const versions: Array<{ label: string; value: string }> = []
  const add = (label: string, value: unknown) => {
    const text = asString(value)
    if (text) versions.push({ label, value: text })
  }
  add('Schema（当前）', r.schema_version)
  add('Schema（预期）', r.expected_schema_version)
  add('Capability Schema', c.capability_schema_version)
  add('Service', h.service)
  return versions
}

export const HERO_ASSET = {
  jsonUrl: '/campus-pulse-data/resource-policy-live-r1.json',
  sha256Url: '/campus-pulse-data/resource-policy-live-r1.sha256',
  expectedSchema: 'campus-pulse-resource-allocation-sandbox-result-v1',
} as const

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify the public offline Hero asset: fetch its .sha256 declaration and
 * the asset itself, hash the raw text, and check schema + publication
 * boundary. Fail closed on any mismatch; never guesses file locations.
 */
export async function verifyOfflineHeroAsset(): Promise<OfflineAssetVM> {
  const base: OfflineAssetVM = {
    id: 'offline-hero',
    label: '住宿资源分配案例',
    status: 'failed',
    detail: '校验未完成',
  }
  try {
    const [shaResponse, jsonResponse] = await Promise.all([
      fetch(HERO_ASSET.sha256Url),
      fetch(HERO_ASSET.jsonUrl),
    ])
    if (!shaResponse.ok || !jsonResponse.ok) {
      return { ...base, status: 'missing', detail: '公开资产不可读（sha256=' + shaResponse.status + ' json=' + jsonResponse.status + '）' }
    }
    const expectedSha256 = (await shaResponse.text()).trim().toLowerCase()
    const rawText = await jsonResponse.text()
    const actualSha256 = await sha256Hex(rawText)
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return { ...base, status: 'mismatch', detail: '资产不是合法 JSON，校验失败', expectedSha256, actualSha256 }
    }
    const schema = asString(asRecord(parsed.result).schema_version)
    if (schema !== HERO_ASSET.expectedSchema) {
      return { ...base, status: 'mismatch', detail: '文件格式不兼容，请重新加载案例文件', expectedSha256, actualSha256, schemaVersion: schema }
    }
    if (actualSha256 !== expectedSha256) {
      return { ...base, status: 'mismatch', detail: '文件内容与发布记录不一致，请重新加载案例文件', expectedSha256, actualSha256, schemaVersion: schema }
    }
    return {
      ...base,
      status: 'verified',
      detail: '文件完整性与格式检查通过',
      expectedSha256,
      actualSha256,
      schemaVersion: schema,
      publicationEligible: false,
    }
  } catch {
    return { ...base, status: 'failed', detail: '资产校验异常（网络或解析失败）' }
  }
}

/** Forbidden keys never shown in DOM/console even if a payload slips them in. */
const FORBIDDEN_KEY_PATTERNS: RegExp[] = [
  /^source[_-]?id$/i,
  /^raw[_-]?text$/i,
  /^private/i,
  /^vector/i,
  /^api[_-]?key$/i,
  /^credential/i,
  /^bearer/i,
  /^secret/i,
  /^access[_-]?token$/i,
  /^authorization$/i,
]

export function hasForbiddenEvidenceKey(value: unknown, path = ''): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = hasForbiddenEvidenceKey(value[index], path + '[' + index + ']')
      if (hit) return hit
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        return path ? path + '.' + key : key
      }
      const hit = hasForbiddenEvidenceKey(child, path ? path + '.' + key : key)
      if (hit) return hit
    }
  }
  return null
}

export interface EvidenceReleaseVM {
  releaseKey: string
  label: string
  manifestSchemaVersion: string
  manifestSha256: string
  snapshotId: string
  status: string
  privacyMode: string
  sourceRows: number | null
  sourceBytes: number | null
  analysisArtifactCount: number | null
  zeroRawRowsPersisted: boolean | null
}

const RELEASE_FIELDS: Array<[keyof EvidenceReleaseVM, string]> = [
  ['releaseKey', 'release_key'],
  ['label', 'label'],
  ['manifestSchemaVersion', 'manifest_schema_version'],
  ['manifestSha256', 'manifest_sha256'],
  ['snapshotId', 'snapshot_id'],
  ['status', 'status'],
  ['privacyMode', 'privacy_mode'],
  ['sourceRows', 'source_rows'],
  ['sourceBytes', 'source_bytes'],
  ['analysisArtifactCount', 'analysis_artifact_count'],
  ['zeroRawRowsPersisted', 'zero_raw_rows_persisted'],
]

export function evidenceReleasesFromPayload(payload: unknown): EvidenceReleaseVM[] {
  if (!Array.isArray(payload)) return []
  return payload.map((item) => {
    const row = asRecord(item)
    const result: Record<string, unknown> = {}
    for (const [vmKey, rawKey] of RELEASE_FIELDS) {
      result[vmKey] = row[rawKey]
    }
    return result as unknown as EvidenceReleaseVM
  })
}

export interface EvidenceSnapshotVM {
  snapshotId: string
  label: string
  status: string
  manifestSha256: string
  artifactSha256?: string
  schemaVersion?: string
  generatedAtUtc?: string
  sourceSnapshotId?: string
  sourceManifestSha256?: string
  taxonomyReleaseSha256?: string
  personaEvidenceSha256?: string
  personaReleaseSha256?: string
  privacyMode?: string
  sourceCount: number | null
  artifactCount: number | null
}

export function evidenceSnapshotsFromPayload(payload: unknown): EvidenceSnapshotVM[] {
  if (!Array.isArray(payload)) return []
  return payload.map((item) => {
    const row = asRecord(item)
    const sources = Array.isArray(row.sources) ? row.sources : []
    const artifacts = Array.isArray(row.analysis_artifacts) ? row.analysis_artifacts : []
    return {
      snapshotId: asString(row.snapshot_id),
      label: asString(row.label),
      status: asString(row.status),
      manifestSha256: asString(row.manifest_sha256),
      artifactSha256: asString(row.artifact_sha256) || undefined,
      schemaVersion: asString(row.schema_version) || undefined,
      generatedAtUtc: asString(row.generated_at_utc) || undefined,
      sourceSnapshotId: asString(row.source_snapshot_id) || undefined,
      sourceManifestSha256: asString(row.source_manifest_sha256) || undefined,
      taxonomyReleaseSha256: asString(row.taxonomy_release_sha256) || undefined,
      personaEvidenceSha256: asString(row.persona_evidence_sha256) || undefined,
      personaReleaseSha256: asString(row.persona_release_sha256) || undefined,
      privacyMode: asString(row.privacy_mode) || undefined,
      sourceCount: typeof row.source_count === 'number' ? row.source_count : sources.length,
      artifactCount: typeof row.artifact_count === 'number' ? row.artifact_count : artifacts.length,
    }
  }).filter((item) => item.snapshotId)
}

export interface EvidenceSourceVM {
  role: string
  sha256: string
  bytes: number | null
  rows: number | null
}

export interface EvidenceArtifactVM {
  analysisId: string
  label: string
  artifactKind: string
  artifactSha256: string
  evidenceStage: string
  qualityGrade: string
  causalStatus: string
}

export interface EvidenceSnapshotDetailVM extends EvidenceSnapshotVM {
  sources: EvidenceSourceVM[]
  artifacts: EvidenceArtifactVM[]
  zeroRawRowsPersisted: boolean | null
}

export function evidenceSnapshotDetailFromPayload(payload: unknown): EvidenceSnapshotDetailVM | null {
  const row = asRecord(payload)
  const snapshotId = asString(row.snapshot_id)
  if (!snapshotId) return null
  const sources = Array.isArray(row.sources) ? row.sources.map((item) => {
    const source = asRecord(item)
    return {
      role: asString(source.role) || asString(source.source_role),
      sha256: asString(source.sha256) || asString(source.source_sha256),
      bytes: typeof source.bytes === 'number' ? source.bytes : typeof source.source_bytes === 'number' ? source.source_bytes : null,
      rows: typeof source.rows === 'number' ? source.rows : typeof source.source_rows === 'number' ? source.source_rows : null,
    }
  }) : []
  const artifacts = Array.isArray(row.analysis_artifacts) ? row.analysis_artifacts.map((item) => {
    const artifact = asRecord(item)
    return {
      analysisId: asString(artifact.analysis_id),
      label: asString(artifact.label),
      artifactKind: asString(artifact.artifact_kind),
      artifactSha256: asString(artifact.artifact_sha256),
      evidenceStage: asString(artifact.evidence_stage),
      qualityGrade: asString(artifact.quality_grade),
      causalStatus: asString(artifact.causal_status),
    }
  }) : []
  const summary = evidenceSnapshotsFromPayload([payload])[0]
  if (!summary) return null
  return {
    ...summary,
    sources,
    artifacts,
    zeroRawRowsPersisted: row.zero_raw_rows_persisted === true || row.zero_raw_rows_persisted === false ? row.zero_raw_rows_persisted : null,
  }
}

export type SystemTab = 'readiness' | 'evidence' | 'provider' | 'disclosure'
export const SYSTEM_TABS: SystemTab[] = ['readiness', 'evidence', 'provider', 'disclosure']
export const DEFAULT_SYSTEM_TAB: SystemTab = 'readiness'

export function systemTabFromQuery(value: unknown): SystemTab {
  return SYSTEM_TABS.includes(value as SystemTab) ? value as SystemTab : DEFAULT_SYSTEM_TAB
}

export function systemQueryFromState(tab: SystemTab, snapshotId?: string): Record<string, string> {
  const query: Record<string, string> = { tab }
  if (snapshotId) query.snapshot = snapshotId
  return query
}
