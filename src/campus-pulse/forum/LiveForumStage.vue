<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ForumBranchId, ForumMessage, ForumThread } from '../contracts/forumTwin.ts'
import type { ResultViewModel } from '../domain/viewModels.ts'
import ContentTranslation from '../i18n/ContentTranslation.vue'
import { currentLocale } from '../i18n/locale.ts'
import type { ForumBranchView } from './forumWorkspaceState.ts'

const props = defineProps<{
  result: ResultViewModel
  tick: number
  branch: ForumBranchView
  playing: boolean
}>()

const emit = defineEmits<{
  selectThread: [threadId: string, branch: ForumBranchId]
  selectAgent: [displayId: string, branch: ForumBranchId]
  openGovernance: []
}>()

const isEnglish = computed(() => currentLocale.value === 'en-US')

interface ThreadHeatVM {
  thread: ForumThread
  messages: ForumMessage[]
  messageCount: number
  directReplies: number
  participants: number
  likes: number
  reposts: number
  reports: number
  interactionsCollected: boolean
  heat: number
}

interface FeedLaneVM {
  id: ForumBranchId
  label: string
  description: string
  newMessages: ForumMessage[]
  feedMessageCount: number
  showingRecent: boolean
  hotThreads: ThreadHeatVM[]
  visibleMessageCount: number
  activeThreadCount: number
  governanceMessages: ForumMessage[]
  likes: number | null
  reposts: number
  reports: number
}

const expandedLanes = ref<Record<ForumBranchId, boolean>>({
  natural: false,
  A: false,
  D: false,
})

const branchMeta: Record<ForumBranchId, { label: string; description: string }> = {
  natural: { label: '自然演化', description: '不追加治理动作' },
  A: { label: '规则解释', description: '发布解释，但不接入服务闭环' },
  D: { label: '主动治理', description: '证据卡、服务工单与跨群触达；是否闭环由结果决定' },
}

const selectedBranches = computed<ForumBranchId[]>(() => {
  if (props.branch === 'both') return ['natural', 'D']
  return [props.branch]
})

const visibleMessages = computed(() => (props.result.forum?.messages || []).filter((message) => (
  message.created_tick <= props.tick && selectedBranches.value.includes(message.branch_id)
)))

type InteractionKind = 'like' | 'repost' | 'report'
type InteractionCounts = Record<InteractionKind, number>

const lastResultTick = computed(() => Math.max(
  0,
  ...props.result.summary.timeline.map((point) => point.tick),
))

function zeroInteractions(): InteractionCounts {
  return { like: 0, repost: 0, report: 0 }
}

function messageInteractionDelta(message: ForumMessage, tick: number): InteractionCounts | null {
  if (message.interaction_counts == null) return null
  const rows = message.interaction_counts_by_tick || []
  if (rows.length > 0) {
    const row = rows.find((candidate) => candidate.tick === tick)
    return row ? { like: row.like, repost: row.repost, report: row.report } : zeroInteractions()
  }
  const total = message.interaction_counts.like
    + message.interaction_counts.repost
    + message.interaction_counts.report
  if (total === 0) return zeroInteractions()
  // Older V2 releases published only final totals. Do not leak them into an
  // earlier replay frame or pretend they all happened at the final tick.
  return null
}

function messageInteractionsThrough(message: ForumMessage, tick: number): InteractionCounts | null {
  if (message.interaction_counts == null) return null
  const rows = message.interaction_counts_by_tick || []
  if (rows.length === 0) {
    return tick >= lastResultTick.value
      ? { ...message.interaction_counts }
      : (Object.values(message.interaction_counts).every((value) => value === 0) ? zeroInteractions() : null)
  }
  return rows.reduce((total, row) => {
    if (row.tick <= tick) {
      total.like += row.like
      total.repost += row.repost
      total.report += row.report
    }
    return total
  }, zeroInteractions())
}

const globalHeatMax = computed(() => {
  const scores = (props.result.forum?.threads || []).flatMap((thread) => {
    if (!selectedBranches.value.includes(thread.branch_id) || thread.created_tick > props.tick) return []
    const messages = visibleMessages.value.filter((message) => (
      message.thread_id === thread.thread_id && message.branch_id === thread.branch_id
    ))
    const replies = messages.filter((message) => Boolean(message.parent_message_id)).length
    const participants = new Set(messages.map((message) => message.source_display_id)).size
    const likes = messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.like || 0), 0)
    const reposts = messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.repost || 0), 0)
      + messages.filter((message) => message.action === 'repost' || message.action === 'quote').length
    return [messages.length + replies * 2 + participants + likes * 0.25 + reposts * 1.5]
  })
  return Math.max(1, ...scores)
})

