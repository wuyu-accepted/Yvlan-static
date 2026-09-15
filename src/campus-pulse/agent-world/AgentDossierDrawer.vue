<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { restoreForumTwinV2AgentProfile, saveForumTwinV2AgentProfileOverride } from '../../services/campusPulseApi.js'
import { currentLocale, translateInterfaceText } from '../i18n/locale.ts'
import { agentMicroRoleLabel, agentRoleLabel } from './agentWorldLabels.ts'
import type { AgentDossierEvent, AgentDossierPrivateExcerpt, LiveAgentProfileOverlay, PublicAgentDossier } from './types.ts'

const props = withDefaults(defineProps<{
  open:boolean; agent:PublicAgentDossier|null; liveProfile?:LiveAgentProfileOverlay|null
  scenarioLabel?:string; branchLabel?:string; tick?:number|null; statusLabel?:string
  promptHash?:string|null; events?:AgentDossierEvent[]; relatedPrivateExcerpts?:AgentDossierPrivateExcerpt[]
  projectId?:string; editable?:boolean
}>(), {
  liveProfile:null, scenarioLabel:'', branchLabel:'', tick:null, statusLabel:'', promptHash:null,
  events:() => [], relatedPrivateExcerpts:() => [], projectId:'', editable:false,
})
const emit = defineEmits<{ close:[] }>()
type Tab = 'now'|'profile'|'prompt'|'memory'|'history'
type ProjectProfileDraft = {
  schemaVersion:'campus-pulse-project-agent-profile-draft-v1'
  roleDescription:string
  stableBackground:string
  topics:string
  needs:string
  expressionStyle:string
  judgementStyle:string
  participationStyle:string
  activityStyle:string
  behaviorBoundaries:string
  longTermMemory:string
  projectInstructions:string
  updatedAt:string
}
const tab = ref<Tab>('now')
const editingProfile = ref(false)
const savedProfileDraft = ref<ProjectProfileDraft|null>(null)
const workingProfileDraft = ref<ProjectProfileDraft|null>(null)
const profileSaveMessage = ref('')
const profileSaving = ref(false)
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh:string,en:string) => isEnglish.value ? en : zh
const localizedScenarioLabel = computed(() => isEnglish.value ? translateInterfaceText(props.scenarioLabel) : props.scenarioLabel)

const displayId = computed(() => props.liveProfile?.display_id || props.agent?.display_id || '—')
const role = computed(() => agentRoleLabel(
  props.agent?.role_id || props.liveProfile?.macro_role || '',
  props.agent?.role_label || props.liveProfile?.macro_role || '—',
  isEnglish.value,
))
const microRole = computed(() => agentMicroRoleLabel(
  props.liveProfile?.micro_role || props.agent?.micro_role || '',
  props.agent?.role_id || props.liveProfile?.macro_role || '',
  props.agent?.role_label || props.liveProfile?.macro_role || '—',
  isEnglish.value,
))
const topics = computed(() => props.liveProfile?.topic_portfolio?.length ? props.liveProfile.topic_portfolio : props.agent?.profile.topic_portfolio || [])
const needs = computed(() => props.liveProfile?.need_portfolio?.length ? props.liveProfile.need_portfolio : props.agent?.profile.need_portfolio || [])
const historicalFocus = computed(() => props.liveProfile?.historical_episode_focus || props.agent?.profile.historical_episode_focus || '')
function englishMetadata(value:string, fallback:string):string {
  if (!isEnglish.value) return value
  const translated = translateInterfaceText(value)
  return /[\u3400-\u9fff]/.test(translated) ? fallback : translated
}
const displayedTopics = computed(() => topics.value.map((value,index) => englishMetadata(value, `Topic ${index + 1}`)))
const displayedNeeds = computed(() => needs.value.map((value,index) => englishMetadata(value, `Need ${index + 1}`)))
const displayedHistoricalFocus = computed(() => englishMetadata(historicalFocus.value, 'Historical episode recorded in the reviewed Agent profile.'))
const sortedEvents = computed(() => [...props.events].sort((a,b) => b.tick-a.tick || b.id.localeCompare(a.id)))
const recentMemories = computed(() => sortedEvents.value.filter(item => item.text).slice(0,2))
const promptContext = computed(() => sortedEvents.value.filter(item => item.text).slice(0,3))
const persona = computed(() => props.agent?.persona)
const tabs = computed<Array<{key:Tab;label:string}>>(() => [
  {key:'now',label:l('此刻','Now')},{key:'profile',label:l('人物资料','Agent profile')},
  {key:'prompt',label:'Prompt'},{key:'memory',label:l('记忆','Memory')},{key:'history',label:l('历史','History')},
])

function rankedSentence(values:Record<string,number>|undefined, emptyZh:string, emptyEn:string):string {
  const rows = Object.entries(values || {}).sort((left,right) => right[1]-left[1])
  if (!rows.length) return l(emptyZh,emptyEn)
  return rows.map(([name,value]) => `${name} ${Math.round(value*100)}%`).join(l('，',', '))
}

