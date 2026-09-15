<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { currentLocale } from '../i18n/locale.ts'
import RecordedMessageText from '../i18n/RecordedMessageText.vue'
import { distinctRuntimeEvidence, sharedEvidenceOwners } from './forumWorldRuntime.ts'
import type {
  ForumWorldRuntimeChannel,
  ForumWorldRuntimeEdge,
  ForumWorldRuntimeFrame,
  ForumWorldRuntimeNode,
} from './forumWorldRuntime.ts'
import type { AgentBehaviorChainStep } from './types.ts'

const props = withDefaults(defineProps<{ frame: ForumWorldRuntimeFrame; followAgentId?:string; followChain?:AgentBehaviorChainStep[] }>(), { followAgentId:'', followChain:() => [] })
const emit = defineEmits<{
  inspectNode: [node: ForumWorldRuntimeNode]
  selectNode: [node: ForumWorldRuntimeNode]
  selectEdge: [edge: ForumWorldRuntimeEdge]
  inspectFollow: []
  startFollow: []
  resetFollow: []
}>()

const selectedNodeId = ref('')
const selectedEdgeId = ref('')
const inspectorMode = ref<'idle' | 'node' | 'edge' | 'follow'>('idle')
const channel = ref<'all' | 'public' | 'private'>('all')
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh
const provenanceLabel = (kind:string) => ({
  ui_example:l('示例对话','Conversation example'),
  authorized_live_llm:l('LLM 生成','LLM-generated'),
  exact_trace_replay:l('保存的 LLM 记录','Recorded LLM output'),
  human_reviewed_synthetic_mechanism_excerpt:l('审阅摘录','Reviewed excerpt'),
}[kind] || l('已保存记录','Saved record'))
const edgeDescription = computed(() => {
  const edge = selectedEdge.value
  if (!edge?.label) return ''
  const source = nodeById.value.get(edge.sourceId)?.label || ''
  const target = nodeById.value.get(edge.targetId)?.label || ''
  return edge.label.includes(source) && edge.label.includes(target) ? '' : edge.label
})

watch(() => props.frame.frameId, () => {
  if (selectedEdgeId.value && !props.frame.edges.some((edge) => edge.id === selectedEdgeId.value)) {
    selectedEdgeId.value = ''
    if (inspectorMode.value === 'edge') inspectorMode.value = 'idle'
  }
  if (selectedNodeId.value && !props.frame.nodes.some((node) => node.id === selectedNodeId.value)) {
    selectedNodeId.value = ''
    if (inspectorMode.value === 'node') inspectorMode.value = 'idle'
  }
})

const nodeById = computed(() => new Map(props.frame.nodes.map((node) => [node.id, node])))
const selectedNode = computed(() => nodeById.value.get(selectedNodeId.value) || null)
const selectedEdge = computed(() => props.frame.edges.find((edge) => edge.id === selectedEdgeId.value) || null)
const edgeOwners = computed(() => sharedEvidenceOwners(props.frame.edges))
const sharedEdge = computed(() => props.frame.edges.find(edge => edge.id === edgeOwners.value.get(selectedEdgeId.value)))
const edgeEvidence = computed(() => distinctRuntimeEvidence(selectedEdge.value?.evidence))
const nodeEvidence = computed(() => distinctRuntimeEvidence(selectedNode.value?.evidence))
const currentFollowStep = computed(() => props.followChain.findLast((step) => step.tick === props.frame.tick) || null)
function openSharedEvidence() {
  const source = sharedEdge.value
  if (!source) return
  selectedEdgeId.value = source.id
  emit('selectEdge', source)
}
const edgeProvenance = computed(() => {
  const kinds = new Set(selectedEdge.value?.evidence?.map(item => item.provenance).filter(Boolean))
  return kinds.size === 1 ? [...kinds][0] : ''
})
const maxEdgeCount = computed(() => Math.max(1, ...props.frame.edges.map((edge) => edge.count)))

function isPublic(channelName: ForumWorldRuntimeChannel): boolean {
  return channelName === 'public' || channelName === 'reply' || channelName === 'governance'
}

function isPrivate(channelName: ForumWorldRuntimeChannel): boolean {
  return channelName === 'private_direct' || channelName === 'private_group'
}

