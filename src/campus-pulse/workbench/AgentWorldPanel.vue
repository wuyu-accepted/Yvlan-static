<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getForumTwinV2AgentDossier, getForumTwinV2AgentWorld, readableApiError } from '../../services/campusPulseApi.js'
import { currentLocale } from '../i18n/locale.ts'
import AgentDossierDrawer from '../agent-world/AgentDossierDrawer.vue'
import { AGENT_ROLE_NAMES_EN, agentMicroRoleLabel, agentRoleLabel } from '../agent-world/agentWorldLabels.ts'
import type { PublicAgentDossier, PublicAgentWorldNode } from '../agent-world/types.ts'
import ForumWorldRuntimeStage from '../agent-world/ForumWorldRuntimeStage.vue'
import { examplePrivateDialogue } from '../agent-world/examplePrivateDialogue.ts'
import type { ForumWorldRuntimeFrame, ForumWorldRuntimeNode } from '../agent-world/forumWorldRuntime.ts'

type RuntimeEventProjection = { sequence:number; kind:string; message:string; payload?:Record<string,unknown> }
const props = withDefaults(defineProps<{
  projectId?: string
  variant?: 'overview' | 'runtime'
  runtimeTick?: number | null
  runtimeStatus?: string
  runtimeBranchLabel?: string
  runtimeEvents?: RuntimeEventProjection[]
  runtimeTurnsCompleted?: number | null
  runtimeTurnsReserved?: number | null
  runtimeScenarioId?: string
  runtimePrivateExcerpts?: Array<{ excerpt_id?: string; branch?: string; tick?: number; channel?: string; source_role_id?: string; target_role_id?: string; text_zh?: string; text_en?: string; effect_zh?: string; effect_en?: string }>
}>(), {
  projectId: '',
  variant: 'overview',
  runtimeTick: null,
  runtimeStatus: '',
  runtimeBranchLabel: '',
  runtimeEvents: () => [],
  runtimeTurnsCompleted: null,
  runtimeTurnsReserved: null,
  runtimePrivateExcerpts: () => [],
})

type RoleSummary = {
  role_id: string
  label: string
  agent_count: number
  population_share: number
  micro_role_count: number
  anchor_eligible: boolean
  mean_attention_budget: number
  top_topics: string[]
  top_needs: string[]
}

type RelationshipRow = {
  source_role_id: string
  target_role_id: string
  relation_type: 'close_friend' | 'familiar_peer' | 'cross_group_acquaintance'
  directed_edge_count: number
}

type StakeScenario = {
  scenario_id: string
  position_count: number
  directly_affected_share: number
  mean_dimensions: Record<string, number>
}

type AgentWorld = {
  schema_version: string
  world_sha256: string
  population: {
    agent_count: number
    particle_count: number
    macro_role_count: number
    micro_role_count: number
    micro_role_pool_count: number
    represented_micro_role_count: number
    profile_bundle_count: number
    fixed_across_projects: boolean
    roles: RoleSummary[]
    display_nodes: PublicAgentWorldNode[]
    representative_agents: PublicAgentDossier[]
  }
  relationships: {
    directed_edge_count: number
    degree_per_agent: Record<string, number>
    relation_type_counts: Record<string, number>
    aggregate_matrix: RelationshipRow[]
    record_level_edges_public: boolean
    fully_synthetic: boolean
  }
  stakes: { scenarios: StakeScenario[] }
  activation: {
    algorithm_id: string
    modes: string[]
    anchors_per_budgeted_tick: number
    budget_schedule: number[]
    interaction_priority: string[]
    pps_factors: string[]
    private_origin_share_of_non_anchor_slots_max: number
    full_population_uses_two_phase_commit: boolean
  }
  channels: {
    public_forum: { optional_anonymous_author_face:boolean }
    private: { direct_chat:boolean; dynamic_groups:boolean }
    service_desk: { auditable_tickets:boolean }
  }
  visibility_harness: {
    channels:string[]
    public_anonymity:{ enabled:boolean; semantics:string }
    cross_channel_risk_signals:string[]
    governance_reads_private_or_anonymous_authors:boolean
  }
  risk_signals: string[]
  governance_actors: string[]
}

const emit = defineEmits<{ openPlan: []; inspectContent: [] }>()

const ACTIVATION_ALGORITHM_ID = 'visibility-priority-rotation-pps-v3'

const loading = ref(false)
const error = ref('')
const world = ref<AgentWorld | null>(null)
const selectedRoleId = ref('')
const selectedScenarioId = ref('governance_legitimacy_dispute')
const selectedTick = ref(3)
const activationMode = ref<'budgeted_pps' | 'full_population_keyframes' | 'full_population_every_tick'>('budgeted_pps')
const relationTypes = ref(new Set<RelationshipRow['relation_type']>(['close_friend', 'familiar_peer', 'cross_group_acquaintance']))
const dossierOpen = ref(false)
const selectedAgentId = ref('')
const selectedAgentDossier = ref<PublicAgentDossier | null>(null)
const dossierLoading = ref(false)
const selectedRelationshipEdgeId = ref('')

const isEnglish = computed(() => currentLocale.value === 'en-US')
const copy = computed(() => isEnglish.value ? {
  eyebrow: 'FIXED AGENT WORLD',
  title: 'A living campus population behind every simulation',
  intro: 'Profiles and synthetic relationships remain stable. Each new project injects an event, chooses an activation budget, and observes how public discussion, private conversations, risk and governance evolve.',
  fixed: 'Fixed population release', agents: 'LLM Agents', particles: 'state particles', roles: 'macro roles', micro: 'micro-role pool', represented: 'represented', edges: 'synthetic ties',
  network: 'Population & relationship field', networkNote: 'All 1,000 Agent nodes · aggregate relationship field · no record-level friend edge',
  close: 'close friends', familiar: 'familiar peers', cross: 'cross-group ties',
  selected: 'Selected population group', people: 'Agents', microRoles: 'micro roles', attention: 'mean attention budget', topics: 'Topic portfolio', needs: 'Need portfolio',
  activation: 'Activation scheduler', preview: 'Pre-run schedule preview', tick: 'Tick', mode: 'Run mode', active: 'activated this tick', queueNote: 'At runtime, direct replies, corrections, service receipts, risk/help signals and private inboxes override this baseline projection before stratified PPS fills the remaining slots.',
  budgeted: 'Budgeted multi-policy', keyframes: 'Full-population keyframes', full: 'Full population every tick',
  stage1: '16 longitudinal anchors', stage2: 'priority interaction queue', stage3: 'rotating stratified PPS',
  configure: 'Configure a run',
  stake: 'Scenario stake structure', affected: 'directly affected', positions: 'synthetic positions',
  channels: 'Social Visibility Harness', publicForum: 'Public forum · named or anonymous', publicDesc: 'One global Top 10 + latest posts. A resident may hide their author face for sensitive speech without leaving the normal thread.', privateChat: 'Friend chat & dynamic groups', privateDesc: 'Friends can reinterpret, speculate, challenge, and return a private claim to the public forum.', serviceDesk:'Auditable service desk', serviceDesc:'Help requests become tickets, SLA states, evidence cards, and receipts rather than a generic reassurance.', governance: 'Limited-observation governance', governanceDesc: 'Authority, service operator and community bridge see different aggregates, never raw private chats or anonymous author identity.',
  risks: 'Seven explainable risk signals', riskNote: 'Reported separately at every Tick; the system does not hide them inside one opaque score.',
  retry: 'Retry', unavailable: 'The Agent world release could not be loaded.', hash: 'World release', census: '1,000 census', activated: 'activated', background: 'background', agentsInRole:'Living Agents in this role', openDossier:'Open complete dossier', dossierNote:'Agent profile · Prompt · Memory · History', inspectable:'inspectable living Agents', projected:'projected activation', loadingDossier:'Loading dossier…', particleHalo:'halo = ten-particle state uncertainty',
} : {
  eyebrow: '固定 AGENT 世界',
  title: '每次推演，都从同一座“活着的校园”开始',
  intro: '人口 Profile 与合成关系长期存在；新建项目只注入事件、选择激活预算，再观察公开讨论、好友私聊、风险和治理如何共同演化。',
  fixed: '固定人口', agents: 'LLM Agent', particles: '状态粒子', roles: '宏观角色', micro: '微角色池', represented: '实际覆盖', edges: '合成关系',
  network: '人口与关系场', networkNote: '完整 1,000 Agent 节点 · 宏观关系聚合 · 不公开记录级好友边',
  close: '好友', familiar: '熟人', cross: '跨群联系人',
  selected: '当前人口群体', people: 'Agent', microRoles: '个微角色', attention: '平均注意力预算', topics: '关注议题', needs: '利益诉求',
  activation: '节点激活调度器', preview: '运行前调度预演', tick: '时间步', mode: '运行模式', active: '本 Tick 激活', queueNote: '真实运行时，直接回复、纠错、服务回执、风险/求助和私聊收件箱会先覆盖本基线预演，剩余名额再由分层轮换 PPS 补齐。',
  budgeted: '预算化多方案', keyframes: '全量关键帧', full: '全量逐 Tick',
  stage1: '16 个纵向锚点', stage2: '优先互动队列', stage3: '分层轮换 PPS',
  configure: '去配置运行',
  stake: '场景利益结构', affected: '直接受影响', positions: '个合成利益位置',
  channels: '社会可见性 Harness', publicForum: '公开论坛 · 可实名/匿名', publicDesc: '全员共享热榜前十和最新帖。遇到敏感、严重或怕熟人认出的话题，Agent 可以在同一讨论串中匿名发帖/回复。', privateChat: '好友私聊与动态小群', privateDesc: '好友可以转述、猜测、质疑，也可把私聊 Claim 重新带回公开论坛。', serviceDesk:'可审计服务台', serviceDesc:'求助被转为工单、SLA、证据卡和服务回执，不只是一句泛化的“已关注”。', governance: '有限观测治理', governanceDesc: '管理、服务与桥接主体各看不同聚合信号，既不能读取私聊原文，也看不到匿名发言者身份。',
  risks: '七类可解释风险信号', riskNote: '每个 Tick 分开报告，不把风险藏进一个不可解释的总分。',
  retry: '重试', unavailable: 'Agent 世界加载失败，请重试。', hash: '世界版本', census: '1,000 人全量', activated: '已激活', background: '后台状态', agentsInRole:'这个角色中的活 Agent', openDossier:'打开完整档案', dossierNote:'人物资料 · Prompt · 记忆 · 历史', inspectable:'个可检查的活 Agent', projected:'调度预演激活', loadingDossier:'正在读取档案…', particleHalo:'光晕 = 10 个状态粒子的不确定性',
})

