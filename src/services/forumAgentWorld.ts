import { getForumTwinV2AgentWorld } from './campusPulseApi.js'
import { verifyForumTwinResultFileHash } from './forumTwin.ts'
import type { PublicAgentDossier } from '../campus-pulse/agent-world/types.ts'

export const FORUM_AGENT_WORLD_FILE = 'forum-agent-world-public-v1.json'
export const FORUM_AGENT_WORLD_HASH_FILE = 'forum-agent-world-public-v1.sha256'

const SCHEMA = 'campus-pulse-forum-agent-world-public-v1'
const SHA256 = /^[0-9a-f]{64}$/
const DENIED_KEYS = new Set([
  'agent_id', 'source_id', 'source_identifier', 'relationship_edges',
  'private_message', 'private_text', 'prompt_body', 'provider_body',
  'api_key', 'credential',
])

export interface ForumAgentWorldMatrixRow {
  source_role_id: string
  target_role_id: string
  relation_type: string
  directed_edge_count: number
}

export interface ForumAgentWorldPublic {
  schema_version: typeof SCHEMA
  population: {
    agent_count: 1000
    particle_count: 10000
    representative_agents: PublicAgentDossier[]
  }
  relationships: {
    aggregate_matrix: ForumAgentWorldMatrixRow[]
    record_level_edges_public: false
    fully_synthetic: true
  }
  privacy: {
    contains_agent_ids: false
    contains_record_level_relationship_edges: false
    contains_private_text: false
    contains_source_ids: false
  }
  world_sha256: string
  [key: string]: unknown
}

function fail(message: string): never {
  throw new Error(`Agent 世界校验失败：${message}`)
}

function publicAssetUrl(file: string): string {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/campus-pulse-data/${file}`
}

function auditPublic(value: unknown, path = '$'): void {
  if (Array.isArray(value)) return value.forEach((child, index) => auditPublic(child, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DENIED_KEYS.has(key.toLowerCase())) fail(`${path}.${key} 是禁止公开字段`)
    auditPublic(child, `${path}.${key}`)
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonical(child)]),
  )
}

async function validateWorld(value: unknown): Promise<ForumAgentWorldPublic> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('根节点必须是对象')
  const root = value as Record<string, any>
  if (root.schema_version !== SCHEMA) fail('schema 不匹配')
  if (root.population?.agent_count !== 1000 || root.population?.particle_count !== 10000) fail('人口或粒子规模不匹配')
  if (!Array.isArray(root.population?.representative_agents) || root.population.representative_agents.length !== 116) fail('代表微角色不完整')
  if (!Array.isArray(root.relationships?.aggregate_matrix) || root.relationships.aggregate_matrix.length === 0) fail('聚合关系矩阵缺失')
  if (root.relationships.record_level_edges_public !== false || root.relationships.fully_synthetic !== true) fail('关系公开边界不匹配')
  const privacy = root.privacy || {}
  for (const key of ['contains_agent_ids', 'contains_record_level_relationship_edges', 'contains_private_text', 'contains_source_ids']) {
    if (privacy[key] !== false) fail(`隐私字段 ${key} 不合格`)
  }
  if (!SHA256.test(String(root.world_sha256 || ''))) fail('world SHA-256 缺失')
  const body = Object.fromEntries(Object.entries(root).filter(([key]) => key !== 'world_sha256'))
  await verifyForumTwinResultFileHash(JSON.stringify(canonical(body)), root.world_sha256)
  auditPublic(root)
  return root as ForumAgentWorldPublic
}

async function loadStatic(): Promise<ForumAgentWorldPublic> {
  const [jsonResponse, hashResponse] = await Promise.all([
    fetch(publicAssetUrl(FORUM_AGENT_WORLD_FILE), { cache: 'no-store' }),
    fetch(publicAssetUrl(FORUM_AGENT_WORLD_HASH_FILE), { cache: 'no-store' }),
  ])
  if (!jsonResponse.ok || !hashResponse.ok) fail('公开资产不可读取')
  const [raw, expected] = await Promise.all([jsonResponse.text(), hashResponse.text()])
  await verifyForumTwinResultFileHash(raw, expected.trim())
  return validateWorld(JSON.parse(raw))
}

export async function loadForumAgentWorldPublic(): Promise<ForumAgentWorldPublic> {
  try {
    return await validateWorld(await getForumTwinV2AgentWorld())
  } catch (apiError) {
    try {
      return await loadStatic()
    } catch (staticError) {
      const apiMessage = apiError instanceof Error ? apiError.message : String(apiError)
      const staticMessage = staticError instanceof Error ? staticError.message : String(staticError)
      fail(`后端与离线资产均不可用（${apiMessage}；${staticMessage}）`)
    }
  }
}
