<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getRun, getRunGovernance, getRunRisks, getRunRuntime, getRunTickForum,
  getRunTickPrivateConversations, getRunTickWorld, listRunRuntimeEvents,
  listRunTicks, readableApiError, getCenturyGymSocialWorld,
} from '../../services/campusPulseApi.js'
import CpStatusBadge from '../components/CpStatusBadge.vue'
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

const route = useRoute()
const router = useRouter()
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
const loading = ref(true)
const frameLoading = ref(false)
const error = ref('')
const playing = ref(false)
const speed = ref(1)
const bottomTab = ref<'risk'|'governance'|'budget'|'events'>('risk')
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
const runtimeTitle = computed(() => {
  const titles:Record<string,string> = {
    century_gym_ghost_booking_dispute: '世纪馆“幽灵预约”治理预演',
    dormitory_resource_allocation: '宿舍资源分配治理预演',
    lecture_conflict_response: '讲座冲突回应治理预演',
  }
  return titles[run.value?.scenario_id || ''] || '项目运行与治理预演'
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
function selectBottomTab(value:string){
  if(value==='risk'||value==='governance'||value==='budget'||value==='events')bottomTab.value=value
}
function displayRiskValue(risk:Record<string,unknown>):string {
  const value=risk.level??risk.status??risk.combined_score
  return value===null||value===undefined?'已记录':String(value)
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
      world.value={population_size:1000,active_display_ids:payload.public_branch.public_display_profiles?.map(item=>item.display_id).slice(0,payload.public_branch.unique_activated_agents||0)||[],record_level_relationships_public:false}
      reviewedExcerpts.value=(replaySocial.value?.reviewed_excerpts||[]).filter(item=>item.tick===selectedTick.value&&(item.branch===entry.branch||item.branch==='shared_baseline'))
      const frame=replaySocial.value?.frames.find(item=>item.tick===selectedTick.value&&item.branch===entry.branch)
      privateData.value={access:'reviewed_excerpt',items:reviewedExcerpts.value,contains_conversation_ids:false,boundary:frame?`本 Tick ${frame.private_messages_this_tick} 条私域消息；下方仅展示人工批准的合成摘录。`:'仅展示人工批准的合成摘录。'}
    }catch(reason){
      privateData.value={access:'unavailable',items:[],boundary:readableApiError(reason)}
      forum.value={};world.value={};reviewedExcerpts.value=[]
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
        <button type="button" @click="router.push(run?.project_id?{name:'campus-pulse-project-overview',params:{id:run.project_id}}:{name:'campus-pulse-project-center'})">← 项目</button>
        <div class="identity-copy"><p>{{ replayMode?'AUDITED REPLAY · UNIFIED RUNTIME':'UNIFIED LIVE RUNTIME' }}</p><h1>{{ runtimeTitle }}</h1><small>RUN · {{ runId }}</small></div>
      </div>
      <div class="runtime-state"><CpStatusBadge :tone="status==='succeeded'?'success':status==='failed'?'warning':'info'">{{ runStateLabel(status) }}</CpStatusBadge><span>API ONLINE</span></div>
    </header>

    <section v-if="loading" class="loading-state">正在恢复运行状态与已提交 Tick…</section>
    <section v-else-if="error" class="error-state" role="alert"><strong>无法打开运行台</strong><p>{{ error }}</p><button @click="loadRunState(true)">重试</button></section>
    <template v-else>
      <section class="control-deck">
        <div class="transport"><button type="button" @click="setTick(selectedTick-1)" :disabled="selectedTick<=0">‹</button><button class="play" type="button" @click="togglePlayback">{{ playing?'Ⅱ':'▶' }}</button><button type="button" @click="setTick(selectedTick+1)" :disabled="selectedTick>=maxTick">›</button><select v-model.number="speed" aria-label="播放速度"><option :value="0.5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option></select></div>
        <div class="tick-title"><span>TICK</span><b>{{ String(selectedTick).padStart(2,'0') }}</b><i>{{ phase }}</i></div>
        <div class="phase-track"><span v-for="name in ['baseline','burst','spread','decay']" :key="name" :class="{active:phase===name}">{{ name }}</span><input :value="selectedTick" type="range" min="0" :max="maxTick" @input="setTick(Number(($event.target as HTMLInputElement).value))"></div>
        <dl class="budget-strip"><div><dt>进度</dt><dd>{{ progress===null?'—':progress+'%' }}</dd></div><div><dt>Provider</dt><dd>{{ runtime?.turnsCompleted??'—' }} / {{ runtime?.turnsReserved??'—' }}</dd></div><div><dt>Token</dt><dd>{{ runtime?.tokensUsed??'—' }} / {{ runtime?.tokenLimit??'—' }}</dd></div><div><dt>分支</dt><dd>{{ String(route.query.branch||'ALL') }}</dd></div></dl>
      </section>

      <section class="runtime-grid" :class="{muted:frameLoading}">
        <aside class="forum-column">
          <header><p>PUBLIC FORUM</p><h2>本 Tick 论坛</h2><span>{{ selectedSummary?.public_message_count||messages.length }} 条已提交消息</span></header>
          <div v-if="messages.length" class="feed">
            <article v-for="message in messages" :key="String(message.message_id)"><div><b>{{ message.agent_display_id||message.source_agent_display_id||'匿名 Agent' }}</b><small>T{{ message.created_tick }}</small></div><p>{{ message.visible_text }}</p><footer><span>{{ message.branch }}</span><span>{{ message.moderation_status||'published' }}</span></footer></article>
          </div><div v-else class="empty">该 Tick 没有已发布的公开消息。</div>
        </aside>

        <section class="world-column">
          <AgentWorldPanel variant="runtime" :project-id="run?.project_id||''" :runtime-tick="selectedTick" :runtime-status="status" :runtime-branch-label="String(route.query.branch||'')" :runtime-events="events" :runtime-scenario-id="run?.scenario_id||''" :runtime-private-excerpts="reviewedExcerpts" :runtime-turns-completed="runtime?.turnsCompleted" :runtime-turns-reserved="runtime?.turnsReserved" @inspect-content="stopPlayback" />
        </section>

        <aside class="inspector-column">
          <header><p>CONTEXT INSPECTOR</p><h2>当前帧</h2></header>
          <dl><div><dt>Agent 世界</dt><dd>{{ world.population_size??contract.population??'—' }}</dd></div><div><dt>本 Tick 激活</dt><dd>{{ world.active_display_ids?.length??selectedSummary?.active_agent_count??'—' }}</dd></div><div><dt>治理动作</dt><dd>{{ selectedSummary?.governance_action_count??0 }}</dd></div><div><dt>资产组</dt><dd>{{ world.assets?.length??0 }}</dd></div></dl>
          <section class="privacy-card"><span>PRIVATE CHANNEL</span><h3>{{ privateData.access==='reviewed_excerpt'?'审阅摘录':privateData.access==='aggregate_only'?'仅聚合可见':'记录不可用' }}</h3><p>{{ privateData.boundary||'私域内容遵循当前运行的访问授权。' }}</p><div v-if="reviewedExcerpts.length" class="excerpt-list"><article v-for="excerpt in reviewedExcerpts" :key="excerpt.excerpt_id"><small>{{ excerpt.source_role_id }} → {{ excerpt.target_role_id }} · {{ excerpt.relation_type }}</small><p>{{ excerpt.text_zh }}</p><em>{{ excerpt.effect_zh }}</em></article></div><small v-else>不会根据计数生成发送者、关系边或对话正文。</small></section>
          <section class="commit-card"><i/><div><b>Committed frame</b><p>界面只播放后端已提交 Tick 和事件，不生成随机动态。</p></div></section>
        </aside>
      </section>

      <section class="bottom-drawer">
        <nav><button v-for="tab in [{id:'risk',label:'风险雷达'},{id:'governance',label:'治理决策室'},{id:'budget',label:'资源账本'},{id:'events',label:'运行事件'}]" :key="tab.id" :class="{active:bottomTab===tab.id}" @click="selectBottomTab(tab.id)">{{ tab.label }}</button></nav>
        <div v-if="bottomTab==='risk'" class="drawer-grid"><article v-for="(risk,index) in risks.items||[]" :key="index"><b>{{ risk.label||risk.risk_id||risk.schema_version||'风险信号' }}</b><p>{{ displayRiskValue(risk) }}</p></article><p v-if="!(risks.items||[]).length" class="empty">当前正式结果没有已发布的风险记录。</p></div>
        <div v-else-if="bottomTab==='governance'" class="drawer-grid"><article v-for="(round,index) in governance.rounds||[]" :key="index"><b>Tick {{ round.tick??round.created_tick??'—' }}</b><p>{{ round.action||round.decision||round.actor||'治理轮次已提交' }}</p></article><p v-if="!(governance.rounds||[]).length" class="empty">当前 Tick 尚无治理动作。</p></div>
        <dl v-else-if="bottomTab==='budget'" class="resource-ledger"><div><dt>请求上限</dt><dd>{{ contract.requestLimit??'等待冻结合同' }}</dd></div><div><dt>Token 上限</dt><dd>{{ contract.tokenLimit??'等待冻结合同' }}</dd></div><div><dt>主槽位</dt><dd>{{ contract.primarySlots??'等待冻结合同' }}</dd></div><div><dt>并发</dt><dd>{{ runtime?.activeUnits??'—' }} / {{ runtime?.concurrencyLimit??'—' }}</dd></div></dl>
        <ol v-else class="event-list"><li v-for="event in activeEvents" :key="event.sequence"><code>#{{ event.sequence }}</code><b>{{ event.kind }}</b><span>{{ event.message||'已提交运行事件' }}</span></li><li v-if="!activeEvents.length" class="empty">暂无已提交事件。</li></ol>
        <footer><span>最后同步：{{ runtime?.updatedAt||'—' }}</span><button v-if="status==='succeeded'" @click="router.push({name:'campus-pulse-run-analysis',params:{runId},query:route.query})">进入分析中心 →</button></footer>
      </section>
    </template>
  </main>
</template>

<style scoped>
.run-live{--ink:#f3f0ee;--muted:#b2a7ab;--line:#41353a;--panel:#211c1e;min-height:100vh;padding:22px clamp(16px,3vw,42px) 54px;color:var(--ink);background:#191617}.console-head{display:flex;justify-content:space-between;align-items:center;gap:24px;margin:auto auto 18px;max-width:1800px}.identity{display:flex;align-items:center;gap:22px}.identity button{color:#c1b6bb;background:none;border:1px solid var(--line);border-radius:999px;padding:9px 14px}.identity p,.runtime-grid header p{margin:0;color:#d15045;font:700 11px monospace;letter-spacing:.15em}.identity h1{margin:4px 0 0;font-size:clamp(22px,3vw,34px)}.runtime-state{display:flex;align-items:center;gap:12px}.runtime-state>span{font:700 10px monospace;color:#6ed39a}.control-deck,.runtime-grid,.bottom-drawer{max-width:1800px;margin:auto;border:1px solid var(--line);background:#211c1e}.control-deck{display:grid;grid-template-columns:auto auto minmax(260px,1fr) auto;align-items:center;gap:22px;padding:15px 18px;border-radius:16px 16px 0 0}.transport{display:flex;gap:7px}.transport button,.transport select,.transport select{border:1px solid #514149;background:#30272b;color:var(--ink);border-radius:8px;padding:8px 11px}.transport .play{background:#ae0b2a;border-color:#ba4b42}.tick-title{display:flex;align-items:baseline;gap:8px}.tick-title span{font:700 9px monospace;color:var(--muted)}.tick-title b{font-size:30px}.tick-title i{font:700 10px monospace;color:#d85a4f}.phase-track{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.phase-track span{text-align:center;color:#aba1a5;font:700 9px monospace}.phase-track span.active{color:#ed756b}.phase-track input{grid-column:1/-1;width:100%;accent-color:#a93a32}.budget-strip{display:flex;gap:18px;margin:0}.budget-strip div{display:grid}.budget-strip dt{font-size:9px;color:var(--muted)}.budget-strip dd{margin:2px 0;font:700 11px monospace}.runtime-grid{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(560px,1.7fr) minmax(270px,.74fr);min-height:630px;border-top:0;transition:opacity .2s}.runtime-grid.muted{opacity:.7}.forum-column,.inspector-column{padding:20px;min-width:0;overflow:hidden}.forum-column{border-right:1px solid var(--line)}.inspector-column{border-left:1px solid var(--line)}.runtime-grid h2{margin:5px 0;font-size:20px}.runtime-grid header>span{font-size:11px;color:var(--muted)}.feed{display:grid;gap:10px;margin-top:18px;max-height:555px;overflow:auto;padding-right:4px}.feed article{padding:13px;border:1px solid #44383d;background:#282124;border-radius:10px}.feed article>div,.feed article footer{display:flex;justify-content:space-between;gap:8px}.feed small,.feed footer{color:#b4aaaf;font-size:10px}.feed p{font-size:13px;line-height:1.55}.world-column{padding:13px;min-width:0;overflow:auto}.inspector-column dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0}.inspector-column dl div{padding:11px;background:#30272b;border-radius:8px}.inspector-column dt{font-size:9px;color:var(--muted)}.inspector-column dd{margin:5px 0 0;font:700 17px monospace}.privacy-card{padding:17px;border:1px solid #64433c;background:#211915;border-radius:12px}.privacy-card span{font:700 9px monospace;color:#dd675b}.privacy-card h3{margin:7px 0}.privacy-card p,.privacy-card small{color:#baa9a1;font-size:12px;line-height:1.55}.commit-card{display:flex;gap:11px;margin-top:14px;padding:14px;background:#282124;border-radius:10px}.commit-card i{width:9px;height:9px;border-radius:50%;background:#65d08f;box-shadow:0 0 14px #65d08f}.commit-card p{margin:4px 0;color:var(--muted);font-size:11px}.bottom-drawer{border-top:0;border-radius:0 0 16px 16px}.bottom-drawer nav{display:flex;border-bottom:1px solid var(--line)}.bottom-drawer nav button{border:0;background:none;color:#b4aaaf;padding:14px 20px}.bottom-drawer nav button.active{color:#fff;background:#30272b;box-shadow:inset 0 -2px #b64037}.drawer-grid,.resource-ledger{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;padding:18px;margin:0}.drawer-grid article,.resource-ledger div{padding:14px;background:#282124;border:1px solid #44383d}.drawer-grid p{color:var(--muted)}.resource-ledger dt{color:var(--muted);font-size:11px}.resource-ledger dd{margin:8px 0 0}.event-list{list-style:none;display:grid;gap:7px;padding:18px;margin:0;max-height:240px;overflow:auto}.event-list li{display:grid;grid-template-columns:55px 180px 1fr;gap:10px;padding:9px;border-bottom:1px solid #44383d;font-size:12px}.event-list code{color:#dc5a50}.bottom-drawer>footer{display:flex;justify-content:space-between;padding:12px 18px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}.bottom-drawer>footer button,.error-state button{border:0;border-radius:999px;background:#ae0b2a;color:white;padding:9px 15px}.loading-state,.error-state{max-width:900px;margin:80px auto;padding:40px;border:1px solid var(--line);background:var(--panel);text-align:center}.empty{color:#b4aaaf;padding:24px;text-align:center;font-size:12px}@media(max-width:1180px){.control-deck{grid-template-columns:auto auto 1fr}.budget-strip{grid-column:1/-1}.runtime-grid{grid-template-columns:300px 1fr}.inspector-column{grid-column:1/-1;border-left:0;border-top:1px solid var(--line)}}@media(max-width:760px){.run-live{padding:14px 10px 40px}.console-head{align-items:flex-start;flex-direction:column}.control-deck{grid-template-columns:1fr}.runtime-grid{grid-template-columns:1fr}.forum-column,.inspector-column{border:0;border-bottom:1px solid var(--line)}.world-column{min-height:520px}.budget-strip{display:grid;grid-template-columns:1fr 1fr}.bottom-drawer nav{overflow:auto}.event-list li{grid-template-columns:48px 1fr}.event-list li span{grid-column:1/-1}}
.excerpt-list{display:grid;gap:9px;margin-top:12px;max-height:260px;overflow:auto}.excerpt-list article{padding:10px;border-left:2px solid #a94037;background:#18120f}.excerpt-list article p{margin:6px 0;color:#e1d7d1}.excerpt-list article em{display:block;color:#9e8d84;font-size:10px;line-height:1.45}
.identity h1{margin:5px 0 3px;line-height:1.25}.identity-copy small{display:block;max-width:min(58vw,720px);overflow:hidden;color:#b4aaaf;font:600 9px/1.4 monospace;text-overflow:ellipsis;white-space:nowrap}.forum-column{display:flex;min-height:0;flex-direction:column}.feed{align-content:start;flex:1;max-height:none;min-height:0}
@media(min-width:1181px){.runtime-grid{height:920px;min-height:0}.forum-column,.world-column,.inspector-column{height:100%;min-height:0}.inspector-column{overflow:auto}}
</style>
