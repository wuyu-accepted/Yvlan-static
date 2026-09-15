<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  clearProviderConfig,
  getEvidenceSnapshot,
  getLiveRuntimeCapability,
  getProviderConfig,
  getWorkbenchHealth,
  getWorkbenchReadiness,
  listEvidenceReleases,
  listEvidenceSnapshots,
  registerEvidenceRelease,
  saveProviderConfig,
  testProviderConfig,
} from '../services/campusPulseApi'
import type { ApiProblem } from '../campus-pulse/contracts/api.ts'
import SystemEvidenceTab from '../campus-pulse/system/SystemEvidenceTab.vue'
import SystemProviderTab from '../campus-pulse/system/SystemProviderTab.vue'
import SystemReadinessTab from '../campus-pulse/system/SystemReadinessTab.vue'
import {
  DEFAULT_SYSTEM_TAB,
  evidenceReleasesFromPayload,
  evidenceSnapshotDetailFromPayload,
  evidenceSnapshotsFromPayload,
  gatesFromPayloads,
  hasForbiddenEvidenceKey,
  nowIso,
  runtimeCapabilitiesFrom,
  systemTabFromQuery,
  verifyOfflineHeroAsset,
  versionsFromPayloads,
  type EvidenceReleaseVM,
  type EvidenceSnapshotDetailVM,
  type EvidenceSnapshotVM,
  type SystemStatusVM,
  type SystemTab,
} from '../campus-pulse/system/systemViewModel.ts'

const route = useRoute()
const router = useRouter()
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'
const systemTabs = publicDemo
  ? [
      { id: 'readiness', label: '就绪状态' },
      { id: 'evidence', label: '证据目录' },
      { id: 'disclosure', label: '架构与边界' },
    ]
  : [
      { id: 'readiness', label: '就绪状态' },
      { id: 'evidence', label: '证据目录' },
      { id: 'provider', label: '模型配置' },
      { id: 'disclosure', label: '架构与边界' },
    ]

const initialTab = systemTabFromQuery(route.query.tab)
const tab = ref<SystemTab>(publicDemo && initialTab === 'provider' ? 'disclosure' : initialTab)
const snapshotId = ref<string>(typeof route.query.snapshot === 'string' ? route.query.snapshot : '')

watch(
  () => route.query,
  (query) => {
    const requested = systemTabFromQuery(query.tab)
    tab.value = publicDemo && requested === 'provider' ? 'disclosure' : requested
    snapshotId.value = typeof query.snapshot === 'string' ? query.snapshot : ''
  },
)

function selectTab(next: SystemTab) {
  const query: Record<string, string> = { ...(route.query as Record<string, string>), tab: next }
  if (next !== 'evidence') delete query.snapshot
  void router.replace({ query })
}
function selectSnapshot(id: string) {
  void router.replace({ query: { ...(route.query as Record<string, string>), tab: 'evidence', snapshot: id } })
}
function clearSnapshot() {
  const query = { ...(route.query as Record<string, string>) }
  delete query.snapshot
  void router.replace({ query })
}

// ---- readiness probes ---------------------------------------------------
const status = ref<SystemStatusVM | null>(null)
const probing = ref(false)
const probeError = ref<ApiProblem | null>(null)
const lastCheckedAt = ref('')
let probeToken = 0

async function probe() {
  const token = ++probeToken
  probing.value = true
  probeError.value = null
  const checkedAt = nowIso()
  const settled = await Promise.allSettled([
    getWorkbenchHealth(),
    getWorkbenchReadiness(),
    getLiveRuntimeCapability(),
  ])
  const values = settled.map((entry) => (entry.status === 'fulfilled' ? entry.value : null))
  const [health, readiness, capability] = values as [unknown, unknown, unknown]
  const failed = settled.filter((entry) => entry.status === 'rejected').length
  const apiStatus = failed === 0 ? 'available' : failed < 3 ? 'degraded' : 'unavailable'
  const detail = apiStatus === 'available'
    ? '服务探测均返回真实状态'
    : apiStatus === 'degraded'
      ? '部分状态探测失败；未知状态保持未知'
      : '后端不可达；当前只读，未知状态保持未知'
  const previous = status.value
  let gates = gatesFromPayloads(health, readiness, capability, checkedAt)
  let capabilities = runtimeCapabilitiesFrom(capability)
  let versions = versionsFromPayloads(health, readiness, capability)
  if (apiStatus === 'unavailable' && previous?.gates.length) {
    gates = previous.gates.map((gate) => ({ ...gate, checkedAt }))
    capabilities = previous.runtimeCapabilities
    versions = previous.versions
  }
  status.value = {
    api: { status: apiStatus, detail, lastCheckedAt: checkedAt, retryable: true },
    gates,
    runtimeCapabilities: capabilities,
    offlineAssets: previous?.offlineAssets ?? [],
    versions,
    freshness: apiStatus === 'available' ? 'fresh' : 'stale',
  }
  lastCheckedAt.value = checkedAt
  probing.value = false
  const hero = await verifyOfflineHeroAsset()
  if (token === probeToken && status.value) {
    status.value = { ...status.value, offlineAssets: [hero] }
  }
}

