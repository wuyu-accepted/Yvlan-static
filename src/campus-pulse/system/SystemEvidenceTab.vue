<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import type { ApiProblem } from '../contracts/api.ts'
import type {
  EvidenceReleaseVM,
  EvidenceSnapshotDetailVM,
  EvidenceSnapshotVM,
} from './systemViewModel.ts'

const props = defineProps<{
  apiStatus: 'checking' | 'available' | 'degraded' | 'unavailable'
  releases: EvidenceReleaseVM[] | null
  releasesLoading: boolean
  releasesError: ApiProblem | null
  snapshots: EvidenceSnapshotVM[] | null
  snapshotsLoading: boolean
  snapshotsError: ApiProblem | null
  selectedSnapshotId: string | undefined
  detail: EvidenceSnapshotDetailVM | null
  detailLoading: boolean
  detailError: ApiProblem | null
  registering: boolean
  registerError: ApiProblem | null
}>()

const emit = defineEmits<{
  refresh: []
  register: [releaseKey: string]
  openSnapshot: [snapshotId: string]
  closeSnapshot: []
}>()

const confirmRegisterKey = ref<string | null>(null)
const confirmCancelButton = ref<HTMLButtonElement | null>(null)

const canRegister = computed(() => props.apiStatus === 'available' && !props.registering)

function short(value: string | undefined): string {
  return value ? value.slice(0, 10) + '…' + value.slice(-8) : '—'
}
function statusTone(status: string): string {
  return status === 'sealed' ? 'success' : status === 'verified' ? 'evidence' : status ? 'warning' : 'neutral'
}
const selectedRelease = computed(() => (
  (props.releases ?? []).find((release) => release.releaseKey === confirmRegisterKey.value) || null
))
function openConfirm(releaseKey: string) {
  confirmRegisterKey.value = releaseKey
  void nextTick(() => confirmCancelButton.value?.focus())
}
function closeConfirm() {
  confirmRegisterKey.value = null
}
function confirmRegister() {
  if (!confirmRegisterKey.value || props.registering) return
  const releaseKey = confirmRegisterKey.value
  closeConfirm()
  emit('register', releaseKey)
}
</script>

