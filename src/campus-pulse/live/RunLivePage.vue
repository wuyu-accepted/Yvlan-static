<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getRun, getRunGovernance, getRunRisks, getRunRuntime, getRunTickForum,
  getRunTickPrivateConversations, getRunTickWorld, listRunRuntimeEvents,
  listRunTicks, readableApiError, getCenturyGymSocialWorld,
} from '../../services/campusPulseApi.js'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { currentLocale } from '../i18n/locale.ts'
import AgentWorldPanel from '../workbench/AgentWorldPanel.vue'
import {
  planContractFromRun, runEventsFromPayload, runFromPayload, runtimeSummaryFrom,
  runStateLabel, type RunEventVM, type RunSummary, type RuntimeSummaryVM,
} from '../workbench/workbenchViewModel.ts'
import { loadLiveManifest, loadLiveTick, type LiveProgressManifest } from './centuryGymLive.ts'
import { adaptCenturyGymSocialWorld, type ReviewedPrivateExcerpt, type SocialWorldRelease } from '../adapters/auditedReplayAdapter.ts'

type TickSummary = { tick:number; committed:boolean; public_message_count:number; active_agent_count:number; governance_action_count:number; private_access:string }
type ForumPayload = { threads?:Record<string,unknown>[]; messages?:Record<string,unknown>[] }
type WorldPayload = { population_size?:number; active_display_ids?:string[]; assets?:Record<string,unknown>[]; record_level_relationships_public?:boolean }
type PrivatePayload = { access?:string; items?:unknown[]; contains_conversation_ids?:boolean; boundary?:string }
type GovernancePayload = { rounds?:Record<string,unknown>[]; artifacts?:Record<string,unknown>[]; uptake?:unknown }
type RiskPayload = { items?:Record<string,unknown>[]; private_text_included?:boolean }
type AuditedReplaySummary = {
  committedPublicMessages:number|null
  residentActivations:number|null
  governanceActivations:number|null
  privateMessages:number|null
  privateRoleEdges:number|null
  timelineRecords:number|null
}

const route = useRoute()
const router = useRouter()
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => isEnglish.value ? en : zh
const runId = computed(() => String(route.params.runId || ''))
const run = ref<RunSummary|null>(null)
const runtime = ref<RuntimeSummaryVM|null>(null)
const events = ref<RunEventVM[]>([])
const ticks = ref<TickSummary[]>([])
const selectedTick = ref(0)
const forum = ref<ForumPayload>({})
const world = ref<WorldPayload>({})
const privateData = ref<PrivatePayload>({})
const governance = ref<GovernancePayload>({})
const risks = ref<RiskPayload>({})
const replayManifest = ref<LiveProgressManifest|null>(null)
const replaySocial = ref<SocialWorldRelease|null>(null)
const reviewedExcerpts = ref<ReviewedPrivateExcerpt[]>([])
const replayTimeline = ref<Record<string,unknown>[]>([])
const replayUsage = ref<Record<string,number>>({})
const auditedReplaySummary = ref<AuditedReplaySummary|null>(null)
const loading = ref(true)
const frameLoading = ref(false)
const error = ref('')
const playing = ref(false)
const speed = ref(1)
let pollTimer:ReturnType<typeof setInterval>|undefined
let playTimer:ReturnType<typeof setInterval>|undefined

const status = computed(() => runtime.value?.status || run.value?.effective_runtime_status || run.value?.plan_status || 'draft')
const replaySession = computed(() => typeof route.query.session==='string'?route.query.session:'')
const replayMode = computed(() => Boolean(replaySession.value))
const selectedBranch = computed(() => String(route.query.branch||'D'))
const contract = computed(() => planContractFromRun(run.value))
const maxTick = computed(() => ticks.value.at(-1)?.tick ?? Math.max(0,(contract.value.tickCount || 1)-1))
const selectedSummary = computed(() => ticks.value.find(item => item.tick===selectedTick.value))
const messages = computed(() => (Array.isArray(forum.value.messages) ? forum.value.messages : [])
  .filter(message => typeof message.created_tick!=='number'||message.created_tick===selectedTick.value))
const progress = computed(() => runtime.value?.progressFraction==null ? null : Math.round(runtime.value.progressFraction*100))
const phase = computed(() => selectedTick.value<=2?'baseline':selectedTick.value<=5?'burst':selectedTick.value<=11?'spread':'decay')
const activeEvents = computed(() => events.value.filter(event => {
  const tick = event.payload?.tick
  return typeof tick!=='number' || tick===selectedTick.value
}).slice(-12).reverse())
const trendingThreads = computed(() => (Array.isArray(forum.value.threads) ? forum.value.threads : [])
  .slice()
  .sort((left,right) => Number(right.reply_count||0)-Number(left.reply_count||0)
    || Number(right.participant_count||0)-Number(left.participant_count||0)
    || Number(right.last_active_tick||0)-Number(left.last_active_tick||0))
  .slice(0,4))
