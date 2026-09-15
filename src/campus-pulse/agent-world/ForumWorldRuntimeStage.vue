<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { currentLocale } from '../i18n/locale.ts'
import type {
  ForumWorldRuntimeChannel,
  ForumWorldRuntimeEdge,
  ForumWorldRuntimeFrame,
  ForumWorldRuntimeNode,
} from './forumWorldRuntime.ts'

const props = defineProps<{ frame: ForumWorldRuntimeFrame }>()
const emit = defineEmits<{
  inspectNode: [node: ForumWorldRuntimeNode]
  selectEdge: [edge: ForumWorldRuntimeEdge]
}>()

const selectedNodeId = ref('')
const selectedEdgeId = ref('')
const channel = ref<'all' | 'public' | 'private'>('all')
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh

watch(() => props.frame.frameId, () => {
  selectedEdgeId.value = ''
  if (!props.frame.nodes.some((node) => node.id === selectedNodeId.value)) selectedNodeId.value = ''
})

const nodeById = computed(() => new Map(props.frame.nodes.map((node) => [node.id, node])))
const selectedNode = computed(() => nodeById.value.get(selectedNodeId.value) || null)
const selectedEdge = computed(() => props.frame.edges.find((edge) => edge.id === selectedEdgeId.value) || null)
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
}

