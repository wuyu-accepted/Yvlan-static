<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getWorkbenchHealth, getWorkbenchOverview, listProjects } from '../../services/campusPulseApi.js'
import { currentLocale, useCampusPulseDomLocalization } from '../i18n/locale.ts'
import CaseStudyGallery from '../results/CaseStudyGallery.vue'
import {
  EMPTY_UNKNOWN_COUNTS,
  countsFromOverview,
  projectListFromPayload,
  type WorkbenchCounts,
  type WorkbenchProject,
} from '../workbench/workbenchViewModel.ts'

const router = useRouter()
const appRoot = ref<HTMLElement | null>(null)
useCampusPulseDomLocalization(appRoot)
const serviceState = ref<'checking' | 'available' | 'unavailable'>('checking')
const isEnglish = computed(() => currentLocale.value === 'en-US')
const counts = ref<WorkbenchCounts>({ ...EMPTY_UNKNOWN_COUNTS })
const projects = ref<WorkbenchProject[]>([])
const lastCheckedAt = ref('')
let mounted = true

const serviceLabel = computed(() => ({
  checking: '正在连接',
  available: '后端已连接',
  unavailable: '后端未连接',
}[serviceState.value]))

const latestProjects = computed(() => [...projects.value]
  .sort((left, right) => String(right.updated_at || right.created_at || '').localeCompare(String(left.updated_at || left.created_at || '')))
  .slice(0, 3))

function countLabel(value: number | null): string {
  return value === null ? '未知' : value.toLocaleString('zh-CN')
}

async function refreshSimulatorState() {
  serviceState.value = 'checking'
  const [health, overview, projectList] = await Promise.allSettled([
    getWorkbenchHealth(),
    getWorkbenchOverview(),
    listProjects(),
  ])
  if (!mounted) return
  serviceState.value = health.status === 'fulfilled' ? 'available' : 'unavailable'
  counts.value = overview.status === 'fulfilled'
    ? countsFromOverview(overview.value)
    : { ...EMPTY_UNKNOWN_COUNTS }
  projects.value = projectList.status === 'fulfilled'
    ? projectListFromPayload(projectList.value)
    : []
  lastCheckedAt.value = new Date().toISOString()
}

function openWorkbench(section?: string) {
  const project = latestProjects.value[0]
  router.push({
    name: 'campus-pulse-workbench',
    query: {
      ...(project ? { project: project.project_id } : {}),
      ...(section ? { section } : {}),
    },
  })
}

function openProjectCreator() {
  router.push({ name: 'campus-pulse-workbench', query: { create: 'century-gym' } })
}

const centuryGymProject = computed(() => projects.value.find((project) => (
  /世纪馆|体育场地预约|幽灵预约|Century Gym/i.test(`${project.name} ${project.governance_domain} ${project.objective}`)
)) || null)

function openCenturyGymProject() {
  if (centuryGymProject.value) {
    router.push({
      name: 'campus-pulse-workbench',
      query: { project: centuryGymProject.value.project_id, section: 'overview' },
    })
    return
  }
  openProjectCreator()
}

onMounted(() => {
  void refreshSimulatorState()
  document.title = 'CampusPulse · 校园论坛社会模拟与治理预演'
})

watch(currentLocale, () => {
  document.title = currentLocale.value === 'en-US'
    ? 'CampusPulse · Campus forum social simulation'
    : 'CampusPulse · 校园论坛社会模拟与治理预演'
})

onBeforeUnmount(() => { mounted = false })

const workflow = [
  { number: '01', title: '定义事件', detail: '写清发生了什么、何时进入论坛、哪些信息已知，以及哪些事实仍有争议。', section: 'scenarios' },
  { number: '02', title: '绑定社会人口', detail: '选用审阅语料构建的 1,000 个 LLM Agent，保留 profile、记忆、立场和行为边界。', section: 'evidence' },
  { number: '03', title: '配置论坛与治理', detail: '使用全局热榜前十与最新帖 Feed，并为治理主体配置证据卡、服务工单和跨群触达。', section: 'policies' },
  { number: '04', title: '确认运行参数', detail: '选择分支、模型、种子、并发与 Token 上限；核对预览后启动运行。', section: 'plan' },
  { number: '05', title: '运行与观察', detail: '查看 LLM 调用、帖子、Claim、治理动作、资源账本和分支分叉。', section: 'runs' },
]
</script>

