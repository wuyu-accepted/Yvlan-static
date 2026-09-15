<script setup lang="ts">
import { computed } from 'vue'
import type {
  ForumBranchId,
  ForumMessage,
  ForumThread,
  ForumTick,
} from '../../../services/forumTwin'

const props = defineProps<{
  branchId: ForumBranchId
  tick: ForumTick
  threads: ForumThread[]
  messages: ForumMessage[]
  selectedThreadId?: string
}>()

const emit = defineEmits<{
  selectThread: [threadId: string]
}>()

const messageById = computed(() => new Map(
  props.messages.map((message) => [message.message_id, message]),
))

const cards = computed(() => props.tick.active_thread_ids
  .map((threadId) => props.threads.find((thread) => thread.thread_id === threadId))
  .filter((thread): thread is ForumThread => Boolean(thread))
  .map((thread) => {
    const visible = thread.message_ids
      .map((messageId) => messageById.value.get(messageId))
      .filter((message): message is ForumMessage => (
        Boolean(message) && message!.created_tick <= props.tick.tick
      ))
      .sort((left, right) => (
        right.created_tick - left.created_tick
        || right.message_id.localeCompare(left.message_id)
      ))
    return {
      thread,
      root: messageById.value.get(thread.root_message_id),
      latest: visible[0],
      visibleCount: visible.length,
    }
  }))

function sourceLabel(message?: ForumMessage) {
  if (!message) return '不可显示'
  if (message.provenance.kind === 'authorized_live_llm') return 'LIVE LLM'
  return message.provenance.transport === 'cache'
    ? 'REVIEWED TRACE · CACHE'
    : 'REVIEWED TRACE'
}
</script>

<template>
  <section class="branch-feed" :class="branchId">
    <header>
      <div>
        <span>{{ branchId === 'natural' ? 'NATURAL FORUM' : 'ADAPTIVE D FORUM' }}</span>
        <h2>{{ branchId === 'natural' ? '自然演化' : '有限观测治理' }}</h2>
      </div>
      <div class="counts">
        <b>{{ tick.public_message_count }}</b> 条公开 LLM 消息
        <i>·</i>
        <b>{{ tick.active_thread_ids.length }}</b> 个活跃讨论
      </div>
    </header>

    <div v-if="cards.length" class="feed-list">
      <button
        v-for="card in cards"
        :key="card.thread.thread_id"
        type="button"
        class="feed-card"
        :class="{ selected: selectedThreadId === card.thread.thread_id }"
        @click="emit('selectThread', card.thread.thread_id)"
      >
        <span class="board"># {{ card.thread.board }} · {{ card.thread.topic }}</span>
        <strong>{{ card.root?.visible_text }}</strong>
        <p v-if="card.latest && card.latest.message_id !== card.root?.message_id">
          <b>@{{ card.latest.source_display_id }}</b>
          {{ card.latest.visible_text }}
        </p>
        <footer>
          <span>{{ card.thread.participant_count }} 人参与 · {{ card.visibleCount - 1 }} 条可见回复</span>
          <em :class="card.latest?.provenance.kind">
            {{ sourceLabel(card.latest || card.root) }}
          </em>
        </footer>
      </button>
    </div>
    <div v-else class="empty-feed">
      <strong>T{{ tick.tick }} 暂无可公开讨论</strong>
      <span>后台沉默、阅读和状态变化不会被伪造成论坛文字。</span>
    </div>
  </section>
</template>