const roleNamesEn = AGENT_ROLE_NAMES_EN

const dataLabelsEn: Record<string, string> = {
  '选课': 'Course selection', '课程评价': 'Course reviews', '课程规则': 'Course rules',
  '学习资料': 'Learning resources', '教师评价': 'Instructor reviews', '学习方法': 'Study methods',
  '校园服务': 'Campus services', '校园设施': 'Campus facilities', '图书馆': 'Library',
  '投诉': 'Complaints', '网络服务': 'Network services', '校园系统': 'Campus systems',
  '实习': 'Internships', '职业发展': 'Career development', '保研': 'Graduate recommendation',
  '招聘': 'Recruitment', '学生助理': 'Student assistant work', '短期工作': 'Short-term work',
  '校园生活': 'Campus life', '消费推荐': 'Purchase recommendations', '居住体验': 'Residential experience',
  '交易': 'Marketplace', '有偿服务': 'Paid services', '推广': 'Promotion', '限时点券': 'Limited-time rewards',
  '游戏活动': 'Gaming events', '社交': 'Social connection', '恋爱': 'Relationships', '社交匹配': 'Peer matching',
  '有偿求助': 'Paid help request', '求购': 'Purchase request', '恋爱关系': 'Romantic relationships',
  '表白': 'Confession', '道德': 'Norms', '情绪宣泄': 'Emotional venting', '情绪': 'Emotion',
  '学业压力': 'Academic stress', '公共讨论': 'Public discussion', '不文明行为': 'Uncivil conduct',
  '公共规范': 'Public norms', '美食': 'Food', '成绩分享': 'Grade sharing', '语境不明': 'Ambiguous context',
  '情绪表达': 'Emotional expression', '求助': 'Help seeking', '心理健康': 'Mental health',
  '健康': 'Health', '北京医疗资源': 'Beijing healthcare resources',
  '信息获取': 'Information access', '信息确认': 'Information verification', '规则确认': 'Rule clarification',
  '经验分享': 'Experience sharing', '考试准备': 'Exam preparation', '信息查询': 'Information search',
  '表达不满': 'Express dissatisfaction', '职业建议': 'Career advice',
  '招募': 'Recruitment', '招募参与者': 'Recruit participants', '分享信息': 'Share information',
  '价格参考': 'Price reference', '完成交易': 'Complete a transaction', '出售': 'Sell',
  '获取奖励': 'Obtain rewards', '寻找同伴': 'Find peers', '社交陪伴': 'Social companionship',
  '社交归属': 'Sense of belonging', '资源获取': 'Resource access', '获取学习资料': 'Obtain learning resources',
  '获得建议': 'Receive advice', '获得理解': 'Be understood', '情感支持': 'Emotional support',
  '情感宣泄': 'Emotional release', '寻求共鸣': 'Seek resonance', '寻求认同': 'Seek recognition',
  '表达观点': 'Express a view', '分享体验': 'Share experience', '情感表达': 'Express emotion',
  '获得回应': 'Receive a response', '表达': 'Expression',
}

const scenarioNames = computed<Record<string, string>>(() => isEnglish.value ? {
  governance_legitimacy_dispute: 'Resource-allocation legitimacy', century_gym_ghost_booking_dispute: 'Century Gym ghost booking', lecture_external_incident_shock: 'Lecture external incident',
} : {
  governance_legitimacy_dispute: '资源分配正当性争议', century_gym_ghost_booking_dispute: '世纪馆“幽灵预约”', lecture_external_incident_shock: '讲座外部事件',
})

const dimensionNames = computed<Record<string, string>>(() => isEnglish.value ? {
  resource_need_intensity: 'Resource need', eligibility_material_completeness: 'Eligibility completeness', time_urgency: 'Time urgency', service_channel_dependency: 'Service dependence', information_access_capacity: 'Information access', appeal_cost: 'Appeal cost', substitute_resource_availability: 'Substitutes', usage_frequency: 'Usage frequency', historical_service_experience: 'Service experience', bridge_organizing_care_responsibility: 'Bridge responsibility',
} : {
  resource_need_intensity: '资源需求', eligibility_material_completeness: '材料完整度', time_urgency: '时间紧迫性', service_channel_dependency: '服务渠道依赖', information_access_capacity: '信息获取能力', appeal_cost: '申诉成本', substitute_resource_availability: '替代资源', usage_frequency: '使用频率', historical_service_experience: '历史服务体验', bridge_organizing_care_responsibility: '桥接与照护责任',
})

const riskNames = computed<Record<string, string>>(() => isEnglish.value ? {
  unsupported_claim_velocity: 'Unsupported-claim velocity', private_to_public_spillover: 'Private-to-public spillover', contested_claim_share: 'Contested-claim share', cross_group_exposure_gap: 'Cross-group exposure gap', correction_penetration_and_delay: 'Correction penetration & delay', help_backlog_and_sla_breach: 'Help backlog & SLA breach', governance_observation_gap: 'Governance observation gap',
} : {
  unsupported_claim_velocity: '无依据 Claim 增速', private_to_public_spillover: '私聊回流公开论坛', contested_claim_share: '争议 Claim 占比', cross_group_exposure_gap: '跨群曝光缺口', correction_penetration_and_delay: '纠错穿透与延迟', help_backlog_and_sla_breach: '求助积压与 SLA', governance_observation_gap: '治理观测差',
})

