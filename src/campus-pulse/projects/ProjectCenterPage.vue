<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { localizeStoredText } from '../i18n/locale.ts'
import { deleteProject, listProjectRuns, listProjects, readableApiError } from '../../services/campusPulseApi'
import { projectListFromPayload, runListFromPayload, type WorkbenchProject, type RunSummary } from '../workbench/workbenchViewModel'

type ProjectCard = WorkbenchProject & { runs: RunSummary[] }
const router = useRouter()
const cards = ref<ProjectCard[]>([])
const loading = ref(true)
const error = ref('')
const deleting = ref('')

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

async function remove(card: ProjectCard) {
  if (deleting.value || !window.confirm(`删除项目“${localizeStoredText(card.name)}”？删除后可使用相同名称重新创建。`)) return
  deleting.value = card.project_id
  try { await deleteProject(card.project_id); await load() }
  catch (reason) { error.value = readableApiError(reason) }
  finally { deleting.value = '' }
}
</script>

<template>
  <main class="project-center">
    <header class="hero">
      <div>
        <p class="eyebrow">CAMPUSPULSE · PROJECTS</p>
        <h1>项目中心</h1>
        <p>从项目进入 Agent 世界、事件设置、治理方案与运行参数。</p>
      </div>
      <button class="primary" type="button" @click="router.push({ name: 'campus-pulse-project-new' })">新建项目</button>
    </header>

    <section class="summary" aria-label="项目摘要">
      <span><b>{{ cards.length }}</b> 个项目</span>
      <span><b>{{ readyCount }}</b> 个已生成运行参数</span>
      <span><b>1,000</b> Agent 固定世界可用</span>
    </section>

    <p v-if="loading" class="state">正在同步项目…</p>
    <div v-else-if="error" class="state error" role="alert">{{ error }} <button type="button" @click="load">重试</button></div>
    <section v-else-if="cards.length" class="grid" aria-label="项目列表">
      <article v-for="card in cards" :key="card.project_id" class="card">
        <div class="card-top"><span>{{ status(card) }}</span><small>{{ card.evaluation_mode }}</small></div>
        <h2 data-no-localize>{{ localizeStoredText(card.name) }}</h2>
        <p class="domain" data-no-localize>{{ localizeStoredText(card.governance_domain) }}</p>
        <p class="objective" data-no-localize>{{ localizeStoredText(card.objective) }}</p>
        <dl>
          <div><dt>运行</dt><dd>{{ card.runs.length }}</dd></div>
          <div><dt>最近状态</dt><dd>{{ latestRun(card)?.runtime?.status || '尚未计划' }}</dd></div>
        </dl>
        <div class="actions">
          <button type="button" @click="router.push({ name:'campus-pulse-project-overview', params:{ id:card.project_id } })">继续配置</button>
          <button v-if="latestRun(card)" type="button" @click="router.push({ name:'campus-pulse-run-live', params:{ runId:latestRun(card)?.run_id }, query:{ project:card.project_id } })">进入运行</button>
          <button type="button" class="delete" :disabled="Boolean(deleting)" @click="remove(card)">删除项目</button>
        </div>
      </article>
    </section>
    <section v-else class="empty">
      <div class="empty-index" aria-hidden="true">01</div>
      <div class="empty-copy">
        <p class="empty-label">START A GOVERNANCE PROJECT</p>
        <h2>从第一个治理问题开始</h2>
        <p>填写项目目标与事件，确认方案后进入推演。草稿自动保存，可随时继续。</p>
      </div>
      <button class="primary" type="button" @click="router.push({ name:'campus-pulse-project-new' })">启动创建向导 <span>→</span></button>
    </section>
  </main>
</template>

<style scoped>
.project-center{padding:var(--cp-space-6) var(--cp-content-gutter);color:var(--cp-text-primary)}
.hero{display:flex;align-items:center;justify-content:space-between;gap:24px}.hero h1{font-size:28px;margin:8px 0}.hero p{color:var(--cp-text-secondary);margin:0}.eyebrow{font-size:12px;color:var(--cp-action-primary)}
.primary,.actions button,.state button{min-height:40px;padding:8px 16px;border:1px solid var(--cp-border-default);border-radius:var(--cp-radius-sm);background:white;color:var(--cp-text-primary);font:inherit;cursor:pointer}
.primary{background:var(--cp-action-primary);border-color:var(--cp-action-primary);color:white}.primary:hover{background:var(--cp-action-primary-hover)}
.summary{display:flex;flex-wrap:wrap;gap:24px;padding:20px 0;border-bottom:1px solid var(--cp-border-default);color:var(--cp-text-secondary);font-size:14px}.summary b{color:var(--cp-text-primary)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px;margin:24px 0}
.card{padding:20px;border:1px solid var(--cp-border-default);border-radius:var(--cp-radius-md);background:var(--cp-surface-default)}
.card:focus-within{border-color:var(--cp-action-primary)}.card-top{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;color:var(--cp-text-secondary);font-size:12px}.card h2{font-size:20px;margin:16px 0 8px}.domain,.objective{color:var(--cp-text-secondary);font-size:14px}.objective{line-height:1.7}
.card dl{display:flex;gap:24px;padding-top:16px;border-top:1px solid var(--cp-border-subtle)}.card dt{font-size:12px;color:var(--cp-text-secondary)}.card dd{margin:4px 0}
.actions{display:flex;flex-wrap:wrap;gap:8px}.actions button:hover{border-color:var(--cp-action-primary);color:var(--cp-action-primary)}
.actions .delete{margin-left:auto;color:var(--cp-text-secondary)}.actions .delete:hover:not(:disabled){border-color:var(--cp-danger);color:var(--cp-danger);background:#fff4f5}.actions button:disabled{opacity:.45;cursor:default}
.empty{display:flex;align-items:center;gap:24px;padding:32px;margin-top:24px;border:1px solid var(--cp-border-default);border-radius:var(--cp-radius-md);background:var(--cp-surface-default)}.empty-index{display:none}.empty-copy{flex:1}.empty-label{color:var(--cp-action-primary);font-size:12px}.empty h2{font-size:22px;margin:8px 0}.empty-copy>p:last-child{color:var(--cp-text-secondary);font-size:14px}.empty .primary{white-space:nowrap}
.state{padding:40px;text-align:center}.error{color:var(--cp-danger)}
@media(max-width:767px){.hero,.empty{align-items:flex-start;flex-direction:column}.project-center{padding:16px}.empty{padding:20px}.hero h1{font-size:24px}}
</style>