const replayEvent = computed(() => replayTimeline.value.find(item => Number(item.tick)===selectedTick.value) || null)
const riskSignals = computed(() => (Array.isArray(risks.value.items) ? risks.value.items : []).flatMap((item,index) => {
  const signals=Array.isArray(item.signals)?item.signals:[]
  if(signals.length) return signals.filter(signal=>signal&&typeof signal==='object').map((signal,signalIndex)=>({
    ...signal, key:`${index}:${signalIndex}`, tick:item.tick, branch:item.branch,
  }))
  return [{...item,key:String(index)}]
}))
const interventions = computed(() => (Array.isArray(governance.value.rounds) ? governance.value.rounds : []).flatMap((round,index) => {
  const decisions=Array.isArray(round.decisions)?round.decisions:[]
  if(decisions.length) return decisions.filter(decision=>decision&&typeof decision==='object').map((decision,decisionIndex)=>({
    ...decision,key:`${index}:${decisionIndex}`,tick:round.tick??round.created_tick,
  }))
  return [{...round,key:String(index)}]
}))
const tokenUsed = computed(() => runtime.value?.tokensUsed ?? (Number.isFinite(replayUsage.value.total_tokens)?replayUsage.value.total_tokens:null))
const tokenLimit = computed(() => runtime.value?.tokenLimit ?? contract.value.tokenLimit)
const tokenPercent = computed(() => tokenUsed.value!==null&&tokenLimit.value!==null&&tokenLimit.value>0
  ? Math.min(100,Math.round(tokenUsed.value/tokenLimit.value*100)) : null)
const runtimeTitle = computed(() => {
  const titles:Record<string,string> = {
    century_gym_ghost_booking_dispute: '世纪馆“幽灵预约”治理预演',
    dormitory_resource_allocation: '宿舍资源分配治理预演',
    lecture_conflict_response: '讲座冲突回应治理预演',
  }
  const englishTitles:Record<string,string> = {
    century_gym_ghost_booking_dispute: 'Century Gym ghost-booking governance simulation',
    dormitory_resource_allocation: 'Dormitory resource-allocation governance simulation',
    lecture_conflict_response: 'Lecture-conflict response governance simulation',
  }
  const key=run.value?.scenario_id || ''
  return isEnglish.value ? englishTitles[key] || 'Project governance simulation' : titles[key] || '项目运行与治理预演'
})

function queryTick():number {
  const value=Number(route.query.tick)
  return Number.isInteger(value)&&value>=0&&value<=23?value:0
}
function setTick(value:number){
  const next=Math.max(0,Math.min(maxTick.value,value))
  selectedTick.value=next
  router.replace({query:{...route.query,tick:String(next)}})
}
function stopPlayback(){playing.value=false;if(playTimer)clearInterval(playTimer);playTimer=undefined}
function startPlayback(){
  stopPlayback();playing.value=true
  playTimer=setInterval(()=>{if(selectedTick.value>=maxTick.value){stopPlayback();return}setTick(selectedTick.value+1)},1200/speed.value)
}
function togglePlayback(){playing.value?stopPlayback():startPlayback()}
function displayRiskValue(risk:Record<string,unknown>):string {
  const value=risk.value??risk.level??risk.status??risk.combined_score
  return value===null||value===undefined?l('已记录','Recorded'):String(value)
}

async function loadFrame(){
  if(!runId.value)return
  frameLoading.value=true
  if(replayMode.value&&replayManifest.value){
    try{
      const entries=replayManifest.value.committed_ticks
      const forkTick=replayManifest.value.display_contract?.branch_fork_tick??3
      const preferred=selectedTick.value<forkTick?'shared_baseline':selectedBranch.value
      const entry=entries.find(item=>item.tick===selectedTick.value&&item.branch===preferred)||entries.find(item=>item.tick===selectedTick.value)
      if(!entry)throw new Error('该 Tick 尚未提交')
      const payload=await loadLiveTick(replaySession.value,'http://127.0.0.1:8766',entry)
      forum.value={threads:payload.public_branch.threads,messages:payload.public_branch.messages}
      governance.value={rounds:payload.public_branch.governance_rounds,artifacts:payload.public_branch.governance_artifacts}
      replayTimeline.value=payload.public_branch.timeline||[]
      replayUsage.value=payload.public_branch.usage||{}
      world.value={population_size:1000,active_display_ids:payload.public_branch.public_display_profiles?.map(item=>item.display_id).slice(0,payload.public_branch.unique_activated_agents||0)||[],record_level_relationships_public:false}
      reviewedExcerpts.value=(replaySocial.value?.reviewed_excerpts||[]).filter(item=>item.tick===selectedTick.value&&(item.branch===entry.branch||item.branch==='shared_baseline'))
      const frame=replaySocial.value?.frames.find(item=>item.tick===selectedTick.value&&item.branch===entry.branch)
      const timelineRow=(payload.public_branch.timeline||[]).find(item=>Number(item.tick)===selectedTick.value)
      auditedReplaySummary.value={
        committedPublicMessages:typeof timelineRow?.messages_this_tick==='number'?timelineRow.messages_this_tick:messages.value.length,
        residentActivations:typeof timelineRow?.resident_llm_activations==='number'?timelineRow.resident_llm_activations:(payload.public_branch.unique_activated_agents===0?0:null),
        governanceActivations:typeof timelineRow?.governance_llm_activations==='number'?timelineRow.governance_llm_activations:(payload.public_branch.unique_activated_agents===0?0:null),
        privateMessages:typeof frame?.private_messages_this_tick==='number'?frame.private_messages_this_tick:null,
        privateRoleEdges:Array.isArray(frame?.edges)?frame.edges.length:null,
        timelineRecords:timelineRow?1:0,
      }
      privateData.value={access:'reviewed_excerpt',items:reviewedExcerpts.value,contains_conversation_ids:false,boundary:frame
        ? (isEnglish.value ? `${frame.private_messages_this_tick} private messages this Tick; only human-approved synthetic excerpts are shown below.` : `本 Tick ${frame.private_messages_this_tick} 条私域消息；下方仅展示人工批准的合成摘录。`)
        : l('仅展示人工批准的合成摘录。','Only human-approved synthetic excerpts are shown.')}
    }catch(reason){
      privateData.value={access:'unavailable',items:[],boundary:readableApiError(reason)}
      forum.value={};world.value={};reviewedExcerpts.value=[];replayTimeline.value=[];replayUsage.value={};auditedReplaySummary.value=null
    }
    frameLoading.value=false
    return
  }
  const requests=await Promise.allSettled([
    getRunTickWorld(runId.value,selectedTick.value), getRunTickForum(runId.value,selectedTick.value),
    getRunTickPrivateConversations(runId.value,selectedTick.value),
  ])
  world.value=requests[0].status==='fulfilled'?requests[0].value:{}
  forum.value=requests[1].status==='fulfilled'?requests[1].value:{}
  privateData.value=requests[2].status==='fulfilled'?requests[2].value:{access:'unavailable',items:[],boundary:'当前运行尚未提交可读取的私域聚合帧。'}
  frameLoading.value=false
}

