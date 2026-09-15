<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getCenturyGymSocialWorld, getRun, getRunAggregateResult, getRunGovernance,
  getRunRisks, getRunRuntime, listRunRuntimeEvents, listRunTicks, readableApiError,
} from '../../services/campusPulseApi.js'
import { adaptCenturyGymSocialWorld } from '../adapters/auditedReplayAdapter.ts'
import { loadLiveManifest, loadLiveTick, type LivePublicTick } from '../live/centuryGymLive.ts'
import { runEventsFromPayload, runtimeSummaryFrom } from '../workbench/workbenchViewModel.ts'
import { currentLocale } from '../i18n/locale.ts'

type Point={tick:number;natural:number;intervention:number}
const route=useRoute();const router=useRouter()
const isEnglish=computed(()=>currentLocale.value==='en-US')
const l=(zh:string,en:string)=>isEnglish.value?en:zh
const runId=computed(()=>String(route.params.runId||''))
const session=computed(()=>typeof route.query.session==='string'?route.query.session:(runId.value.startsWith('century-gym')?runId.value:''))
const replayMode=computed(()=>Boolean(session.value))
const loading=ref(true);const error=ref('');const title=ref('运行分析');const status=ref('—')
const points=ref<Point[]>([]);const totalMessages=ref(0);const privateCount=ref<number|null>(null)
const governanceCount=ref(0);const riskCount=ref(0);const eventCount=ref(0);const tokenUse=ref<number|null>(null)
const branchCount=ref(0);const sourceLabel=ref('Live API');const digest=ref('')
const maxValue=computed(()=>Math.max(1,...points.value.flatMap(p=>[p.natural,p.intervention])))
const conclusion=computed(()=>{
  if(!points.value.length)return l('当前运行尚未发布足够数据，暂不能形成分析结论。','This run has not published enough data for an analysis conclusion.')
  const last=points.value.at(-1)!
  const delta=last.intervention-last.natural
  if(delta===0)return l('两个平行世界在当前公开发言量上暂未形成差异，应结合传播路径与风险信号继续判断。','The parallel worlds currently show no difference in public-message volume; assess propagation paths and risk signals before drawing conclusions.')
  return isEnglish.value
    ? `At Tick ${last.tick}, the governance branch has ${Math.abs(delta)} ${delta>0?'more':'fewer'} public messages than Natural. This is an observed difference, not a causal conclusion about governance effects.`
    : `截至 Tick ${last.tick}，治理分支的本 Tick 公开发言比 Natural ${delta>0?'多':'少'} ${Math.abs(delta)} 条；这描述的是可观测差异，不等同于治理效果因果结论。`
})
const unresolved=computed(()=>riskCount.value
  ? (isEnglish.value?`${riskCount.value} risk records still require evidence-based review.`:`${riskCount.value} 项风险记录仍需结合证据逐项处置。`)
  : l('当前结果没有发布可验证的风险记录，不能据此推断风险为零。','The current result publishes no verifiable risk records; this does not imply zero risk.'))