async function loadWorld() {
  loading.value = true
  error.value = ''
  try {
    const payload = await getForumTwinV2AgentWorld()
    if (!payload || payload.schema_version !== 'campus-pulse-forum-agent-world-public-v1') throw new Error('Agent world schema mismatch')
    if (payload.activation?.algorithm_id !== ACTIVATION_ALGORITHM_ID) throw new Error('Activation algorithm release mismatch')
    world.value = payload as AgentWorld
    if (!selectedRoleId.value) selectedRoleId.value = payload.population.roles[0]?.role_id || ''
    if (!selectedAgentId.value) {
      selectedAgentId.value = payload.population.display_nodes.find((item:PublicAgentWorldNode) => item.role_id === selectedRoleId.value)?.display_id || ''
    }
    if (!payload.stakes.scenarios.some((item: StakeScenario) => item.scenario_id === selectedScenarioId.value)) {
      selectedScenarioId.value = payload.stakes.scenarios[0]?.scenario_id || ''
    }
  } catch (cause) {
    error.value = readableApiError(cause)
  } finally {
    loading.value = false
  }
}

const selectedRole = computed(() => world.value?.population.roles.find((role) => role.role_id === selectedRoleId.value) || null)
const selectedRoleAgents = computed(() => (world.value?.population.display_nodes || []).filter((agent) => agent.role_id === selectedRoleId.value))
const visibleSelectedRoleAgents = computed(() => selectedRoleAgents.value.slice(0, 30))
const selectedAgent = computed(() => selectedAgentDossier.value || world.value?.population.representative_agents.find((agent) => agent.display_id === selectedAgentId.value) || null)
const selectedScenario = computed(() => world.value?.stakes.scenarios.find((scenario) => scenario.scenario_id === selectedScenarioId.value) || null)
const effectiveTick = computed(() => props.runtimeTick === null ? selectedTick.value : Math.max(0, Math.min(23, props.runtimeTick)))
const currentBudget = computed(() => {
  if (!world.value) return 0
  if (activationMode.value === 'full_population_every_tick') return world.value.population.agent_count
  if (activationMode.value === 'full_population_keyframes' && [3, 7, 13, 19].includes(effectiveTick.value)) return world.value.population.agent_count
  return world.value.activation.budget_schedule[effectiveTick.value] ?? 0
})

const roleNodes = computed(() => {
  const roles = world.value?.population.roles ?? []
  const maxCount = Math.max(...roles.map((role) => role.agent_count), 1)
  return roles.map((role, index) => {
    const angle = (-Math.PI / 2) + index * (Math.PI * 2 / roles.length)
    return {
      ...role,
      x: 450 + Math.cos(angle) * 330,
      y: 270 + Math.sin(angle) * 205,
      radius: 12 + 18 * Math.sqrt(role.agent_count / maxCount),
    }
  })
})
const nodeById = computed(() => new Map(roleNodes.value.map((node) => [node.role_id, node])))

function stableHash(value:string):number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const agentNodes = computed(() => {
  const population = world.value?.population.display_nodes ?? []
  const grouped = new Map<string, PublicAgentWorldNode[]>()
  for (const agent of population) {
    const values = grouped.get(agent.role_id) ?? []
    values.push(agent)
    grouped.set(agent.role_id, values)
  }
  return roleNodes.value.flatMap((role) => {
    const values = (grouped.get(role.role_id) ?? []).sort((left, right) => left.display_id.localeCompare(right.display_id))
    return values.map((agent, index) => {
      const angle = ((stableHash(agent.display_id) / 0xffffffff) * Math.PI * 2) + index * 2.3999632297
      const ring = role.radius + 8 + 42 * Math.sqrt((index + .5) / Math.max(1, values.length))
      return { agent, x: role.x + Math.cos(angle) * ring, y: role.y + Math.sin(angle) * ring }
    })
  })
})

const activeCounts = computed(() => {
  const roles = world.value?.population.roles ?? []
  const budget = currentBudget.value
  const counts = new Map(roles.map((role) => [role.role_id, 0]))
  if (!roles.length || !budget) return counts
  if (budget >= (world.value?.population.agent_count ?? 0)) {
    for (const role of roles) counts.set(role.role_id, role.agent_count)
    return counts
  }
  const anchors = roles.filter((role) => role.anchor_eligible).slice(0, Math.min(16, budget))
  for (const role of anchors) counts.set(role.role_id, 1)
  let remaining = budget - anchors.length
  const weighted = roles.map((role) => ({
    role,
    score: role.population_share * (0.55 + role.mean_attention_budget),
  }))
  while (remaining > 0) {
    const eligible = weighted.filter(({ role }) => (counts.get(role.role_id) ?? 0) < role.agent_count)
    if (!eligible.length) break
    eligible.sort((left, right) => {
      const leftAllocated = (counts.get(left.role.role_id) ?? 0) + 1
      const rightAllocated = (counts.get(right.role.role_id) ?? 0) + 1
      return (right.score / rightAllocated) - (left.score / leftAllocated) || left.role.role_id.localeCompare(right.role.role_id)
    })
    const selected = eligible[0].role
    counts.set(selected.role_id, (counts.get(selected.role_id) ?? 0) + 1)
    remaining -= 1
  }
  return counts
})

const activeAgentIds = computed(() => {
  const active = new Set<string>()
  const byRole = new Map<string, PublicAgentWorldNode[]>()
  for (const node of agentNodes.value) {
    const values = byRole.get(node.agent.role_id) ?? []
    values.push(node.agent)
    byRole.set(node.agent.role_id, values)
  }
  for (const [roleId, values] of byRole) {
    values.sort((left, right) => left.display_id.localeCompare(right.display_id))
    const target = Math.min(values.length, activeCounts.value.get(roleId) ?? 0)
    if (!target) continue
    const offset = stableHash(`${ACTIVATION_ALGORITHM_ID}:${activationMode.value}:${effectiveTick.value}:${roleId}`) % values.length
    for (let index = 0; index < target; index += 1) active.add(values[(offset + index) % values.length].display_id)
  }
  return active
})

const visibleEdges = computed(() => {
  const matrix = world.value?.relationships.aggregate_matrix ?? []
  const grouped = new Map<string, { source: string; target: string; count: number; cross: boolean }>()
  for (const row of matrix) {
    if (!relationTypes.value.has(row.relation_type) || row.source_role_id === row.target_role_id) continue
    const key = `${row.source_role_id}|${row.target_role_id}`
    const current = grouped.get(key) ?? { source: row.source_role_id, target: row.target_role_id, count: 0, cross: false }
    current.count += row.directed_edge_count
    current.cross ||= row.relation_type === 'cross_group_acquaintance'
    grouped.set(key, current)
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 52).map((edge) => ({
    ...edge, id:`${edge.source}:${edge.target}`, sourceNode: nodeById.value.get(edge.source), targetNode: nodeById.value.get(edge.target),
  })).filter((edge) => edge.sourceNode && edge.targetNode)
})
const maxVisibleEdge = computed(() => Math.max(...visibleEdges.value.map((edge) => edge.count), 1))
const selectedRelationshipEdge = computed(() => visibleEdges.value.find((edge) => edge.id === selectedRelationshipEdgeId.value) || null)

