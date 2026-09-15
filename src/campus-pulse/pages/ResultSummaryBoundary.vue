<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ApiProblemPanel from '../components/ApiProblemPanel.vue'
import CpSkeleton from '../components/CpSkeleton.vue'
import SourcePicker from '../components/SourcePicker.vue'
import ResultContextHeader from '../results/ResultContextHeader.vue'
import ResultRouteTabs from '../results/ResultRouteTabs.vue'
import { buildResultAnalysis } from '../results/resultsAnalysis.ts'
import { RESULT_DETAIL_CONTEXT, type ResultDetailContext } from '../results/resultDetailContext.ts'
import type { ResolveState } from '../source/resultResolver'
import { ResultResolver } from '../source/resultResolver'
import { canonicalResultLocation } from '../source/routeResolver'
import {
  HERO_RESULT_KEY,
  HERO_SOURCE_KEY,
  LECTURE_HERO_RESULT_KEY,
  LECTURE_HERO_SOURCE_KEY,
  LIVE_SOURCE_KEY,
  sourceDescriptorsForRun,
} from '../source/registry'
import { publishSourceProblem, publishSourceState } from '../source/sourceContext'
import type { ResultSourceDescriptor, SourceState } from '../contracts/source'
import type { ResultViewModel } from '../domain/viewModels.ts'
import type { ResultAnalysisVM } from '../results/resultsAnalysis'
import { currentLocale, translateInterfaceText } from '../i18n/locale.ts'
import BranchGuide from '../results/BranchGuide.vue'
import type { GovernanceBranchId } from '../results/branchPresentation.ts'

const route = useRoute()
const router = useRouter()
const resolver = new ResultResolver()
const state = ref<ResolveState>({ status: 'idle' })
const analysis = shallowRef<ResultAnalysisVM | null>(null)
const isEnglish = computed(() => currentLocale.value === 'en-US')
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'
const sourceBoundarySummary = computed(() => {
  const value = result.value?.source.boundarySummary || ''
  return isEnglish.value ? translateInterfaceText(value) : value
})
const visibleBranches = computed<GovernanceBranchId[]>(() => result.value?.summary.explanationMessages === null
  ? ['Natural','D']
  : ['Natural','A','D'])

const request = computed(() => canonicalResultLocation({
  source: route.query.source,
  resultKey: route.params.resultKey,
}))
// Only source-bearing route fields require a manifest reload. Presentation
// controls such as tick, metric and branch must update in place so that a
// timeline interaction cannot collapse the page and move the user's scroll.
const resolutionIdentity = computed(() => JSON.stringify({
  resultKey: route.params.resultKey,
  source: route.query.source,
  runId: request.value.runId,
  fallbackFrom: route.query.fallback_from,
}))
let resolvedIdentity = ''
const sourceOptions = computed(() => {
  const descriptors = sourceDescriptorsForRun(request.value.runId)
  return publicDemo ? descriptors.filter((item) => item.mode !== 'live_api') : descriptors
})
const disabledReasons = computed(() => publicDemo || request.value.runId ? {} : {
  [LIVE_SOURCE_KEY]: 'Live API 需要 run id 才能直接打开结果。',
})
const result = computed<ResultViewModel | null>(() => state.value.status === 'success' || state.value.status === 'partial'
  ? state.value.value
  : null)
const problem = computed(() => state.value.status === 'error' || state.value.status === 'not_ready'
  ? state.value.problem
  : null)

function pendingSource(descriptor: ResultSourceDescriptor): SourceState {
  return {
    key: descriptor.key,
    mode: descriptor.mode,
    label: descriptor.label,
    verification: 'unverified',
    freshness: { status: 'unknown' },
    availability: { backend: 'unknown', access: 'readonly' },
    provenance: {
      runId: request.value.runId,
      evidenceId: descriptor.key === HERO_SOURCE_KEY
        ? 'resource-policy-live-r1'
        : descriptor.key === LECTURE_HERO_SOURCE_KEY
          ? 'lecture-open-choice-r4'
          : undefined,
      origin: descriptor.mode === 'live_api' ? 'CampusPulse result API' : 'sealed offline public asset',
      manifestAvailable: Boolean(descriptor.manifestUrl || descriptor.hashUrl),
    },
    publicationEligible: descriptor.declaredPublication === 'server'
      ? null
      : descriptor.declaredPublication,
    boundaries: descriptor.boundaries,
    boundarySummary: descriptor.mode === 'live_api'
      ? 'Live API 结果需要后端返回可校验的 manifest 后才可发布。'
      : '离线审计案例为只读数据，正文经 SHA 摘要校验。',
  }
}

