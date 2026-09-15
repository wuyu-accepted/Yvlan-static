<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import ContentTranslation from '../i18n/ContentTranslation.vue'
import AgentDossierDrawer from '../agent-world/AgentDossierDrawer.vue'
import { agentMicroRoleLabel, agentRoleLabel } from '../agent-world/agentWorldLabels.ts'
import AgentWorldPanel from '../workbench/AgentWorldPanel.vue'
import type { AgentDossierEvent, AgentDossierPrivateExcerpt, PublicAgentDossier } from '../agent-world/types.ts'
import ForumWorldRuntimeStage from '../agent-world/ForumWorldRuntimeStage.vue'
import type { ForumWorldRuntimeFrame, ForumWorldRuntimeNode } from '../agent-world/forumWorldRuntime.ts'
import { currentLocale } from '../i18n/locale.ts'
import { useSourceContext } from '../source/sourceContext'
import { useCampusPulseMotion } from '../app/useCampusPulseMotion'
import type { SourceState } from '../contracts/source'
import {
  adaptCenturyGymSocialWorld,
  type PrivateWorldEdge,
  type ReviewedPrivateExcerpt,
  type SocialWorldFrame,
  type SocialWorldRelease,
} from '../adapters/auditedReplayAdapter.ts'
// The centralized replay adapter enforces reviewed_excerpts_only together
// with the public-safe/no-agent-id/no-conversation-id privacy contract.
import {
  getCenturyGymSocialWorld,
  getForumTwinV2AgentWorld,
  readableApiError,
} from '../../services/campusPulseApi.js'
import {
  loadLiveManifest,
  loadLiveTick,
  type LiveProgressEntry,
  type LiveProgressManifest,
  type LivePublicDisplayProfile,
  type LivePublicMessage,
  type LiveScenarioId,
  type LivePublicTick,
} from './centuryGymLive.ts'

type WorldRole = {
  role_id: string
  label: string
  agent_count: number
  micro_role_count: number
  mean_attention_budget: number
  top_topics: string[]
  top_needs: string[]
}

type MicroWorldNode = WorldRole & {
  node_id: string
  micro_index: number
  x: number
  y: number
  radius: number
}

type MacroWorldCluster = WorldRole & {
  x: number
  y: number
  cluster_radius: number
}

type WorldRelationship = {
  source_role_id: string
  target_role_id: string
  relation_type: string
  directed_edge_count: number
}

type AgentWorldRelease = {
  schema_version: string
  world_sha256: string
  population: { agent_count:number; roles:WorldRole[]; representative_agents:PublicAgentDossier[] }
  relationships: { aggregate_matrix:WorldRelationship[] }
}

type LiveWorldEdge = {
  key: string
  source_role_id: string
  target_role_id: string
  channel: 'public' | 'private_direct' | 'private_group'
  count: number
  excerpt_ids: string[]
}

const route = useRoute()
const router = useRouter()
const sourceContext = useSourceContext()
const manifest = ref<LiveProgressManifest | null>(null)
const ticks = ref<Record<string, LivePublicTick>>({})
const selectedKey = ref('')
const state = ref<'connecting' | 'waiting' | 'running' | 'succeeded' | 'paused' | 'failed'>('connecting')
const detail = ref(currentLocale.value === 'en-US' ? 'Preparing the project runtime…' : '正在准备项目运行环境…')
const replayPlaying = ref(false)
const demoStarted = ref(false)
const demoCompleted = ref(false)
const selectedBranch = ref<'Natural' | 'D'>('D')
const refreshing = ref(false)
const agentWorld = ref<AgentWorldRelease | null>(null)
const socialWorld = ref<SocialWorldRelease | null>(null)
const worldError = ref('')
const selectedWorldRoleId = ref('')
const selectedWorldMicroNodeId = ref('')
const selectedWorldEdgeKey = ref('')
const worldChannel = ref<'all' | 'public' | 'private'>('all')
const dossierOpen = ref(false)
const worldSvgRef = ref<SVGSVGElement | null>(null)
const liveRoot = ref<HTMLElement | null>(null)
const liveMotion = useCampusPulseMotion(liveRoot, { autoIntro: false, pageSelector: '.live-console' })
let timer: ReturnType<typeof setInterval> | undefined
let replayTimer: ReturnType<typeof setInterval> | undefined
let controller: AbortController | undefined

const session = computed(() => {
  const candidate = typeof route.query.session === 'string' ? route.query.session : ''
  if (/^[a-z0-9][a-z0-9-]{0,63}$/.test(candidate)) return candidate
  return route.name === 'campus-pulse-century-gym-live' ? 'century-gym-demo' : ''
})
const hasProgressSession = computed(() => Boolean(session.value))
const projectId = computed(() => typeof route.query.project_id === 'string' ? route.query.project_id : '')
const isLiveOperator = computed(() => route.query.live === '1')
const baseUrl = computed(() => typeof route.query.progress_base === 'string' && route.query.progress_base ? route.query.progress_base : 'http://127.0.0.1:8766')
const entries = computed(() => [...(manifest.value?.committed_ticks || [])].sort((left, right) => left.tick - right.tick || left.branch.localeCompare(right.branch)))
const availableTicks = computed(() => [...new Set(entries.value.map((entry) => entry.tick))].sort((left, right) => left - right))
const branchForkTick = computed(() => manifest.value?.display_contract?.branch_fork_tick
  ?? Math.min(...entries.value.filter((entry) => ['Natural', 'D'].includes(entry.branch)).map((entry) => entry.tick), 5))
const firstTick = computed(() => availableTicks.value[0] ?? 0)
const lastTick = computed(() => availableTicks.value.at(-1) ?? firstTick.value)
const playbackInterval = computed(() => {
  const value = manifest.value?.display_contract?.playback_interval_ms ?? 1900
  return Number.isInteger(value) && value >= 500 && value <= 10000 ? value : 1900
})
function entryForTick(tick: number): LiveProgressEntry | undefined {
  const preferred = tick < branchForkTick.value ? 'shared_baseline' : selectedBranch.value
  return entries.value.find((entry) => entry.tick === tick && entry.branch === preferred)
    || entries.value.find((entry) => entry.tick === tick)
}
const playbackEntries = computed(() => availableTicks.value.map((tick) => entryForTick(tick)).filter(Boolean) as LiveProgressEntry[])
const selectedTick = computed(() => ticks.value[selectedKey.value] || (playbackEntries.value.length ? ticks.value[entryKey(playbackEntries.value[0])] : null))
const publicBranch = computed(() => selectedTick.value?.public_branch || null)
const messages = computed(() => [...(publicBranch.value?.messages || [])].sort((left, right) => right.created_tick - left.created_tick || right.message_id.localeCompare(left.message_id)))
const currentMessages = computed(() => messages.value.filter((message) => message.created_tick === selectedTick.value?.tick))
const feedMessages = computed(() => (currentMessages.value.length ? currentMessages.value : messages.value).slice(0, 16))
const isEnglish = computed(() => currentLocale.value === 'en-US')

function localize(zh: string, en: string): string {
  return isEnglish.value ? en : zh
}

function worldRoleLabel(role: WorldRole | undefined): string {
  if (!role) return '—'
  return agentRoleLabel(role.role_id, role.label, isEnglish.value)
}

function worldMicroRoleLabel(role: WorldRole | undefined, microRole: string | undefined, fallbackIndex?: number): string {
  if (!role) return microRole || '—'
  if (microRole) return agentMicroRoleLabel(microRole, role.role_id, role.label, isEnglish.value)
  return `${worldRoleLabel(role)} ${String(fallbackIndex || 0).padStart(2, '0')}`
}

function worldChannelLabel(value: LiveWorldEdge['channel']): string {
  if (value === 'public') return localize('公开曝光', 'Public exposure')
  if (value === 'private_group') return localize('动态小群', 'Dynamic group')
  return localize('好友私聊', 'Friend chat')
}

function excerptMechanismLabel(value: string): string {
  const labels: Record<string, readonly [string,string]> = {
    public_post_forwarded_to_friend:['公开帖子转入好友私聊','Public post forwarded to a friend'],
    friend_challenges_early_inference:['好友质疑过早推断','Friend challenges an early inference'],
    unsupported_interpretation_amplifies_in_group:['未经证实的解释在群聊放大','Unsupported interpretation amplifies in a group'],
    cross_group_contact_questions_generalization:['跨群联系人质疑过度概括','Cross-group contact questions overgeneralisation'],
    governance_service_object_forwarded_privately:['治理服务对象进入私聊','Governance service object enters private chat'],
    service_evidence_prepared_between_contacts:['联系人协作整理服务证据','Contacts prepare service evidence'],
    evidence_card_enters_private_group:['证据卡进入私聊群','Evidence card enters a private group'],
    skeptical_resident_accepts_verification_path:['质疑者接受可核验路径','Sceptical resident accepts a verification path'],
    service_receipt_changes_private_interpretation:['服务回执改变私下解释','Service receipt changes a private interpretation'],
    friend_limits_overgeneralization_after_receipt:['好友阻止回执被过度概括','Friend limits overgeneralisation after a receipt'],
    unresolved_suspicion_persists:['未解决的怀疑继续存在','Unresolved suspicion persists'],
    friend_resists_totalizing_claim:['好友拒绝把个案扩大为整体结论','Friend resists a totalising claim'],
  }
  const row = labels[value]
  return row ? localize(row[0], row[1]) : value
}

const scenarioId = computed<LiveScenarioId>(() => {
  const candidate = manifest.value?.scenario_id || (typeof route.query.scenario === 'string' ? route.query.scenario : '')
  return ['century_gym_ghost_booking_dispute', 'governance_legitimacy_dispute', 'lecture_external_incident_shock'].includes(candidate)
    ? candidate as LiveScenarioId
    : 'century_gym_ghost_booking_dispute'
})
const scenarioMeta = computed(() => {
  const values: Record<LiveScenarioId, { code:string; titleZh:string; titleEn:string; detailZh:string; detailEn:string }> = {
    century_gym_ghost_booking_dispute:{
      code:'SCN-GYM-GHOST-BOOKING',
      titleZh:'世纪馆“幽灵预约”争议',
      titleEn:'Century Gym ghost-booking dispute',
      detailZh:'学生发现羽毛球、乒乓球场现场空置，但热门时段持续不可预约；系统比较自然演化与证据、工单和跨项目触达进入论坛后的变化。',
      detailEn:'Students find visibly empty badminton and table-tennis courts while peak slots remain unavailable. The system compares natural evolution with a branch where evidence, service tickets, and cross-group outreach enter the forum.',
    },
    governance_legitimacy_dispute:{
      code:'SCN-HOUSING-ALLOCATION',
      titleZh:'暑期住宿床位分配正当性争议',
      titleEn:'Summer housing allocation legitimacy dispute',
      detailZh:'面对稀缺暑期床位，居民围绕资格标准、信息公开与申诉复核展开讨论；系统观察不同治理对象能否被直接承接。',
      detailEn:'With scarce summer beds, residents debate eligibility, transparency, and appeals. The system observes whether governance objects receive direct public uptake.',
    },
    lecture_external_incident_shock:{
      code:'SCN-LECTURE-CONFLICT',
      titleZh:'讲座冲突事件传播',
      titleEn:'Lecture conflict incident propagation',
      detailZh:'学生目击讲座现场冲突后，带有不同立场和完整度的叙述进入论坛；系统观察求证、纠错和治理回应如何改变传播。',
      detailEn:'After students witness a lecture conflict, accounts with different stances and completeness enter the forum. The system observes verification, correction, and governance uptake.',
    },
  }
  return values[scenarioId.value]
})
const displayTickRange = computed(() => (
  !isLiveOperator.value && scenarioId.value === 'century_gym_ghost_booking_dispute'
    ? 'Tick 0–10'
    : `Tick ${firstTick.value}–${lastTick.value}`
))

function entryKey(entry: Pick<LiveProgressEntry, 'branch' | 'tick'>): string { return `${entry.branch}:${entry.tick}` }

function stopReplay() {
  replayPlaying.value = false
  if (replayTimer) clearInterval(replayTimer)
  replayTimer = undefined
}

function startReplay() {
  if (!playbackEntries.value.length) return
  stopReplay()
  demoStarted.value = true
  demoCompleted.value = false
  let index = Math.max(0, playbackEntries.value.findIndex((entry) => entry.tick === selectedTick.value?.tick))
  if (index >= playbackEntries.value.length - 1) index = 0
  selectedKey.value = entryKey(playbackEntries.value[index])
  replayPlaying.value = true
  replayTimer = setInterval(() => {
    index += 1
    if (index >= playbackEntries.value.length) {
      stopReplay()
      demoCompleted.value = true
      return
    }
    selectedKey.value = entryKey(playbackEntries.value[index])
  }, playbackInterval.value)
}

function startSimulation() {
  selectedBranch.value = 'D'
  const first = playbackEntries.value[0]
  if (!first) return
  selectedKey.value = entryKey(first)
  demoStarted.value = true
  demoCompleted.value = false
  startReplay()
}

function resetSimulation() {
  stopReplay()
  demoStarted.value = false
  demoCompleted.value = false
  selectedBranch.value = 'D'
  const first = playbackEntries.value[0]
  selectedKey.value = first ? entryKey(first) : ''
}

function selectBranch(branch: 'Natural' | 'D') {
  selectedBranch.value = branch
  const tick = selectedTick.value?.tick ?? branchForkTick.value
  const replacement = entryForTick(tick)
  if (replacement) selectedKey.value = entryKey(replacement)
}
function branchLabel(branch: string): string {
  const labels = isEnglish.value
    ? { shared_baseline:'Shared baseline', Natural:'No added response (Natural)', D:'Combined governance (Plan D)', A:'Standards explanation (Plan A)', B:'Review and service (Plan B)', C:'Cross-group outreach (Plan C)' }
    : { shared_baseline:'共享基线', Natural:'不追加治理回应（Natural）', D:'组合治理（方案 D）', A:'规则解释（方案 A）', B:'复核与服务（方案 B）', C:'跨群触达（方案 C）' }
  return (labels as Record<string,string>)[branch] || branch
}
function actionLabel(action: string): string {
  const labels = isEnglish.value
    ? { post:'Post', reply:'Reply', quote:'Quote', repost:'Repost', verify:'Verify', correct:'Correct', seek_help:'Ask for help', report_risk:'Report risk', governance_message:'Governance post', service_receipt:'Service receipt', governance_evidence:'Evidence card' }
    : { post:'发帖', reply:'回复', quote:'引用', repost:'转发', verify:'求证', correct:'纠错', seek_help:'求助', report_risk:'风险上报', governance_message:'治理发布', service_receipt:'服务回执', governance_evidence:'证据卡' }
  return (labels as Record<string,string>)[action] || action
}
function messageInteractions(message: LivePublicMessage) {
  return message.interaction_counts || { like:0, repost:0, report:0 }
}
function repliesTo(message: LivePublicMessage): number {
  return messages.value.filter((candidate) => candidate.parent_message_id === message.message_id).length
}

const metric = computed(() => {
  const rows = messages.value
  const interactions = rows.reduce((sum, message) => {
    const count = messageInteractions(message)
    sum.like += count.like || 0
    sum.repost += count.repost || 0
    sum.report += count.report || 0
    return sum
  }, { like:0, repost:0, report:0 })
  return {
    messages: rows.length,
    replies: rows.filter((message) => Boolean(message.parent_message_id)).length,
    threads: publicBranch.value?.threads?.length || 0,
    claims: publicBranch.value?.claims?.length || 0,
    ...interactions,
  }
})

const hotThreads = computed(() => (publicBranch.value?.threads || []).map((thread) => {
  const rows = messages.value.filter((message) => message.thread_id === thread.thread_id)
  const interactions = rows.reduce((sum, message) => {
    const count = messageInteractions(message)
    return sum + (count.like || 0) + (count.repost || 0) * 3
  }, 0)
  return { thread, messages:rows.length, score:rows.length + (thread.reply_count || 0) * 2 + interactions }
}).sort((left, right) => right.score - left.score || right.thread.last_active_tick - left.thread.last_active_tick).slice(0, 10))

const maxHeat = computed(() => Math.max(1, ...hotThreads.value.map((item) => item.score)))
const usage = computed(() => publicBranch.value?.usage || {})
const currentTickNumber = computed(() => selectedTick.value?.tick ?? null)

const currentWorldFrame = computed(() => {
  const tick = currentTickNumber.value
  if (tick === null || !socialWorld.value) return null
  const branch = tick < branchForkTick.value ? 'shared_baseline' : selectedBranch.value
  return socialWorld.value.frames.find((frame) => frame.tick === tick && frame.branch === branch) || null
})

const visibleReviewedExcerpts = computed(() => {
  const tick = currentTickNumber.value
  if (tick === null || !socialWorld.value) return []
  return socialWorld.value.reviewed_excerpts.filter((excerpt) => (
    excerpt.review_status === 'approved'
    && excerpt.tick <= tick
    && (
      excerpt.branch === 'shared_baseline'
      || (tick >= branchForkTick.value && excerpt.branch === selectedBranch.value)
    )
  ))
})

