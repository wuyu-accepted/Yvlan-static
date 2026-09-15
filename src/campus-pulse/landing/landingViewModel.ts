import type { RouteLocationRaw } from 'vue-router'
import { loadForumAgentWorldPublic } from '../../services/forumAgentWorld.ts'
import { loadLectureHero } from '../../services/lectureHero.ts'
import { loadResourcePolicyHero } from '../../services/resourcePolicyHero.ts'
import { auditedReplayAdapter } from '../adapters/auditedReplayAdapter.ts'
import { AGENT_ROLE_NAMES_EN } from '../agent-world/agentWorldLabels.ts'
import { buildResultAnalysis, type MetricComparisonRowVM } from '../results/resultsAnalysis.ts'

export interface LandingIncidentVM {
  id: string
  sourceKey: string
  title: string
  titleEn: string
  population: number
  integrity: 'verified'
  publicationEligible: boolean
  route: RouteLocationRaw
}

export interface LandingNetworkClusterVM { id: string; label: string; labelEn: string; count: number; x: number; y: number }
export interface LandingNetworkEdgeVM { id: string; sourceId: string; targetId: string; count: number }
export interface LandingNetworkVM {
  population: number
  particles: number
  representativeProfiles: number
  aggregateRelationshipCount: number
  worldHash: string
  clusters: LandingNetworkClusterVM[]
  edges: LandingNetworkEdgeVM[]
}
export interface LandingComparisonRowVM { id: string; label: string; labelEn: string; natural: number; governed: number; delta: number }
export interface LandingComparisonVM { resultKey: string; sourceKey: string; tick: number; phase: string; rows: LandingComparisonRowVM[] }
export interface LandingOperationalVM { incidents: LandingIncidentVM[]; network: LandingNetworkVM; comparison: LandingComparisonVM }

const metricNames: Record<string, [string, string]> = {
  messages: ['公开消息', 'Public messages'], threads: ['活跃讨论串', 'Active threads'], claims: ['公开 Claim', 'Public claims'], corrections: ['纠正', 'Corrections'], help_requests: ['求助请求', 'Help requests'],
}

function incident(kind: 'hero' | 'lecture', loaded: Awaited<ReturnType<typeof loadResourcePolicyHero>>): LandingIncidentVM {
  const result = auditedReplayAdapter.result(kind, loaded)
  const housing = kind === 'hero'
  return {
    id: result.key,
    sourceKey: result.source.key,
    title: housing ? '暑期住宿床位分配争议' : '讲座冲突事件',
    titleEn: housing ? 'Summer Housing allocation dispute' : 'Lecture Conflict incident',
    population: result.scope.population,
    integrity: 'verified',
    publicationEligible: result.source.publicationEligible === true,
    route: { name: 'campus-pulse-result-summary', params: { resultKey: result.key }, query: { source: result.source.key } },
  }
}

function networkSnapshot(world: Awaited<ReturnType<typeof loadForumAgentWorldPublic>>): LandingNetworkVM {
  const byRole = new Map<string, { label: string; count: number }>()
  for (const profile of world.population.representative_agents) {
    const current = byRole.get(profile.role_id) || { label: profile.role_label || profile.role_id, count: 0 }
    current.count += 1
    byRole.set(profile.role_id, current)
  }
  const entries = [...byRole.entries()].sort((left, right) => right[1].count - left[1].count)
  const clusters = entries.map(([id, row], index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, entries.length)
    return { id, label: row.label, labelEn: AGENT_ROLE_NAMES_EN[id] || id, count: row.count, x: 220 + Math.cos(angle) * (index % 2 ? 132 : 154), y: 138 + Math.sin(angle) * (index % 2 ? 88 : 106) }
  })
  const clusterIds = new Set(clusters.map((cluster) => cluster.id))
  const edges = [...world.relationships.aggregate_matrix]
    .filter((row) => row.source_role_id !== row.target_role_id && clusterIds.has(row.source_role_id) && clusterIds.has(row.target_role_id))
    .sort((left, right) => right.directed_edge_count - left.directed_edge_count)
    .slice(0, 20)
    .map((row, index) => ({ id: `${row.source_role_id}:${row.target_role_id}:${index}`, sourceId: row.source_role_id, targetId: row.target_role_id, count: row.directed_edge_count }))
  return {
    population: world.population.agent_count,
    particles: world.population.particle_count,
    representativeProfiles: world.population.representative_agents.length,
    aggregateRelationshipCount: world.relationships.aggregate_matrix.reduce((sum, row) => sum + row.directed_edge_count, 0),
    worldHash: world.world_sha256,
    clusters,
    edges,
  }
}

function comparisonRows(rows: MetricComparisonRowVM[]): LandingComparisonRowVM[] {
  return rows.filter((row) => row.comparable && ['messages', 'claims', 'corrections', 'help_requests', 'threads'].includes(row.metric)).slice(0, 3).map((row) => ({
    id: row.metric,
    label: metricNames[row.metric]?.[0] || row.label,
    labelEn: metricNames[row.metric]?.[1] || row.label,
    natural: row.natural as number,
    governed: row.intervention as number,
    delta: row.delta as number,
  }))
}

export async function loadLandingOperationalVM(): Promise<LandingOperationalVM> {
  const [housingLoaded, lectureLoaded, world] = await Promise.all([loadResourcePolicyHero(), loadLectureHero(), loadForumAgentWorldPublic()])
  const housing = auditedReplayAdapter.result('hero', housingLoaded)
  const final = housing.summary.timeline.at(-1)
  return {
    incidents: [incident('hero', housingLoaded), incident('lecture', lectureLoaded)],
    network: networkSnapshot(world),
    comparison: { resultKey: housing.key, sourceKey: housing.source.key, tick: final?.tick ?? 0, phase: final?.phase || 'unknown', rows: comparisonRows(buildResultAnalysis(housing).metricComparison) },
  }
}