// ---- evidence -----------------------------------------------------------
const releases = ref<EvidenceReleaseVM[] | null>(null)
const releasesLoading = ref(false)
const releasesError = ref<ApiProblem | null>(null)
const snapshots = ref<EvidenceSnapshotVM[] | null>(null)
const snapshotsLoading = ref(false)
const snapshotsError = ref<ApiProblem | null>(null)
const detail = ref<EvidenceSnapshotDetailVM | null>(null)
const detailLoading = ref(false)
const detailError = ref<ApiProblem | null>(null)
const registering = ref(false)
const registerError = ref<ApiProblem | null>(null)

// ---- machine-local Provider settings -----------------------------------
const providerConfig = ref<any | null>(null)
const providerLoading = ref(false)
const providerSaving = ref(false)
const providerTesting = ref(false)
const providerClearing = ref(false)
const providerError = ref<ApiProblem | null>(null)
const providerTestResult = ref<any | null>(null)

async function loadProviderConfig() {
  providerLoading.value = true
  providerError.value = null
  try {
    providerConfig.value = await getProviderConfig()
  } catch (error) {
    providerConfig.value = null
    providerError.value = error as ApiProblem
  } finally {
    providerLoading.value = false
  }
}

async function persistProviderConfig(payload: Record<string, unknown>) {
  providerSaving.value = true
  providerError.value = null
  providerTestResult.value = null
  try {
    providerConfig.value = await saveProviderConfig(payload)
  } catch (error) {
    providerError.value = error as ApiProblem
  } finally {
    providerSaving.value = false
  }
}

async function runProviderTest() {
  providerTesting.value = true
  providerError.value = null
  providerTestResult.value = null
  try {
    providerTestResult.value = await testProviderConfig()
  } catch (error) {
    providerError.value = error as ApiProblem
  } finally {
    providerTesting.value = false
  }
}

async function removeProviderConfig() {
  providerClearing.value = true
  providerError.value = null
  providerTestResult.value = null
  try {
    providerConfig.value = await clearProviderConfig()
  } catch (error) {
    providerError.value = error as ApiProblem
  } finally {
    providerClearing.value = false
  }
}

async function loadReleases() {
  releasesLoading.value = true
  releasesError.value = null
  try {
    const payload = await listEvidenceReleases()
    releases.value = evidenceReleasesFromPayload(payload)
  } catch (error) {
    releases.value = null
    releasesError.value = error as ApiProblem
  } finally {
    releasesLoading.value = false
  }
}

async function loadSnapshots() {
  snapshotsLoading.value = true
  snapshotsError.value = null
  try {
    const payload = await listEvidenceSnapshots()
    snapshots.value = evidenceSnapshotsFromPayload(payload)
  } catch (error) {
    snapshots.value = null
    snapshotsError.value = error as ApiProblem
  } finally {
    snapshotsLoading.value = false
  }
}

async function loadDetail(id: string) {
  detailLoading.value = true
  detailError.value = null
  try {
    const payload = await getEvidenceSnapshot(id)
    const hit = hasForbiddenEvidenceKey(payload)
    if (hit) {
      detailError.value = {
        name: 'ApiProblem',
        kind: 'verification',
        code: 'forbidden_evidence_field',
        summary: '证据载荷包含不应公开的字段',
        detail: '已拒绝渲染（字段：' + hit + '）',
        retryable: false,
        action: 'inspect_evidence',
        fieldErrors: [],
        sourceImpact: 'unverified',
      } as ApiProblem
      detail.value = null
      return
    }
    detail.value = evidenceSnapshotDetailFromPayload(payload)
  } catch (error) {
    detail.value = null
    detailError.value = error as ApiProblem
  } finally {
    detailLoading.value = false
  }
}