async function loadRunState(initial=false){
  if(initial){loading.value=true;error.value=''}
  try{
    if(replayMode.value){
      const [manifest,socialPayload]=await Promise.all([
        loadLiveManifest(replaySession.value,'http://127.0.0.1:8766'),
        replaySocial.value ? Promise.resolve(replaySocial.value) : getCenturyGymSocialWorld(),
      ])
      replayManifest.value=manifest
      replaySocial.value=replaySocial.value||adaptCenturyGymSocialWorld(socialPayload)
      const committed=[...new Set(manifest.committed_ticks.map(item=>item.tick))].sort((a,b)=>a-b)
      ticks.value=committed.map(tick=>({tick,committed:true,public_message_count:0,active_agent_count:0,governance_action_count:0,private_access:'reviewed_excerpt'}))
      run.value={run_id:manifest.run_id,project_id:'',scenario_id:manifest.scenario_id,execution_mode:'audited_replay',status:manifest.status,plan_status:manifest.status,effective_runtime_status:manifest.status,token_budget:null}
      runtime.value={status:manifest.status,stateVersion:null,turnsReserved:null,turnsCompleted:null,tokensUsed:null,tokenLimit:null,activeUnits:null,concurrencyLimit:null,attemptCount:null,maxAttempts:null,checkpointSha256:null,updatedAt:null,progressFraction:manifest.status==='succeeded'?1:null}
      if(initial){selectedTick.value=Math.min(queryTick(),maxTick.value);await loadFrame()}
      loading.value=false
      return
    }
    const runPayload=await getRun(runId.value)
    run.value=runFromPayload(runPayload)
    const [runtimeResult,eventResult,tickResult,governanceResult,riskResult]=await Promise.allSettled([
      getRunRuntime(runId.value),listRunRuntimeEvents(runId.value,{afterSequence:0,limit:200}),
      listRunTicks(runId.value),getRunGovernance(runId.value),getRunRisks(runId.value),
    ])
    runtime.value=runtimeResult.status==='fulfilled'?runtimeSummaryFrom(runtimeResult.value):null
    events.value=eventResult.status==='fulfilled'?runEventsFromPayload(eventResult.value):[]
    ticks.value=tickResult.status==='fulfilled'&&Array.isArray(tickResult.value?.items)?tickResult.value.items:[]
    governance.value=governanceResult.status==='fulfilled'?governanceResult.value:{}
    risks.value=riskResult.status==='fulfilled'?riskResult.value:{}
    if(initial){selectedTick.value=Math.min(queryTick(),maxTick.value);await loadFrame()}
  }catch(reason){error.value=readableApiError(reason)}finally{loading.value=false}
}

watch(()=>route.query.tick,()=>{const next=queryTick();if(next!==selectedTick.value)selectedTick.value=next})
watch(selectedTick,loadFrame)
watch(speed,()=>{if(playing.value)startPlayback()})
onMounted(async()=>{
  await loadRunState(true)
  if(['queued','leased','running','cancel_requested'].includes(status.value))pollTimer=setInterval(()=>loadRunState(false),4000)
})
onBeforeUnmount(()=>{if(pollTimer)clearInterval(pollTimer);stopPlayback()})
</script>