async function resolve() {
  const identity = resolutionIdentity.value
  const routeKey = route.fullPath
  if (request.value.needsReplace) {
    await router.replace({
      name: 'campus-pulse-result-summary',
      params: { resultKey: HERO_RESULT_KEY },
      query: { source: HERO_SOURCE_KEY },
    })
    return
  }
  const descriptor = sourceOptions.value.find((item) => item.key === request.value.sourceKey)
  if (descriptor) {
    state.value = { status: 'loading', source: descriptor }
    publishSourceState(routeKey, pendingSource(descriptor))
  }
  const next = await resolver.resolve(request.value.sourceKey, request.value.runId)
  if (identity !== resolutionIdentity.value) return
  if (next.status === 'success' && route.query.fallback_from) {
    const source = {
      ...next.source,
      fallback: {
        from: String(route.query.fallback_from).replace('-', '_') as any,
        reason: '用户已选择切换到经校验的离线审计案例。',
        selectedBy: 'user' as const,
      },
    }
    next.source = source
    next.value.source = source
  }
  state.value = next
  resolvedIdentity = identity
  if (next.status === 'success' || next.status === 'partial') {
    analysis.value = buildResultAnalysis(next.value)
  } else {
    analysis.value = null
  }
  const currentRouteKey = route.fullPath
  if (next.status === 'success' || next.status === 'partial') publishSourceState(currentRouteKey, next.source)
  if (next.status === 'error' || next.status === 'not_ready') publishSourceProblem(currentRouteKey, next.problem)
}

function publishResolvedSourceForPresentationRoute(routeKey: string) {
  if (resolvedIdentity !== resolutionIdentity.value) return
  if (state.value.status === 'success' || state.value.status === 'partial') {
    publishSourceState(routeKey, state.value.source)
  }
  if (state.value.status === 'error' || state.value.status === 'not_ready') {
    publishSourceProblem(routeKey, state.value.problem)
  }
}

function selectSource(key: string) {
  if (key === LIVE_SOURCE_KEY && !request.value.runId) return
  const offlineResultKey = key === HERO_SOURCE_KEY
    ? HERO_RESULT_KEY
    : key === LECTURE_HERO_SOURCE_KEY
      ? LECTURE_HERO_RESULT_KEY
      : request.value.runId
  router.push({
    name: 'campus-pulse-result-summary',
    params: { resultKey: offlineResultKey },
    query: { source: key },
  })
}

function openOffline() {
  router.push({
    name: 'campus-pulse-result-summary',
    params: { resultKey: HERO_RESULT_KEY },
    query: { source: HERO_SOURCE_KEY, fallback_from: request.value.sourceKey },
  })
}

const detailContext: ResultDetailContext = {
  state,
  analysis,
  result,
  request,
  reload: resolve,
}
provide(RESULT_DETAIL_CONTEXT, detailContext)

watch(resolutionIdentity, resolve)
watch(() => route.fullPath, publishResolvedSourceForPresentationRoute)
onMounted(resolve)
onBeforeUnmount(() => resolver.dispose())
</script>

<template>
  <div class="result-detail-layout">
    <div v-if="state.status === 'loading'" class="result-detail-layout__loading" role="status" aria-live="polite">
      <span>正在校验结果 manifest…</span><CpSkeleton :rows="6" />
    </div>

    <ApiProblemPanel
      v-else-if="problem"
      :problem="problem"
      :offline-available="request.sourceKey === LIVE_SOURCE_KEY"
      @retry="resolve"
      @open-offline="openOffline"
      @return-to-runs="router.push('/campus-pulse/workbench')"
      @inspect-evidence="router.push('/campus-pulse/system')"
    />

    <template v-else-if="result && analysis">
      <section v-if="route.query.fallback_from" class="fallback-notice" role="status">
        <i class="fa-solid fa-arrow-down" aria-hidden="true" />
        <div><strong>已切换至离线审计案例</strong><p>来源 {{ route.query.fallback_from }} 加载失败或未经验证；当前展示只读案例，不会静默替换 Live 结果。</p></div>
      </section>

      <ResultContextHeader :analysis="analysis" />

      <section class="result-context-tools" :aria-label="isEnglish ? 'Run context' : '运行上下文'">
        <div class="result-source-line">
          <SourcePicker
            :sources="sourceOptions"
            :selected-key="request.sourceKey"
            :disabled-reasons="disabledReasons"
            @select="selectSource"
          />
          <div class="result-source-line__boundary">
            <i class="fa-solid fa-shield-halved" aria-hidden="true" />
            <p><strong>{{ isEnglish ? 'Evidence boundary' : '证据边界' }}</strong><span>{{ sourceBoundarySummary }}</span></p>
            <RouterLink :to="{ name: 'campus-pulse-result-evidence', params: { resultKey: result.key }, query: { source: result.source.key } }">{{ isEnglish ? 'View evidence' : '查看证据' }}</RouterLink>
          </div>
        </div>

        <BranchGuide :result-key="result.key" :branches="visibleBranches" />
      </section>

      <ResultRouteTabs :result="result" />

      <div class="result-detail-layout__body">
        <RouterView />
      </div>
    </template>
  </div>
