<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ApiProblemPanel from '../components/ApiProblemPanel.vue'
import CpSkeleton from '../components/CpSkeleton.vue'
import CpStatePanel from '../components/CpStatePanel.vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { getProjectReplay, listProjectScenarios, listProjectRuns, listProjects } from '../../services/campusPulseApi.js'
import {
  applyResultFilters,
  filtersFromQuery,
  filtersToQuery,
  type ResultFiltersVM,
  type ResultListRowVM,
} from './resultsList.ts'
import { loadResultsList, type ResultsListComposition } from './resultsListQuery.ts'
import { HERO_RESULT_KEY, HERO_SOURCE_KEY } from '../source/registry.ts'
import { publishSourceProblem } from '../source/sourceContext.ts'
import CaseStudyGallery from './CaseStudyGallery.vue'
import { currentLocale, localizeStoredText } from '../i18n/locale.ts'

const route = useRoute()
const router = useRouter()
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => isEnglish.value ? en : zh
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'
const loading = ref(true)
const composition = ref<ResultsListComposition | null>(null)
const replayRecords = ref<Array<{projectId:string; name:string; tick:number; branch:string; status:string}>>([])
const replayLoadError = ref(false)
let loadGeneration = 0

const filters = computed<ResultFiltersVM>(() => filtersFromQuery(route.query as Record<string, unknown>))
const project = computed(() => typeof route.query.project === 'string' ? route.query.project : '')
const projects = computed(() => composition.value?.projects || [])
const selectedProject = computed(() => composition.value?.selectedProject || project.value || '')
const pageResult = computed(() => {
  const rows = composition.value?.rows || []
  return applyResultFilters(rows, filters.value)
})
const recentRuns = computed(() => {
  const rows = (composition.value?.rows || []).filter((row) => row.mode === 'live_api')
  return applyResultFilters(rows, { source: '', status: '', verification: '', publication: '', q: '', sort: '-created', page: 1 }).rows.slice(0, 5)
})
const hasActiveFilters = computed(() => Boolean(
  (filters.value.source !== 'all-registered') || filters.value.status || filters.value.verification
  || filters.value.publication || filters.value.q || filters.value.sort !== '-created'
  || filters.value.page !== 1,
))
const emptyDetail = computed(() => {
  const source = filters.value.source === 'offline-hero'
    ? '住宿资源分配案例'
    : filters.value.source === 'offline-lecture'
      ? '讲座辱骂事件治理预演'
      : filters.value.source === 'live-api' ? '运行 API' : ''
  const parts = []
  if (source) parts.push(`来源：${source}`)
  if (filters.value.status) parts.push(`状态：${filters.value.status}`)
  if (filters.value.q) parts.push(`搜索：${filters.value.q}`)
  const scope = parts.length ? `（${parts.join('；')}）` : ''
  return `当前项目没有符合条件的运行记录${scope}。页面上方的两个审计案例仍可独立回放。`
})

function statusTone(status: string) {
  if (status === 'completed') return 'success' as const
  if (status === 'failed' || status === 'cancelled') return 'danger' as const
  if (status === 'pilot') return 'warning' as const
  return 'neutral' as const
}

function statusLabel(status: string) {
  return ({ completed: '已完成', failed: '失败', cancelled: '已取消', pilot: '试运行', draft: '草稿' } as Record<string, string>)[status] || status
}

function verificationLabel(verification: string) {
  return verification === 'verified' ? '已验证' : verification === 'unverified' ? '打开后校验' : verification
}

function publicationLabel(eligible: boolean | null) {
  if (eligible === true) return '可发布'
  if (eligible === false) return '审计展示'
  return '打开后确认'
}

