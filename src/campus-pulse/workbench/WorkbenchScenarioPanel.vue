<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { ScenarioSummary } from './workbenchViewModel.ts'
import type { WorkbenchAccess } from './workbenchViewModel.ts'
import type { ApiProblem } from '../contracts/api.ts'
import { fieldErrorsFromProblem } from './workbenchViewModel.ts'

const props = defineProps<{
  projectId: string
  access: WorkbenchAccess
  scenarios: ScenarioSummary[] | null
  loading: boolean
  error: ApiProblem | null
  submitting: boolean
  submitError: ApiProblem | null
  submitSuccess: string
}>()

const emit = defineEmits<{
  create: [payload: Record<string, unknown>]
  refresh: []
}>()

const PHASE_DEFAULTS = [
  { phase_id: 'baseline', label: '基线期', window: '事件前基线窗口' },
  { phase_id: 'burst', label: '事件爆发', window: '事件爆发窗口' },
  { phase_id: 'spread', label: '讨论扩散', window: '讨论扩散窗口' },
  { phase_id: 'decay', label: '回落沉淀', window: '回落后窗口' },
]

const form = reactive({
  name: '',
  description: '',
  shock_origin: 'external_event',
  analysis_id: '',
  claim_boundary: '',
  phases: PHASE_DEFAULTS.map((phase) => ({ ...phase })),
})

const localErrors = ref<Record<string, string[]>>({})
const showForm = ref(false)

const serverFieldErrors = computed(() => fieldErrorsFromProblem(props.submitError))

function fieldError(field: string): string {
  return (serverFieldErrors.value[field] ?? localErrors.value[field] ?? [])[0] || ''
}

function validate(): boolean {
  const errors: Record<string, string[]> = {}
  if (!form.name.trim()) errors.name = ['场景名称不能为空']
  else if (form.name.trim().length > 140) errors.name = ['场景名称不能超过 140 个字符']
  if (!form.description.trim()) errors.description = ['场景描述不能为空']
  else if (form.description.trim().length > 1000) errors.description = ['场景描述不能超过 1000 个字符']
  if (!/^[0-9a-f]{64}$/.test(form.analysis_id.trim())) {
    errors.analysis_id = ['分析工件 ID 必须是 64 位十六进制（analysis_id）']
  }
  if (!form.claim_boundary.trim()) errors.claim_boundary = ['声明边界不能为空']
  else if (form.claim_boundary.trim().length > 1000) errors.claim_boundary = ['声明边界不能超过 1000 个字符']
  const missingPhase = form.phases.find((phase) => !phase.label.trim() || !phase.window.trim())
  if (missingPhase) errors.phases = ['四个阶段（baseline/burst/spread/decay）的标签与窗口都不能为空']
  const ids = form.phases.map((phase) => phase.phase_id)
  if (ids.join(',') !== 'baseline,burst,spread,decay') errors.phases = ['阶段必须严格为 baseline → burst → spread → decay']
  localErrors.value = errors
  return Object.keys(errors).length === 0
}

function submit() {
  if (!validate()) return
  emit('create', {
    name: form.name.trim(),
    description: form.description.trim(),
    shock_origin: form.shock_origin,
    analysis_id: form.analysis_id.trim(),
    claim_boundary: form.claim_boundary.trim(),
    phases: form.phases.map((phase) => ({ phase_id: phase.phase_id, label: phase.label.trim(), window: phase.window.trim() })),
  })
}
</script>

