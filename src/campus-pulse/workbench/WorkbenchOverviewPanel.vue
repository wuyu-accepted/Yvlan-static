<script setup lang="ts">
import { computed } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { WorkbenchProject } from './workbenchViewModel.ts'
import type { WorkbenchCounts } from './workbenchViewModel.ts'
import type { WorkbenchAccess } from './workbenchViewModel.ts'
import { runStateLabel } from './workbenchViewModel.ts'
import ForumLiveVignettePanel from './ForumLiveVignettePanel.vue'
import { currentLocale } from '../i18n/locale.ts'

const props = defineProps<{
  project: WorkbenchProject | null
  counts: WorkbenchCounts
  access: WorkbenchAccess
  scenarioCount: number | null
  policyCount: number | null
  runCount: number | null
  evidenceCount: number | null
  sensingCount: number | null
  latestRunStatus: string | null
  runtimeAvailable: boolean
  readiness: Record<string, unknown> | null
  demoKind: 'case_replay' | 'century_gym_live' | 'live_world'
}>()

const emit = defineEmits<{
  go: [section: string]
  startDemo: []
}>()

const isEnglish = computed(() => currentLocale.value === 'en-US')

function localize(zh: string, en: string): string {
  return isEnglish.value ? en : zh
}

const evaluationLabel = computed(() => (
  props.project?.evaluation_mode === 'simulation_stress_test' ? '仿真压力测试' : '描述性试点'
))
const projectScenarioId = computed(() => {
  const corpus = `${props.project?.name || ''} ${props.project?.governance_domain || ''} ${props.project?.objective || ''}`
  if (/世纪馆|体育场地预约|幽灵预约|羽毛球|乒乓球/.test(corpus)) return 'century_gym_ghost_booking_dispute'
  if (/讲座|辱骂|冲突|主办方|现场发言/.test(corpus)) return 'lecture_external_incident_shock'
  if (/住宿|床位|分配|资格|申诉/.test(corpus)) return 'governance_legitimacy_dispute'
  return null
})

function countText(value: number | null): string {
  if (props.access === 'unavailable') return '不可用'
  if (value === null) return '未知'
  return String(value)
}

const workflowSteps = computed(() => {
  const step = (label: string, state: 'ready' | 'missing' | 'blocked' | 'unknown', note: string, section: string) => ({
    label,
    state,
    note,
    section,
  })
  const noProject = !props.project
  if (props.demoKind === 'century_gym_live' || props.demoKind === 'live_world') {
    return [
      step('项目', noProject ? 'missing' : 'ready', noProject ? '尚未创建' : props.project!.name, 'overview'),
      step('人口', 'ready', '1,000 个异质 Agent', 'evidence'),
      step('场景', props.scenarioCount === null ? 'unknown' : props.scenarioCount > 0 ? 'ready' : 'missing', props.scenarioCount ? `${props.scenarioCount} 个已冻结场景` : '配置事件与时间线', 'scenarios'),
      step('治理', props.policyCount === null ? 'unknown' : props.policyCount > 0 ? 'ready' : 'missing', props.policyCount ? `${props.policyCount} 个平行方案` : '配置 Natural / 治理分支', 'policies'),
      step('运行', props.latestRunStatus === null ? 'missing' : 'ready', props.latestRunStatus === null ? '等待启动' : runStateLabel(props.latestRunStatus), 'runs'),
    ]
  }
  return [
    step('项目', noProject ? 'missing' : 'ready', noProject ? '尚未创建' : props.project!.name, 'overview'),
    step('证据', props.evidenceCount === null ? 'unknown' : props.evidenceCount > 0 ? 'ready' : 'missing', props.evidenceCount === null ? '未知' : (props.evidenceCount > 0 ? props.evidenceCount + ' 已绑定' : '尚未绑定'), 'evidence'),
    step('场景', props.scenarioCount === null ? 'unknown' : props.scenarioCount > 0 ? 'ready' : 'missing', props.scenarioCount === null ? '未知' : (props.scenarioCount > 0 ? props.scenarioCount + ' 个' : '尚未创建'), 'scenarios'),
    step('计划', props.runCount === null ? 'unknown' : props.runCount > 0 ? 'ready' : 'missing', props.runCount === null ? '未知' : (props.runCount > 0 ? props.runCount + ' 个' : '尚未创建'), 'plan'),
    step('运行', props.latestRunStatus === null ? 'unknown' : 'ready', props.latestRunStatus === null ? '未知' : runStateLabel(props.latestRunStatus), 'runs'),
  ]
})
</script>

