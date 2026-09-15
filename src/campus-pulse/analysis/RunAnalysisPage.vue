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

type Point={tick:number;natural:number;intervention:number}
const route=useRoute();const router=useRouter()
const runId=computed(()=>String(route.params.runId||''))
const session=computed(()=>typeof route.query.session==='string'?route.query.session:(runId.value.startsWith('century-gym')?runId.value:''))
const replayMode=computed(()=>Boolean(session.value))
const loading=ref(true);const error=ref('');const title=ref('运行分析');const status=ref('—')
const points=ref<Point[]>([]);const totalMessages=ref(0);const privateCount=ref<number|null>(null)
const governanceCount=ref(0);const riskCount=ref(0);const eventCount=ref(0);const tokenUse=ref<number|null>(null)
const branchCount=ref(0);const sourceLabel=ref('Live API');const digest=ref('')
const maxValue=computed(()=>Math.max(1,...points.value.flatMap(p=>[p.natural,p.intervention])))
const conclusion=computed(()=>{
  if(!points.value.length)return '当前运行尚未发布足够数据，暂不能形成分析结论。'
  const last=points.value.at(-1)!
  const delta=last.intervention-last.natural
  if(delta===0)return '两个平行世界在当前公开发言量上暂未形成差异，应结合传播路径与风险信号继续判断。'
  return `截至 Tick ${last.tick}，治理分支的本 Tick 公开发言比 Natural ${delta>0?'多':'少'} ${Math.abs(delta)} 条；这描述的是可观测差异，不等同于治理效果因果结论。`
})
const unresolved=computed(()=>riskCount.value?`${riskCount.value} 项风险记录仍需结合证据逐项处置。`:'当前结果没有发布可验证的风险记录，不能据此推断风险为零。')

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
      <button type="button" @click="router.push({name:'campus-pulse-run-live',params:{runId},query:route.query})">← 返回运行台</button>
      <div><p>RUN ANALYSIS · {{ sourceLabel }}</p><h1>{{ title }}</h1><small>{{ runId }} · {{ status }}</small></div>
    </header>
    <section v-if="loading" class="state">正在整理已提交结果与审计边界…</section>
    <section v-else-if="error" class="state error"><b>分析暂不可用</b><p>{{ error }}</p><button @click="load">重试</button></section>
    <template v-else>
      <section class="hero-conclusion"><span>核心观察</span><h2>{{ conclusion }}</h2><p>只使用后端已提交数据；未发布数据保持未知，不补零、不生成叙事。</p></section>
      <section class="metrics" aria-label="运行摘要">
        <div><small>公开发言</small><b>{{ totalMessages }}</b><span>已提交记录</span></div><div><small>平行分支</small><b>{{ branchCount||'—' }}</b><span>已观测范围</span></div><div><small>私聊证据</small><b>{{ privateCount??'—' }}</b><span>{{ replayMode?'审阅摘录':'按权限发布' }}</span></div><div><small>治理动作</small><b>{{ governanceCount }}</b><span>已提交轮次</span></div>
      </section>
      <section class="analysis-grid">
        <article class="wide"><header><span>01 · 发生了什么</span><h2>公开讨论随 Tick 的分支走势</h2></header><div v-if="points.length" class="chart"><div v-for="point in points" :key="point.tick" class="tick"><div class="bars"><i class="natural" :style="{height:`${Math.max(3,point.natural/maxValue*100)}%`}"/><i class="intervention" :style="{height:`${Math.max(3,point.intervention/maxValue*100)}%`}"/></div><small>T{{ point.tick }}</small></div></div><p v-else class="unknown">尚无逐 Tick 公开序列。</p><footer><span><i class="key natural"/>Natural</span><span><i class="key intervention"/>D 治理分支</span></footer></article>
        <article><header><span>02 · 群体差异</span><h2>等待可验证的群体切片</h2></header><p>当前统一接口未发布群体级对照时，本页不会从个别发言推断整体态度。</p></article>
        <article><header><span>03 · 信息传播</span><h2>{{ totalMessages }} 条公开记录进入时间线</h2></header><p>帖子、回复与引用关系应在运行台逐 Tick 查证；分析页只呈现已提交聚合。</p></article>
        <article><header><span>04 · 私聊影响</span><h2>{{ privateCount===null?'访问边界未发布':`${privateCount} 条可审阅证据` }}</h2></header><p>{{ replayMode?'仅包含人工批准的合成摘录，不暴露内部会话 ID 或记录级关系。':'完整合成私聊仅对当前项目运行者按权限开放。' }}</p></article>
        <article><header><span>05 · 风险出现</span><h2>{{ riskCount?`${riskCount} 项风险记录`:'风险状态未知' }}</h2></header><p>{{ unresolved }}</p></article>
        <article><header><span>06 · 治理行动</span><h2>{{ governanceCount }} 个已提交治理轮次</h2></header><p>治理动作与响应只计入已提交帧，前端不会补造策略切换。</p></article>
        <article><header><span>07 · 分叉原因</span><h2>同 Tick、同指标比较</h2></header><p>Natural 是无追加治理的对照语义；D 是配置后的治理组合，差值不自动解释为因果。</p></article>
        <article><header><span>08 · 未解决问题</span><h2>未知不等于零</h2></header><p>{{ unresolved }}</p></article>
        <article><header><span>09 · 成本与余险</span><h2>{{ tokenUse===null?'成本数据尚未发布':`${tokenUse} Token` }}</h2></header><p>Provider、Token 和预算只读取运行合同与后端结算值。</p></article>
        <article><header><span>10 · 技术与审计</span><h2>{{ eventCount||'—' }} 条运行事件</h2></header><p class="digest">{{ digest||'当前来源尚未发布内容摘要。' }}</p></article>
      </section>
    </template>
  </main>
