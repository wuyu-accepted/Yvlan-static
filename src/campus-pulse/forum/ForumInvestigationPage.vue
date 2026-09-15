<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createApiProblem } from '../api/http.ts'
import {
  HERO_RESULT_KEY,
  HERO_SOURCE_KEY,
  LECTURE_HERO_RESULT_KEY,
  LECTURE_HERO_SOURCE_KEY,
  LIVE_SOURCE_KEY,
  getSourceDescriptor,
} from '../source/registry.ts'
import { ResultResolver, type ResolveState } from '../source/resultResolver.ts'
import { publishSourceProblem, publishSourceState } from '../source/sourceContext.ts'
import type { ResultMetricKey, ResultViewModel } from '../source/forumTwinAdapter.ts'
import {
  returnToResultLocation,
  workspaceFromQuery,
  type ForumBranchView,
  type ForumInspectorTab,
  type ForumWorkspaceState,
} from './forumWorkspaceState.ts'
import {
  agentActivity,
  buildForumInvestigation,
  visibleMessagesForThread,
  type ForumInvestigationVM,
} from './forumInvestigation.ts'
import ForumContextHeader from './ForumContextHeader.vue'
import ForumToolbar from './ForumToolbar.vue'
import LiveForumStage from './LiveForumStage.vue'
import BranchPane from './BranchPane.vue'
import ContextInspector from './ContextInspector.vue'
import ThreadReader from './ThreadReader.vue'
import ClaimLineage from './ClaimLineage.vue'
import AgentExplain from './AgentExplain.vue'
import GovernancePanel from './GovernancePanel.vue'
import EvidenceDetails from './EvidenceDetails.vue'
import OverviewTimeline from '../overview/OverviewTimeline.vue'
import ApiProblemPanel from '../components/ApiProblemPanel.vue'
import CpSkeleton from '../components/CpSkeleton.vue'
import CpStatePanel from '../components/CpStatePanel.vue'
import CaseAgentEvolution from '../agent-world/CaseAgentEvolution.vue'
import { currentLocale } from '../i18n/locale.ts'
import { branchDisplayName, type GovernanceBranchId } from '../results/branchPresentation.ts'

const INVESTIGATION_METRICS: ResultMetricKey[] = ['messages', 'threads', 'claims', 'corrections', 'help_requests']

const route = useRoute()
const router = useRouter()
const resolver = new ResultResolver()
const resolveState = ref<ResolveState>({ status: 'idle' })
const playing = ref(false)
const playbackTick = ref<number | null>(null)
const demoAutoStarted = ref(false)
let generation = 0
let playTimer: ReturnType<typeof setInterval> | undefined
let reducedMotion = false

const result = computed<ResultViewModel | null>(() => (
  resolveState.value.status === 'success' || resolveState.value.status === 'partial'
    ? resolveState.value.value
    : null
))
const branchName = (branch: GovernanceBranchId) => branchDisplayName(result.value?.key || '', branch, currentLocale.value === 'en-US')

function effectiveSource(raw: ForumWorkspaceState): string {
  if (raw.source) return raw.source
  return raw.runId ? LIVE_SOURCE_KEY : HERO_SOURCE_KEY
}

const workspace = computed<ForumWorkspaceState>(() => {
  const routed = workspaceFromQuery(route.query as Record<string, unknown>, INVESTIGATION_METRICS)
  const raw = playbackTick.value === null ? routed : { ...routed, tick: playbackTick.value }
  const source = effectiveSource(raw)
  const runId = raw.runId || (source === LIVE_SOURCE_KEY ? raw.resultKey || undefined : undefined)
  const resultKey = raw.resultKey
    || (source === HERO_SOURCE_KEY
      ? HERO_RESULT_KEY
      : source === LECTURE_HERO_SOURCE_KEY
        ? LECTURE_HERO_RESULT_KEY
        : runId || '')
  return { ...raw, source, runId, resultKey }
})

const investigation = computed<ForumInvestigationVM | null>(() => (
  result.value ? buildForumInvestigation(result.value, workspace.value) : null
))

