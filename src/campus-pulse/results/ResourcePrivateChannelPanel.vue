<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { currentLocale } from '../i18n/locale.ts'
import { auditedReplayAdapter } from '../adapters/auditedReplayAdapter.ts'
import {
  loadResourcePrivateChannelSummary,
  type ResourcePrivateBranch,
  type ResourcePrivateBranchName,
  type ResourcePrivateChannelSummary,
} from '../../services/resourcePrivateChannels.ts'

const summary = ref<ResourcePrivateChannelSummary | null>(null)
const route = useRoute()
const loading = ref(true)
const error = ref('')
const branch = ref<ResourcePrivateBranchName>('D')
const tick = ref(4)
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh

const broadBranch = computed<ResourcePrivateBranch | null>(() => summary.value?.panels.broad_private_panel.branches[branch.value] || null)
const groupBranch = computed<ResourcePrivateBranch | null>(() => summary.value?.panels.group_lifecycle_panel.branches[branch.value] || null)
const broadChannelTick = computed(() => broadBranch.value?.channel_messages_by_tick.find((row) => row.tick === tick.value) || null)
const broadSenderTick = computed(() => broadBranch.value?.unique_active_senders_by_tick.find((row) => row.tick === tick.value) || null)
const groupChannelTick = computed(() => groupBranch.value?.channel_messages_by_tick.find((row) => row.tick === tick.value) || null)
const broadActivity = computed(() => summary.value
  ? auditedReplayAdapter.housingPrivateActivity(summary.value, branch.value, tick.value, 'broad_private_panel')
  : null)
const groupActivity = computed(() => summary.value
  ? auditedReplayAdapter.housingPrivateActivity(summary.value, branch.value, tick.value, 'group_lifecycle_panel')
  : null)

const aggregateRows = computed(() => [
  { id: 'broad-direct', label: l('24 人面板 · 好友私聊消息', '24-Agent panel · direct messages'), value: broadActivity.value?.directMessageCount || 0, maximum: Math.max(1, ...((broadBranch.value?.channel_messages_by_tick || []).map((row) => row.direct_message_count))), tone: 'direct' },
  { id: 'broad-senders', label: l('24 人面板 · 活跃发送者', '24-Agent panel · active senders'), value: broadActivity.value?.activeSenderCount || 0, maximum: Math.max(1, broadBranch.value?.unique_active_sender_count || 0), tone: 'sender' },
  { id: 'group-direct', label: l('8 人面板 · 好友私聊消息', '8-Agent panel · direct messages'), value: groupActivity.value?.directMessageCount || 0, maximum: Math.max(1, ...((groupBranch.value?.channel_messages_by_tick || []).map((row) => row.direct_message_count))), tone: 'direct' },
  { id: 'group-chat', label: l('8 人面板 · 群聊消息', '8-Agent panel · group messages'), value: groupActivity.value?.groupMessageCount || 0, maximum: Math.max(1, ...((groupBranch.value?.channel_messages_by_tick || []).map((row) => row.group_message_count))), tone: 'group' },
  { id: 'group-senders', label: l('8 人面板 · 活跃发送者', '8-Agent panel · active senders'), value: groupActivity.value?.activeSenderCount || 0, maximum: Math.max(1, groupBranch.value?.unique_active_sender_count || 0), tone: 'sender' },
])

const groupLifecycle = computed(() => groupBranch.value?.group_lifecycle || null)
const verifiedGroupMessages = computed(() => groupLifecycle.value?.message_evidence_statuses.verified || 0)
const uncertainGroupMessages = computed(() => groupLifecycle.value?.message_evidence_statuses.uncertain || 0)
const protocolHits = computed(() => groupLifecycle.value?.targeted_governance_protocol_keyword_hits || 0)
const maxTimeline = computed(() => Math.max(1, ...(['Natural', 'D'] as const).flatMap((name) => summary.value?.panels.broad_private_panel.branches[name].messages_by_tick.map((row) => row.message_count) || [])))

function stop() {
  playing.value = false
  if (timer) clearInterval(timer)
  timer = undefined
}