function threadHeat(thread: ForumThread, branch: ForumBranchId): ThreadHeatVM {
  const messages = visibleMessages.value.filter((message) => (
    message.branch_id === branch && message.thread_id === thread.thread_id
  ))
  const directReplies = messages.filter((message) => Boolean(message.parent_message_id)).length
  const participants = new Set(messages.map((message) => message.source_display_id)).size
  const interactionsCollected = messages.some((message) => message.interaction_counts != null)
  const likes = messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.like || 0), 0)
  const reposts = messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.repost || 0), 0)
    + messages.filter((message) => message.action === 'repost' || message.action === 'quote').length
  const reports = messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.report || 0), 0)
    + messages.filter((message) => message.action === 'report_risk').length
  const raw = messages.length + directReplies * 2 + participants + likes * 0.25 + reposts * 1.5
  return {
    thread,
    messages,
    messageCount: messages.length,
    directReplies,
    participants,
    likes,
    reposts,
    reports,
    interactionsCollected,
    heat: Math.round((raw / globalHeatMax.value) * 100),
  }
}

const lanes = computed<FeedLaneVM[]>(() => selectedBranches.value.map((branch) => {
  const messages = visibleMessages.value
    .filter((message) => message.branch_id === branch)
    .sort((left, right) => right.created_tick - left.created_tick || right.message_id.localeCompare(left.message_id))
  const current = messages.filter((message) => message.created_tick === props.tick)
  const feedMessages = current.length ? current : messages
  const threads = (props.result.forum?.threads || [])
    .filter((thread) => thread.branch_id === branch && thread.created_tick <= props.tick)
    .map((thread) => threadHeat(thread, branch))
    .filter((thread) => thread.messageCount > 0)
    .sort((left, right) => (
      right.heat - left.heat
      || (right.thread.last_active_tick || 0) - (left.thread.last_active_tick || 0)
      || left.thread.thread_id.localeCompare(right.thread.thread_id)
    ))
  return {
    id: branch,
    ...branchMeta[branch],
    newMessages: feedMessages.slice(0, expandedLanes.value[branch] ? feedMessages.length : 10),
    feedMessageCount: feedMessages.length,
    showingRecent: current.length === 0,
    hotThreads: threads.slice(0, 10),
    visibleMessageCount: messages.length,
    activeThreadCount: threads.length,
    governanceMessages: current.filter((message) => message.action === 'governance_message'),
    likes: messages.some((message) => message.interaction_counts != null)
      ? messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.like || 0), 0)
      : null,
    reposts: messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.repost || 0), 0)
      + messages.filter((message) => message.action === 'repost' || message.action === 'quote').length,
    reports: messages.reduce((total, message) => total + (messageInteractionsThrough(message, props.tick)?.report || 0), 0)
      + messages.filter((message) => message.action === 'report_risk').length,
  }
}))

const currentMessageCount = computed(() => visibleMessages.value.filter((message) => message.created_tick === props.tick).length)
const currentReplyCount = computed(() => visibleMessages.value.filter((message) => (
  message.created_tick === props.tick && Boolean(message.parent_message_id)
)).length)
const currentActiveThreads = computed(() => new Set(visibleMessages.value
  .filter((message) => message.created_tick === props.tick)
  .map((message) => `${message.branch_id}:${message.thread_id}`)).size)
const currentLikes = computed(() => {
  const deltas = visibleMessages.value.map((message) => messageInteractionDelta(message, props.tick))
  return deltas.some((value) => value !== null)
    ? deltas.reduce((total, value) => total + (value?.like || 0), 0)
    : null
})
const currentReposts = computed(() => (
  visibleMessages.value.reduce((total, message) => (
    total + (messageInteractionDelta(message, props.tick)?.repost || 0)
  ), 0)
  + visibleMessages.value.filter((message) => (
    message.created_tick === props.tick
    && (message.action === 'repost' || message.action === 'quote')
  )).length
))
const currentReports = computed(() => (
  visibleMessages.value.reduce((total, message) => (
    total + (messageInteractionDelta(message, props.tick)?.report || 0)
  ), 0)
  + visibleMessages.value.filter((message) => (
    message.created_tick === props.tick && message.action === 'report_risk'
  )).length
))

