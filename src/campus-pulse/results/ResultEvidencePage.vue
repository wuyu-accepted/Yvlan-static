<script setup lang="ts">
import { computed, inject } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import VerificationDetails from '../components/VerificationDetails.vue'
import { RESULT_DETAIL_CONTEXT } from './resultDetailContext.ts'
import { downloadRunAggregateReport } from '../../services/campusPulseApi.js'

const context = inject(RESULT_DETAIL_CONTEXT)
if (!context) throw new Error('ResultEvidencePage requires ResultDetailLayout context')

const analysis = computed(() => context.analysis.value)
const evidence = computed(() => analysis.value?.evidence || null)
const result = computed(() => context.result.value)

async function downloadReport(format: 'json' | 'html') {
  if (!evidence.value?.report.available || !result.value?.runId) return
  const confirmed = window.confirm(
    `确认下载 ${format.toUpperCase()} 报告：结果 ${result.value.key}，来源 ${result.value.source.key}。正式导出仍需发布门禁复核。`,
  )
  if (!confirmed) return
  try {
    const response = await downloadRunAggregateReport(result.value.runId, format)
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${result.value.key}.aggregate.${format}`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch {
    // Report endpoints are gate-protected; a failed download keeps the page
    // auditable and lets the user retry from the backend.
  }
}

function gateIcon(status: string) {
  return status === 'passed' ? 'fa-circle-check' : status === 'failed' ? 'fa-circle-xmark' : 'fa-circle-question'
}
function gateTone(status: string) {
  return status === 'passed' ? 'success' as const : status === 'failed' ? 'danger' as const : 'neutral' as const
}
</script>

<template>
  <div v-if="analysis && evidence && result" class="result-evidence-page">
    <section class="evidence-intro" aria-labelledby="evidence-title">
      <header>
        <h2 id="evidence-title">证据与来源</h2>
        <p>仅展示可校验、可审计的材料。</p>
      </header>
    </section>

    <section class="evidence-panel" aria-labelledby="hash-title">
      <header><h2 id="hash-title">哈希链</h2><p>逐项核对 manifest 摘要。</p></header>
      <ul class="hash-chain">
        <li v-for="row in evidence.hashChain" :key="row.label">
          <CpStatusBadge :tone="row.verified ? 'evidence' : 'danger'" :icon="row.verified ? 'fa-circle-check' : 'fa-triangle-exclamation'">
            {{ row.verified ? '已核对' : '未通过' }}
          </CpStatusBadge>
          <div><strong>{{ row.label }}</strong><code>{{ row.value }}</code></div>
        </li>
      </ul>
      <p v-if="!evidence.hashChain.length" class="panel-empty">当前结果未发布可校验的哈希链。</p>
    </section>

    <section class="evidence-panel" aria-labelledby="provenance-title">
      <header><h2 id="provenance-title">来源与执行记录</h2></header>
      <dl class="provenance-table">
        <div v-for="row in evidence.provenanceRows" :key="row.key"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
      </dl>
    </section>

    <section class="evidence-panel" aria-labelledby="gate-title">
      <header><h2 id="gate-title">发布门禁</h2></header>
      <ul class="gate-list">
        <li v-for="gate in evidence.gates" :key="gate.id" class="gate-row">
          <CpStatusBadge :tone="gateTone(gate.status)" :icon="gateIcon(gate.status)">{{ gate.status === 'passed' ? '通过' : gate.status === 'failed' ? '未通过' : '未知' }}</CpStatusBadge>
          <div>
            <strong>{{ gate.label }}</strong>
            <p>{{ gate.reason }}</p>
            <RouterLink v-if="gate.evidenceRef" :to="gate.evidenceRef.route" class="evidence-link">{{ gate.evidenceRef.label }}</RouterLink>
          </div>
        </li>
      </ul>
    </section>

    <section class="evidence-panel" aria-labelledby="report-title">
      <header><h2 id="report-title">正式报告</h2><p>通过服务端发布门禁导出。</p></header>
      <div class="report-actions">
        <button
          v-if="evidence.report.available && result.runId"
          type="button"
          @click="downloadReport('json')"
        >下载 JSON 报告</button>
        <button
          v-if="evidence.report.available && result.runId"
          type="button"
          @click="downloadReport('html')"
        >下载 HTML 报告</button>
        <p v-if="!evidence.report.available" class="report-reason">{{ evidence.report.reason }}</p>
      </div>
    </section>

    <VerificationDetails :source="result.source" />
  </div>
</template>

<style scoped>
.result-evidence-page { display:grid; gap:var(--cp-space-4); }
.evidence-intro, .evidence-panel { border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.evidence-intro > header { padding:var(--cp-space-3) var(--cp-space-4); }
.evidence-intro h2, .evidence-panel h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-lg); }
.evidence-intro p, .evidence-panel > header p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.evidence-panel > header { padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.hash-chain { margin:0; padding:0; list-style:none; }
.hash-chain li { display:flex; align-items:center; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-top:1px solid var(--cp-border-subtle); }
.hash-chain div { min-width:0; }
.hash-chain strong { display:block; font-size:var(--cp-text-sm); }
.hash-chain code { padding:var(--cp-space-1) var(--cp-space-2); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); color:var(--cp-text-secondary); font-family:var(--cp-font-mono); font-size:var(--cp-text-xs); }
.provenance-table { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:0; }
.provenance-table div { min-width:0; padding:var(--cp-space-3) var(--cp-space-4); border-right:1px solid var(--cp-border-subtle); border-bottom:1px solid var(--cp-border-subtle); }
.provenance-table dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.provenance-table dd { margin:var(--cp-space-1) 0 0; overflow-wrap:anywhere; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; }
.gate-list { margin:0; padding:0; list-style:none; }
.gate-row { display:flex; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-top:1px solid var(--cp-border-subtle); }
.gate-row div { min-width:0; }
.gate-row strong { display:block; font-size:var(--cp-text-sm); }
.gate-row p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.5; }
.evidence-link { color:var(--cp-evidence-text); font-size:var(--cp-text-xs); font-weight:700; text-decoration:none; }
.report-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); padding:var(--cp-space-4); }
.report-actions button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-weight:650; }
.report-actions button:hover { background:var(--cp-surface-subtle); }
.report-reason { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.panel-empty { margin:0; padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
@media (max-width:1023px) { .provenance-table { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:479px) { .provenance-table { grid-template-columns:1fr; } .provenance-table div { border-right:0; } .report-actions button { min-height:var(--cp-touch-target); } }
</style>