const visibleEdges = computed(() => props.frame.edges.filter((edge) => {
  if (edge.channel === 'base') return channel.value === 'all'
  if (channel.value === 'public') return isPublic(edge.channel)
  if (channel.value === 'private') return isPrivate(edge.channel)
  return true
}).map((edge) => ({
  ...edge,
  source: nodeById.value.get(edge.sourceId),
  target: nodeById.value.get(edge.targetId),
})).filter((edge) => edge.source && edge.target))

const publicEdgeCount = computed(() => props.frame.edges.filter((edge) => isPublic(edge.channel)).length)
const privateEdgeCount = computed(() => props.frame.edges.filter((edge) => isPrivate(edge.channel)).length)

function channelLabel(value: ForumWorldRuntimeChannel): string {
  const labels: Record<ForumWorldRuntimeChannel, [string, string]> = {
    base: ['合成关系背景', 'Synthetic relationship'],
    public: ['公开 Feed', 'Public feed'],
    reply: ['直接回复 / 引用', 'Direct reply / quote'],
    private_direct: ['好友私聊', 'Friend chat'],
    private_group: ['动态小群', 'Dynamic group'],
    governance: ['治理信息', 'Governance message'],
  }
  return l(...labels[value])
}

function selectNode(node: ForumWorldRuntimeNode): void {
  selectedNodeId.value = node.id
  selectedEdgeId.value = ''
  inspectorMode.value = 'node'
  emit('selectNode', node)
}

function selectEdge(edge: ForumWorldRuntimeEdge): void {
  selectedEdgeId.value = edge.id
  selectedNodeId.value = ''
  inspectorMode.value = 'edge'
  emit('selectEdge', edge)
}

function startFollow(): void {
  inspectorMode.value = 'follow'
  emit('startFollow')
}
</script>

