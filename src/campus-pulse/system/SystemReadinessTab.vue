<script setup lang="ts">
import { computed } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { currentLocale } from '../i18n/locale.ts'
import type { ApiProblem } from '../contracts/api.ts'
import type {
  GateStatus,
  OfflineAssetVM,
  RuntimeCapabilityVM,
  SystemStatusVM,
} from './systemViewModel.ts'

const props = defineProps<{
  status: SystemStatusVM | null
  loading: boolean
  error: ApiProblem | null
  checkedAt: string
}>()

defineEmits<{ refresh: [] }>()

const isEnglish = computed(() => currentLocale.value === 'en-US')
const gateSummary = computed(() => isEnglish.value
  ? `${readyCount.value} ready · ${blockedCount.value} blocked · ${unknownCount.value} unknown (${props.status?.gates.length ?? 0} items)`
  : `${readyCount.value} 就绪 · ${blockedCount.value} 阻断 · ${unknownCount.value} 未知（${props.status?.gates.length ?? 0} 项）`)

const gateTone = (status: GateStatus): string => (
  status === 'ready' ? 'success'
    : status === 'degraded' ? 'warning'
      : status === 'blocked' ? 'danger' : 'neutral'
)
const gateIcon = (status: GateStatus): string => (
  status === 'ready' ? 'fa-circle-check'
    : status === 'degraded' ? 'fa-triangle-exclamation'
      : status === 'blocked' ? 'fa-circle-xmark' : 'fa-circle-question'
)
const gateLabel = (status: GateStatus): string => (
  status === 'ready' ? '就绪' : status === 'degraded' ? '降级' : status === 'blocked' ? '阻断' : '未知'
)
const assetTone = (status: OfflineAssetVM['status']): string => (
  status === 'verified' ? 'evidence' : status === 'checking' ? 'neutral' : 'danger'
)
const assetLabel = (status: OfflineAssetVM['status']): string => (
  status === 'verified' ? '已验证' : status === 'checking' ? '校验中' : status === 'missing' ? '缺失' : status === 'mismatch' ? '不匹配' : '失败'
)
const apiLabel = computed(() => (
  props.status?.api.status === 'available' ? 'API 可用'
    : props.status?.api.status === 'degraded' ? 'API 部分可用'
      : props.status?.api.status === 'checking' ? '检查中' : 'API 不可用'
))
const apiTone = computed(() => (
  props.status?.api.status === 'available' ? 'success'
    : props.status?.api.status === 'degraded' ? 'warning'
      : props.status?.api.status === 'checking' ? 'neutral' : 'danger'
))
const readyCount = computed(() => props.status?.gates.filter((gate) => gate.status === 'ready').length ?? 0)
const blockedCount = computed(() => props.status?.gates.filter((gate) => gate.status === 'blocked').length ?? 0)
const unknownCount = computed(() => props.status?.gates.filter((gate) => gate.status === 'unknown').length ?? 0)
function short(value: string | undefined): string {
  return value ? value.slice(0, 10) + '…' + value.slice(-8) : '—'
}
function formatCapability(item: RuntimeCapabilityVM): string {
  return item.note ? item.value + '（' + item.note + '）' : item.value
}
</script>