const tickPoint = computed(() => props.result.summary.timeline.find((point) => point.tick === props.tick))
const currentClaims = computed(() => Math.max(0, ...lanes.value.map((lane) => {
  const metrics = lane.id === 'natural'
    ? tickPoint.value?.natural
    : lane.id === 'A'
      ? tickPoint.value?.explanation
      : tickPoint.value?.intervention
  return metrics?.claims ?? 0
})))

function actionLabel(action: string | null): string {
  const labels: Record<string, string> = {
    post: '发帖', reply: '回复', quote: '引用', repost: '转发', verify: '求证', correct: '纠错',
    seek_help: '求助', report_risk: '风险上报', governance_message: '治理发布', service_receipt: '服务回执',
    governance_evidence: '证据更新', read: '阅读', ignore: '略过',
  }
  return action ? (labels[action] || action) : '公开消息'
}

function provenanceLabel(message: ForumMessage): string {
  return message.provenance.kind === 'authorized_live_llm' ? '实时 LLM' : '审阅 Trace'
}

function directReplies(message: ForumMessage): ForumMessage[] {
  return visibleMessages.value.filter((candidate) => candidate.parent_message_id === message.message_id)
}

function threadReplyCount(message: ForumMessage): number {
  return visibleMessages.value.filter((candidate) => (
    candidate.branch_id === message.branch_id
    && candidate.thread_id === message.thread_id
    && Boolean(candidate.parent_message_id)
  )).length
}

function quoteCount(message: ForumMessage): number {
  return visibleMessages.value.filter((candidate) => candidate.quote_message_id === message.message_id).length
}

function supportiveReplyCount(message: ForumMessage): number {
  return directReplies(message).filter((candidate) => /support|agree|赞同|支持|accept|接受/i.test(candidate.stance || '')).length
}

function messageLikeCount(message: ForumMessage): number | null {
  return messageInteractionsThrough(message, props.tick)?.like ?? null
}

function messageRepostCount(message: ForumMessage): number {
  return (messageInteractionsThrough(message, props.tick)?.repost || 0) + quoteCount(message)
}

function messageReportCount(message: ForumMessage): number {
  return (messageInteractionsThrough(message, props.tick)?.report || 0)
    + directReplies(message).filter((candidate) => candidate.action === 'report_risk').length
}

function toggleExpanded(branch: ForumBranchId): void {
  expandedLanes.value = {
    ...expandedLanes.value,
    [branch]: !expandedLanes.value[branch],
  }
}

function shortId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value
}
</script>

