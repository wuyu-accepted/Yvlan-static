<script setup lang="ts">
import { computed } from 'vue'
import type { ResultMetricKey, ResultTimelinePoint } from '../source/forumTwinAdapter.ts'
import { metricValue, overviewMetricDefinitions } from './situationOverview.ts'
import { isEnglish } from '../i18n/locale.ts'
import { branchDisplayName } from '../results/branchPresentation.ts'

const props = withDefaults(defineProps<{ timeline: ResultTimelinePoint[]; metric: ResultMetricKey; tick: number | null; resultKey?:string }>(),{resultKey:''})
const emit = defineEmits<{ selectMetric: [metric: ResultMetricKey]; selectTick: [tick: number]; inspect: [tick: number] }>()
const metricDefinition = computed(() => overviewMetricDefinitions.find((item) => item.key === props.metric) ?? overviewMetricDefinitions[0])
const available = computed(() => props.timeline.map((point) => ({
  point,
  natural: metricValue(point, 'natural', props.metric),
  explanation: metricValue(point, 'explanation', props.metric),
  intervention: metricValue(point, 'intervention', props.metric),
})).filter((item) => item.natural !== null || item.explanation !== null || item.intervention !== null))
const range = computed(() => {
  const values = available.value.flatMap((item) => [item.natural, item.explanation, item.intervention]).filter((value): value is number => value !== null)
  return { min: Math.min(...values, 0), max: Math.max(...values, 1) }
})
function linePath(branch: 'natural' | 'explanation' | 'intervention') {
  const values = available.value.filter((item) => item[branch] !== null)
  if (!values.length) return ''
  const tickMin = props.timeline[0]?.tick ?? 0
  const tickMax = props.timeline.at(-1)?.tick ?? tickMin + 1
  return values.map((item, index) => {
    const x = 28 + ((item.point.tick - tickMin) / Math.max(1, tickMax - tickMin)) * 664
    const y = 172 - (((item[branch] as number) - range.value.min) / Math.max(1, range.value.max - range.value.min)) * 140
    return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}
const selected = computed(() => props.timeline.find((point) => point.tick === props.tick) || null)
const hasExplanation = computed(() => props.timeline.some((point) => point.explanation !== null))
const trendTitle = computed(() => isEnglish.value
  ? `${hasExplanation.value ? 'Three' : 'Two'} parallel-world trajectories`
  : `${hasExplanation.value ? '三个' : '两个'}平行世界的演化`)
const trendQuestion = computed(() => isEnglish.value
  ? (hasExplanation.value
      ? 'When do no response, explanation only, and service closure begin to diverge?'
      : 'When do natural evolution and active governance begin to diverge?')
  : `${hasExplanation.value ? '不回应、只解释和服务闭环' : '自然演化与主动治理'}何时开始分叉？`)
const metricLabels: Record<ResultMetricKey, string> = {
  messages: 'Public messages', threads: 'Active threads', claims: 'Public Claims',
  corrections: 'Corrections', help_requests: 'Help requests',
}
const displayMetricLabel = (definition: (typeof overviewMetricDefinitions)[number]) => isEnglish.value ? metricLabels[definition.key] : definition.label
const displayUnit = (unit: string) => isEnglish.value ? (unit === '条' ? 'items' : 'count') : unit
const phaseLabels: Record<string, string> = { baseline: '基线', burst: '爆发', spread: '扩散', decay: '消退' }
const phaseLabel = (phase: string) => phaseLabels[phase] || phase
const branchName=(id:'Natural'|'A'|'D',short=false)=>branchDisplayName(props.resultKey,id,isEnglish.value,short)
function onTickKey(event: KeyboardEvent, index: number, tick: number) {
  if (event.key === 'Enter') { event.preventDefault(); emit('inspect', tick); return }
  let next = index
  if (event.key === 'ArrowRight') next = Math.min(props.timeline.length - 1, index + 1)
  else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1)
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = props.timeline.length - 1
  else return
  event.preventDefault()
  const nextTick = props.timeline[next].tick
  emit('selectTick', nextTick)
  ;(event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
}
</script>

<template>
  <section class="timeline-panel" aria-labelledby="trend-heading">
    <header>
      <div><h2 id="trend-heading" data-no-localize>{{ trendTitle }}</h2><p id="trend-question" data-no-localize>{{ trendQuestion }}</p></div>
      <div class="branch-legend" aria-label="分支图例"><span><i class="natural" aria-hidden="true" />{{ branchName('Natural',true) }}</span><span v-if="hasExplanation"><i class="explanation" aria-hidden="true" />{{ branchName('A',true) }}</span><span><i class="intervention" aria-hidden="true" />{{ branchName('D',true) }}</span></div>
    </header>
    <div class="metric-selector" aria-label="趋势指标">
      <button v-for="definition in overviewMetricDefinitions" :key="definition.key" type="button" :aria-pressed="metric === definition.key" data-no-localize @click="emit('selectMetric', definition.key)">{{ displayMetricLabel(definition) }}</button>
    </div>
    <div v-if="available.length" class="chart" role="group" aria-describedby="trend-question trend-readout">
      <svg viewBox="0 0 720 200" preserveAspectRatio="none" aria-hidden="true">
        <line x1="28" y1="172" x2="692" y2="172" class="axis" />
        <line x1="28" y1="32" x2="28" y2="172" class="axis" />
        <path :d="linePath('natural')" class="line natural" />
        <path :d="linePath('explanation')" class="line explanation" />
        <path :d="linePath('intervention')" class="line intervention" />
      </svg>
      <div class="tick-controls" aria-label="选择时间点">
        <button v-for="(point, index) in timeline" :key="point.tick" type="button" :data-overview-tick="point.tick" :aria-pressed="point.tick === tick" :aria-label="`选择 Tick ${point.tick}，${phaseLabel(point.phase)}；按 Enter 打开结果`" @click="emit('selectTick', point.tick)" @keydown="onTickKey($event, index, point.tick)">Tick {{ point.tick }}</button>
      </div>
      <p id="trend-readout" class="selected-readout" aria-live="polite">
        <template v-if="selected">Tick {{ selected.tick }} · {{ phaseLabel(selected.phase) }}：{{ branchName('Natural',true) }} {{ metricValue(selected, 'natural', metric) ?? '未发布' }}{{ metricValue(selected, 'natural', metric) === null ? '' : ` ${metricDefinition.unit}` }}；<template v-if="hasExplanation">{{ branchName('A',true) }} {{ metricValue(selected, 'explanation', metric) ?? '未发布' }}{{ metricValue(selected, 'explanation', metric) === null ? '' : ` ${metricDefinition.unit}` }}；</template>{{ branchName('D',true) }} {{ metricValue(selected, 'intervention', metric) ?? '未发布' }}{{ metricValue(selected, 'intervention', metric) === null ? '' : ` ${metricDefinition.unit}` }}。</template>
      </p>
    </div>
    <p v-else class="chart-empty">当前结果未发布“{{ overviewMetricDefinitions.find((item) => item.key === metric)?.label }}”序列；不会补零生成曲线。</p>
    <details v-if="timeline.length" class="data-table">
      <summary>查看趋势数据表</summary>
      <div tabindex="0" role="region" :aria-label="`${hasExplanation ? '三个' : '两个'}平行世界趋势数据表`">
        <table><thead><tr><th scope="col">Tick</th><th scope="col">阶段</th><th scope="col" data-no-localize>{{ branchName('Natural',true) }} ({{ displayUnit(metricDefinition.unit) }})</th><th v-if="hasExplanation" scope="col" data-no-localize>{{ branchName('A',true) }} ({{ displayUnit(metricDefinition.unit) }})</th><th scope="col" data-no-localize>{{ branchName('D',true) }} ({{ displayUnit(metricDefinition.unit) }})</th><th scope="col" data-no-localize>{{ isEnglish?'Combined response minus no added response':'组合治理减去不追加回应' }}（D − Natural）</th></tr></thead>
          <tbody><tr v-for="point in timeline" :key="point.tick"><th scope="row">Tick {{ point.tick }}</th><td>{{ point.phase }}</td><td>{{ metricValue(point, 'natural', metric) ?? '未发布' }}</td><td v-if="hasExplanation">{{ metricValue(point, 'explanation', metric) ?? '未发布' }}</td><td>{{ metricValue(point, 'intervention', metric) ?? '未发布' }}</td><td>{{ metricValue(point, 'natural', metric) === null || metricValue(point, 'intervention', metric) === null ? '不可计算' : (metricValue(point, 'intervention', metric) as number) - (metricValue(point, 'natural', metric) as number) }}</td></tr></tbody>
        </table>
      </div>
    </details>
  </section>
</template>

<style scoped>
.timeline-panel { min-width:0; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.timeline-panel > header { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.timeline-panel h2 { margin:0; font-size:var(--cp-text-lg); }
.timeline-panel header p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.branch-legend { display:flex; flex-wrap:wrap; gap:var(--cp-space-3); font-size:var(--cp-text-xs); }
.branch-legend span { display:flex; align-items:center; gap:var(--cp-space-1); }
.branch-legend i { display:block; width:1.6rem; border-top:2px solid var(--cp-branch-natural); }
.branch-legend i.explanation { border-top-color:var(--cp-evidence); }
.branch-legend i.intervention { border-top:2px dashed var(--cp-branch-governance); }
.metric-selector { display:flex; overflow-x:auto; padding:var(--cp-space-2) var(--cp-space-4); border-bottom:1px solid var(--cp-border-subtle); }
.metric-selector button { min-height:var(--cp-control-height); flex:none; padding:0 var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); color:var(--cp-text-secondary); font:600 var(--cp-text-xs)/1 var(--cp-font-sans); }
.metric-selector button + button { border-left:0; }
.metric-selector button[aria-pressed="true"] { border-color:var(--cp-action-primary); background:var(--cp-surface-selected); color:var(--cp-action-primary); }
.chart { padding:var(--cp-space-3) var(--cp-space-4) 0; }
.chart svg { display:block; width:100%; height:12rem; }
.axis { stroke:var(--cp-border-default); stroke-width:1; vector-effect:non-scaling-stroke; }
.line { fill:none; stroke-width:2.5; vector-effect:non-scaling-stroke; }
.line.natural { stroke:var(--cp-branch-natural); }
.line.explanation { stroke:var(--cp-evidence); }
.line.intervention { stroke:var(--cp-branch-governance); stroke-dasharray:7 5; }
.tick-controls { display:flex; overflow-x:auto; gap:var(--cp-space-1); padding:var(--cp-space-1) 0 var(--cp-space-2); }
.tick-controls button { min-width:2rem; min-height:2rem; flex:1 0 2rem; padding:0; border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-secondary); font:600 var(--cp-text-xs)/1 var(--cp-font-mono); }
.tick-controls button[aria-pressed="true"] { border-color:var(--cp-action-primary); background:var(--cp-surface-selected); color:var(--cp-action-primary); }
.selected-readout,.chart-empty { margin:0; padding:var(--cp-space-2) 0 var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.chart-empty { padding:var(--cp-space-5) var(--cp-space-4); }
.data-table { border-top:1px solid var(--cp-border-subtle); }
.data-table summary { padding:var(--cp-space-2) var(--cp-space-4); color:var(--cp-text-link); cursor:pointer; font-size:var(--cp-text-sm); font-weight:650; }
.data-table > div { max-height:18rem; overflow:auto; }
.data-table table { width:100%; border-collapse:collapse; font-size:var(--cp-text-xs); font-variant-numeric:tabular-nums; }
.data-table th,.data-table td { padding:var(--cp-space-2) var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); text-align:right; white-space:nowrap; }
.data-table th:first-child,.data-table td:nth-child(2) { text-align:left; }
@media (max-width:767px) { .timeline-panel > header { align-items:flex-start; flex-direction:column; } .chart { padding-inline:var(--cp-space-2); } .chart svg { height:9rem; } .tick-controls button,.metric-selector button { min-height:var(--cp-touch-target); } }
</style>