async function registerRelease(releaseKey: string) {
  if (registering.value) return
  registering.value = true
  registerError.value = null
  try {
    await registerEvidenceRelease(releaseKey)
    await Promise.all([loadSnapshots(), loadReleases()])
  } catch (error) {
    registerError.value = error as ApiProblem
  } finally {
    registering.value = false
  }
}

async function refreshAll() {
  await Promise.all([
    probe(),
    loadReleases(),
    loadSnapshots(),
    ...(publicDemo ? [] : [loadProviderConfig()]),
  ])
}

watch(
  () => snapshotId.value,
  (id) => {
    if (id && tab.value === 'evidence') void loadDetail(id)
    if (!id) {
      detail.value = null
      detailError.value = null
    }
  },
)

onMounted(() => {
  void refreshAll()
})

onBeforeUnmount(() => {
  probeToken += 1
})

const disclosureSections = [
  {
    title: '数据与生态',
    lines: ['语料与生态快照只以哈希、行数与规模进入证据目录，不保留原始帖子/评论正文。', '合成关系图仅用于论坛语义行为展示，不代表真实人际关系。'],
  },
  {
    title: '合成 Agent 人口',
    lines: ['合成 Agent 是 episode 驱动的仿真主体，不是真实学生；状态粒子不是额外用户。', '不推断性别、院系、年龄或真实身份；不展示私有记忆与 source ID。'],
  },
  {
    title: '运行时职责',
    lines: ['LLM 负责公开社会表达与治理判断；后台模型负责状态、调度与资源账本，禁止生成公开论坛文字。', '确定性 fixture 路径禁止 Provider 调用、外部下载与因果结论声明。'],
  },
  {
    title: '结果与发布',
    lines: ['单场景、单种子 Hero 结果只作展示，不代表总体政策效果、全校民意或正式因果结论。', '正式发布需通过报告与发布门禁；失败、noop 与无响应保留为一等结果。'],
  },
]
</script>