<template>
  <main class="run-live">
    <header class="console-head">
      <div class="identity">
        <div class="identity-copy"><p>{{ replayMode?'AUDITED REPLAY · UNIFIED RUNTIME':'UNIFIED LIVE RUNTIME' }}</p><h1>{{ runtimeTitle }}</h1><small>RUN · {{ runId }}</small></div>
      </div>
      <div class="runtime-state"><CpStatusBadge :tone="status==='succeeded'?'success':status==='failed'?'warning':'info'">{{ runStateLabel(status) }}</CpStatusBadge><span>API ONLINE</span></div>
    </header>

    <section v-if="loading" class="loading-state">{{ l('正在恢复运行状态与已提交 Tick…','Restoring runtime state and committed Ticks…') }}</section>
    <section v-else-if="error" class="error-state" role="alert"><strong>{{ l('无法打开运行台','Unable to open the live console') }}</strong><p>{{ error }}</p><button @click="loadRunState(true)">{{ l('重试','Retry') }}</button></section>
    <template v-else>
      <section class="runtime-grid" :class="{muted:frameLoading}">
        <aside class="forum-column">
          <header><p>PUBLIC FORUM</p><h2>{{ l('论坛动态','Forum activity') }}</h2><span>{{ selectedSummary?.public_message_count||messages.length }} {{ l('条已提交消息','committed messages') }}</span></header>
          <section class="trending-block" :aria-label="l('活跃讨论串','Active threads')">
            <div class="section-label"><b>{{ l('活跃讨论串','Active threads') }}</b><span>{{ trendingThreads.length }}</span></div>
            <ol v-if="trendingThreads.length" class="thread-list">
              <li v-for="thread in trendingThreads" :key="String(thread.thread_id)">
                <strong data-no-localize>{{ thread.need||thread.topic }}</strong><span data-no-localize>{{ thread.topic }}</span>
                <dl><div><dt>{{ l('回复','Replies') }}</dt><dd>{{ thread.reply_count??0 }}</dd></div><div><dt>{{ l('参与者','Participants') }}</dt><dd>{{ thread.participant_count??0 }}</dd></div><div><dt>{{ l('最近活跃','Last active') }}</dt><dd>T{{ thread.last_active_tick??'—' }}</dd></div></dl>
              </li>
            </ol>
            <p v-else class="compact-empty">{{ l('当前帧没有已提交讨论串。','No committed threads exist in this frame.') }}</p>
          </section>
          <div class="section-label incoming-label"><b>{{ l('本 Tick 新动态','Incoming this Tick') }}</b><span>{{ messages.length }}</span></div>
          <div v-if="messages.length" class="feed">
            <article v-for="message in messages" :key="String(message.message_id)"><div><b>{{ message.agent_display_id||message.source_agent_display_id||l('匿名 Agent','Anonymous Agent') }}</b><small>T{{ message.created_tick }}</small></div><p data-no-localize>{{ message.visible_text }}</p><footer><span>{{ message.branch }}</span><span>{{ message.moderation_status||'published' }}</span></footer></article>
          </div><div v-else class="empty">{{ l('该 Tick 没有已发布的公开消息。','No public messages were published at this Tick.') }}</div>
        </aside>

        <section class="stream-column">
          <header><p>EVENT + CONVERSATION STREAM</p><h2>{{ l('实时活动流','Live activity stream') }}</h2><span>Tick {{ selectedTick }} · {{ String(route.query.branch||'ALL') }}</span></header>
          <section class="stream-block event-stream" :aria-label="l('运行事件','Runtime events')">
            <div class="section-label"><b>{{ l('运行事件','Runtime events') }}</b><span>{{ activeEvents.length+(replayEvent?1:0) }}</span></div>
            <ol v-if="activeEvents.length" class="event-list">
              <li v-for="event in activeEvents" :key="event.sequence"><code>#{{ event.sequence }}</code><div><b>{{ event.kind }}</b><span data-no-localize>{{ event.message||l('已提交运行事件','Committed runtime event') }}</span></div><time>{{ event.at||('T'+selectedTick) }}</time></li>
            </ol>
            <article v-else-if="replayEvent" class="replay-event"><div><b>{{ l('已提交回放帧','Committed replay frame') }}</b><time>Tick {{ replayEvent.tick }}</time></div><dl><div><dt>{{ l('阶段','Phase') }}</dt><dd>{{ replayEvent.phase??'—' }}</dd></div><div><dt>{{ l('本 Tick 消息','Messages this Tick') }}</dt><dd>{{ replayEvent.messages_this_tick??0 }}</dd></div><div><dt>{{ l('互动','Interactions') }}</dt><dd>{{ replayEvent.interactions_this_tick??0 }}</dd></div><div><dt>{{ l('治理消息','Governance messages') }}</dt><dd>{{ replayEvent.governance_message_count??0 }}</dd></div></dl></article>
            <p v-else class="compact-empty">{{ l('暂无已提交运行事件。','No committed runtime events are available.') }}</p>
          </section>
          <section class="stream-block public-stream" :aria-label="l('公开对话','Public conversations')">
            <div class="section-label"><b>{{ l('公开对话','Public conversations') }}</b><span>{{ messages.length }}</span></div>
            <ol v-if="messages.length" class="conversation-list">
              <li v-for="message in messages" :key="'conversation:'+String(message.message_id)"><div><b>{{ message.agent_display_id||message.source_agent_display_id||l('匿名 Agent','Anonymous Agent') }}</b><time>T{{ message.created_tick }}</time></div><p data-no-localize>{{ message.visible_text }}</p><small>{{ message.moderation_status||'published' }} · {{ message.branch }}</small></li>
            </ol>
            <p v-else class="compact-empty">{{ l('当前 Tick 没有公开对话。','No public conversation is available at this Tick.') }}</p>
          </section>
          <section class="stream-block private-stream" :aria-label="l('私域对话边界','Private conversation boundary')">
            <div class="section-label"><b>{{ l('审阅私域摘录','Reviewed private excerpts') }}</b><span>{{ reviewedExcerpts.length }}</span></div>
            <div v-if="reviewedExcerpts.length" class="excerpt-list"><article v-for="excerpt in reviewedExcerpts" :key="excerpt.excerpt_id"><small>{{ excerpt.source_role_id }} → {{ excerpt.target_role_id }} · {{ excerpt.relation_type }}</small><p data-no-localize>{{ excerpt.text_zh }}</p><em data-no-localize>{{ excerpt.effect_zh }}</em></article></div>
            <div v-else class="privacy-boundary"><strong>{{ privateData.access==='aggregate_only'?l('仅聚合可见','Aggregates only'):l('记录不可用','Records unavailable') }}</strong><p>{{ privateData.boundary||l('私域内容遵循当前运行的访问授权。','Private content follows the access authorization for this run.') }}</p></div>
            <p class="boundary-note">{{ privateData.boundary||l('不会根据计数生成发送者、关系边或对话正文。','Counts are never used to invent senders, relationship edges, or conversation text.') }}</p>
          </section>
        </section>

        <aside class="operations-column">
          <header><p>OPERATIONAL SUMMARY</p><h2>{{ l('运行态势','Runtime posture') }}</h2></header>
          <section class="operation-block risk-block"><div class="section-label"><b>{{ l('策略风险','Policy risk') }}</b><span>{{ riskSignals.length }}</span></div><ol v-if="riskSignals.length"><li v-for="risk in riskSignals" :key="String(risk.key)"><div><b>{{ risk.signal_name||risk.label||risk.risk_id||l('风险信号','Risk signal') }}</b><em v-if="risk.severity">{{ risk.severity }}</em></div><strong>{{ displayRiskValue(risk) }}</strong><small v-if="risk.change_velocity!==undefined">Δ {{ risk.change_velocity }}</small></li></ol><p v-else class="compact-empty">{{ l('当前运行没有已发布的风险信号。','No published risk signals are available for this run.') }}</p></section>
          <section class="operation-block token-block"><div class="section-label"><b>{{ l('Token 消耗','Token consumption') }}</b><span>{{ tokenPercent===null?'—':tokenPercent+'%' }}</span></div><div class="token-total"><strong>{{ tokenUsed??'—' }}</strong><span>/ {{ tokenLimit??l('上限未发布','limit unavailable') }}</span></div><div class="token-meter" role="meter" :aria-label="l('Token 消耗','Token consumption')" :aria-valuenow="tokenUsed??undefined" aria-valuemin="0" :aria-valuemax="tokenLimit??undefined"><i :style="{width:(tokenPercent??0)+'%'}" /></div><small v-if="tokenPercent===null">{{ l('当前只有已提交用量；未发布历史序列或上限。','Only committed current usage is available; no history or limit has been published.') }}</small><small v-else>{{ l('当前已提交用量与冻结上限。','Current committed usage against the frozen limit.') }}</small></section>
          <section class="operation-block intervention-block"><div class="section-label"><b>{{ l('治理干预','Governance interventions') }}</b><span>{{ interventions.length }}</span></div><ol v-if="interventions.length"><li v-for="item in interventions" :key="String(item.key)"><div><b>{{ item.actor||item.selected_action||item.action||l('治理动作','Governance action') }}</b><time>Tick {{ item.tick??'—' }}</time></div><p data-no-localize>{{ item.selected_action||item.action||item.decision||l('治理轮次已提交','Governance round committed') }}</p><small><span v-if="item.risk_level">{{ item.risk_level }}</span><span v-if="item.scheduled!==undefined">{{ item.scheduled?l('已调度','Scheduled'):l('未调度','Not scheduled') }}</span><span v-if="item.execution_delay!==undefined">{{ l('延迟','Delay') }} {{ item.execution_delay }}</span></small></li></ol><p v-else class="compact-empty">{{ l('当前运行没有已发布的治理干预。','No published governance interventions are available for this run.') }}</p><small v-if="Array.isArray(governance.artifacts)&&governance.artifacts.length" class="artifact-count">{{ governance.artifacts.length }} {{ l('项治理证据','governance artifacts') }}</small></section>
          <section class="operation-block context-block"><div class="section-label"><b>{{ l('当前帧','Current frame') }}</b><span>T{{ selectedTick }}</span></div><dl><div><dt>{{ l('Agent 世界','Agent world') }}</dt><dd>{{ world.population_size??contract.population??'—' }}</dd></div><div><dt>{{ l('本 Tick 激活','Active this Tick') }}</dt><dd>{{ world.active_display_ids?.length??selectedSummary?.active_agent_count??'—' }}</dd></div><div><dt>{{ l('治理动作','Governance actions') }}</dt><dd>{{ selectedSummary?.governance_action_count??0 }}</dd></div><div><dt>{{ l('资产组','Asset groups') }}</dt><dd>{{ world.assets?.length??0 }}</dd></div></dl><p>{{ privateData.boundary||l('私域内容遵循当前运行的访问授权。','Private content follows the access authorization for this run.') }}</p></section>
          <section class="commit-card"><i/><div><b>Committed frame</b><p>{{ l('界面只播放后端已提交 Tick 和事件，不生成随机动态。','The interface replays only backend-committed Ticks and events; it generates no random activity.') }}</p></div></section>
        </aside>
      </section>

      <section class="world-section">
        <header><div><p>AGENT WORLD</p><h2>{{ l('Agent 网络世界','Agent Network World') }}</h2></div><span>{{ l('与当前 Tick 和运行分支保持同步','Synchronized with the current Tick and runtime branch') }}</span></header>
        <AgentWorldPanel variant="runtime" :project-id="run?.project_id||''" :runtime-tick="selectedTick" :runtime-status="status" :runtime-branch-label="String(route.query.branch||'')" :runtime-events="events" :runtime-turns-completed="runtime?.turnsCompleted" :runtime-turns-reserved="runtime?.turnsReserved" :audited-replay-summary="replayMode ? auditedReplaySummary : null" />
      </section>

      <footer class="console-footer"><span>{{ l('最后同步：','Last sync:') }} {{ runtime?.updatedAt||'—' }}</span><button v-if="status==='succeeded'" @click="router.push({name:'campus-pulse-run-analysis',params:{runId},query:route.query})">{{ l('进入分析中心','Open analysis') }} →</button></footer>

      <section class="tick-dock" :aria-label="l('全局 Tick 播放控制','Global Tick playback controls')">
        <div class="transport"><button type="button" :aria-label="l('上一个 Tick','Previous Tick')" @click="setTick(selectedTick-1)" :disabled="selectedTick<=0">‹</button><button class="play" type="button" :aria-label="playing?l('暂停播放','Pause playback'):l('开始播放','Start playback')" @click="togglePlayback">{{ playing?'Ⅱ':'▶' }}</button><button type="button" :aria-label="l('下一个 Tick','Next Tick')" @click="setTick(selectedTick+1)" :disabled="selectedTick>=maxTick">›</button><select v-model.number="speed" :aria-label="l('播放速度','Playback speed')"><option :value="1">1×</option><option :value="5">5×</option><option :value="20">20×</option></select></div>
        <div class="tick-title"><span>TICK</span><b>{{ String(selectedTick).padStart(2,'0') }}</b><i>{{ phase }}</i></div>
        <div class="phase-track"><span v-for="name in ['baseline','burst','spread','decay']" :key="name" :class="{active:phase===name}">{{ name }}</span><input :value="selectedTick" type="range" min="0" :max="maxTick" :aria-label="l('选择 Tick','Select Tick')" @input="setTick(Number(($event.target as HTMLInputElement).value))"></div>
        <dl class="budget-strip"><div><dt>{{ l('进度','Progress') }}</dt><dd>{{ progress===null?'—':progress+'%' }}</dd></div><div><dt>Token</dt><dd>{{ tokenUsed??'—' }} / {{ tokenLimit??'—' }}</dd></div><div><dt>{{ l('分支','Branch') }}</dt><dd>{{ String(route.query.branch||'ALL') }}</dd></div></dl>
      </section>
    </template>
  </main>
