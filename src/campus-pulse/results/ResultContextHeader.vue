<script setup lang="ts">
import { computed } from 'vue'
import type { ResultAnalysisVM } from './resultsAnalysis.ts'
import type { ResultViewModel } from '../domain/viewModels.ts'

const props = defineProps<{ analysis: ResultAnalysisVM }>()
const result: ResultViewModel = props.analysis.result
const identity = computed(() => ({
  key: result.key,
  runId: result.runId,
  scenario: result.scope.scenarioLabel,
  window: result.scope.tickIds.length ? `Tick ${result.scope.tickIds[0]}–${result.scope.tickIds.at(-1)}` : '未发布时间步',
  scope: `${result.scope.seedCount || '未声明'} 个种子 · ${result.scope.population || '未声明'} 个合成 LLM Agent`,
}))

async function copyPermalink() {
  const url = window.location.href
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // Clipboard can be denied; keep the action harmless.
  }
}

function forumHref() {
  const query: Record<string, string> = { source: result.source.key, result: result.key }
  if (result.source.key === 'live-api' && result.runId) query.run_id = result.runId
  return { name: 'campus-pulse-forum', query }
}
</script>

<template>
  <header class="result-context-header">
    <div class="result-context-header__identity">
      <h1>{{ identity.scenario }}</h1>
      <dl>
        <div><dt>结果</dt><dd><code>{{ identity.key }}</code></dd></div>
        <div v-if="identity.runId"><dt>Run</dt><dd><code>{{ identity.runId }}</code></dd></div>
        <div><dt>观察窗口</dt><dd>{{ identity.window }}</dd></div>
        <div><dt>范围</dt><dd>{{ identity.scope }}</dd></div>
      </dl>
    </div>
    <div class="result-context-header__actions">
      <RouterLink class="action" :to="{ name: 'campus-pulse-results' }">返回结果列表</RouterLink>
      <RouterLink class="action" :to="forumHref()">调查论坛</RouterLink>
      <button type="button" class="action" @click="copyPermalink">复制链接</button>
    </div>
  </header>
</template>

<style scoped>
.result-context-header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-4); padding:var(--cp-space-4) var(--cp-content-gutter); border-bottom:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.result-context-header h1 { margin:0; font-size:var(--cp-text-xl); line-height:var(--cp-leading-tight); }
.result-context-header dl { display:flex; flex-wrap:wrap; gap:var(--cp-space-1) var(--cp-space-4); margin:var(--cp-space-2) 0 0; }
.result-context-header dl div { min-width:0; }
.result-context-header dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.result-context-header dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-xs); font-weight:650; }
.result-context-header dd code { font-family:var(--cp-font-mono); }
.result-context-header__actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:var(--cp-space-2); }
.result-context-header .action { display:inline-flex; min-height:var(--cp-control-height); align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; text-decoration:none; }
.result-context-header .action:hover { background:var(--cp-surface-subtle); }
@media (max-width:1023px) { .result-context-header { flex-direction:column; } .result-context-header__actions { justify-content:flex-start; } }
@media (max-width:767px) { .result-context-header { padding:var(--cp-space-4); } .result-context-header .action { min-height:var(--cp-touch-target); } }
</style>