const BACKGROUND_WORLD_ROLE_ID = 'archetype-16'

function stableWorldHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const worldRoleById = computed(() => new Map(
  (agentWorld.value?.population.roles || []).map((role) => [role.role_id, role]),
))

const actionableWorldRoles = computed(() => (
  agentWorld.value?.population.roles || []
).filter((role) => role.role_id !== BACKGROUND_WORLD_ROLE_ID))

const macroWorldClusters = computed<MacroWorldCluster[]>(() => actionableWorldRoles.value.map((role, index, roles) => {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, roles.length)
  return {
    ...role,
    x:410 + Math.cos(angle) * 315,
    y:245 + Math.sin(angle) * 178,
    cluster_radius:30,
  }
}))

const liveMicroNodes = computed<MicroWorldNode[]>(() => {
  const maxCount = Math.max(1, ...actionableWorldRoles.value.map((role) => role.agent_count))
  return macroWorldClusters.value.flatMap((cluster) => {
    const count = Math.max(1, cluster.micro_role_count)
    const phase = stableWorldHash(cluster.role_id) / 0xffffffff * Math.PI * 2
    return Array.from({ length:count }, (_, index) => {
      const angle = phase + index * 2.399963229728653
      const distance = 7 + 19 * Math.sqrt((index + 0.6) / count)
      return {
        ...cluster,
        node_id:`${cluster.role_id}:micro-${String(index + 1).padStart(2, '0')}`,
        micro_index:index + 1,
        x:cluster.x + Math.cos(angle) * distance,
        y:cluster.y + Math.sin(angle) * distance,
        radius:3.4 + 1.35 * Math.sqrt(cluster.agent_count / maxCount),
      }
    })
  })
})

const liveMicroNodeById = computed(() => new Map(liveMicroNodes.value.map((node) => [node.node_id, node])))
const liveMicroNodesByRole = computed(() => {
  const grouped = new Map<string, MicroWorldNode[]>()
  for (const node of liveMicroNodes.value) {
    const values = grouped.get(node.role_id) || []
    values.push(node)
    grouped.set(node.role_id, values)
  }
  return grouped
})

function projectedNodesForRole(roleId: string, count: number, seed: string): MicroWorldNode[] {
  const nodes = liveMicroNodesByRole.value.get(roleId) || []
  return [...nodes]
    .sort((left, right) => (
      stableWorldHash(`${seed}:${left.node_id}`) - stableWorldHash(`${seed}:${right.node_id}`)
      || left.node_id.localeCompare(right.node_id)
    ))
    .slice(0, Math.max(0, Math.min(nodes.length, count)))
}

function projectedNodeForRole(roleId: string, seed: string, candidates?: MicroWorldNode[]): MicroWorldNode | undefined {
  const nodes = candidates?.length ? candidates : (liveMicroNodesByRole.value.get(roleId) || [])
  return nodes.length ? nodes[stableWorldHash(seed) % nodes.length] : undefined
}

const backgroundWorldEdges = computed(() => {
  const grouped = new Map<string, { source_role_id:string; target_role_id:string; count:number }>()
  for (const row of agentWorld.value?.relationships.aggregate_matrix || []) {
    if (row.source_role_id === row.target_role_id) continue
    const [source, target] = [row.source_role_id, row.target_role_id].sort()
    const key = `${source}|${target}`
    const current = grouped.get(key) || { source_role_id:source, target_role_id:target, count:0 }
    current.count += row.directed_edge_count
    grouped.set(key, current)
  }
  return [...grouped.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 34)
    .map((edge) => ({
      ...edge,
      sourceNode:projectedNodeForRole(edge.source_role_id, `base:${edge.source_role_id}:${edge.target_role_id}:source`),
      targetNode:projectedNodeForRole(edge.target_role_id, `base:${edge.source_role_id}:${edge.target_role_id}:target`),
    }))
    .filter((edge) => edge.sourceNode && edge.targetNode)
})

const publicWorldEdgePool = computed<LiveWorldEdge[]>(() => {
  const rows = publicBranch.value?.feed_recommendation?.macro_role_matrix || []
  return rows.flatMap((row, index) => {
    const [source, target, ...rest] = String(row.source_to_recipient || '').split('->')
    if (rest.length || !worldRoleById.value.has(source) || !worldRoleById.value.has(target) || source === target || source === BACKGROUND_WORLD_ROLE_ID || target === BACKGROUND_WORLD_ROLE_ID) return []
    const count = Math.max(0, Number(row.exposure_count || 0))
    if (!count) return []
    return [{ key:`public:${source}:${target}:${index}`, source_role_id:source, target_role_id:target, channel:'public' as const, count, excerpt_ids:[] }]
  })
})

const publicWorldEdges = computed<LiveWorldEdge[]>(() => [...publicWorldEdgePool.value]
  .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
  .slice(0, 48))

const privateWorldEdges = computed<LiveWorldEdge[]>(() => (currentWorldFrame.value?.edges || []).map((edge, index) => ({
  key:`${edge.channel}:${edge.source_role_id}:${edge.target_role_id}:${index}`,
  source_role_id:edge.source_role_id,
  target_role_id:edge.target_role_id,
  channel:edge.channel,
  count:edge.message_count,
  excerpt_ids:edge.excerpt_ids,
})))

const publicReachedMicroNodeIds = computed(() => {
  const exposureByRole = new Map<string, number>()
  for (const edge of publicWorldEdgePool.value) {
    exposureByRole.set(edge.target_role_id, (exposureByRole.get(edge.target_role_id) || 0) + edge.count)
  }
  const ids = new Set<string>()
  const frameSeed = `${selectedTick.value?.branch || 'shared'}:T${currentTickNumber.value ?? 0}:public`
  for (const [roleId, exposureCount] of exposureByRole) {
    const roleNodes = liveMicroNodesByRole.value.get(roleId) || []
    const projectedCount = Math.min(roleNodes.length, Math.max(1, Math.ceil(Math.log2(exposureCount + 1))))
    for (const node of projectedNodesForRole(roleId, projectedCount, `${frameSeed}:${roleId}`)) ids.add(node.node_id)
  }
  return ids
})

const privateReachedMicroNodeIds = computed(() => {
  const ids = new Set<string>()
  const frameSeed = `${selectedTick.value?.branch || 'shared'}:T${currentTickNumber.value ?? 0}:private`
  for (const edge of privateWorldEdges.value) {
    const endpointCount = Math.max(1, Math.min(2, Math.ceil(Math.sqrt(edge.count))))
    for (const node of projectedNodesForRole(edge.source_role_id, endpointCount, `${frameSeed}:${edge.key}:source`)) ids.add(node.node_id)
    for (const node of projectedNodesForRole(edge.target_role_id, endpointCount, `${frameSeed}:${edge.key}:target`)) ids.add(node.node_id)
  }
  return ids
})

const publicProfileByDisplayId = computed(() => new Map(
  (publicBranch.value?.public_display_profiles || []).map((profile) => [profile.display_id, profile]),
))

const llmProfileByMicroNodeId = computed(() => {
  const currentSpeakers = new Set(currentMessages.value.map((message) => message.source_agent_display_id))
  const mapped = new Map<string, LivePublicDisplayProfile>()
  for (const profile of publicBranch.value?.public_display_profiles || []) {
    if (!currentSpeakers.has(profile.display_id) || profile.macro_role === BACKGROUND_WORLD_ROLE_ID) continue
    const nodes = liveMicroNodesByRole.value.get(profile.macro_role) || []
    if (!nodes.length) continue
    let index = stableWorldHash(`${profile.micro_role || ''}:${profile.display_id}`) % nodes.length
    for (let offset = 0; offset < nodes.length; offset += 1) {
      const node = nodes[(index + offset) % nodes.length]
      if (!mapped.has(node.node_id)) {
        mapped.set(node.node_id, profile)
        break
      }
    }
  }
  return mapped
})

const llmMicroNodeIds = computed(() => new Set(llmProfileByMicroNodeId.value.keys()))

const llmMicroNodesByRole = computed(() => {
  const grouped = new Map<string, MicroWorldNode[]>()
  for (const nodeId of llmMicroNodeIds.value) {
    const node = liveMicroNodeById.value.get(nodeId)
    if (!node) continue
    const values = grouped.get(node.role_id) || []
    values.push(node)
    grouped.set(node.role_id, values)
  }
  return grouped
})

const activeMicroNodeIds = computed(() => {
  const ids = new Set<string>()
  if (worldChannel.value !== 'private') {
    for (const nodeId of publicReachedMicroNodeIds.value) ids.add(nodeId)
    for (const nodeId of llmMicroNodeIds.value) ids.add(nodeId)
  }
  if (worldChannel.value !== 'public') {
    for (const nodeId of privateReachedMicroNodeIds.value) ids.add(nodeId)
  }
  return ids
})

const visibleLiveWorldEdges = computed(() => {
  const values = worldChannel.value === 'public'
    ? publicWorldEdges.value
    : worldChannel.value === 'private'
      ? privateWorldEdges.value
      : [...publicWorldEdges.value, ...privateWorldEdges.value]
  return values.map((edge) => ({
    ...edge,
    sourceNode:projectedNodeForRole(
      edge.source_role_id,
      `${selectedTick.value?.branch}:${currentTickNumber.value}:${edge.key}:source`,
      edge.channel === 'public'
        ? llmMicroNodesByRole.value.get(edge.source_role_id)
        : (liveMicroNodesByRole.value.get(edge.source_role_id) || []).filter((node) => privateReachedMicroNodeIds.value.has(node.node_id)),
    ),
    targetNode:projectedNodeForRole(
      edge.target_role_id,
      `${selectedTick.value?.branch}:${currentTickNumber.value}:${edge.key}:target`,
      edge.channel === 'public'
        ? (liveMicroNodesByRole.value.get(edge.target_role_id) || []).filter((node) => publicReachedMicroNodeIds.value.has(node.node_id))
        : (liveMicroNodesByRole.value.get(edge.target_role_id) || []).filter((node) => privateReachedMicroNodeIds.value.has(node.node_id)),
    ),
  })).filter((edge) => edge.sourceNode && edge.targetNode)
})

const maxLiveWorldEdge = computed(() => Math.max(1, ...visibleLiveWorldEdges.value.map((edge) => edge.count)))

const activeWorldCounts = computed(() => {
  const counts = new Map(actionableWorldRoles.value.map((role) => [role.role_id, 0]))
  const speakers = new Set(currentMessages.value.map((message) => message.source_agent_display_id))
  for (const displayId of speakers) {
    const profile = publicProfileByDisplayId.value.get(displayId)
    if (profile) counts.set(profile.macro_role, (counts.get(profile.macro_role) || 0) + 1)
  }
  return counts
})

const selectedWorldMicroNode = computed(() => liveMicroNodeById.value.get(selectedWorldMicroNodeId.value) || null)
const selectedWorldRole = computed(() => worldRoleById.value.get(selectedWorldRoleId.value) || null)
const selectedWorldEdge = computed(() => visibleLiveWorldEdges.value.find((edge) => edge.key === selectedWorldEdgeKey.value) || null)
const selectedEdgeSourceRole = computed(() => worldRoleById.value.get(selectedWorldEdge.value?.source_role_id || ''))
const selectedEdgeTargetRole = computed(() => worldRoleById.value.get(selectedWorldEdge.value?.target_role_id || ''))
const selectedMicroProfile = computed(() => selectedWorldMicroNode.value ? llmProfileByMicroNodeId.value.get(selectedWorldMicroNode.value.node_id) : undefined)
const representativeAgentsByRole = computed(() => {
  const grouped = new Map<string,PublicAgentDossier[]>()
  for (const agent of agentWorld.value?.population.representative_agents || []) {
    const rows = grouped.get(agent.role_id) || []
    rows.push(agent)
    grouped.set(agent.role_id, rows)
  }
  return grouped
})
const selectedDossierAgent = computed(() => {
  const node = selectedWorldMicroNode.value
  if (!node) return null
  const values = representativeAgentsByRole.value.get(node.role_id) || []
  if (!values.length) return null
  const live = selectedMicroProfile.value
  return (live?.micro_role ? values.find((item) => item.micro_role === live.micro_role) : undefined)
    || values[(node.micro_index - 1) % values.length]
})
const selectedDossierLiveProfile = computed(() => selectedMicroProfile.value || null)
const selectedDossierDisplayId = computed(() => selectedDossierLiveProfile.value?.display_id || selectedDossierAgent.value?.display_id || '')
const selectedDossierEvents = computed<AgentDossierEvent[]>(() => {
  const displayId = selectedDossierDisplayId.value
  const tick = currentTickNumber.value
  if (!displayId || tick === null) return []
  return messages.value.filter((message) => message.source_agent_display_id === displayId && message.created_tick <= tick).map((message) => ({
    id:message.message_id, tick:message.created_tick, channel:'public', action:message.action, text:message.visible_text,
    stance:message.stance, emotion:message.emotion, evidenceStatus:message.evidence_status,
    promptHash:message.provenance?.prompt_sha256 || null, provenance:message.provenance?.kind || null,
    interactionCounts:messageInteractions(message),
  }))
})
const selectedDossierPromptHash = computed(() => [...selectedDossierEvents.value].sort((a,b) => b.tick-a.tick).find((event) => event.promptHash)?.promptHash || null)
const selectedDossierPrivateExcerpts = computed<AgentDossierPrivateExcerpt[]>(() => selectedRolePrivateExcerpts.value.map((item) => ({
  id:item.excerpt_id, tick:item.tick, channel:item.channel, textZh:item.text_zh, textEn:item.text_en, effectZh:item.effect_zh, effectEn:item.effect_en,
})))

const selectedMicroStatusLabel = computed(() => {
  const nodeId = selectedWorldMicroNode.value?.node_id
  if (!nodeId) return localize('未选择', 'Not selected')
  const statuses: string[] = []
  if (llmMicroNodeIds.value.has(nodeId)) statuses.push(localize('LLM 发言', 'LLM speaker'))
  if (publicReachedMicroNodeIds.value.has(nodeId)) statuses.push(localize('公开 Feed 触达', 'Public Feed reach'))
  if (privateReachedMicroNodeIds.value.has(nodeId)) statuses.push(localize('好友私聊触达', 'Private-chat reach'))
  return statuses.join(' · ') || localize('本 Tick 未触达', 'Not reached this Tick')
})

const selectedRolePublicMessages = computed(() => {
  const roleId = selectedWorldEdge.value?.source_role_id || selectedWorldRole.value?.role_id
  if (!roleId) return []
  if (!selectedWorldEdge.value && selectedMicroProfile.value) {
    return messages.value.filter((message) => message.source_agent_display_id === selectedMicroProfile.value?.display_id).slice(0, 4)
  }
  return messages.value.filter((message) => publicProfileByDisplayId.value.get(message.source_agent_display_id)?.macro_role === roleId).slice(0, 4)
})

const selectedRolePrivateExcerpts = computed(() => {
  if (selectedWorldEdge.value) {
    if (selectedWorldEdge.value.channel === 'public') return []
    const source = selectedWorldEdge.value.source_role_id
    const target = selectedWorldEdge.value.target_role_id
    const ids = new Set(privateWorldEdges.value
      .filter((edge) => (
        (edge.source_role_id === source && edge.target_role_id === target)
        || (edge.source_role_id === target && edge.target_role_id === source)
      ))
      .flatMap((edge) => edge.excerpt_ids))
    return visibleReviewedExcerpts.value
      .filter((excerpt) => ids.has(excerpt.excerpt_id))
      .sort((left, right) => left.tick - right.tick || left.excerpt_id.localeCompare(right.excerpt_id))
  }
  const roleId = selectedWorldRole.value?.role_id
  if (!roleId) return []
  return visibleReviewedExcerpts.value.filter((excerpt) => excerpt.source_role_id === roleId || excerpt.target_role_id === roleId).slice(-4).reverse()
})

const worldPublicExposureCount = computed(() => publicWorldEdgePool.value.reduce((sum, edge) => sum + edge.count, 0))

