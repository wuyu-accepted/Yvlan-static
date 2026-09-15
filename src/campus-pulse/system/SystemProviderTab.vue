<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ApiProblem } from '../contracts/api.ts'

type ProviderConfig = {
  configured: boolean
  api_key_present: boolean
  api_key_returned: false
  storage_scope: 'local_machine_user_profile'
  base_url: string
  model_name: string
  reasoning_effort: 'none' | 'low' | 'medium' | 'high'
  temperature: number | null
  max_output_tokens: number
  timeout_seconds: number
  max_concurrency: number
  updated_at: string
}

type ProviderTestResult = {
  connected: boolean
  latency_ms: number
  model_name: string
  prompt_tokens: number | null
  completion_tokens: number | null
  automatic_retries: number
  project_data_sent: boolean
}

const props = defineProps<{
  config: ProviderConfig | null
  loading: boolean
  saving: boolean
  testing: boolean
  clearing: boolean
  error: ApiProblem | null
  testResult: ProviderTestResult | null
}>()

const emit = defineEmits<{
  refresh: []
  save: [payload: Record<string, unknown>]
  test: []
  clear: []
}>()

const form = reactive({
  base_url: 'https://yunwu.ai/v1',
  model_name: 'gpt-5.6-luna',
  api_key: '',
  reasoning_effort: 'none',
  temperature: '',
  max_output_tokens: 512,
  timeout_seconds: 180,
  max_concurrency: 8,
})

watch(
  () => props.config,
  (value) => {
    if (!value) return
    if (value.base_url) form.base_url = value.base_url
    if (value.model_name) form.model_name = value.model_name
    form.reasoning_effort = value.reasoning_effort || 'none'
    form.temperature = value.temperature === null || value.temperature === undefined
      ? ''
      : String(value.temperature)
    form.max_output_tokens = value.max_output_tokens || 512
    form.timeout_seconds = value.timeout_seconds || 180
    form.max_concurrency = value.max_concurrency || 8
    form.api_key = ''
  },
  { immediate: true },
)

const busy = computed(() => props.loading || props.saving || props.testing || props.clearing)
const keyHelp = computed(() => props.config?.api_key_present
  ? '已保存本机密钥。留空将继续使用原密钥；输入新值才会替换。'
  : '首次保存必须填写。密钥只发送到本机后端，页面不会再次读取。')

function submit() {
  const payload: Record<string, unknown> = {
    base_url: form.base_url.trim(),
    model_name: form.model_name.trim(),
    reasoning_effort: form.reasoning_effort,
    temperature: form.temperature === '' ? null : Number(form.temperature),
    max_output_tokens: Number(form.max_output_tokens),
    timeout_seconds: Number(form.timeout_seconds),
    max_concurrency: Number(form.max_concurrency),
  }
  if (form.api_key.trim()) payload.api_key = form.api_key.trim()
  emit('save', payload)
  form.api_key = ''
}
</script>

