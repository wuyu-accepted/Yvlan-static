<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { currentLocale } from '../i18n/locale.ts'
import { listProjectRuns, listProjects, readableApiError } from '../../services/campusPulseApi'
import { projectListFromPayload, runListFromPayload, type WorkbenchProject, type RunSummary } from '../workbench/workbenchViewModel'

type ProjectCard = WorkbenchProject & { runs: RunSummary[] }
const router = useRouter()
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh
const cards = ref<ProjectCard[]>([])
const loading = ref(true)
const error = ref('')

const readyCount = computed(() => cards.value.filter(card => card.runs.length > 0).length)

function latestRun(card: ProjectCard) {
  return card.runs[0]
}

function status(card: ProjectCard) {
  const run = latestRun(card)
  return run?.runtime?.status || (run ? 'Ready' : 'Draft')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const projects = projectListFromPayload(await listProjects())
    cards.value = await Promise.all(projects.map(async project => {
      try {
        const runs = runListFromPayload(await listProjectRuns(project.project_id))
        return { ...project, runs }
      } catch {
        return { ...project, runs: [] }
      }
    }))
  } catch (reason) {
    error.value = readableApiError(reason)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="project-center">
    <header class="hero">
      <div>
        <p class="eyebrow">CAMPUSPULSE · PROJECTS</p>
        <h1>{{ l('项目中心', 'Project Center') }}</h1>
        <p>{{ l('从项目进入 Agent 世界、事件情景、治理方案与运行合同。', 'Open a project to configure its Agent world, incident scenario, governance plans, and run contract.') }}</p>
      </div>
      <button class="primary" type="button" @click="router.push({ name: 'campus-pulse-project-new' })">{{ l('新建项目', 'New project') }}</button>
    </header>

    <section class="summary" :aria-label="l('项目摘要', 'Project summary')">
      <span><b>{{ cards.length }}</b> {{ l('个项目', 'projects') }}</span>
      <span><b>{{ readyCount }}</b> {{ l('个已生成运行合同', 'run contracts generated') }}</span>
      <span><b>1,000</b> {{ l('Agent 固定世界可用', 'Agent fixed world available') }}</span>
    </section>

    <p v-if="loading" class="state">{{ l('正在同步项目…', 'Syncing projects…') }}</p>
    <div v-else-if="error" class="state error" role="alert">{{ error }} <button type="button" @click="load">{{ l('重试', 'Retry') }}</button></div>
    <section v-else-if="cards.length" class="grid" :aria-label="l('项目列表', 'Project list')">
      <article v-for="card in cards" :key="card.project_id" class="card">
        <div class="card-top"><span>{{ status(card) }}</span><small>{{ card.evaluation_mode }}</small></div>
        <h2 data-no-localize>{{ card.name }}</h2>
        <p class="domain" data-no-localize>{{ card.governance_domain }}</p>
        <p class="objective" data-no-localize>{{ card.objective }}</p>
        <dl>
          <div><dt>{{ l('运行', 'Runs') }}</dt><dd>{{ card.runs.length }}</dd></div>
          <div><dt>{{ l('最近状态', 'Latest status') }}</dt><dd>{{ latestRun(card)?.runtime?.status || l('尚未计划', 'Not planned') }}</dd></div>
        </dl>
        <div class="actions">
          <button type="button" @click="router.push({ name:'campus-pulse-project-overview', params:{ id:card.project_id } })">{{ l('继续配置', 'Continue setup') }}</button>
          <button v-if="latestRun(card)" type="button" @click="router.push({ name:'campus-pulse-run-live', params:{ runId:latestRun(card)?.run_id }, query:{ project:card.project_id } })">{{ l('进入运行', 'Open run') }}</button>
        </div>
      </article>
    </section>
    <section v-else class="empty">
      <div class="empty-index" aria-hidden="true">01</div>
      <div class="empty-copy">
        <p class="empty-label">START A GOVERNANCE PROJECT</p>
        <h2>{{ l('从第一个治理问题开始', 'Start with your first governance question') }}</h2>
        <p>{{ l('通过六步向导依次定义治理目标、Agent 世界、事件情景与运行方案。每一步都会自动保存草稿，你可以随时回来继续。', 'Use the six-step wizard to define the governance objective, Agent world, incident scenario, and run plan. Your draft is saved automatically at every step.') }}</p>
      </div>
      <button class="primary" type="button" @click="router.push({ name:'campus-pulse-project-new' })">{{ l('启动六步向导', 'Start six-step wizard') }} <span>→</span></button>
    </section>
  </main>
</template>

<style scoped>
.project-center{min-height:calc(100vh - 7.5rem);padding:var(--cp-space-4) var(--cp-content-gutter) var(--cp-space-8);color:#f1ece7;background:#0b090a}
.hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--cp-space-5);align-items:end;max-width:1180px;margin:auto;padding:var(--cp-space-4);border:1px solid #2a2428;border-radius:8px;background:#151113}.hero>div{max-width:760px}.eyebrow{margin:0;color:#9e958f;font:700 11px/1.2 var(--cp-font-mono);letter-spacing:.14em}.hero h1{margin:8px 0;font-size:clamp(30px,4vw,42px);line-height:1.1}.hero>div>p:last-child{max-width:620px;margin:0;color:#9e958f;font-size:15px;line-height:1.6}.primary,.actions button,.state button{min-height:var(--cp-control-height);padding:0 var(--cp-space-4);border:1px solid #c51642;border-radius:6px;background:#c51642;color:#f1ece7;font-weight:700;cursor:pointer}.primary:hover,.actions button:hover,.state button:hover{background:#a91137}.summary,.grid,.empty{max-width:1180px;margin:var(--cp-space-4) auto}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #2a2428;background:#151113}.summary span{padding:var(--cp-space-3) var(--cp-space-4);border-right:1px solid #2a2428;color:#9e958f;font-size:13px}.summary span:last-child{border-right:0}.summary b{color:#f1ece7;font-size:16px}.grid{display:grid;gap:var(--cp-space-2)}.card{display:grid;grid-template-columns:minmax(12rem,.8fr) minmax(18rem,1.2fr) auto;gap:var(--cp-space-3) var(--cp-space-5);align-items:center;padding:var(--cp-space-4);border:1px solid #2a2428;border-radius:8px;background:#151113}.card-top{display:flex;grid-column:1;grid-row:1;justify-content:space-between;color:#c51642;font-size:12px}.card h2{grid-column:1;margin:0;font-size:18px}.domain{grid-column:1;margin:0;color:#9e958f;font-size:13px}.objective{grid-column:2;grid-row:1 / 4;margin:0;color:#b9b0aa;font-size:13px;line-height:1.6}.card dl{display:flex;grid-column:3;grid-row:1 / 3;gap:var(--cp-space-5);margin:0;padding:0}.card dl div{display:grid;gap:4px}.card dt{color:#9e958f;font-size:11px}.card dd{margin:0;color:#f1ece7;font-size:13px}.actions{display:flex;grid-column:3;gap:var(--cp-space-2);justify-content:flex-end}.actions button{background:transparent}.actions button+button{background:#c51642}.state{max-width:1180px;margin:var(--cp-space-6) auto;padding:var(--cp-space-4);border:1px solid #2a2428;background:#151113;text-align:center}.empty{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--cp-space-5);padding:var(--cp-space-5);border:1px solid #2a2428;border-radius:8px;background:#151113;text-align:left}.empty-index{color:#51464c;font:700 32px/1 var(--cp-font-mono)}.empty-copy{max-width:650px}.empty-label{margin:0 0 6px;color:#c51642;font:700 10px/1.2 var(--cp-font-mono);letter-spacing:.14em}.empty h2{margin:0 0 8px;font-size:22px;line-height:1.3}.empty-copy>p:last-child{margin:0;color:#9e958f;font-size:13px;line-height:1.65}.empty .primary{display:flex;align-items:center;gap:var(--cp-space-3);white-space:nowrap}.error{color:#e53e3e}
@media(max-width:900px){.card{grid-template-columns:1fr auto}.objective{grid-column:1;grid-row:auto}.card dl{grid-column:2;grid-row:1 / 3}.actions{grid-column:2}.summary{grid-template-columns:1fr}.summary span{border-right:0;border-bottom:1px solid #2a2428}.summary span:last-child{border-bottom:0}}
@media(max-width:760px){.hero{grid-template-columns:1fr;align-items:start;gap:var(--cp-space-3)}.hero>button{justify-self:start}.project-center{padding:var(--cp-space-4)}.card{grid-template-columns:1fr}.card-top,.card h2,.domain,.objective,.card dl,.actions{grid-column:1;grid-row:auto}.actions{justify-content:flex-start;flex-wrap:wrap}.empty{grid-template-columns:1fr;gap:var(--cp-space-3);padding:var(--cp-space-4)}.empty-index{display:none}.empty .primary{justify-self:start}}
</style>