<template>
  <div class="system-workspace">
    <header class="page-header">
      <div>
        <span class="page-kicker">SYSTEM READINESS · EVIDENCE</span>
        <h1>系统与证据</h1>
        <p>集中核对服务就绪、模型连接、离线资产与证据边界。</p>
      </div>
      <div class="page-header__actions">
        <router-link to="/campus-pulse/system/innovation-evaluation" class="innovation-link">创新与评测</router-link>
        <router-link v-if="!publicDemo" to="/campus-pulse/workbench" class="workbench-link">打开运行工作台</router-link>
      </div>
    </header>

    <nav class="tab-bar" role="tablist" aria-label="系统与证据视图">
      <button
        v-for="item in systemTabs"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="tab === item.id"
        :class="{ active: tab === item.id }"
        @click="selectTab(item.id as SystemTab)"
      >{{ item.label }}</button>
    </nav>

    <SystemReadinessTab
      v-if="tab === 'readiness'"
      :status="status"
      :loading="probing"
      :error="probeError"
      :checked-at="lastCheckedAt"
      @refresh="probe"
    />

    <SystemEvidenceTab
      v-else-if="tab === 'evidence'"
      :api-status="status?.api.status ?? 'checking'"
      :releases="releases"
      :releases-loading="releasesLoading"
      :releases-error="releasesError"
      :snapshots="snapshots"
      :snapshots-loading="snapshotsLoading"
      :snapshots-error="snapshotsError"
      :selected-snapshot-id="snapshotId || undefined"
      :detail="detail"
      :detail-loading="detailLoading"
      :detail-error="detailError"
      :registering="registering"
      :register-error="registerError"
      @refresh="refreshAll"
      @register="registerRelease"
      @open-snapshot="selectSnapshot"
      @close-snapshot="clearSnapshot"
    />

    <SystemProviderTab
      v-else-if="tab === 'provider'"
      :config="providerConfig"
      :loading="providerLoading"
      :saving="providerSaving"
      :testing="providerTesting"
      :clearing="providerClearing"
      :error="providerError"
      :test-result="providerTestResult"
      @refresh="loadProviderConfig"
      @save="persistProviderConfig"
      @test="runProviderTest"
      @clear="removeProviderConfig"
    />

    <section v-else class="disclosure" aria-labelledby="disclosure-title">
      <header class="section-heading">
        <div>
          <h2 id="disclosure-title">架构与证据边界</h2>
          <p class="intro">职责与证据边界，不代表当前运行状态。</p>
        </div>
      </header>

      <div class="disclosure-grid">
        <article v-for="section in disclosureSections" :key="section.title">
          <h3>{{ section.title }}</h3>
          <ul>
            <li v-for="line in section.lines" :key="line">{{ line }}</li>
          </ul>
        </article>
      </div>

      <section class="evidence-boundary" aria-labelledby="evidence-boundary-title">
        <header>
          <h2 id="evidence-boundary-title">数据与证据边界</h2>
          <p>各类资产可以支持的判断及其限制。</p>
        </header>
        <div class="boundary-table" role="table" aria-label="数据与证据边界">
          <div class="boundary-row head" role="row">
            <span role="columnheader">对象</span><span role="columnheader">来源</span><span role="columnheader">能说明什么</span><span role="columnheader">不能说明什么</span>
          </div>
          <div class="boundary-row" role="row">
            <span role="cell"><strong>语料生态</strong></span>
            <span role="cell">哈希与规模的本地快照</span>
            <span role="cell">论坛语言、主题与回复生态的边界</span>
            <span role="cell">不是实时全校舆情</span>
          </div>
          <div class="boundary-row" role="row">
            <span role="cell"><strong>公开论坛文字</strong></span>
            <span role="cell">授权 live LLM / exact trace</span>
            <span role="cell">合成人物在上下文中的语义行为</span>
            <span role="cell">不是人类真实意见</span>
          </div>
          <div class="boundary-row" role="row">
            <span role="cell"><strong>合成关系图</strong></span>
            <span role="cell">主题、互动风格与桥接需求</span>
            <span role="cell">行为驱动的结构模式</span>
            <span role="cell">不是真实社交网络</span>
          </div>
          <div class="boundary-row" role="row">
            <span role="cell"><strong>治理结果</strong></span>
            <span role="cell">自然演化 / D 治理介入的配对仿真</span>
            <span role="cell">低风险语义压力测试记录</span>
            <span role="cell">不是正式因果结论或总体政策效果</span>
          </div>
        </div>
        <p class="boundary-note">本页面不展示原始正文、source ID、私有向量索引或 API 凭据；离线资产未通过哈希校验时不会展示为已验证。</p>
      </section>
    </section>
  </div>
</template>