function baseProfileDraft():ProjectProfileDraft {
  const language = persona.value?.language_style
  const boundaries = [...(persona.value?.behavior_boundaries || []), ...(persona.value?.safety_gates || [])]
  return {
    schemaVersion:'campus-pulse-project-agent-profile-draft-v1',
    roleDescription:l(
      `这是“${role.value}”群体中的“${microRole.value}”。该角色描述的是合成论坛中的互动位置，不对应任何真实学生身份。`,
      `This Agent belongs to the “${role.value}” population group and takes the “${microRole.value}” interaction role. It is a synthetic forum position, not a real student identity.`,
    ),
    stableBackground:displayedHistoricalFocus.value || l('暂无公开的历史行为证据。','No published historical behavioural evidence.'),
    topics:displayedTopics.value.join(l('、',', ')) || l('暂无固定议题。','No fixed topic portfolio.'),
    needs:displayedNeeds.value.join(l('、',', ')) || l('暂无固定诉求。','No fixed need portfolio.'),
    expressionStyle:l(
      `通常采用${language?.language_form || '自然论坛口语'}表达，回复时偏向${language?.reply_function || '根据上下文作出反应'}，信息密度为${language?.information_density || '中等'}。`,
      `The Agent usually writes in ${language?.language_form || 'natural forum language'}, tends to ${language?.reply_function || 'respond to the visible context'}, and uses ${language?.information_density || 'medium'} information density.`,
    ),
    judgementStyle:l(
      `面对不确定信息时，${persona.value?.uncertainty_handling || '会依据可见证据和既有经验作出判断'}。信任来源的相对倾向为：${rankedSentence(persona.value?.trust_style,'暂无额外设定','no additional setting') }。`,
      `When information is uncertain, the Agent ${persona.value?.uncertainty_handling || 'judges from visible evidence and prior experience'}. Relative trust tendencies: ${rankedSentence(persona.value?.trust_style,'暂无额外设定','no additional setting')}.`,
    ),
    participationStyle:l(
      `在论坛中的行为倾向为：${rankedSentence(persona.value?.forum_tendencies,'根据当前上下文决定是否行动','acts according to the current context')}。这些倾向是概率约束，不是固定台词。`,
      `Forum participation tendencies are ${rankedSentence(persona.value?.forum_tendencies,'根据当前上下文决定是否行动','context-dependent')}. They constrain probabilities rather than prescribe fixed lines.`,
    ),
    activityStyle:l(
      `活动节律为“${persona.value?.activity_rhythm || '随事件变化'}”，单个时间步的注意力预算约为 ${Math.round((persona.value?.attention_budget || 0)*100)}%。`,
      `The activity rhythm is “${persona.value?.activity_rhythm || 'event-dependent'}”, with an attention budget of about ${Math.round((persona.value?.attention_budget || 0)*100)}% per Tick.`,
    ),
    behaviorBoundaries:boundaries.join(l('；','; ')) || l('遵守当前场景的可行动作范围和安全合同。','Follow the action scope and safety contract of the current scenario.'),
    longTermMemory:props.agent?.memory.long_term_seed || historicalFocus.value || l('暂无长期记忆种子。','No long-term memory seed.'),
    projectInstructions:'',
    updatedAt:'',
  }
}

const displayedProfile = computed(() => savedProfileDraft.value || baseProfileDraft())

function loadProfileDraft():void {
  savedProfileDraft.value = null
  workingProfileDraft.value = null
  editingProfile.value = false
  profileSaveMessage.value = ''
  const override = props.agent?.project_override
  if (override) {
    savedProfileDraft.value = {
      schemaVersion:'campus-pulse-project-agent-profile-draft-v1',
      ...override,
      updatedAt:'',
    }
  }
}

function beginProfileEdit():void {
  workingProfileDraft.value = { ...displayedProfile.value }
  editingProfile.value = true
  profileSaveMessage.value = ''
}

function cancelProfileEdit():void {
  workingProfileDraft.value = null
  editingProfile.value = false
}