<template>
  <section class="live-stage" aria-labelledby="live-stage-title">
    <header class="live-stage__header">
      <div>
        <div class="live-stage__eyebrow">
          <span class="live-dot" :class="{ active: playing }" aria-hidden="true"></span>
          {{ playing ? '正在演化' : '已暂停' }} · Tick {{ tick }}
        </div>
        <h2 id="live-stage-title">校园论坛实时演化</h2>
        <p>同一事件、同一组 Agent 从共享基线分叉；语言内容来自已校验的 LLM 轨迹，点赞、转发与举报作为可同时发生的独立互动记录。</p>
      </div>
      <button type="button" class="governance-button" @click="emit('openGovernance')">查看本时点治理决策</button>
    </header>

    <dl class="live-metrics" aria-label="当前时点论坛指标">
      <div><dt>当轮新消息</dt><dd>{{ currentMessageCount }}</dd></div>
      <div><dt>当轮评论 / 回复</dt><dd>{{ currentReplyCount }}</dd></div>
      <div><dt>当轮点赞</dt><dd>{{ currentLikes === null ? '未采集' : currentLikes }}</dd></div>
      <div><dt>当轮转发 / 引用</dt><dd>{{ currentReposts }}</dd></div>
      <div><dt>当轮举报 / 风险上报</dt><dd>{{ currentReports }}</dd></div>
      <div><dt>活跃讨论串</dt><dd>{{ currentActiveThreads }}</dd></div>
      <div><dt>当前 Claim 总数</dt><dd>{{ currentClaims }}</dd></div>
    </dl>

    <div class="forum-lanes" :class="{ single: lanes.length === 1 }">
      <article v-for="lane in lanes" :key="lane.id" class="forum-lane" :class="`forum-lane--${lane.id}`">
        <header class="forum-lane__head">
          <div>
            <span>{{ lane.id === 'natural' ? 'PARALLEL 01' : lane.id === 'D' ? 'PARALLEL 02' : 'POLICY A' }}</span>
            <h3>{{ lane.label }}</h3>
            <p>{{ lane.description }}</p>
          </div>
          <dl>
            <div><dt>累计消息</dt><dd>{{ lane.visibleMessageCount }}</dd></div>
            <div><dt>讨论串</dt><dd>{{ lane.activeThreadCount }}</dd></div>
            <div><dt>点赞</dt><dd>{{ lane.likes === null ? '—' : lane.likes }}</dd></div>
            <div><dt>转发</dt><dd>{{ lane.reposts }}</dd></div>
            <div><dt>举报</dt><dd>{{ lane.reports }}</dd></div>
          </dl>
        </header>

        <div v-if="lane.governanceMessages.length" class="governance-flash">
          <span>治理动作已进入论坛</span>
          <button
            v-for="message in lane.governanceMessages"
            :key="message.message_id"
            type="button"
            @click="emit('selectThread', message.thread_id, lane.id)"
          ><span data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</span></button>
        </div>

        <section class="hot-board" :aria-label="`${lane.label}热榜`">
          <div class="section-head">
            <h4>实时热榜</h4>
            <span>按当前公开互动更新</span>
          </div>
          <ol>
            <li v-for="(item, index) in lane.hotThreads" :key="item.thread.thread_id">
              <button type="button" @click="emit('selectThread', item.thread.thread_id, lane.id)">
                <span class="rank">{{ index + 1 }}</span>
                <span class="hot-topic">
                  <strong>{{ item.thread.topic }}</strong>
                  <small>
                    {{ item.messageCount }} 消息 · {{ item.directReplies }} 直接回复 · {{ item.participants }} 参与者
                    <template v-if="item.interactionsCollected"> · {{ item.likes }} 点赞</template>
                    · {{ item.reposts }} 转发 · {{ item.reports }} 举报
                  </small>
                </span>
                <span class="heat"><i :style="{ width: `${item.heat}%` }"></i><b>{{ item.heat }}</b></span>
              </button>
            </li>
          </ol>
          <p v-if="!lane.hotThreads.length" class="empty">当前还没有已发布的讨论串。</p>
        </section>

        <section class="live-feed" :aria-label="`${lane.label}实时动态`">
          <div class="section-head">
            <h4>{{ lane.showingRecent ? '最新帖子与回复' : `Tick ${tick} 新发布` }}</h4>
            <span v-if="lane.showingRecent">本时点无新帖，显示最近 {{ lane.feedMessageCount }} 条动态</span>
            <span v-else>当轮共 {{ lane.feedMessageCount }} 条，当前显示 {{ lane.newMessages.length }} 条</span>
            <button
              v-if="lane.feedMessageCount > 10"
              type="button"
              class="feed-toggle"
              @click="toggleExpanded(lane.id)"
            >{{ expandedLanes[lane.id] ? '收起' : `展开全部 ${lane.feedMessageCount} 条` }}</button>
          </div>
          <ol>
            <li
              v-for="(message, messageIndex) in lane.newMessages"
              :key="message.message_id"
              class="feed-card"
              :data-message-id="message.message_id"
              :data-branch="message.branch_id"
              :style="{ '--feed-order':Math.min(messageIndex, 8) }"
            >
              <div class="feed-card__meta">
                <button type="button" class="agent" @click="emit('selectAgent', message.source_display_id, lane.id)">{{ message.source_display_id }}</button>
                <span>{{ actionLabel(message.action) }}</span>
                <span>Tick {{ message.created_tick }}</span>
                <span class="provenance">{{ provenanceLabel(message) }}</span>
              </div>
              <button type="button" class="feed-card__body" @click="emit('selectThread', message.thread_id, lane.id)">
                <span v-if="message.parent_message_id" class="relation">回复 {{ shortId(message.parent_message_id) }}</span>
                <span v-else-if="message.quote_message_id" class="relation">引用 {{ shortId(message.quote_message_id) }}</span>
                <strong data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</strong>
              </button>
              <ContentTranslation :text="message.visible_text" />
              <div class="feed-card__stats">
                <span>{{ isEnglish ? (message.parent_message_id ? 'Follow-up replies' : 'Replies') : (message.parent_message_id ? '后续回复' : '评论') }} {{ directReplies(message).length }}</span>
                <span>{{ isEnglish ? 'Thread replies' : '整串评论' }} {{ threadReplyCount(message) }}</span>
                <span>{{ isEnglish ? 'Supportive replies' : '支持性回复' }} {{ supportiveReplyCount(message) }}</span>
                <span>{{ messageLikeCount(message) === null ? '点赞未采集' : `点赞 ${messageLikeCount(message)}` }}</span>
                <span>转发 / 引用 {{ messageRepostCount(message) }}</span>
                <span>举报 / 风险上报 {{ messageReportCount(message) }}</span>
                <span v-if="message.claim_ids.length">Claim {{ message.claim_ids.length }}</span>
              </div>
            </li>
          </ol>
          <p v-if="!lane.newMessages.length" class="empty">暂无可展示的公开消息。</p>
        </section>
      </article>
    </div>

    <footer class="method-note">
      <strong>互动口径：</strong>每个 Agent 每时点最多生成一条语言内容，但点赞、静默转发和举报是独立多选；因此可以在评论的同时点赞、转发或举报多个已读消息。热榜使用当时已经发生的评论、参与者、点赞、转发和时效性，举报只进入风控、不抬高热度。历史案例未采集的点赞保持“未采集”，不会补造数字。
    </footer>
  </section>