<template>
  <div ref="appRoot" class="simulator-home">
    <header class="simulator-heading">
      <div class="simulator-heading__copy">
        <div class="hero-kicker"><span>YULAN FORUMTWIN</span><i /> <small>LLM SOCIAL SIMULATION</small></div>
        <h1>在政策发布前，<br><em>先看见舆论如何发生。</em></h1>
        <p>把校园事件放进一个可审计的平行论坛：异质 LLM Agent 阅读同一热榜、形成不同解释、互相回复与求助；治理主体依据有限信息行动，系统实时呈现论坛如何分叉。</p>
        <div class="hero-facts" aria-label="平台关键能力">
          <span><strong>1,000</strong> 持久 Agent</span>
          <span><strong>120</strong> 微角色</span>
          <span><strong>≤67</strong> 单步 LLM 预算</span>
        </div>
      </div>
      <div class="simulator-heading__actions">
        <button type="button" class="primary-action" @click="openProjectCreator"><i class="fa-solid fa-plus" aria-hidden="true" /> 创建模拟项目</button>
        <RouterLink class="secondary-action" to="/campus-pulse/results"><i class="fa-solid fa-play" aria-hidden="true" /> 查看案例结果</RouterLink>
      </div>
    </header>

    <section class="entry-panel" aria-labelledby="entry-title">
      <header>
        <div>
          <span>START HERE · 选择入口</span>
          <h2 id="entry-title">你现在想完成什么？</h2>
        </div>
        <p>首页负责说明能力与边界；具体任务从下面三个入口开始。</p>
      </header>
      <nav class="entry-grid" aria-label="产品任务入口">
        <button type="button" @click="openWorkbench()">
          <i class="fa-solid fa-sliders" aria-hidden="true" />
          <span><small>BUILD · 项目</small><strong>创建或继续一次推演</strong><em>配置事件、Agent 人口、治理方案与运行参数</em></span>
          <b class="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
        <a href="#overview-engine">
          <i class="fa-solid fa-diagram-project" aria-hidden="true" />
          <span><small>ENGINE · 系统逻辑</small><strong>理解模拟如何产生结果</strong><em>查看事件、Agent 与论坛机制如何形成可核验输出</em></span>
          <b class="fa-solid fa-arrow-right" aria-hidden="true" />
        </a>
        <a href="#overview-verify">
          <i class="fa-solid fa-shield-halved" aria-hidden="true" />
          <span><small>VERIFY · 案例</small><strong>研究已验证的治理案例</strong><em>比较分支差异，并回到证据与完整运行记录</em></span>
          <b class="fa-solid fa-arrow-right" aria-hidden="true" />
        </a>
      </nav>
    </section>

    <section class="simulator-status" aria-labelledby="status-title">
      <div class="status-intro">
        <span class="status-orbit" :class="serviceState" aria-hidden="true"><i /></span>
        <div>
          <span class="status-eyebrow">RUNTIME STATUS</span>
          <h2 id="status-title">仿真控制台</h2>
          <p>{{ serviceLabel }}<template v-if="lastCheckedAt"> · {{ new Date(lastCheckedAt).toLocaleTimeString('zh-CN') }}</template></p>
        </div>
        <button type="button" class="text-button" @click="refreshSimulatorState">刷新</button>
      </div>
      <dl class="status-counts">
        <div><dt>项目</dt><dd>{{ countLabel(counts.projects) }}</dd></div>
        <div><dt>场景</dt><dd>{{ countLabel(counts.scenarios) }}</dd></div>
        <div><dt>治理方案</dt><dd>{{ countLabel(counts.policies) }}</dd></div>
        <div><dt>运行</dt><dd>{{ countLabel(counts.runs) }}</dd></div>
      </dl>
      <p v-if="serviceState === 'unavailable'" class="status-boundary">后端未连接时不显示伪造项目或运行状态；你仍可查看已校验的案例结果。</p>
      <div v-else-if="latestProjects.length" class="recent-projects">
        <strong>最近项目</strong>
        <button v-for="project in latestProjects" :key="project.project_id" type="button" @click="router.push({ name: 'campus-pulse-workbench', query: { project: project.project_id, section: 'overview' } })">
          <span>{{ project.name }}</span><small>{{ project.governance_domain }}</small>
        </button>
      </div>
    </section>

    <section id="overview-build" class="workflow-section overview-chapter" aria-labelledby="workflow-title">
      <header class="section-heading">
        <div>
          <span class="section-label">CREATE · 构建推演</span>
          <h2 id="workflow-title">五步完成一次可审计的社会模拟</h2>
          <p>从事件定义到运行参数，依次完成事件、治理方案和模型预算设置。</p>
        </div>
        <button type="button" class="text-button" @click="openWorkbench()">打开编排工作台</button>
      </header>
      <ol class="workflow-list">
        <li v-for="step in workflow" :key="step.number">
          <button type="button" @click="openWorkbench(step.section)">
            <span class="workflow-number">{{ step.number }}</span>
            <span class="workflow-copy"><strong>{{ step.title }}</strong><small>{{ step.detail }}</small></span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </li>
      </ol>
    </section>

    <section id="overview-engine" class="engine-section overview-chapter" aria-labelledby="engine-title">
      <header class="section-heading">
        <div>
          <span class="section-label">ENGINE · 系统逻辑</span>
          <h2 id="engine-title">输入如何经过论坛机制，变成可检查的结果</h2>
          <p>LLM 负责人物表达，确定性内核负责时间、可见性、资源和证据约束。</p>
        </div>
        <RouterLink class="text-link" to="/campus-pulse/system?tab=disclosure">查看数据与模型边界</RouterLink>
      </header>
      <div class="engine-flow">
        <article>
          <span class="engine-index">输入</span>
          <h3>事件、人口与上下文</h3>
          <ul>
            <li>1,000 个持久 LLM Agent</li>
            <li>120 个微角色、22,477 个 Profile bundle</li>
            <li>人物记忆、历史 episode focus 与时间可见帖子</li>
          </ul>
        </article>
        <article class="engine-core">
          <span class="engine-index">运行</span>
          <h3>论坛与有限观测治理</h3>
          <ul>
            <li>全局热榜前十 + 最新帖，不做个性化推荐</li>
            <li>每时点最多 64 个居民 LLM + 3 个治理 LLM</li>
            <li>发帖、回复、引用、纠错、求助与服务回执均来自 LLM / exact trace</li>
          </ul>
        </article>
        <article>
          <span class="engine-index">输出</span>
          <h3>可检查的平行世界</h3>
          <ul>
            <li>论坛帖子、讨论串与 Claim 谱系</li>
            <li>治理决策、资源与居民承接</li>
            <li data-no-localize>{{ isEnglish
              ? 'No added response, standards explanation, service handoff, cross-group outreach, and combined governance, with multi-seed interval comparisons'
              : '不追加回应、规则解释、服务承接、跨群触达与组合治理，并支持多种子区间比较' }}</li>
          </ul>
        </article>
      </div>
      <p class="engine-boundary">10,000 个状态粒子用于表达同一批 Agent 的状态不确定性，不是额外用户；普通 Dynamics 不能生成公开帖子。</p>
      <div class="engine-more">
        <div>
          <strong>为什么这套模拟值得信任？</strong>
          <span>查看 SMC 认知闭环、平行孪生设计、真实性评测与适用边界。</span>
        </div>
        <RouterLink class="engine-more__link" to="/campus-pulse/system/innovation-evaluation">
          了解创新机制与评测 <i class="fa-solid fa-arrow-right" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <section id="overview-observe" class="live-scenario" aria-labelledby="live-scenario-title">
      <div class="live-scenario__visual" aria-hidden="true"><i v-for="index in 12" :key="index" :style="{ '--i':index }" /><b /></div>
      <div>
        <span class="section-label" data-no-localize>{{ isEnglish ? 'OBSERVE · Live project' : 'OBSERVE · 观察演化' }}</span>
        <h2 id="live-scenario-title">世纪馆“幽灵预约”争议</h2>
        <p>作为视频现场演示工程：先在工作台创建并确认项目，再由你点击启动；系统从 Tick 0 装载人口与论坛，随后逐 Tick 呈现真实 LLM Agent 的发帖、回复、互动和治理动作。</p>
        <ul><li data-no-localize>{{ isEnglish ? 'Complete Tick 0–10 timeline' : 'Tick 0–10 完整过程' }}</li><li>全局热榜前十与最新帖</li><li data-no-localize>{{ isEnglish ? 'Parallel comparison of no added response and combined governance' : '不追加治理回应与组合治理的平行对照' }}</li></ul>
      </div>
      <div class="live-scenario__actions"><button type="button" @click="openCenturyGymProject">{{ centuryGymProject ? '进入现场项目' : '创建现场项目' }}</button><RouterLink class="secondary" data-no-localize to="/campus-pulse/workbench">{{ isEnglish ? 'Open workbench' : '打开工作台' }}</RouterLink></div>
    </section>

    <div id="overview-verify" class="case-chapter">
      <CaseStudyGallery />
    </div>
  </div>