const projectedRuntimeFrame = computed<ForumWorldRuntimeFrame | null>(() => {
  if (!world.value) return null
  const representativeByRole = new Map<string, string>()
  for (const item of agentNodes.value) if (!representativeByRole.has(item.agent.role_id)) representativeByRole.set(item.agent.role_id, item.agent.display_id)
  const runtimeEvidence = new Map<string,Array<{id:string;kicker:string;text:string;provenance:string}>>()
  const privateExamples = (channel:string, index:number) => examplePrivateDialogue(props.runtimeScenarioId || '', channel === 'private_group', isEnglish.value, `runtime:${index}`)
  const liveEdges:Array<{id:string;sourceId:string;targetId:string;channel:'public'|'reply'|'private_direct'|'private_group'|'governance';count:number;label:string;evidence:Array<{id:string;kicker:string;text:string;provenance:string}>}> = []
  for (const event of props.runtimeEvents) {
    const payload = event.payload || {}
    const displayId = String(payload.display_id || payload.agent_display_id || '')
    const text = typeof payload.visible_text === 'string' ? payload.visible_text : ''
    if (displayId && text) {
      const rows = runtimeEvidence.get(displayId) || []
      rows.push({id:`event:${event.sequence}`,kicker:`${event.kind} · Tick ${effectiveTick.value}`,text,provenance:String(payload.provenance || 'runtime event')})
      runtimeEvidence.set(displayId,rows)
    }
    const edgeRows = Array.isArray(payload.world_edges) ? payload.world_edges : Array.isArray(payload.edges) ? payload.edges : []
    for (const [index,raw] of edgeRows.entries()) {
      if (!raw || typeof raw !== 'object') continue
      const row = raw as Record<string,unknown>
      const rawChannel = String(row.channel || '')
      if (!['public','reply','private_direct','private_group','governance'].includes(rawChannel)) continue
      const source = String(row.source_display_id || representativeByRole.get(String(row.source_role_id || '')) || '')
      const target = String(row.target_display_id || representativeByRole.get(String(row.target_role_id || '')) || '')
      if (!source || !target || source === target) continue
      const evidence = text
        ? [{id:`event:${event.sequence}`,kicker:event.kind,text,provenance:String(payload.provenance || 'runtime event')}]
        : (rawChannel === 'private_direct' || rawChannel === 'private_group')
          ? privateExamples(rawChannel,index)
          : []
      liveEdges.push({id:`event-edge:${event.sequence}:${index}`,sourceId:source,targetId:target,channel:rawChannel as 'public'|'reply'|'private_direct'|'private_group'|'governance',count:Math.max(1,Number(row.count || row.message_count || 1)),label:String(row.label || event.message || event.kind),evidence})
    }
  }
  // Replay pages may have reviewed private excerpts even when no live runtime
  // event stream is present. Project those approved excerpts onto the same
  // representative role nodes so the private channel is clickable and opens
  // its actual reviewed text.
  // Aggregate role pairs do not identify a conversation or its members.
  // Keep source excerpts distinct; UI examples carry their own provenance.
  const replayPrivateGroups = new Map<string, { channel:'private_direct'|'private_group'; source:string; target:string; excerpts: typeof props.runtimePrivateExcerpts }>()
  for (const excerpt of props.runtimePrivateExcerpts) {
    if (typeof excerpt.tick === 'number' && excerpt.tick !== effectiveTick.value) continue
    if (excerpt.branch && props.runtimeBranchLabel && !excerpt.branch.toLowerCase().includes(props.runtimeBranchLabel.toLowerCase())) continue
    const source = representativeByRole.get(String(excerpt.source_role_id || '')) || ''
    const target = representativeByRole.get(String(excerpt.target_role_id || '')) || ''
    const channel = excerpt.channel === 'private_group' ? 'private_group' : 'private_direct'
    if (!source || !target || source === target) continue
    const key = `${channel}:${excerpt.branch || ''}:${excerpt.tick ?? effectiveTick.value}:${source}:${target}:${excerpt.excerpt_id || replayPrivateGroups.size}`
    const current = replayPrivateGroups.get(key)
    if (current) current.excerpts.push(excerpt)
    else replayPrivateGroups.set(key, { channel, source, target, excerpts:[excerpt] })
  }
  for (const [index, replay] of [...replayPrivateGroups.values()].entries()) {
    const evidence = replay.excerpts.map((excerpt, memberIndex) => {
      const text = isEnglish.value ? String(excerpt.text_en || excerpt.text_zh || '') : String(excerpt.text_zh || excerpt.text_en || '')
      return {
        id:`replay-private:${effectiveTick.value}:${index}:${excerpt.excerpt_id}`,
        kicker:isEnglish.value
          ? (replay.channel === 'private_group' ? 'Saved group excerpt' : 'Saved friend-chat excerpt')
          : (replay.channel === 'private_group' ? '保存的群聊片段' : '保存的私聊片段'),
        text,
        provenance:'reviewed synthetic excerpt',
      }
    }).filter(item => item.text)
    if (!evidence.length) continue
    liveEdges.push({
      id:`replay-private:${effectiveTick.value}:${index}`,
      sourceId:replay.source,
      targetId:replay.target,
      channel:replay.channel,
      count:evidence.length,
      label:isEnglish.value
        ? (replay.channel === 'private_group' ? 'Dynamic group · member messages' : 'Friend chat · message')
        : (replay.channel === 'private_group' ? '动态小群 · 成员逐条消息' : '好友私聊 · 消息'),
      evidence:[...evidence,...privateExamples(replay.channel,index)],
    })
  }
  const nodes=agentNodes.value.map(({agent,x,y})=>({
    id:agent.display_id,roleId:agent.role_id,label:agentRoleLabel(agent.role_id,agent.role_label,isEnglish.value),microRole:agentMicroRoleLabel(agent.micro_role,agent.role_id,agent.role_label,isEnglish.value),x,y,
    radius:activeAgentIds.value.has(agent.display_id)?3.9:1.65,
    active:activeAgentIds.value.has(agent.display_id),
    publicReached:runtimeEvidence.has(agent.display_id),
    privateReached:liveEdges.some(edge=>edge.channel==='private_direct'&&(edge.sourceId===agent.display_id||edge.targetId===agent.display_id)),
    groupReached:liveEdges.some(edge=>edge.channel==='private_group'&&(edge.sourceId===agent.display_id||edge.targetId===agent.display_id)),
    llmSpeaker:runtimeEvidence.has(agent.display_id),
    status:runtimeEvidence.has(agent.display_id)?(isEnglish.value?'Committed runtime output':'已提交运行输出'):activeAgentIds.value.has(agent.display_id)?(isEnglish.value?'Activated this Tick':'本 Tick 已激活'):(isEnglish.value?'Background state':'后台状态'),
    evidence:(runtimeEvidence.get(agent.display_id)||[]).slice(-4),
  }))
  const baseEdges=visibleEdges.value.flatMap((edge)=>{
    const sourceId=representativeByRole.get(edge.source),targetId=representativeByRole.get(edge.target)
    return sourceId&&targetId?[{id:`base:${edge.id}`,sourceId,targetId,channel:'base' as const,count:edge.count,label:isEnglish.value?'Aggregate synthetic relationship':'聚合合成关系'}]:[]
  })
  const completed=props.runtimeTurnsCompleted ?? 0,reserved=props.runtimeTurnsReserved ?? 0
  const privateCount=liveEdges.filter(edge=>edge.channel==='private_direct'||edge.channel==='private_group').reduce((sum,edge)=>sum+edge.count,0)
  return {
    frameId:`workbench:${props.projectId}:${effectiveTick.value}:${completed}:${props.runtimeEvents.at(-1)?.sequence||0}`,
    title:isEnglish.value?'The Agent world evolves with the running project':'Agent 世界随项目运行实时演化',
    subtitle:isEnglish.value?'The fixed population, activation scheduler, public forum and private channels share one runtime frame. Select any node or edge to inspect committed evidence.':'固定人口、激活调度、公开论坛与私聊/群聊共用同一运行帧；点击节点或连线查看已提交证据。',
    tick:effectiveTick.value,
    branchLabel:props.runtimeBranchLabel || (isEnglish.value?'Current branch':'当前分支'),
    statusLabel:props.runtimeStatus || (isEnglish.value?'Ready':'就绪'),
    playing:['queued','running','cancelling'].includes(props.runtimeStatus),
    nodes,
    edges:[...baseEdges,...liveEdges],
    metrics:[
      {id:'active',label:isEnglish.value?'Activated this Tick':'本 Tick 激活',value:activeAgentIds.value.size,note:`/ ${world.value.population.agent_count}`},
      {id:'turns',label:isEnglish.value?'Completed turns':'已完成轮次',value:completed,note:reserved?`/ ${reserved}`:''},
      {id:'public',label:isEnglish.value?'Committed public events':'已提交公开事件',value:[...runtimeEvidence.values()].reduce((sum,rows)=>sum+rows.length,0)},
      {id:'private',label:isEnglish.value?'Committed private links':'已提交私域连接',value:privateCount},
      {id:'queue',label:isEnglish.value?'Runtime events':'运行事件',value:props.runtimeEvents.length},
    ],
    contentSha256:world.value.world_sha256,
    boundaryNote:isEnglish.value?'The view follows saved events. Conversation examples are labelled separately.':'视图跟随已保存事件；示例对话单独标记。',
  }
})