<template>
  <section class="runtime-world" aria-labelledby="runtime-world-title">
    <header class="runtime-world__head">
      <div>
        <p><i :class="{ playing:frame.playing }" /> LIVE AGENT WORLD · T{{ String(frame.tick).padStart(2,'0') }}</p>
        <h2 id="runtime-world-title">{{ frame.title }}</h2>
        <span>{{ frame.subtitle }}</span>
      </div>
      <div class="runtime-world__controls">
        <strong>{{ frame.statusLabel }} · {{ frame.branchLabel }}</strong>
        <div role="group" :aria-label="l('传播通道','Propagation channel')">
          <button type="button" :class="{ active:channel === 'all' }" @click="channel='all'">{{ l('全部','All') }}</button>
          <button type="button" :class="{ active:channel === 'public' }" @click="channel='public'">{{ l('公开','Public') }}</button>
          <button type="button" :class="{ active:channel === 'private' }" :disabled="privateEdgeCount===0" @click="channel='private'">{{ l('私聊 / 群聊','Private / group') }}</button>
        </div>
      </div>
    </header>

    <dl class="runtime-world__metrics">
      <div v-for="metric in frame.metrics" :key="metric.id">
        <dt>{{ metric.label }}</dt><dd>{{ metric.value }}</dd><small v-if="metric.note">{{ metric.note }}</small>
      </div>
    </dl>

    <div class="runtime-world__layout">
      <div class="runtime-world__stage">
        <svg viewBox="0 0 820 490" role="group" :aria-label="l('Agent 世界公私域传播网络','Public and private propagation in the Agent world')">
          <defs>
            <filter id="runtime-world-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <g class="runtime-world__edges">
            <g
              v-for="edge in visibleEdges"
              :key="edge.id"
              class="runtime-edge"
              :class="[edge.channel,{ selected:selectedEdgeId===edge.id }]"
              role="button"
              :aria-label="`${edge.label || channelLabel(edge.channel)} · ${edge.count}`"
              tabindex="0"
              @click="selectEdge(edge)"
              @keydown.enter="selectEdge(edge)"
              @keydown.space.prevent="selectEdge(edge)"
            >
              <line class="edge-hit" :x1="edge.source.x" :y1="edge.source.y" :x2="edge.target.x" :y2="edge.target.y" />
              <line class="edge-line" :x1="edge.source.x" :y1="edge.source.y" :x2="edge.target.x" :y2="edge.target.y" :stroke-width="edge.channel==='base' ? .65 : 1.2 + 3.8 * edge.count / maxEdgeCount" />
              <title>{{ edge.label || channelLabel(edge.channel) }} · {{ edge.count }}</title>
            </g>
          </g>
          <g
            v-for="node in frame.nodes"
            :key="node.id"
            class="runtime-node"
            :class="{
              active:node.active,
              public:node.publicReached && channel!=='private',
              private:node.privateReached && channel!=='public',
              group:node.groupReached && channel!=='public',
              llm:node.llmSpeaker && channel!=='private',
              selected:selectedNodeId===node.id,
            }"
            role="button"
            :aria-label="`${node.label} · ${node.status}`"
            tabindex="0"
            @click="selectNode(node)"
            @keydown.enter="selectNode(node)"
            @keydown.space.prevent="selectNode(node)"
          >
            <circle v-if="node.active" class="node-radar" :cx="node.x" :cy="node.y" :r="node.radius + 5" />
            <circle v-if="node.llmSpeaker && channel!=='private'" class="llm-ring llm-ring--outer" :cx="node.x" :cy="node.y" :r="node.radius + 5" />
            <circle v-if="node.llmSpeaker && channel!=='private'" class="llm-ring" :cx="node.x" :cy="node.y" :r="node.radius + 2.4" />
            <circle class="node-body" :cx="node.x" :cy="node.y" :r="node.radius" />
            <title>{{ node.label }} · {{ node.status }}</title>
          </g>
        </svg>
        <div class="runtime-world__legend">
          <span><i class="public"/>{{ l('公开传播','Public') }}</span>
          <span><i class="private"/>{{ l('好友私聊','Friend chat') }}</span>
          <span><i class="group"/>{{ l('动态小群','Dynamic group') }}</span>
          <span><i class="llm"/>{{ l('LLM 发言节点','LLM speaker') }}</span>
        </div>
      </div>

      <aside class="runtime-world__inspector" aria-live="polite">
        <div class="inspector-toolbar">
          <button type="button" :class="{ active:inspectorMode==='follow' }" :disabled="!followAgentId" @click="startFollow">
            <i class="fa-solid fa-location-crosshairs" />
            <span>{{ inspectorMode==='follow' ? l('正在实时跟踪','Following live') : l('实时跟踪 Agent','Follow Agent live') }}</span>
            <small v-if="followAgentId">{{ followAgentId }}</small>
          </button>
        </div>
        <section v-if="inspectorMode==='follow'" class="follow-view">
          <header>
            <div><p>{{ l('实时人物行动','LIVE AGENT ACTION') }}</p><h3>{{ followAgentId }} · Tick {{ frame.tick }}</h3></div>
            <button type="button" @click="emit('resetFollow')">{{ l('默认人物','Featured') }}</button>
          </header>
          <template v-if="currentFollowStep">
            <div class="follow-action">
              <small>{{ currentFollowStep.action.action }} · Tick {{ currentFollowStep.tick }}</small>
              <RecordedMessageText :text="currentFollowStep.action.text" />
            </div>
            <dl>
              <div><dt>{{ l('本轮实际看到','Visible this Tick') }}</dt><dd>{{ currentFollowStep.visibleContext[0]?.text || l('本轮行动没有直接父消息或引用。','This action has no direct parent or quoted message.') }}</dd></div>
              <div><dt>{{ l('收到的直接回应','Direct responses') }}</dt><dd>{{ currentFollowStep.responses.length ? currentFollowStep.responses.map(item=>`${item.speaker}：${item.text}`).join(' ｜ ') : l('当前尚未收到直接回应。','No direct response yet.') }}</dd></div>
            </dl>
          </template>
          <div v-else class="follow-idle">
            <i class="fa-solid fa-wave-square" />
            <div><strong>{{ l('本 Tick 未产生公开发言','No public message this Tick') }}</strong><span>{{ l('跟踪保持开启；进入下一 Tick 后会自动显示该人物的新行动。','Following remains active and will update automatically on the next Tick.') }}</span></div>
          </div>
          <button type="button" class="inspect-follow" @click="emit('inspectFollow')">{{ l('查看完整人物与行为链','Open full dossier and action chain') }} →</button>
        </section>
        <template v-else-if="inspectorMode==='edge' && selectedEdge">
          <div class="selection-card edge-selection">
          <p>{{ channelLabel(selectedEdge.channel) }}<span v-if="edgeProvenance !== 'ui_example'"> · {{ selectedEdge.count }}</span></p>
          <h3>{{ nodeById.get(selectedEdge.sourceId)?.label || selectedEdge.sourceId }} <i class="fa-solid fa-arrow-right"/> {{ nodeById.get(selectedEdge.targetId)?.label || selectedEdge.targetId }}</h3>
          <span v-if="edgeDescription">{{ edgeDescription }}</span>
          <small v-if="edgeProvenance" class="source-caption">{{ provenanceLabel(edgeProvenance) }}</small>
          <section v-if="sharedEdge" class="shared-evidence">
            <p>{{ edgeProvenance === 'ui_example' ? l('这条连线使用同一份界面对话示例。','This link uses the shared interface conversation example.') : l('这条传播连线引用已有消息。','This propagation link references an existing message.') }}</p>
            <button @click="openSharedEvidence">{{ l('打开原始内容','Open source content') }} →</button>
          </section>
          <section v-else-if="edgeEvidence.length" class="evidence-stream" :class="{ 'conversation-stream':isPrivate(selectedEdge.channel) }">
            <article v-for="item in edgeEvidence" :key="item.id" :class="{ 'message-right':item.align === 'right' }">
              <small><strong v-if="item.speaker">{{ item.speaker }}</strong><span v-else>{{ item.kicker }}</span><b v-if="item.provenance && !edgeProvenance">{{ provenanceLabel(item.provenance) }}</b></small>
              <RecordedMessageText :text="item.text" />
              <em v-if="item.effect">{{ item.effect }}</em>
            </article>
          </section>
          <section v-else class="edge-fallback"><strong>{{ l('此连接在当前时间步已发生','This connection is committed in the current Tick') }}</strong><span>{{ l('右侧暂未发布逐条消息；连接数量代表该通道的聚合活动。','No message-level text is published for this edge; the count represents aggregate activity in this channel.') }}</span></section>
          </div>
        </template>
        <template v-else-if="inspectorMode==='node' && selectedNode">
          <div class="selection-card node-selection">
          <p>{{ selectedNode.roleId }} · {{ selectedNode.status }}</p>
          <h3>{{ selectedNode.microRole || selectedNode.label }}</h3>
          <span>{{ selectedNode.population ? l(`所属群体 ${selectedNode.population} 个 Agent。`,`Population group: ${selectedNode.population} Agents.`) : l('这是固定 Agent 世界中的可检查节点。','This is an inspectable node in the fixed Agent world.') }}</span>
          <button type="button" class="inspect-node" @click="emit('inspectNode',selectedNode)"><i class="fa-solid fa-address-card"/>{{ l('查看 Profile、Persona、Prompt、记忆与历史','View profile, persona, prompt, memory and history') }}</button>
          <section v-if="nodeEvidence.length" class="evidence-stream">
            <article v-for="item in nodeEvidence" :key="item.id">
              <small>{{ item.kicker }}<b v-if="item.provenance">{{ provenanceLabel(item.provenance) }}</b></small>
              <RecordedMessageText :text="item.text" />
              <em v-if="item.effect">{{ item.effect }}</em>
            </article>
          </section>
          </div>
        </template>
        <div v-else class="runtime-world__empty">
          <i class="fa-solid fa-arrow-pointer"/>
          <div><strong>{{ l('选择节点或流动连线','Select a node or a moving edge') }}</strong><span>{{ l('查看 Agent 档案、公开帖子、好友私聊、群聊及传播依据。','Inspect the Agent dossier, public posts, friend chats, group chats and propagation evidence.') }}</span></div>
        </div>
        <footer><span>{{ publicEdgeCount }} {{ l('条公开边','public edges') }}</span><span>{{ privateEdgeCount }} {{ l('条私域边','private edges') }}</span></footer>
      </aside>
    </div>

    <footer class="runtime-world__boundary">
      <span>{{ frame.boundaryNote || l('节点与连线由同一运行帧驱动；未发布内容不会在前端补造。','Nodes and edges are driven by the same runtime frame; unpublished content is never invented by the interface.') }}</span>
    </footer>
  </section>
