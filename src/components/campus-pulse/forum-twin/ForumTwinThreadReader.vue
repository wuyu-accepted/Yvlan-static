<script setup lang="ts">
import { computed } from 'vue'
import type {
  ForumClaim,
  ForumMessage,
  ForumThread,
} from '../../../services/forumTwin'

const props = defineProps<{
  thread: ForumThread | null
  messages: ForumMessage[]
  claims: ForumClaim[]
  tick: number
}>()

const emit = defineEmits<{
  selectAgent: [displayId: string, messageId: string]
  selectClaim: [claimId: string]
}>()

const visibleMessages = computed(() => {
  if (!props.thread) return []
  const ids = new Set(props.thread.message_ids)
  return props.messages
    .filter((message) => ids.has(message.message_id) && message.created_tick <= props.tick)
    .sort((left, right) => (
      left.created_tick - right.created_tick
      || left.message_id.localeCompare(right.message_id)
    ))
})

const messageById = computed(() => new Map(
  visibleMessages.value.map((message) => [message.message_id, message]),
))

function sourceLabel(message: ForumMessage) {
  return message.provenance.kind === 'authorized_live_llm'
    ? 'LIVE LLM'
    : message.provenance.transport === 'cache'
      ? 'REVIEWED TRACE · CACHE'
      : 'REVIEWED TRACE'
}

function actionLabel(action: string | null) {
  if (!action) return ''
  return ({
    post: '发帖', reply: '回复', quote: '引用', repost: '转发',
    verify: '求证', correct: '纠错', seek_help: '求助',
    report_risk: '风险上报', governance_message: '治理消息',
    service_receipt: '服务回执', governance_evidence: '治理证据',
  } as Record<string, string>)[action] || action
}

function semanticLabel(message: ForumMessage) {
  return [message.stance, message.emotion].filter(Boolean).join(' · ')
}
</script>

<template>
  <section class="thread-reader">
    <header>
      <div>
        <span>PUBLIC SYNTHETIC THREAD</span>
        <h2>{{ thread ? `${thread.board} / ${thread.topic}` : '选择一个讨论串' }}</h2>
      </div>
      <b v-if="thread">{{ thread.reply_count }} REPLIES</b>
    </header>

    <div v-if="thread && visibleMessages.length" class="messages">
      <article
        v-for="message in visibleMessages"
        :key="message.message_id"
        :class="['message', message.action, { root: message.message_id === thread.root_message_id }]"
      >
        <div class="message-head">
          <button type="button" @click="emit('selectAgent', message.source_display_id, message.message_id)">
            {{ message.source_display_id }}
          </button>
          <span>
            T{{ message.created_tick }}
            <template v-if="actionLabel(message.action)"> · {{ actionLabel(message.action) }}</template>
          </span>
          <em :class="message.provenance.kind">{{ sourceLabel(message) }}</em>
        </div>
        <p v-if="message.parent_message_id" class="reply-to">
          回复 @{{ messageById.get(message.parent_message_id)?.source_display_id || '已审阅消息' }}
        </p>
        <blockquote v-if="message.quote_message_id">
          {{ messageById.get(message.quote_message_id)?.visible_text || '引用内容在当前时点不可见' }}
        </blockquote>
        <p class="body">{{ message.visible_text }}</p>
        <footer>
          <span v-if="semanticLabel(message)">{{ semanticLabel(message) }}</span>
          <span v-if="message.confidence !== null">置信 {{ Math.round(message.confidence * 100) }}%</span>
          <button
            v-for="claimId in message.claim_ids"
            :key="claimId"
            type="button"
            @click="emit('selectClaim', claimId)"
          >
            CLAIM {{ claimId }}
          </button>
        </footer>
      </article>
    </div>
    <div v-else class="empty">
      <span>这里不会填充占位帖子。</span>
      <strong>选择左侧经过哈希与 provenance 校验的讨论串。</strong>
    </div>
  </section>
</template>