<template>
  <section class="overview-panel" aria-labelledby="overview-title">
    <header class="panel-head">
      <div>
        <h2 id="overview-title">{{ project?.name || '治理项目' }}</h2>
      </div>
      <CpStatusBadge v-if="project" :tone="project.evaluation_mode === 'simulation_stress_test' ? 'info' : 'neutral'">
        {{ evaluationLabel }}
      </CpStatusBadge>
    </header>

    <template v-if="project">
      <p class="objective">{{ project.objective }}</p>
      <dl class="identity">
        <div><dt>领域</dt><dd>{{ project.governance_domain }}</dd></div>
        <div><dt>项目 ID</dt><dd><code>{{ project.project_id }}</code></dd></div>
        <div><dt>更新</dt><dd>{{ project.updated_at || project.created_at || '—' }}</dd></div>
      </dl>

      <ol class="workflow-state" aria-label="项目就绪状态">
        <li v-for="item in workflowSteps" :key="item.section" :class="item.state">
          <button type="button" @click="emit('go', item.section)">
            <strong>{{ item.label }}</strong>
            <span>{{ item.note }}</span>
          </button>
        </li>
      </ol>

      <section class="live-demo" aria-labelledby="live-demo-title">
        <div class="live-demo__signal" aria-hidden="true"><span></span></div>
        <div>
          <span class="live-demo__eyebrow">REAL-TIME FORUM REHEARSAL</span>
          <h3 id="live-demo-title">{{ localize('进入项目实时世界', 'Enter the project live world') }}</h3>
          <p>{{ localize('先检查固定的 1,000-Agent 人口、关系与利益位置；运行后逐 Tick 观看公开论坛、实名/匿名表达、好友私聊、小群传播、风险信号和有限观测治理。', 'Inspect the fixed 1,000-Agent population, relationships, and stakes first. Once running, follow named or anonymous public speech, private chats, group diffusion, risk signals, and limited-observation governance Tick by Tick.') }}</p>
        </div>
        <button type="button" :disabled="!runtimeAvailable" :title="runtimeAvailable ? '' : localize('需要先创建并启动真实运行', 'Create and start a real run first')" @click="emit('startDemo')">{{ runtimeAvailable ? localize('打开实时世界', 'Open live world') : localize('等待真实运行', 'Real run required') }}</button>
      </section>

      <ForumLiveVignettePanel
        :project-id="project.project_id"
        :scenario-id="projectScenarioId"
        :scenario-configured="scenarioCount !== null && scenarioCount > 0"
        @configure-scenario="emit('go', 'scenarios')"
      />

      <div class="quick-actions">
        <button type="button" class="link" @click="emit('go', 'plan')">生成运行计划</button>
        <button type="button" class="link" @click="emit('go', 'runs')">查看运行</button>
        <RouterLink class="link" to="/campus-pulse/results">打开离线结果（只读）</RouterLink>
      </div>
    </template>

    <div v-else-if="access !== 'unavailable'" class="panel-empty">
      从左侧选择一个项目，或新建一个治理项目开始。
    </div>
    <div v-else class="panel-empty">
      后端不可用：项目与运行写操作暂不可用，已验证离线结果仍可查看。
    </div>
  </section>
</template>