function activityAt(row: ResultListRowVM) {
  const value = row.updatedAt || row.completedAt
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function activityLabel(row: ResultListRowVM) {
  if (row.status === 'completed') return '完成于'
  if (['running', 'queued', 'enqueued'].includes(row.status)) return '更新于'
  if (row.status === 'failed' || row.status === 'cancelled') return '结束于'
  return '创建于'
}

function actionLabel(row: ResultListRowVM) {
  if (row.status === 'completed') return '打开分析'
  if (row.status === 'failed' || row.status === 'cancelled') return '查看错误'
  if (['running', 'queued', 'enqueued'].includes(row.status)) return '查看进度'
  return '继续配置'
}

function actionLocation(row: ResultListRowVM) {
  if (row.mode !== 'live_api' || row.status === 'completed') return row.href
  return { name: 'campus-pulse-workbench', query: { project: selectedProject.value, section: 'runs', run: row.resultKey } }
}

async function load() {
  const generation = ++loadGeneration
  loading.value = true
  const next = await loadResultsList(project.value || undefined, {
    listProjects,
    listProjectRuns,
  })
  if (generation !== loadGeneration) return
  composition.value = next
  const replayResults = await Promise.allSettled(next.projects.map(async item => {
    const scenarios = await listProjectScenarios(item.projectId)
    if (!scenarios.some((scenario:any) => ['project_setup_century_gym_v1','century_gym_ghost_booking_v1'].includes(scenario.template_key))) return null
    const saved = await getProjectReplay(item.projectId)
    return saved ? { projectId:item.projectId, name:item.name, tick:saved.tick, branch:saved.branch, status:saved.status } : null
  }))
  if (generation !== loadGeneration) return
  replayRecords.value = replayResults.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : [])
  replayLoadError.value = replayResults.some(item => item.status === 'rejected' && Number(item.reason?.status || item.reason?.response?.status) !== 404)
  if (next.problem) publishSourceProblem(route.fullPath, next.problem)
  await normalizeProjectUrl(next)
  await normalizePage(next.rows)
  loading.value = false
}

async function normalizeProjectUrl(next: ResultsListComposition) {
  const expected = next.selectedProject || projects.value[0]?.projectId || ''
  if (!expected || project.value === expected) return
  await router.replace({ query: { ...route.query, project: expected } })
}

async function normalizePage(rows: ResultListRowVM[]) {
  const applied = applyResultFilters(rows, filters.value)
  if (applied.page !== filters.value.page) {
    await router.replace({ query: { ...route.query, ...filtersToQuery({ ...filters.value, page: applied.page }) } })
  }
}

function setProject(projectId: string) {
  router.push({ query: { project: projectId } })
}

function setFilter(key: keyof ResultFiltersVM, value: string | number) {
  const next = { ...filters.value, [key]: value }
  if (key !== 'page') next.page = 1
  router.replace({ query: { ...route.query, ...filtersToQuery(next) } })
}

function clearFilters() {
  router.replace({ query: { project: selectedProject.value } })
}

function openRow(row: ResultListRowVM) {
  router.push(row.href)
}

watch(
  [() => route.query.project, () => route.query.source, () => route.query.status, () => route.query.verification, () => route.query.publication, () => route.query.q, () => route.query.sort, () => route.query.page],
  load,
)

onMounted(() => {
  if (!publicDemo) load()
})
onBeforeUnmount(() => { loadGeneration += 1 })
</script>