const scenarios = computed(() => result.value?.scope.scenarios.map((id) => ({
  id,
  label: id === result.value!.scope.scenarios[0] ? result.value!.scope.scenarioLabel : id,
})) || [])

const selectedThread = computed(() => {
  const threadId = workspace.value.thread
  if (!threadId || !investigation.value) return null
  return investigation.value.threads.natural.concat(investigation.value.threads.A, investigation.value.threads.D)
    .find((item) => item.thread.thread_id === threadId && (!workspace.value.agentBranch || item.branch === workspace.value.agentBranch))?.thread || null
})

const selectedThreadMessages = computed(() => {
  const threadId = workspace.value.thread
  if (!threadId || !investigation.value) return []
  return visibleMessagesForThread(result.value!, threadId, investigation.value.tick, selectedThread.value?.branch_id)
})

const selectedClaim = computed(() => {
  const claimId = workspace.value.claim
  if (!claimId || !result.value) return null
  return (result.value.forum?.claims || []).find((claim) => claim.claim_id === claimId && (!workspace.value.agentBranch || claim.branch_id === workspace.value.agentBranch)) || null
})

const selectedClaimMessages = computed(() => {
  const claim = selectedClaim.value
  const messages = result.value?.forum?.messages || []
  if (!claim) return { supporting: [], challenging: [] }
  return {
    supporting: messages.filter((message) => claim.supporting_message_ids.includes(message.message_id)),
    challenging: messages.filter((message) => claim.challenging_message_ids.includes(message.message_id)),
  }
})

const selectedAgentBranch = computed<'natural' | 'A' | 'D' | undefined>(() => {
  if (workspace.value.agentBranch) return workspace.value.agentBranch
  const thread = selectedThread.value
  if (thread) return thread.branch_id
  const claim = selectedClaim.value
  if (claim) return claim.branch_id
  return undefined
})

const selectedAgentActivity = computed(() => {
  const agentId = workspace.value.agent
  if (!agentId || !investigation.value || !result.value) return null
  if (selectedAgentBranch.value) {
    return agentActivity(result.value, selectedAgentBranch.value, investigation.value.tick)
      .find((item) => item.displayId === agentId) || null
  }
  const natural = agentActivity(result.value, 'natural', investigation.value.tick).find((item) => item.displayId === agentId)
  const explanation = agentActivity(result.value, 'A', investigation.value.tick).find((item) => item.displayId === agentId)
  const intervention = agentActivity(result.value, 'D', investigation.value.tick).find((item) => item.displayId === agentId)
  if (!natural && !explanation && !intervention) return null
  return {
    displayId: agentId,
    branch: 'both',
    messageCount: (natural?.messageCount || 0) + (explanation?.messageCount || 0) + (intervention?.messageCount || 0),
    firstTick: Math.min(natural?.firstTick ?? Number.POSITIVE_INFINITY, explanation?.firstTick ?? Number.POSITIVE_INFINITY, intervention?.firstTick ?? Number.POSITIVE_INFINITY),
    lastTick: Math.max(natural?.lastTick ?? -1, explanation?.lastTick ?? -1, intervention?.lastTick ?? -1),
    actions: [...new Set([...(natural?.actions || []), ...(explanation?.actions || []), ...(intervention?.actions || [])])],
    topics: [...new Set([...(natural?.topics || []), ...(explanation?.topics || []), ...(intervention?.topics || [])])],
    profileAvailable: Boolean(natural?.profileAvailable || explanation?.profileAvailable || intervention?.profileAvailable),
  }
})

const selectedAgentProfile = computed(() => {
  const agentId = workspace.value.agent
  return (result.value?.forum?.profiles || []).find((profile) => profile.display_id === agentId) || null
})

const evidenceRef = computed(() => selectedClaim.value?.evidence_reference || null)

const inspectorOpen = computed(() => Boolean(
  workspace.value.thread || workspace.value.claim || workspace.value.agent
  || workspace.value.inspector === 'governance' || workspace.value.inspector === 'evidence',
))

