<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { WorkbenchProject, WorkbenchCounts, WorkbenchAccess } from './workbenchViewModel.ts'
import { currentLocale, localizeStoredText } from '../i18n/locale.ts'
import { startProjectReplay, getProjectReplay, readableApiError } from '../../services/campusPulseApi.js'

const props = defineProps<{
 project: WorkbenchProject | null; counts: WorkbenchCounts; access: WorkbenchAccess;
 scenarioCount: number | null; policyCount: number | null; runCount: number | null;
 evidenceCount: number | null; sensingCount: number | null; latestRunStatus: string | null;
 readiness: Record<string, unknown> | null; demoKind: string; scenarioKey?: string;
}>()
const emit = defineEmits<{ go:[section:string]; startDemo:[] }>()
const router = useRouter()
const english = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => english.value ? en : zh
const display = (text:string) => localizeStoredText(text, currentLocale.value)
const replay = computed(() => ['project_setup_century_gym_v1','century_gym_ghost_booking_v1'].includes(props.scenarioKey || ''))
const cursor = ref<any>(null)
const busy = ref(false)
const error = ref('')
type ReadyState = 'ready' | 'missing' | 'blocked' | 'unknown'
const state = (count: number | null): ReadyState => props.access === 'unavailable' ? 'blocked' : count === null ? 'unknown' : count > 0 ? 'ready' : 'missing'
const countLabel = (count: number | null, zh: string, en: string) => count === null ? l('未知','Unknown') : l(`${count} 个${zh}`, `${count} ${en}${count === 1 ? '' : 's'}`)
const replayReady = computed(() => state(props.sensingCount) === 'ready' && state(props.scenarioCount) === 'ready' && state(props.policyCount) === 'ready')
watch(() => [props.project?.project_id, replay.value], async () => {
 cursor.value = null; error.value = ''
 const id = props.project?.project_id
 if (!id || !replay.value) return
 try { const value = await getProjectReplay(id); if (id === props.project?.project_id) cursor.value = value } catch (e) { error.value = readableApiError(e) }
}, {immediate:true})
const steps = computed(() => [
 {label:l('人口世界','Agent world'), note:state(props.sensingCount) === 'ready' ? l('1,000 个 Agent · 固定人物与关系','1,000 Agents · persistent profiles and relationships') : countLabel(props.sensingCount,'人口配置','population binding'), section:'evidence',state:state(props.sensingCount)},
 {label:l('事件设置','Incident'), note:countLabel(props.scenarioCount,'场景','scenario'),section:'scenarios',state:state(props.scenarioCount)},
 {label:l('治理方案','Governance'),note:countLabel(props.policyCount,'方案','plan'),section:'policies',state:state(props.policyCount)},
 {label:l('运行参数','Run parameters'),note: replay.value ? 'Natural / D · Tick 0–10' : l('模型、分支与预算','Model, branches and budget'),section:'plan',state:replay.value ? 'ready' : state(props.runCount)},
])
async function start() {
 if (!props.project || busy.value) return
 if (!replay.value) { emit('go', props.latestRunStatus ? 'runs' : 'plan'); return }
 busy.value = true; error.value = ''
 try {
  const value = await startProjectReplay(props.project.project_id)
  cursor.value = value
  await router.push({name:'campus-pulse-century-gym-live',query:{
    project_id:props.project.project_id,replay_project:props.project.project_id,
    session:value.session_id,branch:value.branch,tick:String(value.tick),autoplay:'1'
  }})
 } catch (e) { error.value = readableApiError(e) }
 finally { busy.value=false }
}
</script>
<template>
 <section class="overview-panel" data-no-localize>
  <header class="panel-head"><h2>{{ display(project?.name || l('项目概览','Project overview')) }}</h2><span v-if="replay" class="source-label">{{ l('记录回放','Recorded replay') }}</span></header>
  <template v-if="project">
   <p class="objective">{{ display(project.objective) }}</p>
   <dl class="identity">
    <div><dt>{{ l('治理领域','Domain') }}</dt><dd>{{ display(project.governance_domain) }}</dd></div>
    <div><dt>{{ l('更新于','Updated') }}</dt><dd>{{ new Date(project.updated_at || project.created_at).toLocaleString(english ? 'en-GB' : 'zh-CN') }}</dd></div>
   </dl>
   <ol class="workflow-state" :aria-label="l('项目就绪状态','Project readiness')">
    <li v-for="item in steps" :key="item.section" :class="item.state"><button @click="emit('go',item.section)"><strong>{{ item.label }}</strong><span>{{ item.note }}</span></button></li>
   </ol>
   <section class="run-next">
    <div><h3>{{ cursor ? l('继续查看推演','Continue the simulation') : l('项目配置已保存','Project configuration saved') }}</h3>
     <p>{{ replay ? l('启动后按时间步展示公开讨论、好友私聊、群聊与治理回应。Natural 与 D 共享事件初始状态。','Follow public discussion, private messages, group conversations and governance responses over time. Natural and D share the initial event state.') : l('确认事件和治理方案，检查模型预算，然后启动推演。','Confirm the incident and governance plans, review the model budget, then start the simulation.') }}</p>
     <small v-if="cursor">Tick {{ cursor.tick }} / 10 · {{ cursor.status === 'completed' ? l('播放完成','Playback complete') : l('进度已保存','Progress saved') }}</small>
    </div>
    <button class="primary-action" :disabled="busy || access !== 'interactive' || (replay && !replayReady)" @click="start">{{ busy ? l('正在准备…','Preparing…') : replay ? cursor ? l('继续推演','Continue') : l('开启推演','Start simulation') : latestRunStatus ? l('查看运行','View run') : l('确认运行参数','Review run parameters') }}</button>
   </section>
   <p v-if="error" role="alert" class="action-error">{{ error }}</p>
   <details class="project-record"><summary>{{ l('项目记录','Project record') }}</summary><code>{{ project.project_id }}</code><p v-if="replay">{{ l('数据来源：世纪馆已保存运行 · 本次新增模型调用 0','Source: saved Century Gym run · new model calls: 0') }}</p></details>
  </template>
  <p v-else>{{ l('选择一个项目，或新建项目开始。','Select a project or create one to begin.') }}</p>
 </section>