<template>
  <div class="results-list-page">
    <header class="results-list-page__head">
      <div>
        <p class="page-eyebrow">RESULT INTELLIGENCE · AUDITED RUNS</p>
        <h1>{{ publicDemo ? '公开案例与实验结果' : '案例与运行结果' }}</h1>
        <p>{{ publicDemo ? '浏览脱敏、哈希校验的封存案例，比较自然演化与治理分支。' : '先继续最近的预演，再通过精选案例对比治理分支；需要核验时进入完整归档。' }}</p>
      </div>
      <div v-if="projects.length > 1" class="project-select">
        <label for="results-project">项目上下文</label>
        <select id="results-project" :value="selectedProject" @change="setProject(($event.target as HTMLSelectElement).value)">
          <option v-for="item in projects" :key="item.projectId" :value="item.projectId">{{ item.name }}</option>
        </select>
      </div>
    </header>

    <section v-if="!publicDemo" class="recent-runs" aria-labelledby="recent-runs-title">
      <header class="recent-runs__head">
        <div><span>{{ l('最近运行', 'RECENT RUNS') }}</span><h2 id="recent-runs-title">{{ l('继续刚才的预演', 'Continue a recent rehearsal') }}</h2></div>
        <RouterLink :to="{ name:'campus-pulse-workbench', query:{ project:selectedProject, section:'runs' } }">{{ l('进入项目工作台', 'Open workbench') }}</RouterLink>
      </header>
      <div v-if="recentRuns.length" class="recent-runs__grid">
        <article v-for="row in recentRuns" :key="row.id" class="recent-run-card">
          <div class="recent-run-card__top"><CpStatusBadge :tone="statusTone(row.status)">{{ statusLabel(row.status) }}</CpStatusBadge><small>{{ activityLabel(row) }} {{ activityAt(row) }}</small></div>
          <h3>{{ row.scenarioLabel }}</h3>
          <code>{{ row.resultKey }}</code>
          <RouterLink :to="actionLocation(row)">{{ actionLabel(row) }}</RouterLink>
        </article>
      </div>
      <div v-if="replayRecords.length" class="recent-runs__grid">
        <article v-for="record in replayRecords" :key="record.projectId" class="recent-run-card">
          <div class="recent-run-card__top"><CpStatusBadge :tone="record.status==='completed' ? 'success' : 'neutral'">{{ record.status==='completed' ? l('已完成','Completed') : l('可继续','Ready to continue') }}</CpStatusBadge><small>Tick {{ record.tick }} · {{ record.branch }}</small></div>
          <h3 data-no-localize>{{ localizeStoredText(record.name) }}</h3>
          <p>{{ l('世纪馆预约服务 · Natural / D 平行演化','Century Gym booking services · Natural / D comparison') }}</p>
          <RouterLink :to="{name:'campus-pulse-century-gym-live',query:{session:'century-gym-demo',replay_project:record.projectId,project_id:record.projectId}}">{{ record.status==='completed' ? l('查看演化与结果对比','View evolution and comparison') : l('继续预演','Continue rehearsal') }}</RouterLink>
        </article>
      </div>
      <p v-if="replayLoadError" role="alert">{{ l('部分项目进度读取失败，请刷新重试。','Some project progress could not be loaded. Refresh to retry.') }}</p>
      <CpStatePanel v-if="!loading && !recentRuns.length && !replayRecords.length && !replayLoadError" variant="empty" title="还没有项目运行" detail="从项目工作台创建预演后，最近记录会出现在这里。" primary-label="创建第一次预演" @primary="router.push('/campus-pulse/workbench')" />
    </section>

    <CaseStudyGallery />

    <template v-if="!publicDemo">
    <header class="run-library__head">
      <div>
        <span>{{ l('完整归档', 'FULL ARCHIVE') }}</span>
        <h2>{{ l('查找与核验全部结果', 'Find and verify all results') }}</h2>
      </div>
      <p>{{ l('默认展示当前项目运行与官方审计案例，可按来源、状态或关键词进一步筛选。', 'Project runs and audited cases are shown together by default; refine them by source, status, or keyword.') }}</p>
    </header>

    <div v-if="loading" class="results-list-page__loading" role="status" aria-live="polite">
      <span>正在加载结果列表…</span><CpSkeleton :rows="6" />
    </div>

    <ApiProblemPanel
      v-else-if="composition?.problem"
      :problem="composition.problem"
      :offline-available="true"
      @retry="load"
      @open-offline="router.push({ name: 'campus-pulse-result-summary', params: { resultKey: HERO_RESULT_KEY }, query: { source: HERO_SOURCE_KEY } })"
      @return-to-runs="router.push('/campus-pulse/workbench')"
      @inspect-evidence="router.push('/campus-pulse/system')"
    />

    <template v-else-if="composition">
      <div class="results-toolbar" role="toolbar" aria-label="结果列表筛选">
        <label>来源
          <select :value="filters.source" @change="setFilter('source', ($event.target as HTMLSelectElement).value)">
            <option value="">我的运行（默认）</option>
            <option value="all-registered">全部（含官方案例）</option>
            <option value="live-api">运行 API</option>
            <option value="offline-hero">住宿资源分配案例</option>
            <option value="offline-lecture">讲座辱骂事件治理预演</option>
          </select>
        </label>
        <label>状态
          <select :value="filters.status" @change="setFilter('status', ($event.target as HTMLSelectElement).value)">
            <option value="">全部</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="pilot">试运行</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <label class="search">搜索
          <input :value="filters.q" type="search" placeholder="运行 ID / 场景 / 来源" @input="setFilter('q', ($event.target as HTMLInputElement).value)" />
        </label>
        <label>排序
          <select :value="filters.sort" @change="setFilter('sort', ($event.target as HTMLSelectElement).value)">
            <option value="-created">最近更新（新→旧）</option>
            <option value="created">最近更新（旧→新）</option>
            <option value="scenario">场景</option>
            <option value="status">状态</option>
          </select>
        </label>
        <details class="advanced-filters">
          <summary>更多筛选</summary>
          <div>
            <label>发布资格<select :value="filters.publication" @change="setFilter('publication', ($event.target as HTMLSelectElement).value)"><option value="">全部</option><option value="eligible">可发布</option><option value="ineligible">不可发布</option></select></label>
            <label>校验状态<select :value="filters.verification" @change="setFilter('verification', ($event.target as HTMLSelectElement).value)"><option value="">全部</option><option value="verified">已验证</option><option value="unverified">未验证</option></select></label>
          </div>
        </details>
        <button v-if="hasActiveFilters" type="button" class="clear" @click="clearFilters">清除筛选</button>
      </div>

      <section v-if="pageResult.total" class="results-table-wrap" aria-label="结果列表">
        <table class="results-table">
          <thead>
            <tr>
              <th scope="col">场景</th>
              <th scope="col">运行 ID</th>
              <th scope="col">来源</th>
              <th scope="col">状态</th>
              <th scope="col">校验</th>
              <th scope="col">发布</th>
              <th scope="col">最近更新</th>
              <th scope="col"><span class="visually-hidden">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pageResult.rows" :key="row.id" class="results-table__row" @click="openRow(row)">
              <td data-label="场景">{{ row.scenarioLabel }}</td>
              <td data-label="运行 ID"><RouterLink :to="actionLocation(row)" class="result-key"><code>{{ row.resultKey }}</code></RouterLink></td>
              <td data-label="来源"><CpStatusBadge :tone="row.sourceKey.startsWith('offline-') ? 'warning' : 'info'">{{ row.sourceLabel }}</CpStatusBadge></td>
              <td data-label="状态"><CpStatusBadge :tone="statusTone(row.status)">{{ statusLabel(row.status) }}</CpStatusBadge></td>
              <td data-label="校验">{{ verificationLabel(row.verification) }}</td>
              <td data-label="发布"><CpStatusBadge :tone="row.publicationEligible === true ? 'success' : row.publicationEligible === false ? 'warning' : 'neutral'">{{ publicationLabel(row.publicationEligible) }}</CpStatusBadge></td>
              <td data-label="最近更新"><span class="activity-time"><small>{{ activityLabel(row) }}</small>{{ activityAt(row) }}</span></td>
              <td data-label="操作"><RouterLink class="open" :to="actionLocation(row)">{{ actionLabel(row) }}</RouterLink></td>
            </tr>
          </tbody>
        </table>
        <nav v-if="pageResult.pageCount > 1" class="pagination" aria-label="结果列表分页">
          <button type="button" :disabled="filters.page <= 1" @click="setFilter('page', filters.page - 1)">上一页</button>
          <span>第 {{ pageResult.page }} / {{ pageResult.pageCount }} 页 · {{ pageResult.total }} 条</span>
          <button type="button" :disabled="filters.page >= pageResult.pageCount" @click="setFilter('page', filters.page + 1)">下一页</button>
        </nav>
      </section>

      <CpStatePanel
        v-else
        variant="empty"
        title="没有匹配的结果"
        :detail="emptyDetail"
        primary-label="清除筛选"
        @primary="clearFilters"
      />
      <p class="list-gap">{{ composition.gap }}</p>
    </template>
    </template>
  </div>
