<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { PolicySummary } from './workbenchViewModel.ts'
import type { WorkbenchAccess } from './workbenchViewModel.ts'
import type { ApiProblem } from '../contracts/api.ts'
import { fieldErrorsFromProblem } from './workbenchViewModel.ts'

const props = defineProps<{
  projectId: string
  access: WorkbenchAccess
  policies: PolicySummary[] | null
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

const form = reactive({
  name: '',
  description: '',
  is_baseline: false,
  evaluation_level: 'model_conditional',
  actions: [] as Array<{ action_id: string; label: string; commitment: string }>,
})

const localErrors = ref<Record<string, string[]>>({})
const showForm = ref(false)

const serverFieldErrors = computed(() => fieldErrorsFromProblem(props.submitError))

function fieldError(field: string): string {
  return (serverFieldErrors.value[field] ?? localErrors.value[field] ?? [])[0] || ''
}

function addAction() {
  if (form.actions.length >= 12) return
  form.actions.push({ action_id: '', label: '', commitment: '' })
}

function removeAction(index: number) {
  form.actions.splice(index, 1)
}

function validate(): boolean {
  const errors: Record<string, string[]> = {}
  if (!form.name.trim()) errors.name = ['方案名称不能为空']
  else if (form.name.trim().length > 120) errors.name = ['方案名称不能超过 120 个字符']
  if (!form.description.trim()) errors.description = ['方案描述不能为空']
  else if (form.description.trim().length > 1000) errors.description = ['方案描述不能超过 1000 个字符']
  const badAction = form.actions.find((action) => (
    !/^[a-z][a-z0-9_]{2,39}$/.test(action.action_id.trim())
    || !action.label.trim()
    || !action.commitment.trim()
  ))
  if (badAction) errors.actions = ['每个治理动作都需要 action_id（小写字母/数字/下划线，3–40 字符）、标签与承诺']
  localErrors.value = errors
  return Object.keys(errors).length === 0
}

function submit() {
  if (!validate()) return
  emit('create', {
    name: form.name.trim(),
    description: form.description.trim(),
    is_baseline: form.is_baseline,
    evaluation_level: form.evaluation_level,
    actions: form.actions.map((action) => ({
      action_id: action.action_id.trim(),
      label: action.label.trim(),
      commitment: action.commitment.trim(),
    })),
  })
}
</script>

<template>
  <section class="policy-panel" aria-labelledby="policy-title">
    <header class="panel-head">
      <div>
        <h2 id="policy-title">政策方案</h2>
      </div>
      <div class="head-actions">
        <button type="button" class="refresh" :disabled="loading" @click="emit('refresh')">刷新</button>
        <button
          type="button"
          class="primary"
          :disabled="access === 'unavailable' || access === 'readonly'"
          @click="showForm = !showForm"
        >
          {{ showForm ? '收起表单' : '新建方案' }}
        </button>
      </div>
    </header>

    <p v-if="access === 'unavailable' || access === 'readonly'" class="readonly-note">
      当前为{{ access === 'unavailable' ? '只读（后端不可用）' : '只读' }}状态：方案创建已禁用。
    </p>

    <form v-if="showForm" class="create-form" novalidate @submit.prevent="submit">
      <h3>创建政策方案</h3>
      <p v-if="submitSuccess" class="inline-success" role="status">{{ submitSuccess }}</p>
      <div v-if="submitError" class="inline-error" role="alert">
        {{ submitError.summary }}：{{ submitError.detail }}
      </div>

      <label class="field">
        <span>方案名称 <em aria-hidden="true">*</em></span>
        <input v-model="form.name" type="text" name="name" maxlength="120" :aria-invalid="Boolean(fieldError('name'))" />
        <span v-if="fieldError('name')" class="field-error" role="alert">{{ fieldError('name') }}</span>
      </label>

      <label class="field">
        <span>描述 <em aria-hidden="true">*</em></span>
        <textarea v-model="form.description" name="description" rows="2" maxlength="1000" :aria-invalid="Boolean(fieldError('description'))" />
        <span v-if="fieldError('description')" class="field-error" role="alert">{{ fieldError('description') }}</span>
      </label>

      <div class="field--choice">
        <label class="choice">
          <input v-model="form.is_baseline" type="checkbox" name="is_baseline" />
          <span>作为基线方案</span>
        </label>
        <label class="field">
          <span>评估等级</span>
          <select v-model="form.evaluation_level" name="evaluation_level">
            <option value="model_conditional">模型条件评估</option>
            <option value="empirical_candidate">实证候选</option>
          </select>
        </label>
      </div>

      <fieldset class="actions" aria-label="治理动作">
        <legend>治理动作（可选，最多 12 个）</legend>
        <div v-for="(action, index) in form.actions" :key="index" class="action-row">
          <input v-model="action.action_id" :name="'actions.' + index + '.action_id'" placeholder="action_id" aria-label="动作标识" />
          <input v-model="action.label" :name="'actions.' + index + '.label'" placeholder="标签" aria-label="动作标签" />
          <input v-model="action.commitment" :name="'actions.' + index + '.commitment'" placeholder="承诺" aria-label="动作承诺" />
          <button type="button" class="remove" aria-label="删除该动作" @click="removeAction(index)">×</button>
        </div>
        <span v-if="fieldError('actions')" class="field-error" role="alert">{{ fieldError('actions') }}</span>
        <button type="button" class="add-action" :disabled="form.actions.length >= 12" @click="addAction">+ 添加动作</button>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="primary" :disabled="submitting">{{ submitting ? '创建中…' : '创建方案' }}</button>
      </div>
    </form>

    <div v-if="loading" class="loading">正在加载方案…</div>
    <div v-else-if="error" class="inline-error" role="alert">
      {{ error.summary }}：{{ error.detail }}
      <button type="button" @click="emit('refresh')">重试</button>
    </div>
    <table v-else-if="policies && policies.length" class="policy-table" aria-label="项目政策方案列表">
      <thead><tr><th>方案</th><th>模板</th><th>动作数</th><th>评估等级</th></tr></thead>
      <tbody>
        <tr v-for="policy in policies ?? []" :key="policy.policy_id">
          <td>
            <strong>{{ policy.name }}</strong>
            <CpStatusBadge v-if="policy.is_baseline" tone="info">基线</CpStatusBadge>
            <small><code>{{ policy.policy_id }}</code></small>
          </td>
          <td>{{ policy.template_key || '—' }}</td>
          <td>{{ policy.action_count }}</td>
          <td>{{ policy.evaluation_level === 'empirical_candidate' ? '实证候选' : '模型条件' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="panel-empty">
      {{ access === 'unavailable' ? '后端不可用：方案状态未知。' : '尚未创建政策方案。' }}
    </div>
  </section>
</template>

<style scoped>
.policy-panel { display:grid; gap:var(--cp-space-4); }
.panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.panel-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.panel-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.head-actions { display:flex; gap:var(--cp-space-2); }
.refresh, .primary, .add-action { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.refresh { background:var(--cp-surface-default); color:var(--cp-text-primary); }
.primary { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-surface-default); }
.primary:hover { background:var(--cp-action-primary-hover); }
.primary:disabled, .add-action:disabled { opacity:.5; cursor:not-allowed; }
.readonly-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.create-form { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.create-form h3 { margin:0; font-size:var(--cp-text-md); }
.field { display:grid; gap:var(--cp-space-1); }
.field > span { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.field em { color:var(--cp-danger); font-style:normal; }
.field input, .field textarea, .field select { min-height:var(--cp-control-height); padding:var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.field-error { color:var(--cp-danger); font-size:var(--cp-text-xs); }
.inline-error, .inline-success { margin:0; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.inline-success { border-color:var(--cp-success); background:var(--cp-success-surface); color:var(--cp-success); }
.field--choice { display:grid; gap:var(--cp-space-2); }
.choice { display:flex; align-items:center; gap:var(--cp-space-2); font-size:var(--cp-text-sm); }
.actions { margin:0; padding:0; border:0; display:grid; gap:var(--cp-space-2); }
.actions legend { padding:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.action-row { display:grid; grid-template-columns:1fr 1fr 1.4fr auto; gap:var(--cp-space-2); }
.action-row input { min-height:var(--cp-control-height); padding:var(--cp-space-1) var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); }
.remove { width:var(--cp-control-height); height:var(--cp-control-height); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-secondary); cursor:pointer; }
.form-actions { display:flex; justify-content:flex-end; }
.loading { padding:var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.policy-table { width:100%; border-collapse:collapse; }
.policy-table th, .policy-table td { padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-subtle); text-align:left; }
.policy-table th { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; }
.policy-table td { font-size:var(--cp-text-sm); }
.policy-table td small { display:block; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.policy-table td .cp-badge { margin-left:var(--cp-space-2); }
.panel-empty { padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
@media (max-width:767px) { .action-row { grid-template-columns:1fr; } .head-actions { flex-wrap:wrap; } }
</style>