</template>

<style scoped>
.simulator-home { display:grid; width:min(100%,var(--cp-content-max)); gap:var(--cp-space-6); margin:0 auto; padding:var(--cp-space-5) var(--cp-content-gutter) var(--cp-space-8); color:var(--cp-text-primary); }
.simulator-heading { position:relative; isolation:isolate; display:flex; min-height:22rem; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-8); overflow:hidden; padding:3.2rem 3.2rem 2.8rem; border:1px solid var(--cp-hero-border); border-radius:var(--cp-radius-lg); background:radial-gradient(circle at 84% 12%,rgba(174,11,42,.38),transparent 22rem),radial-gradient(circle at 18% 100%,rgba(155,138,92,.17),transparent 24rem),linear-gradient(135deg,var(--cp-hero-surface-start) 0%,var(--cp-hero-surface-mid) 58%,var(--cp-hero-surface-end) 100%); box-shadow:var(--cp-shadow-floating); color:var(--cp-hero-text); }
.simulator-heading::before { position:absolute; inset:0; z-index:-1; background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px); background-size:34px 34px; content:''; mask-image:linear-gradient(to right,black,transparent 82%); }
.simulator-heading::after { position:absolute; right:7%; top:15%; z-index:-1; width:11rem; height:11rem; border:1px solid rgba(255,255,255,.09); border-radius:50%; box-shadow:0 0 0 2.5rem rgba(255,255,255,.025),0 0 0 5rem rgba(255,255,255,.015); content:''; }
.simulator-heading__copy { max-width:55rem; }
.hero-kicker { display:flex; align-items:center; gap:.7rem; margin-bottom:var(--cp-space-4); color:var(--cp-hero-text-soft); font-size:.67rem; font-weight:800; letter-spacing:.14em; }
.hero-kicker i { width:2.5rem; height:1px; background:linear-gradient(90deg,var(--brand-red),transparent); }
.hero-kicker small { color:var(--cp-hero-text-dim); font-size:.62rem; }
.section-label { display:block; margin-bottom:var(--cp-space-3); color:var(--cp-tech); font-size:var(--cp-text-sm); font-weight:800; letter-spacing:.1em; }
.simulator-heading h1 { margin:0; font-size:clamp(2rem,3.5vw,3.7rem); font-weight:680; letter-spacing:-.045em; line-height:1.05; }
.simulator-heading h1 em { color:var(--cp-hero-text-emphasis); font-style:normal; }
.simulator-heading p { max-width:49rem; margin:var(--cp-space-5) 0 0; color:var(--cp-hero-text-secondary); font-size:.94rem; line-height:1.75; }
.hero-facts { display:flex; flex-wrap:wrap; gap:.55rem 1.5rem; margin-top:var(--cp-space-5); color:var(--cp-hero-text-muted); font-size:.68rem; letter-spacing:.035em; }
.hero-facts span { display:inline-flex; align-items:baseline; gap:.35rem; }
.hero-facts strong { color:var(--cp-hero-text); font-size:.9rem; font-variant-numeric:tabular-nums; }
.simulator-heading__actions { display:grid; width:12rem; flex:none; gap:var(--cp-space-2); }
.entry-panel { display:grid; gap:var(--cp-space-4); padding:var(--cp-space-5); border:1px solid var(--cp-tech-line); border-radius:var(--cp-radius-lg); background:var(--cp-surface-default); box-shadow:var(--cp-tech-glow); }
.entry-panel>header { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-5); }
.entry-panel>header span { color:var(--cp-tech); font:800 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.12em; }
.entry-panel>header h2 { margin:var(--cp-space-2) 0 0; font-size:var(--cp-text-2xl); letter-spacing:-.025em; }
.entry-panel>header p { max-width:30rem; margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); text-align:right; }
.entry-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--cp-space-3); }
.entry-grid :is(a,button) { display:grid; min-width:0; min-height:9rem; grid-template-columns:2.75rem minmax(0,1fr) auto; align-items:start; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:rgba(255,255,255,.86); color:var(--cp-text-primary); font:inherit; text-align:left; text-decoration:none; box-shadow:none; cursor:pointer; transition:border-color var(--cp-motion-standard) ease,box-shadow var(--cp-motion-standard) ease,transform var(--cp-motion-standard) ease; }
.entry-grid :is(a,button):hover { border-color:var(--cp-tech-bright); box-shadow:var(--cp-shadow-card); transform:translateY(-2px); }
.entry-grid>*>i { display:grid; width:2.75rem; height:2.75rem; place-items:center; border-radius:var(--cp-radius-md); background:var(--cp-tech-surface); color:var(--cp-tech); font-size:var(--cp-text-md); }
.entry-grid>*>span { display:grid; min-width:0; gap:.35rem; }
.entry-grid small { color:var(--cp-tech); font:800 var(--cp-text-xs)/1.2 var(--cp-font-mono); letter-spacing:.08em; }
.entry-grid strong { font-size:var(--cp-text-md); line-height:1.35; }
.entry-grid em { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-style:normal; line-height:1.6; }
.entry-grid b { align-self:center; color:var(--cp-tech-bright); font-size:var(--cp-text-md); }
.primary-action,.secondary-action { display:inline-flex; min-height:3rem; align-items:center; justify-content:center; gap:var(--cp-space-2); padding:0 var(--cp-space-4); border:1px solid rgba(255,255,255,.24); border-radius:var(--cp-radius-md); font-size:var(--cp-text-sm); font-weight:750; text-decoration:none; cursor:pointer; transition:transform var(--cp-motion-standard) ease,box-shadow var(--cp-motion-standard) ease,background var(--cp-motion-standard) ease; }
.primary-action { border-color:var(--cp-hero-action-border); background:linear-gradient(135deg,var(--cp-hero-action-start),var(--cp-hero-action-end)); color:var(--cp-text-inverse); box-shadow:0 12px 30px rgba(174,11,42,.3); }
.primary-action:hover,.secondary-action:hover { transform:translateY(-2px); }
.primary-action:hover { background:linear-gradient(135deg,var(--cp-hero-action-hover-start),var(--cp-hero-action-hover-end)); box-shadow:0 16px 38px rgba(174,11,42,.4); }
.secondary-action { background:rgba(255,255,255,.07); color:var(--cp-hero-text);  }
.simulator-status { display:grid; grid-template-columns:minmax(13rem,.7fr) minmax(22rem,1.3fr); gap:var(--cp-space-4); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-raised); box-shadow:var(--cp-shadow-card);  }
.status-intro { display:flex; align-items:center; gap:var(--cp-space-3); }
.status-intro > div { min-width:0; }
.status-intro h2 { margin:0; font-size:var(--cp-text-lg); }
.status-intro p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.status-orbit { display:grid; width:2.25rem; height:2.25rem; flex:none; place-items:center; border:1px solid var(--cp-border-default); border-radius:50%; background:var(--cp-surface-subtle); }
.status-orbit i { width:.55rem; height:.55rem; border-radius:50%; background:var(--cp-text-muted); box-shadow:0 0 0 .28rem rgba(118,118,118,.1); }
.status-orbit.available i { background:var(--cp-success); box-shadow:0 0 0 .28rem rgba(40,97,64,.12),0 0 14px rgba(40,97,64,.35); }
.status-orbit.unavailable i { background:var(--cp-warning); }
.status-eyebrow { color:var(--cp-text-muted); font-size:.6rem; font-weight:750; letter-spacing:.11em; }
.text-button,.text-link { min-height:var(--cp-control-height); margin-left:auto; padding:0; border:0; background:none; color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:700; text-decoration:underline; cursor:pointer; }
.status-counts { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:0; border-left:1px solid var(--cp-border-default); }
.status-counts div { display:grid; align-content:center; gap:var(--cp-space-1); padding:0 var(--cp-space-4); border-right:1px solid var(--cp-border-subtle); }
.status-counts div:last-child { border-right:0; }
.status-counts dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.status-counts dd { margin:0; font-size:var(--cp-text-xl); font-weight:750; font-variant-numeric:tabular-nums; }
.status-boundary { grid-column:1 / -1; margin:0; padding-top:var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.recent-projects { display:flex; grid-column:1 / -1; align-items:center; gap:var(--cp-space-2); padding-top:var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); }
.recent-projects > strong { margin-right:auto; font-size:var(--cp-text-sm); }
.recent-projects button { display:grid; min-width:10rem; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); color:var(--cp-text-primary); text-align:left; cursor:pointer; }
.recent-projects button span { font-size:var(--cp-text-sm); font-weight:650; }
.recent-projects button small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.section-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-4); }
.section-heading>div { max-width:62rem; }
.section-heading h2 { margin:0; font-size:clamp(1.7rem,2.4vw,var(--cp-text-2xl)); letter-spacing:-.025em; line-height:1.2; }
.section-heading p { max-width:52rem; margin:var(--cp-space-2) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-md); line-height:1.7; }
.workflow-section,.engine-section,.case-section { display:grid; gap:var(--cp-space-4); }
.overview-chapter { scroll-margin-top:var(--cp-space-6); padding-top:var(--cp-space-6); border-top:1px solid var(--cp-tech-line); }
.case-chapter { scroll-margin-top:var(--cp-space-6); }
.live-scenario { position:relative; display:grid; grid-template-columns:10rem minmax(0,1fr) auto; align-items:center; gap:var(--cp-space-5); overflow:hidden; padding:var(--cp-space-5); border:1px solid var(--cp-hero-border); border-radius:var(--cp-radius-lg); background:linear-gradient(125deg,var(--cp-hero-surface-start),var(--cp-hero-surface-mid) 62%,var(--cp-hero-surface-end)); color:var(--cp-hero-text); box-shadow:var(--cp-shadow-floating); }
.live-scenario__visual { position:relative; width:9rem; height:9rem; border:1px solid rgba(255,255,255,.1); border-radius:50%; }
.live-scenario__visual::before,.live-scenario__visual::after { position:absolute; inset:18%; border:1px solid color-mix(in srgb,var(--cp-hero-action-start) 45%,transparent); border-radius:50%; content:''; animation:live-orbit 2.8s ease-out infinite; }.live-scenario__visual::after{inset:34%;animation-delay:.8s}.live-scenario__visual i{--a:calc(var(--i) * 30deg);position:absolute;top:50%;left:50%;width:.25rem;height:.25rem;border-radius:50%;background:var(--cp-evidence);box-shadow:0 0 .7rem color-mix(in srgb,var(--cp-evidence) 82%,transparent);transform:rotate(var(--a)) translateX(calc(2.2rem + (var(--i) % 3) * .55rem))}.live-scenario__visual b{position:absolute;inset:47%;border-radius:50%;background:var(--cp-hero-action-start);box-shadow:0 0 1.4rem color-mix(in srgb,var(--cp-hero-action-start) 90%,transparent)}
.live-scenario h2{margin:0;font-size:var(--cp-text-2xl)}.live-scenario p{max-width:54rem;margin:var(--cp-space-2) 0;color:var(--cp-hero-text-secondary);font-size:var(--cp-text-sm);line-height:1.7}.live-scenario ul{display:flex;flex-wrap:wrap;gap:var(--cp-space-2) var(--cp-space-5);margin:var(--cp-space-3) 0 0;padding:0;list-style:none;color:var(--cp-evidence);font-size:var(--cp-text-xs)}.live-scenario__actions{display:grid;gap:var(--cp-space-2)}.live-scenario__actions :is(a,button){display:inline-flex;min-height:var(--cp-control-height);align-items:center;justify-content:center;padding:0 var(--cp-space-4);border:1px solid var(--cp-hero-action-border);background:var(--cp-action-primary);color:var(--cp-text-inverse);font-size:var(--cp-text-sm);font-weight:750;text-decoration:none;white-space:nowrap;cursor:pointer}.live-scenario__actions a.secondary{border-color:color-mix(in srgb,var(--cp-text-inverse) 22%,transparent);background:color-mix(in srgb,var(--cp-text-inverse) 6%,transparent)}
@keyframes live-orbit{0%{opacity:.9;transform:scale(.5)}100%{opacity:0;transform:scale(1.4)}}
.workflow-list { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); margin:0; padding:0; overflow:hidden; border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); box-shadow:var(--cp-shadow-card); list-style:none; background:var(--cp-surface-default); }
.workflow-list li { min-width:0; border-right:1px solid var(--cp-border-default); }
.workflow-list li:last-child { border-right:0; }
.workflow-list button { display:grid; width:100%; min-height:12rem; grid-template-rows:auto 1fr auto; gap:var(--cp-space-3); padding:var(--cp-space-4); border:0; background:transparent; color:var(--cp-text-primary); text-align:left; cursor:pointer; transition:background var(--cp-motion-standard) ease,transform var(--cp-motion-standard) ease; }
.workflow-list button:hover { background:var(--cp-surface-selected); transform:translateY(-2px); }
.workflow-number { color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:800; }
.workflow-copy { display:grid; align-content:start; gap:var(--cp-space-2); }
.workflow-copy strong { font-size:var(--cp-text-md); }
.workflow-copy small { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:var(--cp-leading-normal); }
.workflow-list i { color:var(--cp-action-primary); }
.engine-flow { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); overflow:hidden; border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-card); }
.engine-flow article { min-width:0; padding:var(--cp-space-4); border-right:1px solid var(--cp-border-default); }
.engine-flow article:last-child { border-right:0; }
.engine-flow .engine-core { border-top:3px solid var(--cp-action-primary); background:var(--cp-surface-selected); }
.engine-index { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:750; }
.engine-flow h3 { margin:var(--cp-space-2) 0 var(--cp-space-3); font-size:var(--cp-text-lg); }
.engine-flow ul { display:grid; gap:var(--cp-space-2); margin:0; padding-left:1.1rem; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:var(--cp-leading-normal); }
.engine-boundary { margin:0; padding:var(--cp-space-3); border-left:3px solid var(--cp-evidence); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); font-size:var(--cp-text-xs); }
.engine-more { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-5); padding:var(--cp-space-4) var(--cp-space-5); border:1px solid var(--cp-tech-line); border-radius:var(--cp-radius-md); background:linear-gradient(110deg,var(--cp-tech-surface),var(--cp-surface-default)); }
.engine-more>div { display:grid; gap:var(--cp-space-1); }
.engine-more strong { font-size:var(--cp-text-md); }
.engine-more span { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.engine-more__link { display:inline-flex; min-height:var(--cp-touch-target); flex:none; align-items:center; gap:var(--cp-space-2); padding:0 var(--cp-space-4); border-radius:var(--cp-radius-sm); background:var(--cp-tech); color:var(--cp-text-inverse); font-size:var(--cp-text-sm); font-weight:750; text-decoration:none; }
.engine-more__link:hover { background:var(--cp-action-primary-hover); }
.case-state { padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); color:var(--cp-text-muted); font-size:var(--cp-text-sm); }
.case-card { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(23rem,.85fr) auto; align-items:center; gap:var(--cp-space-5); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.case-card__event > span { color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:750; }
.case-card__event h3 { margin:var(--cp-space-1) 0 var(--cp-space-2); font-size:var(--cp-text-lg); line-height:var(--cp-leading-normal); }
.case-card__event p { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:var(--cp-leading-normal); }
.case-card__comparison { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin:0; border:1px solid var(--cp-border-default); }
.case-card__comparison div { display:grid; gap:var(--cp-space-1); padding:var(--cp-space-3); border-right:1px solid var(--cp-border-default); }
.case-card__comparison div:last-child { border-right:0; }
.case-card__comparison .emphasis { background:var(--cp-evidence-surface); }
.case-card__comparison dt,.case-card__comparison small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.case-card__comparison dd { margin:0; font-size:var(--cp-text-xl); font-weight:800; }
.case-card__link { display:inline-flex; min-height:var(--cp-control-height); align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:700; text-decoration:none; white-space:nowrap; }
@media (max-width:1199px) { .workflow-list { grid-template-columns:repeat(3,minmax(0,1fr)); } .workflow-list li { border-bottom:1px solid var(--cp-border-default); } .case-card { grid-template-columns:1fr; } .case-card__link { justify-self:start; } }
@media (max-width:900px) { .simulator-heading { min-height:auto; align-items:flex-start; flex-direction:column; padding:var(--cp-space-6); } .simulator-heading__actions { display:flex; width:auto; } .entry-panel>header { align-items:flex-start; flex-direction:column; } .entry-panel>header p { text-align:left; } .entry-grid { grid-template-columns:1fr; } .entry-grid :is(a,button) { min-height:auto; } .simulator-status { grid-template-columns:1fr; } .status-counts { border-top:1px solid var(--cp-border-default); border-left:0; padding-top:var(--cp-space-3); } .engine-flow { grid-template-columns:1fr; } .engine-flow article { border-right:0; border-bottom:1px solid var(--cp-border-default); } .engine-flow article:last-child { border-bottom:0; } .engine-more { align-items:flex-start; flex-direction:column; } .engine-more__link { width:100%; justify-content:center; } .live-scenario{grid-template-columns:8rem 1fr}.live-scenario__visual{width:7rem;height:7rem}.live-scenario__actions{grid-column:1/-1;display:flex} }
@media (max-width:767px) { .simulator-home { gap:var(--cp-space-5); padding:var(--cp-space-4); } .simulator-heading { padding:var(--cp-space-5); } .simulator-heading h1 { font-size:2rem; } .hero-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); } .simulator-heading__actions { display:grid; width:100%; } .primary-action,.secondary-action { min-height:var(--cp-touch-target); } .section-heading { align-items:flex-start; flex-direction:column; } .section-heading .text-link,.section-heading .text-button { margin-left:0; } .workflow-list { grid-template-columns:1fr; } .workflow-list li { border-right:0; } .workflow-list button { min-height:auto; grid-template-columns:2.2rem 1fr auto; grid-template-rows:auto; } .status-counts { grid-template-columns:repeat(2,minmax(0,1fr)); } .status-counts div { padding:var(--cp-space-2); border-bottom:1px solid var(--cp-border-subtle); } .recent-projects { align-items:stretch; flex-direction:column; } .recent-projects > strong { margin-right:0; } .recent-projects button { width:100%; } .case-card__comparison { grid-template-columns:1fr; } .case-card__comparison div { border-right:0; border-bottom:1px solid var(--cp-border-default); } .case-card__comparison div:last-child { border-bottom:0; } .live-scenario{grid-template-columns:1fr}.live-scenario__visual{display:none}.live-scenario__actions{display:grid}.live-scenario__actions :is(a,button){min-height:var(--cp-touch-target)} }
@media(prefers-reduced-motion:reduce){.live-scenario__visual::before,.live-scenario__visual::after{animation:none}}
</style>