function countAt(frame:LivePublicTick){return frame.public_branch.messages.filter(m=>m.created_tick===frame.tick).length}
async function loadReplay(){
  const manifest=await loadLiveManifest(session.value,'http://127.0.0.1:8766')
  const frames=await Promise.all(manifest.committed_ticks.map(async entry=>loadLiveTick(session.value,'http://127.0.0.1:8766',entry)))
  const byTick=new Map<number,Point>()
  for(const frame of frames){
    const point=byTick.get(frame.tick)||{tick:frame.tick,natural:0,intervention:0}
    if(frame.branch==='Natural'||frame.branch==='shared_baseline')point.natural=Math.max(point.natural,countAt(frame))
    if(frame.branch==='D'||frame.branch==='shared_baseline')point.intervention=Math.max(point.intervention,countAt(frame))
    byTick.set(frame.tick,point)
    governanceCount.value+=frame.public_branch.governance_rounds?.length||0
  }
  points.value=[...byTick.values()].sort((a,b)=>a.tick-b.tick)
  totalMessages.value=frames.reduce((sum,frame)=>sum+countAt(frame),0)
  branchCount.value=new Set(frames.map(frame=>frame.branch)).size
  const social=adaptCenturyGymSocialWorld(await getCenturyGymSocialWorld())
  privateCount.value=social.reviewed_excerpts.length
  title.value=manifest.scenario_id==='century_gym_ghost_booking_dispute'?'世纪馆“幽灵预约”治理分析':'审计回放分析'
  status.value=manifest.status;digest.value=manifest.content_sha256;sourceLabel.value='Audited Replay'
}
async function loadLive(){
  const [run,runtime,result,ticks,governance,risks,events]=await Promise.allSettled([
    getRun(runId.value),getRunRuntime(runId.value),getRunAggregateResult(runId.value),listRunTicks(runId.value),getRunGovernance(runId.value),getRunRisks(runId.value),listRunRuntimeEvents(runId.value,{afterSequence:0,limit:500}),
  ])
  if(run.status==='fulfilled'){title.value=String(run.value.name||run.value.scenario_id||'项目运行分析')}
  if(runtime.status==='fulfilled'){const value=runtimeSummaryFrom(runtime.value);status.value=value.status;tokenUse.value=value.tokensUsed}
  if(ticks.status==='fulfilled'){
    const rows=Array.isArray(ticks.value?.items)?ticks.value.items:[]
    points.value=rows.map((row:any)=>({tick:Number(row.tick),natural:Number(row.natural_message_count||row.public_message_count||0),intervention:Number(row.intervention_message_count||row.public_message_count||0)}))
    totalMessages.value=rows.reduce((sum:number,row:any)=>sum+Number(row.public_message_count||0),0)
  }
  if(governance.status==='fulfilled')governanceCount.value=(governance.value.rounds||[]).length
  if(risks.status==='fulfilled')riskCount.value=(risks.value.items||[]).length
  if(events.status==='fulfilled')eventCount.value=runEventsFromPayload(events.value).length
  if(result.status==='fulfilled')digest.value=String(result.value.content_sha256||result.value.manifest_sha256||'')
}
async function load(){loading.value=true;error.value='';try{await(replayMode.value?loadReplay():loadLive())}catch(reason){error.value=readableApiError(reason)}finally{loading.value=false}}
onMounted(load)
</script>

