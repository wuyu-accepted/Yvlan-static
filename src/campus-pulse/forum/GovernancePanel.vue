<script setup lang="ts">
import { computed } from 'vue'
import type { GovernanceTickVM } from './forumInvestigation.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'

const props = defineProps<{ governance: GovernanceTickVM | null }>()

const emit = defineEmits<{
  selectMessage: [messageId: string]
  openEvidence: []
}>()

const hasAny = computed(() => Boolean(
  props.governance
  && (
    props.governance.decisions.length
    || props.governance.publishedMessages.length
    || props.governance.responseMessages.length
    || props.governance.chainsForTick.length
  ),
))
</script>

<template>
  <div class="governance-panel">
    <template v-if="governance && hasAny">
      <header class="gov-head">
        <p>Tick {{ governance.tick }} · 治理 D</p>
        <h3>治理主体当时看到什么、决定什么、消息如何被承接</h3>
      </header>

      <section v-if="governance.decisions.length" class="gov-section" aria-labelledby="decisions-title">
        <h4 id="decisions-title">决策（公开 trace）</h4>
        <table class="decisions-table">
          <thead><tr><th scope="col">主体</th><th scope="col">选中动作</th><th scope="col">概率</th><th scope="col">状态</th></tr></thead>
          <tbody>
            <tr v-for="(decision, index) in governance.decisions" :key="`${decision.actor}-${index}`">
              <td><code>{{ decision.actor }}</code></td>
              <td>{{ decision.action }}</td>
              <td>{{ decision.probability === null ? '—' : (decision.probability * 100).toFixed(1) + '%' }}</td>
              <td><CpStatusBadge v-if="decision.noop" tone="warning">noop（不动作）</CpStatusBadge><CpStatusBadge v-else tone="info">已选中</CpStatusBadge></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="governance.publishedMessages.length" class="gov-section" aria-labelledby="messages-title">
        <h4 id="messages-title">治理消息（Tick {{ governance.tick }}）</h4>
        <ul class="gov-messages">
          <li v-for="message in governance.publishedMessages" :key="message.message_id">
            <button type="button" class="msg-link" @click="emit('selectMessage', message.message_id)">Tick {{ message.created_tick }} · {{ message.source_display_id }}</button>
            <p data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</p>
          </li>
        </ul>
      </section>

      <section v-if="governance.responseMessages.length || governance.noResponseMessageCount" class="gov-section" aria-labelledby="response-title">
        <h4 id="response-title">居民响应</h4>
        <p class="response-summary">
          <CpStatusBadge v-if="governance.responseMessages.length" tone="success">{{ governance.responseMessages.length }} 条已响应</CpStatusBadge>
          <CpStatusBadge v-if="governance.noResponseMessageCount" tone="warning">{{ governance.noResponseMessageCount }} 条未获响应</CpStatusBadge>
        </p>
        <ul v-if="governance.responseMessages.length" class="gov-messages">
          <li v-for="message in governance.responseMessages" :key="message.message_id">
            <button type="button" class="msg-link" @click="emit('selectMessage', message.message_id)">Tick {{ message.created_tick }} · {{ message.source_display_id }}</button>
            <p data-content-language="zh" lang="zh-CN">{{ message.visible_text }}</p>
          </li>
        </ul>
        <p v-if="governance.noResponseMessageCount" class="no-response-note">无响应是治理压力测试的一等结果，不补成功节点。</p>
      </section>

      <section v-if="governance.chainsForTick.length" class="gov-section" aria-labelledby="chains-title">
        <h4 id="chains-title">该时点承接链</h4>
        <ul class="chain-list">
          <li v-for="chain in governance.chainsForTick" :key="chain.governanceMessageId">
            <code>{{ chain.governanceMessageId }}</code>
            <CpStatusBadge :tone="chain.complete ? 'success' : 'warning'">{{ chain.complete ? '完整承接' : '未完整承接' }}</CpStatusBadge>
            <span>{{ chain.residentResponseCount }} 条响应</span>
          </li>
        </ul>
      </section>

      <p class="uptake-note">全结果：完整承接 {{ governance.uptake.completeChains }} / {{ governance.uptake.totalChains }} 条。</p>
      <p class="natural-note">“不追加治理回应”（Natural）用作对照：它不调用治理主体，也不产生治理消息。</p>
    </template>

    <div v-else class="gov-empty" role="status">
      <p><strong>Tick {{ governance?.tick ?? '—' }} 无已发布治理过程</strong></p>
      <p>该时点没有公开决策、治理消息或承接链记录；不推断缺失节点。</p>
    </div>
  </div>
</template>

<style scoped>
.governance-panel { display:grid; gap:var(--cp-space-3); }
.gov-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.gov-head h3 { margin:var(--cp-space-1) 0; font-size:var(--cp-text-md); }
.gov-section h4 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-sm); }
.decisions-table { width:100%; border-collapse:collapse; font-size:var(--cp-text-sm); }
.decisions-table th, .decisions-table td { padding:var(--cp-space-2) var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); text-align:left; vertical-align:top; }
.decisions-table th { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:600; }
.gov-messages, .chain-list { margin:0; padding:0; list-style:none; display:grid; gap:var(--cp-space-2); }
.gov-messages li { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); }
.gov-messages li p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.5; }
.msg-link { border:0; padding:0; background:none; color:var(--cp-action-primary); font:600 var(--cp-text-xs)/1 var(--cp-font-sans); text-decoration:underline; cursor:pointer; }
.response-summary { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); margin:0 0 var(--cp-space-2); }
.no-response-note, .uptake-note, .natural-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.chain-list li { display:flex; flex-wrap:wrap; align-items:center; gap:var(--cp-space-2); padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); }
.chain-list code { font-size:var(--cp-text-xs); word-break:break-all; }
.chain-list span { margin-left:auto; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); }
.gov-empty { padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.gov-empty p { margin:0 0 var(--cp-space-1); }
</style>