<style scoped>
.system-workspace {
  --cp-surface-canvas:#0b090a; --cp-surface-default:#151113; --cp-surface-subtle:#1c1719; --cp-surface-raised:#1c1719; --cp-surface-inverse:#080708; --cp-surface-selected:#29171d;
  --cp-text-primary:#f1ece7; --cp-text-secondary:#b9b0aa; --cp-text-muted:#9e958f; --cp-text-inverse:#f1ece7;
  --cp-border-default:#2a2428; --cp-border-subtle:#241f22; --cp-border-strong:#51464c; --cp-border-inverse:#2a2428;
  --cp-action-primary:#c51642; --cp-action-primary-hover:#a91137;
  --cp-evidence:#d4af37; --cp-evidence-surface:#211d12; --cp-evidence-text:#e2c65f;
  --cp-info:#2b6cb0; --cp-info-surface:#111c27; --cp-warning:#dd6b20; --cp-warning-surface:#26180f; --cp-danger:#e53e3e; --cp-danger-surface:#281214;
  --cp-tech:#9e958f; --cp-tech-bright:#b9b0aa; --cp-tech-surface:#1c1719; --cp-tech-line:#2a2428; --cp-tech-glow:none; --cp-shadow-card:none;
  display:grid; width:100%; min-height:calc(100vh - 7.5rem); gap:var(--cp-space-4); margin:0 auto; padding:var(--cp-space-4) var(--cp-content-gutter) var(--cp-space-8); background:var(--cp-surface-canvas); color:var(--cp-text-primary);
}
.page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-6); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-lg); background:var(--cp-surface-default); box-shadow:none; }
.page-kicker { display:block; margin-bottom:var(--cp-space-2); color:var(--cp-tech); font-size:var(--cp-text-xs); font-weight:800; letter-spacing:.12em; }
.page-header h1 { margin:0; font-size:var(--cp-text-3xl); line-height:1.15; letter-spacing:-.025em; }
.page-header p { margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-md); max-width:52rem; }
.page-header__actions { display:flex; flex:none; flex-wrap:wrap; gap:var(--cp-space-2); }
.innovation-link,
.workbench-link { min-height:var(--cp-control-height); display:inline-flex; align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; text-decoration:none; }
.innovation-link { border-color:var(--cp-border-strong); background:var(--cp-surface-subtle); color:var(--cp-text-secondary); }
.tab-bar { display:flex; flex-wrap:wrap; gap:var(--cp-space-1); border-bottom:1px solid var(--cp-border-default); }
.tab-bar button { min-height:var(--cp-control-height); padding:0 var(--cp-space-4); border:0; border-bottom:2px solid transparent; background:none; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.tab-bar button:hover { color:var(--cp-text-primary); }
.tab-bar button.active { border-bottom-color:var(--brand-red); color:var(--cp-text-primary); }
.disclosure { display:grid; gap:var(--cp-space-5); }
.section-heading p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.section-heading h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.section-heading .intro { margin:var(--cp-space-1) 0 0; font-weight:400; letter-spacing:0; color:var(--cp-text-secondary); }
.disclosure-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--cp-space-3); }
.disclosure-grid article { padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.disclosure-grid h3 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-md); }
.disclosure-grid ul { display:grid; gap:var(--cp-space-2); margin:0; padding-left:1.25rem; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:var(--cp-leading-normal); }
.evidence-boundary { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.evidence-boundary > header { padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.evidence-boundary h2 { margin:0; font-size:var(--cp-text-lg); }
.evidence-boundary > header p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.boundary-table { overflow-x:auto; }
.boundary-row { display:grid; min-width:48rem; grid-template-columns:.7fr 1.3fr 1.4fr 1.3fr; border-top:1px solid var(--cp-border-subtle); font-size:var(--cp-text-sm); }
.boundary-row > * { padding:var(--cp-space-3); border-left:1px solid var(--cp-border-subtle); }
.boundary-row > *:first-child { border-left:0; }
.boundary-row.head { border-top:0; background:var(--cp-surface-inverse); color:var(--cp-text-inverse); font-weight:700; }
.boundary-row.head > * { border-left-color:var(--cp-border-inverse); }
.boundary-row:not(.head) span:last-child { color:var(--cp-danger); }
.boundary-note { margin:0; padding:var(--cp-space-3) var(--cp-space-4); border-top:1px solid var(--cp-border-default); color:var(--cp-evidence-text); font-size:var(--cp-text-xs); }
@media (max-width:767px) {
  .system-workspace { max-width:100%; min-width:0; padding:var(--cp-space-4); overflow-x:clip; }
  .system-workspace > * { max-width:100%; min-width:0; }
  .page-header { flex-direction:column; align-items:flex-start; }
  .page-header__actions { width:100%; }
  .innovation-link,.workbench-link { min-height:var(--cp-touch-target); }
  .disclosure-grid { grid-template-columns:1fr; }
  .tab-bar { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); width:100%; }
  .tab-bar button { min-width:0; min-height:var(--cp-touch-target); padding-inline:var(--cp-space-2); }
  .boundary-table { overflow:visible; }
  .boundary-row { min-width:0; grid-template-columns:1fr; padding:var(--cp-space-2) var(--cp-space-3); }
  .boundary-row.head { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
  .boundary-row > * { display:grid; grid-template-columns:minmax(6.5rem,.42fr) minmax(0,1fr); gap:var(--cp-space-2); padding:var(--cp-space-2) 0; border-top:1px solid var(--cp-border-subtle); border-left:0; overflow-wrap:anywhere; }
  .boundary-row > *:first-child { border-top:0; }
  .boundary-row > *::before { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; }
  .boundary-row > *:nth-child(1)::before { content:'对象'; }
  .boundary-row > *:nth-child(2)::before { content:'来源'; }
  .boundary-row > *:nth-child(3)::before { content:'能说明什么'; }
  .boundary-row > *:nth-child(4)::before { content:'不能说明什么'; }
}
</style>