<template>
  <main class="analysis-page">
    <header class="analysis-head">
      <button type="button" @click="router.push({name:'campus-pulse-run-live',params:{runId},query:route.query})">← {{ l('返回运行台','Back to live console') }}</button>
      <div><p>RUN ANALYSIS · {{ sourceLabel }}</p><h1 data-no-localize>{{ title }}</h1><small>{{ runId }} · {{ status }}</small></div>
    </header>
    <section v-if="loading" class="state">{{ l('正在整理已提交结果与审计边界…','Organizing committed results and audit boundaries…') }}</section>
    <section v-else-if="error" class="state error"><b>{{ l('分析暂不可用','Analysis unavailable') }}</b><p>{{ error }}</p><button @click="load">{{ l('重试','Retry') }}</button></section>
    <template v-else>
      <section class="hero-conclusion"><span>{{ l('核心观察','Core observation') }}</span><h2>{{ conclusion }}</h2><p>{{ l('只使用后端已提交数据；未发布数据保持未知，不补零、不生成叙事。','Only backend-committed data is used. Unpublished data remains unknown; the interface neither fills zeros nor invents narratives.') }}</p></section>
      <section class="metrics" :aria-label="l('运行摘要','Run summary')">
        <div><small>{{ l('公开发言','Public messages') }}</small><b>{{ totalMessages }}</b><span>{{ l('已提交记录','Committed records') }}</span></div><div><small>{{ l('平行分支','Parallel branches') }}</small><b>{{ branchCount||'—' }}</b><span>{{ l('已观测范围','Observed scope') }}</span></div><div><small>{{ l('私聊证据','Private evidence') }}</small><b>{{ privateCount??'—' }}</b><span>{{ replayMode?l('审阅摘录','Reviewed excerpts'):l('按权限发布','Published by access policy') }}</span></div><div><small>{{ l('治理动作','Governance actions') }}</small><b>{{ governanceCount }}</b><span>{{ l('已提交轮次','Committed rounds') }}</span></div>
      </section>
      <section class="analysis-grid">
        <article class="wide"><header><span>{{ l('01 · 发生了什么','01 · What happened') }}</span><h2>{{ l('公开讨论随 Tick 的分支走势','Public discussion by branch over time') }}</h2></header><div v-if="points.length" class="chart"><div v-for="point in points" :key="point.tick" class="tick"><div class="bars"><i class="natural" :style="{height:`${Math.max(3,point.natural/maxValue*100)}%`}"/><i class="intervention" :style="{height:`${Math.max(3,point.intervention/maxValue*100)}%`}"/></div><small>T{{ point.tick }}</small></div></div><p v-else class="unknown">{{ l('尚无逐 Tick 公开序列。','No public Tick series is available.') }}</p><footer><span><i class="key natural"/>Natural</span><span><i class="key intervention"/>{{ l('D 治理分支','D governance branch') }}</span></footer></article>
        <article><header><span>{{ l('02 · 群体差异','02 · Group differences') }}</span><h2>{{ l('等待可验证的群体切片','Awaiting verifiable group slices') }}</h2></header><p>{{ l('当前统一接口未发布群体级对照时，本页不会从个别发言推断整体态度。','When the unified API does not publish group-level comparisons, this page does not infer aggregate attitudes from individual messages.') }}</p></article>
        <article><header><span>{{ l('03 · 信息传播','03 · Information diffusion') }}</span><h2>{{ isEnglish?`${totalMessages} public records in the timeline`:`${totalMessages} 条公开记录进入时间线` }}</h2></header><p>{{ l('帖子、回复与引用关系应在运行台逐 Tick 查证；分析页只呈现已提交聚合。','Verify posts, replies, and quoted relationships Tick by Tick in the live console; this page shows only committed aggregates.') }}</p></article>
        <article><header><span>{{ l('04 · 私聊影响','04 · Private-channel effects') }}</span><h2>{{ privateCount===null?l('访问边界未发布','Access boundary unpublished'):(isEnglish?`${privateCount} reviewable records`:`${privateCount} 条可审阅证据`) }}</h2></header><p>{{ replayMode?l('仅包含人工批准的合成摘录，不暴露内部会话 ID 或记录级关系。','Includes only human-approved synthetic excerpts; internal conversation IDs and record-level relationships are not exposed.'):l('完整合成私聊仅对当前项目运行者按权限开放。','Complete synthetic private chats are available only to authorized operators of this project run.') }}</p></article>
        <article><header><span>{{ l('05 · 风险出现','05 · Risk emergence') }}</span><h2>{{ riskCount?(isEnglish?`${riskCount} risk records`:`${riskCount} 项风险记录`):l('风险状态未知','Risk status unknown') }}</h2></header><p>{{ unresolved }}</p></article>
        <article><header><span>{{ l('06 · 治理行动','06 · Governance actions') }}</span><h2>{{ isEnglish?`${governanceCount} committed governance rounds`:`${governanceCount} 个已提交治理轮次` }}</h2></header><p>{{ l('治理动作与响应只计入已提交帧，前端不会补造策略切换。','Governance actions and responses count only when committed; the frontend does not invent policy switches.') }}</p></article>
        <article><header><span>{{ l('07 · 分叉原因','07 · Branch rationale') }}</span><h2>{{ l('同 Tick、同指标比较','Same Tick, same metric') }}</h2></header><p>{{ l('Natural 是无追加治理的对照语义；D 是配置后的治理组合，差值不自动解释为因果。','Natural is the no-added-governance control; D is the configured governance combination. Differences are not automatically causal.') }}</p></article>
        <article><header><span>{{ l('08 · 未解决问题','08 · Unresolved questions') }}</span><h2>{{ l('未知不等于零','Unknown does not mean zero') }}</h2></header><p>{{ unresolved }}</p></article>
        <article><header><span>{{ l('09 · 成本与余险','09 · Cost and residual risk') }}</span><h2>{{ tokenUse===null?l('成本数据尚未发布','Cost data unpublished'):`${tokenUse} Token` }}</h2></header><p>{{ l('Provider、Token 和预算只读取运行合同与后端结算值。','Provider, token, and budget values come only from the run contract and backend settlement.') }}</p></article>
        <article><header><span>{{ l('10 · 技术与审计','10 · Technical audit') }}</span><h2>{{ isEnglish?`${eventCount||'—'} runtime events`:`${eventCount||'—'} 条运行事件` }}</h2></header><p class="digest">{{ digest||l('当前来源尚未发布内容摘要。','The current source has not published a content digest.') }}</p></article>
      </section>
    </template>
  </main>
