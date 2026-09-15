<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { loadForumAgentWorldPublic, type ForumAgentWorldPublic } from '../../services/forumAgentWorld.ts'
import { loadResourcePrivateChannelSummary, type ResourcePrivateChannelSummary } from '../../services/resourcePrivateChannels.ts'
import type { ResultViewModel } from '../domain/viewModels.ts'
import { currentLocale } from '../i18n/locale.ts'
import { branchDisplayName } from '../results/branchPresentation.ts'
import AgentDossierDrawer from './AgentDossierDrawer.vue'
import { agentMicroRoleLabel, agentRoleLabel } from './agentWorldLabels.ts'
import type { AgentDossierEvent, LiveAgentProfileOverlay, PublicAgentDossier } from './types.ts'
import ForumWorldRuntimeStage from './ForumWorldRuntimeStage.vue'
import type { ForumWorldRuntimeFrame, ForumWorldRuntimeNode } from './forumWorldRuntime.ts'

const props = defineProps<{ result:ResultViewModel; tick:number; branch:'both'|'natural'|'A'|'D' }>()
type WorldNode={agent:PublicAgentDossier;x:number;y:number;roleIndex:number;slotIndex:number}

const world=ref<ForumAgentWorldPublic|null>(null)
const loadError=ref('')
const selectedNode=ref<WorldNode|null>(null)
const dossierOpen=ref(false)
const privateSummary=ref<ResourcePrivateChannelSummary|null>(null)
const privateLoadError=ref('')
const isEnglish=computed(()=>currentLocale.value==='en-US')
const l=(zh:string,en:string)=>isEnglish.value?en:zh

