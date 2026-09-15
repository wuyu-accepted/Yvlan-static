<script setup lang="ts">
import { computed } from 'vue'
import type {
  ForumDisplayProfile,
  ForumMessage,
} from '../../../services/forumTwin'

const props = defineProps<{
  displayId?: string
  messageId?: string
  profiles: ForumDisplayProfile[]
  messages: ForumMessage[]
}>()

const profile = computed(() => props.profiles.find(
  (item) => item.display_id === props.displayId,
) || null)
const message = computed(() => props.messages.find(
  (item) => item.message_id === props.messageId,
) || null)

const actionSummary = computed(() => {
  if (!message.value) return '未选择消息'
  const values = [
    message.value.action,
    message.value.topic,
    message.value.stance,
  ].filter(Boolean)
  return values.length ? values.join(' / ') : '当前公共结果未提供结构化动作标签'
})
</script>

<template>
  <aside class="agent-drawer">
    <header>
      <span>SYNTHETIC AGENT EXPLAIN</span>
      <h2>{{ displayId || '点击论坛人物' }}</h2>
    </header>
    <template v-if="message">
      <div class="identity" v-if="profile">
        <b>{{ profile.macro_role }}</b>
        <i>×</i>
        <b>{{ profile.micro_role }}</b>
      </div>
      <p v-if="profile" class="focus">{{ profile.episode_focus }}</p>
      <dl>
        <div>
          <dt>本次可见动作</dt>
          <dd>{{ actionSummary }}</dd>
        </div>
        <div>
          <dt>决策理由标签</dt>
          <dd>{{ message.decision_reason_tags?.join(' · ') || '未公开' }}</dd>
        </div>
        <div>
          <dt>审阅记忆摘要</dt>
          <dd>{{ message.memory_summary || '当前公共资产未提供记忆摘要' }}</dd>
        </div>
      </dl>
      <div v-if="profile" class="tags">
        <span v-for="topic in profile.topic_portfolio" :key="topic">{{ topic }}</span>
        <span v-for="style in profile.interaction_style" :key="style">{{ style }}</span>
      </div>
      <p class="boundary">
        这里只显示公共 synthetic display profile 与当前消息的审阅摘要；不公开抽样身份、私有 Feed 或 profile evidence。
      </p>
    </template>
    <div v-else class="empty">选择一条经过 provenance 校验的 LLM 消息。</div>
  </aside>
</template>

<style scoped>
.agent-drawer { min-width:0; padding:17px; border:1px solid rgba(111,159,167,.15); border-radius:15px; background:rgba(6,19,23,.9); }
header span { color:#b79cea; font:800 9px ui-monospace,monospace; letter-spacing:.13em; }
h2 { margin:5px 0 0; color:#e3efed; font-size:17px; }
.identity { display:flex; gap:7px; align-items:center; margin-top:14px; color:#bcd0cd; font-size:10px; }
.identity i { color:#526d72; font-style:normal; }
.focus { margin:9px 0; color:#879ea1; font-size:10px; line-height:1.6; }
dl { display:grid; gap:7px; margin:12px 0; }
dl div { padding:9px; border:1px solid rgba(96,151,158,.1); border-radius:8px; background:#08191d; }
dt { color:#617b80; font-size:8px; }
dd { margin:5px 0 0; color:#bed1ce; font-size:9px; line-height:1.55; }
.tags { display:flex; flex-wrap:wrap; gap:5px; }
.tags span { padding:4px 6px; border-radius:4px; background:rgba(71,132,126,.13); color:#77aaa4; font-size:8px; }
.boundary { margin:13px 0 0; padding-top:10px; border-top:1px solid rgba(100,153,159,.1); color:#5f787d; font-size:8px; line-height:1.6; }
.empty { display:grid; min-height:180px; place-content:center; color:#607a7f; font-size:9px; text-align:center; }
</style>

<style scoped>
.agent-drawer { border: 1px solid var(--ft-border); border-top: 4px solid var(--ft-gold); border-radius: 2px; background: #ffffff; box-shadow: 0 5px 18px rgba(0,0,0,.035); }
header span { color: var(--ft-gold); }
h2 { color: var(--ft-ink); font-weight: 600; }
.identity { color: var(--ft-ink); }
.identity i { color: #bfbfbf; }
.focus { color: var(--ft-copy); }
dl div { border-color: #eeeeee; border-radius: 2px; background: #fafafa; }
dt { color: var(--ft-muted); }
dd { color: var(--ft-copy); }
.tags span { border: 1px solid #ead7db; border-radius: 2px; color: var(--ft-red); background: var(--ft-red-soft); }
.boundary { border-top-color: #eeeeee; color: var(--ft-muted); }
.empty { color: var(--ft-muted); }
</style>
