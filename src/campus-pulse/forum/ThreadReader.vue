<script setup lang="ts">
import { computed } from 'vue'
import type { ForumMessage, ForumThread } from '../contracts/forumTwin.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import ContentTranslation from '../i18n/ContentTranslation.vue'

const props = defineProps<{
  thread: ForumThread | null
  messages: ForumMessage[]
  tick: number
}>()

const emit = defineEmits<{
  selectAgent: [displayId: string, messageId: string]
  selectClaim: [claimId: string]
}>()

const byId = computed(() => new Map(props.messages.map((message) => [message.message_id, message])))
const directReplyCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const message of props.messages) {
    if (!message.parent_message_id) continue
    counts.set(message.parent_message_id, (counts.get(message.parent_message_id) || 0) + 1)
  }
  return counts
})
const quoteCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const message of props.messages) {
    if (!message.quote_message_id) continue
    counts.set(message.quote_message_id, (counts.get(message.quote_message_id) || 0) + 1)
  }
  return counts
})
const supportiveReplyCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const message of props.messages) {
    if (!message.parent_message_id || !/support|agree|赞同|支持|accept|接受/i.test(message.stance || '')) continue
    counts.set(message.parent_message_id, (counts.get(message.parent_message_id) || 0) + 1)
  }
  return counts
})

function actionLabel(action: string | null): string {
  const labels: Record<string, string> = {
    post: '发帖',
    reply: '回复',
    quote: '引用',
    repost: '转发',
    verify: '核实',
    correct: '纠正',
    seek_help: '求助',
    report_risk: '风险上报',
    governance_message: '治理消息',
    service_receipt: '服务回执',
    governance_evidence: '治理证据',
  }
  return action ? (labels[action] || action) : ''
}

function parentLabel(message: ForumMessage): string {
  const parent = message.parent_message_id ? byId.value.get(message.parent_message_id) : null
  if (message.quote_message_id) return `引用 ${short(message.quote_message_id)}`
  if (parent) return `回复 ${short(parent.message_id)}`
  return ''
}

function short(id: string): string {
  return id.length > 20 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id
}

function provenanceLabel(message: ForumMessage): string {
  return message.provenance.kind === 'authorized_live_llm' ? 'LIVE LLM' : 'TRACE REPLAY'
}

function branchLabel(branch: ForumThread['branch_id']) {
  return branch === 'D' ? '组合治理（方案 D）' : branch === 'A' ? '规则解释（方案 A）' : '不追加治理回应（Natural）'
}
</script>

<template>
  <div class="thread-reader">
    <template v-if="thread">
      <header class="reader-head">
        <p>{{ branchLabel(thread.branch_id) }} · Tick {{ thread.created_tick }} 起始</p>
        <h3>{{ thread.topic }}</h3>
        <p>{{ thread.need }}</p>
      </header>
      <ol class="message-list" :aria-label="`${thread.topic} 消息序列`">
        <li v-for="message in messages" :key="message.message_id" class="message">
          <div class="message__head">
            <span class="message__tick">Tick {{ message.created_tick }}</span>
            <button type="button" class="agent-link" @click="emit('selectAgent', message.source_display_id, message.message_id)">
              {{ message.source_display_id }}
            </button>
            <CpStatusBadge v-if="message.action" tone="neutral">{{ actionLabel(message.action) }}</CpStatusBadge>
            <CpStatusBadge v-if="message.action === 'governance_message'" tone="warning">治理消息</CpStatusBadge>
            <span class="message__prov">{{ provenanceLabel(message) }}</span>
          </div>
          <p v-if="parentLabel(message)" class="message__relation">{{ parentLabel(message) }}</p>
          <p class="message__text" data-content-language="zh">{{ message.visible_text }}</p>
          <ContentTranslation :text="message.visible_text" />
          <div v-if="message.topic || message.stance || message.emotion" class="message__tags">
            <span v-if="message.topic">话题：{{ message.topic }}</span>
            <span v-if="message.stance">立场：{{ message.stance }}</span>
            <span v-if="message.emotion">情绪：{{ message.emotion }}</span>
          </div>
          <div v-if="message.claim_ids.length" class="message__claims">
            <span>Claim：</span>
            <button v-for="claimId in message.claim_ids" :key="claimId" type="button" class="claim-link" @click="emit('selectClaim', claimId)">
              {{ short(claimId) }}
            </button>
          </div>
          <div class="message__interactions" aria-label="公开互动统计">
            <span>评论 {{ directReplyCounts.get(message.message_id) || 0 }}</span>
            <span>赞同回应 {{ supportiveReplyCounts.get(message.message_id) || 0 }}</span>
            <span>引用 {{ quoteCounts.get(message.message_id) || 0 }}</span>
          </div>
        </li>
      </ol>
      <p v-if="!messages.length" class="reader-empty">该时点该讨论串无已发布消息。</p>
    </template>
    <div v-else class="reader-empty">未选择讨论串。</div>
  </div>
</template>

<style scoped>
.thread-reader { display:grid; gap:var(--cp-space-3); }
.reader-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.reader-head h3 { margin:var(--cp-space-1) 0; font-size:var(--cp-text-md); }
.message-list { margin:0; padding:0; list-style:none; display:grid; gap:var(--cp-space-2); }
.message { padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-default); }
.message__head { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-2); }
.message__tick { color:var(--cp-text-secondary); font:600 var(--cp-text-xs)/1 var(--cp-font-mono); }
.agent-link, .claim-link { border:0; padding:0; background:none; color:var(--cp-action-primary); font:600 var(--cp-text-xs)/1 var(--cp-font-sans); text-decoration:underline; cursor:pointer; }
.message__prov { margin-left:auto; color:var(--cp-evidence-text); font-size:var(--cp-text-xs); font-weight:700; }
.message__relation { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.message__text { margin:var(--cp-space-2) 0 0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); line-height:1.55; white-space:pre-wrap; }
.message__tags { display:flex; flex-wrap:wrap; gap:var(--cp-space-1) var(--cp-space-3); margin-top:var(--cp-space-2); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.message__claims { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-1); margin-top:var(--cp-space-2); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.message__interactions { display:flex; flex-wrap:wrap; gap:var(--cp-space-3); margin-top:var(--cp-space-2); padding-top:var(--cp-space-2); border-top:1px solid var(--cp-border-subtle); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.reader-empty { padding:var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); border:1px dashed var(--cp-border-strong); }
</style>