async function saveProfileDraft():Promise<void> {
  if (!workingProfileDraft.value || !props.projectId || displayId.value === '—') return
  const fallback = baseProfileDraft()
  const next = Object.fromEntries(Object.entries(workingProfileDraft.value).map(([key,value]) => [key, typeof value === 'string' ? value.trim() : value])) as ProjectProfileDraft
  for (const key of ['roleDescription','stableBackground','topics','needs','expressionStyle','judgementStyle','participationStyle','activityStyle','behaviorBoundaries','longTermMemory'] as const) {
    if (!next[key]) next[key] = fallback[key]
  }
  next.schemaVersion = 'campus-pulse-project-agent-profile-draft-v1'
  next.updatedAt = new Date().toISOString()
  profileSaving.value = true
  try {
    const payload = {
      roleDescription:next.roleDescription,
      stableBackground:next.stableBackground,
      topics:next.topics,
      needs:next.needs,
      expressionStyle:next.expressionStyle,
      judgementStyle:next.judgementStyle,
      participationStyle:next.participationStyle,
      activityStyle:next.activityStyle,
      behaviorBoundaries:next.behaviorBoundaries,
      longTermMemory:next.longTermMemory,
      projectInstructions:next.projectInstructions,
    }
    await saveForumTwinV2AgentProfileOverride(props.projectId,displayId.value,payload)
    savedProfileDraft.value = next
    workingProfileDraft.value = null
    editingProfile.value = false
    profileSaveMessage.value = l('已保存为当前项目的不可变人物设定版本；下次生成运行计划时会绑定该版本哈希。','Saved as an immutable project profile release. The next run plan will bind this release hash.')
  } catch {
    profileSaveMessage.value = l('保存失败：后端未能冻结新的项目人物版本。','Save failed: the backend could not freeze a new project profile release.')
  } finally {
    profileSaving.value = false
  }
}

async function restoreBaseProfile():Promise<void> {
  if (!props.projectId || displayId.value === '—') return
  profileSaving.value = true
  try {
    await restoreForumTwinV2AgentProfile(props.projectId,displayId.value)
    savedProfileDraft.value = null
    workingProfileDraft.value = null
    editingProfile.value = false
    profileSaveMessage.value = l('已通过新的不可变版本恢复该 Agent 的冻结人物资料。','A new immutable release restored this Agent’s reviewed profile.')
  } catch {
    profileSaveMessage.value = l('恢复失败：后端未能提交新的人物版本。','Restore failed: the backend could not commit a new profile release.')
  } finally {
    profileSaving.value = false
  }
}

watch([() => props.open, displayId, () => props.projectId], ([open]) => {
  if (!open) return
  tab.value='now'
  loadProfileDraft()
}, { immediate:true })

function actionLabel(value:string):string {
  const values:Record<string,readonly [string,string]>={post:['发帖','Post'],reply:['回复','Reply'],quote:['引用','Quote'],repost:['转发','Repost'],correct:['纠错','Correct'],verify:['求证','Verify'],seek_help:['求助','Seek help'],report_risk:['风险上报','Risk report'],send_private:['好友私聊','Friend message'],reply_private:['回复私聊','Private reply'],create_group:['创建小群','Create group'],forward_public_to_private:['公开帖转入私聊','Public → private'],forward_private_to_private:['私聊转述','Private forward']}
  const row=values[value]; return row ? l(row[0],row[1]) : value
}
function channelLabel(value:AgentDossierEvent['channel']):string {
  if(value==='private_group') return l('动态小群','Dynamic group')
  if(value==='private_direct') return l('好友私聊','Friend chat')
  if(value==='system') return l('系统状态','System state')
  return l('公开论坛','Public forum')
}
</script>