<style scoped>
.overview-panel { display:grid; gap:var(--cp-space-4); }
.panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.panel-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.panel-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.objective { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.6; }
.identity { display:flex; flex-wrap:wrap; gap:var(--cp-space-1) var(--cp-space-4); margin:0; padding:var(--cp-space-2) 0; border-block:1px solid var(--cp-border-subtle); }
.identity div { min-width:0; }
.identity dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.identity dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-xs); font-weight:650; }
.identity code { font-family:var(--cp-font-mono); }
.workflow-state { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0; margin:0; padding:0; border-block:1px solid var(--cp-border-default); list-style:none; }
.workflow-state li { position:relative; min-width:0; border-right:1px solid var(--cp-border-subtle); background:transparent; }
.workflow-state li:last-child { border-right:0; }
.workflow-state li::before { position:absolute; inset:0 auto auto 0; width:100%; height:2px; background:var(--cp-border-strong); content:''; }
.workflow-state li.ready::before { background:var(--cp-success); }
.workflow-state li.missing::before { background:var(--cp-warning); }
.workflow-state li.blocked::before { background:var(--cp-danger); }
.workflow-state button { display:grid; gap:var(--cp-space-1); width:100%; min-height:4rem; padding:var(--cp-space-2); border:0; background:none; text-align:left; cursor:pointer; }
.workflow-state button:hover { background:var(--cp-surface-subtle); }
.workflow-state strong { font-size:var(--cp-text-xs); }
.workflow-state span { overflow:hidden; color:var(--cp-text-muted); font-size:.68rem; line-height:1.35; text-overflow:ellipsis; }
.live-demo { position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:var(--cp-space-3); align-items:center; overflow:hidden; padding:var(--cp-space-4); border:1px solid color-mix(in srgb,var(--cp-action-primary) 42%,var(--cp-border-default)); border-radius:var(--cp-radius-md); background:linear-gradient(120deg,var(--cp-surface-selected),var(--cp-surface-default) 72%); }
.live-demo::after { content:''; position:absolute; inset:auto -4rem -5rem auto; width:12rem; height:12rem; border:1px solid color-mix(in srgb,var(--cp-action-primary) 18%,transparent); border-radius:50%; }
.live-demo__signal { position:relative; width:2.6rem; height:2.6rem; border:1px solid color-mix(in srgb,var(--cp-action-primary) 30%,transparent); border-radius:50%; }
.live-demo__signal::before,.live-demo__signal::after,.live-demo__signal span { content:''; position:absolute; inset:50% auto auto 50%; border-radius:50%; transform:translate(-50%,-50%); }
.live-demo__signal span { width:.55rem; height:.55rem; background:var(--cp-action-primary); }
.live-demo__signal::before { width:1.25rem; height:1.25rem; border:1px solid color-mix(in srgb,var(--cp-action-primary) 56%,transparent); animation:demo-pulse 1.8s ease-out infinite; }
.live-demo__signal::after { width:2rem; height:2rem; border:1px solid color-mix(in srgb,var(--cp-action-primary) 28%,transparent); animation:demo-pulse 1.8s .55s ease-out infinite; }
.live-demo__eyebrow { color:var(--cp-action-primary); font:800 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.08em; }
.live-demo h3 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-md); }
.live-demo p { max-width:52rem; margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.6; }
.live-demo button { position:relative; z-index:1; min-height:var(--cp-control-height); padding:0 var(--cp-space-4); border:1px solid var(--cp-action-primary); border-radius:var(--cp-radius-sm); background:var(--cp-action-primary); color:var(--cp-surface-default); font-size:var(--cp-text-sm); font-weight:750; cursor:pointer; white-space:nowrap; }
.live-demo button:disabled { border-color:var(--cp-border-strong); background:var(--cp-surface-subtle); color:var(--cp-text-muted); cursor:not-allowed; }
@keyframes demo-pulse { 0% { opacity:.9; transform:translate(-50%,-50%) scale(.6); } 100% { opacity:0; transform:translate(-50%,-50%) scale(1.35); } }
.quick-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.link { min-height:var(--cp-control-height); display:inline-flex; align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:650; text-decoration:none; cursor:pointer; }
.link:hover { background:var(--cp-surface-subtle); }
.panel-empty { padding:var(--cp-space-4); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
@media (max-width:767px) { .workflow-state { grid-template-columns:1fr 1fr; } .workflow-state li:nth-child(even) { border-right:0; } .workflow-state li { border-bottom:1px solid var(--cp-border-subtle); } .live-demo { grid-template-columns:auto 1fr; } .live-demo button { grid-column:1 / -1; width:100%; } }
@media (prefers-reduced-motion:reduce) { .live-demo__signal::before,.live-demo__signal::after { animation:none; } }
</style>