</template>

<style scoped>
.live-stage { display:grid; gap:var(--cp-space-4); margin-bottom:var(--cp-space-6); padding:var(--cp-space-5); border:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.live-stage__header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-5); }
.live-stage__eyebrow { display:flex; align-items:center; gap:var(--cp-space-2); color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:800; letter-spacing:.08em; }
.live-dot { width:.55rem; height:.55rem; border-radius:50%; background:var(--cp-text-muted); box-shadow:0 0 0 4px color-mix(in srgb,var(--cp-text-muted) 15%,transparent); }
.live-dot.active { background:var(--cp-danger); box-shadow:0 0 0 4px color-mix(in srgb,var(--cp-danger) 16%,transparent); animation:pulse 1.4s infinite; }
.live-stage__header h2 { margin:var(--cp-space-2) 0 0; font-size:var(--cp-text-2xl); line-height:1.15; }
.live-stage__header p { max-width:52rem; margin:var(--cp-space-2) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.65; }
.governance-button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-action-primary); background:var(--cp-surface-default); color:var(--cp-action-primary); font-weight:700; white-space:nowrap; }
.live-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:0; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.live-metrics div { padding:var(--cp-space-3); border-right:1px solid var(--cp-border-subtle); border-bottom:1px solid var(--cp-border-subtle); }
.live-metrics div:nth-child(4n) { border-right:0; }
.live-metrics div:nth-last-child(-n+3) { border-bottom:0; }
.live-metrics dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.live-metrics dd { margin:var(--cp-space-1) 0 0; color:var(--cp-text-primary); font:750 var(--cp-text-xl)/1 var(--cp-font-mono); }
.forum-lanes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--cp-space-4); }
.forum-lanes.single { grid-template-columns:minmax(0,1fr); }
.forum-lane { min-width:0; border:1px solid var(--cp-border-default); border-top:4px solid var(--cp-text-muted); background:var(--cp-surface-default); }
.forum-lane--D { border-top-color:var(--cp-action-primary); }
.forum-lane--A { border-top-color:var(--cp-warning); }
.forum-lane__head { display:flex; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-4); border-bottom:1px solid var(--cp-border-subtle); }
.forum-lane__head > div > span { color:var(--cp-text-muted); font:700 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.08em; }
.forum-lane__head h3 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-lg); }
.forum-lane__head p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.forum-lane__head dl { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:var(--cp-space-3); margin:0; text-align:right; }
.forum-lane__head dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.forum-lane__head dd { margin:.2rem 0 0; font:700 var(--cp-text-md)/1 var(--cp-font-mono); }
.governance-flash { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid color-mix(in srgb,var(--cp-warning) 38%,var(--cp-border-default)); background:color-mix(in srgb,var(--cp-warning) 9%,var(--cp-surface-default)); animation:governance-arrival .45s cubic-bezier(.2,.75,.25,1) both; }
.governance-flash > span { color:var(--cp-warning-text,var(--cp-text-primary)); font-size:var(--cp-text-xs); font-weight:800; }
.governance-flash button { padding:0; border:0; background:none; color:var(--cp-text-primary); font-size:var(--cp-text-sm); line-height:1.55; text-align:left; cursor:pointer; }
.hot-board,.live-feed { padding:var(--cp-space-4); }
.hot-board { border-bottom:1px solid var(--cp-border-subtle); }
.section-head { display:flex; align-items:baseline; justify-content:space-between; gap:var(--cp-space-3); margin-bottom:var(--cp-space-3); }
.section-head h4 { margin:0; font-size:var(--cp-text-sm); }
.section-head span { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.feed-toggle { min-height:1.8rem; padding:0 var(--cp-space-2); border:1px solid var(--cp-border-strong); background:var(--cp-surface-default); color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:700; cursor:pointer; }
.hot-board ol,.live-feed ol { display:grid; gap:var(--cp-space-2); margin:0; padding:0; list-style:none; }
.hot-board li button { display:grid; width:100%; grid-template-columns:1.5rem minmax(0,1fr) 5.8rem; align-items:center; gap:var(--cp-space-2); padding:var(--cp-space-2); border:0; background:transparent; color:var(--cp-text-primary); text-align:left; cursor:pointer; }
.hot-board li button:hover,.hot-board li button:focus-visible { background:var(--cp-surface-selected); }
.rank { color:var(--cp-action-primary); font:800 var(--cp-text-sm)/1 var(--cp-font-mono); }
.hot-topic { display:grid; min-width:0; gap:.2rem; }
.hot-topic strong { overflow:hidden; font-size:var(--cp-text-sm); text-overflow:ellipsis; white-space:nowrap; }
.hot-topic small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.heat { display:grid; grid-template-columns:minmax(0,1fr) 1.6rem; align-items:center; gap:.35rem; }
.heat::before { content:''; grid-column:1; grid-row:1; height:.22rem; background:var(--cp-border-subtle); }
.heat i { grid-column:1; grid-row:1; height:.22rem; background:var(--cp-danger); transition:width .55s cubic-bezier(.2,.75,.25,1); }
.heat b { color:var(--cp-text-muted); font:650 var(--cp-text-xs)/1 var(--cp-font-mono); text-align:right; }
.feed-card { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-default); animation:feed-arrival .38s cubic-bezier(.2,.75,.25,1) both; animation-delay:calc(var(--feed-order,0) * 42ms); }
.feed-card__meta { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-2); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.feed-card__meta .agent { padding:0; border:0; background:none; color:var(--cp-action-primary); font-weight:750; cursor:pointer; }
.feed-card__meta .provenance { margin-left:auto; color:var(--cp-evidence-text); font-weight:750; }
.feed-card__body { display:grid; gap:var(--cp-space-1); padding:0; border:0; background:none; color:var(--cp-text-primary); text-align:left; cursor:pointer; }
.feed-card__body .relation { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.feed-card__body strong { font-size:var(--cp-text-sm); font-weight:500; line-height:1.65; }
.feed-card__stats { display:flex; flex-wrap:wrap; gap:var(--cp-space-3); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.empty { margin:0; padding:var(--cp-space-3); color:var(--cp-text-muted); font-size:var(--cp-text-sm); text-align:center; }
.method-note { padding-top:var(--cp-space-3); border-top:1px solid var(--cp-border-default); color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.6; }
.method-note strong { color:var(--cp-text-secondary); }
@keyframes pulse { 50% { opacity:.45; transform:scale(.85); } }
@keyframes feed-arrival { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
@keyframes governance-arrival { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion:reduce) { .live-dot.active,.feed-card,.governance-flash { animation:none; } .heat i { transition:none; } }
@media (max-width:1050px) { .forum-lanes { grid-template-columns:1fr; } }
@media (max-width:760px) {
  .live-stage { padding:var(--cp-space-3); }
  .live-stage__header { flex-direction:column; }
  .governance-button { width:100%; }
  .live-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .live-metrics div:nth-child(odd) { border-right:1px solid var(--cp-border-subtle); }
  .live-metrics div:nth-child(even) { border-right:0; }
  .live-metrics div { border-bottom:1px solid var(--cp-border-subtle); }
  .live-metrics div:last-child { border-bottom:0; }
  .forum-lane__head { flex-direction:column; }
  .forum-lane__head dl { justify-content:flex-start; text-align:left; }
  .hot-board li button { grid-template-columns:1.5rem minmax(0,1fr); }
  .heat { grid-column:2; width:6rem; }
}
</style>
