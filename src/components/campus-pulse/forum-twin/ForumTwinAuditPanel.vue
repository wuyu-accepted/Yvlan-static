<script setup lang="ts">
import type {
  ForumTwinAggregateResult,
  ForumTwinDomainResult,
  ForumTwinManifest,
} from '../../../services/forumTwin'

defineProps<{
  aggregate: ForumTwinAggregateResult
  domain: ForumTwinDomainResult
  manifest: ForumTwinManifest
  manifestSha256: string
  sourceLabel: string
}>()

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-6)}`
}
</script>

<template>
  <section class="audit-panel">
    <header>
      <div>
        <span>PROVENANCE / PRIVACY / CLAIM BOUNDARY</span>
        <h2>页面只渲染审阅 LLM 论坛资产</h2>
      </div>
      <b>PUBLICATION ELIGIBLE</b>
    </header>
    <div class="audit-grid">
      <article><span>执行来源</span><strong>{{ aggregate.execution_provenance }}</strong></article>
      <article><span>居民 / 治理 turns</span><strong>{{ domain.llm_usage.resident_turns }} / {{ domain.llm_usage.governance_turns }}</strong></article>
      <article><span>Provider calls / tokens</span><strong>{{ domain.llm_usage.provider_calls }} / {{ domain.llm_usage.provider_tokens }}</strong></article>
      <article><span>Emulator public messages</span><strong>{{ domain.audit.emulator_public_messages }}</strong></article>
      <article><span>真实治理动作</span><strong>{{ domain.audit.real_governance_actions }}</strong></article>
      <article><span>Scheduler recall</span><strong>{{ (domain.sampling.scheduler_recall * 100).toFixed(1) }}%</strong></article>
    </div>
    <div class="hash-chain">
      <code>result-v6 · {{ shortHash(aggregate.result_sha256) }}</code><i>→</i>
      <code>domain · {{ shortHash(manifest.domain_result_sha256) }}</code><i>→</i>
      <code>forum · {{ shortHash(manifest.public_forum_sha256) }}</code><i>→</i>
      <code>manifest · {{ shortHash(manifestSha256) }}</code>
    </div>
    <div class="boundaries">
      <ul>
        <li v-for="item in aggregate.non_claims.slice(0, Math.ceil(aggregate.non_claims.length / 2))" :key="item">{{ item }}</li>
      </ul>
      <ul>
        <li v-for="item in aggregate.non_claims.slice(Math.ceil(aggregate.non_claims.length / 2))" :key="item">{{ item }}</li>
      </ul>
    </div>
    <footer>{{ sourceLabel }} · {{ manifest.asset_integrity.verification_method }}</footer>
  </section>
</template>

<style scoped>
.audit-panel { min-width:0; padding:17px; border:1px solid rgba(102,157,165,.15); border-radius:15px; background:rgba(6,19,23,.9); }
header { display:flex; justify-content:space-between; gap:12px; align-items:center; }
header span { color:#55d9c7; font:800 9px ui-monospace,monospace; letter-spacing:.13em; }
h2 { margin:4px 0 0; color:#e2efed; font-size:16px; }
header > b { color:#59d9c7; font:800 8px ui-monospace,monospace; }
.audit-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:7px; margin-top:13px; }
article { min-width:0; padding:9px; border:1px solid rgba(99,152,159,.1); border-radius:8px; background:#08191d; }
article span { display:block; color:#607a7f; font-size:8px; }
article strong { display:block; overflow:hidden; margin-top:5px; color:#c7d9d6; font:800 10px ui-monospace,monospace; text-overflow:ellipsis; white-space:nowrap; }
.hash-chain { display:flex; gap:7px; align-items:center; margin-top:11px; padding:10px; overflow:auto; border-radius:7px; background:#061418; }
.hash-chain code { flex:0 0 auto; color:#77918f; font-size:8px; }
.hash-chain i { color:#36565a; font-style:normal; }
.boundaries { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:10px; }
ul { margin:0; padding-left:16px; color:#698186; font-size:8px; line-height:1.7; }
.audit-panel > footer { margin-top:9px; color:#536d72; font:700 8px ui-monospace,monospace; text-align:right; }
@media(max-width:900px){.audit-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:560px){.audit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.boundaries{grid-template-columns:1fr}}
</style>

<style scoped>
.audit-panel { border: 1px solid var(--ft-border); border-top: 4px solid #1a1a1a; border-radius: 2px; background: #ffffff; box-shadow: 0 5px 18px rgba(0,0,0,.035); }
header span { color: var(--ft-red); }
h2 { color: var(--ft-ink); font-weight: 600; }
header > b { padding: 4px 7px; border-radius: 2px; color: #2f7d42; background: #e7f5ea; }
article { border-color: #e8e8e8; border-radius: 2px; background: #fafafa; }
article span { color: var(--ft-muted); }
article strong { color: var(--ft-ink); }
.hash-chain { border: 1px solid #eeeeee; border-radius: 2px; background: #fafafa; }
.hash-chain code { color: var(--ft-copy); }
.hash-chain i { color: var(--ft-red); }
ul { color: var(--ft-copy); }
.audit-panel > footer { color: var(--ft-muted); }
</style>