<style scoped>
.thread-reader { min-width:0; border:1px solid rgba(101,158,165,.16); border-radius:16px; background:rgba(6,18,22,.92); overflow:hidden; }
.thread-reader > header { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:16px 18px; border-bottom:1px solid rgba(101,158,165,.12); }
header span { color:#54d8c7; font:800 9px ui-monospace,monospace; letter-spacing:.14em; }
h2 { margin:4px 0 0; color:#e8f3f1; font-size:17px; }
header > b { color:#789297; font:800 9px ui-monospace,monospace; }
.messages { display:grid; gap:10px; max-height:650px; padding:13px; overflow:auto; }
.message { margin-left:24px; padding:13px; border:1px solid rgba(95,151,157,.1); border-radius:10px; background:#08171b; }
.message.root { margin-left:0; border-color:rgba(75,214,196,.25); }
.message.correct { border-left:3px solid #52dcc9; }
.message.seek_help { border-left:3px solid #e9a365; }
.message.governance_message { border-left:3px solid #af91e5; }
.message-head { display:flex; gap:8px; align-items:center; }
.message-head button { padding:0; border:0; background:transparent; color:#d7e9e6; font-weight:750; cursor:pointer; }
.message-head span { color:#607b80; font-size:8px; }
.message-head em { margin-left:auto; color:#58dbc9; font:700 8px ui-monospace,monospace; font-style:normal; }
.message-head em.authorized_live_llm { color:#f0ad70; }
.reply-to { margin:7px 0 0; color:#657d82; font-size:8px; }
blockquote { margin:8px 0 0; padding:8px 10px; border-left:2px solid #36575b; color:#80979b; background:#0b2024; font-size:9px; }
.body { margin:8px 0 0; color:#cddfdd; font-size:11px; line-height:1.7; }
.message footer { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:9px; }
.message footer span { color:#637d82; font-size:8px; }
.message footer button { padding:3px 5px; border:1px solid rgba(113,162,167,.18); border-radius:4px; background:transparent; color:#829a9e; font:700 7px ui-monospace,monospace; cursor:pointer; }
.empty { display:grid; gap:7px; min-height:300px; place-content:center; padding:30px; color:#637b80; text-align:center; }
.empty strong { color:#a9bfbc; font-size:11px; }
.empty span { font-size:9px; }
@media (max-width:680px) { .messages { max-height:560px; } .message { margin-left:10px; } }
</style>

<style scoped>
.thread-reader {
  border: 1px solid var(--ft-border);
  border-radius: 2px;
  background: #ffffff;
  box-shadow: 0 5px 18px rgba(0, 0, 0, .035);
}
.thread-reader > header { padding: 17px 18px; border-bottom: 1px solid #e8e8e8; background: #111111; }
header span { color: #d6bfc4; font-size: 9px; }
h2 { color: #ffffff; font-size: 18px; font-weight: 600; }
header > b { color: #c7b079; font-size: 9px; }
.messages { gap: 0; max-height: 720px; padding: 0 18px; background: #ffffff; }
.message,
.message.root {
  position: relative;
  margin-left: 0;
  padding: 17px 0 17px 42px;
  border: 0;
  border-bottom: 1px solid #eeeeee;
  border-radius: 0;
  background: #ffffff;
}
.message::before {
  position: absolute;
  top: 17px;
  left: 0;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: #222222;
  content: "AI";
  font: 700 9px ui-monospace, monospace;
}
.message.root::before { background: var(--ft-red); }
.message.correct,
.message.seek_help,
.message.governance_message { border-left: 0; }
.message.correct::after,
.message.seek_help::after,
.message.governance_message::after {
  position: absolute;
  top: 20px;
  right: 0;
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 8px;
}
.message.correct::after { color: #3d6d49; background: #e7f5ea; content: "纠错"; }
.message.seek_help::after { color: #79622c; background: var(--ft-gold-soft); content: "求助"; }
.message.governance_message::after { color: var(--ft-red); background: var(--ft-red-soft); content: "治理回应"; }
.message-head { padding-right: 48px; }
.message-head button { color: var(--ft-ink); font-size: 12px; }
.message-head span { color: var(--ft-muted); font-size: 9px; }
.message-head em { color: var(--ft-gold); font-size: 8px; }
.message-head em.authorized_live_llm { color: var(--ft-red); }
.reply-to { color: var(--ft-muted); }
blockquote { border-left-color: var(--ft-gold); color: var(--ft-copy); background: var(--ft-gold-soft); font-size: 10px; }
.body { color: #262626; font-size: 12px; line-height: 1.85; }
.message footer span { color: var(--ft-muted); font-size: 9px; }
.message footer button { border-color: #e2c4ca; border-radius: 2px; color: var(--ft-red); background: var(--ft-red-soft); }
.empty { color: var(--ft-muted); background: #fafafa; }
.empty strong { color: var(--ft-copy); }
</style>
