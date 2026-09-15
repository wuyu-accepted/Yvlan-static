const PRODUCT_ROUTE_IDS = new Set([
  'overview',
  'forum',
  'results',
  'workbench',
  'system',
])

const completeProductNavigation = [
  Object.freeze({ id: 'overview', label: '产品首页', description: 'CampusPulse 能力总览', to: '/campus-pulse', icon: 'fa-house' }),
  Object.freeze({ id: 'workbench', label: '项目工作台', description: '项目注册与治理编排', to: '/campus-pulse/workbench', icon: 'fa-sliders' }),
  Object.freeze({ id: 'forum', label: '实时演化', description: '逐时间步观察平行论坛', to: Object.freeze({ name: 'campus-pulse-live-evolution' }), icon: 'fa-comments' }),
  Object.freeze({ id: 'results', label: '案例中心', description: '机制链与分支差异', to: '/campus-pulse/results', icon: 'fa-chart-column' }),
  Object.freeze({ id: 'system', label: '系统与数据', description: '模型、证据与就绪状态', to: '/campus-pulse/system', icon: 'fa-shield-halved' }),
]

const publicProductNavigation = [
  Object.freeze({ id: 'overview', label: '项目介绍', description: 'CampusPulse 能力总览', to: '/campus-pulse', icon: 'fa-house' }),
  Object.freeze({ id: 'forum', label: '演化展示', description: '观察讨论与回应过程', to: Object.freeze({ name: 'campus-pulse-live-evolution' }), icon: 'fa-comments' }),
  Object.freeze({ id: 'results', label: '案例中心', description: '阅读案例与分支差异', to: '/campus-pulse/results', icon: 'fa-chart-column' }),
]

export const productNavigation = Object.freeze(
  import.meta.env.VITE_PUBLIC_DEMO === 'true' ? publicProductNavigation : completeProductNavigation,
)

export function defineProductRouteMeta({ navId, title, source }) {
  if (!PRODUCT_ROUTE_IDS.has(navId)) {
    throw new TypeError(`Unknown CampusPulse navigation id: ${navId}`)
  }
  if (!title || typeof title !== 'string') {
    throw new TypeError('CampusPulse route title is required')
  }
  return Object.freeze({
    productShell: true,
    navId,
    title,
    source: Object.freeze({ ...source }),
  })
}

const offlineHeroSource = Object.freeze({
  key: 'offline-hero',
  mode: 'offline_hero',
  label: '审计案例（待校验）',
  verification: 'unverified',
  freshness: { status: 'unknown' },
  availability: { backend: 'unknown', access: 'readonly' },
  provenance: { manifestAvailable: true, evidenceId: 'resource-policy-live-r1' },
  publicationEligible: false,
  boundaries: [],
  boundarySummary: '结果来源与完整性校验',
})

const simulatorSource = Object.freeze({
  key: 'simulator-api',
  mode: 'live_api',
  label: 'Simulator API',
  verification: 'unverified',
  freshness: { status: 'unknown' },
  availability: { backend: 'unknown', access: 'interactive' },
  provenance: { manifestAvailable: false },
  publicationEligible: null,
  boundaries: [],
  boundarySummary: '项目、场景、方案与运行状态',
})

export const productRouteMeta = Object.freeze({
  overview: defineProductRouteMeta({
    navId: 'overview',
    title: '校园论坛模拟器',
    source: simulatorSource,
  }),
  forum: defineProductRouteMeta({
    navId: 'forum',
    title: '实时演化',
    source: offlineHeroSource,
  }),
  liveEvolution: defineProductRouteMeta({
    navId: 'forum',
    title: '实时演化',
    source: simulatorSource,
  }),
  centuryGymLive: defineProductRouteMeta({
    navId: 'forum',
    title: '世纪馆现场运行',
    source: {
      key: 'century-gym-live-progress',
      mode: 'live_api',
      label: '实时运行进度',
      verification: 'unverified',
      freshness: { status: 'unknown' },
      availability: { backend: 'unknown', access: 'readonly' },
      provenance: { manifestAvailable: true },
      publicationEligible: null,
      boundaries: [],
      boundarySummary: '世纪馆 Runner 公开进度',
    },
  }),
  liveWorld: defineProductRouteMeta({
    navId: 'forum',
    title: '项目实时世界',
    source: {
      key: 'forum-twin-live-world',
      mode: 'live_api',
      label: 'ForumTwin 实时世界',
      verification: 'unverified',
      freshness: { status: 'unknown' },
      availability: { backend: 'unknown', access: 'interactive' },
      provenance: { manifestAvailable: true },
      publicationEligible: null,
      boundaries: [],
      boundarySummary: '项目人口、关系、运行合同与已提交时间步',
    },
  }),
  results: defineProductRouteMeta({
    navId: 'results',
    title: '案例中心',
    source: offlineHeroSource,
  }),
  workbench: defineProductRouteMeta({
    navId: 'workbench',
    title: '项目工作台',
    source: {
      key: 'live-api',
      mode: 'live_api',
      label: 'Live API',
      verification: 'unverified',
      freshness: { status: 'unknown' },
      availability: { backend: 'unknown', access: 'interactive' },
      provenance: { manifestAvailable: false },
      publicationEligible: null,
      boundarySummary: '运行服务与项目状态',
    },
  }),
  system: defineProductRouteMeta({
    navId: 'system',
    title: '系统与数据',
    source: {
      key: 'system-readiness',
      mode: 'live_api',
      label: 'System Readiness（后端探测）',
      verification: 'unverified',
      freshness: { status: 'unknown' },
      availability: { backend: 'unknown', access: 'readonly' },
      provenance: { manifestAvailable: false },
      publicationEligible: null,
      boundarySummary: '系统页展示真实就绪门禁与已验证离线资产；静态架构描述不冒充当前状态。',
    },
  }),
})