const stakeDimensions = computed(() => Object.entries(selectedScenario.value?.mean_dimensions ?? {}).filter(([key]) => key !== 'directly_affected').sort((a, b) => b[1] - a[1]).slice(0, 8))

function toggleRelation(type: RelationshipRow['relation_type']) {
  const next = new Set(relationTypes.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  relationTypes.value = next
}

function roleLabel(role: RoleSummary): string { return agentRoleLabel(role.role_id, role.label, isEnglish.value) }
function dataLabel(value: string): string { return isEnglish.value ? (dataLabelsEn[value] || value) : value }
function shortHash(value: string): string { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—' }
function pct(value: number): string { return `${Math.round(value * 100)}%` }

function openRole(roleId:string) {
  selectedRelationshipEdgeId.value = ''
  selectedRoleId.value = roleId
  const displayId = world.value?.population.display_nodes.find((agent) => agent.role_id === roleId)?.display_id || ''
  if (displayId) void openAgent(displayId)
}

function selectRelationshipEdge(edgeId:string) {
  selectedRelationshipEdgeId.value = edgeId
  const edge = visibleEdges.value.find((item) => item.id === edgeId)
  if (edge) selectedRoleId.value = edge.source
}

function inspectRuntimeNode(node:ForumWorldRuntimeNode) {
  void openAgent(node.id)
}

async function openAgent(displayId:string) {
  selectedAgentId.value = displayId
  selectedAgentDossier.value = world.value?.population.representative_agents.find((agent) => agent.display_id === displayId) || null
  dossierOpen.value = true
  dossierLoading.value = true
  try {
    const payload = await getForumTwinV2AgentDossier(displayId, props.projectId || null)
    if (payload?.schema_version !== 'campus-pulse-forum-agent-dossier-public-v1' || payload?.dossier?.display_id !== displayId) throw new Error('Agent dossier schema mismatch')
    selectedAgentDossier.value = payload.dossier as PublicAgentDossier
  } catch (cause) {
    if (!selectedAgentDossier.value) error.value = readableApiError(cause)
  } finally {
    dossierLoading.value = false
  }
}

onMounted(loadWorld)
</script>

<template>
  <template v-if="variant === 'runtime' && projectedRuntimeFrame">
    <ForumWorldRuntimeStage :frame="projectedRuntimeFrame" @inspect-node="inspectRuntimeNode" @select-node="emit('inspectContent')" @select-edge="emit('inspectContent')" />
    <AgentDossierDrawer :open="dossierOpen" :agent="selectedAgent" :scenario-label="scenarioNames[selectedScenarioId] || selectedScenarioId" :branch-label="runtimeBranchLabel || copy.preview" :tick="effectiveTick" :status-label="activeAgentIds.has(selectedAgent?.display_id || '') ? copy.activated : copy.background" :project-id="props.projectId" editable @close="dossierOpen=false" />
  </template>
  <section v-else class="agent-world" aria-labelledby="agent-world-title">
    <header class="world-head">
      <div>
        <p>{{ copy.eyebrow }}</p>
        <h2 id="agent-world-title">{{ copy.title }}</h2>
        <span>{{ copy.intro }}</span>
      </div>
      <button type="button" class="configure" @click="emit('openPlan')">{{ copy.configure }} <i class="fa-solid fa-arrow-right" /></button>
    </header>

    <div v-if="loading" class="world-loading" aria-live="polite"><span /><span /><span /></div>
    <div v-else-if="error || !world" class="world-error" role="alert">
      <strong>{{ copy.unavailable }}</strong><span>{{ error }}</span><button type="button" @click="loadWorld">{{ copy.retry }}</button>
    </div>
    <template v-else>
      <div class="world-stats">
        <div><small>{{ copy.agents }}</small><strong>{{ world.population.agent_count.toLocaleString() }}</strong><span>{{ copy.fixed }}</span></div>
        <div><small>{{ copy.particles }}</small><strong>{{ world.population.particle_count.toLocaleString() }}</strong><span>SMC</span></div>
        <div><small>{{ copy.roles }}</small><strong>{{ world.population.macro_role_count }}</strong><span>{{ world.population.micro_role_pool_count }} {{ copy.micro }} · {{ world.population.represented_micro_role_count }} {{ copy.represented }}</span></div>
        <div><small>{{ copy.edges }}</small><strong>{{ world.relationships.directed_edge_count.toLocaleString() }}</strong><span>2 + 4 + 2 / Agent</span></div>
      </div>

      <section class="network-card" aria-labelledby="world-network-title">
        <div class="network-head">
          <div><h3 id="world-network-title">{{ copy.network }}</h3><p>{{ copy.networkNote }}</p></div>
          <div class="relation-filter" aria-label="Relationship layers">
            <button type="button" :class="{ active:relationTypes.has('close_friend') }" :aria-pressed="relationTypes.has('close_friend')" @click="toggleRelation('close_friend')"><i class="dot close" />{{ copy.close }}</button>
            <button type="button" :class="{ active:relationTypes.has('familiar_peer') }" :aria-pressed="relationTypes.has('familiar_peer')" @click="toggleRelation('familiar_peer')"><i class="dot familiar" />{{ copy.familiar }}</button>
            <button type="button" :class="{ active:relationTypes.has('cross_group_acquaintance') }" :aria-pressed="relationTypes.has('cross_group_acquaintance')" @click="toggleRelation('cross_group_acquaintance')"><i class="dot cross" />{{ copy.cross }}</button>
          </div>
        </div>
        <div class="network-layout">
          <div class="network-stage">
            <svg viewBox="0 0 900 560" role="img" :aria-label="copy.network">
              <defs><radialGradient id="active-node"><stop offset="0" stop-color="#ff638a"/><stop offset="1" stop-color="#bd002d"/></radialGradient></defs>
              <g class="edges">
                <g v-for="edge in visibleEdges" :key="edge.id" class="relationship-edge" :class="[{ selected:selectedRelationshipEdgeId===edge.id },{ cross:edge.cross }]" role="button" tabindex="0" @click="selectRelationshipEdge(edge.id)" @keydown.enter="selectRelationshipEdge(edge.id)" @keydown.space.prevent="selectRelationshipEdge(edge.id)">
                  <line class="relationship-hit" :x1="edge.sourceNode.x" :y1="edge.sourceNode.y" :x2="edge.targetNode.x" :y2="edge.targetNode.y" />
                  <line class="relationship-line" :x1="edge.sourceNode.x" :y1="edge.sourceNode.y" :x2="edge.targetNode.x" :y2="edge.targetNode.y" :stroke-width=".55 + 4 * edge.count / maxVisibleEdge" />
                  <title>{{ roleNamesEn[edge.source] || edge.source }} → {{ roleNamesEn[edge.target] || edge.target }} · {{ edge.count }}</title>
                </g>
              </g>
              <g v-for="node in roleNodes" :key="node.role_id" class="node" :class="{ selected:selectedRoleId === node.role_id, active:(activeCounts.get(node.role_id) ?? 0) > 0 }" role="button" tabindex="0" @click="openRole(node.role_id)" @keydown.enter="openRole(node.role_id)">
                <circle v-if="(activeCounts.get(node.role_id) ?? 0) > 0" class="pulse" :cx="node.x" :cy="node.y" :r="node.radius + 10" />
                <circle class="node-core" :cx="node.x" :cy="node.y" :r="node.radius" />
                <text :x="node.x" :y="node.y + 3" text-anchor="middle">{{ node.role_id.slice(-2) }}</text>
                <text class="node-count" :x="node.x" :y="node.y + node.radius + 16" text-anchor="middle">{{ activeCounts.get(node.role_id) ?? 0 }}/{{ node.agent_count }}</text>
              </g>
              <g v-for="node in agentNodes" :key="node.agent.display_id" class="micro-agent-node" :class="{ active:activeAgentIds.has(node.agent.display_id), selected:selectedAgent?.display_id===node.agent.display_id }" role="button" tabindex="0" @click.stop="openAgent(node.agent.display_id)" @keydown.enter.stop="openAgent(node.agent.display_id)">
                <circle v-if="activeAgentIds.has(node.agent.display_id)" class="micro-pulse" :cx="node.x" :cy="node.y" r="7" />
                <circle class="particle-halo" :cx="node.x" :cy="node.y" :r="2.4 + node.agent.particle_uncertainty * 3.6" :style="{ opacity:String(.08 + node.agent.particle_uncertainty * .16) }" />
                <circle class="micro-core" :cx="node.x" :cy="node.y" :r="activeAgentIds.has(node.agent.display_id) ? 4.1 : 1.7" />
                <title>{{ node.agent.display_id }} · {{ agentMicroRoleLabel(node.agent.micro_role,node.agent.role_id,node.agent.role_label,isEnglish) }} · {{ activeAgentIds.has(node.agent.display_id) ? copy.projected : copy.background }}</title>
              </g>
              <g class="network-center"><circle cx="450" cy="270" r="78"/><circle class="scan" cx="450" cy="270" r="104"/><text x="450" y="255" text-anchor="middle">FORUMTWIN</text><text class="center-count" x="450" y="283" text-anchor="middle">{{ currentBudget === 1000 ? copy.census : currentBudget + ' ' + copy.activated }}</text><text class="center-sub" x="450" y="307" text-anchor="middle">Tick {{ selectedTick }}</text></g>
            </svg>
            <p class="agent-node-caption"><b>{{ agentNodes.length }}</b> {{ copy.inspectable }} · {{ copy.particleHalo }} · {{ copy.dossierNote }}</p>
          </div>
          <aside v-if="selectedRole" class="role-inspector">
            <template v-if="selectedRelationshipEdge">
              <p>{{ isEnglish ? 'SELECTED RELATIONSHIP' : '已选择关系连线' }} · {{ selectedRelationshipEdge.count }}</p>
              <h4>{{ roleNamesEn[selectedRelationshipEdge.source] || selectedRelationshipEdge.source }} → {{ roleNamesEn[selectedRelationshipEdge.target] || selectedRelationshipEdge.target }}</h4>
              <div class="edge-inspector-note">{{ isEnglish ? 'An aggregate, fully synthetic relationship channel. Runtime public or private evidence appears here only after the run commits it.' : '这是完全合成的聚合关系通道；只有运行提交后的公开或私域证据才会显示在实时视图中。' }}</div>
            </template>
            <template v-else>
              <p>{{ copy.selected }} · {{ selectedRole.role_id }}</p>
              <h4>{{ roleLabel(selectedRole) }}</h4>
            </template>
            <div class="role-numbers"><span><strong>{{ selectedRole.agent_count }}</strong>{{ copy.people }}</span><span><strong>{{ selectedRole.micro_role_count }}</strong>{{ copy.microRoles }}</span><span><strong>{{ pct(selectedRole.mean_attention_budget) }}</strong>{{ copy.attention }}</span></div>
            <section><small>{{ copy.topics }}</small><div><em v-for="topic in selectedRole.top_topics" :key="topic">{{ dataLabel(topic) }}</em></div></section>
            <section><small>{{ copy.needs }}</small><div><em v-for="need in selectedRole.top_needs" :key="need">{{ dataLabel(need) }}</em></div></section>
            <section class="role-agents"><small>{{ copy.agentsInRole }}</small><div><button v-for="agent in visibleSelectedRoleAgents" :key="agent.display_id" type="button" :class="{ selected:selectedAgentId === agent.display_id }" @click="openAgent(agent.display_id)"><b>{{ agent.display_id }}</b><span>{{ agentMicroRoleLabel(agent.micro_role,agent.role_id,agent.role_label,isEnglish) }}</span></button></div><p>{{ selectedRoleAgents.length }} · {{ copy.dossierNote }}</p></section>
            <button v-if="selectedAgentId" type="button" class="open-dossier" :disabled="dossierLoading" @click="openAgent(selectedAgentId)">{{ dossierLoading ? copy.loadingDossier : copy.openDossier }} <i class="fa-solid fa-arrow-up-right-from-square"/></button>
          </aside>
        </div>
      </section>

      <div class="world-grid">
        <section class="activation-card">
          <header><div><p>{{ copy.preview }}</p><h3>{{ copy.activation }}</h3></div><strong>{{ currentBudget.toLocaleString() }} <small>/ {{ world.population.agent_count }}</small></strong></header>
          <div class="activation-controls">
            <label><span>{{ copy.tick }} {{ selectedTick }}</span><input v-model.number="selectedTick" type="range" min="0" max="23" step="1" /></label>
            <label><span>{{ copy.mode }}</span><select v-model="activationMode"><option value="budgeted_pps">{{ copy.budgeted }}</option><option value="full_population_keyframes">{{ copy.keyframes }}</option><option value="full_population_every_tick">{{ copy.full }}</option></select></label>
          </div>
          <div class="activation-flow"><span><b>01</b>{{ copy.stage1 }}</span><i class="fa-solid fa-chevron-right"/><span><b>02</b>{{ copy.stage2 }}</span><i class="fa-solid fa-chevron-right"/><span><b>03</b>{{ copy.stage3 }}</span></div>
          <p class="queue-note">{{ copy.queueNote }}</p>
        </section>

        <section class="stake-card">
          <header><h3>{{ copy.stake }}</h3><select v-model="selectedScenarioId"><option v-for="scenario in world.stakes.scenarios" :key="scenario.scenario_id" :value="scenario.scenario_id">{{ scenarioNames[scenario.scenario_id] || scenario.scenario_id }}</option></select></header>
          <div v-if="selectedScenario" class="stake-summary"><strong>{{ pct(selectedScenario.directly_affected_share) }}</strong><span>{{ copy.affected }} · {{ selectedScenario.position_count.toLocaleString() }} {{ copy.positions }}</span></div>
          <div class="stake-bars"><div v-for="[key,value] in stakeDimensions" :key="key"><span>{{ dimensionNames[key] || key }}</span><i><b :style="{ width:pct(value) }" /></i><em>{{ pct(value) }}</em></div></div>
        </section>
      </div>

      <section class="channel-card">
        <header><p>PUBLIC IDENTITY · PRIVATE RELATIONS · SERVICE · GOVERNANCE</p><h3>{{ copy.channels }}</h3></header>
        <div class="channel-flow">
          <article><i class="fa-solid fa-ranking-star"/><div><h4>{{ copy.publicForum }}</h4><p>{{ copy.publicDesc }}</p><em v-if="world.visibility_harness.public_anonymity.enabled">SAME FORUM · OPTIONAL ANONYMOUS FACE</em></div></article>
          <article><i class="fa-solid fa-user-group"/><div><h4>{{ copy.privateChat }}</h4><p>{{ copy.privateDesc }}</p></div></article>
          <article><i class="fa-solid fa-ticket"/><div><h4>{{ copy.serviceDesk }}</h4><p>{{ copy.serviceDesc }}</p></div></article>
          <article><i class="fa-solid fa-scale-balanced"/><div><h4>{{ copy.governance }}</h4><p>{{ copy.governanceDesc }}</p></div></article>
        </div>
      </section>

      <section class="risk-card">
        <div><p>RISK RADAR · 7 SIGNALS</p><h3>{{ copy.risks }}</h3><span>{{ copy.riskNote }}</span></div>
        <div class="risk-lists"><ol><li v-for="(risk,index) in world.risk_signals" :key="risk"><b>0{{ index + 1 }}</b><span>{{ riskNames[risk] || risk }}</span></li></ol><section><small>VISIBILITY HARNESS</small><span v-for="signal in world.visibility_harness.cross_channel_risk_signals" :key="signal">{{ signal }}</span></section></div>
      </section>

      <footer class="world-proof"><span>Profile · {{ world.population.profile_bundle_count.toLocaleString() }}</span></footer>
      <AgentDossierDrawer :open="dossierOpen" :agent="selectedAgent" :scenario-label="scenarioNames[selectedScenarioId] || selectedScenarioId" :branch-label="copy.preview" :tick="selectedTick" :status-label="activeAgentIds.has(selectedAgent?.display_id || '') ? copy.activated : copy.background" :project-id="props.projectId" editable @close="dossierOpen=false" />
    </template>
  </section>
</template>

<style scoped>
.agent-world{display:grid;gap:var(--cp-space-4);padding:clamp(1rem,2.2vw,2rem);border:1px solid #d8d2cb;background:#faf9f7;box-shadow:0 20px 60px rgba(31,20,23,.08);overflow:hidden}.world-head{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem}.world-head p,.activation-card header p,.channel-card header p,.risk-card>div>p{margin:0 0 .45rem;color:#b4002b;font:700 .72rem/1.2 var(--cp-font-mono);letter-spacing:.14em}.world-head h2{max-width:58rem;margin:0;color:#181416;font-size:clamp(1.7rem,3vw,3rem);line-height:1.02;letter-spacing:-.045em}.world-head>div>span{display:block;max-width:58rem;margin-top:.85rem;color:#655d60;font-size:.92rem;line-height:1.7}.configure{display:flex;flex:none;align-items:center;gap:.7rem;min-height:2.75rem;padding:0 1rem;border:1px solid #b4002b;background:#b4002b;color:#fff;font-weight:750;cursor:pointer}.configure:hover{background:#8d0022}.world-loading{display:flex;justify-content:center;gap:.4rem;padding:6rem}.world-loading span{width:.65rem;height:.65rem;border-radius:50%;background:#bd002d;animation:loading 1s infinite alternate}.world-loading span:nth-child(2){animation-delay:.2s}.world-loading span:nth-child(3){animation-delay:.4s}.world-error{display:grid;gap:.5rem;padding:2rem;border:1px solid #b4002b;background:#fff4f5}.world-error button{justify-self:start;padding:.6rem 1rem;border:1px solid #b4002b;background:#fff;color:#b4002b}.world-stats{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid #d9d2cd}.world-stats>div{display:grid;gap:.2rem;padding:1rem 1.2rem;border-right:1px solid #d9d2cd}.world-stats>div:last-child{border-right:0}.world-stats small{color:#766d70;font-size:.72rem}.world-stats strong{color:#1b1718;font:760 clamp(1.7rem,3vw,2.5rem)/1 var(--cp-font-sans)}.world-stats span{color:#9b8f92;font-size:.68rem}.network-card,.activation-card,.stake-card,.channel-card,.risk-card{border:1px solid #d7d0cb;background:#fff}.network-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;border-bottom:1px solid #e3ddd8}.network-head h3,.activation-card h3,.stake-card h3,.channel-card h3,.risk-card h3{margin:0;color:#201a1c;font-size:1.1rem}.network-head p{margin:.25rem 0 0;color:#8b8083;font-size:.7rem}.relation-filter{display:flex;flex-wrap:wrap;gap:.35rem}.relation-filter button{display:flex;align-items:center;gap:.4rem;padding:.45rem .7rem;border:1px solid #ded7d2;background:#faf8f5;color:#756a6d;font-size:.7rem;cursor:pointer}.relation-filter button.active{border-color:#b4002b;background:#fff0f3;color:#890020}.dot{width:.46rem;height:.46rem;border-radius:50%;background:#7f7779}.dot.close{background:#c00030}.dot.familiar{background:#a99776}.dot.cross{background:#74516d}.network-layout{display:grid;grid-template-columns:minmax(0,1fr) 16rem;min-height:31rem}.network-stage{min-width:0;background:radial-gradient(circle at 50% 48%,rgba(190,0,48,.08),transparent 30%),linear-gradient(rgba(122,107,111,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(122,107,111,.06) 1px,transparent 1px);background-size:auto,48px 48px,48px 48px}.network-stage svg{display:block;width:100%;height:100%}.edges line{stroke:#a69a9d;opacity:.28;transition:opacity .2s}.edges line.cross{stroke:#ad1740;opacity:.42;stroke-dasharray:4 5;animation:dash 10s linear infinite}.node{cursor:pointer}.node-core{fill:#f4efec;stroke:#776c6f;stroke-width:1.5;transition:.2s}.node text{fill:#50464a;font:700 10px var(--cp-font-mono);pointer-events:none}.node .node-count{fill:#8b8083;font-size:9px}.node.active .node-core{fill:url(#active-node);stroke:#fff}.node.active>text:first-of-type{fill:#fff}.node.selected .node-core{stroke:#171214;stroke-width:4}.pulse{fill:none;stroke:#d8003d;stroke-width:1.5;opacity:.5;transform-origin:center;animation:pulse 1.8s ease-out infinite}.network-center circle{fill:#171315;stroke:#4b3c41;stroke-width:1.2}.network-center .scan{fill:none;stroke:#b90031;stroke-dasharray:3 9;opacity:.45;transform-origin:450px 270px;animation:rotate 16s linear infinite}.network-center text{fill:#fff;font:750 12px var(--cp-font-mono);letter-spacing:.13em}.network-center .center-count{fill:#efbd72;font-size:15px;letter-spacing:0}.network-center .center-sub{fill:#96898d;font-size:9px}.role-inspector{display:grid;align-content:start;gap:1rem;padding:1.2rem;border-left:1px solid #e1dad6;background:#fcfaf7}.role-inspector>p{margin:0;color:#a40028;font:700 .65rem var(--cp-font-mono)}.role-inspector h4{margin:-.4rem 0 0;font-size:1.45rem;line-height:1.15}.role-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem}.role-numbers span{display:grid;gap:.1rem;color:#8a7f82;font-size:.58rem}.role-numbers strong{color:#262023;font-size:1rem}.role-inspector section{display:grid;gap:.5rem}.role-inspector section small{color:#7f7477;font-weight:700}.role-inspector section div{display:flex;flex-wrap:wrap;gap:.35rem}.role-inspector em{padding:.32rem .5rem;border:1px solid #ddd5d0;background:#fff;color:#5e5457;font-size:.65rem;font-style:normal}.world-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:var(--cp-space-3)}.activation-card,.stake-card{padding:1.1rem 1.2rem}.activation-card header,.stake-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.activation-card header strong{color:#bd002d;font-size:2rem}.activation-card header small{color:#8f8386;font-size:.75rem}.activation-controls{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}.activation-controls label{display:grid;gap:.45rem;color:#756a6d;font-size:.7rem}.activation-controls input,.activation-controls select{width:100%;min-height:2.2rem;accent-color:#b90031;border:1px solid #d9d2ce;background:#fff;padding:.35rem}.activation-flow{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:1.2rem}.activation-flow span{display:flex;align-items:center;gap:.5rem;color:#50474a;font-size:.7rem}.activation-flow b{display:grid;width:1.65rem;height:1.65rem;place-items:center;border-radius:50%;background:#1a1517;color:#fff;font:700 .58rem var(--cp-font-mono)}.activation-flow>i{color:#c6bbb8;font-size:.65rem}.queue-note{margin:1rem 0 0;padding:.75rem;border-left:3px solid #b90031;background:#faf6f4;color:#74696c;font-size:.7rem;line-height:1.6}.stake-card header select{max-width:14rem;min-height:2.2rem;border:1px solid #d9d2ce;background:#fff;padding:.35rem;color:#433b3e}.stake-summary{display:flex;align-items:baseline;gap:.7rem;margin:1rem 0}.stake-summary strong{color:#b90031;font-size:2rem}.stake-summary span{color:#7c7174;font-size:.72rem}.stake-bars{display:grid;gap:.52rem}.stake-bars>div{display:grid;grid-template-columns:7.2rem 1fr 2.4rem;align-items:center;gap:.5rem;font-size:.64rem}.stake-bars span{color:#665c5f}.stake-bars i{height:.36rem;background:#eee8e4;overflow:hidden}.stake-bars b{display:block;height:100%;background:linear-gradient(90deg,#bd002d,#ef6b86)}.stake-bars em{color:#8f8587;font-style:normal;text-align:right}.channel-card{padding:1.2rem}.channel-card header{text-align:center}.channel-flow{display:grid;grid-template-columns:1fr 4rem 1fr 4rem 1fr;align-items:center;margin-top:1.1rem}.channel-flow article{display:flex;align-items:flex-start;gap:.8rem;min-height:7rem;padding:1rem;border:1px solid #ded7d2;background:#fcfaf8}.channel-flow article>i{display:grid;width:2.2rem;height:2.2rem;flex:none;place-items:center;border-radius:50%;background:#1b1618;color:#fff}.channel-flow h4{margin:0;font-size:.88rem}.channel-flow p{margin:.45rem 0 0;color:#7b7073;font-size:.68rem;line-height:1.55}.channel-link{display:flex;justify-content:center;gap:.3rem}.channel-link i{width:.35rem;height:.35rem;border-radius:50%;background:#bd002d;animation:flow 1.5s infinite}.channel-link i:nth-child(2){animation-delay:.2s}.channel-link i:nth-child(3){animation-delay:.4s}.risk-card{display:grid;grid-template-columns:.8fr 1.2fr;gap:2rem;padding:1.2rem}.risk-card>div>span{color:#786d70;font-size:.72rem;line-height:1.6}.risk-card ol{display:grid;grid-template-columns:1fr 1fr;gap:.45rem;margin:0;padding:0;list-style:none}.risk-card li{display:flex;align-items:center;gap:.55rem;padding:.48rem .6rem;border-bottom:1px solid #e6dfdb;color:#544b4e;font-size:.68rem}.risk-card li b{color:#bd002d;font:700 .62rem var(--cp-font-mono)}.world-proof{display:flex;justify-content:space-between;gap:1rem;color:#93878a;font-size:.62rem}.world-proof code{color:#51474a}.world-error button,.configure,.relation-filter button,.node:focus .node-core{outline-offset:3px}.node:focus .node-core{outline:2px solid #006edc}@keyframes pulse{0%{opacity:.7;transform:scale(.85)}100%{opacity:0;transform:scale(1.3)}}@keyframes rotate{to{transform:rotate(360deg)}}@keyframes dash{to{stroke-dashoffset:-90}}@keyframes flow{0%,100%{opacity:.2;transform:translateX(-3px)}50%{opacity:1;transform:translateX(3px)}}@keyframes loading{to{transform:translateY(-.5rem);opacity:.35}}
.network-layout{grid-template-columns:minmax(0,1fr) 18rem}.role-inspector{max-height:31rem;overflow:auto}.role-agents>div{display:grid!important;grid-template-columns:1fr 1fr;gap:.35rem!important}.role-agents button{display:grid;gap:.12rem;min-width:0;padding:.5rem;border:1px solid #ded6d1;background:#fff;color:#3d3437;text-align:left;cursor:pointer}.role-agents button.selected{border-color:#b4002b;background:#fff0f3}.role-agents button b{font:750 .63rem var(--cp-font-mono)}.role-agents button span{overflow:hidden;color:#84797c;font-size:.57rem;text-overflow:ellipsis;white-space:nowrap}.role-agents>p{margin:0;color:#9c9093;font-size:.6rem}.open-dossier{display:flex;align-items:center;justify-content:space-between;gap:.6rem;min-height:2.55rem;padding:0 .75rem;border:1px solid #b4002b;background:#b4002b;color:#fff;font-size:.7rem;font-weight:750;cursor:pointer}.open-dossier:hover{background:#8e0023}.open-dossier:focus-visible,.role-agents button:focus-visible{outline:2px solid #006edc;outline-offset:2px}
.relationship-edge{cursor:pointer}.relationship-edge .relationship-hit{stroke:transparent!important;stroke-width:14!important;opacity:1}.relationship-edge .relationship-line{stroke:#a69a9d;opacity:.3;transition:stroke .2s,opacity .2s}.relationship-edge.cross .relationship-line{stroke:#ad1740;opacity:.5;stroke-dasharray:4 5;animation:dash 10s linear infinite}.relationship-edge.selected .relationship-line,.relationship-edge:focus-visible .relationship-line{stroke:#006edc;stroke-width:4!important;opacity:1}.edge-inspector-note{padding:.65rem;border-left:3px solid #b4002b;background:#fff4f6;color:#6c6064;font-size:.64rem;line-height:1.55}
.micro-agent-node{cursor:pointer}.micro-agent-node .micro-core{fill:#82777a;stroke:#f8f4f1;stroke-width:.65;transition:r .16s,fill .16s}.micro-agent-node.active .micro-core{fill:#ff124e;stroke:#fff;filter:drop-shadow(0 0 4px rgba(230,0,56,.8))}.micro-agent-node.selected .micro-core,.micro-agent-node:focus-visible .micro-core{stroke:#1687ff;stroke-width:2.4}.micro-pulse{fill:none;stroke:#ed174c;stroke-width:1;transform-origin:center;animation:pulse 1.7s ease-out infinite}.agent-node-caption{position:absolute;bottom:.75rem;left:.9rem;z-index:2;margin:0;padding:.38rem .55rem;border:1px solid rgba(69,54,59,.16);background:rgba(255,255,255,.9);color:#756a6d;font-size:.58rem;box-shadow:0 5px 18px rgba(33,20,24,.08)}.agent-node-caption b{color:#b5002e;font:800 .66rem var(--cp-font-mono)}.network-stage{position:relative}
.particle-halo{fill:#4d9bd7;pointer-events:none}.micro-agent-node.active .particle-halo{fill:#ffb340;opacity:.32!important}.open-dossier:disabled{cursor:wait;opacity:.64}
.channel-flow{grid-template-columns:repeat(4,minmax(0,1fr));gap:.7rem;align-items:stretch}.channel-flow article{min-height:8rem}.channel-flow em{display:inline-block;margin-top:.65rem;padding:.25rem .4rem;border:1px solid #d7af59;color:#9c6c0c;font:700 .52rem var(--cp-font-mono);font-style:normal}.risk-lists{display:grid;grid-template-columns:1fr .72fr;gap:1rem}.risk-lists section{display:grid;align-content:start;gap:.35rem;padding:.75rem;border:1px solid #ded7d2;background:#171315}.risk-lists section small{color:#e0b55d;font:700 .58rem var(--cp-font-mono);letter-spacing:.08em}.risk-lists section span{padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.08);color:#ddd4d6;font:.58rem var(--cp-font-mono);overflow-wrap:anywhere}
@media(max-width:1100px){.channel-flow{grid-template-columns:1fr 1fr}.risk-lists{grid-template-columns:1fr}}
@media(max-width:980px){.network-layout{grid-template-columns:1fr}.role-inspector{max-height:none;border-top:1px solid #e1dad6;border-left:0}.world-grid,.risk-card{grid-template-columns:1fr}.channel-flow{grid-template-columns:1fr}.channel-link{padding:.65rem;transform:rotate(90deg)}}
@media(max-width:700px){.agent-world{padding:1rem}.world-head{align-items:flex-start;flex-direction:column}.world-stats{grid-template-columns:1fr 1fr}.world-stats>div:nth-child(2){border-right:0}.network-head{align-items:flex-start;flex-direction:column}.network-layout{min-height:auto}.network-stage{height:23rem;overflow:hidden}.network-stage svg{width:42rem;max-width:none;transform:translateX(calc((100vw - 42rem)/2 - 1rem))}.activation-controls{grid-template-columns:1fr}.activation-flow{align-items:stretch;flex-direction:column}.activation-flow>i{transform:rotate(90deg);align-self:center}.risk-card ol{grid-template-columns:1fr}.world-proof{flex-direction:column}.stake-bars>div{grid-template-columns:6.4rem 1fr 2rem}}
@media(prefers-reduced-motion:reduce){.pulse,.scan,.edges line.cross,.channel-link i,.world-loading span{animation:none}}
/* Selection uses a quiet neutral ring so a connected pair reads as one
   relationship instead of two black boxes. Keyboard focus keeps its blue
   outline for accessibility. */
.node.selected .node-core{stroke:#8e8583!important;stroke-width:3!important}
.relationship-edge.selected .relationship-line{stroke:#d7c59e!important;stroke-width:3!important;opacity:1}
.micro-agent-node.selected .micro-core{stroke:#d7c59e!important;stroke-width:2.2!important}
</style>
