<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { PROJECT_EVALUATION_MODES } from './workbenchCapabilities.ts'
import { currentLocale } from '../i18n/locale.ts'

const props = defineProps<{
  open: boolean
  submitting: boolean
  existingNames: string[]
  existingCenturyGymProjectId?: string
  fieldErrors: Record<string, string[]>
  serverError: string
}>()

const emit = defineEmits<{
  submit: [payload: {
    name: string
    governance_domain: string
    objective: string
    evaluation_mode: string
    bootstrap_mode: 'century_gym' | 'none'
    existing_project_id?: string
  }]
  cancel: []
}>()

const form = reactive({
  setup_mode: 'century_gym' as 'century_gym' | 'custom',
  name: '',
  governance_domain: '',
  objective: '',
  evaluation_mode: 'simulation_stress_test',
})

const CENTURY_GYM_PRESET = Object.freeze({
  name: '世纪馆“幽灵预约”治理预演',
  governance_domain: '校园体育场地预约与公共服务治理',
  objective: '比较论坛自然演化与“预约证据卡 + 异常释放工单 + 跨项目触达”主动治理，观察空场但不可约的质疑如何形成、不同解释如何竞争，以及治理回应是否被居民直接引用、追问或形成服务反馈。',
})
const CENTURY_GYM_PRESET_EN = Object.freeze({
  name: 'Century Gym “Ghost Booking” Governance Rehearsal',
  governance_domain: 'Campus sports venue booking and public-service governance',
  objective: 'Compare natural forum evolution with active governance through a booking evidence card, abnormal-release service tickets, and cross-activity outreach. Observe how questions about visibly empty yet unavailable venues emerge, how explanations compete, and whether residents quote, challenge, or respond to governance actions.',
})
const activeCenturyGymPreset = computed(() => currentLocale.value === 'en-US' ? CENTURY_GYM_PRESET_EN : CENTURY_GYM_PRESET)