</template>
<style scoped>
.overview-panel { display:grid; gap:var(--cp-space-4); }
.panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.panel-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.panel-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.objective { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.6; }
.identity { display:flex; flex-wrap:wrap; gap:var(--cp-space-1) var(--cp-space-4); margin:0; padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.identity div { min-width:0; }
.identity dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.identity dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-xs); font-weight:650; }
.identity code { font-family:var(--cp-font-mono); }
.workflow-state { display:grid; grid-template-columns:repeat(auto-fit,minmax(9rem,1fr)); gap:var(--cp-space-2); margin:0; padding:0; list-style:none; }
.workflow-state li { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.workflow-state li.ready { border-left:3px solid var(--cp-success); }
.workflow-state li.missing { border-left:3px solid var(--cp-warning); }
.workflow-state li.blocked { border-left:3px solid var(--cp-danger); }
.workflow-state li.unknown { border-left:3px solid var(--cp-border-strong); }
.workflow-state button { display:grid; gap:var(--cp-space-1); width:100%; padding:var(--cp-space-3); border:0; background:none; text-align:left; cursor:pointer; }
.workflow-state button:hover { background:var(--cp-surface-subtle); }
.workflow-state strong { font-size:var(--cp-text-sm); }
.workflow-state span { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.live-demo { position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:var(--cp-space-3); align-items:center; overflow:hidden; padding:var(--cp-space-4); border:1px solid color-mix(in srgb,var(--cp-action-primary) 42%,var(--cp-border-default)); border-radius:var(--cp-radius-md); background:var(--cp-surface-selected); }
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
.replay-vignette { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--cp-space-3); align-items:center; padding:var(--cp-space-4); border:1px solid var(--cp-action-primary); border-left-width:4px; background:var(--cp-surface-selected); }
.replay-vignette h3 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-md); }
.replay-vignette p { max-width:52rem; margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.6; }
.replay-vignette button { min-height:var(--cp-control-height); padding:0 var(--cp-space-4); border:1px solid var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-surface-default); font-size:var(--cp-text-sm); font-weight:750; cursor:pointer; white-space:nowrap; }
@keyframes demo-pulse { 0% { opacity:.9; transform:translate(-50%,-50%) scale(.6); } 100% { opacity:0; transform:translate(-50%,-50%) scale(1.35); } }
.quick-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.link { min-height:var(--cp-control-height); display:inline-flex; align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:650; text-decoration:none; cursor:pointer; }
.link:hover { background:var(--cp-surface-subtle); }
.panel-empty { padding:var(--cp-space-4); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
@media (max-width:767px) { .workflow-state { grid-template-columns:1fr 1fr; } .live-demo,.replay-vignette { grid-template-columns:auto 1fr; } .live-demo button,.replay-vignette button { grid-column:1 / -1; width:100%; } }
@media (prefers-reduced-motion:reduce) { .live-demo__signal::before,.live-demo__signal::after { animation:none; } }
</style>
<style scoped>
.panel-head h2{font-size:20px;line-height:1.4}.source-label{font-size:12px;padding:4px 9px;border:1px solid var(--cp-border-default);border-radius:4px;white-space:nowrap;color:var(--cp-text-secondary)}
.run-next{display:flex;align-items:center;justify-content:space-between;gap:24px;border-top:1px solid var(--cp-border-default);padding:24px 0}.run-next h3{font-size:17px;margin:0 0 8px}.run-next p{max-width:65ch;font-size:14px;line-height:1.7;color:var(--cp-text-secondary);margin:0 0 8px}.run-next small{color:var(--cp-text-secondary)}
.primary-action{flex-shrink:0;min-height:44px;padding:10px 22px;border:0;border-radius:5px;background:var(--cp-action-primary);color:var(--cp-text-inverse);font:600 14px var(--cp-font-body);cursor:pointer;transition:transform 180ms ease,background 180ms ease}.primary-action:hover{transform:translateY(-2px);background:var(--cp-action-primary-hover)}.primary-action:active{transform:translateY(1px)}.primary-action:disabled{opacity:.5;cursor:wait}
.workflow-state button{transition:background 180ms ease,transform 180ms ease}.workflow-state button:hover{transform:translateY(-2px)}:is(button,summary):focus-visible{outline:2px solid var(--cp-focus-ring);outline-offset:3px}.project-record{font-size:12px;color:var(--cp-text-secondary)}.project-record summary{cursor:pointer;padding:8px 0}.project-record code{overflow-wrap:anywhere}.action-error{color:var(--cp-danger);font-size:13px}
@media(max-width:650px){.run-next{align-items:stretch;flex-direction:column}}
@media(prefers-reduced-motion:reduce){button{transition:none!important;transform:none!important}}
</style>