<template>
  <section class="provider-config" aria-labelledby="provider-config-title">
    <header class="provider-heading">
      <div>
        <p class="eyebrow">本机运行设置</p>
        <h2 id="provider-config-title">模型与 API 配置</h2>
        <p>为新测试保存 OpenAI-compatible Provider。已冻结的正式实验仍以各自 preflight 为准。</p>
      </div>
      <span class="connection-state" :class="config?.configured ? 'ready' : 'empty'">
        {{ config?.configured ? '本机已配置' : '尚未配置' }}
      </span>
    </header>

    <div v-if="error" class="notice error" role="alert">
      <strong>{{ error.summary }}</strong>
      <span>{{ error.detail }}</span>
    </div>
    <div v-if="testResult?.connected" class="notice success" role="status">
      <strong>连接成功</strong>
      <span>{{ testResult.model_name }} · {{ testResult.latency_ms }} ms · 自动重试 0 次</span>
    </div>

    <form class="provider-form" @submit.prevent="submit">
      <label class="field full">
        <span>API Base URL</span>
        <input
          v-model="form.base_url"
          type="url"
          required
          autocomplete="url"
          placeholder="https://provider.example/v1"
        >
        <small>填写到 <code>/v1</code>；若误填 <code>/chat/completions</code>，后端会自动规范化。</small>
      </label>

      <label class="field">
        <span>模型名称</span>
        <input v-model="form.model_name" type="text" required autocomplete="off" placeholder="gpt-5.6-luna">
      </label>

      <label class="field">
        <span>API Key</span>
        <input
          v-model="form.api_key"
          type="password"
          :required="!config?.api_key_present"
          autocomplete="new-password"
          placeholder="仅在本机保存"
        >
        <small>{{ keyHelp }}</small>
      </label>

      <label class="field">
        <span>推理强度</span>
        <select v-model="form.reasoning_effort">
          <option value="none">关闭（none）</option>
          <option value="low">低</option>
          <option value="medium">中等</option>
          <option value="high">高</option>
        </select>
      </label>

      <label class="field">
        <span>温度（可选）</span>
        <input v-model="form.temperature" type="number" min="0" max="2" step="0.1" placeholder="使用 Provider 默认值">
      </label>

      <label class="field">
        <span>单次最大输出 Token</span>
        <input v-model.number="form.max_output_tokens" type="number" min="16" max="8192" required>
      </label>

      <label class="field">
        <span>请求超时（秒）</span>
        <input v-model.number="form.timeout_seconds" type="number" min="5" max="600" required>
      </label>

      <label class="field">
        <span>最大并发</span>
        <input v-model.number="form.max_concurrency" type="number" min="1" max="64" required>
      </label>

      <aside class="security-note full">
        <strong>密钥边界</strong>
        <p>密钥写入当前用户目录 <code>~/.campus-pulse/provider-key</code>；不写入 Git、SQLite、日志或浏览器存储，接口也不会回显。远程访问此配置接口会被拒绝。</p>
      </aside>

      <div class="actions full">
        <button type="submit" class="primary" :disabled="busy">
          {{ saving ? '保存中…' : '保存本机配置' }}
        </button>
        <button type="button" :disabled="busy || !config?.configured" @click="emit('test')">
          {{ testing ? '测试中…' : '发送最小连接测试' }}
        </button>
        <button type="button" :disabled="busy || !config?.configured" @click="emit('clear')">清除本机配置</button>
        <button type="button" :disabled="busy" @click="emit('refresh')">重新读取</button>
      </div>
    </form>

    <p class="test-boundary">连接测试只发送固定字符串，不包含项目、Profile、Prompt、论坛消息或实验结果；它可能产生极少量 Provider 用量。</p>
  </section>
</template>

<style scoped>
.provider-config { display:grid; gap:var(--cp-space-4); }
.provider-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-4); }
.provider-heading h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.provider-heading > div > p:last-child { max-width:54rem; margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.eyebrow { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.connection-state { padding:.35rem .65rem; border:1px solid var(--cp-border-default); border-radius:999px; font-size:var(--cp-text-xs); font-weight:700; white-space:nowrap; }
.connection-state.ready { border-color:var(--cp-success); color:var(--cp-success); }
.connection-state.empty { color:var(--cp-text-muted); }
.notice { display:grid; gap:.2rem; padding:var(--cp-space-3); border-left:3px solid var(--cp-border-strong); background:var(--cp-surface-default); font-size:var(--cp-text-sm); }
.notice span { color:var(--cp-text-secondary); }
.notice.error { border-left-color:var(--cp-danger); }
.notice.success { border-left-color:var(--cp-success); }
.provider-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--cp-space-4); padding:var(--cp-space-5); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.field { display:grid; align-content:start; gap:var(--cp-space-1); }
.field.full, .security-note.full, .actions.full { grid-column:1/-1; }
.field > span { font-size:var(--cp-text-sm); font-weight:700; }
.field input, .field select { width:100%; min-height:var(--cp-control-height); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); padding:0 var(--cp-space-3); font:inherit; }
.field input:focus, .field select:focus { outline:2px solid var(--brand-red); outline-offset:1px; }
.field small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.security-note { padding:var(--cp-space-3); border-left:3px solid var(--cp-evidence); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); }
.security-note p, .test-boundary { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.actions button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-weight:700; cursor:pointer; }
.actions button.primary { border-color:var(--brand-red); background:var(--brand-red); color:var(--cp-text-inverse); }
.actions button:disabled { cursor:not-allowed; opacity:.55; }
.test-boundary { color:var(--cp-text-muted); }
@media (max-width:767px) {
  .provider-heading { flex-direction:column; }
  .provider-form { grid-template-columns:1fr; padding:var(--cp-space-4); }
  .field.full, .security-note.full, .actions.full { grid-column:auto; }
  .actions button { width:100%; min-height:var(--cp-touch-target); }
}
</style>