function availableProjectName(baseName: string): string {
  const names = new Set(props.existingNames.map((name) => name.trim().toLocaleLowerCase('zh-CN')))
  if (!names.has(baseName.toLocaleLowerCase('zh-CN'))) return baseName
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${baseName}（${suffix}）`
    if (!names.has(candidate.toLocaleLowerCase('zh-CN'))) return candidate
  }
  return `${baseName} · ${new Date().toLocaleString('zh-CN', { hour12:false })}`
}

function applyPreset(preset: typeof CENTURY_GYM_PRESET | typeof CENTURY_GYM_PRESET_EN) {
  Object.assign(form, preset, {
    name: props.existingCenturyGymProjectId ? preset.name : availableProjectName(preset.name),
  })
}

function applySetupMode(mode: 'century_gym' | 'custom') {
  form.setup_mode = mode
  if (mode === 'century_gym') applyPreset(activeCenturyGymPreset.value)
  else {
    form.name = ''
    form.governance_domain = ''
    form.objective = ''
  }
}

const localErrors = ref<Record<string, string[]>>({})
const rootRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null
let previousBodyOverflow = ''

function validate(): boolean {
  const errors: Record<string, string[]> = {}
  if (!form.name.trim()) errors.name = ['项目名称不能为空']
  else if (form.name.trim().length > 120) errors.name = ['项目名称不能超过 120 个字符']
  if (!form.governance_domain.trim()) errors.governance_domain = ['治理领域不能为空']
  else if (form.governance_domain.trim().length > 80) errors.governance_domain = ['治理领域不能超过 80 个字符']
  if (!form.objective.trim()) errors.objective = ['治理目标不能为空']
  else if (form.objective.trim().length > 800) errors.objective = ['治理目标不能超过 800 个字符']
  localErrors.value = errors
  return Object.keys(errors).length === 0
}

function fieldError(field: string): string {
  return (props.fieldErrors[field] ?? localErrors.value[field] ?? [])[0] || ''
}

function submit() {
  if (form.setup_mode === 'century_gym' && props.existingCenturyGymProjectId) {
    const preset = activeCenturyGymPreset.value
    emit('submit', {
      name: preset.name,
      governance_domain: preset.governance_domain,
      objective: preset.objective,
      evaluation_mode: form.evaluation_mode,
      bootstrap_mode: 'century_gym',
      existing_project_id: props.existingCenturyGymProjectId,
    })
    return
  }
  if (!validate()) {
    const first = document.querySelector<HTMLElement>('[data-field-error]')
    first?.focus()
    return
  }
  emit('submit', {
    name: form.name.trim(),
    governance_domain: form.governance_domain.trim(),
    objective: form.objective.trim(),
    evaluation_mode: form.evaluation_mode,
    bootstrap_mode: form.setup_mode === 'century_gym' ? 'century_gym' : 'none',
    existing_project_id: form.setup_mode === 'century_gym'
      ? props.existingCenturyGymProjectId || undefined
      : undefined,
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    event.preventDefault()
    emit('cancel')
  }
}

function onBackdrop(event: MouseEvent) {
  if (event.target === rootRef.value) emit('cancel')
}

watch(() => props.open, (open) => {
  if (!open) {
    document.body.style.overflow = previousBodyOverflow
    previouslyFocused?.focus?.()
    previouslyFocused = null
    return
  }
  previouslyFocused = document.activeElement as HTMLElement | null
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  form.setup_mode = 'century_gym'
  applyPreset(activeCenturyGymPreset.value)
  form.evaluation_mode = 'simulation_stress_test'
  localErrors.value = {}
  nextTick(() => {
    document.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  })
})

watch(currentLocale, () => {
  if (props.open && form.setup_mode === 'century_gym') applyPreset(activeCenturyGymPreset.value)
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="rootRef"
      class="dialog-backdrop campus-pulse-portal"
      @click="onBackdrop"
    >
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
        <header class="dialog-head">
          <div>
            <p>SIMULATION PROJECT</p>
            <h2 id="create-project-title">新建推演项目</h2>
            <span>创建世纪馆现场演示项目，或从空白项目开始配置。</span>
          </div>
          <button type="button" class="close" aria-label="关闭对话框" @click="emit('cancel')">×</button>
        </header>

        <form class="dialog-form" novalidate @submit.prevent="submit">
          <p v-if="serverError" class="form-error-summary" role="alert">{{ serverError }}</p>

          <fieldset class="field setup-mode">
            <legend>创建方式</legend>
            <button
              type="button"
              :class="{ selected:form.setup_mode === 'century_gym' }"
              :aria-pressed="form.setup_mode === 'century_gym'"
              @click="applySetupMode('century_gym')"
            >
              <strong>世纪馆现场演示</strong>
              <span v-if="existingCenturyGymProjectId">项目已经建立；进入后可把运行台重置到 Tick 0，重新演示完整过程</span>
              <span v-else>预填事件、1,000 Agent、论坛机制与治理分支；创建后由你手动启动模拟</span>
            </button>
            <button
              type="button"
              :class="{ selected:form.setup_mode === 'custom' }"
              :aria-pressed="form.setup_mode === 'custom'"
              @click="applySetupMode('custom')"
            >
              <strong>自定义项目</strong>
              <span>手动绑定数据、事件、治理方案和运行合同</span>
            </button>
          </fieldset>

          <section class="agent-world-preview" aria-labelledby="create-world-title">
            <div class="world-orbit" aria-hidden="true"><i/><i/><i/><b>1K</b></div>
            <div>
              <p>AGENT WORLD</p>
              <h3 id="create-world-title">项目接入固定校园 Agent 世界</h3>
              <span>1,000 个持久 Profile · 120 个微角色池（当前覆盖 116 个）· 8,000 条合成关系 · 公开论坛 + 好友私聊 + 动态小群</span>
            </div>
            <ol aria-label="创建后配置步骤">
              <li><b>01</b>注入事件</li><li><b>02</b>选择预算 / 全量模式</li><li><b>03</b>观察公私传播与治理风险</li>
            </ol>
          </section>

          <label class="field">
            <span>项目名称 <em aria-hidden="true">*</em></span>
            <input
              v-model="form.name"
              data-autofocus
              type="text"
              name="name"
              maxlength="120"
              placeholder="例如：世纪馆预约争议预演"
              :readonly="form.setup_mode === 'century_gym'"
              :aria-invalid="Boolean(fieldError('name'))"
              :aria-describedby="fieldError('name') ? 'name-error' : undefined"
            />
            <span v-if="fieldError('name')" id="name-error" class="field-error" data-field-error role="alert">
              {{ fieldError('name') }}
            </span>
          </label>

          <label class="field">
            <span>治理领域 <em aria-hidden="true">*</em></span>
            <input
              v-model="form.governance_domain"
              type="text"
              name="governance_domain"
              maxlength="80"
              placeholder="例如：校园资源配置与服务治理"
              :aria-invalid="Boolean(fieldError('governance_domain'))"
              :aria-describedby="fieldError('governance_domain') ? 'domain-error' : undefined"
            />
            <span v-if="fieldError('governance_domain')" id="domain-error" class="field-error" data-field-error role="alert">
              {{ fieldError('governance_domain') }}
            </span>
          </label>

          <label class="field">
            <span>治理目标 <em aria-hidden="true">*</em></span>
            <textarea
              v-model="form.objective"
              name="objective"
              rows="3"
              maxlength="800"
              placeholder="说明本次模拟希望比较的治理目标、风险和评价边界"
              :aria-invalid="Boolean(fieldError('objective'))"
              :aria-describedby="fieldError('objective') ? 'objective-error' : undefined"
            />
            <span class="field-hint">{{ form.objective.length }}/800</span>
            <span v-if="fieldError('objective')" id="objective-error" class="field-error" data-field-error role="alert">
              {{ fieldError('objective') }}
            </span>
          </label>

          <fieldset class="field field--choice">
            <legend>评估模式 <em aria-hidden="true">*</em></legend>
            <label v-for="mode in PROJECT_EVALUATION_MODES" :key="mode.code" class="choice">
              <input v-model="form.evaluation_mode" type="radio" name="evaluation_mode" :value="mode.code" />
              <span>{{ mode.label }}</span>
            </label>
          </fieldset>

          <div class="dialog-actions">
            <button type="button" class="secondary" @click="emit('cancel')">取消</button>
            <button type="submit" class="primary" :disabled="submitting">
              {{ submitting ? '正在处理…' : form.setup_mode === 'century_gym' && existingCenturyGymProjectId ? '进入现场项目' : form.setup_mode === 'century_gym' ? '创建现场项目' : '创建并继续' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop { position:fixed; inset:0; z-index:var(--cp-z-drawer-backdrop); display:flex; align-items:center; justify-content:center; padding:var(--cp-space-5); background:var(--cp-overlay); backdrop-filter:blur(2px); }
.dialog { position:relative; z-index:var(--cp-z-drawer); width:min(100%,42rem); max-height:min(90vh,50rem); overflow-y:auto; border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); box-shadow:0 22px 70px rgba(0,0,0,.28); }
.dialog-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-5); border-bottom:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.dialog-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.dialog-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.dialog-head span { display:block; margin-top:var(--cp-space-2); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.close { flex:none; width:2rem; height:2rem; border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-secondary); font-size:var(--cp-text-lg); line-height:1; cursor:pointer; }
.dialog-form { display:grid; gap:var(--cp-space-4); padding:var(--cp-space-5); }
.form-error-summary { margin:0; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.field { display:grid; gap:var(--cp-space-1); }
.field > span { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.field em { color:var(--cp-danger); font-style:normal; }
.field input, .field textarea { box-sizing:border-box; width:100%; min-height:var(--cp-control-height); padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font:500 var(--cp-text-sm)/1.5 var(--cp-font-sans); }
.field input:focus,.field textarea:focus { border-color:var(--cp-focus-ring); }
.field textarea { resize:vertical; }
.field-hint { justify-self:end; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.field-error { color:var(--cp-danger); font-size:var(--cp-text-xs); }
.field--choice { margin:0; padding:0; border:0; }
.field--choice legend { padding:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:600; }
.choice { display:flex; align-items:center; gap:var(--cp-space-2); padding:var(--cp-space-2) 0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.choice input[type="radio"] { flex:0 0 auto; width:1rem; min-height:1rem; height:1rem; margin:0; padding:0; accent-color:var(--cp-action-primary); }
.choice span { flex:1 1 auto; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:500; }
.setup-mode { grid-template-columns:repeat(2,minmax(0,1fr)); margin:0; padding:0; border:0; }
.setup-mode legend { grid-column:1 / -1; margin-bottom:var(--cp-space-1); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); font-weight:650; }
.setup-mode button { display:grid; gap:var(--cp-space-1); min-height:5.6rem; padding:var(--cp-space-3); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); text-align:left; cursor:pointer; }
.setup-mode button.selected { border-color:var(--cp-action-primary); box-shadow:inset 0 0 0 1px var(--cp-action-primary); background:var(--cp-surface-selected); }
.setup-mode button strong { font-size:var(--cp-text-sm); }
.setup-mode button span { color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.5; }
.agent-world-preview { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:var(--cp-space-3); padding:var(--cp-space-3); border:1px solid #3d3437; background:linear-gradient(135deg,#181315,#2a171d); color:#fff; }
.agent-world-preview p { margin:0 0 .25rem; color:#f0b963; font:700 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.12em; }
.agent-world-preview h3 { margin:0; font-size:var(--cp-text-md); }
.agent-world-preview span { display:block; margin-top:.35rem; color:#bcaeb2; font-size:var(--cp-text-xs); line-height:1.5; }
.world-orbit { position:relative; display:grid; width:3.4rem; height:3.4rem; place-items:center; }
.world-orbit i { position:absolute; inset:0; border:1px solid rgba(220,0,55,.5); border-radius:50%; animation:world-orbit 6s linear infinite; }
.world-orbit i:nth-child(2) { inset:.45rem; animation-direction:reverse; }
.world-orbit i:nth-child(3) { inset:.9rem; border-color:#e1ab5b; }
.world-orbit b { color:#fff; font:700 .75rem var(--cp-font-mono); }
.agent-world-preview ol { display:grid; gap:.35rem; margin:0; padding:0; list-style:none; }
.agent-world-preview li { display:flex; align-items:center; gap:.45rem; color:#d8ced1; font-size:var(--cp-text-xs); white-space:nowrap; }
.agent-world-preview li b { color:#e5ad5c; font:700 .6rem var(--cp-font-mono); }
.dialog-actions { display:flex; justify-content:flex-end; gap:var(--cp-space-2); padding-top:var(--cp-space-2); border-top:1px solid var(--cp-border-subtle); }
.dialog-actions button { min-height:var(--cp-control-height); padding:0 var(--cp-space-4); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.secondary { background:var(--cp-surface-default); color:var(--cp-text-primary); }
.primary { border-color:var(--cp-action-primary) !important; background:var(--cp-action-primary); color:var(--cp-surface-default); }
.primary:hover { background:var(--cp-action-primary-hover); }
.primary:disabled { opacity:.55; cursor:not-allowed; }
@media (max-width:767px) {
  .dialog-backdrop { align-items:flex-end; padding:0; }
  .dialog { width:100%; max-height:92dvh; border-radius:var(--cp-radius-md) var(--cp-radius-md) 0 0; }
  .dialog-head,.dialog-form { padding:var(--cp-space-4); }
  .setup-mode { grid-template-columns:1fr; }
  .agent-world-preview { grid-template-columns:auto 1fr; }
  .agent-world-preview ol { grid-column:1/-1; }
  .dialog-actions button { min-height:var(--cp-touch-target); }
}
@media (prefers-reduced-motion:reduce) { .world-orbit i { animation:none; } }
@keyframes world-orbit { to { transform:rotate(360deg); } }
</style>
