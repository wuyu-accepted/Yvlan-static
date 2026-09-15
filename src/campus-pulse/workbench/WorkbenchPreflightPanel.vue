<script lang="ts">
export interface WorkbenchPreflightCheck {
  label: string
  ok: boolean
  note: string
}

export interface WorkbenchPreflightSnapshot {
  projectId: string
  checks: WorkbenchPreflightCheck[]
  ready: boolean
  tokenBudget: number | null
  tokenContractValid: boolean
  tokenContractNote: string
  selectedScenarioName: string | null
  sealedLineage: boolean
  eligiblePolicyCount: number
  providerBatches: number | null
  modelName: string
  maxWorkers: number | null
  frozenTokenLimit: number | null
}

const retainedSnapshots = new Map<string, WorkbenchPreflightSnapshot>()

export function retainWorkbenchPreflightSnapshot(snapshot: WorkbenchPreflightSnapshot): void {
  retainedSnapshots.set(snapshot.projectId, snapshot)
}

export function readWorkbenchPreflightSnapshot(projectId: string | undefined): WorkbenchPreflightSnapshot | null {
  return projectId ? retainedSnapshots.get(projectId) ?? null : null
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { currentLocale } from '../i18n/locale.ts'
import type { RuntimeSummaryVM, WorkbenchAccess } from './workbenchViewModel.ts'

const props = defineProps<{
  access: WorkbenchAccess
  snapshot: WorkbenchPreflightSnapshot | null
  runtime: RuntimeSummaryVM | null
  hasRun: boolean
}>()

const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString()
}

const progress = computed(() => {
  if (!props.hasRun || props.runtime?.progressFraction === null || props.runtime?.progressFraction === undefined) return null
  return Math.round(props.runtime.progressFraction * 100)
})
</script>

<template>
  <section class="preflight-panel" aria-labelledby="workbench-preflight-title">
    <header>
      <div>
        <p>PRE-FLIGHT</p>
        <h2 id="workbench-preflight-title">{{ l('运行前检查', 'Run readiness') }}</h2>
      </div>
      <CpStatusBadge :tone="snapshot?.ready && access === 'interactive' ? 'success' : 'warning'">
        {{ snapshot?.ready && access === 'interactive' ? l('就绪', 'Ready') : l('未就绪', 'Not ready') }}
      </CpStatusBadge>
    </header>

    <p v-if="!snapshot" class="pending-note">
      {{ l('打开“运行合同”后，这里会保留当前真实配置与检查结果。', 'Open Run Contract to load and retain its current configuration and checks here.') }}
    </p>

    <dl class="facts">
      <div>
        <dt>{{ l('Token 预算', 'Token budget') }}</dt>
        <dd>{{ formatCount(snapshot?.tokenBudget) }}</dd>
      </div>
      <div>
        <dt>{{ l('Token 合同', 'Token contract') }}</dt>
        <dd>{{ snapshot ? (snapshot.tokenContractValid ? l('有效', 'Valid') : l('无效', 'Invalid')) : l('未知', 'Unknown') }}</dd>
      </div>
      <div>
        <dt>{{ l('模型', 'Model') }}</dt>
        <dd class="truncate" :title="snapshot?.modelName || ''">{{ snapshot?.modelName || '—' }}</dd>
      </div>
      <div>
        <dt>{{ l('最大 Worker', 'Max workers') }}</dt>
        <dd>{{ formatCount(snapshot?.maxWorkers) }}</dd>
      </div>
      <div>
        <dt>{{ l('可用政策', 'Eligible policies') }}</dt>
        <dd>{{ snapshot ? formatCount(snapshot.eligiblePolicyCount) : '—' }}</dd>
      </div>
      <div>
        <dt>{{ l('调用批次', 'Provider batches') }}</dt>
        <dd>{{ formatCount(snapshot?.providerBatches) }}</dd>
      </div>
      <div>
        <dt>{{ l('冻结 Token 上限', 'Frozen token limit') }}</dt>
        <dd>{{ formatCount(snapshot?.frozenTokenLimit) }}</dd>
      </div>
      <div>
        <dt>{{ l('耗时估计', 'Runtime estimate') }}</dt>
        <dd>{{ l('不可用', 'Not available') }}</dd>
      </div>
    </dl>

    <section v-if="snapshot" class="checks" :aria-label="l('计划就绪状态', 'Plan readiness checks')">
      <h3>{{ l('检查项', 'Checks') }}</h3>
      <ul>
        <li v-for="check in snapshot.checks" :key="check.label" :class="check.ok ? 'ok' : 'blocked'">
          <span aria-hidden="true" />
          <div><strong>{{ check.label }}</strong><small>{{ check.note }}</small></div>
        </li>
      </ul>
    </section>

    <section v-if="hasRun && runtime" class="runtime" :aria-label="l('实际运行状态', 'Actual runtime state')">
      <h3>{{ l('实际运行', 'Actual runtime') }}</h3>
      <div v-if="progress !== null" class="progress">
        <span :style="{ width: `${progress}%` }" /><b>{{ progress }}%</b>
      </div>
      <dl>
        <div><dt>{{ l('Token 使用', 'Token use') }}</dt><dd>{{ formatCount(runtime.tokensUsed) }} / {{ formatCount(runtime.tokenLimit) }}</dd></div>
        <div><dt>{{ l('已完成轮次', 'Completed turns') }}</dt><dd>{{ formatCount(runtime.turnsCompleted) }} / {{ formatCount(runtime.turnsReserved) }}</dd></div>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.preflight-panel { display:grid; gap:var(--cp-space-3); padding:var(--cp-space-3); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); color:var(--cp-text-primary); }