const inspectorSelectionLabel = computed(() => {
  if (workspace.value.thread) return selectedThread.value?.topic || workspace.value.thread
  if (workspace.value.claim) return selectedClaim.value?.summary || workspace.value.claim
  if (workspace.value.agent) return workspace.value.agent
  if (workspace.value.inspector === 'governance') return `治理过程 · Tick ${investigation.value?.tick ?? ''}`
  if (workspace.value.inspector === 'evidence') return `证据与溯源 · ${workspace.value.resultKey}`
  return '调查对象'
})

const sourceVerified = computed(() => result.value?.source.verification === 'verified')
const readonly = computed(() => result.value?.source.availability.access === 'readonly')
const demoMode = computed(() => route.query.demo === 'workbench')
const demoProjectId = computed(() => typeof route.query.project_id === 'string' ? route.query.project_id : '')

function updateQuery(patch: Record<string, string | undefined>, replace = false) {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries({ ...route.query })) {
    if (typeof value === 'string') query[key] = value
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete query[key]
    else query[key] = value
  }
  const navigation = replace ? router.replace({ query }) : router.push({ query })
  return navigation
}

async function load() {
  const current = workspace.value
  const descriptor = getSourceDescriptor(current.source)
  if (!descriptor) {
    resolveState.value = {
      status: 'error',
      requestedSource: current.source,
      problem: createApiProblem({
        kind: 'contract', code: 'unknown_source', summary: '请求的数据来源未登记',
        detail: '请选择来源列表中明确登记的来源。', retryable: false, action: 'none', sourceImpact: 'unavailable',
      }),
    }
    return
  }
  const id = ++generation
  resolveState.value = { status: 'loading', source: descriptor }
  const next = await resolver.resolve(current.source, current.runId)
  if (id !== generation) return
  resolveState.value = next
  if (next.status === 'success' || next.status === 'partial') {
    publishSourceState(route.fullPath, next.value.source)
  } else if (next.status === 'error' || next.status === 'not_ready') {
    publishSourceProblem(route.fullPath, next.problem)
  }
  if ((next.status === 'success' || next.status === 'partial') && next.value.source) {
    const explicitSource = route.query.source !== next.value.source.key
      || route.query.result !== next.value.key
    if (explicitSource) {
      router.replace({ query: { ...route.query, source: next.value.source.key, result: next.value.key } })
    }
  }
}

watch(
  [
    () => route.query.source,
    () => route.query.run_id,
    () => route.query.result,
  ],
  () => { pause(false); load() },
  { immediate: true },
)

function switchOffline() {
  pause(false)
  const query = {
    ...route.query,
    source: HERO_SOURCE_KEY,
    result: HERO_RESULT_KEY,
    run_id: undefined,
    fallback_from: workspace.value.source,
  } as Record<string, unknown>
  const cleaned: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (typeof value === 'string') cleaned[key] = value
  }
  router.push({ name: 'campus-pulse-forum', query: cleaned })
}

function retry() { load() }

function selectThread(threadId: string, branch: 'natural' | 'A' | 'D') {
  const tick = stopPlayback()
  updateQuery({ tick: tick === undefined ? undefined : String(tick), thread: threadId, claim: undefined, agent: undefined, agent_branch: branch, inspector: 'thread' })
}

function selectClaim(claimId: string) {
  const tick = stopPlayback()
  updateQuery({ tick: tick === undefined ? undefined : String(tick), claim: claimId, agent: undefined, agent_branch: undefined, inspector: 'claim' })
}

function selectAgent(displayId: string, branch: 'natural' | 'A' | 'D') {
  const tick = stopPlayback()
  updateQuery({ tick: tick === undefined ? undefined : String(tick), agent: displayId, agent_branch: branch, inspector: 'agent' })
}

function selectMessage(messageId: string) {
  const message = (result.value?.forum?.messages || []).find((item) => item.message_id === messageId)
  if (!message) return
  const tick = stopPlayback()
  updateQuery({ tick: tick === undefined ? undefined : String(tick), thread: message.thread_id, inspector: 'thread' })
}

function changeInspector(tab: ForumInspectorTab) {
  const tick = stopPlayback()
  updateQuery({ tick: tick === undefined ? undefined : String(tick), inspector: tab })
}

function closeInspector() {
  updateQuery({ thread: undefined, claim: undefined, agent: undefined, agent_branch: undefined, inspector: undefined })
}