</template>

<style scoped>
.analysis-page{min-height:100vh;padding:var(--cp-space-4) var(--cp-content-gutter) var(--cp-space-8);color:#f1ece7;background:#0b090a}.analysis-head{display:flex;align-items:center;gap:var(--cp-space-4);max-width:1240px;margin:auto;padding:var(--cp-space-3) var(--cp-space-4);border:1px solid #2a2428;border-radius:8px;background:#151113}.analysis-head button,.state button{min-height:36px;padding:0 12px;border:1px solid #51464c;border-radius:6px;background:transparent;color:#f1ece7;cursor:pointer}.analysis-head p,.analysis-grid header span,.hero-conclusion>span{margin:0;color:#c51642;font:700 10px/1.2 var(--cp-font-mono);letter-spacing:.12em}.analysis-head h1{margin:4px 0 2px;font-size:clamp(24px,3vw,34px)}.analysis-head small{color:#9e958f}.hero-conclusion,.metrics,.analysis-grid,.state{max-width:1240px;margin:var(--cp-space-3) auto}.hero-conclusion{padding:var(--cp-space-5);border:1px solid #2a2428;border-left:3px solid #c51642;border-radius:8px;background:#151113;color:#f1ece7}.hero-conclusion h2{max-width:1000px;margin:10px 0;font-size:clamp(20px,2.5vw,30px);line-height:1.4}.hero-conclusion p{margin:0;color:#9e958f;line-height:1.6}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #2a2428;background:#151113}.metrics div{display:grid;gap:3px;padding:var(--cp-space-3);border-right:1px solid #2a2428}.metrics div:last-child{border-right:0}.metrics small,.metrics span{color:#9e958f;font-size:11px}.metrics b{font:700 22px/1.2 var(--cp-font-mono)}.analysis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--cp-space-2)}.analysis-grid article{min-width:0;padding:var(--cp-space-4);border:1px solid #2a2428;border-radius:8px;background:#151113}.analysis-grid article.wide{grid-column:1/-1}.analysis-grid h2{margin:6px 0 10px;font-size:18px}.analysis-grid p{margin:0;color:#b9b0aa;line-height:1.6}.chart{display:flex;align-items:end;gap:clamp(5px,1vw,12px);height:190px;padding:14px 10px 0;border:1px solid #2a2428;background:#0f0d0e}.tick{display:grid;align-self:stretch;flex:1;grid-template-rows:1fr auto;min-width:0;text-align:center}.bars{display:flex;align-items:end;justify-content:center;gap:3px;min-height:0}.bars i{display:block;width:min(10px,40%);border-radius:2px 2px 0 0}.natural,.key.natural{background:#2b6cb0}.intervention,.key.intervention{background:#319795}.tick small{padding-top:6px;color:#9e958f;font:600 9px var(--cp-font-mono)}.wide footer{display:flex;gap:18px;margin-top:10px;color:#9e958f;font-size:11px}.key{display:inline-block;width:16px;height:4px;margin-right:6px;vertical-align:middle}.digest{font-family:var(--cp-font-mono);overflow-wrap:anywhere}.unknown,.state{padding:var(--cp-space-4);border:1px dashed #51464c;background:#100e0f;color:#9e958f;text-align:center}.error{color:#e53e3e}@media(max-width:760px){.analysis-page{padding:var(--cp-space-4)}.analysis-head{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr 1fr}.metrics div{border-bottom:1px solid #2a2428}.analysis-grid{grid-template-columns:1fr}.analysis-grid article.wide{grid-column:auto}.chart{overflow-x:auto}.tick{min-width:28px}}
</style>
