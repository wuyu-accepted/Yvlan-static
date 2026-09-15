<script setup lang="ts">
import { computed } from 'vue'
import type { SourceState } from '../contracts/source.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'

const props = defineProps<{
  objectLabel: string
  evidenceRef: string | null
  provenance: SourceState['provenance']
  boundarySummary: string
  publicationEligible: boolean
}>()

function short(value: string | undefined | null): string {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : '—'
}
</script>

<template>
  <div class="evidence-details">
    <header class="evidence-head">
      <h3>{{ objectLabel }}</h3>
    </header>

    <section class="evidence-section" aria-labelledby="evidence-ref-title">
      <h4 id="evidence-ref-title">证据引用</h4>
      <p v-if="evidenceRef" class="evidence-ref"><span class="gold-dot" aria-hidden="true" />{{ evidenceRef }}</p>
      <p v-else class="evidence-none">来源随所属运行记录保存。</p>
    </section>

    <section class="evidence-section" aria-labelledby="prov-title">
      <h4 id="prov-title">来源与校验</h4>
      <dl class="prov-facts">
        <div><dt>来源</dt><dd><CpStatusBadge tone="info">{{ provenance.runId || provenance.evidenceId || '—' }}</CpStatusBadge></dd></div>
        <div><dt>执行来源</dt><dd>{{ provenance.executionProvenance || '—' }}</dd></div>
        <div><dt>校验</dt><dd><CpStatusBadge tone="success">已验证</CpStatusBadge></dd></div>
        <div><dt>发布</dt><dd><CpStatusBadge :tone="publicationEligible ? 'success' : 'warning'">{{ publicationEligible ? '可发布' : '只读展示' }}</CpStatusBadge></dd></div>
      </dl>
    </section>

    <p class="boundary">{{ boundarySummary }}</p>
  </div>
</template>

<style scoped>
.evidence-details { display:grid; gap:var(--cp-space-3); }
.evidence-head p { margin:0; color:var(--cp-evidence-text); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.evidence-head h3 { margin:var(--cp-space-1) 0; font-size:var(--cp-text-md); }
.evidence-section h4 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-sm); }
.evidence-ref { display:flex; align-items:flex-start; gap:var(--cp-space-2); margin:0; padding:var(--cp-space-2) var(--cp-space-3); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); font-size:var(--cp-text-sm); font-weight:650; border:1px solid var(--cp-evidence); }
.gold-dot { flex:none; width:.55rem; height:.55rem; margin-top:.3rem; border-radius:50%; background:var(--cp-evidence); }
.evidence-none { margin:0; padding:var(--cp-space-2); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); border:1px dashed var(--cp-border-strong); }
.prov-facts { display:grid; gap:var(--cp-space-2); margin:0; padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.prov-facts div { display:flex; justify-content:space-between; gap:var(--cp-space-2); align-items:center; }
.prov-facts dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.prov-facts dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-xs); text-align:right; }
.prov-facts code { word-break:break-all; }
.boundary { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:1.55; }
</style>
