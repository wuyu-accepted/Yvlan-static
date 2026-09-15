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
  help?: string
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