</template>

<style scoped>
.runtime-world{overflow:hidden;border:1px solid #33282c;border-radius:var(--cp-radius-lg);background:#151113;color:#f6f0ed;color-scheme:dark;box-shadow:0 26px 64px rgba(19,8,12,.32),inset 0 1px rgba(255,255,255,.035)}
.runtime-world__head{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding:1.25rem 1.4rem;border-bottom:1px solid rgba(255,255,255,.085);background:radial-gradient(circle at 7% 20%,rgba(222,10,65,.24),transparent 23rem),linear-gradient(115deg,#1b1517,#171315 68%,#120f10)}
.runtime-world__head>div:first-child{max-width:58rem}.runtime-world__head p{display:flex;align-items:center;gap:.5rem;margin:0;color:#e8c36f;font:800 .66rem var(--cp-font-mono);letter-spacing:.12em}.runtime-world__head p i{width:.48rem;height:.48rem;border-radius:50%;background:#6f6669}.runtime-world__head p i.playing{background:#f11e52;box-shadow:0 0 .9rem rgba(241,30,82,.9),0 0 0 .3rem rgba(241,30,82,.14);animation:world-blink 1.3s infinite}.runtime-world__head h2{margin:.4rem 0;color:#fffaf7;font-size:clamp(1.25rem,2vw,1.9rem);letter-spacing:-.02em}.runtime-world__head span{color:#aaa0a3;font-size:.75rem;line-height:1.6}
.runtime-world__controls{display:grid;justify-items:end;gap:.55rem}.runtime-world__controls>strong{color:#e2bd68;font:750 .67rem var(--cp-font-mono)}.runtime-world__controls>div{display:flex;padding:.2rem;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(255,255,255,.035)}.runtime-world__controls button{min-height:2.2rem;padding:0 .8rem;border:0;border-radius:999px;background:transparent;color:#a99fa2;font-size:.68rem;font-weight:750;cursor:pointer}.runtime-world__controls button:hover:not(:disabled){color:#fff}.runtime-world__controls button.active{background:#f5eee9;color:#a5002a;box-shadow:0 5px 16px rgba(0,0,0,.28)}.runtime-world__controls button:focus-visible{outline:2px solid #77bfff;outline-offset:2px}.runtime-world__controls button:disabled{cursor:not-allowed;opacity:.34}
.runtime-world__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));margin:0;border-bottom:1px solid rgba(255,255,255,.085);background:#1a1517}.runtime-world__metrics>div{display:grid;gap:.18rem;padding:.75rem 1rem;border-right:1px solid rgba(255,255,255,.075)}.runtime-world__metrics>div:last-child{border-right:0}.runtime-world__metrics dt{color:#92878a;font-size:.62rem}.runtime-world__metrics dd{margin:0;color:#fff7f2;font:800 1.15rem var(--cp-font-mono)}.runtime-world__metrics small{color:#d2aa55;font-size:.58rem}
.runtime-world__layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(19rem,.62fr);min-height:34rem}.runtime-world__stage{position:relative;min-width:0;overflow:hidden;border-right:1px solid rgba(255,255,255,.085);background:radial-gradient(circle at 50% 50%,rgba(204,0,50,.16),transparent 19rem),linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px),#100d0e;background-size:auto,46px 46px,46px 46px,auto}.runtime-world__stage::after{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 32%,rgba(5,2,3,.32) 100%);content:'';pointer-events:none}.runtime-world__stage svg{position:relative;z-index:1;display:block;width:100%;height:100%;min-height:34rem}
.runtime-edge{cursor:pointer}.runtime-edge .edge-hit{stroke:transparent;stroke-width:14}.runtime-edge .edge-line{stroke:#f12658;stroke-linecap:round;stroke-dasharray:3 9;filter:url(#runtime-world-glow);animation:world-flow 1.7s linear infinite}.runtime-edge.base .edge-line{stroke:#766b6f;stroke-dasharray:none;filter:none;opacity:.38;animation:none}.runtime-edge.private_direct .edge-line{stroke:#e0b24c;stroke-dasharray:2 7;animation-duration:1.25s}.runtime-edge.private_group .edge-line{stroke:#9b7bd2;stroke-dasharray:3 8;animation-duration:1.1s}.runtime-edge.governance .edge-line{stroke:#50b9a8}.runtime-edge.selected .edge-line,.runtime-edge:focus-visible .edge-line{stroke:#70bfff;stroke-width:4!important;filter:drop-shadow(0 0 4px rgba(112,191,255,.85))}
.runtime-node{cursor:pointer}.node-body{fill:#4f4649;stroke:#a59a9d;stroke-width:.85}.runtime-node.public .node-body{fill:#bd0c3d;stroke:#ff6d92}.runtime-node.private .node-body{fill:#9a7018;stroke:#e8c670}.runtime-node.group .node-body{fill:#684c9b;stroke:#bd9df0}.runtime-node.public.private .node-body,.runtime-node.public.group .node-body{fill:#c33a55;stroke:#ffd3dc}.runtime-node.llm .node-body{fill:#f0184e;stroke:#fff}.runtime-node.selected .node-body,.runtime-node:focus-visible .node-body{stroke:#70bfff;stroke-width:2.8;filter:drop-shadow(0 0 5px rgba(112,191,255,.9))}.node-radar{fill:none;stroke:#f12658;stroke-width:1;opacity:.66;transform-box:fill-box;transform-origin:center;animation:world-pulse 1.65s ease-out infinite}.runtime-node.private .node-radar,.runtime-node.group .node-radar{stroke:#e4b653}.llm-ring{fill:none;stroke:#fff;stroke-width:1.15;pointer-events:none}.llm-ring--outer{stroke:#ff3165;stroke-dasharray:2 3;filter:drop-shadow(0 0 3px rgba(255,49,101,.85));animation:world-orbit 4.5s linear infinite;transform-box:fill-box;transform-origin:center}
.runtime-world__legend{position:absolute;right:.8rem;bottom:.8rem;z-index:2;display:flex;flex-wrap:wrap;gap:.8rem;padding:.5rem .7rem;border:1px solid rgba(255,255,255,.12);background:rgba(24,18,20,.9);color:#c3b9bc;font-size:.62rem;box-shadow:0 8px 24px rgba(0,0,0,.32);backdrop-filter:blur(9px)}.runtime-world__legend span{display:flex;align-items:center;gap:.35rem}.runtime-world__legend i{width:1.05rem;height:2px;background:#f12658}.runtime-world__legend i.private{background:#e0b24c}.runtime-world__legend i.group{background:#9b7bd2}.runtime-world__legend i.llm{width:.5rem;height:.5rem;border:2px double #fff;border-radius:50%;background:#f0184e;box-shadow:0 0 .55rem #f0184e}
.selection-card{display:grid;gap:.7rem;padding:.85rem;border:1px solid rgba(220,27,75,.52);background:#f8f3ef;color:#21191c}.selection-card>p{color:#9a1233!important}.selection-card>h3{color:#21191c!important}.selection-card>span{color:#5f5559!important}.edge-fallback{display:grid;gap:.25rem;padding:.65rem;border-left:3px solid #d3a447;background:#fff;color:#55484b;font-size:.68rem;line-height:1.5}.edge-fallback span{color:#766b6e}.runtime-world__inspector{display:grid;align-content:start;gap:1rem;min-width:0;max-height:34rem;overflow:auto;padding:1.1rem;background:#191416;scrollbar-color:#5d4a50 #171214}.runtime-world__inspector>p{margin:0;color:#e5bd65;font:750 .65rem var(--cp-font-mono);text-transform:uppercase}.runtime-world__inspector>h3{margin:0;color:#fff8f4;font-size:1.12rem;line-height:1.35}.runtime-world__inspector>h3 i{margin:.25rem;color:#ed2757;font-size:.65rem}.runtime-world__inspector>span{color:#aaa0a3;font-size:.7rem;line-height:1.55}.inspect-node{display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:2.6rem;padding:0 .7rem;border:1px solid #b80031;background:#b80031;color:#fff;font-size:.68rem;font-weight:760;cursor:pointer}.inspect-node:hover{background:#df1549}.inspect-node:focus-visible{outline:2px solid #77bfff;outline-offset:2px}.evidence-stream{display:grid;gap:.55rem}.evidence-stream article{display:grid;gap:.35rem;padding:.7rem;border:1px solid rgba(255,255,255,.09);background:#241d20}.evidence-stream article small{display:flex;justify-content:space-between;gap:.6rem;color:#968b8e;font-size:.6rem}.evidence-stream article small b{color:#e5bd65}.evidence-stream article p{margin:0;color:#e3dadc;font-size:.72rem;line-height:1.55}.evidence-stream article em{padding-left:.5rem;border-left:2px solid #df174b;color:#dba6b3;font-size:.62rem;font-style:normal;line-height:1.45}.runtime-world__empty{display:flex;gap:.7rem;padding:1rem;border:1px dashed rgba(255,255,255,.16);background:#1d1719;color:#9f9497}.runtime-world__empty i{color:#ed2757}.runtime-world__empty div{display:grid;gap:.3rem}.runtime-world__empty strong{color:#f2e9e6;font-size:.76rem}.runtime-world__empty span{font-size:.66rem;line-height:1.5}.runtime-world__inspector>footer{display:flex;gap:.8rem;margin-top:auto;padding-top:.7rem;border-top:1px solid rgba(255,255,255,.085);color:#8f8487;font-size:.6rem}
.runtime-world__boundary{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 1rem;border-top:1px solid rgba(255,255,255,.085);background:#120f10;color:#857b7e;font-size:.62rem}.runtime-world__boundary code{color:#d1a951}
.inspector-toolbar{position:sticky;top:-1.1rem;z-index:4;margin:-1.1rem -1.1rem 0;padding:.75rem 1.1rem;border-bottom:1px solid rgba(255,255,255,.09);background:#191416}.inspector-toolbar>button{display:flex;align-items:center;gap:.45rem;width:100%;min-height:2.35rem;padding:.4rem .65rem;border:1px solid #62565a;background:#211b1d;color:#eee5e2;font:750 .65rem var(--cp-font-sans);cursor:pointer;transition:border-color 150ms ease,background 150ms ease,transform 150ms ease}.inspector-toolbar>button:hover:not(:disabled){border-color:#d4b15e;background:#2b2326;transform:translateY(-1px)}.inspector-toolbar>button.active{border-color:#d6ad4d;background:#302513;color:#f5ce70}.inspector-toolbar>button small{margin-left:auto;color:#b7aaad;font:700 .58rem var(--cp-font-mono)}.inspector-toolbar>button:focus-visible{outline:2px solid #ded4ce;outline-offset:2px}.inspector-toolbar>button:disabled{cursor:not-allowed;opacity:.45}
.follow-view{display:grid;gap:.8rem}.follow-view>header{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem}.follow-view>header p{margin:0 0 .25rem;color:#e8c36f;font:800 .6rem var(--cp-font-mono);letter-spacing:.08em}.follow-view>header h3{margin:0;color:#fff8f4;font-size:1rem}.follow-view>header button{border:0;background:transparent;color:#b8aa9c;font-size:.6rem;cursor:pointer}.follow-view>header button:hover{color:#fff}.follow-action{display:grid;gap:.45rem;padding:.8rem;border-left:3px solid #e51a4c;background:#241d20}.follow-action small{color:#e0b95c;font:700 .6rem var(--cp-font-mono)}.follow-action .recorded-text{margin:0;color:#f3e9e7;font-size:.76rem;line-height:1.65}.follow-view dl{display:grid;gap:.55rem;margin:0}.follow-view dl>div{display:grid;gap:.3rem;padding:.65rem;border:1px solid rgba(255,255,255,.1);background:#1d1719}.follow-view dt{color:#d5ad52;font-size:.58rem}.follow-view dd{margin:0;color:#d8cdcf;font-size:.67rem;line-height:1.55}.follow-idle{display:flex;gap:.65rem;padding:.8rem;border:1px dashed #5a4d51;background:#1d1719}.follow-idle>i{margin-top:.15rem;color:#d8ad4d}.follow-idle>div{display:grid;gap:.25rem}.follow-idle strong{color:#f1e8e5;font-size:.72rem}.follow-idle span{color:#a99b9f;font-size:.64rem;line-height:1.5}.inspect-follow{min-height:2.35rem;border:1px solid #b80031;background:#b80031;color:#fff;font-size:.65rem;font-weight:750;cursor:pointer}.inspect-follow:hover{background:#dc1648}.inspect-follow:focus-visible,.follow-view>header button:focus-visible{outline:2px solid #ded4ce;outline-offset:2px}
@keyframes world-flow{to{stroke-dashoffset:-52}}@keyframes world-pulse{0%{opacity:.75;transform:scale(.75)}100%{opacity:0;transform:scale(1.45)}}@keyframes world-orbit{to{transform:rotate(360deg)}}@keyframes world-blink{50%{opacity:.45}}
@media(max-width:980px){.runtime-world__layout{grid-template-columns:1fr}.runtime-world__stage{border-right:0;border-bottom:1px solid rgba(255,255,255,.085)}.runtime-world__inspector{max-height:none}}
@media(max-width:700px){.runtime-world__head{align-items:flex-start;flex-direction:column}.runtime-world__controls{width:100%;justify-items:stretch}.runtime-world__controls>div{width:100%}.runtime-world__controls button{flex:1}.runtime-world__metrics{grid-template-columns:repeat(2,1fr)}.runtime-world__stage{height:27rem}.runtime-world__stage svg{width:45rem;max-width:none;min-height:27rem;transform:translateX(calc((100vw - 45rem)/2 - 1rem))}.runtime-world__legend{right:.4rem;bottom:.4rem;left:.4rem}.runtime-world__boundary{align-items:flex-start;flex-direction:column}}
@media(prefers-reduced-motion:reduce){.runtime-edge .edge-line,.node-radar,.llm-ring--outer,.runtime-world__head p i.playing{animation:none}}
/* Keep the inspector on the original dark surface; only the selected edge
   itself gets the neutral highlight used in the world graph. */
.selection-card{background:#241d20;color:#f2e9e6;border-color:rgba(255,255,255,.14)}
.selection-card>p{color:#e5bd65!important}
.selection-card>h3{color:#fff8f4!important}
.selection-card>span{color:#b8abad!important}
.edge-fallback{background:#1d1719;color:#e5d9d6}
.edge-fallback span{color:#a99b9f}
.runtime-edge:focus,.runtime-edge:focus-visible{outline:none!important}
.runtime-edge:focus-visible .edge-line{stroke:#ded4ce;stroke-width:4;opacity:1}
.runtime-node:focus{outline:none!important}
.runtime-node:focus-visible .node-body{stroke:#ded4ce;stroke-width:3}
.source-caption{font-size:11px;color:#dec282}
.runtime-world__legend{background:#241d20;backdrop-filter:none;box-shadow:none}
.conversation-stream{gap:14px;padding-block:8px}.conversation-stream article{width:90%;box-sizing:border-box;justify-self:start;border:0;border-radius:2px 9px 9px 9px;background:#362e31;padding:12px;color:#f4eded}.conversation-stream article.message-right{justify-self:end;background:#4a2530;border-radius:9px 2px 9px 9px}.conversation-stream article small{flex-wrap:wrap;align-items:center;gap:6px;color:#d0c3c8;font-size:11px}.conversation-stream article small strong{color:#fff;font-size:12px}.conversation-stream article small b{font-size:10px;font-weight:500;color:#dec282}.conversation-stream article p{font-size:13px;line-height:1.75;overflow-wrap:anywhere}.conversation-stream article:hover{background:#41373b}.conversation-stream article.message-right:hover{background:#542b38}
.runtime-edge:hover .edge-line{stroke-width:4;opacity:1}.runtime-node:hover .node-body{stroke:#eadfdf;stroke-width:2.5}.runtime-edge .edge-line,.node-body{transition:stroke 160ms ease,stroke-width 160ms ease}
@media(prefers-reduced-motion:reduce){.runtime-edge .edge-line,.node-body{transition:none}}
</style>
<style scoped>
.evidence-stream .recorded-text{font-size:13px;color:#ede5e7}.evidence-stream article small{flex-wrap:wrap;line-height:1.5}
.shared-evidence{padding:12px;border:1px solid #67585e;color:#e2d8dc;font-size:13px;line-height:1.6}.shared-evidence p{margin:0 0 12px}.shared-evidence button{min-height:40px;padding:8px 12px;background:#4a2530;color:#fff;border:1px solid #b6647b;font:inherit;cursor:pointer}.shared-evidence button:hover{background:#652e3f}.shared-evidence button:focus-visible{outline:2px solid #eadfdf;outline-offset:3px}
</style>