function togglePlay() {
  if (playing.value) return stop()
  playing.value = true
  timer = setInterval(() => {
    tick.value = tick.value >= 10 ? 4 : tick.value + 1
  }, 1150)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    summary.value = await loadResourcePrivateChannelSummary(
      route.query.source === 'offline-hero' ? 'offline' : 'live',
    )
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(stop)
</script>

<template>
  <section class="private-evidence" aria-labelledby="resource-private-title">
    <header class="private-evidence__head">
      <div>
        <p>PRIVATE CHANNEL EVIDENCE · OPENLUX LIVE LLM</p>
        <h2 id="resource-private-title">{{ l('公开论坛之外，好友私聊与动态小群如何继续发酵', 'How friend chats and dynamic groups continue beyond the public forum') }}</h2>
        <span>{{ l('两个独立证据面板均沿用已冻结的公开时间线：24 人面板观察好友私聊，8 人面板验证建群、接受/拒绝邀请与群内讨论（其中 7 人产生过私聊动作）。', 'Two independent panels reuse the frozen public timeline: a 24-Agent panel observes direct chat, while an 8-Agent panel validates group creation, invitation decisions and group discussion (7 produced at least one private action).') }}</span>
      </div>
      <div class="private-evidence__audit" v-if="summary">
        <span>{{ summary.provider.model }}</span>
        <strong>{{ summary.current_final_run_execution_totals.provider_calls_completed_in_final_run }}</strong>
        <small>{{ l('最终运行调用 · 0 unknown', 'final-run calls · 0 unknown') }}</small>
      </div>
    </header>

    <div v-if="loading" class="panel-state" role="status"><i/><i/><i/>{{ l('正在校验私域证据…', 'Verifying private-channel evidence…') }}</div>
    <div v-else-if="error" class="panel-state panel-state--error" role="alert"><span>{{ error }}</span><button type="button" @click="load">{{ l('重新校验', 'Retry') }}</button></div>

    <template v-else-if="summary && broadBranch && groupBranch">
      <div class="private-toolbar">
        <div class="branch-switch" :aria-label="l('选择平行分支', 'Choose parallel branch')">
          <button v-for="name in (['Natural','D'] as const)" :key="name" type="button" :class="{ active:branch === name }" @click="branch = name">
            {{ name === 'D' ? l('组合治理（方案 D）', 'Combined governance (Plan D)') : l('不追加治理回应（Natural）', 'No added governance response (Natural)') }}
          </button>
        </div>
        <div class="tick-control">
          <button type="button" class="play" :aria-label="playing ? l('暂停','Pause') : l('播放','Play')" @click="togglePlay"><i :class="playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'"/></button>
          <label><span>Tick {{ tick }}</span><input v-model.number="tick" type="range" min="4" max="10" step="1" /></label>
        </div>
      </div>

      <div class="private-layout">
        <section class="private-network" aria-labelledby="private-network-title">
          <header>
            <div><p>AGGREGATE-ONLY PRIVATE ACTIVITY</p><h3 id="private-network-title">{{ l('本 Tick 的私域聚合活动', 'Aggregate private-channel activity at this Tick') }}</h3></div>
            <dl>
              <div><dt>{{ l('好友私聊', 'Direct chat') }}</dt><dd>{{ broadChannelTick?.direct_message_count ?? 0 }}</dd></div>
              <div><dt>{{ l('群聊消息', 'Group chat') }}</dt><dd>{{ groupChannelTick?.group_message_count ?? 0 }}</dd></div>
              <div><dt>{{ l('活跃发送者', 'Active senders') }}</dt><dd>{{ broadSenderTick?.unique_active_sender_count ?? 0 }}</dd></div>
            </dl>
          </header>
          <div class="aggregate-stage" role="group" :aria-label="l('住房案例私聊和群聊的逐 Tick 聚合计数','Per-Tick aggregate direct/group-chat counts for the housing case')">
            <div class="aggregate-boundary" role="note">
              <i class="fa-solid fa-shield-halved" aria-hidden="true" />
              <div><strong>{{ l('仅展示匿名汇总，不展示具体会话', 'Anonymous aggregates only; individual conversations are not shown') }}</strong><span>{{ l('为保护参与者隐私，本页只展示私聊数量、群聊数量和活跃人数等统计，不提供身份、会话关系或消息正文。', 'To protect participant privacy, this page shows only aggregate counts such as direct chats, group messages and active senders—never identities, conversation relationships or message text.') }}</span></div>
            </div>
            <div class="aggregate-bars">
              <div v-for="row in aggregateRows" :key="row.id" class="aggregate-row" :class="row.tone">
                <span>{{ row.label }}</span>
                <div><i :style="{ width:`${row.value / row.maximum * 100}%` }" /></div>
                <strong>{{ row.value }}</strong>
              </div>
            </div>
            <div class="aggregate-stamp"><span>{{ branch }}</span><strong>T{{ String(tick).padStart(2,'0') }}</strong></div>
          </div>
          <footer>
            <span>{{ l('所有数值均直接来自已校验的聚合 release；前端不根据计数推造发送者、关系或对话。', 'Every value comes directly from the verified aggregate release; the interface does not infer senders, relationships or dialogue from counts.') }}</span>
            <code>{{ summary.summary_sha256.slice(0, 12) }}…</code>
          </footer>
        </section>

        <aside class="private-inspector">
          <section class="mechanism-card">
            <p>{{ l('动态小群生命周期', 'Dynamic-group lifecycle') }}</p>
            <h3>{{ l('邀请、加入与退出', 'Inviting, joining and leaving') }}</h3>
            <div class="lifecycle-flow"><span>{{ l('创建 2 个群','2 groups created') }}</span><i>→</i><span>{{ groupLifecycle?.membership_decisions.accept || 0 }} {{ l('接受','accepted') }} / {{ groupLifecycle?.membership_decisions.decline || 0 }} {{ l('拒绝','declined') }}</span><i>→</i><span>{{ groupLifecycle?.status_counts.active || 0 }} {{ l('活跃','active') }} / {{ groupLifecycle?.status_counts.expired || 0 }} {{ l('过期','expired') }}</span></div>
          </section>

          <section class="evidence-card">
            <p>{{ l('群内信息基础', 'Evidence inside group chat') }}</p>
            <div class="evidence-donut" :style="{ '--verified':`${verifiedGroupMessages / Math.max(1, verifiedGroupMessages + uncertainGroupMessages) * 100}%` }"><strong>{{ verifiedGroupMessages }}</strong><span>{{ l('已核验','verified') }}</span></div>
            <dl><div><dt>{{ l('不确定','Uncertain') }}</dt><dd>{{ uncertainGroupMessages }}</dd></div><div><dt>{{ l('治理对象提及','Governance-object mentions') }}</dt><dd>{{ protocolHits }}</dd></div><div><dt>{{ l('群聊总消息','Group messages') }}</dt><dd>{{ groupBranch.group_message_count }}</dd></div></dl>
          </section>

          <section class="result-card" :class="{ governed:branch === 'D' }">
            <p>{{ l('这组结果说明什么', 'What this result shows') }}</p>
            <h3 v-if="branch === 'D'">{{ l('治理没有让私聊消失，而是让证据卡、工单和触达对象进入群聊', 'Governance did not silence private chat; it moved evidence cards, tickets and outreach objects into group discussion') }}</h3>
            <h3 v-else>{{ l('自然演化同样会形成群聊，但仍保留不确定转述', 'Natural evolution also forms groups, but uncertain retellings remain') }}</h3>
            <p v-if="branch === 'D'">{{ l(`15 条群聊消息全部标为已核验，并出现 ${protocolHits} 次治理对象关键词；这说明治理信息穿透了私域渠道。`, `All 15 group messages were classified as verified, with ${protocolHits} governance-object keyword hits, showing that governance information penetrated the private channel.`) }}</p>
            <p v-else>{{ l(`${verifiedGroupMessages} 条群聊消息已核验、${uncertainGroupMessages} 条仍不确定，且没有出现定向治理对象。`, `${verifiedGroupMessages} group messages were verified and ${uncertainGroupMessages} remained uncertain, with no targeted governance object present.`) }}</p>
          </section>
        </aside>
      </div>

      <section class="private-timeline" aria-labelledby="private-timeline-title">
        <header><div><p>PARALLEL EVIDENCE</p><h3 id="private-timeline-title">{{ l('Tick 4–10 好友私聊强度', 'Direct-chat intensity across Tick 4–10') }}</h3></div><span>{{ l('同一公开时间线上的条件化补充实验', 'Conditioned supplement on the same public timeline') }}</span></header>
        <div class="timeline-grid">
          <button v-for="row in summary.panels.broad_private_panel.branches.Natural.messages_by_tick" :key="row.tick" type="button" :class="{ selected:tick === row.tick }" @click="tick=row.tick">
            <span>T{{ row.tick }}</span>
            <i class="natural" :style="{ height:`${row.message_count / maxTimeline * 100}%` }"><b>{{ row.message_count }}</b></i>
            <i class="governed" :style="{ height:`${summary.panels.broad_private_panel.branches.D.messages_by_tick.find(item=>item.tick===row.tick)!.message_count / maxTimeline * 100}%` }"><b>{{ summary.panels.broad_private_panel.branches.D.messages_by_tick.find(item=>item.tick===row.tick)!.message_count }}</b></i>
          </button>
        </div>
        <footer><span><i class="natural"/>{{ l('不追加治理回应（Natural）','No added response (Natural)') }}</span><span><i class="governed"/>{{ l('组合治理（方案 D）','Combined governance (Plan D)') }}</span><em>{{ l('除聊天量外，还可比较群聊中的证据状态与治理信息触达。', 'Compare conversation volume alongside evidence status and governance information reaching groups.') }}</em></footer>
      </section>
    </template>
  </section>
</template>

<style scoped>
.private-evidence{min-width:0;max-width:100%;overflow:hidden;border:1px solid #d8d2cf;border-radius:1rem;background:#f8f7f4;box-shadow:0 24px 70px rgba(42,29,34,.11)}.private-evidence,.private-evidence *{box-sizing:border-box}.private-evidence__head{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding:1.4rem 1.6rem;border-bottom:1px solid #ded9d6;background:radial-gradient(circle at 5% 10%,rgba(190,0,45,.1),transparent 24rem),#fff}.private-evidence__head>div:first-child{min-width:0;max-width:62rem}.private-evidence__head p,.private-network header p,.private-inspector section>p,.private-timeline header p{margin:0;color:#a30b34;font:800 .64rem var(--cp-font-mono);letter-spacing:.12em}.private-evidence__head h2{margin:.45rem 0;font-size:clamp(1.35rem,2.3vw,2rem);line-height:1.22;overflow-wrap:anywhere}.private-evidence__head span{color:#68717a;font-size:.76rem;line-height:1.65;overflow-wrap:anywhere}.private-evidence__audit{display:grid;min-width:10.5rem;padding:.8rem 1rem;border:1px solid #d9d2ce;background:#fbfaf8}.private-evidence__audit span{color:#7d6e72;font:700 .62rem var(--cp-font-mono)}.private-evidence__audit strong{margin:.25rem 0;color:#16191d;font:850 1.75rem var(--cp-font-mono)}.private-evidence__audit small{color:#8a7f82;font-size:.6rem}.panel-state{display:flex;min-height:20rem;align-items:center;justify-content:center;gap:.45rem;color:#786e71}.panel-state>i{width:.55rem;height:.55rem;border-radius:50%;background:#bd123d;animation:private-loading .85s infinite alternate}.panel-state>i:nth-child(2){animation-delay:.15s}.panel-state>i:nth-child(3){animation-delay:.3s}.panel-state--error{flex-direction:column;color:#a30b34}.panel-state button{min-height:2.5rem;padding:0 1rem;border:1px solid #a30b34;background:#fff;color:#a30b34;cursor:pointer}.private-toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem 1rem;border-bottom:1px solid #ddd7d3;background:#f1eeeb}.branch-switch{display:flex;min-width:0;gap:.35rem}.branch-switch button,.tick-control button{min-width:0;min-height:2.35rem;padding:0 .85rem;border:1px solid #cbc3bf;background:#fff;color:#574c50;font-weight:750;overflow-wrap:anywhere;cursor:pointer}.branch-switch button.active{border-color:#a80c37;background:#a80c37;color:#fff}.tick-control{display:flex;min-width:0;align-items:center;gap:.65rem}.tick-control .play{width:2.4rem;flex:0 0 2.4rem;padding:0;border-radius:50%}.tick-control label{display:flex;min-width:0;align-items:center;gap:.65rem;color:#6d6266;font:750 .65rem var(--cp-font-mono)}.tick-control input{width:12rem;min-width:0;accent-color:#ae113b}.private-layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(20rem,.7fr);min-height:37rem}.private-network{min-width:0;border-right:1px solid #ded8d4;background:#fff}.private-network>header{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;border-bottom:1px solid #e7e2df}.private-network>header>div{min-width:0}.private-network h3,.private-inspector h3,.private-timeline h3{margin:.3rem 0 0;font-size:1rem;line-height:1.4;overflow-wrap:anywhere}.private-network dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));min-width:0;margin:0;border:1px solid #ddd7d4}.private-network dl div{min-width:0;padding:.55rem .7rem;border-right:1px solid #e5dfdc}.private-network dl div:last-child{border-right:0}.private-network dt{color:#81777a;font-size:.55rem;overflow-wrap:anywhere}.private-network dd{margin:.2rem 0 0;font:800 .95rem var(--cp-font-mono)}.network-stage{position:relative;height:31rem;background:radial-gradient(circle at 50% 50%,rgba(178,10,51,.08),transparent 16rem),linear-gradient(rgba(32,39,46,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(32,39,46,.035) 1px,transparent 1px);background-size:auto,44px 44px,44px 44px}.network-stage svg{width:100%;height:100%}.clusters circle{fill:rgba(178,10,51,.015);stroke:#c8c0bd;stroke-width:.7;stroke-dasharray:2 6}.clusters text{fill:#877d80;font:700 7px var(--cp-font-mono)}.direct-edges line{stroke:#bd8d24;stroke-width:1.6;stroke-dasharray:2 7;filter:url(#private-glow);animation:private-flow 1.45s linear infinite}.group-edges line{stroke:#7559ad;stroke-width:2.1;stroke-dasharray:3 8;filter:url(#private-glow);animation:private-flow 1.1s linear infinite}.private-node{cursor:pointer}.private-node .hit{fill:transparent;stroke:none;pointer-events:all}.private-node .body{fill:#c8c0bd;stroke:#fff;stroke-width:.5}.private-node.direct .body{fill:#bd8d24;stroke:#7e5a0d}.private-node.group .body{fill:#7559ad;stroke:#efe6ff}.private-node.direct.group .body{fill:#c33b56;stroke:#fff0d0}.private-node.llm .body{fill:#e2184a;stroke:#fff;stroke-width:1.4;filter:url(#private-glow)}.private-node.selected .body,.private-node:focus-visible .body{stroke:#2184d9;stroke-width:3}.private-node .pulse{fill:none;stroke:#e2184a;animation:private-pulse 1.6s ease-out infinite}.network-core circle:first-child{fill:#171315;stroke:#514348}.network-core .orbit{fill:none;stroke:#ae123d;stroke-dasharray:2 8;transform-origin:420px 225px;animation:private-orbit 13s linear infinite}.network-core text{fill:#fff;font:750 10px var(--cp-font-mono)}.network-core text:last-child{fill:#eac46f;font-size:17px}.network-legend{position:absolute;right:1rem;bottom:1rem;display:flex;gap:1rem;padding:.55rem .75rem;border:1px solid rgba(255,255,255,.1);background:rgba(24,20,21,.9);color:#c7bdc0;font-size:.6rem}.network-legend span{display:flex;align-items:center;gap:.4rem}.network-legend i{width:1.15rem;height:2px;background:#bd8d24}.network-legend i.group{background:#8d70c4}.network-legend i.llm{width:.5rem;height:.5rem;border-radius:50%;background:#e2184a;box-shadow:0 0 .55rem #e2184a}.private-network>footer{display:flex;justify-content:space-between;gap:1rem;padding:.7rem 1rem;border-top:1px solid #e2ddda;color:#746a6e;font-size:.62rem}.private-network footer code{color:#9d7c24;overflow-wrap:anywhere}.private-inspector{display:grid;min-width:0;align-content:start;gap:.75rem;padding:1rem;background:#f5f2ef}.private-inspector section{min-width:0;padding:.9rem;border:1px solid #ded7d3;background:#fff}.private-inspector section>p{color:#9b7530}.lifecycle-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:.35rem;margin-top:.8rem}.lifecycle-flow span{min-width:0;min-height:3.5rem;padding:.55rem;border:1px solid #e1dad6;background:#faf8f6;color:#4e4548;font-size:.65rem;line-height:1.5;overflow-wrap:anywhere}.lifecycle-flow i{color:#b21a42;font-style:normal}.evidence-card{display:grid!important;grid-template-columns:1fr auto;gap:.7rem}.evidence-card>p{grid-column:1/-1}.evidence-donut{display:grid;width:5.5rem;height:5.5rem;place-content:center;border-radius:50%;background:radial-gradient(circle,#fff 54%,transparent 55%),conic-gradient(#2b8b69 var(--verified),#e0b458 0)}.evidence-donut strong{font:850 1.2rem var(--cp-font-mono);text-align:center}.evidence-donut span{color:#6e6568;font-size:.55rem}.evidence-card dl{display:grid;min-width:0;align-content:center;gap:.3rem;margin:0}.evidence-card dl div{display:flex;min-width:0;justify-content:space-between;gap:.8rem;padding-bottom:.3rem;border-bottom:1px solid #eee9e6}.evidence-card dt{color:#807579;font-size:.58rem}.evidence-card dd{margin:0;font:800 .7rem var(--cp-font-mono)}.result-card{border-left:3px solid #c79c3d!important}.result-card.governed{border-left-color:#ac1039!important;background:linear-gradient(100deg,#fff2f4,#fff)!important}.result-card>p:last-child{margin:.55rem 0 0;color:#665d60;font-size:.68rem;line-height:1.62;overflow-wrap:anywhere}.private-timeline{min-width:0;border-top:1px solid #ddd7d3;background:#fff}.private-timeline>header{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;padding:1rem 1.2rem}.private-timeline>header>*{min-width:0}.private-timeline>header>span{color:#82777b;font-size:.62rem;overflow-wrap:anywhere}.timeline-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));min-width:0;gap:.5rem;height:11rem;padding:0 1.2rem 1rem}.timeline-grid button{position:relative;display:grid;min-width:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:end;gap:.18rem;padding:1.8rem .45rem .35rem;border:1px solid #e2dcda;background:#faf9f7;cursor:pointer}.timeline-grid button.selected{border-color:#a90f39;background:#fff3f5}.timeline-grid button>span{position:absolute;top:.42rem;left:.5rem;color:#73686c;font:750 .58rem var(--cp-font-mono)}.timeline-grid i{position:relative;min-width:0;min-height:.4rem;background:#837b7e}.timeline-grid i.governed{background:#b80f3d}.timeline-grid i b{position:absolute;top:-1rem;left:50%;transform:translateX(-50%);color:#4e4548;font:750 .52rem var(--cp-font-mono)}.private-timeline>footer{display:flex;min-width:0;align-items:center;flex-wrap:wrap;gap:1rem;padding:.75rem 1.2rem;border-top:1px solid #e3ddda;color:#746a6d;font-size:.62rem}.private-timeline footer span{display:flex;align-items:center;gap:.35rem}.private-timeline footer i{width:1rem;height:.2rem;background:#837b7e}.private-timeline footer i.governed{background:#b80f3d}.private-timeline footer em{margin-left:auto;color:#695e62;font-style:normal}
@keyframes private-flow{to{stroke-dashoffset:-45}}@keyframes private-pulse{0%{opacity:.8;transform:scale(.6);transform-origin:center}100%{opacity:0;transform:scale(1.65);transform-origin:center}}@keyframes private-orbit{to{transform:rotate(360deg)}}@keyframes private-loading{to{opacity:.2;transform:translateY(-3px)}}
.branch-switch button{display:flex;align-items:center;justify-content:center;text-align:center}
@media(max-width:1100px){.private-layout{grid-template-columns:1fr}.private-network{border-right:0}.private-inspector{grid-template-columns:repeat(3,1fr)}.lifecycle-flow{grid-template-columns:1fr}.lifecycle-flow i{transform:rotate(90deg);text-align:center}.evidence-card{grid-template-columns:1fr}.evidence-donut{margin:auto}.private-timeline footer em{width:100%;margin-left:0}}
@media(max-width:760px){.private-evidence__head,.private-toolbar,.private-network>header,.private-timeline>header{min-width:0;align-items:flex-start;flex-direction:column}.private-evidence__head{padding:1rem}.private-evidence__head>*{width:100%;min-width:0}.private-evidence__audit{width:100%;min-width:0}.private-toolbar{padding:.7rem}.branch-switch{display:grid;width:100%;grid-template-columns:1fr}.branch-switch button{width:100%;white-space:normal}.tick-control{width:100%;flex-wrap:wrap}.tick-control label{width:calc(100% - 3.05rem);flex:1}.tick-control input{width:100%;max-width:100%}.private-network dl{width:100%}.private-network dl div{padding-inline:.45rem}.network-stage{height:26rem;overflow:hidden}.network-stage svg{width:46rem;max-width:none;transform:translateX(calc((100vw - 46rem)/2 - 1rem))}.private-inspector{grid-template-columns:minmax(0,1fr);padding:.7rem}.timeline-grid{gap:.22rem;height:9rem;padding-inline:.6rem}.timeline-grid button{padding-inline:.1rem}.timeline-grid i b{font-size:.45rem}.private-network>footer{align-items:flex-start;flex-direction:column}.network-legend{right:.4rem;bottom:.4rem;max-width:calc(100% - .8rem);flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.direct-edges line,.group-edges line,.private-node .pulse,.network-core .orbit,.panel-state>i{animation:none}}
.aggregate-stage{position:relative;display:grid;align-content:center;gap:2rem;min-height:31rem;padding:2rem;background:radial-gradient(circle at 72% 20%,rgba(178,10,51,.09),transparent 16rem),linear-gradient(rgba(32,39,46,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(32,39,46,.035) 1px,transparent 1px);background-size:auto,44px 44px,44px 44px}.aggregate-boundary{display:flex;align-items:flex-start;gap:.8rem;padding:1rem;border:1px solid #d8d0cc;background:rgba(255,255,255,.88)}.aggregate-boundary>i{margin-top:.15rem;color:#ac1039}.aggregate-boundary div{display:grid;gap:.25rem}.aggregate-boundary strong{font-size:.8rem}.aggregate-boundary span{color:#746a6e;font-size:.65rem;line-height:1.55}.aggregate-bars{display:grid;gap:.8rem}.aggregate-row{display:grid;grid-template-columns:minmax(10rem,.8fr) minmax(10rem,1.7fr) 2.5rem;align-items:center;gap:.8rem}.aggregate-row>span{color:#5f5559;font-size:.68rem}.aggregate-row>div{height:.8rem;overflow:hidden;border:1px solid #d5ceca;background:#eee9e6}.aggregate-row>div i{display:block;height:100%;background:#b98b26;transition:width .25s ease}.aggregate-row.group>div i{background:#765bab}.aggregate-row.sender>div i{background:#a6113a}.aggregate-row>strong{font:800 .72rem var(--cp-font-mono);text-align:right}.aggregate-stamp{position:absolute;right:2rem;bottom:1.4rem;display:flex;align-items:baseline;gap:.5rem;color:#9a8e92;font:700 .65rem var(--cp-font-mono)}.aggregate-stamp strong{color:#a8113b;font-size:1rem}
@media(max-width:760px){.aggregate-stage{min-height:26rem;padding:1rem}.aggregate-row{grid-template-columns:1fr 2.2rem}.aggregate-row>div{grid-column:1/-1;grid-row:2}}
@media(prefers-reduced-motion:reduce){.aggregate-row>div i{transition:none}}

/* Aggregate-only releases contain five compact rows; avoid presenting the
   reserved network-canvas height as if more record-level data were missing. */
.private-layout{min-height:0}
.aggregate-stage{align-content:start;gap:1.25rem;min-height:20rem;padding:1.25rem 1.5rem 2.75rem}
.aggregate-bars{gap:.65rem}
.aggregate-stamp{right:1.5rem;bottom:1rem}
@media(max-width:760px){.aggregate-stage{min-height:0;padding:1rem 1rem 2.5rem}}
</style>