<style scoped>
.branch-feed { min-width: 0; border: 1px solid rgba(102,154,163,.16); border-radius: 16px; background: rgba(6,19,23,.92); overflow: hidden; }
.branch-feed > header { display:flex; justify-content:space-between; gap:16px; align-items:center; padding:16px 18px; border-bottom:1px solid rgba(107,162,170,.12); background:linear-gradient(110deg,rgba(23,75,76,.18),transparent); }
.branch-feed.D > header { background:linear-gradient(110deg,rgba(88,61,137,.22),transparent); }
header span { color:#57dbc9; font:800 9px ui-monospace,monospace; letter-spacing:.14em; }
.D header span { color:#b59bea; }
h2 { margin:4px 0 0; color:#edf7f5; font-size:18px; }
.counts { color:#70878d; font-size:9px; text-align:right; }
.counts b { color:#b7d2cf; font:800 11px ui-monospace,monospace; }
.counts i { margin:0 4px; color:#3b555b; font-style:normal; }
.feed-list { display:grid; gap:8px; max-height:430px; padding:10px; overflow:auto; scrollbar-color:#31565a transparent; }
.feed-card { display:block; width:100%; padding:13px 14px; border:1px solid rgba(97,151,159,.12); border-radius:11px; background:#08181c; color:inherit; text-align:left; cursor:pointer; transition:border-color .18s,transform .18s; }
.feed-card:hover,.feed-card.selected { border-color:rgba(80,222,203,.48); transform:translateY(-1px); }
.D .feed-card:hover,.D .feed-card.selected { border-color:rgba(183,152,235,.48); }
.board { color:#6c8a8f; font-size:9px; }
.feed-card > strong { display:block; margin-top:7px; color:#d9e9e7; font-size:12px; line-height:1.65; }
.feed-card p { margin:9px 0 0; padding:8px 10px; border-left:2px solid rgba(95,198,185,.3); color:#90a7a9; background:rgba(25,54,57,.25); font-size:10px; line-height:1.55; }
.feed-card p b { color:#b7cecb; }
.feed-card footer { display:flex; justify-content:space-between; gap:10px; margin-top:10px; color:#5e767c; font-size:8px; }
.feed-card em { color:#5edbc9; font:700 8px ui-monospace,monospace; font-style:normal; }
.feed-card em.authorized_live_llm { color:#ffba79; }
.empty-feed { display:grid; gap:7px; min-height:180px; place-content:center; padding:30px; text-align:center; }
.empty-feed strong { color:#b7cac8; font-size:12px; }
.empty-feed span { color:#627b81; font-size:9px; }
@media (max-width:680px) { .branch-feed > header { align-items:flex-start; } .counts { max-width:120px; } .feed-list { max-height:360px; } }
</style>

<style scoped>
.branch-feed {
  border: 1px solid var(--ft-border);
  border-top: 4px solid #262626;
  border-radius: 2px;
  background: #ffffff;
  box-shadow: 0 5px 18px rgba(0, 0, 0, .035);
}
.branch-feed.D { border-top-color: var(--ft-red); }
.branch-feed > header,
.branch-feed.D > header {
  padding: 17px 18px;
  border-bottom: 1px solid #eeeeee;
  background: #ffffff;
}
.branch-feed.D > header { background: linear-gradient(100deg, var(--ft-red-soft), #ffffff 62%); }
header span,
.D header span { color: var(--ft-red); font-size: 9px; }
h2 { color: var(--ft-ink); font-size: 19px; font-weight: 600; }
.counts { color: var(--ft-muted); font-size: 10px; }
.counts b { color: var(--ft-ink); font-size: 12px; }
.counts i { color: #bfbfbf; }
.feed-list { gap: 9px; max-height: 470px; padding: 12px; background: #fafafa; scrollbar-color: #bfbfbf transparent; }
.feed-card {
  padding: 14px 15px;
  border: 1px solid #e7e7e7;
  border-radius: 2px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, .02);
}
.feed-card:hover,
.feed-card.selected,
.D .feed-card:hover,
.D .feed-card.selected {
  border-color: var(--ft-red);
  transform: translateY(-1px);
  box-shadow: inset 3px 0 var(--ft-red), 0 5px 14px rgba(174, 11, 42, .08);
}
.board { color: var(--ft-red); font-size: 10px; }
.feed-card > strong { color: var(--ft-ink); font-size: 13px; line-height: 1.7; }
.feed-card p { border-left-color: #d8c59e; color: var(--ft-copy); background: var(--ft-gold-soft); font-size: 11px; }
.feed-card p b { color: #695a38; }
.feed-card footer { color: var(--ft-muted); font-size: 9px; }
.feed-card em { color: var(--ft-gold); font-size: 8px; }
.feed-card em.authorized_live_llm { color: var(--ft-red); }
.empty-feed { color: var(--ft-muted); background: #fafafa; }
.empty-feed strong { color: var(--ft-copy); }
.empty-feed span { color: var(--ft-muted); }
</style>
