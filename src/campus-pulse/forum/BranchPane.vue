<script setup lang="ts">
import { computed } from 'vue'
import type { ForumBranchId } from '../contracts/forumTwin.ts'
import type { BranchTickVM, ThreadSummaryVM } from './forumInvestigation.ts'
import { metricLabel } from './forumInvestigation.ts'
import type { ResultMetricKey } from '../source/forumTwinAdapter.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { currentLocale } from '../i18n/locale.ts'

const props = defineProps<{
  branch: ForumBranchId
  label: string
  metrics: BranchTickVM
  metric: ResultMetricKey
  threads: ThreadSummaryVM[]
  selectedThreadId?: string
  query: string
}>()

const emit = defineEmits<{
  selectThread: [threadId: string, branch: ForumBranchId]
  retry: []
}>()

const isD = computed(() => props.branch === 'D')
const isA = computed(() => props.branch === 'A')
const isEnglish = computed(() => currentLocale.value === 'en-US')
const branchDescription = computed(() => {
  if (isEnglish.value) {
    if (isD.value) return 'Combined response: explain standards and route individual issues into review, service receipts, and cross-group outreach.'
    if (isA.value) return 'Standards only: publish rules and evidence boundaries without opening an individual review or service path.'
    return 'No added response: keep the same event and population, but add no governance reply, so this plan serves as the comparison.'
  }
  if (isD.value) return '组合治理：解释标准，并把个体问题接入复核工单、服务回执与跨群触达。'
  if (isA.value) return '只解释标准：发布分配标准与证据边界，但不建立个体复核和服务入口。'
  return '不追加治理回应：保留同样的事件与人群，但治理主体不新增回应，用作对照。'
})
const deltaLabel = computed(() => {
  const delta = props.metrics.delta
  if (delta === null) return '—'
  return (delta > 0 ? '+' : '') + String(delta)
})

function matches(thread: ThreadSummaryVM): boolean {
  const q = props.query.trim().toLowerCase()
  if (!q) return true
  return (
    thread.thread.topic.toLowerCase().includes(q)
    || thread.thread.need.toLowerCase().includes(q)
    || thread.thread.thread_id.toLowerCase().includes(q)
  )
}

const visible = computed(() => props.threads.filter(matches))
</script>

<template>
  <section class="branch-pane" :aria-label="`${label} 分支讨论串`">
    <header class="branch-head">
      <div>
        <h2>{{ label }}</h2>
        <p>{{ branchDescription }}</p>
      </div>
      <dl class="metric-pair" aria-label="当前时点指标">
        <div><dt>{{ metricLabel(metric) }}</dt><dd>{{ metrics.messages ?? '—' }}</dd></div>
        <div><dt>讨论串</dt><dd>{{ metrics.threads ?? '—' }}</dd></div>
        <div v-if="isD" class="delta"><dt>组合治理 − 不追加回应（D − Natural）</dt><dd>{{ deltaLabel }}</dd></div>
      </dl>
    </header>

    <ul v-if="visible.length" class="thread-list" role="listbox" aria-label="讨论串列表">
      <li
        v-for="item in visible"
        :key="item.thread.thread_id"
        class="thread-row"
        :class="{ selected: item.thread.thread_id === selectedThreadId }"
        role="option"
        :aria-selected="item.thread.thread_id === selectedThreadId"
        tabindex="0"
        @click="emit('selectThread', item.thread.thread_id, branch)"
        @keydown.enter.prevent="emit('selectThread', item.thread.thread_id, branch)"
        @keydown.space.prevent="emit('selectThread', item.thread.thread_id, branch)"
      >
        <div class="thread-row__main">
          <strong>{{ item.thread.topic }}</strong>
          <p>{{ item.thread.need }}</p>
        </div>
        <dl class="thread-row__meta">
          <div><dt>起始</dt><dd>Tick {{ item.thread.created_tick }}</dd></div>
          <div><dt>消息</dt><dd>{{ item.messageCount }}</dd></div>
          <div><dt>回复</dt><dd>{{ item.thread.reply_count }}</dd></div>
          <div><dt>状态</dt><dd>{{ item.thread.status }}</dd></div>
        </dl>
        <CpStatusBadge v-if="!item.counterpart.exists" tone="neutral">无公开对应讨论串</CpStatusBadge>
        <CpStatusBadge v-else tone="info">存在映射对应</CpStatusBadge>
      </li>
    </ul>

    <div v-else class="branch-empty" role="status">
      <p><strong>当前时点无匹配讨论串</strong></p>
      <p>{{ query ? '调整搜索词或切换时点。' : '该时点没有公开讨论串；不会回退到最近非空时点。' }}</p>
    </div>
  </section>
</template>

<style scoped>
.branch-pane { container-type:inline-size; display:flex; min-width:0; flex-direction:column; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.branch-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.branch-head h2 { margin:0; font-size:var(--cp-text-lg); }
.branch-head p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.metric-pair { display:flex; gap:var(--cp-space-2); margin:0; }
.metric-pair > div { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.metric-pair dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.metric-pair dd { margin:var(--cp-space-1) 0 0; font-weight:650; font-variant-numeric:tabular-nums; }
.metric-pair .delta dd { color:var(--cp-action-primary); }
.thread-list { margin:0; padding:0; list-style:none; }
.thread-row { display:grid; grid-template-areas:'main badge' 'meta meta'; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:var(--cp-space-2) var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-subtle); cursor:pointer; }
.thread-row:hover { background:var(--cp-surface-subtle); }
.thread-row.selected { background:var(--cp-surface-selected); box-shadow:inset 3px 0 0 var(--cp-action-primary); }
.thread-row__main { grid-area:main; min-width:0; }
.thread-row__main strong { display:block; overflow-wrap:anywhere; font-size:var(--cp-text-sm); line-height:1.4; }
.thread-row__main p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.5; }
.thread-row__meta { display:grid; width:100%; grid-area:meta; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--cp-space-2); margin:0; padding-top:var(--cp-space-2); border-top:1px solid var(--cp-border-subtle); }
.thread-row__meta div { display:grid; min-width:0; gap:.15rem; }
.thread-row__meta dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.thread-row__meta dd { min-width:0; margin:0; overflow-wrap:anywhere; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); font-variant-numeric:tabular-nums; }
.thread-row :deep(.cp-status-badge) { grid-area:badge; justify-self:end; white-space:nowrap; }
.branch-empty { padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.branch-empty p { margin:0 0 var(--cp-space-1); }
@container (max-width:28rem) {
  .thread-row { grid-template-areas:'main' 'badge' 'meta'; grid-template-columns:minmax(0,1fr); }
  .thread-row :deep(.cp-status-badge) { justify-self:start; white-space:normal; }
  .thread-row__meta { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
</style>