const unifiedWorldFrame = computed<ForumWorldRuntimeFrame | null>(() => {
  const tick=currentTickNumber.value
  if(!agentWorld.value||tick===null)return null
  const nodeEvidence=(node:MicroWorldNode)=>{
    const profile=llmProfileByMicroNodeId.value.get(node.node_id)
    const publicRows=profile
      ? messages.value.filter(message=>message.source_agent_display_id===profile.display_id)
      : messages.value.filter(message=>publicProfileByDisplayId.value.get(message.source_agent_display_id)?.macro_role===node.role_id)
    const privateRows=visibleReviewedExcerpts.value.filter(excerpt=>excerpt.source_role_id===node.role_id||excerpt.target_role_id===node.role_id)
    return [
      ...publicRows.slice(-3).map(message=>({id:message.message_id,kicker:`${actionLabel(message.action)} · Tick ${message.created_tick}`,text:message.visible_text,provenance:message.provenance?.kind||'reviewed trace'})),
      ...privateRows.slice(-2).map(excerpt=>({id:excerpt.excerpt_id,kicker:`${worldChannelLabel(excerpt.channel)} · Tick ${excerpt.tick}`,text:localize(excerpt.text_zh,excerpt.text_en),effect:localize(excerpt.effect_zh,excerpt.effect_en),provenance:'reviewed excerpt'})),
    ]
  }
  const nodes=liveMicroNodes.value.map(node=>({
    id:node.node_id,roleId:node.role_id,label:worldRoleLabel(node),microRole:worldMicroRoleLabel(node,llmProfileByMicroNodeId.value.get(node.node_id)?.micro_role,node.micro_index),
    x:node.x,y:node.y,radius:node.radius,population:node.agent_count,
    active:activeMicroNodeIds.value.has(node.node_id),
    publicReached:publicReachedMicroNodeIds.value.has(node.node_id),
    privateReached:privateReachedMicroNodeIds.value.has(node.node_id),
    groupReached:privateWorldEdges.value.some(edge=>edge.channel==='private_group'&&(edge.source_role_id===node.role_id||edge.target_role_id===node.role_id)),
    llmSpeaker:llmMicroNodeIds.value.has(node.node_id),
    status:[llmMicroNodeIds.value.has(node.node_id)?localize('LLM 发言','LLM speaker'):'',publicReachedMicroNodeIds.value.has(node.node_id)?localize('公开 Feed 触达','Public reach'):'',privateReachedMicroNodeIds.value.has(node.node_id)?localize('好友私聊触达','Private reach'):''].filter(Boolean).join(' · ')||localize('本 Tick 未触达','Not reached this Tick'),
    evidence:nodeEvidence(node),
  }))
  const baseEdges=backgroundWorldEdges.value.map((edge,index)=>({id:`base:${index}`,sourceId:edge.sourceNode!.node_id,targetId:edge.targetNode!.node_id,channel:'base' as const,count:edge.count,label:localize('固定合成关系背景','Fixed synthetic relationship')}))
  const liveEdges=visibleLiveWorldEdges.value.map((edge)=>{
    const excerptIds=new Set(edge.excerpt_ids)
    const privateEvidence=visibleReviewedExcerpts.value.filter(excerpt=>excerptIds.has(excerpt.excerpt_id)).map(excerpt=>({id:excerpt.excerpt_id,kicker:`${worldChannelLabel(excerpt.channel)} · Tick ${excerpt.tick}`,text:localize(excerpt.text_zh,excerpt.text_en),effect:localize(excerpt.effect_zh,excerpt.effect_en),provenance:'reviewed excerpt'}))
    const publicEvidence=edge.channel==='public'?currentMessages.value.filter(message=>publicProfileByDisplayId.value.get(message.source_agent_display_id)?.macro_role===edge.source_role_id).slice(0,3).map(message=>({id:message.message_id,kicker:`${actionLabel(message.action)} · Tick ${message.created_tick}`,text:message.visible_text,provenance:message.provenance?.kind||'reviewed trace'})):[]
    return {id:edge.key,sourceId:edge.sourceNode!.node_id,targetId:edge.targetNode!.node_id,channel:edge.channel,count:edge.count,label:`${worldRoleLabel(worldRoleById.value.get(edge.source_role_id))} → ${worldRoleLabel(worldRoleById.value.get(edge.target_role_id))}`,evidence:[...privateEvidence,...publicEvidence]}
  })
  return {
    frameId:`century:${selectedBranch.value}:${tick}:${selectedKey.value}`,
    title:localize('校园 Agent 世界实时演化','Live evolution of the campus Agent world'),
    subtitle:localize('固定人口、公开论坛、好友私聊和动态小群由同一 Tick 运行帧驱动；点击节点或连线查看当时发生的内容。','The fixed population, public forum, friend chats and dynamic groups share one Tick frame. Select a node or edge to inspect what happened.'),
    tick,
    branchLabel:selectedTick.value?branchLabel(selectedTick.value.branch):selectedBranch.value,
    statusLabel:state.value==='succeeded'?localize('运行完成','Completed'):state.value==='running'?localize('运行中','Running'):localize('回放','Replay'),
    playing:replayPlaying.value||state.value==='running',
    nodes,
    edges:[...baseEdges,...liveEdges],
    metrics:[
      {id:'active',label:localize('本 Tick 触达节点','Nodes reached'),value:activeMicroNodeIds.value.size,note:`/ ${liveMicroNodes.value.length}`},
      {id:'llm',label:localize('LLM 发言节点','LLM speakers'),value:llmMicroNodeIds.value.size},
      {id:'public',label:localize('公开 Feed 触达','Public feed exposures'),value:worldPublicExposureCount.value},
      {id:'private',label:localize('本 Tick 私聊','Private messages'),value:currentWorldFrame.value?.private_messages_this_tick??0},
      {id:'groups',label:localize('活跃小群','Active groups'),value:currentWorldFrame.value?.active_group_count??0},
    ],
    contentSha256:socialWorld.value?.content_sha256||agentWorld.value.world_sha256,
    boundaryNote:localize('公开内容来自已提交 LLM 结果，私聊仅展示人工审阅摘录和匿名聚合；节点、连线与帖子使用同一 Tick。','Public content comes from committed LLM results; private channels expose only reviewed excerpts and anonymous aggregates. Nodes, edges and posts use the same Tick.'),
  }
})

function inspectUnifiedWorldNode(node:ForumWorldRuntimeNode):void {
  const target=liveMicroNodeById.value.get(node.id)
  if(!target)return
  selectWorldMicroNode(target)
  dossierOpen.value=true
}

const WORLD_EXPORT_CSS = `
  .export-background { fill:#ffffff; }
  .world-macro-clusters circle { fill:none; stroke:#c8cdd3; stroke-width:.8; stroke-dasharray:2 5; }
  .world-macro-clusters text { fill:#626b75; font:700 7px monospace; letter-spacing:.04em; }
  .world-base-edges line { stroke:#9aa2ab; stroke-width:.65; opacity:.72; }
  .edge-hit { stroke:transparent; stroke-width:13; }
  .edge-signal { stroke:#d51b49; stroke-width:2; stroke-linecap:round; }
  .live-edge.private_direct .edge-signal { stroke:#a77914; stroke-width:2; }
  .live-edge.private_group .edge-signal { stroke:#6e56b0; stroke-width:2; }
  .live-edge.selected .edge-signal { stroke:#111820; stroke-width:3.2; }
  .live-world-node .node-body { fill:#ffffff; stroke:#69727d; stroke-width:1; }
  .live-world-node.public-reached .node-body { fill:#fff4f7; stroke:#d51b49; stroke-width:1.5; }
  .live-world-node.private-reached .node-body { fill:#fff9e8; stroke:#a77914; stroke-width:1.5; }
  .live-world-node.public-reached.private-reached .node-body { fill:#fff1f0; stroke:#bd4c55; stroke-width:1.6; }
  .live-world-node.llm-speaker .node-body { fill:#d51b49; stroke:#ffffff; stroke-width:1.7; }
  .live-world-node text { fill:#29313a; font:750 9px monospace; }
  .live-world-node.active>text:first-of-type { fill:#111820; }
  .node-radar { fill:none; stroke:#d51b49; stroke-width:1.2; opacity:.55; }
  .live-world-node.private-reached .node-radar { stroke:#a77914; }
  .llm-ring { fill:none; stroke:#d51b49; stroke-width:1.15; opacity:.9; }
  .llm-ring--outer { stroke:#d51b49; stroke-width:1; stroke-dasharray:2 3; }
  .live-world-center { display:none!important; }
`

const SNAPSHOT_WIDTH = 2400
const SNAPSHOT_HEIGHT = 1350
const SNAPSHOT_DPI = 300
// A 12-inch-wide 16:9 report figure at 300 DPI.
const PNG_EXPORT_WIDTH = 3600
const PNG_EXPORT_HEIGHT = 2025

function createSnapshotNode(tag: string): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', tag)
}

function snapshotText(parent: SVGElement, x: number, y: number, text: string, className: string, attrs: Record<string, string> = {}): SVGTextElement {
  const node = createSnapshotNode('text') as SVGTextElement
  node.setAttribute('x', String(x))
  node.setAttribute('y', String(y))
  node.setAttribute('class', className)
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value))
  node.textContent = text
  parent.appendChild(node)
  return node
}

function snapshotRect(parent: SVGElement, x: number, y: number, width: number, height: number, className: string, radius = 0): SVGRectElement {
  const node = createSnapshotNode('rect') as SVGRectElement
  node.setAttribute('x', String(x))
  node.setAttribute('y', String(y))
  node.setAttribute('width', String(width))
  node.setAttribute('height', String(height))
  node.setAttribute('class', className)
  if (radius) {
    node.setAttribute('rx', String(radius))
    node.setAttribute('ry', String(radius))
  }
  parent.appendChild(node)
  return node
}

function snapshotLine(parent: SVGElement, x1: number, y1: number, x2: number, y2: number, className: string): SVGLineElement {
  const node = createSnapshotNode('line') as SVGLineElement
  node.setAttribute('x1', String(x1))
  node.setAttribute('y1', String(y1))
  node.setAttribute('x2', String(x2))
  node.setAttribute('y2', String(y2))
  node.setAttribute('class', className)
  parent.appendChild(node)
  return node
}

function snapshotWrappedText(parent: SVGElement, x: number, y: number, text: string, className: string, maxChars = 30, lineHeight = 24, maxLines = 3): number {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return y
  const lines: string[] = []
  for (let index = 0; index < clean.length && lines.length < maxLines; index += maxChars) {
    lines.push(clean.slice(index, index + maxChars))
  }
  if (clean.length > maxChars * maxLines && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(1, maxChars - 1))}…`
  lines.forEach((line, index) => snapshotText(parent, x, y + index * lineHeight, line, className))
  return y + lines.length * lineHeight
}

function snapshotMetric(parent: SVGElement, x: number, y: number, width: number, label: string, value: string): void {
  snapshotRect(parent, x, y, width, 62, 'snapshot-metric', 8)
  snapshotText(parent, x + 18, y + 22, label, 'snapshot-metric-label')
  snapshotText(parent, x + 18, y + 49, value, 'snapshot-metric-value')
}

function snapshotMessageCard(parent: SVGElement, x: number, y: number, width: number, message: LivePublicMessage): number {
  snapshotRect(parent, x, y, width, 112, 'snapshot-message-card', 8)
  const interactions = messageInteractions(message)
  snapshotText(parent, x + 18, y + 25, `${actionLabel(message.action)} · Tick ${message.created_tick}`, 'snapshot-card-kicker')
  snapshotText(parent, x + width - 18, y + 25, `♥ ${interactions.like || 0}  ↗ ${interactions.repost || 0}  ⚑ ${interactions.report || 0}`, 'snapshot-card-counts', { 'text-anchor': 'end' })
  snapshotWrappedText(parent, x + 18, y + 56, message.visible_text, 'snapshot-card-text', 46, 23, 2)
  return y + 126
}

function snapshotPrivateCard(parent: SVGElement, x: number, y: number, width: number, excerpt: ReviewedPrivateExcerpt): number {
  snapshotRect(parent, x, y, width, 128, 'snapshot-private-card', 8)
  snapshotText(parent, x + 18, y + 25, `${worldChannelLabel(excerpt.channel)} · Tick ${excerpt.tick}`, 'snapshot-card-kicker snapshot-card-kicker-private')
  snapshotText(parent, x + width - 18, y + 25, excerptMechanismLabel(excerpt.mechanism), 'snapshot-card-counts', { 'text-anchor': 'end' })
  snapshotWrappedText(parent, x + 18, y + 56, localize(excerpt.text_zh, excerpt.text_en), 'snapshot-card-text', 43, 22, 2)
  snapshotWrappedText(parent, x + 18, y + 105, localize(`影响：${excerpt.effect_zh}`, `Effect: ${excerpt.effect_en}`), 'snapshot-card-effect', 48, 19, 1)
  return y + 142
}

function worldExportStem(): string {
  const tick = selectedTick.value ? String(selectedTick.value.tick).padStart(2, '0') : '00'
  const branch = selectedTick.value?.branch || selectedBranch.value
  return `campuspulse-century-gym-${branch.toLowerCase()}-t${tick}`
}

function createWorldExportSvg(): string | null {
  const source = worldSvgRef.value
  if (!source || typeof document === 'undefined' || typeof XMLSerializer === 'undefined') return null
  const root = createSnapshotNode('svg') as SVGSVGElement
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  root.setAttribute('width', String(SNAPSHOT_WIDTH))
  root.setAttribute('height', String(SNAPSHOT_HEIGHT))
  root.setAttribute('viewBox', `0 0 ${SNAPSHOT_WIDTH} ${SNAPSHOT_HEIGHT}`)
  root.setAttribute('data-export-dpi', String(SNAPSHOT_DPI))

  const style = createSnapshotNode('style') as SVGStyleElement
  style.textContent = `${WORLD_EXPORT_CSS}
    .snapshot-bg{fill:#fff}.snapshot-panel{fill:#f8fafb;stroke:#dfe4e9;stroke-width:1}.snapshot-header-rule,.snapshot-rule{stroke:#d9dfe5;stroke-width:1}.snapshot-kicker{fill:#a20d36;font:800 16px Inter,Arial,sans-serif;letter-spacing:.14em}.snapshot-title{fill:#141a21;font:800 38px 'Noto Sans SC',Arial,sans-serif}.snapshot-subtitle{fill:#5e6975;font:400 17px 'Noto Sans SC',Arial,sans-serif}.snapshot-chip{fill:#fff;stroke:#cbd3db;stroke-width:1}.snapshot-chip-label{fill:#68747f;font:600 13px 'Noto Sans SC',Arial,sans-serif}.snapshot-chip-value{fill:#161b21;font:750 15px Inter,'Noto Sans SC',Arial,sans-serif}.snapshot-section-title{fill:#141a21;font:800 21px 'Noto Sans SC',Arial,sans-serif}.snapshot-section-kicker{fill:#a20d36;font:800 13px Inter,Arial,sans-serif;letter-spacing:.12em}.snapshot-metric{fill:#fff;stroke:#e0e5e9;stroke-width:1}.snapshot-metric-label{fill:#66727d;font:600 13px 'Noto Sans SC',Arial,sans-serif}.snapshot-metric-value{fill:#141a21;font:800 25px Inter,'Noto Sans SC',Arial,sans-serif}.snapshot-card-kicker{fill:#68747f;font:700 12px Inter,'Noto Sans SC',Arial,sans-serif}.snapshot-card-kicker-private{fill:#9b741a}.snapshot-card-counts{fill:#7b858e;font:600 11px Inter,Arial,sans-serif}.snapshot-card-text{fill:#26313a;font:500 16px 'Noto Sans SC',Arial,sans-serif}.snapshot-card-effect{fill:#a20d36;font:600 12px 'Noto Sans SC',Arial,sans-serif}.snapshot-message-card{fill:#fff;stroke:#dfe4e9;stroke-width:1}.snapshot-private-card{fill:#fffaf0;stroke:#d8b45e;stroke-width:1}.snapshot-legend-text{fill:#65717b;font:600 12px 'Noto Sans SC',Arial,sans-serif}.snapshot-footer{fill:#7c8791;font:500 12px Inter,'Noto Sans SC',Arial,sans-serif}`
  root.appendChild(style)
  snapshotRect(root, 0, 0, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT, 'snapshot-bg')

  const branch = selectedTick.value?.branch || selectedBranch.value
  const tick = currentTickNumber.value ?? 0
  const currentRows = currentMessages.value
  const interactions = currentRows.reduce((sum, message) => {
    const counts = messageInteractions(message)
    sum.like += counts.like || 0
    sum.repost += counts.repost || 0
    sum.report += counts.report || 0
    return sum
  }, { like:0, repost:0, report:0 })

  snapshotText(root, 60, 48, 'CAMPUSPULSE · SIMULATION SNAPSHOT', 'snapshot-kicker')
  snapshotText(root, 60, 96, scenarioMeta.value.titleZh, 'snapshot-title')
  snapshotText(root, 60, 130, localize('公开论坛、好友私聊与治理分支的同 Tick 快照', 'A same-Tick snapshot of public forum, friend chat and governance branches'), 'snapshot-subtitle')
  snapshotText(root, 60, 166, `${scenarioMeta.value.code} · ${branchLabel(branch)} · Tick ${tick}`, 'snapshot-kicker', { 'font-size':'13px', 'letter-spacing':'.04em' })

  const chips = [
    [localize('场景', 'Scenario'), scenarioMeta.value.titleZh],
    [localize('分支', 'Branch'), branchLabel(branch)],
    [localize('时间步', 'Tick'), `T${tick}`],
    [localize('人口', 'Population'), `${agentWorld.value?.population.agent_count || 1000} LLM`],
    [localize('论坛 Feed', 'Forum feed'), localize('热榜前十 + 最新帖', 'Top 10 + latest')],
  ]
  chips.forEach(([label, value], index) => {
    const x = 960 + index * 270
    snapshotRect(root, x, 52, 245, 62, 'snapshot-chip', 8)
    snapshotText(root, x + 16, 77, label, 'snapshot-chip-label')
    snapshotText(root, x + 16, 101, value, 'snapshot-chip-value')
  })
  snapshotLine(root, 60, 198, SNAPSHOT_WIDTH - 60, 198, 'snapshot-header-rule')

  const metricItems: [string, string][] = [
    [localize('本 Tick 公开消息', 'Public messages'), String(currentRows.length)],
    [localize('点赞', 'Likes'), String(interactions.like)],
    [localize('转发', 'Reposts'), String(interactions.repost)],
    [localize('举报', 'Reports'), String(interactions.report)],
    [localize('本 Tick 私聊', 'Private messages'), String(currentWorldFrame.value?.private_messages_this_tick ?? 0)],
    [localize('活跃小群', 'Active groups'), String(currentWorldFrame.value?.active_group_count ?? 0)],
  ]
  metricItems.forEach(([label, value], index) => snapshotMetric(root, 60 + index * 260, 220, 240, label, value))

  snapshotRect(root, 60, 305, 1540, 955, 'snapshot-panel', 12)
  snapshotText(root, 90, 345, localize('关系网络与公开/私聊触达', 'Relationship network and public/private reach'), 'snapshot-section-title')
  snapshotText(root, 90, 372, localize('红色：公开传播　金色：好友私聊　紫色：动态小群　红色双环：本 Tick LLM 发言', 'Red: public · Gold: friend chat · Violet: group chat · Double red ring: LLM speaker'), 'snapshot-legend-text')

  const network = source.cloneNode(true) as SVGSVGElement
  network.setAttribute('x', '75')
  network.setAttribute('y', '390')
  network.setAttribute('width', '1510')
  network.setAttribute('height', '835')
  network.setAttribute('viewBox', '0 0 820 490')
  network.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  const networkStyle = createSnapshotNode('style') as SVGStyleElement
  networkStyle.textContent = WORLD_EXPORT_CSS
  network.insertBefore(networkStyle, network.firstChild)
  root.appendChild(network)

  snapshotRect(root, 1630, 305, 710, 955, 'snapshot-panel', 12)
  snapshotText(root, 1660, 345, localize('本 Tick 讨论与私聊', 'Tick discussion & private chat'), 'snapshot-section-title')
  snapshotText(root, 1660, 372, selectedWorldRole.value ? `${worldRoleLabel(selectedWorldRole.value)} · ${selectedMicroStatusLabel.value}` : localize('选择网络节点查看内容', 'Select a network node to inspect content'), 'snapshot-section-kicker', { 'font-size':'12px', 'letter-spacing':'.02em' })
  snapshotLine(root, 1660, 392, 2310, 392, 'snapshot-rule')

  const selectedPopulation = selectedWorldRole.value?.agent_count ?? 0
  const selectedSpeakers = selectedWorldRole.value ? (activeWorldCounts.value.get(selectedWorldRole.value.role_id) || 0) : currentRows.length
  snapshotMetric(root, 1660, 414, 205, localize('角色人口', 'Role population'), String(selectedPopulation || '—'))
  snapshotMetric(root, 1880, 414, 205, localize('本 Tick LLM', 'LLM this Tick'), String(selectedSpeakers))
  snapshotMetric(root, 2100, 414, 210, localize('可见 Claim', 'Visible claims'), String(publicBranch.value?.claims?.length || 0))

  let panelY = 505
  snapshotText(root, 1660, panelY, localize('公开帖子 / 评论', 'Public posts / replies'), 'snapshot-section-kicker', { 'letter-spacing':'.06em' })
  panelY += 24
  const publicRows = (selectedRolePublicMessages.value.length ? selectedRolePublicMessages.value : feedMessages.value).slice(0, 3)
  if (!publicRows.length) {
    snapshotWrappedText(root, 1660, panelY + 20, localize('本 Tick 暂无已提交公开文本。', 'No committed public text at this Tick.'), 'snapshot-card-text', 44, 22, 2)
    panelY += 70
  } else {
    publicRows.forEach((message) => { panelY = snapshotMessageCard(root, 1660, panelY, 650, message) })
  }

  panelY += 8
  snapshotText(root, 1660, panelY, localize('经审阅好友私聊 / 群聊', 'Reviewed friend / group chat'), 'snapshot-section-kicker', { 'letter-spacing':'.06em' })
  panelY += 24
  const privateRows = (selectedRolePrivateExcerpts.value.length ? selectedRolePrivateExcerpts.value : visibleReviewedExcerpts.value).slice(0, 2)
  if (!privateRows.length) {
    snapshotWrappedText(root, 1660, panelY + 20, localize('本 Tick 暂无可展示的私聊摘录。', 'No reviewed private excerpt is available at this Tick.'), 'snapshot-card-text', 44, 22, 2)
  } else {
    privateRows.forEach((excerpt) => { panelY = snapshotPrivateCard(root, 1660, panelY, 650, excerpt) })
  }

  snapshotLine(root, 60, 1290, SNAPSHOT_WIDTH - 60, 1290, 'snapshot-rule')
  snapshotText(root, 60, 1320, localize('导出内容：运行配置、Tick 指标、匿名关系投影、公开帖子与经审阅私聊摘录。', 'Export includes run configuration, Tick metrics, anonymous relationship projection, public posts and reviewed private excerpts.'), 'snapshot-footer')
  snapshotText(root, SNAPSHOT_WIDTH - 60, 1320, `${(socialWorld.value?.content_sha256 || agentWorld.value?.world_sha256 || '').slice(0, 16)}…`, 'snapshot-footer', { 'text-anchor':'end' })

  return new XMLSerializer().serializeToString(root)
}

function downloadWorldBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportWorldSvg(): void {
  const svg = createWorldExportSvg()
  if (!svg) return
  downloadWorldBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${worldExportStem()}.svg`)
}

function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function withPngDpi(buffer: ArrayBuffer, dpi: number): ArrayBuffer {
  const source = new Uint8Array(buffer)
  if (source.length < 24 || source[0] !== 0x89 || source[1] !== 0x50 || source[2] !== 0x4e || source[3] !== 0x47) return buffer
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength)
  let offset = 8
  let iendOffset = -1
  while (offset + 12 <= source.length) {
    const length = view.getUint32(offset, false)
    const type = String.fromCharCode(source[offset + 4], source[offset + 5], source[offset + 6], source[offset + 7])
    if (type === 'IEND') {
      iendOffset = offset
      break
    }
    offset += length + 12
  }
  if (iendOffset < 0) return buffer

  const pixelsPerMeter = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(21)
  const chunkView = new DataView(chunk.buffer)
  chunkView.setUint32(0, 9, false)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // pHYs
  chunkView.setUint32(8, pixelsPerMeter, false)
  chunkView.setUint32(12, pixelsPerMeter, false)
  chunk[16] = 1 // unit: metre
  chunkView.setUint32(17, pngCrc32(chunk.subarray(4, 17)), false)

  const output = new Uint8Array(source.length + chunk.length)
  output.set(source.subarray(0, iendOffset), 0)
  output.set(chunk, iendOffset)
  output.set(source.subarray(iendOffset), iendOffset + chunk.length)
  return output.buffer
}

function exportWorldPng(): void {
  const svg = createWorldExportSvg()
  if (!svg || typeof document === 'undefined') return
  const image = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = PNG_EXPORT_WIDTH
    canvas.height = PNG_EXPORT_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) {
      URL.revokeObjectURL(url)
      return
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(async (blob) => {
      if (blob) {
        const taggedPng = withPngDpi(await blob.arrayBuffer(), SNAPSHOT_DPI)
        downloadWorldBlob(new Blob([taggedPng], { type: 'image/png' }), `${worldExportStem()}-300dpi.png`)
      }
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  image.onerror = () => URL.revokeObjectURL(url)
  image.src = url
}

function selectWorldMicroNode(node: MicroWorldNode) {
  selectedWorldMicroNodeId.value = node.node_id
  selectedWorldRoleId.value = node.role_id
  selectedWorldEdgeKey.value = ''
  dossierOpen.value = true
}

function selectWorldEdge(key: string) {
  selectedWorldEdgeKey.value = key
}

function microWorldNodeTitle(node: MicroWorldNode): string {
  const profile = llmProfileByMicroNodeId.value.get(node.node_id)
  const microLabel = profile?.micro_role || localize(`微角色投影 ${String(node.micro_index).padStart(2, '0')}`, `Micro-role projection ${String(node.micro_index).padStart(2, '0')}`)
  const statuses: string[] = []
  if (llmMicroNodeIds.value.has(node.node_id)) statuses.push(localize('LLM 发言', 'LLM speaker'))
  if (publicReachedMicroNodeIds.value.has(node.node_id)) statuses.push(localize('公开触达', 'Public reach'))
  if (privateReachedMicroNodeIds.value.has(node.node_id)) statuses.push(localize('私聊触达', 'Private reach'))
  return `${worldRoleLabel(node)} · ${microLabel} · ${statuses.join(' / ') || localize('未触达', 'not reached')}`
}

const statusTone = computed(() => state.value === 'failed' ? 'danger' : (!hasProgressSession.value && agentWorld.value) || demoCompleted.value ? 'success' : demoStarted.value ? 'warning' : 'neutral')
const statusLabel = computed(() => {
  if (state.value === 'failed') return localize('需要检查', 'Needs attention')
  if (!hasProgressSession.value) return agentWorld.value ? localize('世界已就绪', 'World ready') : localize('正在装载世界', 'Loading world')
  if (state.value === 'waiting' || !manifest.value) return localize('正在准备', 'Preparing')
  if (demoCompleted.value) return localize('运行完成', 'Completed')
  if (demoStarted.value) return replayPlaying.value ? localize('运行中', 'Running') : localize('已暂停', 'Paused')
  return localize('待启动', 'Ready')
})

const stageCopy = computed(() => {
  const tick = currentTickNumber.value ?? 0
  const configured = manifest.value?.display_contract?.stages.find((stage) => stage.tick === tick)
  if (configured) {
    return {
      title:localize(configured.title_zh, configured.title_en),
      detail:localize(configured.detail_zh, configured.detail_en),
    }
  }
  const commonStages: Record<number, readonly [string, string, string, string]> = {
    0: ['人口装载', 'Population loaded', '载入 1,000 个异质 Agent、人物档案和状态粒子。', 'Load 1,000 heterogeneous Agents, profiles, and state particles.'],
    1: ['论坛初始化', 'Forum initialised', '建立全局热榜、最新帖 Feed 与公开互动计数器。', 'Initialise the global hot list, latest-post feed, and public engagement counters.'],
    2: ['共享基线冻结', 'Shared baseline frozen', 'Natural 与主动治理分支共享同一人口、记忆和起点。', 'Natural and governed branches share the same population, memory, and starting state.'],
  }
  const scenarioStages: Record<LiveScenarioId, Record<number, readonly [string,string,string,string]>> = {
    century_gym_ghost_booking_dispute:{
      3:['事件进入论坛','Event enters the forum','学生发布“现场空置但系统不可预约”的首批帖子。','Students publish the first reports of visibly empty but unavailable venues.'],
      4:['平行论坛分叉','Parallel forums fork','Natural 延续讨论；D 分支的治理主体开始依据有限观测选择行动。','Natural continues the discussion while governance actors in D choose actions from finite observations.'],
      5:['工单与证据进入论坛','Tickets and evidence enter the forum','预约证据卡、异常释放工单与跨项目触达进入公开讨论。','Booking evidence, release tickets, and cross-group outreach enter the public discussion.'],
      6:['居民承接与质疑','Resident uptake and challenge','居民点赞、转发、举报，并直接回复或质疑治理对象。','Residents like, repost, report, and directly reply to or challenge governance objects.'],
    },
    governance_legitimacy_dispute:{
      3:['分配争议进入论坛','Allocation dispute enters the forum','居民围绕床位稀缺、资格标准和信息差发表首轮意见。','Residents voice initial views on scarce beds, eligibility, and information gaps.'],
      4:['平行论坛分叉','Parallel forums fork','Natural 不追加回应；D 的三个治理主体依据各自有限观测行动。','Natural adds no response; three governance actors in D act on their private observations.'],
      5:['标准与复核进入讨论','Criteria and appeals enter the forum','规则证据、复核服务和公开答疑成为新的讨论对象。','Criteria evidence, appeal services, and public Q&A become new discussion objects.'],
      6:['直接承接被记录','Direct uptake is recorded','系统严格记录居民对治理帖的直接回复、引用、支持与质疑。','The system records strict direct replies, quotes, support, and challenges to governance posts.'],
    },
    lecture_external_incident_shock:{
      3:['冲突叙述进入论坛','Conflict accounts enter the forum','不同目击者发布完整度和立场不同的叙述。','Witnesses publish accounts with different completeness and stances.'],
      4:['平行论坛分叉','Parallel forums fork','Natural 继续碎片化传播；D 的治理主体从有限观测中判断风险。','Natural continues fragmented spread while governance actors in D assess risk from finite observations.'],
      5:['求证与纠错进入讨论','Verification and correction enter the forum','证据卡、服务承接和跨群触达进入活跃讨论串。','Evidence cards, service response, and outreach enter active threads.'],
      6:['接受与拒绝并存','Acceptance and rejection coexist','居民可能接受、质疑或拒绝纠错，系统保留真实分歧。','Residents may accept, question, or reject corrections; disagreement remains visible.'],
    },
  }
  const fallback: readonly [string, string, string, string] = ['论坛持续演化', 'Forum evolution', '帖子、回复、互动和治理对象继续进入全局热榜与最新帖。', 'Posts, replies, engagement, and governance objects continue through the shared forum feed.']
  const row = commonStages[tick] || scenarioStages[scenarioId.value][tick] || fallback
  return { title:localize(row[0], row[1]), detail:localize(row[2], row[3]) }
})

const heroDetail = computed(() => {
  if (!demoStarted.value) return detail.value
  if (demoCompleted.value) return localize(`Tick ${firstTick.value}–${lastTick.value} 已全部执行，可重新开始演示。`, `Tick ${firstTick.value}–${lastTick.value} completed; the demo can be restarted.`)
  return stageCopy.value.detail
})

const timelineProgress = computed(() => {
  const index = playbackEntries.value.findIndex((entry) => entry.tick === currentTickNumber.value)
  return playbackEntries.value.length ? Math.max(3, (Math.max(0, index) + 1) / playbackEntries.value.length * 100) : 0
})

function publishVerifiedSource(next: LiveProgressManifest) {
  const source: SourceState = {
    key:'century-gym-live-progress',
    mode:'audited_replay',
    label:localize(`${scenarioMeta.value.titleZh}现场运行`, `${scenarioMeta.value.titleEn} live run`),
    verification:'verified',
    freshness:{ status:'fresh', fetchedAt:new Date().toISOString() },
    availability:{ backend:'available', access:'readonly' },
    provenance:{
      runId:next.run_id,
      scenarioId:next.scenario_id,
      manifestAvailable:true,
      expectedHash:next.content_sha256,
      actualHash:next.content_sha256,
      origin:baseUrl.value,
      executionProvenance:'authorized_live_llm',
    },
    publicationEligible:null,
    boundaries:[],
    boundarySummary:localize('现场运行台读取逐项校验的公开时间步。', 'The live console reads hash-verified public ticks.'),
  }
  sourceContext.publishSourceState(route.fullPath, source)
}

function describeManifest(next: LiveProgressManifest): string {
  const ticks = [...new Set(next.committed_ticks.map((entry) => entry.tick))].sort((left, right) => left - right)
  const range = ticks.length ? `Tick ${ticks[0]}–${ticks.at(-1)}` : 'Tick —'
  if (next.status === 'succeeded') {
    return localize(
      `项目运行完成，${range} 共提交 ${next.committed_ticks.length} 个公开快照。`,
      `Run completed with ${next.committed_ticks.length} public snapshots across ${range}.`,
    )
  }
  if (next.status === 'failed' || next.status.startsWith('paused')) {
    return localize(
      `保存记录标记为暂停：${next.stop_code || '请检查运行记录。'}`,
      `The saved record is marked as paused: ${next.stop_code || 'inspect the run record.'}`,
    )
  }
  return localize(
    `正在准备 ${next.committed_ticks.length} 个公开时间步。`,
    `Preparing ${next.committed_ticks.length} public snapshots.`,
  )
}

function artifactKindLabel(value: unknown, index: number): string {
  const key = String(value || '')
  const labels: Record<string, readonly [string,string]> = {
    evidence_card:['证据卡','Evidence card'],
    service_ticket:['服务工单','Service ticket'],
    cross_group_outreach:['跨项目触达','Cross-group outreach'],
  }
  const label = labels[key]
  return label ? localize(label[0], label[1]) : (key || localize(`治理对象 ${index + 1}`, `Governance object ${index + 1}`))
}

function artifactStatusLabel(value: unknown): string {
  const key = String(value || '')
  const labels: Record<string, readonly [string,string]> = {
    active:['运行中','Active'],
    published:['已发布','Published'],
    committed:['已提交','Committed'],
    completed:['已完成','Completed'],
  }
  const label = labels[key]
  return label ? localize(label[0], label[1]) : (key || localize('已进入运行', 'In operation'))
}

async function loadSocialWorldContext() {
  worldError.value = ''
  try {
    const world = await getForumTwinV2AgentWorld()
    if (world?.schema_version !== 'campus-pulse-forum-agent-world-public-v1') throw new Error('Agent world schema mismatch')
    agentWorld.value = world as AgentWorldRelease
    if (!hasProgressSession.value) {
      state.value = 'waiting'
      detail.value = localize('固定人口与关系世界已装载；完成场景和运行计划后可从这里进入逐 Tick 推演。', 'The fixed population and relationship world is loaded. Freeze a scenario and run plan to begin the Tick-by-Tick simulation here.')
    }
    const firstActionableRole = world.population.roles.find((role: WorldRole) => role.role_id !== BACKGROUND_WORLD_ROLE_ID)
    if (!selectedWorldRoleId.value) selectedWorldRoleId.value = firstActionableRole?.role_id || ''
    if (!selectedWorldMicroNodeId.value) selectedWorldMicroNodeId.value = liveMicroNodes.value[0]?.node_id || ''
    if (scenarioId.value !== 'century_gym_ghost_booking_dispute') {
      socialWorld.value = null
      return
    }
    socialWorld.value = adaptCenturyGymSocialWorld(await getCenturyGymSocialWorld())
  } catch (cause) {
    agentWorld.value = null
    socialWorld.value = null
    worldError.value = readableApiError(cause)
  }
}

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  if (!hasProgressSession.value) {
    state.value = 'waiting'
    detail.value = agentWorld.value
      ? localize('固定人口与关系世界已装载；完成场景和运行计划后可从这里进入逐 Tick 推演。', 'The fixed population and relationship world is loaded. Freeze a scenario and run plan to begin the Tick-by-Tick simulation here.')
      : localize('正在装载固定人口与关系世界。', 'Loading the fixed population and relationship world.')
    refreshing.value = false
    return
  }
  controller?.abort()
  controller = new AbortController()
  try {
    const next = await loadLiveManifest(session.value, baseUrl.value, controller.signal)
    const missing = next.committed_ticks.filter((entry) => !ticks.value[entryKey(entry)])
    const loaded = await Promise.all(missing.map(async (entry) => [entryKey(entry), await loadLiveTick(session.value, baseUrl.value, entry, controller?.signal)] as const))
    ticks.value = { ...ticks.value, ...Object.fromEntries(loaded) }
    manifest.value = next
    if (socialWorld.value && socialWorld.value.source_manifest_sha256 !== next.content_sha256) {
      socialWorld.value = null
      worldError.value = localize('社会世界资产与运行记录不匹配。', 'The social-world asset does not match this run.')
    }
    publishVerifiedSource(next)
    state.value = next.status === 'succeeded' ? 'succeeded' : next.status === 'failed' ? 'failed' : next.status.startsWith('paused') ? 'paused' : 'running'
    detail.value = describeManifest(next)
    if (!selectedKey.value && next.committed_ticks.length) {
      const first = playbackEntries.value[0] || next.committed_ticks[0]
      selectedKey.value = entryKey(first)
    }
    if (isLiveOperator.value && next.committed_ticks.length) {
      demoStarted.value = true
      const newestTick = Math.max(...next.committed_ticks.map((entry) => entry.tick))
      const newest = entryForTick(newestTick)
      if (newest) selectedKey.value = entryKey(newest)
      demoCompleted.value = next.status === 'succeeded'
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    const status = Number((error as Error & { status?:number }).status || 0)
    const message = (error as Error).message || ''
    if (status === 404 || /尚未提交/.test(message)) {
      state.value = 'waiting'
      detail.value = localize('保存的演化记录尚未就绪。', 'The saved evolution record is not ready yet.')
    } else if (error instanceof TypeError || /Failed to fetch|NetworkError|Network request failed/i.test(message)) {
      state.value = 'waiting'
      detail.value = localize('正在等待保存的演化记录。', 'Waiting for the saved evolution record.')
    } else {
      state.value = 'failed'
      detail.value = message || localize('演化记录读取失败', 'Failed to read the evolution record')
    }
  } finally {
    refreshing.value = false
  }
}

function selectEntry(entry: LiveProgressEntry) {
  stopReplay()
  demoStarted.value = true
  demoCompleted.value = entry.tick === availableTicks.value.at(-1)
  selectedKey.value = entryKey(entry)
}

watch([session, baseUrl], () => {
  manifest.value = null
  ticks.value = {}
  selectedKey.value = ''
  resetSimulation()
  void refresh()
})

watch([currentLocale, scenarioId], () => {
  document.title = `${localize(scenarioMeta.value.titleZh, scenarioMeta.value.titleEn)} · CampusPulse`
  if (manifest.value) detail.value = describeManifest(manifest.value)
  else if (state.value === 'connecting') detail.value = localize('正在准备项目运行环境…', 'Preparing the project runtime…')
})

watch([currentTickNumber, selectedBranch, worldChannel], () => {
  selectedWorldEdgeKey.value = ''
  liveMotion.pulse('[data-cp-motion-tick]', { y: 8, duration: 0.3 })
})

onMounted(() => {
  document.title = `${localize(scenarioMeta.value.titleZh, scenarioMeta.value.titleEn)} · CampusPulse`
  void loadSocialWorldContext()
  void refresh()
  timer = setInterval(() => { void refresh() }, 1400)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer); stopReplay(); controller?.abort() })

function openProjectPlan() {
  router.push({
    name:'campus-pulse-workbench',
    query:{ project:projectId.value || undefined, section:'plan' },
  })
}
</script>

<template>
  <div ref="liveRoot" class="live-console">
    <header class="hero">
      <div class="hero__signal" :class="state" aria-hidden="true">
        <span v-for="index in 18" :key="index" :style="{ '--i':index }" />
        <i />
      </div>
      <div class="hero__copy">
        <p>LIVE PROJECT · {{ scenarioMeta.code }}</p>
        <h1>{{ localize(scenarioMeta.titleZh, scenarioMeta.titleEn) }}</h1>
        <span>{{ localize(scenarioMeta.detailZh, scenarioMeta.detailEn) }}</span>
      </div>
      <div class="hero__status">
        <CpStatusBadge :tone="statusTone">{{ statusLabel }}</CpStatusBadge>
        <strong>{{ !demoStarted || currentTickNumber === null ? '—' : `Tick ${currentTickNumber}` }}</strong>
        <small>{{ heroDetail }}</small>
      </div>
    </header>

    <section v-if="hasProgressSession && (state === 'waiting' || (!manifest && state !== 'failed'))" class="launch-panel">
      <div class="launch-panel__radar"><i /><i /><i /><b /></div>
      <div>
        <p>PROJECT RUNTIME</p>
        <h2>{{ localize('正在准备现场模拟', 'Preparing the live simulation') }}</h2>
        <span>{{ localize('正在校验人口、论坛、治理分支和公开时间步。', 'Validating the population, forum, governance branches, and public ticks.') }}</span>
      </div>
    </section>

    <section v-if="!hasProgressSession" class="pre-run-world" aria-labelledby="pre-run-world-title">
      <header>
        <div><p>PROJECT AGENT WORLD</p><h2 id="pre-run-world-title">{{ localize('先检查这个项目将运行在哪个社会世界里', 'Inspect the social world before running the project') }}</h2></div>
        <button type="button" @click="openProjectPlan">{{ localize('配置运行计划', 'Configure run plan') }} <i class="fa-solid fa-arrow-right" /></button>
      </header>
      <p>{{ localize('人口、人物资料和合成关系构成可复用的校园 Agent 世界；新项目叠加事件、利益位置、治理方案和运行模式。下方每个节点都可检查，并可保存本项目专属的人物版本。', 'Population, profiles, and synthetic relationships form a reusable campus Agent world. A project adds its event, stakes, governance branches, and run mode. Every node can be inspected and given a project-specific profile release.') }}</p>
      <AgentWorldPanel :project-id="projectId" @open-plan="openProjectPlan" />
    </section>

    <section v-if="manifest && state === 'succeeded' && !demoStarted" class="project-launch" aria-labelledby="project-launch-title">
      <div class="project-launch__radar" aria-hidden="true"><i /><i /><i /><b /></div>
      <div class="project-launch__copy">
        <p>PROJECT READY</p>
        <h2 id="project-launch-title">{{ localize('运行合同已冻结，等待启动', 'Run contract frozen and ready') }}</h2>
        <span>{{ localize(`本次演示连续播放 ${displayTickRange}；到 Tick ${branchForkTick} 后可在“不追加治理回应”（Natural）与“组合治理”（方案 D）之间切换观察。`, `This demo plays ${displayTickRange}; after Tick ${branchForkTick}, switch between No added response (Natural) and Combined governance (Plan D).`) }}</span>
        <ul>
          <li><b>{{ localize('人口', 'Population') }}</b><span>{{ localize('1,000 个异质 LLM Agent', '1,000 heterogeneous LLM Agents') }}</span></li>
          <li><b>{{ localize('论坛', 'Forum') }}</b><span>{{ localize('全局热榜前十 + 最新帖', 'Global hot top 10 + latest posts') }}</span></li>
          <li><b>{{ localize('治理', 'Governance') }}</b><span>{{ localize('证据卡、服务工单、跨群触达', 'Evidence, service tickets, and outreach') }}</span></li>
        </ul>
      </div>
      <button type="button" class="launch-action" @click="startSimulation"><i class="fa-solid fa-play" aria-hidden="true" /> {{ localize('启动模拟', 'Start simulation') }}</button>
    </section>

    <section v-if="demoStarted && selectedTick" class="run-stage" data-cp-motion-tick aria-live="polite">
      <div><p>NOW PROCESSING · T{{ String(selectedTick.tick).padStart(2, '0') }}</p><h2>{{ stageCopy.title }}</h2><span>{{ stageCopy.detail }}</span></div>
      <div v-if="selectedTick.tick >= branchForkTick" class="branch-switch" :aria-label="localize('平行分支', 'Parallel branches')">
        <button type="button" :class="{ active:selectedBranch === 'Natural' }" @click="selectBranch('Natural')">{{ branchLabel('Natural') }}</button>
        <button type="button" :class="{ active:selectedBranch === 'D' }" @click="selectBranch('D')">{{ branchLabel('D') }}</button>
      </div>
      <button v-if="demoCompleted" type="button" class="restart-action" @click="resetSimulation">{{ localize('重新开始', 'Restart') }}</button>
    </section>

    <section v-if="demoStarted && playbackEntries.length" class="timeline" :aria-label="localize('模拟时间步', 'Simulation ticks')">
      <header><div><span>RUN TIMELINE</span><strong>{{ localize(`${displayTickRange} 现场演化`, `Live evolution · ${displayTickRange}`) }}</strong></div><button type="button" class="replay-control" @click="replayPlaying ? stopReplay() : startReplay()">{{ replayPlaying ? localize('暂停运行', 'Pause run') : demoCompleted ? localize('重新播放', 'Replay') : localize('继续运行', 'Continue run') }}</button></header>
      <div class="timeline__rail"><i :style="{ width:`${timelineProgress}%` }" /></div>
      <ol>
        <li v-for="entry in playbackEntries" :key="entry.tick" :class="{ active:entry.tick === selectedTick?.tick }">
          <button type="button" @click="selectEntry(entry)"><span>{{ entry.tick < branchForkTick ? branchLabel(entry.branch) : branchLabel(selectedBranch) }}</span><strong>Tick {{ entry.tick }}</strong></button>
        </li>
      </ol>
    </section>

    <template v-if="demoStarted && selectedTick && publicBranch">
      <section class="runtime-strip" data-cp-motion-tick>
        <div><span>{{ localize('平行分支', 'Parallel branch') }}</span><strong>{{ branchLabel(selectedTick.branch) }}</strong></div>
        <div><span>{{ localize('公开消息', 'Public messages') }}</span><strong>{{ metric.messages }}</strong></div>
        <div><span>{{ localize('直接回复', 'Direct replies') }}</span><strong>{{ metric.replies }}</strong></div>
        <div><span>{{ localize('点赞', 'Likes') }}</span><strong>{{ metric.like }}</strong></div>
        <div><span>{{ localize('转发', 'Reposts') }}</span><strong>{{ metric.repost }}</strong></div>
        <div><span>{{ localize('举报', 'Reports') }}</span><strong>{{ metric.report }}</strong></div>
        <div><span>{{ localize('Provider 新请求', 'New Provider requests') }}</span><strong>{{ usage.provider_calls ?? '—' }}</strong></div>
        <div><span>{{ localize('累计 Token', 'Total tokens') }}</span><strong>{{ typeof usage.total_tokens === 'number' ? usage.total_tokens.toLocaleString('zh-CN') : '—' }}</strong></div>
      </section>

      <ForumWorldRuntimeStage v-if="unifiedWorldFrame" :frame="unifiedWorldFrame" @inspect-node="inspectUnifiedWorldNode" />
      <div v-else class="social-world-loading"><i/><i/><i/><span>{{ localize('正在加载统一 Agent 世界运行帧…', 'Loading the unified Agent-world runtime frame…') }}</span></div>
      <section v-if="false" class="social-world-panel" data-cp-motion-tick aria-labelledby="live-social-world-title">
        <header class="social-world-head">
          <div><span>LIVE AGENT WORLD</span><h2 id="live-social-world-title">{{ localize('校园小世界正在发生什么', 'What is happening inside the campus world') }}</h2><p>{{ localize(`16 个可行动宏观角色被展开为 ${liveMicroNodes.length} 个微角色投影节点。红色双环是本轮真正发言的 LLM，粉色与金色节点分别表示公开 Feed 和私聊触达；触达节点会随 Tick 与分支变化。`, `Sixteen actionable macro roles are expanded into ${liveMicroNodes.length} micro-role projection nodes. Double red rings mark LLM speakers; pink and gold nodes show public-Feed and private-chat reach, changing across Ticks and branches.`) }}</p></div>
          <div class="world-head-controls">
            <div class="world-channel-switch" :aria-label="localize('传播通道', 'Propagation channel')">
              <button type="button" :class="{ active:worldChannel === 'all' }" @click="worldChannel = 'all'">{{ localize('全部', 'All') }}</button>
              <button type="button" :class="{ active:worldChannel === 'public' }" @click="worldChannel = 'public'">{{ localize('公开论坛', 'Public') }}</button>
              <button type="button" :class="{ active:worldChannel === 'private' }" :disabled="!socialWorld" :title="!socialWorld ? localize('本运行尚未发布可展示的私聊聚合帧','No publishable private aggregate frame is available for this run') : ''" @click="worldChannel = 'private'">{{ localize('好友私聊', 'Private') }}</button>
            </div>
            <div class="world-export-actions" :aria-label="localize('导出完整运行快照', 'Export full simulation snapshot')">
              <button type="button" :title="localize('导出完整模拟运行快照 SVG', 'Export the full simulation snapshot as SVG')" @click="exportWorldSvg"><i class="fa-regular fa-file-code" aria-hidden="true" /> SVG</button>
              <button type="button" :title="localize('导出完整模拟运行快照 PNG', 'Export the full simulation snapshot as PNG')" @click="exportWorldPng"><i class="fa-regular fa-image" aria-hidden="true" /> PNG</button>
            </div>
          </div>
        </header>

        <div v-if="worldError" class="social-world-error" role="status"><i class="fa-solid fa-triangle-exclamation" /><span>{{ worldError }}</span><button type="button" @click="loadSocialWorldContext">{{ localize('重新加载', 'Reload') }}</button></div>
        <template v-else-if="agentWorld">
          <div class="world-pulse-strip">
            <div><span>{{ localize('本 Tick 触达节点', 'Nodes reached this Tick') }}</span><strong>{{ activeMicroNodeIds.size }} / {{ liveMicroNodes.length }}</strong><small>{{ localize(`其中 LLM 发言 ${llmMicroNodeIds.size}`, `${llmMicroNodeIds.size} LLM speakers`) }}</small></div>
            <div><span>{{ localize('公开 Feed 触达', 'Public Feed exposures') }}</span><strong>{{ worldPublicExposureCount }}</strong></div>
            <div><span>{{ localize('本 Tick 私聊', 'Private messages this Tick') }}</span><strong>{{ currentWorldFrame?.private_messages_this_tick ?? 0 }}</strong></div>
            <div><span>{{ localize('活跃小群', 'Active group chats') }}</span><strong>{{ currentWorldFrame?.active_group_count ?? 0 }}</strong></div>
            <div><span>{{ localize('治理信息转入私聊', 'Governance forwards') }}</span><strong>{{ currentWorldFrame?.governance_to_private_forwards ?? 0 }}</strong></div>
          </div>

          <div class="live-world-layout">
            <div class="live-world-stage">
              <svg ref="worldSvgRef" viewBox="0 0 820 490" role="img" :aria-label="localize('动态 Agent 关系传播网络', 'Dynamic Agent relationship network')">
                <defs>
                  <radialGradient id="live-node-active"><stop offset="0" stop-color="#ff7c99"/><stop offset="1" stop-color="#bc002d"/></radialGradient>
                  <filter id="live-glow"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <g class="world-macro-clusters" aria-hidden="true">
                  <g v-for="cluster in macroWorldClusters" :key="cluster.role_id">
                    <circle :cx="cluster.x" :cy="cluster.y" :r="cluster.cluster_radius" />
                    <text :x="cluster.x" :y="cluster.y - cluster.cluster_radius - 6" text-anchor="middle">{{ cluster.role_id.slice(-2) }} · {{ cluster.micro_role_count }}</text>
                  </g>
                </g>
                <g class="world-base-edges" aria-hidden="true">
                  <line v-for="edge in backgroundWorldEdges" :key="`${edge.source_role_id}:${edge.target_role_id}`" :x1="edge.sourceNode.x" :y1="edge.sourceNode.y" :x2="edge.targetNode.x" :y2="edge.targetNode.y" />
                </g>
                <g class="world-live-edges">
                  <g v-for="edge in visibleLiveWorldEdges" :key="edge.key" class="live-edge" :class="[edge.channel, { selected:selectedWorldEdgeKey === edge.key }]" role="button" tabindex="0" @click="selectWorldEdge(edge.key)" @keydown.enter="selectWorldEdge(edge.key)">
                    <line class="edge-hit" :x1="edge.sourceNode.x" :y1="edge.sourceNode.y" :x2="edge.targetNode.x" :y2="edge.targetNode.y" />
                    <line class="edge-signal" :x1="edge.sourceNode.x" :y1="edge.sourceNode.y" :x2="edge.targetNode.x" :y2="edge.targetNode.y" :stroke-width="1.3 + 4 * edge.count / maxLiveWorldEdge" />
                    <title>{{ worldChannelLabel(edge.channel) }} · {{ edge.count }}</title>
                  </g>
                </g>
                <g v-for="node in liveMicroNodes" :key="node.node_id" class="live-world-node" :class="{ active:activeMicroNodeIds.has(node.node_id), 'llm-speaker':llmMicroNodeIds.has(node.node_id), 'public-reached':publicReachedMicroNodeIds.has(node.node_id) && worldChannel !== 'private', 'private-reached':privateReachedMicroNodeIds.has(node.node_id) && worldChannel !== 'public', selected:selectedWorldMicroNodeId === node.node_id && !selectedWorldEdge }" role="button" tabindex="0" :data-world-node="node.node_id" @click="selectWorldMicroNode(node)" @keydown.enter="selectWorldMicroNode(node)">
                  <circle v-if="activeMicroNodeIds.has(node.node_id)" class="node-radar" :cx="node.x" :cy="node.y" :r="node.radius + 5" />
                  <circle v-if="llmMicroNodeIds.has(node.node_id) && worldChannel !== 'private'" class="llm-ring llm-ring--outer" :cx="node.x" :cy="node.y" :r="node.radius + 5" />
                  <circle v-if="llmMicroNodeIds.has(node.node_id) && worldChannel !== 'private'" class="llm-ring" :cx="node.x" :cy="node.y" :r="node.radius + 2.5" />
                  <circle class="node-body" :cx="node.x" :cy="node.y" :r="node.radius" />
                  <title>{{ microWorldNodeTitle(node) }}</title>
                </g>
              </svg>
              <div class="world-legend"><span><i class="public"/>{{ localize('公开曝光', 'Public exposure') }}</span><span><i class="private"/>{{ localize('好友/群聊', 'Friend/group chat') }}</span><span><i class="reach"/>{{ localize('触达微角色', 'Reached micro role') }}</span><span><i class="llm"/>{{ localize('LLM 发言', 'LLM speaker') }}</span></div>
            </div>

            <aside class="world-inspector" aria-live="polite">
              <template v-if="selectedWorldEdge">
                <p>{{ worldChannelLabel(selectedWorldEdge.channel) }} · {{ selectedWorldEdge.count }} {{ localize('次连接', 'connections') }}</p>
                <h3>{{ worldRoleLabel(selectedEdgeSourceRole) }} <i class="fa-solid fa-arrow-right" /> {{ worldRoleLabel(selectedEdgeTargetRole) }}</h3>
                <span>{{ localize('点击节点可查看该群体的公开发言与经审阅私聊。', 'Select a node to inspect its public posts and reviewed private excerpts.') }}</span>
              </template>
              <template v-else-if="selectedWorldRole && selectedWorldMicroNode">
                <p>{{ localize('微角色投影节点', 'Micro-role projection') }} · {{ selectedWorldRole.role_id }}-{{ String(selectedWorldMicroNode.micro_index).padStart(2,'0') }}</p>
                <h3>{{ worldMicroRoleLabel(selectedWorldRole,selectedMicroProfile?.micro_role,selectedWorldMicroNode.micro_index) }}</h3>
                <span>{{ selectedMicroStatusLabel }}。{{ localize('节点是匿名微角色投影，不对应源数据中的具体个人。', 'This is an anonymous micro-role projection, not a record-level person from the source data.') }}</span>
                <div class="inspector-stats"><span><b>{{ selectedWorldRole.agent_count }}</b>{{ localize('该角色人口', 'Role population') }}</span><span><b>{{ activeWorldCounts.get(selectedWorldRole.role_id) || 0 }}</b>{{ localize('本 Tick LLM 发言', 'LLM speakers this Tick') }}</span><span><b>{{ selectedWorldMicroNode.micro_index }}/{{ selectedWorldRole.micro_role_count }}</b>{{ localize('微角色序号', 'Micro-role index') }}</span></div>
                <button type="button" class="inspect-agent-button" @click="dossierOpen=true"><i class="fa-solid fa-address-card"/>{{ localize('查看 Profile、Persona、Prompt、记忆与历史', 'View Profile, Persona, Prompt, memory, and history') }}</button>
              </template>

              <section v-if="selectedRolePrivateExcerpts.length" class="inspector-stream private-stream">
                <header><b>{{ localize('好友私聊对话', 'Friend-chat exchange') }}</b><span>REVIEWED</span></header>
                <article v-for="excerpt in selectedRolePrivateExcerpts" :key="excerpt.excerpt_id">
                  <small class="private-route"><b>{{ worldRoleLabel(worldRoleById.get(excerpt.source_role_id)) }}</b><i class="fa-solid fa-arrow-right"/><b>{{ worldRoleLabel(worldRoleById.get(excerpt.target_role_id)) }}</b><span>{{ worldChannelLabel(excerpt.channel) }} · Tick {{ excerpt.tick }}</span></small>
                  <p>{{ localize(excerpt.text_zh, excerpt.text_en) }}</p>
                  <em>{{ excerptMechanismLabel(excerpt.mechanism) }}</em>
                  <div class="private-effect"><b>{{ localize('这段私聊改变了什么', 'What this chat changes') }}</b><span>{{ localize(excerpt.effect_zh, excerpt.effect_en) }}</span></div>
                </article>
              </section>

              <section v-if="selectedRolePublicMessages.length" class="inspector-stream">
                <header><b>{{ localize('关联的公开论坛内容', 'Related public forum content') }}</b><span>LIVE LLM</span></header>
                <article v-for="message in selectedRolePublicMessages" :key="message.message_id"><small>{{ message.source_agent_display_id }} · Tick {{ message.created_tick }}</small><p data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</p><ContentTranslation :text="message.visible_text" /></article>
              </section>

              <div v-if="!selectedRolePublicMessages.length && !selectedRolePrivateExcerpts.length" class="inspector-empty"><i class="fa-solid fa-arrow-pointer"/><span>{{ localize('点击亮起的节点或流动连线，下钻本 Tick 的帖子与对话内容。', 'Select a lit node or moving link to inspect posts and conversations for this Tick.') }}</span></div>
            </aside>
          </div>
          <footer class="world-data-boundary"><span><i class="fa-solid fa-lock"/> {{ localize('网络以聚合曝光映射匿名微角色节点，不公开 Agent 好友边或私聊会话标识；语境不明的背景信号不作为行动节点展示。', 'Aggregate exposure is projected onto anonymous micro-role nodes; Agent-level friend edges and conversation IDs remain private, and ambiguous background signals are not shown as actionable nodes.') }}</span><code>{{ (socialWorld?.content_sha256 || agentWorld.world_sha256).slice(0,10) }}…</code></footer>
        </template>
        <div v-else class="social-world-loading"><i/><i/><i/><span>{{ localize('正在加载固定 Agent 世界与关系帧…', 'Loading the fixed Agent world and relationship frames…') }}</span></div>
      </section>

      <AgentDossierDrawer
        :open="dossierOpen"
        :agent="selectedDossierAgent"
        :live-profile="selectedDossierLiveProfile"
        :scenario-label="localize(scenarioMeta.titleZh,scenarioMeta.titleEn)"
        :branch-label="selectedTick ? branchLabel(selectedTick.branch) : ''"
        :tick="currentTickNumber"
        :status-label="selectedMicroStatusLabel"
        :prompt-hash="selectedDossierPromptHash"
        :events="selectedDossierEvents"
        :related-private-excerpts="selectedDossierPrivateExcerpts"
        :project-id="projectId"
        editable
        @close="dossierOpen=false"
      />

      <div class="console-grid">
        <section class="feed-panel" data-cp-motion-tick>
          <header>
            <div><span>FORUM FEED</span><h2>{{ currentMessages.length ? localize(`Tick ${selectedTick.tick} 新发布`, `New at Tick ${selectedTick.tick}`) : localize('最新论坛动态', 'Latest forum activity') }}</h2></div>
            <small>{{ localize(`${publicBranch.unique_activated_agents ?? '—'} 个 Agent 已激活`, `${publicBranch.unique_activated_agents ?? '—'} Agents activated`) }}</small>
          </header>
          <TransitionGroup name="message" tag="ol">
            <li v-for="message in feedMessages" :key="`${selectedKey}:${message.message_id}`" class="message-card" :class="{ governance:message.action.includes('governance') || message.action === 'service_receipt' }">
              <div class="message-card__meta"><b>{{ message.source_agent_display_id }}</b><span v-if="message.author_visibility === 'anonymous'" class="anonymous-face">{{ localize('小喇叭匿名','Anonymous') }}</span><span>{{ actionLabel(message.action) }}</span><span>Tick {{ message.created_tick }}</span><em>{{ message.provenance?.kind === 'authorized_live_llm' ? 'LIVE LLM' : 'REVIEWED TRACE' }}</em></div>
              <p data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</p>
              <ContentTranslation :text="message.visible_text" />
              <footer>
                <span>{{ isEnglish ? `Replies ${repliesTo(message)}` : `评论 ${repliesTo(message)}` }}</span>
                <span>{{ localize(`赞 ${messageInteractions(message).like}`, `Likes ${messageInteractions(message).like}`) }}</span>
                <span>{{ localize(`转 ${messageInteractions(message).repost}`, `Reposts ${messageInteractions(message).repost}`) }}</span>
                <span>{{ localize(`举报 ${messageInteractions(message).report}`, `Reports ${messageInteractions(message).report}`) }}</span>
              </footer>
            </li>
          </TransitionGroup>
          <div v-if="!feedMessages.length" class="baseline-empty"><i class="fa-solid fa-circle-nodes" aria-hidden="true" /><div><strong>{{ stageCopy.title }}</strong><p>{{ stageCopy.detail }}</p><small>{{ localize('该阶段尚无公开帖子；页面只呈现已提交的真实 LLM / reviewed trace 内容。', 'No public post has been committed at this stage; the page shows only live LLM or reviewed-trace content.') }}</small></div></div>
        </section>

        <aside class="side-stack">
          <section class="hot-panel" data-cp-motion-tick>
            <header><span>GLOBAL HOT TOP 10</span><h2>{{ localize('校园论坛热榜', 'Campus forum leaderboard') }}</h2><small>{{ localize('全体 Agent 看到同一榜单', 'Every Agent sees the same board') }}</small></header>
            <ol>
              <li v-for="(item,index) in hotThreads" :key="item.thread.thread_id">
                <b>{{ String(index + 1).padStart(2,'0') }}</b><div><strong data-content-language="zh" lang="zh-CN">{{ item.thread.need || item.thread.topic }}</strong><small>{{ localize(`${item.messages} 消息 · ${item.thread.reply_count} 回复 · ${item.thread.participant_count} 人`, `${item.messages} messages · ${item.thread.reply_count} replies · ${item.thread.participant_count} participants`) }}</small><i><span :style="{ width:`${item.score / maxHeat * 100}%` }" /></i></div>
              </li>
            </ol>
            <p v-if="!hotThreads.length" class="empty">{{ localize('尚无公开讨论串。', 'No public thread yet.') }}</p>
          </section>

          <section class="governance-panel" data-cp-motion-tick>
            <header><span>GOVERNANCE OBJECTS</span><h2>{{ localize('治理对象与资源动作', 'Governance objects and resources') }}</h2></header>
            <div v-if="publicBranch.governance_artifacts?.length" class="artifact" v-for="(artifact,index) in publicBranch.governance_artifacts" :key="index">
              <strong>{{ artifactKindLabel(artifact.artifact_kind || artifact.artifact_type || artifact.kind, index) }}</strong>
              <span>{{ artifactStatusLabel(artifact.status) }}</span>
            </div>
            <p v-else>{{ localize('该分支当前没有已提交治理对象。', 'No governance object has been committed in this branch.') }}</p>
          </section>

          <section class="integrity-panel">
            <i class="fa-solid fa-shield-halved" aria-hidden="true" />
            <div><strong>{{ localize('运行数据已校验', 'Run data verified') }}</strong><span>{{ localize('运行台只读取已提交的公开时间步；manifest 与每个时间步均验证 SHA-256。', 'The console reads committed public ticks only; the manifest and every tick are SHA-256 verified.') }}</span></div>
          </section>
        </aside>
      </div>
    </template>

    <section v-if="state === 'failed' && !manifest" class="error-panel" role="alert">
      <h2>{{ localize('现场模拟暂不可启动', 'Live simulation is unavailable') }}</h2><p>{{ detail }}</p><button type="button" @click="refresh">{{ localize('重新连接', 'Reconnect') }}</button>
    </section>
  </div>
</template>

<style scoped>
.live-console { display:grid; width:min(100%,var(--cp-content-max)); min-height:100%; gap:var(--cp-space-4); margin:0 auto; padding:var(--cp-space-5) var(--cp-content-gutter) var(--cp-space-8); background:var(--cp-canvas-obsidian); color:var(--cp-text-warm); }
.hero { position:relative; isolation:isolate; display:grid; min-height:15rem; grid-template-columns:12rem minmax(0,1fr) minmax(14rem,20rem); align-items:center; gap:var(--cp-space-6); overflow:hidden; padding:var(--cp-space-6); border:1px solid #2f2929; border-radius:var(--cp-radius-lg); background:radial-gradient(circle at 16% 50%,rgba(174,11,42,.27),transparent 15rem),linear-gradient(125deg,#161414,#231719 58%,#120f10); color:#fff; box-shadow:var(--cp-shadow-floating); }
.hero::after { position:absolute; inset:0; z-index:-1; background:repeating-linear-gradient(90deg,transparent 0 5.9rem,rgba(255,255,255,.018) 6rem),repeating-linear-gradient(0deg,transparent 0 5.9rem,rgba(255,255,255,.018) 6rem); content:''; }
.hero__signal { position:relative; width:10rem; height:10rem; border:1px solid rgba(255,255,255,.08); border-radius:50%; }
.hero__signal::before,.hero__signal::after { position:absolute; inset:15%; border:1px solid rgba(174,11,42,.48); border-radius:50%; content:''; animation:radar-ring 2.6s ease-out infinite; }
.hero__signal::after { inset:32%; animation-delay:.8s; }
.hero__signal > span { --angle:calc(var(--i) * 20deg); position:absolute; top:50%; left:50%; width:.24rem; height:.24rem; border-radius:50%; background:#d9c98e; box-shadow:0 0 .7rem rgba(217,201,142,.75); transform:rotate(var(--angle)) translateX(calc(2.4rem + (var(--i) % 4) * .55rem)); animation:signal-flicker calc(1.7s + var(--i) * 40ms) ease-in-out infinite alternate; }
.hero__signal > i { position:absolute; inset:48%; border-radius:50%; background:#d41438; box-shadow:0 0 1.6rem rgba(212,20,56,.9); }
.hero__copy p,.timeline header span,.feed-panel header span,.hot-panel header span,.governance-panel header span { margin:0; color:#d7c48d; font:800 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.09em; }
.hero__copy h1 { margin:var(--cp-space-2) 0; font-size:clamp(1.8rem,3vw,3rem); line-height:1.08; }
.hero__copy > span { display:block; max-width:52rem; color:#c7c1c0; font-size:var(--cp-text-sm); line-height:1.75; }
.hero__status { display:grid; align-content:center; gap:var(--cp-space-2); padding:var(--cp-space-4); border:1px solid rgba(255,255,255,.1); border-radius:var(--cp-radius-md); background:rgba(255,255,255,.045); backdrop-filter:blur(8px); }
.hero__status strong { font:800 1.8rem/1 var(--cp-font-mono); }
.hero__status small { color:#aaa4a3; line-height:1.55; }
.error-panel button { min-height:var(--cp-control-height); border:1px solid #ba1737; background:#aa0c2b; color:#fff; font-weight:750; cursor:pointer; }
.launch-panel { display:grid; grid-template-columns:8rem minmax(0,1fr) auto; align-items:center; gap:var(--cp-space-5); padding:var(--cp-space-5); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-card); }
.pre-run-world{display:grid;gap:var(--cp-space-4)}.pre-run-world>header{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-4);padding:var(--cp-space-5);border:1px solid var(--cp-border-graphite);border-radius:var(--cp-radius-md);background:var(--cp-surface-charcoal)}.pre-run-world>header p{margin:0 0 var(--cp-space-2);color:var(--cp-action-primary);font:800 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.09em}.pre-run-world>header h2{margin:0;color:var(--cp-text-warm);font-size:var(--cp-text-xl)}.pre-run-world>header button{display:inline-flex;align-items:center;gap:.55rem;min-height:2.7rem;padding:0 var(--cp-space-4);border:1px solid var(--cp-action-primary);background:var(--cp-action-primary);color:#fff;font-weight:760;cursor:pointer}.pre-run-world>header button:focus-visible{outline:2px solid #1687ff;outline-offset:3px}.pre-run-world>p{margin:0;padding:0 var(--cp-space-2);color:var(--cp-text-warm-muted);font-size:var(--cp-text-sm);line-height:1.7}
.project-launch { position:relative; display:grid; grid-template-columns:9rem minmax(0,1fr) auto; align-items:center; gap:var(--cp-space-5); overflow:hidden; padding:var(--cp-space-6); border:1px solid color-mix(in srgb,var(--cp-action-primary) 34%,var(--cp-border-default)); border-radius:var(--cp-radius-lg); background:linear-gradient(120deg,var(--cp-surface-selected),var(--cp-surface-default) 68%); box-shadow:var(--cp-shadow-card); }
.project-launch::after { position:absolute; right:-6rem; bottom:-9rem; width:19rem; height:19rem; border:1px solid color-mix(in srgb,var(--cp-action-primary) 16%,transparent); border-radius:50%; content:''; pointer-events:none; }
.project-launch__radar { position:relative; width:8rem; height:8rem; border:1px solid color-mix(in srgb,var(--cp-action-primary) 22%,var(--cp-border-default)); border-radius:50%; }
.project-launch__radar i { position:absolute; inset:16%; border:1px solid color-mix(in srgb,var(--cp-action-primary) 42%,transparent); border-radius:50%; animation:radar-ring 2.6s ease-out infinite; }.project-launch__radar i:nth-child(2){inset:31%;animation-delay:.7s}.project-launch__radar i:nth-child(3){inset:45%;animation-delay:1.4s}.project-launch__radar b{position:absolute;inset:47%;border-radius:50%;background:var(--cp-action-primary);box-shadow:0 0 1.2rem color-mix(in srgb,var(--cp-action-primary) 60%,transparent)}
.project-launch__copy p,.run-stage p { margin:0; color:var(--cp-action-primary); font:800 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.09em; }.project-launch__copy h2,.run-stage h2{margin:var(--cp-space-2) 0 var(--cp-space-1);font-size:var(--cp-text-xl)}.project-launch__copy>span,.run-stage span{color:var(--cp-text-secondary);font-size:var(--cp-text-sm);line-height:1.65}.project-launch__copy ul{display:flex;flex-wrap:wrap;gap:var(--cp-space-2);margin:var(--cp-space-4) 0 0;padding:0;list-style:none}.project-launch__copy li{display:grid;gap:.2rem;min-width:10rem;padding:var(--cp-space-2) var(--cp-space-3);border-left:2px solid var(--cp-action-primary);background:color-mix(in srgb,var(--cp-surface-default) 72%,transparent)}.project-launch__copy li b{font-size:var(--cp-text-xs)}.project-launch__copy li span{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}
.launch-action,.restart-action{position:relative;z-index:1;display:inline-flex;min-height:3.25rem;align-items:center;justify-content:center;gap:var(--cp-space-2);padding:0 var(--cp-space-5);border:1px solid var(--cp-action-primary);border-radius:var(--cp-radius-sm);background:var(--cp-action-primary);color:var(--cp-surface-default);font-size:var(--cp-text-sm);font-weight:800;cursor:pointer;box-shadow:0 12px 30px color-mix(in srgb,var(--cp-action-primary) 22%,transparent)}
.run-stage{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:var(--cp-space-4);padding:var(--cp-space-4) var(--cp-space-5);border:1px solid var(--cp-border-default);border-left:4px solid var(--cp-action-primary);border-radius:var(--cp-radius-md);background:var(--cp-surface-default);box-shadow:var(--cp-shadow-card)}.branch-switch{display:flex;border:1px solid var(--cp-border-default);border-radius:999px;padding:.2rem;background:var(--cp-surface-subtle)}.branch-switch button{min-height:2.25rem;padding:0 var(--cp-space-3);border:0;border-radius:999px;background:transparent;color:var(--cp-text-secondary);font-size:var(--cp-text-xs);font-weight:750;cursor:pointer}.branch-switch button.active{background:var(--cp-surface-default);color:var(--cp-action-primary);box-shadow:var(--cp-shadow-card)}.restart-action{min-height:2.5rem;padding-inline:var(--cp-space-3);box-shadow:none}
.launch-panel__radar { position:relative; width:7rem; height:7rem; border:1px solid var(--cp-border-default); border-radius:50%; }
.launch-panel__radar i { position:absolute; inset:20%; border:1px solid color-mix(in srgb,var(--cp-action-primary) 28%,transparent); border-radius:50%; animation:radar-ring 2.4s ease-out infinite; }.launch-panel__radar i:nth-child(2){inset:35%;animation-delay:.6s}.launch-panel__radar i:nth-child(3){inset:47%;animation-delay:1.2s}.launch-panel__radar b{position:absolute;inset:47%;border-radius:50%;background:var(--cp-action-primary)}
.launch-panel p { margin:0; color:var(--cp-action-primary); font:800 var(--cp-text-xs)/1 var(--cp-font-mono); }.launch-panel h2{margin:var(--cp-space-1) 0;font-size:var(--cp-text-xl)}.launch-panel span{display:block;color:var(--cp-text-secondary);font-size:var(--cp-text-sm);line-height:1.6}.launch-panel small{display:block;margin-top:var(--cp-space-2);color:var(--cp-text-muted)}
.timeline { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); }
.timeline header { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-4); }.timeline header div{display:grid;gap:.3rem}.timeline header span{color:var(--cp-action-primary)}.timeline header strong{font-size:var(--cp-text-lg)}.replay-control{min-height:var(--cp-control-height);padding:0 var(--cp-space-3);border:1px solid var(--cp-action-primary);background:var(--cp-surface-default);color:var(--cp-action-primary);font-size:var(--cp-text-xs);font-weight:750;cursor:pointer}
.timeline__rail{height:.24rem;background:var(--cp-border-subtle);overflow:hidden}.timeline__rail i{display:block;height:100%;background:linear-gradient(90deg,var(--cp-action-primary),#d7c48d);transition:width .55s ease}
.timeline ol{display:flex;gap:var(--cp-space-2);margin:0;padding:0;overflow-x:auto;list-style:none}.timeline li{flex:none}.timeline button{display:grid;gap:.18rem;min-width:6.4rem;padding:var(--cp-space-2) var(--cp-space-3);border:1px solid var(--cp-border-default);background:var(--cp-surface-default);color:var(--cp-text-primary);text-align:left;cursor:pointer}.timeline li.active button{border-color:var(--cp-action-primary);background:var(--cp-surface-selected)}.timeline button span{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.timeline button strong{font:750 var(--cp-text-sm)/1 var(--cp-font-mono)}
.runtime-strip { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); overflow:hidden; border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); }.runtime-strip div{padding:var(--cp-space-3);border-right:1px solid var(--cp-border-subtle)}.runtime-strip div:last-child{border-right:0}.runtime-strip span{display:block;color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.runtime-strip strong{display:block;margin-top:.25rem;font:800 var(--cp-text-lg)/1 var(--cp-font-mono)}
.social-world-panel{overflow:hidden;border:1px solid #31282b;border-radius:var(--cp-radius-lg);background:#171315;color:#f8f3ef;box-shadow:0 24px 54px rgba(20,10,13,.2)}
.social-world-head{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-5);padding:var(--cp-space-5);border-bottom:1px solid rgba(255,255,255,.1);background:radial-gradient(circle at 8% 15%,rgba(198,0,48,.18),transparent 18rem)}.social-world-head>div:first-child{max-width:60rem}.social-world-head span{color:#e5c77f;font:800 var(--cp-text-xs)/1 var(--cp-font-mono);letter-spacing:.1em}.social-world-head h2{margin:.45rem 0;font-size:clamp(1.45rem,2.5vw,2.25rem);letter-spacing:-.025em}.social-world-head p{margin:0;color:#aaa2a4;font-size:var(--cp-text-sm);line-height:1.65}.world-channel-switch{display:flex;flex:none;padding:.2rem;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.035)}.world-channel-switch button{min-height:2.35rem;padding:0 var(--cp-space-3);border:0;border-radius:999px;background:transparent;color:#aaa2a4;font-size:var(--cp-text-xs);font-weight:750;cursor:pointer}.world-channel-switch button.active{background:#f5eee9;color:#a5002a;box-shadow:0 5px 16px rgba(0,0,0,.24)}
.world-channel-switch button:disabled{cursor:not-allowed;opacity:.38}.world-channel-switch button:disabled.active{background:transparent;color:#aaa2a4;box-shadow:none}
.world-pulse-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-bottom:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025)}.world-pulse-strip>div{padding:var(--cp-space-3) var(--cp-space-4);border-right:1px solid rgba(255,255,255,.08)}.world-pulse-strip>div:last-child{border-right:0}.world-pulse-strip span{display:block;color:#847a7d;font-size:var(--cp-text-xs)}.world-pulse-strip strong{display:block;margin-top:.3rem;color:#fff;font:800 var(--cp-text-lg)/1 var(--cp-font-mono)}
.live-world-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(20rem,.65fr);min-height:36rem}.live-world-stage{position:relative;min-width:0;overflow:hidden;border-right:1px solid rgba(255,255,255,.1);background:radial-gradient(circle at 50% 50%,rgba(187,0,44,.12),transparent 17rem),linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:auto,46px 46px,46px 46px}.live-world-stage svg{display:block;width:100%;height:100%;min-height:36rem}.world-base-edges line{stroke:#655b5e;stroke-width:.7;opacity:.35}.live-edge{cursor:pointer}.edge-hit{stroke:transparent;stroke-width:13}.edge-signal{stroke:#e21c4d;stroke-linecap:round;stroke-dasharray:3 10;filter:url(#live-glow);animation:edge-flow 1.75s linear infinite}.live-edge.private_direct .edge-signal,.live-edge.private_group .edge-signal{stroke:#edc36b;stroke-dasharray:2 7;animation-duration:1.25s}.live-edge.private_group .edge-signal{stroke:#a98ee6}.live-edge.selected .edge-signal{stroke:#fff;stroke-dasharray:5 5}.live-edge:focus .edge-signal{stroke:#72bdff;stroke-width:5}.live-world-node{cursor:pointer}.node-body{fill:#2a2426;stroke:#807477;stroke-width:1.2;transition:fill .2s,stroke .2s,transform .2s}.live-world-node text{fill:#aca2a4;font:750 9px var(--cp-font-mono);pointer-events:none}.live-world-node .node-activation{fill:#7e7376;font-size:8px}.live-world-node.active .node-body{fill:url(#live-node-active);stroke:#ffd6df;filter:url(#live-glow)}.live-world-node.active>text:first-of-type{fill:#fff}.live-world-node.active .node-activation{fill:#efc878}.live-world-node.selected .node-body,.live-world-node:focus .node-body{stroke:#fff;stroke-width:3}.node-radar{fill:none;stroke:#f11d50;stroke-width:1.2;opacity:.55;transform-box:fill-box;transform-origin:center;animation:live-node-pulse 1.65s ease-out infinite}.live-world-center>circle:first-child{fill:#120f10;stroke:#4c3d41;stroke-width:1.2}.live-world-center .center-orbit{fill:none;stroke:#b70030;stroke-dasharray:2 9;opacity:.55;transform-origin:410px 245px;animation:center-orbit 14s linear infinite}.live-world-center text{fill:#fff;font:750 11px var(--cp-font-mono);letter-spacing:.1em}.live-world-center .center-tick{fill:#efc978;font-size:18px;letter-spacing:0}.live-world-center .center-branch{fill:#817679;font-size:8px;letter-spacing:.05em}.world-legend{position:absolute;right:var(--cp-space-3);bottom:var(--cp-space-3);display:flex;flex-wrap:wrap;gap:var(--cp-space-3);padding:.55rem .75rem;border:1px solid rgba(255,255,255,.1);background:rgba(18,15,16,.86);color:#9f9698;font-size:.66rem;backdrop-filter:blur(8px)}.world-legend span{display:flex;align-items:center;gap:.4rem}.world-legend i{display:block;width:1.2rem;height:2px;background:#e21c4d}.world-legend i.private{background:#edc36b}.world-legend i.active{width:.45rem;height:.45rem;border-radius:50%;background:#e21c4d;box-shadow:0 0 .6rem #e21c4d}
.world-pulse-strip small{display:block;margin-top:.3rem;color:#b09b62;font:700 .62rem/1.25 var(--cp-font-mono)}
.world-macro-clusters circle{fill:rgba(255,255,255,.014);stroke:#5a4d50;stroke-width:.8;stroke-dasharray:2 5}.world-macro-clusters text{fill:#817579;font:700 7px var(--cp-font-mono);letter-spacing:.04em}.world-base-edges line{stroke:#5e5356;stroke-width:.6;opacity:.27}.live-world-node .node-body{fill:#2a2426;stroke:#73676a;stroke-width:.8}.live-world-node.active .node-body{filter:url(#live-glow)}.live-world-node.public-reached .node-body{fill:#bf1742;stroke:#ff91aa}.live-world-node.private-reached .node-body{fill:#b88638;stroke:#f2d690}.live-world-node.public-reached.private-reached .node-body{fill:#d25863;stroke:#ffe0a8}.live-world-node.llm-speaker .node-body{fill:#f31a4f;stroke:#fff}.live-world-node.selected .node-body,.live-world-node:focus-visible .node-body{stroke:#72bdff;stroke-width:2.2}.live-world-node.private-reached .node-radar{stroke:#e4b85d}.llm-ring{fill:none;stroke:#fff;stroke-width:1.15;opacity:.9;pointer-events:none}.llm-ring--outer{stroke:#ef174a;stroke-width:1;stroke-dasharray:2 3;animation:center-orbit 4.5s linear infinite;transform-box:fill-box;transform-origin:center}.world-legend i.reach{width:.48rem;height:.48rem;border-radius:50%;background:#d61b49;box-shadow:0 0 .55rem #d61b49}.world-legend i.llm{width:.55rem;height:.55rem;border:2px double #fff;border-radius:50%;background:#f31a4f;box-shadow:0 0 .6rem #e31a49}
.world-inspector{display:grid;align-content:start;gap:var(--cp-space-3);min-width:0;max-height:36rem;overflow:auto;padding:var(--cp-space-4);background:#1d191a}.world-inspector>p{margin:0;color:#e5c77f;font:750 .68rem var(--cp-font-mono);text-transform:uppercase}.world-inspector>h3{margin:0;color:#fff;font-size:var(--cp-text-lg);line-height:1.3}.world-inspector>h3 i{margin-inline:.35rem;color:#b80031;font-size:.7rem}.world-inspector>span{color:#92888a;font-size:var(--cp-text-xs);line-height:1.55}.inspector-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.09)}.inspector-stats span{display:grid;gap:.2rem;padding:.65rem;background:#211c1e;color:#847a7d;font-size:.62rem}.inspector-stats b{color:#fff;font-size:1rem}.inspect-agent-button{display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:2.6rem;padding:0 .7rem;border:1px solid #d2aa50;background:transparent;color:#f0dfb5;font-size:.68rem;font-weight:760;cursor:pointer}.inspect-agent-button:hover{background:rgba(210,170,80,.12)}.inspect-agent-button:focus-visible{outline:2px solid #72bdff;outline-offset:2px}.inspector-stream{display:grid;gap:.55rem}.inspector-stream>header{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding-bottom:.5rem;border-bottom:1px solid rgba(255,255,255,.1)}.inspector-stream header b{font-size:.72rem}.inspector-stream header span{color:#d7bd78;font:700 .6rem var(--cp-font-mono)}.inspector-stream article{display:grid;gap:.35rem;padding:.7rem;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035)}.inspector-stream article small{color:#8d8285;font-size:.6rem}.inspector-stream article p{margin:0;color:#ded7d3;font-size:.75rem;line-height:1.55}.inspector-stream article em{color:#c9a958;font-size:.62rem;font-style:normal}.private-stream article{border-left:2px solid #d8b45e;background:linear-gradient(100deg,rgba(216,180,94,.08),transparent)}.private-route{display:flex;align-items:center;flex-wrap:wrap;gap:.35rem}.private-route b{color:#ece2d4;font-weight:750}.private-route i{color:#bf1740;font-size:.52rem}.private-route span{margin-left:auto;color:#8d8285}.private-effect{display:grid;gap:.2rem;margin-top:.25rem;padding:.48rem .55rem;border-left:2px solid #b7183f;background:rgba(183,24,63,.09)}.private-effect b{color:#f0d7dd;font-size:.62rem}.private-effect span{color:#b8aaad;font-size:.63rem;line-height:1.45}.inspector-empty{display:flex;align-items:flex-start;gap:.7rem;padding:1rem;border:1px dashed rgba(255,255,255,.14);color:#8f8587;font-size:.72rem;line-height:1.55}.inspector-empty i{color:#d7bd78}.world-data-boundary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.7rem var(--cp-space-4);border-top:1px solid rgba(255,255,255,.09);color:#857b7d;font-size:.64rem}.world-data-boundary code{color:#c3a966}.social-world-error,.social-world-loading{display:flex;min-height:12rem;align-items:center;justify-content:center;gap:.65rem;padding:2rem;color:#aea4a6}.social-world-error button{min-height:2.3rem;padding:0 .8rem;border:1px solid #c41843;background:transparent;color:#fff;cursor:pointer}.social-world-loading i{width:.5rem;height:.5rem;border-radius:50%;background:#d11142;animation:world-loading .85s infinite alternate}.social-world-loading i:nth-child(2){animation-delay:.16s}.social-world-loading i:nth-child(3){animation-delay:.32s}.world-channel-switch button:focus-visible,.social-world-error button:focus-visible{outline:2px solid #78bfff;outline-offset:2px}
.console-grid { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(20rem,.75fr); gap:var(--cp-space-4); align-items:start; }.feed-panel,.hot-panel,.governance-panel,.integrity-panel{border:1px solid var(--cp-border-default);border-radius:var(--cp-radius-md);background:var(--cp-surface-default);box-shadow:var(--cp-shadow-card)}.feed-panel>header,.hot-panel>header,.governance-panel>header{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-3);padding:var(--cp-space-4);border-bottom:1px solid var(--cp-border-subtle)}.feed-panel header div,.hot-panel header,.governance-panel header{gap:.35rem}.feed-panel h2,.hot-panel h2,.governance-panel h2{margin:.25rem 0 0;font-size:var(--cp-text-lg)}.feed-panel header>small,.hot-panel header small{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}
.feed-panel ol{display:grid;gap:var(--cp-space-2);margin:0;padding:var(--cp-space-3);list-style:none}.message-card{display:grid;gap:var(--cp-space-2);padding:var(--cp-space-3);border:1px solid var(--cp-border-subtle);border-left:3px solid var(--cp-border-strong);background:var(--cp-surface-default)}.message-card.governance{border-left-color:var(--cp-action-primary);background:var(--cp-surface-selected)}.message-card__meta{display:flex;flex-wrap:wrap;gap:var(--cp-space-2);align-items:center;color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.message-card__meta b{color:var(--cp-action-primary)}.message-card__meta em{margin-left:auto;color:var(--cp-evidence-text);font-style:normal;font-weight:750}.message-card p{margin:0;color:var(--cp-text-primary);font-size:var(--cp-text-sm);line-height:1.65}.message-card footer{display:flex;flex-wrap:wrap;gap:var(--cp-space-3);color:var(--cp-text-muted);font-size:var(--cp-text-xs)}
.message-card__meta .anonymous-face{padding:.2rem .42rem;border:1px solid color-mix(in srgb,var(--cp-action-primary) 38%,var(--cp-border-default));border-radius:999px;background:var(--cp-surface-selected);color:var(--cp-action-primary);font-weight:760}
.baseline-empty{display:flex;min-height:18rem;align-items:center;justify-content:center;gap:var(--cp-space-4);padding:var(--cp-space-6);text-align:left}.baseline-empty>i{display:grid;width:4rem;height:4rem;place-items:center;border:1px solid color-mix(in srgb,var(--cp-action-primary) 28%,var(--cp-border-default));border-radius:50%;color:var(--cp-action-primary);font-size:var(--cp-text-xl)}.baseline-empty>div{display:grid;gap:.35rem;max-width:30rem}.baseline-empty strong{font-size:var(--cp-text-lg)}.baseline-empty p{margin:0;color:var(--cp-text-secondary);font-size:var(--cp-text-sm);line-height:1.6}.baseline-empty small{color:var(--cp-text-muted)}
.message-enter-active{animation:message-arrival .46s cubic-bezier(.2,.75,.25,1)}.message-leave-active{transition:opacity .2s}.message-leave-to{opacity:0}.side-stack{display:grid;gap:var(--cp-space-4)}.hot-panel ol{display:grid;gap:0;margin:0;padding:var(--cp-space-2) var(--cp-space-3);list-style:none}.hot-panel li{display:grid;grid-template-columns:2rem minmax(0,1fr);gap:var(--cp-space-2);padding:var(--cp-space-2) 0;border-bottom:1px solid var(--cp-border-subtle)}.hot-panel li:last-child{border-bottom:0}.hot-panel li>b{color:var(--cp-action-primary);font:800 var(--cp-text-sm)/1.4 var(--cp-font-mono)}.hot-panel li div{display:grid;gap:.25rem}.hot-panel li strong{font-size:var(--cp-text-sm)}.hot-panel li small{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.hot-panel li i{height:.2rem;background:var(--cp-border-subtle)}.hot-panel li i span{display:block;height:100%;background:linear-gradient(90deg,var(--cp-action-primary),#d7c48d);transition:width .6s ease}
.governance-panel{padding-bottom:var(--cp-space-3)}.governance-panel>p,.empty{margin:0;padding:var(--cp-space-4);color:var(--cp-text-muted);font-size:var(--cp-text-sm)}.artifact{display:flex;justify-content:space-between;gap:var(--cp-space-3);margin:var(--cp-space-3) var(--cp-space-3) 0;padding:var(--cp-space-3);border-left:3px solid var(--cp-action-primary);background:var(--cp-surface-selected);font-size:var(--cp-text-sm)}.artifact span{color:var(--cp-text-muted)}.integrity-panel{display:flex;gap:var(--cp-space-3);padding:var(--cp-space-4);color:var(--cp-evidence-text);background:var(--cp-evidence-surface)}.integrity-panel i{font-size:var(--cp-text-xl)}.integrity-panel div{display:grid;gap:.25rem}.integrity-panel span{font-size:var(--cp-text-xs);line-height:1.55}.error-panel{padding:var(--cp-space-5);border:1px solid var(--cp-danger);background:var(--cp-danger-surface);color:var(--cp-danger)}.error-panel h2,.error-panel p{margin:0 0 var(--cp-space-3)}
@keyframes radar-ring{0%{opacity:.9;transform:scale(.45)}100%{opacity:0;transform:scale(1.35)}}@keyframes signal-flicker{from{opacity:.35;transform:rotate(var(--angle)) translateX(calc(2.4rem + (var(--i) % 4) * .55rem)) scale(.8)}to{opacity:1;transform:rotate(var(--angle)) translateX(calc(2.4rem + (var(--i) % 4) * .55rem)) scale(1.35)}}@keyframes message-arrival{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}@keyframes edge-flow{to{stroke-dashoffset:-52}}@keyframes live-node-pulse{0%{opacity:.75;transform:scale(.78)}100%{opacity:0;transform:scale(1.35)}}@keyframes center-orbit{to{transform:rotate(360deg)}}@keyframes world-loading{to{opacity:.25;transform:translateY(-.35rem)}}
@media(max-width:1100px){.hero{grid-template-columns:8rem minmax(0,1fr)}.hero__signal{width:7rem;height:7rem}.hero__status{grid-column:1/-1}.runtime-strip{grid-template-columns:repeat(4,minmax(0,1fr))}.console-grid{grid-template-columns:1fr}.launch-panel{grid-template-columns:6rem 1fr}.project-launch{grid-template-columns:7rem minmax(0,1fr)}.project-launch__radar{width:6rem;height:6rem}.launch-action{grid-column:1/-1;justify-self:start}.run-stage{grid-template-columns:1fr auto}.branch-switch{grid-column:1/-1;justify-self:start}.live-world-layout{grid-template-columns:1fr}.live-world-stage{border-right:0;border-bottom:1px solid rgba(255,255,255,.1)}.world-inspector{max-height:none}.world-pulse-strip{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:680px){.live-console{padding:var(--cp-space-4)}.hero{grid-template-columns:1fr;padding:var(--cp-space-5)}.hero__signal{display:none}.launch-panel,.project-launch{grid-template-columns:1fr}.launch-panel__radar,.project-launch__radar{display:none}.runtime-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.timeline header{align-items:flex-start;flex-direction:column}.feed-panel>header,.hot-panel>header{align-items:flex-start;flex-direction:column}.run-stage{grid-template-columns:1fr}.branch-switch{grid-column:auto;max-width:100%}.restart-action{justify-self:start}.baseline-empty{align-items:flex-start;flex-direction:column}.social-world-head{align-items:flex-start;flex-direction:column}.world-channel-switch{width:100%}.world-channel-switch button{flex:1;padding-inline:.5rem}.world-pulse-strip{grid-template-columns:1fr 1fr}.live-world-stage{height:27rem}.live-world-stage svg{width:45rem;max-width:none;min-height:27rem;transform:translateX(calc((100vw - 45rem)/2 - 1rem))}.world-legend{right:.5rem;bottom:.5rem;left:.5rem}.world-data-boundary{align-items:flex-start;flex-direction:column}.inspector-stats{grid-template-columns:1fr 1fr 1fr}}
@media(max-width:680px){.live-console{width:100%;max-width:100%;min-width:0;overflow-x:clip}.live-console>*{max-width:100%;min-width:0}}
@media(prefers-reduced-motion:reduce){.hero__signal::before,.hero__signal::after,.hero__signal>span,.launch-panel__radar i,.project-launch__radar i,.message-enter-active,.edge-signal,.node-radar,.center-orbit,.llm-ring--outer,.social-world-loading i{animation:none}.timeline__rail i,.hot-panel li i span{transition:none}}
/* Report-ready network view: white canvas, restrained graphite base graph, coloured live channels. */
.social-world-panel{border-color:#d9dee4;background:#fff;color:#13181e;box-shadow:0 18px 42px rgba(28,36,44,.10)}
.social-world-head{border-bottom-color:#e4e8ec;background:#fff}
.social-world-head span{color:#a20d36}
.social-world-head p{color:#596570}
.world-head-controls{display:flex;flex-direction:column;align-items:flex-end;gap:.55rem;flex:none}
.world-channel-switch{border-color:#cfd5db;background:#f6f8fa}
.world-channel-switch button{color:#5e6975}
.world-channel-switch button.active{background:#13191f;color:#fff;box-shadow:0 4px 12px rgba(20,28,36,.18)}
.world-export-actions{display:flex;gap:.4rem}
.world-export-actions button{display:inline-flex;align-items:center;gap:.35rem;min-height:2rem;padding:0 .65rem;border:1px solid #c5ccd3;border-radius:4px;background:#fff;color:#303a44;font:700 .68rem var(--cp-font-mono);cursor:pointer}
.world-export-actions button:hover{border-color:#b30f3c;color:#a20d36;background:#fff7f8}
.world-export-actions button:focus-visible,.world-channel-switch button:focus-visible{outline:2px solid #1677c8;outline-offset:2px}
.world-pulse-strip{border-bottom-color:#e3e7eb;background:#fff}
.world-pulse-strip>div{border-right-color:#e3e7eb}
.world-pulse-strip span{color:#66727e}
.world-pulse-strip strong{color:#141a21}
.world-pulse-strip small{color:#9d7619}
.live-world-stage{border-right-color:#e1e5e9;background:#fff}
.world-base-edges line{stroke:#9ca5ae;stroke-width:.65;opacity:.72}
.world-macro-clusters circle{fill:none;stroke:#c8ced5;stroke-width:.8;stroke-dasharray:2 5}
.world-macro-clusters text{fill:#66717c}
.edge-signal{stroke:#d51b49;stroke-linecap:round;stroke-dasharray:3 10;filter:none}
.live-edge.private_direct .edge-signal{stroke:#a77914;stroke-dasharray:2 7}
.live-edge.private_group .edge-signal{stroke:#6e56b0;stroke-dasharray:2 7}
.live-edge.selected .edge-signal{stroke:#111820;stroke-dasharray:none;filter:none}
.live-edge:focus .edge-signal{stroke:#1677c8;stroke-width:3}
.live-world-node .node-body{fill:#fff;stroke:#69727d;stroke-width:.9}
.live-world-node text{fill:#29313a}
.live-world-node.active .node-body{filter:none}
.live-world-node.public-reached .node-body{fill:#fff4f7;stroke:#d51b49}
.live-world-node.private-reached .node-body{fill:#fff9e8;stroke:#a77914}
.live-world-node.public-reached.private-reached .node-body{fill:#fff1f0;stroke:#bd4c55}
.live-world-node.llm-speaker .node-body{fill:#d51b49;stroke:#fff}
.live-world-node.selected .node-body,.live-world-node:focus-visible .node-body{stroke:#111820;stroke-width:2.2}
.node-radar{stroke:#d51b49}
.live-world-node.private-reached .node-radar{stroke:#a77914}
.llm-ring{stroke:#d51b49}
.llm-ring--outer{stroke:#d51b49}
.world-legend{border-color:#d5dbe1;background:rgba(255,255,255,.96);color:#56616c;box-shadow:0 5px 18px rgba(34,42,50,.10);backdrop-filter:none}
.world-legend i{background:#d51b49}
.world-legend i.private{background:#a77914}
.world-legend i.reach{background:#d51b49;box-shadow:none}
.world-legend i.llm{border-color:#fff;background:#d51b49;box-shadow:none}
.world-inspector{background:#fff;border-left:1px solid #e1e5e9}
.world-inspector>p{color:#a20d36}
.world-inspector>h3{color:#141a21}
.world-inspector>h3 i{color:#a20d36}
.world-inspector>span{color:#5e6975}
.inspector-stats{background:#e0e5e9}
.inspector-stats span{background:#f8fafb;color:#66717c}
.inspector-stats b{color:#141a21}
.inspect-agent-button{border-color:#b68a26;color:#886810;background:#fff}
.inspect-agent-button:hover{background:#fff8e6}
.inspector-stream>header{border-bottom-color:#e1e5e9}
.inspector-stream article{border-color:#e1e5e9;background:#f8fafb}
.inspector-stream article small{color:#68747e}
.inspector-stream article p{color:#27313a}
.private-stream article{border-left-color:#b68a26;background:#fffaf0}
.private-route b{color:#2b343d}
.private-route i{color:#a20d36}
.private-effect{border-left-color:#a20d36;background:#fff2f4}
.private-effect b{color:#7e1932}
.private-effect span{color:#596570}
.inspector-empty{border-color:#cbd2d9;color:#697580}
.inspector-empty i{color:#a47b19}
.world-data-boundary{border-top-color:#e1e5e9;color:#697580;background:#fff}
.world-data-boundary code{color:#8e6e1b}
.social-world-error,.social-world-loading{color:#5e6975}
.world-channel-switch button:disabled.active{color:#5e6975}
.live-world-center{display:none!important}
@media(max-width:680px){.world-head-controls{width:100%;align-items:stretch}.world-channel-switch,.world-export-actions{width:100%}.world-export-actions button{flex:1;justify-content:center}}
</style>