function selectEdge(edge: ForumWorldRuntimeEdge): void {
  selectedEdgeId.value = edge.id
  selectedNodeId.value = ''
  emit('selectEdge', edge)
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
        <dt>
          {{ metric.label }}
          <span v-if="metric.help" class="metric-help">
            <button type="button" :aria-describedby="`metric-help-${metric.id}`" :aria-label="l(`${metric.label}说明`,`${metric.label} information`)">i</button>
            <span :id="`metric-help-${metric.id}`" role="tooltip">{{ metric.help }}</span>
          </span>
        </dt><dd>{{ metric.value }}</dd><small v-if="metric.note">{{ metric.note }}</small>
      </div>
    </dl>

    <div class="runtime-world__layout">
      <div class="runtime-world__stage">
        <svg viewBox="0 0 820 490" role="img" :aria-label="l('Agent 世界公私域传播网络','Public and private propagation in the Agent world')">
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
        <template v-if="selectedEdge">
          <p>{{ channelLabel(selectedEdge.channel) }} · {{ selectedEdge.count }}</p>
          <h3>{{ nodeById.get(selectedEdge.sourceId)?.label || selectedEdge.sourceId }} <i class="fa-solid fa-arrow-right"/> {{ nodeById.get(selectedEdge.targetId)?.label || selectedEdge.targetId }}</h3>
          <span>{{ selectedEdge.label || l('这条边表示当前时间步已经提交的传播或聚合联系。','This edge represents committed propagation or an aggregate connection at the current Tick.') }}</span>
          <section v-if="selectedEdge.evidence?.length" class="evidence-stream">
            <article v-for="item in selectedEdge.evidence" :key="item.id">
              <small>{{ item.kicker }}<b v-if="item.provenance">{{ item.provenance }}</b></small>
              <p>{{ item.text }}</p>
              <em v-if="item.effect">{{ item.effect }}</em>
            </article>
          </section>
        </template>
        <template v-else-if="selectedNode">
          <p>{{ selectedNode.roleId }} · {{ selectedNode.status }}</p>
          <h3>{{ selectedNode.microRole || selectedNode.label }}</h3>
          <span>{{ selectedNode.population ? l(`所属群体 ${selectedNode.population} 个 Agent。`,`Population group: ${selectedNode.population} Agents.`) : l('这是固定 Agent 世界中的可检查节点。','This is an inspectable node in the fixed Agent world.') }}</span>
          <button type="button" class="inspect-node" @click="emit('inspectNode',selectedNode)"><i class="fa-solid fa-address-card"/>{{ l('查看 Profile、Persona、Prompt、记忆与历史','View profile, persona, prompt, memory and history') }}</button>
          <section v-if="selectedNode.evidence?.length" class="evidence-stream">
            <article v-for="item in selectedNode.evidence" :key="item.id">
              <small>{{ item.kicker }}<b v-if="item.provenance">{{ item.provenance }}</b></small>
              <p>{{ item.text }}</p>
              <em v-if="item.effect">{{ item.effect }}</em>
            </article>
          </section>
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
      <code v-if="frame.contentSha256">{{ frame.contentSha256.slice(0,12) }}…</code>
    </footer>
  </section>
</template>

<style scoped>
.runtime-world{overflow:hidden;border:1px solid #33282c;border-radius:var(--cp-radius-lg);background:#151113;color:#f6f0ed;color-scheme:dark;box-shadow:0 26px 64px rgba(19,8,12,.32),inset 0 1px rgba(255,255,255,.035)}
.runtime-world__head{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding:1.25rem 1.4rem;border-bottom:1px solid rgba(255,255,255,.085);background:radial-gradient(circle at 7% 20%,rgba(222,10,65,.24),transparent 23rem),linear-gradient(115deg,#1b1517,#171315 68%,#120f10)}
.runtime-world__head>div:first-child{max-width:58rem}.runtime-world__head p{display:flex;align-items:center;gap:.5rem;margin:0;color:#e8c36f;font:800 .66rem var(--cp-font-mono);letter-spacing:.12em}.runtime-world__head p i{width:.48rem;height:.48rem;border-radius:50%;background:#6f6669}.runtime-world__head p i.playing{background:#f11e52;box-shadow:0 0 .9rem rgba(241,30,82,.9),0 0 0 .3rem rgba(241,30,82,.14);animation:world-blink 1.3s infinite}.runtime-world__head h2{margin:.4rem 0;color:#fffaf7;font-size:clamp(1.25rem,2vw,1.9rem);letter-spacing:-.02em}.runtime-world__head span{color:#aaa0a3;font-size:.75rem;line-height:1.6}
.runtime-world__controls{display:grid;justify-items:end;gap:.55rem}.runtime-world__controls>strong{color:#e2bd68;font:750 .67rem var(--cp-font-mono)}.runtime-world__controls>div{display:flex;padding:.2rem;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(255,255,255,.035)}.runtime-world__controls button{min-height:2.2rem;padding:0 .8rem;border:0;border-radius:999px;background:transparent;color:#a99fa2;font-size:.68rem;font-weight:750;cursor:pointer}.runtime-world__controls button:hover:not(:disabled){color:#fff}.runtime-world__controls button.active{background:#f5eee9;color:#a5002a;box-shadow:0 5px 16px rgba(0,0,0,.28)}.runtime-world__controls button:focus-visible{outline:2px solid #77bfff;outline-offset:2px}.runtime-world__controls button:disabled{cursor:not-allowed;opacity:.34}
.runtime-world__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));margin:0;border-bottom:1px solid rgba(255,255,255,.085);background:#1a1517}.runtime-world__metrics>div{display:grid;grid-template-rows:2.25rem auto auto;align-content:start;gap:.18rem;padding:.75rem 1rem;border-right:1px solid rgba(255,255,255,.075)}.runtime-world__metrics>div:last-child{border-right:0}.runtime-world__metrics dt{position:relative;min-width:0;padding-right:1.2rem;color:#92878a;font-size:.62rem;line-height:1.35}.runtime-world__metrics dd{align-self:start;margin:0;color:#fff7f2;font:800 1.15rem var(--cp-font-mono)}.runtime-world__metrics small{color:#d2aa55;font-size:.58rem}
.metric-help{position:absolute;top:-.12rem;right:0;display:inline-flex}.metric-help>button{display:inline-grid;width:1rem;height:1rem;padding:0;place-items:center;border:1px solid #51464c;border-radius:50%;background:transparent;color:#8f8588;font:700 .58rem/1 var(--cp-font-mono);cursor:help}.metric-help>button:hover,.metric-help>button:focus-visible{border-color:#8f8588;color:#f1ece7;outline:none}.metric-help>[role="tooltip"]{position:absolute;right:0;bottom:calc(100% + .35rem);z-index:4;width:12rem;max-width:min(12rem,72vw);padding:.38rem .48rem;border:1px solid #51464c;border-radius:4px;background:#0b090a;color:#c9c0bc;font:500 .62rem/1.4 var(--cp-font-sans);white-space:pre-line;box-shadow:0 4px 12px rgba(0,0,0,.24);opacity:0;pointer-events:none;transform:translateY(.15rem);transition:opacity .12s,transform .12s}.metric-help:hover>[role="tooltip"],.metric-help:focus-within>[role="tooltip"]{opacity:1;transform:none}
.runtime-world__layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(19rem,.62fr);min-height:34rem}.runtime-world__stage{position:relative;min-width:0;overflow:hidden;border-right:1px solid rgba(255,255,255,.085);background:radial-gradient(circle at 50% 50%,rgba(204,0,50,.16),transparent 19rem),linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px),#100d0e;background-size:auto,46px 46px,46px 46px,auto}.runtime-world__stage::after{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 32%,rgba(5,2,3,.32) 100%);content:'';pointer-events:none}.runtime-world__stage svg{position:relative;z-index:1;display:block;width:100%;height:100%;min-height:34rem}
.runtime-edge{cursor:pointer}.runtime-edge .edge-hit{stroke:transparent;stroke-width:14}.runtime-edge .edge-line{stroke:#f12658;stroke-linecap:round;stroke-dasharray:3 9;filter:url(#runtime-world-glow);animation:world-flow 1.7s linear infinite}.runtime-edge.base .edge-line{stroke:#766b6f;stroke-dasharray:none;filter:none;opacity:.38;animation:none}.runtime-edge.private_direct .edge-line{stroke:#e0b24c;stroke-dasharray:2 7;animation-duration:1.25s}.runtime-edge.private_group .edge-line{stroke:#9b7bd2;stroke-dasharray:3 8;animation-duration:1.1s}.runtime-edge.governance .edge-line{stroke:#50b9a8}.runtime-edge.selected .edge-line,.runtime-edge:focus-visible .edge-line{stroke:#70bfff;stroke-width:4!important;filter:drop-shadow(0 0 4px rgba(112,191,255,.85))}
.runtime-node{cursor:pointer}.node-body{fill:#4f4649;stroke:#a59a9d;stroke-width:.85}.runtime-node.public .node-body{fill:#bd0c3d;stroke:#ff6d92}.runtime-node.private .node-body{fill:#9a7018;stroke:#e8c670}.runtime-node.group .node-body{fill:#684c9b;stroke:#bd9df0}.runtime-node.public.private .node-body,.runtime-node.public.group .node-body{fill:#c33a55;stroke:#ffd3dc}.runtime-node.llm .node-body{fill:#f0184e;stroke:#fff}.runtime-node.selected .node-body,.runtime-node:focus-visible .node-body{stroke:#70bfff;stroke-width:2.8;filter:drop-shadow(0 0 5px rgba(112,191,255,.9))}.node-radar{fill:none;stroke:#f12658;stroke-width:1;opacity:.66;transform-box:fill-box;transform-origin:center;animation:world-pulse 1.65s ease-out infinite}.runtime-node.private .node-radar,.runtime-node.group .node-radar{stroke:#e4b653}.llm-ring{fill:none;stroke:#fff;stroke-width:1.15;pointer-events:none}.llm-ring--outer{stroke:#ff3165;stroke-dasharray:2 3;filter:drop-shadow(0 0 3px rgba(255,49,101,.85));animation:world-orbit 4.5s linear infinite;transform-box:fill-box;transform-origin:center}
.runtime-world__legend{position:absolute;right:.8rem;bottom:.8rem;z-index:2;display:flex;flex-wrap:wrap;gap:.8rem;padding:.5rem .7rem;border:1px solid rgba(255,255,255,.12);background:rgba(24,18,20,.9);color:#c3b9bc;font-size:.62rem;box-shadow:0 8px 24px rgba(0,0,0,.32);backdrop-filter:blur(9px)}.runtime-world__legend span{display:flex;align-items:center;gap:.35rem}.runtime-world__legend i{width:1.05rem;height:2px;background:#f12658}.runtime-world__legend i.private{background:#e0b24c}.runtime-world__legend i.group{background:#9b7bd2}.runtime-world__legend i.llm{width:.5rem;height:.5rem;border:2px double #fff;border-radius:50%;background:#f0184e;box-shadow:0 0 .55rem #f0184e}
.runtime-world__inspector{display:grid;align-content:start;gap:1rem;min-width:0;max-height:34rem;overflow:auto;padding:1.1rem;background:linear-gradient(155deg,#1d1719,#151113);scrollbar-color:#5d4a50 #171214}.runtime-world__inspector>p{margin:0;color:#e5bd65;font:750 .65rem var(--cp-font-mono);text-transform:uppercase}.runtime-world__inspector>h3{margin:0;color:#fff8f4;font-size:1.12rem;line-height:1.35}.runtime-world__inspector>h3 i{margin:.25rem;color:#ed2757;font-size:.65rem}.runtime-world__inspector>span{color:#aaa0a3;font-size:.7rem;line-height:1.55}.inspect-node{display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:2.6rem;padding:0 .7rem;border:1px solid #b80031;background:#b80031;color:#fff;font-size:.68rem;font-weight:760;cursor:pointer}.inspect-node:hover{background:#df1549}.inspect-node:focus-visible{outline:2px solid #77bfff;outline-offset:2px}.evidence-stream{display:grid;gap:.55rem}.evidence-stream article{display:grid;gap:.35rem;padding:.7rem;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035)}.evidence-stream article small{display:flex;justify-content:space-between;gap:.6rem;color:#968b8e;font-size:.6rem}.evidence-stream article small b{color:#e5bd65}.evidence-stream article p{margin:0;color:#e3dadc;font-size:.72rem;line-height:1.55}.evidence-stream article em{padding-left:.5rem;border-left:2px solid #df174b;color:#dba6b3;font-size:.62rem;font-style:normal;line-height:1.45}.runtime-world__empty{display:flex;gap:.7rem;padding:1rem;border:1px dashed rgba(255,255,255,.16);background:rgba(255,255,255,.018);color:#9f9497}.runtime-world__empty i{color:#ed2757}.runtime-world__empty div{display:grid;gap:.3rem}.runtime-world__empty strong{color:#f2e9e6;font-size:.76rem}.runtime-world__empty span{font-size:.66rem;line-height:1.5}.runtime-world__inspector>footer{display:flex;gap:.8rem;margin-top:auto;padding-top:.7rem;border-top:1px solid rgba(255,255,255,.085);color:#8f8487;font-size:.6rem}
.runtime-world__boundary{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 1rem;border-top:1px solid rgba(255,255,255,.085);background:#120f10;color:#857b7e;font-size:.62rem}.runtime-world__boundary code{color:#d1a951}
@keyframes world-flow{to{stroke-dashoffset:-52}}@keyframes world-pulse{0%{opacity:.75;transform:scale(.75)}100%{opacity:0;transform:scale(1.45)}}@keyframes world-orbit{to{transform:rotate(360deg)}}@keyframes world-blink{50%{opacity:.45}}
@media(max-width:980px){.runtime-world__layout{grid-template-columns:1fr}.runtime-world__stage{border-right:0;border-bottom:1px solid rgba(255,255,255,.085)}.runtime-world__inspector{max-height:none}}
@media(max-width:700px){.runtime-world__head{align-items:flex-start;flex-direction:column}.runtime-world__controls{width:100%;justify-items:stretch}.runtime-world__controls>div{width:100%}.runtime-world__controls button{flex:1}.runtime-world__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.metric-help>[role="tooltip"]{max-width:min(12rem,78vw)}.runtime-world__stage{height:27rem}.runtime-world__stage svg{width:45rem;max-width:none;min-height:27rem;transform:translateX(calc((100vw - 45rem)/2 - 1rem))}.runtime-world__legend{right:.4rem;bottom:.4rem;left:.4rem}.runtime-world__boundary{align-items:flex-start;flex-direction:column}}
@media(prefers-reduced-motion:reduce){.runtime-edge .edge-line,.node-radar,.llm-ring--outer,.runtime-world__head p i.playing{animation:none}}
</style>