<template>
  <section class="system-tab" aria-labelledby="evidence-title">
    <header class="tab-head">
      <div>
        <h2 id="evidence-title">证据目录与审计</h2>
        <p class="tab-intro">仅展示公开证据字段。</p>
      </div>
      <button type="button" class="refresh" :disabled="releasesLoading || snapshotsLoading" @click="emit('refresh')">刷新</button>
    </header>

    <div v-if="registerError" class="inline-error" role="alert">
      {{ registerError.summary }}：{{ registerError.detail }}
    </div>

    <section aria-labelledby="releases-title">
      <h3 id="releases-title">证据数据</h3>
      <div v-if="releasesLoading" class="loading">正在加载证据数据…</div>
      <div v-else-if="releasesError" class="inline-error" role="alert">
        {{ releasesError.summary }}：{{ releasesError.detail }}
        <button type="button" @click="emit('refresh')">重试</button>
      </div>
      <div v-else-if="(releases ?? []).length" class="table-scroll">
        <table class="data-table">
          <caption class="sr-only">已安装证据列表</caption>
          <thead>
            <tr><th scope="col">数据集</th><th scope="col">状态</th><th scope="col">隐私模式</th><th scope="col">源数据</th><th scope="col">分析产物</th><th scope="col">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="release in releases ?? []" :key="release.releaseKey">
              <th scope="row">
                <strong>{{ release.label }}</strong>
              </th>
              <td><CpStatusBadge :tone="statusTone(release.status)">{{ release.status }}</CpStatusBadge></td>
              <td>{{ release.privacyMode }}</td>
              <td>{{ release.sourceRows ?? '—' }} 行 · {{ release.sourceBytes ?? '—' }} B</td>
              <td>{{ release.analysisArtifactCount ?? '—' }}</td>
              <td>
                <button
                  v-if="canRegister"
                  type="button"
                  class="row-action"
                  @click="openConfirm(release.releaseKey)"
                >登记到工作台</button>
                <span v-else class="muted">{{ apiStatus === 'available' ? '登记中…' : '后端不可用：登记已禁用' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="privacy-note">零原始行持久化：{{ (releases ?? []).every((item) => item.zeroRawRowsPersisted === true) ? '是（不保留原始帖子/评论正文）' : '未全部确认' }}</p>
      </div>
      <div v-else class="panel-empty">{{ apiStatus === 'unavailable' ? '请连接后端以查看数据集。' : '暂无已登记数据集。' }}</div>
    </section>

    <section aria-labelledby="snapshots-title">
      <h3 id="snapshots-title">证据快照</h3>
      <div v-if="snapshotsLoading" class="loading">正在加载证据快照…</div>
      <div v-else-if="snapshotsError" class="inline-error" role="alert">
        {{ snapshotsError.summary }}：{{ snapshotsError.detail }}
        <button type="button" @click="emit('refresh')">重试</button>
      </div>
      <div v-else-if="(snapshots ?? []).length" class="table-scroll">
        <table class="data-table">
          <caption class="sr-only">证据快照列表</caption>
          <thead>
            <tr><th scope="col">快照</th><th scope="col">状态</th><th scope="col">源/产物</th><th scope="col">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="snapshot in snapshots ?? []" :key="snapshot.snapshotId">
              <th scope="row">
                <strong>{{ snapshot.label || snapshot.snapshotId }}</strong>
                <small><code>{{ snapshot.snapshotId }}</code></small>
              </th>
              <td><CpStatusBadge :tone="statusTone(snapshot.status)">{{ snapshot.status }}</CpStatusBadge></td>
              <td>{{ snapshot.sourceCount ?? '—' }} 源 · {{ snapshot.artifactCount ?? '—' }} 产物</td>
              <td>
                <button
                  type="button"
                  class="row-action"
                  :disabled="snapshot.snapshotId === selectedSnapshotId"
                  @click="emit('openSnapshot', snapshot.snapshotId)"
                >{{ snapshot.snapshotId === selectedSnapshotId ? '已打开' : '查看明细' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="panel-empty">
        {{ apiStatus === 'unavailable' ? '后端不可用：snapshot 列表未知。' : '暂无已登记证据快照；请先登记 release（仅在后端可用时）。' }}
      </div>
    </section>

    <section v-if="selectedSnapshotId" aria-labelledby="detail-title">
      <h3 id="detail-title">快照明细 <span class="detail-id"><code>{{ selectedSnapshotId }}</code></span></h3>
      <button type="button" class="row-action back" @click="emit('closeSnapshot')">← 返回列表</button>
      <div v-if="detailLoading" class="loading">正在加载快照明细…</div>
      <div v-else-if="detailError" class="inline-error" role="alert">
        {{ detailError.summary }}：{{ detailError.detail }}
        <button type="button" @click="emit('openSnapshot', selectedSnapshotId)">重试</button>
      </div>
      <div v-else-if="detail" class="detail-panels">
        <dl class="detail-summary">
          <div><dt>标签</dt><dd>{{ detail.label || '—' }}</dd></div>
          <div><dt>状态</dt><dd>{{ detail.status }}</dd></div>
          <div><dt>生成时间</dt><dd>{{ detail.generatedAtUtc || '—' }}</dd></div>
          <div><dt>零原始行持久化</dt><dd>{{ detail.zeroRawRowsPersisted === true ? '是' : detail.zeroRawRowsPersisted === false ? '否' : '未声明' }}</dd></div>
          <div><dt>源快照</dt><dd><code>{{ detail.sourceSnapshotId || '—' }}</code></dd></div>
        </dl>
        <section aria-labelledby="sources-title">
          <h4 id="sources-title">源数据规模</h4>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr><th scope="col">角色</th><th scope="col">规模</th></tr>
              </thead>
              <tbody>
                <tr v-for="source in detail.sources" :key="source.role">
                  <th scope="row">{{ source.role }}</th>
                  <td>{{ source.rows ?? '—' }} 行 · {{ source.bytes ?? '—' }} B</td>
                </tr>
                <tr v-if="detail.sources.length === 0"><td colspan="2" class="panel-empty">无源文件信息</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="artifacts-title">
          <h4 id="artifacts-title">分析产物</h4>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr><th scope="col">分析</th><th scope="col">类型</th><th scope="col">阶段</th><th scope="col">质量</th><th scope="col">因果状态</th></tr>
              </thead>
              <tbody>
                <tr v-for="artifact in detail.artifacts" :key="artifact.analysisId">
                  <th scope="row"><code>{{ artifact.analysisId }}</code></th>
                  <td>{{ artifact.artifactKind }}</td>
                  <td>{{ artifact.evidenceStage }}</td>
                  <td>{{ artifact.qualityGrade }}</td>
                  <td>{{ artifact.causalStatus }}</td>
                </tr>
                <tr v-if="detail.artifacts.length === 0"><td colspan="5" class="panel-empty">无分析产物</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="boundary-panel" aria-labelledby="boundary-title">
          <h4 id="boundary-title">公开边界</h4>
          <ul>
            <li>快照记录数据规模、审阅阶段和分析来源。</li>
            <li>登记后可在项目中选择这些已审阅数据。</li>
            <li>证据支持描述性边界与仿真压力测试记录；因果结论仅在独立试点数据审查后成立。</li>
          </ul>
        </section>
      </div>
    </section>

    <section class="audit-links" aria-labelledby="audit-title">
      <h3 id="audit-title">结果审计入口</h3>
      <p class="tab-intro">结果级校验与发布门禁随结果来源绑定。</p>
      <ul>
        <li><RouterLink to="/campus-pulse/results/resource-policy-r1/evidence?source=offline-hero">真实 LLM 资源分配结果审计</RouterLink></li>
        <li><RouterLink to="/campus-pulse/results?source=offline-hero">结果中心</RouterLink></li>
        <li><RouterLink to="/campus-pulse/forum?source=offline-hero">调查论坛</RouterLink></li>
      </ul>
    </section>

    <div
      v-if="confirmRegisterKey"
      class="dialog-layer"
      role="presentation"
      @click.self="closeConfirm"
      @keydown.esc="closeConfirm"
    >
      <div class="register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-title">
        <h4 id="register-title">登记审阅数据</h4>
        <p>将以下数据集登记到工作台，供项目配置使用：</p>
        <dl class="register-facts">
          <div><dt>标签</dt><dd>{{ selectedRelease?.label || '—' }}</dd></div>
        </dl>
        <div class="dialog-actions">
          <button ref="confirmCancelButton" type="button" class="secondary" :disabled="registering" @click="closeConfirm">取消</button>
          <button type="button" class="primary" :disabled="registering" @click="confirmRegister">{{ registering ? '登记中…' : '确认登记' }}</button>
        </div>
      </div>
    </div>
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
section > h4 { margin:var(--cp-space-3) 0 var(--cp-space-2); font-size:var(--cp-text-sm); }
.loading { padding:var(--cp-space-4); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.inline-error { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); align-items:center; padding:var(--cp-space-3); border:1px solid var(--cp-danger); background:var(--cp-danger-surface); color:var(--cp-danger); font-size:var(--cp-text-sm); }
.inline-error button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-danger); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-danger); font-weight:650; cursor:pointer; }
.table-scroll { max-width:100%; min-width:0; overflow-x:auto; overscroll-behavior-inline:contain; }
.data-table { width:100%; min-width:50rem; border-collapse:collapse; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.data-table th, .data-table td { padding:var(--cp-space-2) var(--cp-space-3); border-bottom:1px solid var(--cp-border-subtle); text-align:left; vertical-align:top; font-size:var(--cp-text-sm); }
.data-table thead th { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; white-space:nowrap; }
.data-table tbody th { font-weight:700; }
.data-table tbody th small, .detail-id { display:block; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:400; }
.data-table code { font-family:var(--cp-font-mono); font-size:var(--cp-text-xs); overflow-wrap:anywhere; }
.row-action { border:0; padding:0; background:none; color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:650; text-decoration:underline; cursor:pointer; }
.row-action:disabled { opacity:.5; cursor:not-allowed; }
.back { margin:0 0 var(--cp-space-2); }
.muted { color:var(--cp-text-muted); }
.panel-empty { padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.privacy-note { margin:var(--cp-space-2) 0 0; color:var(--cp-evidence-text); font-size:var(--cp-text-xs); }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
.detail-panels { display:grid; gap:var(--cp-space-3); }
.detail-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(13rem,1fr)); gap:var(--cp-space-2); margin:0; padding:var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.detail-summary dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.detail-summary dd { margin:var(--cp-space-1) 0 0; overflow-wrap:anywhere; font-size:var(--cp-text-sm); font-weight:650; }
.detail-summary code { font-family:var(--cp-font-mono); }
.boundary-panel { padding:var(--cp-space-3) var(--cp-space-4); border:1px solid var(--cp-evidence); background:var(--cp-evidence-surface); }
.boundary-panel h4 { margin:0 0 var(--cp-space-2); color:var(--cp-evidence-text); font-size:var(--cp-text-sm); }
.boundary-panel ul { margin:0; padding-left:1.25rem; color:var(--cp-evidence-text); font-size:var(--cp-text-sm); line-height:var(--cp-leading-normal); }
.audit-links ul { display:grid; gap:var(--cp-space-1); margin:0; padding-left:1.25rem; }
.audit-links a { color:var(--cp-evidence-text); font-weight:650; }
.dialog-layer { position:fixed; inset:0; z-index:var(--cp-z-drawer-backdrop); display:grid; place-items:center; padding:var(--cp-space-4); background:var(--cp-overlay); }
.register-dialog { width:min(34rem,100%); padding:var(--cp-space-5); border:1px solid var(--cp-border-inverse); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-drawer); }
.register-dialog h4 { margin:0 0 var(--cp-space-2); font-size:var(--cp-text-lg); }
.register-dialog p { margin:0 0 var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.register-facts { display:grid; gap:var(--cp-space-2); margin:0 0 var(--cp-space-4); }
.register-facts dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.register-facts dd { margin:0; overflow-wrap:anywhere; font-size:var(--cp-text-sm); }
.register-facts code { font-family:var(--cp-font-mono); }
.dialog-actions { display:flex; justify-content:flex-end; gap:var(--cp-space-2); }
.dialog-actions button { min-height:var(--cp-control-height); padding:0 var(--cp-space-4); border-radius:var(--cp-radius-sm); font-weight:650; cursor:pointer; }
.dialog-actions .secondary { border:1px solid var(--cp-border-strong); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.dialog-actions .primary { border:1px solid var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-text-inverse); }
.dialog-actions .primary:disabled, .dialog-actions .secondary:disabled { opacity:.6; cursor:not-allowed; }
@media (max-width:767px) {
  .tab-head { align-items:flex-start; flex-direction:column; }
  .refresh { min-height:var(--cp-touch-target); }
}
</style>
