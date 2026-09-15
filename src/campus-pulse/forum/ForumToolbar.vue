<script setup lang="ts">
import { computed, watch } from 'vue'
import type { ResultMetricKey } from '../source/forumTwinAdapter.ts'
import type { ForumBranchView } from './forumWorkspaceState.ts'
import { metricLabel } from './forumInvestigation.ts'
import { currentLocale } from '../i18n/locale.ts'

const props = defineProps<{
  scenarioId: string
  scenarioLabel: string
  scenarioCount: number
  scenarios: Array<{ id: string; label: string }>
  tick: number
  tickIds: number[]
  phase: string
  metric: ResultMetricKey
  metrics: ResultMetricKey[]
  branch: ForumBranchView
  q: string
  playing: boolean
}>()

const emit = defineEmits<{
  selectScenario: [id: string]
  prevTick: []
  nextTick: []
  play: []
  pause: []
  selectTick: [tick: number]
  selectMetric: [metric: ResultMetricKey]
  selectBranch: [branch: ForumBranchView]
  search: [q: string]
}>()

const phaseLabel = computed(() => ({
  baseline: '基线期',
  burst: '事件爆发',
  spread: '讨论扩散',
  decay: '回落沉淀',
}[props.phase] || props.phase))
const isEnglish = computed(() => currentLocale.value === 'en-US')
const branchLabels = computed(() => isEnglish.value ? {
  both: 'Parallel comparison',
  natural: 'No added response (Natural)',
  A: 'Standards explained (Plan A)',
  D: 'Combined governance (Plan D)',
} : {
  both: '平行对照',
  natural: '不追加回应（Natural）',
  A: '规则解释（方案 A）',
  D: '组合治理（方案 D）',
})

const tickIndex = computed(() => props.tickIds.indexOf(props.tick))
const canPrev = computed(() => tickIndex.value > 0)
const canNext = computed(() => tickIndex.value >= 0 && tickIndex.value < props.tickIds.length - 1)

function selectTickIndex(raw: string) {
  const index = Number(raw)
  const tick = props.tickIds[index]
  if (typeof tick === 'number') emit('selectTick', tick)
}

let debounce: ReturnType<typeof setTimeout> | undefined
watch(() => props.q, (value) => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => emit('search', value), 220)
})
</script>

<template>
  <div class="forum-toolbar" role="toolbar" aria-label="模拟运行控制">
    <div class="toolbar-row">
      <label v-if="scenarioCount > 1" class="control">
        <span>场景</span>
        <select :value="scenarioId" @change="emit('selectScenario', ($event.target as HTMLSelectElement).value)">
          <option v-for="item in scenarios" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>

      <div class="control tick-player" aria-label="运行进度">
        <button type="button" :disabled="!canPrev" @click="emit('prevTick')">上一时点</button>
        <span class="tick-readout">Tick {{ tick }} · {{ phaseLabel }}</span>
        <button type="button" :disabled="!canNext" @click="emit('nextTick')">下一时点</button>
        <button type="button" class="play" :aria-pressed="playing" @click="playing ? emit('pause') : emit('play')">
          {{ playing ? '暂停模拟' : '自动播放' }}
        </button>
      </div>

      <label class="control timeline-scrubber">
        <span>运行进度</span>
        <input
          type="range"
          min="0"
          :max="Math.max(0, tickIds.length - 1)"
          :value="Math.max(0, tickIndex)"
          :aria-label="`选择模拟时间步，当前 Tick ${tick}`"
          @input="selectTickIndex(($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="control">
        <span>指标</span>
        <select :value="metric" @change="emit('selectMetric', ($event.target as HTMLSelectElement).value as ResultMetricKey)">
          <option v-for="key in metrics" :key="key" :value="key">{{ metricLabel(key) }}</option>
        </select>
      </label>

      <div class="control branch-switch" role="group" aria-label="分支视图">
        <button type="button" data-no-localize :aria-pressed="branch === 'both'" @click="emit('selectBranch', 'both')">{{ branchLabels.both }}</button>
        <button type="button" data-no-localize :aria-pressed="branch === 'natural'" @click="emit('selectBranch', 'natural')">{{ branchLabels.natural }}</button>
        <button type="button" data-no-localize :aria-pressed="branch === 'A'" @click="emit('selectBranch', 'A')">{{ branchLabels.A }}</button>
        <button type="button" data-no-localize :aria-pressed="branch === 'D'" @click="emit('selectBranch', 'D')">{{ branchLabels.D }}</button>
      </div>

      <label class="control search">
        <span class="visually-hidden">搜索讨论串</span>
        <input type="search" :value="q" placeholder="搜索讨论串 / 消息" @input="emit('search', ($event.target as HTMLInputElement).value)" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.forum-toolbar { display:grid; gap:var(--cp-space-2); margin-bottom:var(--cp-space-3); }
.toolbar-row { display:flex; flex-wrap:wrap; align-items:flex-end; gap:var(--cp-space-3); }
.control { display:flex; flex-direction:column; gap:var(--cp-space-1); }
.control > span { color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:600; }
.control select, .control input { min-height:var(--cp-control-height); padding:0 var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-weight:500; }
.tick-player { flex-direction:row; align-items:center; gap:var(--cp-space-1); }
.tick-player button, .branch-switch button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-secondary); font-weight:650; }
.tick-player button:disabled { opacity:.5; cursor:not-allowed; }
.tick-player .play { border-color:var(--cp-action-primary); color:var(--cp-action-primary); }
.tick-player .play[aria-pressed="true"] { background:var(--cp-surface-selected); }
.tick-readout { min-width:7rem; text-align:center; font:600 var(--cp-text-sm)/1 var(--cp-font-mono); }
.branch-switch { flex-direction:row; align-items:center; gap:0; }
.branch-switch button + button { border-left:0; }
.branch-switch button[aria-pressed="true"] { border-color:var(--cp-action-primary); background:var(--cp-surface-selected); color:var(--cp-action-primary); }
.search { flex:1 1 14rem; }
.search input { width:100%; }
.timeline-scrubber { flex:1 1 12rem; min-width:10rem; }
.timeline-scrubber input { width:100%; min-height:var(--cp-control-height); padding:0; accent-color:var(--cp-action-primary); cursor:pointer; }
@media (max-width:767px) {
  .toolbar-row { align-items:stretch; }
  .tick-player { flex-wrap:wrap; }
  .branch-switch { width:100%; }
  .branch-switch button { flex:1; min-height:var(--cp-touch-target); }
  .tick-player button, .tick-player .play { min-height:var(--cp-touch-target); }
  .control select, .control input { min-height:var(--cp-touch-target); }
}
</style>