<template>
  <section class="system-tab" aria-labelledby="readiness-title">
    <header class="tab-head">
      <div>
        <h2 id="readiness-title">就绪状态</h2>
        <p class="tab-intro">未知状态不会显示为就绪。</p>
      </div>
      <button type="button" class="refresh" :disabled="loading" @click="$emit('refresh')">{{ loading ? '检测中…' : '重新检测' }}</button>
    </header>

    <div v-if="loading && !status" class="loading">正在探测后端与离线资产…</div>
    <div v-else-if="error && !status" class="inline-error" role="alert">
      {{ error.summary }}：{{ error.detail }}
      <button type="button" @click="$emit('refresh')">重试</button>
    </div>
    <template v-else>
      <section class="service-summary" aria-labelledby="service-title">
        <h3 id="service-title">服务状态</h3>
        <dl class="summary-grid">
          <div>
            <dt>后端 API</dt>
            <dd><CpStatusBadge :tone="apiTone" :icon="status?.api.status === 'available' ? 'fa-circle-check' : status?.api.status === 'unavailable' ? 'fa-circle-xmark' : 'fa-triangle-exclamation'">{{ apiLabel }}</CpStatusBadge></dd>
          </div>
          <div><dt>检测时间</dt><dd>{{ checkedAt || status?.api.lastCheckedAt || '—' }}</dd></div>
          <div><dt>门禁汇总</dt><dd>{{ gateSummary }}</dd></div>
          <div><dt>新鲜度</dt><dd>{{ status?.freshness === 'stale' ? '上次已知（已过期）' : status?.freshness === 'fresh' ? '当前探测' : '未检测' }}</dd></div>
        </dl>
        <p class="service-detail">{{ status?.api.detail || '未检测到后端响应；当前只读，未知状态保持未知。' }}</p>
        <p v-if="status?.freshness === 'stale'" class="stale-note" role="status">
          上次检测结果保留为“上次已知”，不作为当前 READY；请重新检测。
        </p>
      </section>

      <section aria-labelledby="gates-title">
        <h3 id="gates-title">就绪门禁</h3>
        <div class="table-scroll">
          <table class="gate-table">
            <caption class="sr-only">就绪门禁明细：每项状态、说明与下一步操作</caption>
            <thead>
              <tr><th scope="col">门禁</th><th scope="col">状态</th><th scope="col">说明</th><th scope="col">下一步</th><th scope="col">检测时间</th></tr>
            </thead>
            <tbody>
              <tr v-for="gate in status?.gates ?? []" :key="gate.id">
                <th scope="row">{{ gate.label }}</th>
                <td><CpStatusBadge :tone="gateTone(gate.status)" :icon="gateIcon(gate.status)">{{ gateLabel(gate.status) }}</CpStatusBadge></td>
                <td>{{ gate.detail }}</td>
                <td>{{ gate.nextAction }}</td>
                <td class="checked-at">{{ gate.checkedAt }}</td>
              </tr>
              <tr v-if="(status?.gates ?? []).length === 0">
                <td colspan="5" class="panel-empty">未获得任何门禁数据（后端不可达且无缓存）。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="offline-title">
        <h3 id="offline-title">离线资产校验</h3>
        <div class="table-scroll">
          <table class="gate-table">
            <caption class="sr-only">离线资产校验结果</caption>
            <thead>
              <tr><th scope="col">资产</th><th scope="col">状态</th><th scope="col">说明</th><th scope="col">SHA-256</th><th scope="col">发布资格</th></tr>
            </thead>
            <tbody>
              <tr v-for="asset in status?.offlineAssets ?? []" :key="asset.id">
                <th scope="row">{{ asset.label }}</th>
                <td><CpStatusBadge :tone="assetTone(asset.status)" :icon="asset.status === 'verified' ? 'fa-circle-check' : 'fa-triangle-exclamation'">{{ assetLabel(asset.status) }}</CpStatusBadge></td>
                <td>{{ asset.detail }}</td>
                <td><code>{{ short(asset.actualSha256 || asset.expectedSha256) }}</code></td>
                <td>{{ asset.publicationEligible === false ? '不允许（只读展示）' : asset.publicationEligible === true ? '允许' : '—' }}</td>
              </tr>
              <tr v-if="(status?.offlineAssets ?? []).length === 0">
                <td colspan="5" class="panel-empty">离线资产校验未运行。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="capability-title">
        <h3 id="capability-title">运行时能力</h3>
        <div class="table-scroll">
          <table class="gate-table">
            <caption class="sr-only">运行时能力与门禁</caption>
            <thead>
              <tr><th scope="col">能力</th><th scope="col">值</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in status?.runtimeCapabilities ?? []" :key="item.key">
                <th scope="row">{{ item.label }}</th>
                <td>{{ formatCapability(item) }}</td>
              </tr>
              <tr v-if="(status?.runtimeCapabilities ?? []).length === 0">
                <td colspan="2" class="panel-empty">后端不可达，无能力数据。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="versions-title">
        <h3 id="versions-title">数据版本</h3>
        <dl class="versions">
          <div v-for="version in status?.versions ?? []" :key="version.label">
            <dt>{{ version.label }}</dt><dd><code>{{ version.value }}</code></dd>
          </div>
          <div v-if="(status?.versions ?? []).length === 0">
            <dt>版本</dt><dd>未检测</dd>
          </div>
        </dl>
      </section>
    </template>
  </section>
</template>

<style scoped>
.system-tab { display:grid; min-width:0; max-width:100%; gap:var(--cp-space-5); }
.tab-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); }
.tab-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.tab-head h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-xl); }
.tab-intro { margin:var(--cp-space-1) 0 0 !important; font-weight:400 !important; letter-spacing:0 !important; }
.refresh { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.refresh:disabled { opacity:.6; cursor:not-allowed; }
section > h3 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-md); }
.loading { padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.inline-error { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); align-items:center; padding:var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.inline-error button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-danger); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-danger); font-weight:650; cursor:pointer; }
.service-summary { padding:var(--cp-space-4); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--cp-space-3); margin:0; }
.summary-grid dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.summary-grid dd { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-sm); font-weight:650; }
.service-detail { margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.stale-note { margin:var(--cp-space-2) 0 0; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-warning); background:var(--cp-warning-surface); color:var(--cp-warning); font-size:var(--cp-text-xs); }
.table-scroll { max-width:100%; min-width:0; overflow-x:auto; overscroll-behavior-inline:contain; }
.gate-table { width:100%; min-width:52rem; border-collapse:collapse; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.gate-table th, .gate-table td { padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-subtle); text-align:left; vertical-align:top; font-size:var(--cp-text-sm); }
.gate-table thead th { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; white-space:nowrap; }
.gate-table tbody th { font-weight:700; white-space:nowrap; }
.gate-table code { font-family:var(--cp-font-mono); font-size:var(--cp-text-xs); }
.checked-at { color:var(--cp-text-muted); font-size:var(--cp-text-xs); white-space:nowrap; }
.panel-empty { color:var(--cp-text-secondary); }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
.versions { display:grid; grid-template-columns:repeat(auto-fit,minmax(14rem,1fr)); gap:var(--cp-space-2); margin:0; }
.versions div { padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); background:var(--cp-surface-default); }
.versions dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.versions dd { margin:var(--cp-space-1) 0 0; overflow-wrap:anywhere; font-size:var(--cp-text-sm); }
@media (max-width:767px) {
  .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .tab-head { align-items:flex-start; flex-direction:column; }
  .refresh { min-height:var(--cp-touch-target); }
}
</style>