function hash(value:string):number{let h=2166136261;for(let i=0;i<value.length;i+=1){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

onMounted(async()=>{try{world.value=await loadForumAgentWorldPublic()}catch(cause){loadError.value=cause instanceof Error?cause.message:String(cause)}})
onMounted(async()=>{
  if(!props.result.resourcePolicy)return
  try{privateSummary.value=await loadResourcePrivateChannelSummary('offline')}catch(cause){privateLoadError.value=cause instanceof Error?cause.message:String(cause)}
})

const branchIds=computed(()=>props.branch==='both'?new Set(['natural','D']):new Set([props.branch]))
const allMessages=computed(()=>(props.result.forum?.messages||[]).filter(message=>branchIds.value.has(message.branch_id)&&message.created_tick<=props.tick))
const currentMessages=computed(()=>allMessages.value.filter(message=>message.created_tick===props.tick))
const profileById=computed(()=>new Map((props.result.forum?.profiles||[]).map(profile=>[profile.display_id,profile])))
const messageById=computed(()=>new Map(allMessages.value.map(message=>[message.message_id,message])))

const roleIds=computed(()=>[...new Set((world.value?.population.representative_agents||[]).map(agent=>agent.role_id))].sort())
const nodes=computed<WorldNode[]>(()=>{
  const agents=world.value?.population.representative_agents||[]
  const byRole=new Map<string,PublicAgentDossier[]>()
  for(const agent of agents){const rows=byRole.get(agent.role_id)||[];rows.push(agent);byRole.set(agent.role_id,rows)}
  return roleIds.value.flatMap((roleId,roleIndex)=>{
    const centerAngle=-Math.PI/2+roleIndex*Math.PI*2/Math.max(1,roleIds.value.length)
    const cx=410+Math.cos(centerAngle)*306,cy=235+Math.sin(centerAngle)*164
    const rows=byRole.get(roleId)||[]
    return rows.map((agent,slotIndex)=>{
      const angle=(hash(agent.display_id)/0xffffffff)*Math.PI*2+slotIndex*2.3999632297
      const distance=7+20*Math.sqrt((slotIndex+.6)/Math.max(1,rows.length))
      return {agent,x:cx+Math.cos(angle)*distance,y:cy+Math.sin(angle)*distance,roleIndex,slotIndex}
    })
  })
})
const nodesByRole=computed(()=>{const map=new Map<string,WorldNode[]>();for(const node of nodes.value){const rows=map.get(node.agent.role_id)||[];rows.push(node);map.set(node.agent.role_id,rows)}return map})
const nodeByDisplayId=computed(()=>{
  const result=new Map<string,WorldNode>()
  const used=new Set<string>()
  for(const profile of props.result.forum?.profiles||[]){
    const candidates=nodesByRole.value.get(profile.macro_role)||[]
    const exact=candidates.find(node=>node.agent.micro_role===profile.micro_role&&!used.has(node.agent.display_id))
    const fallback=[...candidates].sort((a,b)=>hash(`${profile.display_id}:${a.agent.display_id}`)-hash(`${profile.display_id}:${b.agent.display_id}`)).find(node=>!used.has(node.agent.display_id))
    const node=exact||fallback||candidates[0]
    if(node){result.set(profile.display_id,node);used.add(node.agent.display_id)}
  }
  return result
})
const currentSpeakerNodes=computed(()=>{
  const map=new Map<string,string>()
  for(const message of currentMessages.value){const node=nodeByDisplayId.value.get(message.source_display_id);if(node)map.set(node.agent.display_id,message.source_display_id)}
  return map
})
const replyEdges=computed(()=>currentMessages.value.flatMap(message=>{
  if(!message.parent_message_id)return[]
  const parent=messageById.value.get(message.parent_message_id)
  const source=nodeByDisplayId.value.get(message.source_display_id),target=parent?nodeByDisplayId.value.get(parent.source_display_id):undefined
  return source&&target?[{id:message.message_id,source,target}]:[]
}))
const privateBranchName=computed<'Natural'|'D'>(()=>props.branch==='natural'?'Natural':'D')
const privateBroadBranch=computed(()=>privateSummary.value?.panels.broad_private_panel.branches[privateBranchName.value]||null)
const privateGroupBranch=computed(()=>privateSummary.value?.panels.group_lifecycle_panel.branches[privateBranchName.value]||null)
const privateDirectTick=computed(()=>privateBroadBranch.value?.channel_messages_by_tick.find(row=>row.tick===props.tick)?.direct_message_count||0)
const privateGroupTick=computed(()=>privateGroupBranch.value?.channel_messages_by_tick.find(row=>row.tick===props.tick)?.group_message_count||0)
const privateSenderTick=computed(()=>privateBroadBranch.value?.unique_active_senders_by_tick.find(row=>row.tick===props.tick)?.unique_active_sender_count||0)
const privateNodeIds=computed(()=>new Set([...nodes.value].sort((a,b)=>hash(`${privateBranchName.value}:${props.tick}:private:${a.agent.display_id}`)-hash(`${privateBranchName.value}:${props.tick}:private:${b.agent.display_id}`)).slice(0,Math.min(privateSenderTick.value,nodes.value.length)).map(node=>node.agent.display_id)))
const groupNodeIds=computed(()=>new Set([...nodes.value].sort((a,b)=>hash(`${privateBranchName.value}:${props.tick}:group:${a.agent.display_id}`)-hash(`${privateBranchName.value}:${props.tick}:group:${b.agent.display_id}`)).slice(0,Math.min(privateGroupTick.value,nodes.value.length)).map(node=>node.agent.display_id)))
const privateEdges=computed(()=>{
  const rows=nodes.value.filter(node=>privateNodeIds.value.has(node.agent.display_id))
  if(rows.length<2)return[]
  return Array.from({length:Math.min(privateDirectTick.value,18)},(_,index)=>({id:`private:${index}`,source:rows[hash(`ps:${props.tick}:${index}`)%rows.length],target:rows[hash(`pt:${props.tick}:${index}`)%rows.length]})).filter(edge=>edge.source.agent.display_id!==edge.target.agent.display_id)
})
const groupEdges=computed(()=>{
  const rows=nodes.value.filter(node=>groupNodeIds.value.has(node.agent.display_id))
  if(rows.length<2)return[]
  return Array.from({length:Math.min(privateGroupTick.value,10)},(_,index)=>({id:`group:${index}`,source:rows[index%rows.length],target:rows[(index+1)%rows.length]}))
})
const baseEdges=computed(()=>[...(world.value?.relationships.aggregate_matrix||[])].filter(row=>row.source_role_id!==row.target_role_id).sort((a,b)=>b.directed_edge_count-a.directed_edge_count).slice(0,30).flatMap((row,index)=>{
  const sources=nodesByRole.value.get(row.source_role_id)||[],targets=nodesByRole.value.get(row.target_role_id)||[]
  if(!sources.length||!targets.length)return[]
  return [{id:`${row.source_role_id}:${row.target_role_id}:${index}`,source:sources[hash(`s:${index}`)%sources.length],target:targets[hash(`t:${index}`)%targets.length]}]
}))
const selectedLiveId=computed(()=>selectedNode.value?currentSpeakerNodes.value.get(selectedNode.value.agent.display_id)||'':'')
const selectedLiveProfile=computed<LiveAgentProfileOverlay|null>(()=>{
  const profile=selectedLiveId.value?profileById.value.get(selectedLiveId.value):null
  return profile?{display_id:profile.display_id,macro_role:profile.macro_role,micro_role:profile.micro_role,historical_episode_focus:profile.episode_focus,topic_portfolio:profile.topic_portfolio,need_portfolio:profile.need_portfolio,stable_traits:profile.interaction_style}:null
})
const selectedEvents=computed<AgentDossierEvent[]>(()=>{
  const id=selectedLiveId.value||selectedNode.value?.agent.display_id||''
  return allMessages.value.filter(message=>message.source_display_id===id).map(message=>({id:message.message_id,tick:message.created_tick,channel:'public',action:message.action||'read',text:message.visible_text,stance:message.stance,emotion:message.emotion,evidenceStatus:message.evidence_status,promptHash:message.provenance.prompt_sha256||null,provenance:message.provenance.kind,interactionCounts:message.interaction_counts||null}))
})
const selectedPromptHash=computed(()=>[...selectedEvents.value].sort((a,b)=>b.tick-a.tick).find(item=>item.promptHash)?.promptHash||null)
const scenarioLabel=computed(()=>props.result.scope.scenarioLabel)
const branchLabel=computed(()=>props.branch==='both'
  ? `${branchDisplayName(props.result.key,'Natural',isEnglish.value)} / ${branchDisplayName(props.result.key,'D',isEnglish.value)}`
  : branchDisplayName(props.result.key,props.branch==='natural'?'Natural':props.branch,isEnglish.value))
function openNode(node:WorldNode){selectedNode.value=node;dossierOpen.value=true}

const runtimeFrame=computed<ForumWorldRuntimeFrame>(()=>{
  const nodeEvidence=new Map<string,Array<{id:string;kicker:string;text:string;provenance:string}>>()
  for(const message of allMessages.value){
    const node=nodeByDisplayId.value.get(message.source_display_id)
    if(!node)continue
    const rows=nodeEvidence.get(node.agent.display_id)||[]
    rows.push({id:message.message_id,kicker:`${message.action||l('公开消息','Public message')} · Tick ${message.created_tick}`,text:message.visible_text,provenance:message.provenance.kind})
    nodeEvidence.set(node.agent.display_id,rows)
  }
  const runtimeNodes=nodes.value.map((node)=>({
    id:node.agent.display_id,
    roleId:node.agent.role_id,
    label:agentRoleLabel(node.agent.role_id,node.agent.role_label,isEnglish.value),
    microRole:agentMicroRoleLabel(node.agent.micro_role,node.agent.role_id,node.agent.role_label,isEnglish.value),
    x:node.x,
    y:node.y,
    radius:currentSpeakerNodes.value.has(node.agent.display_id)?4.6:3,
    active:currentSpeakerNodes.value.has(node.agent.display_id)||privateNodeIds.value.has(node.agent.display_id)||groupNodeIds.value.has(node.agent.display_id),
    publicReached:currentSpeakerNodes.value.has(node.agent.display_id),
    privateReached:privateNodeIds.value.has(node.agent.display_id),
    groupReached:groupNodeIds.value.has(node.agent.display_id),
    llmSpeaker:currentSpeakerNodes.value.has(node.agent.display_id),
    status:currentSpeakerNodes.value.has(node.agent.display_id)?l('本 Tick 公开 LLM 发言','Public LLM speaker this Tick'):privateNodeIds.value.has(node.agent.display_id)||groupNodeIds.value.has(node.agent.display_id)?l('本 Tick 私域触达','Private-channel reach this Tick'):l('后台状态','Background state'),
    evidence:(nodeEvidence.get(node.agent.display_id)||[]).slice(-4),
  }))
  const base=baseEdges.value.map((edge)=>({id:`base:${edge.id}`,sourceId:edge.source.agent.display_id,targetId:edge.target.agent.display_id,channel:'base' as const,count:1,label:l('固定合成关系背景','Fixed synthetic relationship')}))
  const replies=replyEdges.value.map((edge)=>{
    const message=messageById.value.get(edge.id)
    const parent=message?.parent_message_id?messageById.value.get(message.parent_message_id):null
    return {id:`reply:${edge.id}`,sourceId:edge.source.agent.display_id,targetId:edge.target.agent.display_id,channel:'reply' as const,count:1,label:l('严格 parent 直接回复','Strict parent direct reply'),evidence:message?[{id:message.message_id,kicker:`${l('回复','Reply')} · Tick ${message.created_tick}`,text:message.visible_text,effect:parent?`${l('回应','Replies to')}：${parent.visible_text}`:'',provenance:message.provenance.kind}]:[]}
  })
  const directs=privateEdges.value.map((edge)=>({id:edge.id,sourceId:edge.source.agent.display_id,targetId:edge.target.agent.display_id,channel:'private_direct' as const,count:1,label:l(`本 Tick 匿名好友私聊聚合（共 ${privateDirectTick.value} 条）`,`Anonymous friend-chat aggregate (${privateDirectTick.value} this Tick)`),evidence:[{id:`${edge.id}:aggregate`,kicker:l('匿名私域聚合','Anonymous private aggregate'),text:l('该案例只发布私聊数量、活跃发送者与渠道分布；未经人工审阅的私聊原文不会导出。','This case publishes only private-message counts, active senders and channel composition; unreviewed private text is not exported.'),provenance:'reviewed aggregate'}]}))
  const groups=groupEdges.value.map((edge)=>({id:edge.id,sourceId:edge.source.agent.display_id,targetId:edge.target.agent.display_id,channel:'private_group' as const,count:1,label:l(`本 Tick 匿名动态小群聚合（共 ${privateGroupTick.value} 条）`,`Anonymous dynamic-group aggregate (${privateGroupTick.value} this Tick)`),evidence:[{id:`${edge.id}:aggregate`,kicker:l('动态小群聚合','Dynamic-group aggregate'),text:l('连线表示本时间步群聊活动的匿名投影，不公开群成员或会话标识。','The edge is an anonymous projection of group-chat activity at this Tick; members and conversation identifiers stay private.'),provenance:'reviewed aggregate'}]}))
  return {
    frameId:`case:${props.result.key}:${props.branch}:${props.tick}`,
    title:l('校园 Agent 世界实时演化','Live evolution of the campus Agent world'),
    subtitle:l('同一组件同步显示公开发言、严格直接回复、好友私聊和动态小群；点击节点或连线可下钻当前时点证据。','One component synchronizes public speech, strict direct replies, friend chats and dynamic groups. Select a node or edge to inspect current-Tick evidence.'),
    tick:props.tick,
    branchLabel:branchLabel.value,
    statusLabel:l('案例轨迹','Case trace'),
    playing:false,
    nodes:runtimeNodes,
    edges:[...base,...replies,...directs,...groups],
    metrics:[
      {id:'active',label:l('本 Tick 激活节点','Active nodes'),value:runtimeNodes.filter(node=>node.active).length,note:`/ ${runtimeNodes.length}`},
      {id:'speakers',label:l('公开 LLM 发言者','Public LLM speakers'),value:new Set(currentMessages.value.map(item=>item.source_display_id)).size},
      {id:'replies',label:l('严格直接回复','Strict direct replies'),value:replyEdges.value.length},
      {id:'direct',label:l('好友私聊','Friend chat'),value:privateDirectTick.value},
      {id:'group',label:l('动态小群','Dynamic groups'),value:privateGroupTick.value},
    ],
    contentSha256:privateSummary.value?.summary_sha256||world.value?.world_sha256||props.result.source.provenance.actualHash||props.result.source.provenance.expectedHash,
    boundaryNote:privateLoadError.value
      ? l('公域内容来自已校验 LLM 轨迹；私域聚合校验失败，因此本帧不显示私聊或群聊连线。','Public content comes from verified LLM traces. Private aggregates failed validation, so this frame omits private and group links.')
      : !props.result.resourcePolicy
        ? l('公域内容来自本案例已校验 LLM 轨迹；该案例没有发布私域伴随结果，因此私聊与群聊保持为空。','Public content comes from this case’s verified LLM trace. No private companion result was published for this case, so friend and group chat remain empty.')
      : l('公域内容来自已校验 LLM 轨迹；私域仅呈现通过校验的匿名聚合，界面不补造私聊原文或好友边。','Public content comes from verified LLM traces; private channels show only validated anonymous aggregates, without invented chat text or friend edges.'),
  }
})

function inspectRuntimeNode(node:ForumWorldRuntimeNode){
  const match=nodes.value.find((item)=>item.agent.display_id===node.id)
  if(match)openNode(match)
}
</script>

<template>
  <div class="case-world-wrapper">
    <div v-if="loadError" class="case-world-error" role="alert">{{ loadError }}</div>
    <ForumWorldRuntimeStage v-else :frame="runtimeFrame" @inspect-node="inspectRuntimeNode" />
    <AgentDossierDrawer :open="dossierOpen" :agent="selectedNode?.agent||null" :live-profile="selectedLiveProfile" :scenario-label="scenarioLabel" :branch-label="branchLabel" :tick="tick" :status-label="selectedLiveId ? l('本 Tick 真实 LLM 发言','Live LLM speaker at this Tick') : l('本 Tick 后台状态','Background state at this Tick')" :prompt-hash="selectedPromptHash" :events="selectedEvents" @close="dossierOpen=false"/>
  </div>
</template>

<style scoped>
.case-world-wrapper{display:grid;gap:var(--cp-space-4);margin:var(--cp-space-4) 0}
.case-world-error{padding:1rem;border:1px solid #e1a2b2;background:#fff4f7;color:#8a1732;font-size:.75rem}
</style>
