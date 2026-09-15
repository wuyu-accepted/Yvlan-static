<script setup lang="ts">
import { computed } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import AgentWorldPanel from './AgentWorldPanel.vue'
import type { EvidenceBindingVM, SensingStateVM } from './workbenchViewModel.ts'
import type { WorkbenchAccess } from './workbenchViewModel.ts'
import type { ApiProblem } from '../contracts/api.ts'

const props = defineProps<{
  projectId: string
  access: WorkbenchAccess
  evidence: EvidenceBindingVM[] | null
  evidenceLoading: boolean
  evidenceError: ApiProblem | null
  sensingSnapshots: Array<{ snapshot_id: string; title?: string; manifest_sha256?: string }> | null
  sensingState: SensingStateVM | null
  sensingLoading: boolean
  sensingError: ApiProblem | null
  activating: boolean
  attachError: ApiProblem | null
}>()

const emit = defineEmits<{
  attachEvidence: [snapshotId: string]
  activateSensing: [snapshotId: string]
  refresh: []
  openEvidence: [snapshotId: string]
  openPlan: []
}>()

const activeSensingAvailable = computed(() => (
  (props.sensingSnapshots ?? []).filter((snap) => snap.snapshot_id !== props.sensingState?.activeSnapshotId).length > 0
))

function snapshotTitle(value: string | undefined, fallback: string): string {
  if (!value || /[a-f0-9]{12,}|sha256|snapshot[_:-]|^\w+_\w+$/i.test(value)) return fallback
  return value
}
</script>

<template>
  <section class="evidence-panel" aria-labelledby="evidence-title">
    <AgentWorldPanel :project-id="projectId" @open-plan="emit('openPlan')" />

    <header class="panel-head">
      <div>
        <h2 id="evidence-title">证据绑定与感知基线</h2>
      </div>
      <button type="button" class="refresh" :disabled="evidenceLoading" @click="emit('refresh')">刷新</button>
    </header>

    <div v-if="attachError" class="inline-error" role="alert">
      {{ attachError.summary }}：{{ attachError.detail }}
      <button type="button" @click="emit('refresh')">重新加载</button>
    </div>

    <section aria-labelledby="evidence-bindings-title">
      <h3 id="evidence-bindings-title">证据绑定</h3>
      <div v-if="evidenceLoading" class="loading">正在加载证据绑定…</div>
      <div v-else-if="evidenceError" class="inline-error" role="alert">
        {{ evidenceError.summary }}：{{ evidenceError.detail }}
        <button type="button" @click="emit('refresh')">重试</button>
      </div>
      <table v-else-if="evidence && evidence.length" class="bindings" aria-label="项目证据绑定">
        <thead>
          <tr><th>快照</th><th>角色</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="binding in evidence ?? []" :key="binding.snapshotId">
            <td>
              <strong>{{ snapshotTitle(binding.title, '论坛证据快照') }}</strong>
            </td>
            <td><CpStatusBadge v-if="binding.primary" tone="evidence">主证据</CpStatusBadge><span v-else class="muted">绑定</span></td>
            <td><button type="button" class="row-action" @click="emit('openEvidence', binding.snapshotId)">查看证据</button></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="panel-empty">
        {{ access === 'unavailable' ? '后端不可用：证据绑定状态未知。' : '尚未绑定证据快照。' }}
      </div>
    </section>

    <section aria-labelledby="sensing-title">
      <h3 id="sensing-title">感知基线</h3>
      <div v-if="sensingLoading" class="loading">正在加载感知状态…</div>
      <div v-else-if="sensingError" class="inline-error" role="alert">
        {{ sensingError.summary }}：{{ sensingError.detail }}
        <button type="button" @click="emit('refresh')">重试</button>
      </div>
      <template v-else>
        <dl class="sensing-state">
          <div><dt>当前状态</dt><dd>{{ sensingState?.status || '未知' }}</dd></div>
          <div><dt>激活快照</dt><dd>{{ sensingState?.activeSnapshotId ? snapshotTitle(sensingState?.activeSnapshotTitle, '当前感知基线') : '未激活' }}</dd></div>
        </dl>
        <div v-if="sensingSnapshots && sensingSnapshots.length" class="sensing-list">
          <div v-for="snap in sensingSnapshots" :key="snap.snapshot_id" class="sensing-row">
            <span class="sensing-copy">
              <strong>{{ snapshotTitle(snap.title, '论坛感知快照') }}</strong>
            </span>
            <button
              v-if="snap.snapshot_id !== sensingState?.activeSnapshotId"
              type="button"
              class="row-action"
              :disabled="activating || access === 'unavailable' || access === 'readonly'"
              @click="emit('activateSensing', snap.snapshot_id)"
            >
              {{ activating ? '激活中…' : '设为激活' }}
            </button>
            <CpStatusBadge v-else tone="success">已激活</CpStatusBadge>
          </div>
        </div>
        <p v-else class="muted">暂无可用感知快照。{{ access === 'unavailable' ? '（后端不可用，状态未知。）' : '' }}</p>
        <p v-if="access === 'unavailable' || access === 'readonly'" class="readonly-note">
          当前为{{ access === 'unavailable' ? '只读（后端不可用）' : '只读' }}状态：绑定与激活已禁用，不写入本地数据。
        </p>
      </template>
    </section>
  </section>
</template>

<style scoped>
.evidence-panel { display:grid; gap:var(--cp-space-4); }
.panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.panel-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.panel-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.refresh { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
section > h3 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-md); }
.bindings { width:100%; border-collapse:collapse; }
.bindings th, .bindings td { padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-subtle); text-align:left; vertical-align:top; }
.bindings th { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; }
.bindings td { font-size:var(--cp-text-sm); }
.bindings td small, .sensing-row small { display:block; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.muted { color:var(--cp-text-muted); }
.row-action { border:0; padding:0; background:none; color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:650; text-decoration:underline; cursor:pointer; }
.row-action:disabled { opacity:.5; cursor:not-allowed; }
.loading { padding:var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.inline-error { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.panel-empty { padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.sensing-state { display:flex; flex-wrap:wrap; gap:var(--cp-space-1) var(--cp-space-4); margin:0 0 var(--cp-space-3); padding:var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.sensing-state dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.sensing-state dd { margin:0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; }
.sensing-list { display:grid; gap:var(--cp-space-2); }
.sensing-row { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); }
.sensing-copy { min-width:0; }
.readonly-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
</style>
