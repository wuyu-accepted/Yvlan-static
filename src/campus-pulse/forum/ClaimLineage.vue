<script setup lang="ts">
import { computed } from 'vue'
import type { ForumClaim, ForumMessage, ForumThread } from '../contracts/forumTwin.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'

const props = defineProps<{
  claim: ForumClaim | null
  claims: ForumClaim[]
  supportingMessages: ForumMessage[]
  challengingMessages: ForumMessage[]
  thread: ForumThread | null
}>()

const emit = defineEmits<{
  selectMessage: [messageId: string]
  openEvidence: []
}>()

const parent = computed(() => (
  props.claim?.parent_claim_id
    ? props.claims.find((item) => item.claim_id === props.claim!.parent_claim_id) || null
    : null
))

const correctionTarget = computed(() => (
  props.claim?.correction_target_claim_id
    ? props.claims.find((item) => item.claim_id === props.claim!.correction_target_claim_id) || null
    : null
))

const statusTone = computed(() => {
  const status = props.claim?.status
  return status === 'verified' ? 'success' : status === 'corrected' ? 'info' : status === 'expired' ? 'neutral' : 'warning'
})
const branchLabel = computed(() => props.claim?.branch_id === 'D' ? '组合治理（方案 D）' : props.claim?.branch_id === 'A' ? '规则解释（方案 A）' : '不追加治理回应（Natural）')
</script>

<template>
  <div class="claim-lineage">
    <template v-if="claim">
      <header class="claim-head">
        <p>{{ branchLabel }}</p>
        <h3>{{ claim.summary }}</h3>
        <p class="claim-meta">
          <CpStatusBadge :tone="statusTone">{{ claim.status }}</CpStatusBadge>
          <span>Tick {{ claim.first_seen_tick }} → Tick {{ claim.last_seen_tick }}</span>
          <span>支持 {{ claim.supporting_message_ids.length }} · 挑战 {{ claim.challenging_message_ids.length }}</span>
        </p>
      </header>

      <dl class="claim-facts">
        <div><dt>发起消息</dt><dd><code>{{ claim.created_by_message_id }}</code></dd></div>
        <div><dt>所在讨论串</dt><dd>{{ thread ? thread.topic : '未公开' }}</dd></div>
        <div v-if="parent"><dt>父 Claim</dt><dd>{{ parent.summary }}</dd></div>
        <div v-if="correctionTarget"><dt>纠正目标</dt><dd>{{ correctionTarget.summary }}</dd></div>
      </dl>

      <section class="claim-section" aria-labelledby="support-title">
        <h4 id="support-title">支持消息（仅已发布关联）</h4>
        <ul v-if="supportingMessages.length">
          <li v-for="message in supportingMessages" :key="message.message_id">
            <button type="button" class="msg-link" @click="emit('selectMessage', message.message_id)">Tick {{ message.created_tick }} · {{ message.source_display_id }}</button>
            <p data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</p>
          </li>
        </ul>
        <p v-else class="claim-empty">无已发布支持消息。</p>
      </section>

      <section class="claim-section" aria-labelledby="challenge-title">
        <h4 id="challenge-title">挑战消息</h4>
        <ul v-if="challengingMessages.length">
          <li v-for="message in challengingMessages" :key="message.message_id">
            <button type="button" class="msg-link" @click="emit('selectMessage', message.message_id)">Tick {{ message.created_tick }} · {{ message.source_display_id }}</button>
            <p data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</p>
          </li>
        </ul>
        <p v-else class="claim-empty">无已发布挑战消息。</p>
      </section>

      <footer class="claim-foot">
        <button v-if="claim.evidence_reference" type="button" class="evidence-link" @click="emit('openEvidence')">
          查看证据：{{ claim.evidence_reference }}
        </button>
        <p v-else class="claim-boundary">该 Claim 无独立证据引用；立场与真伪不由前端推断。</p>
      </footer>
    </template>
    <div v-else class="claim-empty">未选择 Claim。</div>
  </div>
</template>

<style scoped>
.claim-lineage { display:grid; gap:var(--cp-space-3); }
.claim-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.claim-head h3 { margin:var(--cp-space-1) 0; font-size:var(--cp-text-md); line-height:1.5; }
.claim-meta { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-2); color:var(--cp-text-secondary); }
.claim-facts { display:grid; gap:var(--cp-space-2); margin:0; padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.claim-facts div { display:flex; justify-content:space-between; gap:var(--cp-space-2); }
.claim-facts dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.claim-facts dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-xs); text-align:right; }
.claim-facts code { word-break:break-all; }
.claim-section h4 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-sm); }
.claim-section ul { margin:0; padding:0; list-style:none; display:grid; gap:var(--cp-space-2); }
.claim-section li { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); }
.claim-section li p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.5; }
.msg-link { border:0; padding:0; background:none; color:var(--cp-action-primary); font:600 var(--cp-text-xs)/1 var(--cp-font-sans); text-decoration:underline; cursor:pointer; }
.claim-empty { margin:0; padding:var(--cp-space-2); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); border:1px dashed var(--cp-border-strong); }
.claim-foot { padding-top:var(--cp-space-2); }
.evidence-link { border:0; padding:var(--cp-space-2) var(--cp-space-3); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); font:700 var(--cp-text-xs)/1 var(--cp-font-sans); border-radius:var(--cp-radius-sm); cursor:pointer; }
.claim-boundary { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
</style>