<template>
  <Teleport to="body"><Transition name="dossier"><div v-if="open" class="dossier-layer" role="dialog" aria-modal="true" :aria-label="l('合成 Agent 档案','Synthetic Agent dossier')" @click.self="emit('close')">
    <article class="dossier-card">
      <header class="dossier-head"><div class="agent-orbit" aria-hidden="true"><i/><i/><b>{{ displayId.slice(-2) }}</b></div><div><p>{{ l('SYNTHETIC LLM AGENT · 活动档案','SYNTHETIC LLM AGENT · LIVE DOSSIER') }}</p><h2>{{ displayId }} <span>{{ statusLabel || l('固定人口成员','Fixed population member') }}</span></h2><strong>{{ microRole }}</strong></div><button type="button" class="dossier-close" :aria-label="l('关闭','Close')" @click="emit('close')"><i class="fa-solid fa-xmark"/></button></header>
      <nav class="dossier-tabs" :aria-label="l('Agent 档案栏目','Agent dossier sections')"><button v-for="item in tabs" :key="item.key" type="button" :class="{active:tab===item.key}" @click="tab=item.key">{{ item.label }}</button></nav>
      <div class="dossier-body">
        <section v-if="tab==='now'" class="now-grid">
          <div class="identity-card"><small>{{ l('当前世界坐标','Current world coordinate') }}</small><h3>{{ role }}</h3><p>{{ localizedScenarioLabel || l('尚未注入事件','No event injected') }} · {{ branchLabel || l('运行前','Pre-run') }} · {{ tick===null ? 'Tick —' : `Tick ${tick}` }}</p><dl><div><dt>{{ l('注意力预算','Attention budget') }}</dt><dd>{{ Math.round((persona?.attention_budget || 0)*100) }}%</dd></div><div><dt>{{ l('公开历史动作','Public history') }}</dt><dd>{{ events.filter(item=>item.channel==='public').length }}</dd></div><div><dt>{{ l('私下历史动作','Private history') }}</dt><dd>{{ events.filter(item=>item.channel!=='public'&&item.channel!=='system').length }}</dd></div></dl></div>
          <div class="state-card"><small>{{ l('当前语义状态','Current semantic state') }}</small><div class="tag-row"><span v-for="(value,index) in displayedTopics" :key="`${index}:${value}`"># {{ value }}</span></div><p v-if="recentMemories.length">{{ l('最近一次可见表达','Latest visible expression') }}</p><blockquote v-if="recentMemories.length" data-content-language="zh">{{ recentMemories[0].text }}</blockquote><div v-else class="empty-state">{{ l('该 Agent 本 Tick 未被 LLM 激活；人格、关系和状态仍在世界中持续存在。','This Agent was not LLM-activated at this Tick; its persona, relationships, and state persist in the world.') }}</div></div>
          <div class="parallel-card"><small>{{ l('一次激活，可并行做什么','One activation, parallel choices') }}</small><ol><li><b>01</b><span>{{ l('最多 1 个公开主动作，可用人物账号或小喇叭匿名身份；也可只读或沉默','Up to 1 public primary action under the profile or an anonymous forum face; read/silence is also valid') }}</span></li><li><b>06</b><span>{{ l('最多 6 个点赞、转发或举报，彼此独立','Up to 6 independent likes, reposts, or reports') }}</span></li><li><b>02</b><span>{{ l('最多 2 个好友私聊、群聊或建群动作','Up to 2 friend, group-chat, or group-creation actions') }}</span></li></ol></div>
        </section>

        <section v-else-if="tab==='profile'" class="section-stack profile-section">
          <header class="profile-heading">
            <div><small>AGENT PROFILE</small><h3>{{ l('完整人物资料','Complete Agent profile') }}</h3><p>{{ l('资料按人物设定直接陈述，不再拆成标签、分数和抽象小卡片。','The dossier is stated directly as an Agent specification rather than split into tags, scores, and abstract cards.') }}</p></div>
            <div v-if="editable && projectId" class="profile-actions">
              <button v-if="!editingProfile" type="button" class="profile-primary" @click="beginProfileEdit"><i class="fa-solid fa-pen"/>{{ savedProfileDraft ? l('继续编辑','Edit draft') : l('编辑本项目设定','Edit for this project') }}</button>
              <template v-else><button type="button" class="profile-quiet" :disabled="profileSaving" @click="cancelProfileEdit">{{ l('取消','Cancel') }}</button><button type="button" class="profile-primary" :disabled="profileSaving" @click="saveProfileDraft">{{ profileSaving ? l('正在冻结…','Freezing…') : l('保存新版本','Save release') }}</button></template>
              <button v-if="savedProfileDraft && !editingProfile" type="button" class="profile-quiet" :disabled="profileSaving" @click="restoreBaseProfile">{{ l('恢复冻结母版','Restore frozen profile') }}</button>
            </div>
          </header>

          <form v-if="editingProfile && workingProfileDraft" class="profile-form" @submit.prevent="saveProfileDraft">
            <label><span>{{ l('人物定位','Role and position') }}</span><textarea v-model="workingProfileDraft.roleDescription" rows="3"/></label>
            <label><span>{{ l('稳定经历与历史行为证据','Stable background and behavioural evidence') }}</span><textarea v-model="workingProfileDraft.stableBackground" rows="4"/></label>
            <label><span>{{ l('长期关注议题','Long-term topic portfolio') }}</span><textarea v-model="workingProfileDraft.topics" rows="2"/></label>
            <label><span>{{ l('核心利益与诉求','Core interests and needs') }}</span><textarea v-model="workingProfileDraft.needs" rows="2"/></label>
            <label><span>{{ l('表达与回复方式','Expression and reply style') }}</span><textarea v-model="workingProfileDraft.expressionStyle" rows="3"/></label>
            <label><span>{{ l('判断信息与信任方式','Judgement and trust') }}</span><textarea v-model="workingProfileDraft.judgementStyle" rows="4"/></label>
            <label><span>{{ l('参与论坛的方式','Forum participation') }}</span><textarea v-model="workingProfileDraft.participationStyle" rows="3"/></label>
            <label><span>{{ l('活动节律与注意力','Activity rhythm and attention') }}</span><textarea v-model="workingProfileDraft.activityStyle" rows="3"/></label>
            <label><span>{{ l('行为边界与安全限制','Behavioural boundaries and safety limits') }}</span><textarea v-model="workingProfileDraft.behaviorBoundaries" rows="4"/></label>
            <label><span>{{ l('长期记忆种子','Long-term memory seed') }}</span><textarea v-model="workingProfileDraft.longTermMemory" rows="4"/></label>
            <label><span>{{ l('本项目附加设定（可选）','Project-specific instruction (optional)') }}</span><textarea v-model="workingProfileDraft.projectInstructions" rows="3" :placeholder="l('例如：在世纪馆场景中，本人每周固定打两次羽毛球，因此对预约公平更敏感。','Example: In the Century Gym scenario, the Agent plays badminton twice a week and is therefore more sensitive to booking fairness.')"/></label>
          </form>

          <article v-else class="profile-document">
            <h4>{{ displayId }} · {{ microRole }}</h4>
            <p><b>{{ l('人物定位。','Role and position. ') }}</b>{{ displayedProfile.roleDescription }}</p>
            <p><b>{{ l('稳定经历。','Stable background. ') }}</b>{{ displayedProfile.stableBackground }}</p>
            <p><b>{{ l('长期关注。','Long-term topics. ') }}</b>{{ displayedProfile.topics }}；{{ l('核心诉求是','Core needs are') }} {{ displayedProfile.needs }}。</p>
            <p><b>{{ l('表达方式。','Expression style. ') }}</b>{{ displayedProfile.expressionStyle }}</p>
            <p><b>{{ l('判断与信任。','Judgement and trust. ') }}</b>{{ displayedProfile.judgementStyle }}</p>
            <p><b>{{ l('参与方式。','Participation. ') }}</b>{{ displayedProfile.participationStyle }}</p>
            <p><b>{{ l('活动状态。','Activity. ') }}</b>{{ displayedProfile.activityStyle }}</p>
            <p><b>{{ l('行为边界。','Boundaries. ') }}</b>{{ displayedProfile.behaviorBoundaries }}</p>
            <p><b>{{ l('长期记忆。','Long-term memory. ') }}</b>{{ displayedProfile.longTermMemory }}</p>
            <p v-if="displayedProfile.projectInstructions"><b>{{ l('本项目附加设定。','Project-specific instruction. ') }}</b>{{ displayedProfile.projectInstructions }}</p>
            <footer>{{ l('证据绑定','Evidence binding') }}：{{ props.agent?.profile.evidence_binding || '—' }}</footer>
          </article>
          <p v-if="profileSaveMessage" class="profile-save-message" role="status">{{ profileSaveMessage }}</p>
          <p v-if="savedProfileDraft" class="profile-draft-note">{{ l('当前显示的是后端持久化的项目人物版本；冻结人口母版、已完成运行和案例证据保持不变。','This project-scoped profile is persisted by the backend. The reviewed population, completed runs, and case evidence remain unchanged.') }}</p>
        </section>

        <section v-else-if="tab==='prompt'" class="section-stack prompt-section"><header><small>PROMPT VIEW</small><h3>{{ promptHash ? l('本 Tick 脱敏 Prompt 视图','Sanitised Prompt view for this Tick') : l('下一次激活的 Prompt 蓝图','Prompt blueprint for the next activation') }}</h3><code v-if="promptHash">{{ promptHash }}</code></header><div class="prompt-window"><p><b>01 · AGENT PROFILE</b><span>{{ displayedProfile.roleDescription }} {{ displayedProfile.stableBackground }} {{ displayedProfile.expressionStyle }} {{ displayedProfile.judgementStyle }} {{ displayedProfile.participationStyle }} {{ displayedProfile.projectInstructions }}</span></p><p><b>02 · CURRENT WORLD</b><span>{{ localizedScenarioLabel || l('待注入场景','Scenario pending') }} / {{ branchLabel || l('待运行','Pre-run') }} / {{ tick===null ? 'Tick —' : `Tick ${tick}` }}</span></p><p><b>03 · MEMORY</b><span>{{ recentMemories.map(item=>item.text).join(' ｜ ') || displayedProfile.longTermMemory }}</span></p><p><b>04 · TIME-VISIBLE CONTEXT</b><span>{{ promptContext.map(item=>`[${channelLabel(item.channel)}] ${item.text}`).join(' ｜ ') || l('当前没有时间可见消息','No time-visible message at this point') }}</span></p><p><b>05 · PUBLIC IDENTITY</b><span>{{ l('公开发帖/评论仍在同一论坛和讨论串。若话题严重、脆弱或担心熟人识别，Agent 可选 anonymous；匿名只隐藏作者，不改变证据要求。','Public posts and comments remain in the same forum and thread. The Agent may choose anonymous for sensitive, vulnerable, or recognition-risk speech; anonymity hides the author face, not the evidence standard.') }}</span></p><p><b>06 · PARALLEL OUTPUT CONTRACT</b><span>{{ l('选择 0–1 个公开主动作、0–6 个独立公开互动、0–2 个私聊/建群动作；三组选择可以同时发生。','Choose 0–1 public primary action, 0–6 independent public engagements, and 0–2 private/group actions. All three groups may co-occur.') }}</span></p></div><div class="commit-note"><i class="fa-solid fa-code-branch"/><span>{{ l('同一 Tick 先冻结所有 Agent 看见的世界，再并行推理，全部通过校验后统一提交；API 返回先后不会改变谁能看到什么。','Each Tick freezes what every Agent can see, runs inference in parallel, then commits validated outputs together; API return order cannot change visibility.') }}</span></div></section>

        <section v-else-if="tab==='memory'" class="section-stack"><header><small>MEMORY</small><h3>{{ l('稳定记忆与最近经历分开保存','Stable memory and recent episodes stay separate') }}</h3></header><article class="memory-seed"><span>{{ l('长期语义记忆种子','Long-term semantic seed') }}</span><p>{{ englishMetadata(props.agent?.memory.long_term_seed || historicalFocus, 'Reviewed long-term memory seed.') || '—' }}</p></article><div class="memory-stream"><article v-for="event in recentMemories" :key="event.id"><b>Tick {{ event.tick }} · {{ channelLabel(event.channel) }}</b><p data-content-language="zh">{{ event.text }}</p></article><p v-if="!recentMemories.length" class="empty-state">{{ l('运行开始后，这里会按时间显示最近两条真实 LLM 经历；后台状态摘要不会伪装成说过的话。','After a run starts, the two latest LLM episodes appear here. Background state summaries are never presented as things the Agent said.') }}</p></div></section>

        <section v-else class="section-stack"><header><small>HISTORY</small><h3>{{ l('这个 Agent 在平行世界里的可见轨迹','This Agent’s visible trajectory through the parallel world') }}</h3></header><ol class="history-stream"><li v-for="event in sortedEvents" :key="event.id"><time>Tick {{ event.tick }}</time><div><b>{{ channelLabel(event.channel) }} · {{ actionLabel(event.action) }}</b><p>{{ event.text || '—' }}</p><small v-if="event.interactionCounts">♥ {{ event.interactionCounts.like }} · ↗ {{ event.interactionCounts.repost }} · ⚑ {{ event.interactionCounts.report }}</small></div></li></ol><p v-if="!sortedEvents.length" class="empty-state">{{ l('该 Agent 在当前公开轨迹中尚未行动。','This Agent has not acted in the current published trajectory.') }}</p><div v-if="relatedPrivateExcerpts.length" class="group-private-evidence"><h4>{{ l('同角色群体的经审阅私聊机制','Reviewed private-chat mechanisms from the same role group') }}</h4><article v-for="item in relatedPrivateExcerpts" :key="item.id"><b>Tick {{ item.tick }} · {{ item.channel==='private_group' ? l('动态小群','Dynamic group') : l('好友私聊','Friend chat') }}</b><p>{{ isEnglish ? item.textEn : item.textZh }}</p><small>{{ isEnglish ? item.effectEn : item.effectZh }}</small></article></div></section>
      </div>
    </article>
  </div></Transition></Teleport>
