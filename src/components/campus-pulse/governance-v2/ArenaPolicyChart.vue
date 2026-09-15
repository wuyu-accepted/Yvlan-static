<script setup>
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  scenario: {
    type: Object,
    required: true,
  },
  schemeIds: {
    type: Array,
    required: true,
  },
  selectedScheme: {
    type: String,
    required: true,
  },
  metricKey: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['select-scheme'])
const timelineHost = ref(null)
const paretoHost = ref(null)
let timelineChart
let paretoChart

const schemeLabels = {
  natural: 'Natural',
  A: 'A · 快速透明',
  B: 'B · 参与服务',
  C: 'C · 定向桥接',
  D: 'D · 自适应组合',
}

const schemeColors = {
  natural: '#7d8e96',
  A: '#54e2cf',
  B: '#ffbe69',
  C: '#8fbfff',
  D: '#c5a5ff',
}

const metricLabels = {
  concern: '群体关切',
  trust: '治理信任',
  rumor_belief: '错误信息信念',
  voice_gap: '参与缺口',
  service_strain: '服务压力',
}

function renderTimeline() {
  if (!timelineHost.value) return
  timelineChart ||= echarts.init(timelineHost.value, null, {
    renderer: 'canvas',
  })
  const selectedTimeline = props.scenario.branches[
    props.selectedScheme
  ].timeline
  const lower = selectedTimeline.map(
    (point) => point.observed[props.metricKey].lower,
  )
  const band = selectedTimeline.map(
    (point, index) => (
      point.observed[props.metricKey].upper - lower[index]
    ),
  )
  const series = [
    {
      name: '区间下界',
      type: 'line',
      data: lower,
      stack: 'selected-interval',
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      silent: true,
    },
    {
      name: '治理可见 95% 区间',
      type: 'line',
      data: band,
      stack: 'selected-interval',
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: {
        color: schemeColors[props.selectedScheme],
        opacity: 0.12,
      },
      silent: true,
    },
    ...props.schemeIds.map((schemeId) => ({
      name: schemeLabels[schemeId],
      type: 'line',
      data: props.scenario.branches[schemeId].timeline.map(
        (point) => point.truth[props.metricKey],
      ),
      symbol: 'none',
      smooth: 0.28,
      lineStyle: {
        color: schemeColors[schemeId],
        width: schemeId === props.selectedScheme ? 3 : 1.4,
        opacity: schemeId === props.selectedScheme ? 1 : 0.56,
      },
      emphasis: { focus: 'series' },
    })),
  ]
  timelineChart.setOption({
    animation: false,
    color: props.schemeIds.map((id) => schemeColors[id]),
    grid: { top: 36, right: 16, bottom: 30, left: 42 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${(Number(value) * 100).toFixed(1)}%`,
      backgroundColor: '#0a1a1f',
      borderColor: '#31555c',
      textStyle: { color: '#ddecf0', fontSize: 10 },
    },
    legend: {
      top: 0,
      textStyle: { color: '#7e959b', fontSize: 9 },
      data: props.schemeIds.map((id) => schemeLabels[id]),
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, tick) => `T${tick}`),
      axisLine: { lineStyle: { color: '#304b52' } },
      axisLabel: { color: '#698188', interval: 3, fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: {
        color: '#698188',
        fontSize: 9,
        formatter: (value) => `${Math.round(value * 100)}%`,
      },
      splitLine: { lineStyle: { color: 'rgba(102,140,148,.09)' } },
    },
    series,
  }, true)
}

function renderPareto() {
  if (!paretoHost.value) return
  paretoChart ||= echarts.init(paretoHost.value, null, {
    renderer: 'canvas',
  })
  const comparison = props.scenario.policy_comparison || {}
  const points = comparison.pareto_front || comparison.rows || []
  paretoChart.setOption({
    animation: false,
    grid: { top: 16, right: 18, bottom: 36, left: 44 },
    tooltip: {
      trigger: 'item',
      formatter: ({ data }) => (
        `${schemeLabels[data.scheme_id] || data.scheme_id}<br>`
        + `影响改善 ${(data.value[0] * 100).toFixed(1)}%<br>`
        + `资源 ${data.value[1].toFixed(1)}`
      ),
      backgroundColor: '#0a1a1f',
      borderColor: '#31555c',
      textStyle: { color: '#ddecf0', fontSize: 10 },
    },
    xAxis: {
      name: '综合影响改善',
      nameTextStyle: { color: '#738b91', fontSize: 9 },
      axisLabel: {
        color: '#698188',
        fontSize: 8,
        formatter: (value) => `${Math.round(value * 100)}%`,
      },
      splitLine: { lineStyle: { color: 'rgba(102,140,148,.08)' } },
    },
    yAxis: {
      name: '资源消耗',
      nameTextStyle: { color: '#738b91', fontSize: 9 },
      axisLabel: { color: '#698188', fontSize: 8 },
      splitLine: { lineStyle: { color: 'rgba(102,140,148,.08)' } },
    },
    series: [{
      type: 'scatter',
      symbolSize: 16,
      data: points.map((point) => {
        const schemeId = point.scheme_id
        const impact = (
          point.impact_gain
          ?? point.objective_score
          ?? point.objective_evaluation?.objective_score
          ?? 0
        )
        const cost = (
          point.resource_consumed
          ?? point.cost
          ?? 0
        )
        return {
          scheme_id: schemeId,
          value: [impact, cost],
          itemStyle: {
            color: schemeColors[schemeId] || '#8da2a7',
            borderColor: '#eaf5f3',
            borderWidth: schemeId === props.selectedScheme ? 2 : 0,
          },
        }
      }),
    }],
  }, true)
}

async function render() {
  await nextTick()
  renderTimeline()
  renderPareto()
}

function resize() {
  timelineChart?.resize()
  paretoChart?.resize()
}

watch(
  () => [
    props.scenario,
    props.selectedScheme,
    props.metricKey,
  ],
  render,
)

onMounted(() => {
  window.addEventListener('resize', resize)
  render()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  timelineChart?.dispose()
  paretoChart?.dispose()
})
</script>

<template>
  <section class="policy-panel">
    <header>
      <div>
        <span>PAIRED FIVE-BRANCH COUNTERFACTUALS</span>
        <h2>五分支趋势与 Pareto 取舍</h2>
      </div>
      <b>8 PAIRED SEEDS</b>
    </header>
    <div class="chart-grid">
      <div>
        <div ref="timelineHost" class="timeline-chart" />
        <small>
          {{ metricLabels[metricKey] }}：实线为模型总体状态，阴影为当前分支治理可见区间
        </small>
      </div>
      <div>
        <div ref="paretoHost" class="pareto-chart" />
        <small>不要求 D 胜出；展示模型目标下的影响—资源前沿</small>
      </div>
    </div>
    <div class="scheme-cards">
      <button
        v-for="schemeId in schemeIds"
        :key="schemeId"
        type="button"
        :class="{ active: selectedScheme === schemeId }"
        @click="emit('select-scheme', schemeId)"
      >
        <i :style="{ background: schemeColors[schemeId] }" />
        <span>{{ schemeLabels[schemeId] }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.policy-panel {
  min-width: 0;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

header span {
  color: #54e2cf;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

h2 {
  margin: 6px 0 0;
  color: #f4faf9;
  font-size: 22px;
}

header > b {
  color: #7d949a;
  font: 700 10px ui-monospace, monospace;
}

.chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(240px, 0.75fr);
  gap: 10px;
  margin-top: 16px;
}

.chart-grid > div {
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(95, 222, 207, 0.1);
  border-radius: 11px;
  background: rgba(5, 18, 22, 0.7);
}

.timeline-chart,
.pareto-chart {
  height: 310px;
}

.chart-grid small {
  display: block;
  padding: 0 7px 6px;
  color: #72888e;
  font-size: 9px;
}

.scheme-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  margin-top: 10px;
}

.scheme-cards button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 9px;
  border: 1px solid rgba(108, 150, 158, 0.12);
  border-radius: 8px;
  background: rgba(8, 23, 27, 0.7);
  color: #82979c;
  cursor: pointer;
}

.scheme-cards button.active {
  border-color: rgba(84, 226, 207, 0.45);
  color: #edf8f6;
}

.scheme-cards i {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.scheme-cards span {
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }

  .scheme-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