</template>

<style scoped>
.results-list-page { width:min(100%,var(--cp-content-max)); margin:0 auto; padding:clamp(1.75rem,3vw,3rem) var(--cp-content-gutter) 4rem; color:var(--cp-text-primary); }
.results-list-page__head { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-6); margin-bottom:var(--cp-space-7); }
.results-list-page__head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.results-list-page__head .page-eyebrow { margin-bottom:var(--cp-space-2); color:var(--cp-tech); font-weight:800; letter-spacing:.12em; }
.results-list-page__head h1 { margin:0 0 var(--cp-space-2); font-size:clamp(2rem,3vw,var(--cp-text-3xl)); line-height:1.15; letter-spacing:-.03em; }
.results-list-page__head > div > p:last-child { max-width:48rem; color:var(--cp-text-secondary); font-size:var(--cp-text-md); }
.recent-runs { display:grid; gap:var(--cp-space-4); margin-bottom:3.5rem; padding:clamp(1.25rem,2vw,2rem); border:1px solid var(--cp-tech-line); border-radius:var(--cp-radius-lg); background:linear-gradient(135deg,var(--cp-surface-default),var(--cp-tech-surface)); box-shadow:var(--cp-tech-glow); }
.recent-runs__head { display:flex; align-items:end; justify-content:space-between; gap:var(--cp-space-3); }
.recent-runs__head span,.run-library__head span { color:var(--cp-tech); font-size:var(--cp-text-xs); font-weight:800; letter-spacing:.11em; }
.recent-runs__head h2 { margin:var(--cp-space-2) 0 0; font-size:var(--cp-text-xl); letter-spacing:-.015em; }
.recent-runs__head > a { color:var(--brand-red); font-weight:700; text-decoration:none; }
.recent-runs__grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(13rem,1fr)); gap:var(--cp-space-3); }
.recent-run-card { position:relative; display:grid; align-content:start; gap:var(--cp-space-2); min-width:0; padding:var(--cp-space-4); overflow:hidden; border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:rgba(255,255,255,.82); }
.recent-run-card::before { position:absolute; inset:0 auto 0 0; width:3px; background:linear-gradient(var(--cp-tech-bright),var(--brand-red)); content:''; }
.recent-run-card__top { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-2); }
.recent-run-card__top small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.recent-run-card h3 { margin:0; font-size:var(--cp-text-md); line-height:var(--cp-leading-tight); }
.recent-run-card code { overflow:hidden; color:var(--cp-text-muted); font-size:var(--cp-text-xs); text-overflow:ellipsis; }
.recent-run-card > a { justify-self:start; color:var(--brand-red); font-weight:750; text-decoration:none; }
.run-library__head { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-4); margin:4rem 0 var(--cp-space-4); padding-top:var(--cp-space-7); border-top:1px solid var(--cp-tech-line); }
.run-library__head span { color:var(--cp-tech); font-size:var(--cp-text-xs); font-weight:800; letter-spacing:.11em; }
.run-library__head h2 { margin:var(--cp-space-2) 0 0; font-size:var(--cp-text-2xl); letter-spacing:-.02em; }
.run-library__head p { max-width:42rem; margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.results-list-page__loading { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.results-list-page__loading > span { display:block; margin:var(--cp-space-4) var(--cp-space-4) 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.project-select { display:grid; gap:var(--cp-space-1); }
.project-select label { color:var(--cp-text-secondary); font-size:var(--cp-text-xs); font-weight:700; }
.project-select select { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.results-toolbar { display:flex; flex-wrap:wrap; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-card); }
.results-toolbar label { display:grid; gap:var(--cp-space-1); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); font-weight:700; }
.results-toolbar select,.results-toolbar input { min-height:var(--cp-control-height); padding:0 var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-weight:500; }
.results-toolbar label.search { min-width:16rem; }
.results-toolbar .clear { min-height:var(--cp-control-height); align-self:end; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-weight:650; }
.advanced-filters { align-self:end; position:relative; }
.advanced-filters summary { min-height:var(--cp-control-height); display:flex; align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); cursor:pointer; font-size:var(--cp-text-xs); font-weight:700; }
.advanced-filters > div { position:absolute; z-index:4; right:0; display:flex; gap:var(--cp-space-3); min-width:24rem; margin-top:var(--cp-space-1); padding:var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-card); }
.activity-time { display:grid; gap:.1rem; white-space:nowrap; }.activity-time small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.results-table-wrap { margin-top:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); overflow-x:auto; }
.results-table { width:100%; border-collapse:collapse; font-size:var(--cp-text-sm); font-variant-numeric:tabular-nums; }
.results-table th { padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-default); color:var(--cp-text-muted); font-size:var(--cp-text-xs); text-align:left; font-weight:700; }
.results-table td { padding:var(--cp-space-2) var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); vertical-align:middle; }
.results-table__row { cursor:pointer; }
.results-table__row:hover { background:var(--cp-surface-subtle); }
.result-key { color:var(--cp-text-primary); font-weight:650; text-decoration:none; }
.result-key code { font-family:var(--cp-font-mono); font-size:var(--cp-text-xs); }
.results-table .open { color:var(--brand-red); font-weight:700; text-decoration:none; white-space:nowrap; }
.pagination { display:flex; align-items:center; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-top:1px solid var(--cp-border-default); }
.pagination button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-weight:650; }
.pagination button:disabled { opacity:.5; cursor:not-allowed; }
.pagination span { color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.list-gap { margin:var(--cp-space-3) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (max-width:1023px) { .results-table-wrap { overflow-x:auto; } }
@media (max-width:767px) {
  .results-list-page { max-width:100%; min-width:0; padding:var(--cp-space-4); overflow-x:clip; }
  .results-list-page__head { align-items:stretch; flex-direction:column; }
  .recent-runs__head { align-items:flex-start; flex-direction:column; }
  .results-list-page__head h1 { font-size:var(--cp-text-2xl); }
  .run-library__head { align-items:flex-start; flex-direction:column; }
  .results-toolbar { display:grid; grid-template-columns:1fr 1fr; }
  .results-toolbar label.search { grid-column:1 / -1; min-width:0; }
  .advanced-filters > div { position:static; display:grid; min-width:0; }
  .results-toolbar select,.results-toolbar input,.results-toolbar .clear,.project-select select { min-height:var(--cp-touch-target); }
  .results-table-wrap { overflow:visible; border:0; background:transparent; }
  .results-table,.results-table tbody,.results-table tr,.results-table td { display:block; width:100%; min-width:0; }
  .results-table thead { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
  .results-table tbody { display:grid; gap:var(--cp-space-3); }
  .results-table__row { padding:var(--cp-space-3); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-card); }
  .results-table td { display:grid; grid-template-columns:minmax(6.5rem,.42fr) minmax(0,1fr); align-items:start; gap:var(--cp-space-2); padding:var(--cp-space-2) 0; border-top:1px solid var(--cp-border-subtle); overflow-wrap:anywhere; }
  .results-table td:first-child { padding-top:0; border-top:0; }
  .results-table td::before { content:attr(data-label); color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; }
  .results-table .open { white-space:normal; }
  .pagination { justify-content:space-between; flex-wrap:wrap; margin-top:var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
}
</style>