function selectMetric(metric: ResultMetricKey) {
  updateQuery({ metric }, true)
}

function selectBranch(branch: ForumBranchView) {
  updateQuery({ branch: branch === 'both' ? undefined : branch }, true)
}

function setSearch(q: string) {
  updateQuery({ q: q || undefined }, true)
}

function setTick(tick: number) {
  stopPlayback()
  updateQuery({ tick: String(tick) }, true)
}

function selectScenario(id: string) {
  pause(false)
  updateQuery({ scenario: id, thread: undefined, claim: undefined, agent: undefined, agent_branch: undefined }, true)
}

function goTick(direction: -1 | 1) {
  const ticks = investigation.value?.tickIds || []
  const index = ticks.indexOf(investigation.value?.tick ?? Number.NaN)
  const next = ticks[index + direction]
  if (typeof next === 'number') setTick(next)
}

function play() {
  if (reducedMotion) return
  if (playing.value) return
  const ticks = investigation.value?.tickIds || []
  if (ticks.length < 2) return
  if (investigation.value?.tick === ticks.at(-1)) {
    playbackTick.value = ticks[0]
  } else {
    playbackTick.value = investigation.value?.tick ?? ticks[0]
  }
  playing.value = true
  playTimer = setInterval(() => {
    const current = investigation.value
    if (!current) { pause(false); return }
    const index = current.tickIds.indexOf(current.tick)
    const next = current.tickIds[index + 1]
    if (typeof next !== 'number') { pause(); return }
    playbackTick.value = next
  }, 1400)
}

function stopPlayback(): number | undefined {
  const tick = playbackTick.value ?? investigation.value?.tick
  playing.value = false
  if (playTimer) { clearInterval(playTimer); playTimer = undefined }
  playbackTick.value = null
  return tick
}

function pause(syncUrl = true) {
  const tick = stopPlayback()
  if (syncUrl && tick !== undefined && route.query.tick !== String(tick)) {
    updateQuery({ tick: String(tick) }, true)
  }
}

function inspectTick(tick: number) {
  // M05 -> M04: open the result summary at this tick.
  const target = returnToResultLocation({ source: workspace.value.source, resultKey: workspace.value.resultKey, metric: workspace.value.metric, tick })
  router.push(target)
}

function returnToResult() {
  const tick = stopPlayback()
  router.push(returnToResultLocation({ ...workspace.value, tick }))
}

function openEvidence() {
  updateQuery({ inspector: 'evidence' })
}

function openResultEvidence() {
  router.push({
    name: 'campus-pulse-result-evidence',
    params: { resultKey: workspace.value.resultKey },
    query: { source: workspace.value.source, tick: workspace.value.tick !== undefined ? String(workspace.value.tick) : undefined },
  })
}

function returnToDemoProject() {
  router.push({
    name: 'campus-pulse-workbench',
    query: demoProjectId.value ? { project: demoProjectId.value, section: 'overview' } : {},
  })
}

function correctedTickNotice(): string {
  if (!investigation.value?.tickCorrected) return ''
  const requested = workspace.value.tick
  return `请求时间步 Tick ${requested} 不在该结果可用范围内，已修正为最近可用的 Tick ${investigation.value.tick}。`
}

watch(() => investigation.value?.tick, (tick, previous) => {
  if (tick === undefined || tick === previous) return
  // Drop selections that fall out of the new tick scope.
  const staleThread = workspace.value.thread && selectedThread.value === null
  const staleClaim = workspace.value.claim && selectedClaim.value === null
  if (staleThread || staleClaim) {
    updateQuery({
      thread: staleThread ? undefined : workspace.value.thread,
      claim: staleClaim ? undefined : workspace.value.claim,
    }, true)
  }
})

watch(() => investigation.value?.tickCorrected, (corrected) => {
  if (corrected && investigation.value) {
    updateQuery({ tick: String(investigation.value.tick) }, true)
  }
})

watch(
  [() => resolveState.value.status, () => route.query.autoplay, () => result.value?.key],
  async ([status, autoplay]) => {
    if (status !== 'success' && status !== 'partial') return
    if (autoplay !== '1' || demoAutoStarted.value) return
    demoAutoStarted.value = true
    await nextTick()
    play()
  },
)