</template>

<style scoped>
.run-live{--ink:#f1ece7;--muted:#9e958f;--line:#2a2428;--panel:#151113;min-height:100vh;padding:14px clamp(14px,2vw,28px) 40px;color:var(--ink);background:#0b090a}.console-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:auto auto 10px;max-width:1800px}.identity{display:flex;align-items:center;gap:14px}.identity button{min-height:36px;padding:0 12px;color:var(--muted);background:#151113;border:1px solid var(--line);border-radius:6px}.identity p,.runtime-grid header p{margin:0;color:#c51642;font:700 10px var(--cp-font-mono);letter-spacing:.12em}.identity h1{margin:3px 0 2px;font-size:clamp(20px,2.4vw,29px);line-height:1.2}.identity-copy small{display:block;max-width:min(58vw,720px);overflow:hidden;color:var(--muted);font:600 9px/1.4 var(--cp-font-mono);text-overflow:ellipsis;white-space:nowrap}.runtime-state{display:flex;align-items:center;gap:10px}.runtime-state>span{font:700 10px var(--cp-font-mono);color:#319795}.control-deck,.runtime-grid,.bottom-drawer{max-width:1800px;margin:auto;border:1px solid var(--line);background:#151113}.control-deck{display:grid;grid-template-columns:auto auto minmax(260px,1fr) auto;align-items:center;gap:16px;padding:10px 14px;border-radius:8px 8px 0 0}.transport{display:flex;gap:5px}.transport button,.transport select{min-height:36px;padding:0 10px;border:1px solid #51464c;background:#1c1719;color:var(--ink);border-radius:6px}.transport .play{background:#c51642;border-color:#c51642}.tick-title{display:flex;align-items:baseline;gap:7px}.tick-title span{font:700 9px var(--cp-font-mono);color:var(--muted)}.tick-title b{font-size:27px}.tick-title i{font:700 9px var(--cp-font-mono);color:#c51642}.phase-track{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.phase-track span{text-align:center;color:#776e69;font:700 8px var(--cp-font-mono)}.phase-track span.active{color:#c51642}.phase-track input{grid-column:1/-1;width:100%;accent-color:#c51642}.budget-strip{display:flex;gap:16px;margin:0}.budget-strip div{display:grid}.budget-strip dt{font-size:9px;color:var(--muted)}.budget-strip dd{margin:2px 0;font:700 11px var(--cp-font-mono)}.runtime-grid{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(560px,1.7fr) minmax(270px,.74fr);min-height:600px;border-top:0;transition:opacity .2s}.runtime-grid.muted{opacity:.7}.forum-column,.inspector-column{padding:14px;min-width:0;overflow:hidden}.forum-column{display:flex;min-height:0;flex-direction:column;border-right:1px solid var(--line)}.inspector-column{border-left:1px solid var(--line)}.runtime-grid h2{margin:4px 0;font-size:18px}.runtime-grid header>span{font-size:10px;color:var(--muted)}.feed{display:grid;align-content:start;flex:1;gap:7px;margin-top:12px;max-height:none;min-height:0;overflow:auto;padding-right:3px}.feed article{padding:10px;border:1px solid var(--line);background:#1c1719;border-radius:6px}.feed article>div,.feed article footer{display:flex;justify-content:space-between;gap:8px}.feed small,.feed footer{color:var(--muted);font-size:10px}.feed p{font-size:12px;line-height:1.5}.world-column{padding:10px;min-width:0;overflow:auto}.inspector-column dl{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0}.inspector-column dl div{padding:9px;border:1px solid var(--line);background:#1c1719;border-radius:6px}.inspector-column dt{font-size:9px;color:var(--muted)}.inspector-column dd{margin:4px 0 0;font:700 16px var(--cp-font-mono)}.privacy-card{padding:12px;border:1px solid #51464c;background:#1c1719;border-radius:6px}.privacy-card span{font:700 9px var(--cp-font-mono);color:#dd6b20}.privacy-card h3{margin:6px 0}.privacy-card p,.privacy-card small{color:#b9b0aa;font-size:11px;line-height:1.5}.commit-card{display:flex;gap:9px;margin-top:10px;padding:11px;border:1px solid #2a2428;background:#171c1b;border-radius:6px}.commit-card i{width:8px;height:8px;border-radius:50%;background:#319795}.commit-card p{margin:3px 0;color:var(--muted);font-size:10px}.bottom-drawer{border-top:0;border-radius:0 0 8px 8px}.bottom-drawer nav{display:flex;border-bottom:1px solid var(--line)}.bottom-drawer nav button{min-height:40px;padding:0 16px;border:0;background:none;color:var(--muted)}.bottom-drawer nav button.active{color:var(--ink);background:#1c1719;box-shadow:inset 0 -2px #c51642}.drawer-grid,.resource-ledger{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px;padding:12px;margin:0}.drawer-grid article,.resource-ledger div{padding:11px;background:#1c1719;border:1px solid var(--line)}.drawer-grid p{color:var(--muted)}.resource-ledger dt{color:var(--muted);font-size:10px}.resource-ledger dd{margin:6px 0 0}.event-list{list-style:none;display:grid;gap:5px;padding:12px;margin:0;max-height:220px;overflow:auto}.event-list li{display:grid;grid-template-columns:55px 180px 1fr;gap:9px;padding:8px;border-bottom:1px solid var(--line);font-size:11px}.event-list code{color:#d4af37}.bottom-drawer>footer{display:flex;justify-content:space-between;padding:10px 14px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}.bottom-drawer>footer button,.error-state button{min-height:36px;padding:0 13px;border:1px solid #c51642;border-radius:6px;background:#c51642;color:#f1ece7}.loading-state,.error-state{max-width:900px;margin:60px auto;padding:30px;border:1px solid var(--line);background:var(--panel);text-align:center}.empty{color:var(--muted);padding:20px;text-align:center;font-size:11px}.excerpt-list{display:grid;gap:7px;margin-top:10px;max-height:260px;overflow:auto}.excerpt-list article{padding:9px;border-left:2px solid #c51642;background:#1c1719}.excerpt-list article p{margin:5px 0;color:#f1ece7}.excerpt-list article em{display:block;color:var(--muted);font-size:10px;line-height:1.45}@media(max-width:1180px){.control-deck{grid-template-columns:auto auto 1fr}.budget-strip{grid-column:1/-1}.runtime-grid{grid-template-columns:300px 1fr}.inspector-column{grid-column:1/-1;border-left:0;border-top:1px solid var(--line)}}@media(max-width:760px){.run-live{padding:10px 8px 32px}.console-head{align-items:flex-start;flex-direction:column}.control-deck{grid-template-columns:1fr}.runtime-grid{grid-template-columns:1fr}.forum-column,.inspector-column{border:0;border-bottom:1px solid var(--line)}.world-column{min-height:520px}.budget-strip{display:grid;grid-template-columns:1fr 1fr}.bottom-drawer nav{overflow:auto}.event-list li{grid-template-columns:48px 1fr}.event-list li span{grid-column:1/-1}}
@media(min-width:1181px){.runtime-grid{height:920px;min-height:0}.forum-column,.world-column,.inspector-column{height:100%;min-height:0}.inspector-column{overflow:auto}}

:global(.legacy-page-adapter:has(> .run-live)){will-change:auto!important}.run-live{padding-bottom:100px}.runtime-grid,.world-section,.console-footer{max-width:1800px;margin-inline:auto}.runtime-grid{grid-template-columns:minmax(250px,.72fr) minmax(420px,1.45fr) minmax(275px,.8fr);min-height:680px;border-top:1px solid var(--line);border-radius:8px}.forum-column,.stream-column,.operations-column{min-width:0;padding:14px;overflow:auto}.forum-column{border-right:1px solid var(--line)}.stream-column{border-right:1px solid var(--line)}.section-label{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--muted);font:700 10px var(--cp-font-mono);letter-spacing:.05em}.section-label span{color:#c51642}.trending-block,.stream-block,.operation-block{margin-top:12px;padding-top:11px;border-top:1px solid var(--line)}.thread-list,.conversation-list,.event-list,.operation-block ol{display:grid;gap:7px;margin:9px 0 0;padding:0;list-style:none}.thread-list li,.conversation-list li,.replay-event,.operation-block li{padding:10px;border:1px solid var(--line);border-radius:6px;background:#1c1719}.thread-list li>strong{display:block;font-size:11px;line-height:1.4}.thread-list li>span{display:block;margin-top:4px;color:var(--muted);font-size:9px}.thread-list dl{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:8px 0 0}.thread-list dt{color:var(--muted);font-size:8px}.thread-list dd{margin:2px 0 0;font:700 9px var(--cp-font-mono)}.incoming-label{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.feed{margin-top:9px}.stream-block>.section-label,.operation-block>.section-label{position:sticky;top:-14px;z-index:1;padding:6px 0;background:#151113}.replay-event>div,.conversation-list li>div,.operation-block li>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.replay-event time,.conversation-list time,.operation-block time{color:var(--muted);font:700 9px var(--cp-font-mono)}.replay-event dl{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0 0}.replay-event dt{color:var(--muted);font-size:8px}.replay-event dd{margin:3px 0 0;font:700 11px var(--cp-font-mono)}.conversation-list{max-height:330px;overflow:auto;padding-right:3px}.conversation-list p{margin:7px 0;color:#ddd5d0;font-size:11px;line-height:1.5}.conversation-list small,.boundary-note,.privacy-boundary p,.token-block>small{color:var(--muted);font-size:9px;line-height:1.5}.private-stream .excerpt-list{max-height:220px}.privacy-boundary{margin-top:9px;padding:10px;border:1px solid var(--line);border-radius:6px;background:#1c1719}.privacy-boundary p,.boundary-note{margin:6px 0 0}.operations-column>header{margin-bottom:4px}.operation-block ol{max-height:220px;overflow:auto}.risk-block li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px}.risk-block li>div{grid-column:1/-1}.risk-block li em{color:#dd6b20;font-size:9px;font-style:normal}.risk-block li>strong{font:700 12px var(--cp-font-mono)}.risk-block li>small{color:var(--muted);font-size:9px}.token-total{display:flex;align-items:baseline;gap:5px;margin:12px 0 8px}.token-total strong{font:750 20px var(--cp-font-mono)}.token-total span{color:var(--muted);font-size:10px}.token-meter{height:6px;margin-bottom:8px;overflow:hidden;border-radius:4px;background:#2a2428}.token-meter i{display:block;height:100%;background:#c51642}.intervention-block li p{margin:7px 0;color:#ddd5d0;font-size:10px}.intervention-block li>small{display:flex;flex-wrap:wrap;gap:7px;color:var(--muted);font-size:9px}.artifact-count{display:block;margin-top:8px;color:#d4af37;font-size:9px}.context-block dl{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.context-block dl div{padding:8px;border:1px solid var(--line);border-radius:6px;background:#1c1719}.context-block dt{color:var(--muted);font-size:8px}.context-block dd{margin:3px 0 0;font:700 14px var(--cp-font-mono)}.context-block>p{color:var(--muted);font-size:9px;line-height:1.5}.compact-empty{margin:9px 0 0;padding:10px;border:1px dashed #51464c;color:var(--muted);font-size:10px;line-height:1.5}.world-section{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:8px;background:#151113}.world-section>header{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:10px}.world-section>header p{margin:0;color:#c51642;font:700 10px var(--cp-font-mono);letter-spacing:.12em}.world-section>header h2{margin:4px 0 0;font-size:18px}.world-section>header>span{color:var(--muted);font-size:10px}.console-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 2px;color:var(--muted);font-size:10px}.console-footer button,.error-state button{min-height:36px;padding:0 13px;border:1px solid #c51642;border-radius:6px;background:#c51642;color:#f1ece7}.tick-dock{position:fixed;right:clamp(14px,2vw,28px);bottom:10px;left:calc(var(--cp-sidebar-width) + clamp(14px,2vw,28px));z-index:var(--cp-z-overlay,100);display:grid;grid-template-columns:auto auto minmax(220px,1fr) auto;align-items:center;gap:14px;padding:9px 12px;border:1px solid #51464c;border-radius:8px;background:rgba(21,17,19,.97);box-shadow:0 8px 26px rgba(0,0,0,.36);backdrop-filter:blur(8px)}
@media(min-width:1280px){.runtime-grid{height:760px;min-height:0}.forum-column,.stream-column,.operations-column{height:100%;min-height:0}}
@media(max-width:1439px) and (min-width:1024px){.tick-dock{left:calc(var(--cp-sidebar-compact-width) + clamp(14px,2vw,28px))}}
@media(max-width:1279px){.runtime-grid{grid-template-columns:minmax(260px,.75fr) minmax(420px,1.4fr)}.operations-column{grid-column:1/-1;border-top:1px solid var(--line)}.operations-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}.operations-column>header,.operations-column>.commit-card{grid-column:1/-1}.world-section{padding:10px}.tick-dock{grid-template-columns:auto auto 1fr}.budget-strip{grid-column:1/-1}}
@media(max-width:1023px){.tick-dock{right:8px;left:8px}}
@media(max-width:760px){.run-live{padding:10px 8px 126px}.runtime-grid{grid-template-columns:1fr}.forum-column,.stream-column{border-right:0;border-bottom:1px solid var(--line)}.operations-column{grid-column:auto;display:block;border-top:0}.world-section>header{align-items:flex-start;flex-direction:column}.tick-dock{bottom:6px;grid-template-columns:auto 1fr;padding:8px}.tick-title{justify-self:end}.phase-track{grid-column:1/-1}.budget-strip{display:none}.conversation-list{max-height:420px}.replay-event dl{grid-template-columns:1fr 1fr}}
</style>
