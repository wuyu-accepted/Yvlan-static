<script setup lang="ts">
import { computed } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { RunSummary, WorkbenchAccess } from './workbenchViewModel.ts'
import { runStateLabel } from './workbenchViewModel.ts'
import { EXECUTION_MODE_LABELS } from './workbenchCapabilities.ts'
import type { ApiProblem } from '../contracts/api.ts'

const props = defineProps<{
  projectId: string
  access: WorkbenchAccess
  runs: RunSummary[] | null
  loading: boolean
  error: ApiProblem | null
  selectedRunId?: string
  statusFilter: string
}>()

const emit = defineEmits<{
  selectRun: [runId: string]
  filter: [status: string]
  refresh: []
  createPlan: []
}>()

function runStateTone(label: string): 'info' | 'success' | 'warning' | 'neutral' {
  if (label === '已完成') return 'success'
  if (label === '失败' || label === '已取消') return 'warning'
  if (label === '尚未入队') return 'neutral'
  return 'info'
}

const STATUS_FILTERS = [
  { code: '', label: '全部' },
  { code: 'draft', label: '计划' },
  { code: 'queued', label: '排队' },
  { code: 'running', label: '执行中' },
  { code: 'succeeded', label: '已完成' },
  { code: 'failed', label: '失败' },
  { code: 'cancelled', label: '已取消' },
]

const filteredRuns = computed(() => {
  const runs = props.runs ?? []
  if (!props.statusFilter) return runs
  return runs.filter((run) => {
    const effective = run.effective_runtime_status || run.plan_status || run.status
    if (props.statusFilter === 'running') return ['queued', 'leased', 'running', 'cancel_requested'].includes(effective)
    return effective === props.statusFilter
  })
})
</script>

<template>
  <section class="runs-panel" aria-labelledby="runs-title">
    <header class="panel-head">
      <div>
        <h2 id="runs-title">运行队列与记录</h2>
      </div>
      <div class="head-actions">
        <button type="button" class="refresh" :disabled="loading" @click="emit('refresh')">刷新</button>
        <button type="button" class="primary" :disabled="access !== 'interactive'" @click="emit('createPlan')">生成运行计划</button>
      </div>
    </header>

    <p v-if="access === 'unavailable' || access === 'readonly'" class="readonly-note">
      当前为{{ access === 'unavailable' ? '只读（后端不可用）' : '只读' }}状态：入队/取消等写操作已禁用。
    </p>

    <div class="filter-bar" role="group" aria-label="运行状态筛选">
      <button
        v-for="filter in STATUS_FILTERS"
        :key="filter.code"
        type="button"
        class="filter-chip"
        :class="{ active: statusFilter === filter.code }"
        :aria-pressed="statusFilter === filter.code"
        @click="emit('filter', filter.code)"
      >{{ filter.label }}</button>
    </div>

    <div v-if="loading" class="loading">正在加载运行…</div>
    <div v-else-if="error" class="inline-error" role="alert">
      {{ error.summary }}：{{ error.detail }}
      <button type="button" @click="emit('refresh')">重试</button>
    </div>
    <table v-else-if="filteredRuns.length" class="runs-table" aria-label="项目运行列表">
      <thead>
        <tr><th>运行</th><th>执行模式</th><th>状态</th><th>Token 预算</th><th>创建时间</th></tr>
      </thead>
      <tbody>
        <tr
          v-for="run in filteredRuns"
          :key="run.run_id"
          :class="{ selected: run.run_id === selectedRunId }"
        >
          <td>
            <button type="button" class="run-link" @click="emit('selectRun', run.run_id)">
              <code>{{ run.run_id.slice(0, 12) }}…</code>
            </button>
            <small v-if="run.result_sha256" class="result-hash">结果 {{ run.result_sha256.slice(0, 10) }}…</small>
          </td>
          <td>{{ EXECUTION_MODE_LABELS[run.execution_mode] || run.execution_mode }}</td>
          <td><CpStatusBadge :tone="runStateTone(runStateLabel(run.effective_runtime_status || run.plan_status || run.status))">{{ runStateLabel(run.effective_runtime_status || run.plan_status || run.status) }}</CpStatusBadge></td>
          <td>{{ run.token_budget === null ? '—' : run.token_budget.toLocaleString('zh-CN') }}</td>
          <td>{{ run.created_at || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="panel-empty">
      {{ access === 'unavailable' ? '后端不可用：运行记录未知。' : '该项目还没有运行。请先生成运行计划。' }}
    </div>
  </section>
</template>


<style scoped>
.runs-panel { display:grid; gap:var(--cp-space-4); }
.panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.panel-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.panel-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.head-actions { display:flex; gap:var(--cp-space-2); }
.refresh, .primary { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.refresh { background:var(--cp-surface-default); color:var(--cp-text-primary); }
.primary { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-surface-default); }
.primary:hover { background:var(--cp-action-primary-hover); }
.primary:disabled { opacity:.5; cursor:not-allowed; }
.readonly-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.filter-bar { display:flex; flex-wrap:wrap; gap:var(--cp-space-1); }
.filter-chip { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.filter-chip.active { border-color:var(--cp-action-primary); background:var(--cp-surface-selected); color:var(--cp-action-primary); }
.loading { padding:var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.inline-error { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.runs-table { width:100%; border-collapse:collapse; }
.runs-table th, .runs-table td { padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-subtle); text-align:left; vertical-align:top; }
.runs-table th { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; }
.runs-table td { font-size:var(--cp-text-sm); }
.runs-table tr.selected td { background:var(--cp-surface-selected); }
.run-link { border:0; padding:0; background:none; color:var(--cp-action-primary); font-family:var(--cp-font-mono); font-size:var(--cp-text-sm); cursor:pointer; text-decoration:underline; }
.result-hash { display:block; color:var(--cp-evidence-text); font-size:var(--cp-text-xs); }
.panel-empty { padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
@media (max-width:767px) { .runs-table { display:block; overflow-x:auto; } .head-actions { flex-wrap:wrap; } }
</style>