</template>

<style scoped>
.result-detail-layout { width:100%; min-width:0; max-width:100%; overflow-x:hidden; color:var(--cp-text-primary); }
.result-detail-layout__loading { max-width:76rem; margin:var(--cp-space-6) auto; }
.result-detail-layout__loading > span { display:block; margin:var(--cp-space-4) var(--cp-space-4) 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.fallback-notice { display:flex; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-content-gutter); border-bottom:1px solid var(--cp-warning); background:var(--cp-warning-surface); color:var(--cp-text-primary); }
.fallback-notice i { margin-top:.2rem; color:var(--cp-warning); }
.fallback-notice strong { display:block; }
.fallback-notice p { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.result-context-tools { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-3) var(--cp-content-gutter); border-bottom:1px solid var(--cp-border-subtle); background:var(--cp-surface-subtle); }
.result-source-line { display:grid; grid-template-columns:minmax(24rem,.82fr) minmax(0,1.18fr); align-items:stretch; gap:var(--cp-space-2); }
.result-source-line :deep(.source-picker) { grid-template-columns:auto minmax(0,1fr); align-items:center; gap:var(--cp-space-2); padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); }
.result-source-line :deep(.source-picker label) { color:var(--cp-text-muted); white-space:nowrap; }
.result-source-line :deep(.source-picker select) { min-height:2.25rem; border-color:var(--cp-border-strong); background:var(--cp-surface-default); font-size:var(--cp-text-sm); font-weight:650; }
.result-source-line :deep(.source-picker__hint) { grid-column:2; }
.result-source-line__boundary { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:var(--cp-space-3); min-width:0; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); }
.result-source-line__boundary>i { display:grid; width:2rem; height:2rem; place-items:center; border-radius:50%; background:var(--cp-evidence-surface); color:var(--cp-evidence); font-size:var(--cp-text-xs); }
.result-source-line__boundary p { display:grid; min-width:0; gap:.12rem; margin:0; }
.result-source-line__boundary strong { color:var(--cp-text-primary); font-size:var(--cp-text-xs); }
.result-source-line__boundary span { overflow:hidden; color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); text-overflow:ellipsis; white-space:nowrap; }
.result-source-line__boundary a { padding:var(--cp-space-2); border-radius:var(--cp-radius-sm); color:var(--brand-red); font-size:var(--cp-text-xs); font-weight:700; text-decoration:none; white-space:nowrap; }
.result-source-line__boundary a:hover { background:var(--cp-surface-selected); }
.result-detail-layout__body { box-sizing:border-box; width:min(100%,var(--cp-content-max)); min-width:0; margin:0 auto; padding:var(--cp-space-5) var(--cp-content-gutter) var(--cp-space-8); }
@media (max-width:1023px) { .result-source-line { grid-template-columns:1fr; } }
@media (max-width:767px) { .result-context-tools { padding-inline:var(--cp-space-4); }.result-source-line :deep(.source-picker) { grid-template-columns:1fr; }.result-source-line :deep(.source-picker__hint) { grid-column:1; }.result-source-line__boundary { grid-template-columns:auto minmax(0,1fr); }.result-source-line__boundary a { grid-column:2; justify-self:start; padding-left:0; }.result-source-line__boundary span { white-space:normal; }.result-detail-layout__body { padding:var(--cp-space-4); } .fallback-notice { padding-inline:var(--cp-space-4); } }
</style>