</template>

<style scoped>
.analysis-page{min-height:100vh;padding:clamp(24px,4vw,58px);color:#282326;background:var(--cp-surface-canvas)}.analysis-head{display:flex;align-items:center;gap:24px;max-width:1240px;margin:auto}.analysis-head button,.state button{border:1px solid #cbd4cb;border-radius:999px;padding:10px 16px;background:#fff9;cursor:pointer}.analysis-head p,.analysis-grid header span,.hero-conclusion>span{margin:0;color:#ae0b2a;font:700 10px/1.2 monospace;letter-spacing:.14em}.analysis-head h1{margin:7px 0 3px;font-size:clamp(24px,2.6vw,32px)}.analysis-head small{color:#70686d}.hero-conclusion,.metrics,.analysis-grid,.state{max-width:1240px;margin:32px auto}.hero-conclusion{padding:clamp(28px,5vw,56px);border-radius:12px;background:#272124;color:#f5f1e9;box-shadow:0 24px 70px #26362a1c}.hero-conclusion h2{max-width:1000px;margin:15px 0;font-size:clamp(22px,2.2vw,28px);line-height:1.42}.hero-conclusion p{margin:0;color:#c1b6bb;line-height:1.7}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metrics div{display:grid;gap:5px;padding:20px;border:1px solid #d8ded6;border-radius:16px;background:#fff}.metrics small,.metrics span{color:#736a70}.metrics b{font:700 30px/1.2 monospace}.analysis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.analysis-grid article{min-width:0;padding:25px;border:1px solid #d7ddd5;border-radius:10px;background:#fff}.analysis-grid article.wide{grid-column:1/-1}.analysis-grid h2{margin:8px 0 15px;font-size:21px}.analysis-grid p{margin:0;color:#665e63;line-height:1.75}.chart{display:flex;align-items:end;gap:clamp(5px,1vw,14px);height:230px;padding:20px 12px 0;border-bottom:1px solid #d8ded7;background:linear-gradient(#eef2ed 1px,transparent 1px);background-size:100% 25%}.tick{display:grid;align-self:stretch;flex:1;grid-template-rows:1fr auto;min-width:0;text-align:center}.bars{display:flex;align-items:end;justify-content:center;gap:3px;min-height:0}.bars i{display:block;width:min(10px,40%);border-radius:4px 4px 0 0}.natural,.key.natural{background:#aeb8b0}.intervention,.key.intervention{background:#ae0b2a}.tick small{padding-top:7px;color:#736a70;font:600 9px monospace}.wide footer{display:flex;gap:18px;margin-top:13px;color:#665e63;font-size:12px}.key{display:inline-block;width:16px;height:4px;margin-right:6px;vertical-align:middle}.digest{font-family:monospace;overflow-wrap:anywhere}.unknown,.state{padding:36px;text-align:center}.error{color:#9d251f}@media(max-width:760px){.analysis-page{padding:22px 16px}.analysis-head{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr 1fr}.analysis-grid{grid-template-columns:1fr}.analysis-grid article.wide{grid-column:auto}.chart{overflow-x:auto}.tick{min-width:28px}}
</style>
