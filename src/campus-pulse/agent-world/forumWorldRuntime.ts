export type ForumWorldRuntimeChannel =
  | 'base'
  | 'public'
  | 'reply'
  | 'private_direct'
  | 'private_group'
  | 'governance'

export interface ForumWorldRuntimeEvidence {
  id: string
  kicker: string
  text: string
  effect?: string
  provenance?: string
  speaker?: string
  align?: 'left' | 'right'
}

export function distinctRuntimeEvidence(rows: ForumWorldRuntimeEvidence[] = []): ForumWorldRuntimeEvidence[] {
  const ids = new Set<string>()
  const content = new Set<string>()
  return rows.filter(row => {
    const key = `${row.speaker || ''}\u0000${row.text.normalize('NFKC').replace(/\s+/g, '')}`
    if (!row.text.trim() || ids.has(row.id) || content.has(key)) return false
    ids.add(row.id); content.add(key)
    return true
  })
}

export function groupThreadMessages<T extends { thread_id?: string; message_id: string }>(rows: T[]): T[][] {
  const threads = new Map<string, T[]>()
  for (const row of rows) {
    const key = row.thread_id || row.message_id
    const group = threads.get(key) || []
    if (!group.some(item => item.message_id === row.message_id)) group.push(row)
    threads.set(key, group)
  }
  return [...threads.values()]
}

// Repeated copies of the same source belong to one inspectable conversation.
// Keep every edge/count for the propagation graph, but link copies to the first
// stable owner instead of presenting them as new dialogue.
export function sharedEvidenceOwners(edges: ForumWorldRuntimeEdge[]): Map<string, string> {
  const seen = new Map<string, string>()
  const owners = new Map<string, string>()
  for (const edge of [...edges].sort((a,b) => a.id.localeCompare(b.id))) {
    const rows = distinctRuntimeEvidence(edge.evidence)
    if (!rows.length) continue
    const key = JSON.stringify(rows.map(row => [row.provenance || '', row.speaker || '', row.text.normalize('NFKC').replace(/\s+/g,'')]))
    const owner = seen.get(key)
    if (owner) owners.set(edge.id, owner)
    else seen.set(key, edge.id)
  }
  return owners
}

export interface ForumWorldRuntimeNode {
  id: string
  roleId: string
  label: string
  microRole?: string
  x: number
  y: number
  radius: number
  population?: number
  active: boolean
  publicReached?: boolean
  privateReached?: boolean
  groupReached?: boolean
  llmSpeaker?: boolean
  status: string
  evidence?: ForumWorldRuntimeEvidence[]
}

export interface ForumWorldRuntimeEdge {
  id: string
  sourceId: string
  targetId: string
  channel: ForumWorldRuntimeChannel
  count: number
  label?: string
  evidence?: ForumWorldRuntimeEvidence[]
}

export interface ForumWorldRuntimeMetric {
  id: string
  label: string
  value: string | number
  note?: string
}

export interface ForumWorldRuntimeFrame {
  frameId: string
  title: string
  subtitle: string
  tick: number
  branchLabel: string
  statusLabel: string
  playing?: boolean
  nodes: ForumWorldRuntimeNode[]
  edges: ForumWorldRuntimeEdge[]
  metrics: ForumWorldRuntimeMetric[]
  contentSha256?: string
  boundaryNote?: string
}

export function stableForumWorldHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