<template>
  <section class="scenario-panel" aria-labelledby="scenario-title">
    <header class="panel-head">
      <div>
        <h2 id="scenario-title">冻结情景</h2>
      </div>
      <div class="head-actions">
        <button type="button" class="refresh" :disabled="loading" @click="emit('refresh')">刷新</button>
        <button
          type="button"
          class="primary"
          :disabled="access === 'unavailable' || access === 'readonly'"
          @click="showForm = !showForm"
        >
          {{ showForm ? '收起表单' : '新建场景' }}
        </button>
      </div>
    </header>

    <p v-if="access === 'unavailable' || access === 'readonly'" class="readonly-note">
      当前为{{ access === 'unavailable' ? '只读（后端不可用）' : '只读' }}状态：场景创建已禁用。
    </p>

    <form v-if="showForm" class="create-form" novalidate @submit.prevent="submit">
      <h3>创建严格四阶段场景</h3>
      <p v-if="submitSuccess" class="inline-success" role="status">{{ submitSuccess }}</p>
      <div v-if="submitError" class="inline-error" role="alert">
        {{ submitError.summary }}：{{ submitError.detail }}
      </div>

      <label class="field">
        <span>场景名称 <em aria-hidden="true">*</em></span>
        <input v-model="form.name" type="text" name="name" maxlength="140" :aria-invalid="Boolean(fieldError('name'))" />
        <span v-if="fieldError('name')" class="field-error" role="alert">{{ fieldError('name') }}</span>
      </label>

      <label class="field">
        <span>描述 <em aria-hidden="true">*</em></span>
        <textarea v-model="form.description" name="description" rows="2" maxlength="1000" :aria-invalid="Boolean(fieldError('description'))" />
        <span v-if="fieldError('description')" class="field-error" role="alert">{{ fieldError('description') }}</span>
      </label>

      <label class="field">
        <span>冲击来源 <em aria-hidden="true">*</em></span>
        <select v-model="form.shock_origin" name="shock_origin">
          <option value="governance_action">治理动作</option>
          <option value="external_event">外部事件</option>
          <option value="synthetic_stress">合成压力</option>
        </select>
      </label>

      <label class="field">
        <span>分析工件 ID（analysis_id）<em aria-hidden="true">*</em></span>
        <input v-model="form.analysis_id" type="text" name="analysis_id" placeholder="64 位十六进制" :aria-invalid="Boolean(fieldError('analysis_id'))" />
        <span class="field-hint">必须引用已登记的分析工件，其父来源快照需已附加到本项目；服务端为最终校验者。</span>
        <span v-if="fieldError('analysis_id')" class="field-error" role="alert">{{ fieldError('analysis_id') }}</span>
      </label>

      <fieldset class="phases" aria-label="四阶段">
        <legend>阶段（严格 baseline → burst → spread → decay）<em aria-hidden="true">*</em></legend>
        <div v-for="(phase, index) in form.phases" :key="phase.phase_id" class="phase-row">
          <span class="phase-id"><code>{{ phase.phase_id }}</code></span>
          <input v-model="phase.label" :name="'phases.' + phase.phase_id + '.label'" maxlength="40" aria-label="阶段标签" />
          <input v-model="phase.window" :name="'phases.' + phase.phase_id + '.window'" maxlength="80" aria-label="阶段窗口" />
        </div>
        <span v-if="fieldError('phases')" class="field-error" role="alert">{{ fieldError('phases') }}</span>
      </fieldset>

      <label class="field">
        <span>声明边界（claim boundary）<em aria-hidden="true">*</em></span>
        <textarea v-model="form.claim_boundary" name="claim_boundary" rows="2" maxlength="1000" :aria-invalid="Boolean(fieldError('claim_boundary'))" />
        <span v-if="fieldError('claim_boundary')" class="field-error" role="alert">{{ fieldError('claim_boundary') }}</span>
      </label>

      <div class="form-actions">
        <button type="submit" class="primary" :disabled="submitting">{{ submitting ? '创建中…' : '创建场景' }}</button>
      </div>
    </form>

    <div v-if="loading" class="loading">正在加载场景…</div>
    <div v-else-if="error" class="inline-error" role="alert">
      {{ error.summary }}：{{ error.detail }}
      <button type="button" @click="emit('refresh')">重试</button>
    </div>
    <table v-else-if="scenarios && scenarios.length" class="scenario-table" aria-label="项目场景列表">
      <thead><tr><th>场景</th><th>模板</th><th>证据状态</th></tr></thead>
      <tbody>
        <tr v-for="scenario in scenarios ?? []" :key="scenario.scenario_id">
          <td><strong>{{ scenario.name }}</strong><small><code>{{ scenario.scenario_id }}</code></small></td>
          <td>{{ scenario.template_key || '—' }}</td>
          <td><CpStatusBadge :tone="scenario.evidence_binding_status === 'sealed' ? 'evidence' : 'warning'">
            {{ scenario.evidence_binding_status === 'sealed' ? '证据已封存' : (scenario.evidence_binding_status || '未封存') }}
          </CpStatusBadge></td>
        </tr>
      </tbody>
    </table>
    <div v-else class="panel-empty">
      {{ access === 'unavailable' ? '后端不可用：场景状态未知。' : '尚未创建场景。' }}
    </div>
  </section>
</template>

<style scoped>
.scenario-panel { display:grid; gap:var(--cp-space-4); }
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
.create-form { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.create-form h3 { margin:0; font-size:var(--cp-text-md); }
.field { display:grid; gap:var(--cp-space-1); }
.field > span { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.field em, .phases legend em { color:var(--cp-danger); font-style:normal; }
.field input, .field textarea, .field select { min-height:var(--cp-control-height); padding:var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.field-hint { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.field-error { color:var(--cp-danger); font-size:var(--cp-text-xs); }
.inline-error, .inline-success { margin:0; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.inline-success { border-color:var(--cp-success); background:var(--cp-success-surface); color:var(--cp-success); }
.phases { margin:0; padding:0; border:0; display:grid; gap:var(--cp-space-2); }
.phases legend { padding:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.phase-row { display:grid; grid-template-columns:7rem minmax(0,1fr) minmax(0,1fr); gap:var(--cp-space-2); }
.phase-id code { font-size:var(--cp-text-xs); }
.phase-row input { min-height:var(--cp-control-height); padding:var(--cp-space-1) var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); }
.form-actions { display:flex; justify-content:flex-end; }
.loading { padding:var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.scenario-table { width:100%; border-collapse:collapse; }
.scenario-table th, .scenario-table td { padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-subtle); text-align:left; }
.scenario-table th { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; }
.scenario-table td { font-size:var(--cp-text-sm); }
.scenario-table td small { display:block; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.panel-empty { padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
@media (max-width:767px) { .phase-row { grid-template-columns:1fr; } .head-actions { flex-wrap:wrap; } }
</style>