watch([() => route.query.source, () => route.query.result], () => {
  demoAutoStarted.value = false
})

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
onBeforeUnmount(() => {
  resolver.dispose()
  pause(false)
})
</script>

<template>
  <div class="forum-investigation-page">
    <div v-if="resolveState.status === 'loading'" class="forum-loading" role="status" aria-live="polite">
      <span>正在校验并加载论坛模拟数据…</span>
      <CpSkeleton :rows="8" />
    </div>

    <ApiProblemPanel
      v-else-if="resolveState.status === 'error' || resolveState.status === 'not_ready'"
      :problem="resolveState.problem"
      :offline-available="true"
      @retry="retry"
      @open-offline="switchOffline"
      @return-to-runs="router.push('/campus-pulse/workbench')"
      @inspect-evidence="router.push('/campus-pulse/system')"
    />

    <template v-else-if="result && investigation">
      <ForumContextHeader
        :investigation="investigation"
        :source-verified="sourceVerified"
        :readonly="readonly"
        @return-to-result="returnToResult"
        @open-result-evidence="openResultEvidence"
      />

      <section v-if="demoMode" class="demo-runtime-banner" aria-label="实时演示状态">
        <div class="demo-runtime-banner__signal" :class="{ active:playing }" aria-hidden="true"><span></span></div>
        <div>
          <strong>{{ playing ? '实时演示正在推进' : '实时演示已暂停' }} · Tick {{ investigation.tick }}</strong>
          <p>正在按时间顺序流式回放已校验的真实 LLM 轨迹；新帖、回复、治理消息与服务回执均来自结果文件，页面不生成伪数据。</p>
        </div>
        <div class="demo-runtime-banner__actions">
          <button v-if="!playing" type="button" @click="play">继续播放</button>
          <button v-else type="button" @click="pause">暂停</button>
          <button type="button" class="secondary" @click="returnToDemoProject">返回项目</button>
        </div>
      </section>

      <div v-if="workspace.fallbackFrom" class="fallback-notice" role="note">
        来源 {{ workspace.fallbackFrom }} 不可用，已按你的操作切换到经校验的离线审计案例。
      </div>
      <div v-if="correctedTickNotice()" class="tick-notice" role="note">{{ correctedTickNotice() }}</div>

      <ForumToolbar
        :scenario-id="investigation.scenarioId"
        :scenario-label="investigation.scenarioLabel"
        :scenario-count="scenarios.length"
        :scenarios="scenarios"
        :tick="investigation.tick"
        :tick-ids="investigation.tickIds"
        :phase="investigation.phase"
        :metric="investigation.metric"
        :metrics="INVESTIGATION_METRICS"
        :branch="workspace.branch"
        :q="workspace.q"
        :playing="playing"
        @select-scenario="selectScenario"
        @prev-tick="goTick(-1)"
        @next-tick="goTick(1)"
        @play="play"
        @pause="pause"
        @select-tick="setTick"
        @select-metric="selectMetric"
        @select-branch="selectBranch"
        @search="setSearch"
      />

      <div v-if="!result.forum || (result.forum.threads.length === 0 && result.forum.claims.length === 0)" class="forum-blocked">
        <CpStatePanel
          variant="empty"
          title="该结果没有可回放的公开论坛轨迹"
          :detail="`结果 ${investigation.resultKey} 未发布公开讨论串或 Claim。可返回结果页查看总览、治理分析与审计证据。`"
          primary-label="返回结果"
          @primary="returnToResult"
        />
      </div>

      <template v-else>
        <CaseAgentEvolution
          :result="result"
          :tick="investigation.tick"
          :branch="workspace.branch"
        />

        <LiveForumStage
          :result="result"
          :tick="investigation.tick"
          :branch="workspace.branch"
          :playing="playing"
          @select-thread="selectThread"
          @select-agent="selectAgent"
          @open-governance="changeInspector('governance')"
        />

        <header class="detail-heading">
          <div>
            <span>讨论结构与证据</span>
            <h2>深入查看讨论串、Claim 谱系与 Agent 轨迹</h2>
          </div>
          <p>点击热榜或实时动态即可打开对应讨论串。</p>
        </header>
        <div class="workspace" :class="{ 'single-branch': workspace.branch !== 'both' }">
          <BranchPane
            v-if="workspace.branch === 'both' || workspace.branch === 'natural'"
            branch="natural"
            :label="branchName('Natural')"
            :metrics="investigation.natural"
            :metric="investigation.metric"
            :threads="investigation.threads.natural"
            :selected-thread-id="workspace.thread"
            :query="workspace.q"
            @select-thread="selectThread"
          />
          <BranchPane
            v-if="workspace.branch === 'both' || workspace.branch === 'A'"
            branch="A"
            :label="branchName('A')"
            :metrics="investigation.explanation"
            :metric="investigation.metric"
            :threads="investigation.threads.A"
            :selected-thread-id="workspace.thread"
            :query="workspace.q"
            @select-thread="selectThread"
          />
          <BranchPane
            v-if="workspace.branch === 'both' || workspace.branch === 'D'"
            branch="D"
            :label="branchName('D')"
            :metrics="investigation.intervention"
            :metric="investigation.metric"
            :threads="investigation.threads.D"
            :selected-thread-id="workspace.thread"
            :query="workspace.q"
            @select-thread="selectThread"
          />
          <ContextInspector
            :open="inspectorOpen"
            :tab="workspace.inspector"
            :selection-label="inspectorSelectionLabel"
            @close="closeInspector"
            @change-tab="changeInspector"
          >
            <ThreadReader
              v-if="workspace.inspector === 'thread'"
              :thread="selectedThread"
              :messages="selectedThreadMessages"
              :tick="investigation.tick"
              @select-agent="(displayId) => selectAgent(displayId, selectedThread?.branch_id || 'D')"
              @select-claim="selectClaim"
            />
            <ClaimLineage
              v-else-if="workspace.inspector === 'claim'"
              :claim="selectedClaim"
              :claims="result.forum?.claims || []"
              :supporting-messages="selectedClaimMessages.supporting"
              :challenging-messages="selectedClaimMessages.challenging"
              :thread="selectedThread"
              @select-message="selectMessage"
              @open-evidence="openEvidence"
            />
            <AgentExplain
              v-else-if="workspace.inspector === 'agent'"
              :display-id="workspace.agent || ''"
              :branch="selectedAgentBranch || 'both'"
              :activity="selectedAgentActivity"
              :profile="selectedAgentProfile"
            />
            <GovernancePanel
              v-else-if="workspace.inspector === 'governance'"
              :governance="investigation.governance"
              @select-message="selectMessage"
              @open-evidence="openEvidence"
            />
            <EvidenceDetails
              v-else
              :object-label="inspectorSelectionLabel"
              :evidence-ref="evidenceRef"
              :provenance="result.provenance"
              :boundary-summary="result.boundaries.join(' ')"
              :publication-eligible="result.source.publicationEligible === true"
            />
          </ContextInspector>
        </div>

        <section class="forum-timeline" aria-label="共享趋势与时点">
          <OverviewTimeline
            :timeline="investigation.timeline"
            :metric="investigation.metric"
            :tick="investigation.tick"
            @select-metric="selectMetric"
            @select-tick="setTick"
            @inspect="inspectTick"
          />
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.forum-investigation-page { --cp-surface-canvas:#fff; --cp-surface-default:#fff; --cp-surface-subtle:#f7f5f3; --cp-surface-raised:#fff; --cp-surface-selected:#fff2f5; --cp-text-primary:#2c2628; --cp-text-secondary:#6f6569; --cp-text-muted:#8c8185; --cp-text-inverse:#fff; --cp-border-default:#ded8d4; --cp-border-subtle:#ebe7e4; --cp-border-strong:#bdb4b0; --cp-action-primary:#b20f3d; --cp-action-primary-hover:#941032; --cp-tech:#776c70; --cp-tech-bright:#554c4f; --cp-tech-surface:#f4f1ef; --cp-tech-line:#ded8d4; --cp-evidence-surface:#fff9e9; --cp-evidence-text:#765819; width:min(100%,var(--cp-content-max)); min-height:100%; margin:0 auto; padding:var(--cp-space-4) var(--cp-content-gutter) var(--cp-space-8); background:var(--cp-surface-canvas); color:var(--cp-text-primary); color-scheme:light; }
.forum-loading { display:grid; gap:var(--cp-space-3); }
.forum-loading span { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.fallback-notice, .tick-notice { margin-bottom:var(--cp-space-3); padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-warning); background:var(--cp-warning-surface); color:var(--cp-text-primary); font-size:var(--cp-text-sm); }
.demo-runtime-banner { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:var(--cp-space-3); align-items:center; margin-bottom:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border:1px solid color-mix(in srgb,var(--cp-action-primary) 40%,var(--cp-border-default)); border-radius:var(--cp-radius-md); background:var(--cp-surface-default); }
.demo-runtime-banner__signal { position:relative; width:2rem; height:2rem; border:1px solid color-mix(in srgb,var(--cp-action-primary) 35%,transparent); border-radius:50%; }
.demo-runtime-banner__signal span,.demo-runtime-banner__signal::after { content:''; position:absolute; inset:50% auto auto 50%; border-radius:50%; transform:translate(-50%,-50%); }
.demo-runtime-banner__signal span { width:.55rem; height:.55rem; background:var(--cp-action-primary); }
.demo-runtime-banner__signal.active::after { width:1.55rem; height:1.55rem; border:1px solid var(--cp-action-primary); animation:runtime-pulse 1.4s ease-out infinite; }
.demo-runtime-banner strong { font-size:var(--cp-text-sm); }
.demo-runtime-banner p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-xs); line-height:1.5; }
.demo-runtime-banner__actions { display:flex; gap:var(--cp-space-2); }
.demo-runtime-banner__actions button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-action-primary); border-radius:var(--cp-radius-sm); background:var(--cp-action-primary); color:var(--cp-surface-default); font-size:var(--cp-text-sm); font-weight:700; cursor:pointer; }
.demo-runtime-banner__actions button.secondary { border-color:var(--cp-border-strong); background:var(--cp-surface-default); color:var(--cp-text-primary); }
@keyframes runtime-pulse { from { opacity:.9; transform:translate(-50%,-50%) scale(.45); } to { opacity:0; transform:translate(-50%,-50%) scale(1.2); } }
.workspace { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--cp-space-3); align-items:start; }
.workspace :deep(.context-inspector) { grid-column:1 / -1; }
.workspace.single-branch { grid-template-columns:minmax(0,1fr) minmax(0,24rem); }
.workspace.single-branch :deep(.context-inspector) { grid-column:auto; }
.forum-blocked { margin-top:var(--cp-space-3); }
.detail-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--cp-space-5); margin:var(--cp-space-7) 0 var(--cp-space-4); padding-top:var(--cp-space-6); border-top:1px solid var(--cp-tech-line); }
.detail-heading span { color:var(--cp-tech); font-size:var(--cp-text-sm); font-weight:800; letter-spacing:.09em; }
.detail-heading h2 { margin:var(--cp-space-2) 0 0; font-size:var(--cp-text-xl); letter-spacing:-.015em; }
.detail-heading p { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.forum-timeline { margin-top:var(--cp-space-4); }
@media (max-width:1279px) {
  .workspace, .workspace.single-branch { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .workspace :deep(.context-inspector) { grid-column:1 / -1; }
}
@media (max-width:1023px) {
  .workspace, .workspace.single-branch { grid-template-columns:minmax(0,1fr); }
}
@media (max-width:767px) {
  .workspace, .workspace.single-branch { grid-template-columns:1fr; }
  .forum-investigation-page { padding-top:var(--cp-space-4); }
  .detail-heading { align-items:flex-start; flex-direction:column; }
  .demo-runtime-banner { grid-template-columns:auto 1fr; }
  .demo-runtime-banner__actions { grid-column:1 / -1; }
  .demo-runtime-banner__actions button { flex:1; }
}
@media (prefers-reduced-motion:reduce) { .demo-runtime-banner__signal.active::after { animation:none; } }
</style>