</template>

<style scoped>
.dossier-layer{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:clamp(.75rem,3vw,2.5rem);background:rgba(13,9,10,.72);backdrop-filter:blur(12px)}.dossier-card{display:grid;grid-template-rows:auto auto minmax(0,1fr);width:min(72rem,100%);max-height:min(88vh,54rem);overflow:hidden;border:1px solid rgba(255,255,255,.16);border-radius:1.1rem;background:#171315;color:#f7f2ee;box-shadow:0 40px 100px rgba(0,0,0,.45)}
.dossier-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:1rem;padding:1.15rem 1.35rem;border-bottom:1px solid rgba(255,255,255,.09);background:radial-gradient(circle at 8% 50%,rgba(205,0,49,.23),transparent 17rem)}.dossier-head p{margin:0 0 .35rem;color:#e5be69;font:800 .66rem/1 var(--cp-font-mono);letter-spacing:.13em}.dossier-head h2{display:flex;align-items:center;gap:.7rem;margin:0;font-size:1.5rem}.dossier-head h2 span{padding:.28rem .5rem;border:1px solid rgba(255,255,255,.15);border-radius:999px;color:#b8aeb0;font-size:.6rem}.dossier-head strong{display:block;margin-top:.28rem;color:#aca2a5;font-size:.75rem}.agent-orbit{position:relative;display:grid;width:3.3rem;height:3.3rem;place-items:center;border:1px solid #7d243b;border-radius:50%}.agent-orbit i{position:absolute;inset:.38rem;border:1px dashed #d62451;border-radius:50%;animation:agent-orbit 8s linear infinite}.agent-orbit i:nth-child(2){inset:.8rem;border-style:solid;animation-direction:reverse;animation-duration:5s}.agent-orbit b{color:#fff;font:800 .72rem var(--cp-font-mono)}
.dossier-close{display:grid;width:2.6rem;height:2.6rem;place-items:center;border:1px solid rgba(255,255,255,.17);border-radius:50%;background:transparent;color:#fff;cursor:pointer}.dossier-close:hover{background:#bd0030}.dossier-close:focus-visible,.dossier-tabs button:focus-visible{outline:2px solid #77bfff;outline-offset:2px}.dossier-tabs{display:flex;gap:.2rem;overflow:auto;padding:.55rem .8rem;border-bottom:1px solid rgba(255,255,255,.08);background:#1e191b}.dossier-tabs button{min-height:2.25rem;padding:0 .8rem;border:0;border-radius:999px;background:transparent;color:#94898c;font-size:.7rem;font-weight:780;cursor:pointer;white-space:nowrap}.dossier-tabs button.active{background:#f6efea;color:#a8002a}.dossier-body{min-height:0;overflow:auto;padding:1.2rem 1.35rem;background:linear-gradient(145deg,#171315,#21191c)}
.now-grid{display:grid;grid-template-columns:.9fr 1.25fr .9fr;gap:.8rem}.now-grid>div,.section-stack>article{padding:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035)}.now-grid small,.section-stack header small{color:#d8b564;font:800 .62rem var(--cp-font-mono);letter-spacing:.1em}.identity-card h3{margin:.55rem 0 .3rem;font-size:1.15rem}.identity-card>p{margin:0;color:#9c9294;font-size:.7rem}.identity-card dl{display:grid;gap:.45rem;margin:1rem 0 0}.identity-card dl div{display:flex;justify-content:space-between;gap:1rem}.identity-card dt{color:#887e80;font-size:.66rem}.identity-card dd{margin:0;font:750 .72rem var(--cp-font-mono)}.tag-row{display:flex;flex-wrap:wrap;gap:.35rem;margin:.7rem 0 1rem}.tag-row span{padding:.32rem .5rem;border:1px solid rgba(225,31,78,.3);background:rgba(205,0,49,.08);color:#e9ccd3;font-size:.64rem}.state-card>p{margin:.7rem 0 .35rem;color:#918689;font-size:.65rem}.state-card blockquote{margin:0;padding:.75rem;border-left:2px solid #df1748;background:rgba(255,255,255,.035);font-size:.76rem;line-height:1.6}.parallel-card ol{display:grid;gap:.55rem;margin:.8rem 0 0;padding:0;list-style:none}.parallel-card li{display:grid;grid-template-columns:2.1rem 1fr;align-items:center;gap:.55rem}.parallel-card b{display:grid;width:2rem;height:2rem;place-items:center;border-radius:50%;background:#c70034;font:800 .62rem var(--cp-font-mono)}.parallel-card span{color:#c5bcbe;font-size:.68rem;line-height:1.45}
.section-stack{display:grid;gap:1rem}.section-stack header h3{margin:.35rem 0 0;font-size:1.35rem}.section-stack header code{display:block;margin-top:.45rem;color:#8f8386;font-size:.6rem;word-break:break-all}.empty-state{margin:0;padding:.8rem;border-left:2px solid #b98a32;background:rgba(185,138,50,.08);color:#ad9fa2;font-size:.7rem;line-height:1.6}.profile-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1.5rem}.profile-heading>div:first-child{max-width:45rem}.profile-heading p{margin:.45rem 0 0;color:#9f9497;font-size:.72rem;line-height:1.55}.profile-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.45rem}.profile-actions button{display:inline-flex;align-items:center;justify-content:center;gap:.42rem;min-height:2.35rem;padding:0 .75rem;border:1px solid rgba(255,255,255,.18);color:#fff;font-size:.68rem;font-weight:750;cursor:pointer}.profile-primary{background:#bd0030}.profile-primary:hover{background:#e01248}.profile-quiet{background:#282124}.profile-actions button:focus-visible,.profile-form textarea:focus-visible{outline:2px solid #77bfff;outline-offset:2px}.profile-document{padding:1.2rem 1.35rem!important;border-left:3px solid #d31849!important;background:#1d181a!important}.profile-document h4{margin:0 0 .7rem;color:#e4bd68;font:800 .72rem var(--cp-font-mono);letter-spacing:.06em}.profile-document p{margin:0;padding:.72rem 0;border-bottom:1px solid rgba(255,255,255,.075);color:#ddd5d5;font-size:.79rem;line-height:1.78}.profile-document p:last-of-type{border-bottom:0}.profile-document p b{color:#fff;font-weight:800}.profile-document footer{margin-top:.9rem;color:#8f8487;font-size:.62rem;word-break:break-all}.profile-form{display:grid;gap:.9rem;padding:1rem 1.1rem;border:1px solid rgba(255,255,255,.12);background:#1d181a}.profile-form label{display:grid;gap:.38rem}.profile-form label span{color:#d7b462;font-size:.68rem;font-weight:760}.profile-form textarea{width:100%;resize:vertical;padding:.7rem .75rem;border:1px solid #4a3f42;border-radius:.2rem;background:#120f10;color:#f5eeee;font:inherit;font-size:.76rem;line-height:1.6}.profile-form textarea::placeholder{color:#746a6d}.profile-save-message,.profile-draft-note{margin:0;padding:.75rem .85rem;color:#cfc5c7;font-size:.68rem;line-height:1.55}.profile-save-message{border-left:2px solid #66bfa0;background:rgba(68,161,126,.08)}.profile-draft-note{border-left:2px solid #d5ad56;background:rgba(185,138,50,.08);color:#b9abad}
.prompt-window{display:grid;gap:1px;padding:1px;background:rgba(255,255,255,.1);font-family:var(--cp-font-mono)}.prompt-window p{display:grid;grid-template-columns:13rem 1fr;gap:1rem;margin:0;padding:.75rem;background:#131012}.prompt-window b{color:#daaf54;font-size:.62rem}.prompt-window span{color:#d3cbcb;font-size:.68rem;line-height:1.55}.commit-note{display:flex;align-items:flex-start;gap:.7rem;padding:.8rem;border:1px solid rgba(97,181,255,.25);background:rgba(57,130,198,.08);color:#b7cbe0;font-size:.7rem;line-height:1.55}.commit-note i{margin-top:.15rem;color:#6dbaff}.memory-seed span{color:#8d8285;font-size:.65rem}.memory-seed p{margin:.45rem 0 0;line-height:1.6}.memory-stream{display:grid;gap:.5rem}.memory-stream article,.group-private-evidence article{padding:.75rem;border-left:2px solid #b80031;background:rgba(255,255,255,.035)}.memory-stream b,.group-private-evidence b{color:#d9b65f;font-size:.64rem}.memory-stream p,.group-private-evidence p{margin:.35rem 0 0;font-size:.73rem;line-height:1.55}
.history-stream{display:grid;gap:.75rem;margin:0;padding:0;list-style:none}.history-stream li{display:grid;grid-template-columns:5rem 1fr;gap:.8rem}.history-stream time{padding-top:.6rem;color:#d4af58;font:750 .64rem var(--cp-font-mono)}.history-stream li>div{padding:.65rem .75rem;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03)}.history-stream b{font-size:.7rem}.history-stream p{margin:.35rem 0;color:#d7cfd0;font-size:.72rem;line-height:1.55}.history-stream small{color:#988d90}.group-private-evidence{display:grid;gap:.55rem;padding-top:.8rem;border-top:1px solid rgba(255,255,255,.1)}.group-private-evidence h4{margin:0;font-size:.78rem}.group-private-evidence article{border-left-color:#d8af56}.group-private-evidence small{display:block;margin-top:.35rem;color:#a89b9e;font-size:.65rem}.dossier-enter-active,.dossier-leave-active{transition:opacity .22s}.dossier-enter-active .dossier-card,.dossier-leave-active .dossier-card{transition:transform .22s}.dossier-enter-from,.dossier-leave-to{opacity:0}.dossier-enter-from .dossier-card,.dossier-leave-to .dossier-card{transform:translateY(18px) scale(.985)}
@keyframes agent-orbit{to{transform:rotate(360deg)}}@media(max-width:900px){.now-grid{grid-template-columns:1fr}.prompt-window p{grid-template-columns:1fr}.profile-heading{flex-direction:column}.profile-actions{justify-content:flex-start}.dossier-card{max-height:94vh}}@media(max-width:600px){.dossier-layer{padding:0}.dossier-card{width:100%;height:100%;max-height:none;border-radius:0}.dossier-head{grid-template-columns:auto 1fr auto;padding:.85rem}.agent-orbit{width:2.7rem;height:2.7rem}.dossier-head h2{font-size:1.1rem}.dossier-head h2 span{display:none}.dossier-body{padding:.85rem}.profile-actions{width:100%}.profile-actions button{flex:1}.profile-document{padding:1rem!important}.profile-form{padding:.8rem}}@media(prefers-reduced-motion:reduce){.agent-orbit i{animation:none}.dossier-enter-active,.dossier-leave-active,.dossier-enter-active .dossier-card,.dossier-leave-active .dossier-card{transition:none}}
.dossier-layer{display:flex;align-items:stretch;justify-content:flex-end;padding:0;backdrop-filter:none}.dossier-card{width:min(35rem,100%);height:100%;max-height:none;border:0;border-left:1px solid var(--cp-border-graphite);border-radius:0;box-shadow:-20px 0 48px rgba(0,0,0,.34)}.dossier-head{background:var(--cp-surface-charcoal)}.dossier-head h2 span,.dossier-close{border-radius:.4rem}.dossier-tabs button{border-radius:.35rem}.dossier-body{background:var(--cp-surface-charcoal)}.dossier-enter-from .dossier-card,.dossier-leave-to .dossier-card{transform:translateX(100%)}
@media(max-width:900px){.dossier-layer{display:grid;place-items:center;padding:var(--cp-space-4)}.dossier-card{width:min(44rem,100%);height:auto;max-height:94vh;border:1px solid var(--cp-border-graphite);border-radius:.5rem}.dossier-enter-from .dossier-card,.dossier-leave-to .dossier-card{transform:translateY(18px)}}
@media(max-width:600px){.dossier-layer{padding:0}.dossier-card{width:100%;height:100%;max-height:none;border-radius:0}}
</style>