header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-2); padding-bottom:var(--cp-space-2); border-bottom:1px solid var(--cp-border-default); }
header p { margin:0 0 var(--cp-space-1); color:var(--cp-action-primary); font:750 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.1em; }
h2,h3 { margin:0; }
h2 { font-size:var(--cp-text-lg); }
h3 { font-size:var(--cp-text-sm); }
.pending-note { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:var(--cp-leading-relaxed); }
.facts { display:grid; grid-template-columns:1fr 1fr; margin:0; border-top:1px solid var(--cp-border-subtle); border-left:1px solid var(--cp-border-subtle); }
.facts div { min-width:0; padding:var(--cp-space-2); border-right:1px solid var(--cp-border-subtle); border-bottom:1px solid var(--cp-border-subtle); }
dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
dd { margin:var(--cp-space-1) 0 0; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:700; font-variant-numeric:tabular-nums; }
.truncate { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.checks { display:grid; gap:var(--cp-space-2); }
.checks ul { display:grid; gap:0; margin:0; padding:0; list-style:none; }
.checks li { display:grid; grid-template-columns:.55rem minmax(0,1fr); gap:var(--cp-space-2); padding:var(--cp-space-2) 0; border-bottom:1px solid var(--cp-border-subtle); }
.checks li>span { width:.5rem; height:.5rem; margin-top:.25rem; border-radius:50%; background:var(--cp-warning); }
.checks li.ok>span { background:var(--cp-success); }
.checks li div { display:grid; gap:2px; min-width:0; }
.checks strong { font-size:var(--cp-text-xs); }
.checks small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.runtime { display:grid; gap:var(--cp-space-2); padding-top:var(--cp-space-2); border-top:1px solid var(--cp-border-default); }
.runtime dl { display:grid; gap:var(--cp-space-2); margin:0; }
.runtime dl div { display:flex; justify-content:space-between; gap:var(--cp-space-2); }
.progress { position:relative; height:.4rem; overflow:hidden; background:var(--cp-surface-subtle); }
.progress span { display:block; height:100%; background:var(--cp-action-primary); }
.progress b { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
@media (max-width:1279px) { .facts { grid-template-columns:repeat(4,minmax(0,1fr)); } .checks ul { grid-template-columns:repeat(3,minmax(0,1fr)); column-gap:var(--cp-space-3); } }
@media (max-width:767px) { .facts { grid-template-columns:1fr 1fr; } .checks ul { grid-template-columns:1fr; } }
</style>
