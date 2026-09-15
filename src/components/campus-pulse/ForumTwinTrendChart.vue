<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  title: string
  subtitle: string
  natural: number[]
  adaptive: number[]
  suffix?: string
  precision?: number
}>()

const selectedTick = ref<number | null>(null)
const width = 760
const height = 286
const inset = { top: 22, right: 28, bottom: 42, left: 52 }

const values = computed(() => [...props.natural, ...props.adaptive])
const range = computed(() => {
  const minValue = Math.min(...values.value, 0)
  const maxValue = Math.max(...values.value, 1)
  const spread = Math.max(maxValue - minValue, 0.01)
  return {
    min: minValue,
    max: maxValue,
    spread,
  }
})

function point(value: number, index: number) {
  const count = Math.max(props.natural.length - 1, 1)
  const x = inset.left + (index / count) * (width - inset.left - inset.right)
  const ratio = (value - range.value.min) / range.value.spread
  const y = height - inset.bottom - ratio * (height - inset.top - inset.bottom)
  return { x, y }
}

function path(values: number[]) {
  return values.map((value, index) => {
    const p = point(value, index)
    return `${index ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }).join(' ')
}

const grid = computed(() => Array.from({ length: 5 }, (_, index) => {
  const ratio = index / 4
  return {
    y: inset.top + ratio * (height - inset.top - inset.bottom),
    value: range.value.max - ratio * range.value.spread,
  }
}))

const xTicks = [0, 3, 7, 13, 19, 23]
const activeTick = computed(() => selectedTick.value ?? props.natural.length - 1)

function format(value: number) {
  return `${value.toFixed(props.precision ?? 0)}${props.suffix || ''}`
}
</script>

<template>
  <article class="trend-chart">
    <header>
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <div class="legend" aria-label="图例">
        <span><i class="natural" />Natural</span>
        <span><i class="adaptive" />治理 D</span>
      </div>
    </header>

    <div class="chart-stage">
      <svg :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="title">
        <g class="phase-bands" aria-hidden="true">
          <rect x="52" y="22" width="88.7" height="222" class="baseline" />
          <rect x="140.7" y="22" width="147.8" height="222" class="burst" />
          <rect x="288.5" y="22" width="295.6" height="222" class="spread" />
          <rect x="584.1" y="22" width="147.9" height="222" class="decay" />
        </g>
        <g class="grid-lines">
          <g v-for="line in grid" :key="line.y">
            <line :x1="inset.left" :x2="width - inset.right" :y1="line.y" :y2="line.y" />
            <text :x="inset.left - 9" :y="line.y + 4">{{ format(line.value) }}</text>
          </g>
        </g>
        <g class="x-axis">
          <g v-for="item in xTicks" :key="item">
            <line :x1="point(0, item).x" :x2="point(0, item).x" y1="244" y2="250" />
            <text :x="point(0, item).x" y="270">T{{ item }}</text>
          </g>
        </g>
        <path class="series natural" :d="path(natural)" />
        <path class="series adaptive" :d="path(adaptive)" />
        <g class="hit-points">
          <g v-for="(_, index) in natural" :key="index" @mouseenter="selectedTick = index">
            <circle :cx="point(natural[index], index).x" :cy="point(natural[index], index).y" r="11" />
            <circle
              v-if="activeTick === index"
              class="visible natural"
              :cx="point(natural[index], index).x"
              :cy="point(natural[index], index).y"
              r="4"
            />
            <circle
              v-if="activeTick === index"
              class="visible adaptive"
              :cx="point(adaptive[index], index).x"
              :cy="point(adaptive[index], index).y"
              r="4"
            />
          </g>
        </g>
      </svg>
      <div class="chart-readout">
        <span>T{{ activeTick }}</span>
        <strong>{{ format(natural[activeTick] ?? 0) }}</strong>
        <strong class="adaptive">{{ format(adaptive[activeTick] ?? 0) }}</strong>
        <em>
          {{ (adaptive[activeTick] ?? 0) - (natural[activeTick] ?? 0) >= 0 ? '+' : '' }}{{ format((adaptive[activeTick] ?? 0) - (natural[activeTick] ?? 0)) }}
        </em>
      </div>
    </div>
    <footer>
      <span>baseline</span><span>事件爆发</span><span>讨论扩散</span><span>回落沉淀</span>
    </footer>
  </article>
</template>

<style scoped>
.trend-chart {
  background: #ffffff;
  border: 1px solid #dedede;
  border-top: 4px solid #ae0b2a;
  min-width: 0;
  padding: 1.2rem 1.25rem 0.9rem;
}

header {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

h3 { font-size: 1.05rem; margin: 0; }
p { color: #757575; font-size: 0.72rem; line-height: 1.55; margin: 0.3rem 0 0; }
.legend { display: flex; flex: 0 0 auto; gap: 0.85rem; }
.legend span { color: #595959; font-family: inherit; letter-spacing: 0; }
.legend i { display: inline-block; height: 3px; margin-right: 0.32rem; vertical-align: middle; width: 1.3rem; }
.legend i.natural { background: #111111; }
.legend i.adaptive { background: #ae0b2a; }
.chart-stage { min-width: 0; position: relative; }
svg { display: block; height: auto; overflow: visible; width: 100%; }
.phase-bands rect { opacity: 0.42; }
.phase-bands .baseline { fill: #f5f5f5; }
.phase-bands .burst { fill: #fce7eb; }
.phase-bands .spread { fill: #f8f3e8; }
.phase-bands .decay { fill: #f1f1f1; }
.grid-lines line { stroke: #d9d9d9; stroke-dasharray: 3 5; stroke-width: 1; }
.grid-lines text { fill: #8c8c8c; font-size: 10px; text-anchor: end; }
.x-axis line { stroke: #9f9f9f; }
.x-axis text { fill: #777777; font-size: 10px; text-anchor: middle; }
.series { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 3.2; }
.series.natural { stroke: #111111; }
.series.adaptive { stroke: #ae0b2a; }
.hit-points > g > circle:first-child { fill: transparent; }
.hit-points circle.visible { stroke: #ffffff; stroke-width: 2; }
.hit-points circle.visible.natural { fill: #111111; }
.hit-points circle.visible.adaptive { fill: #ae0b2a; }
.chart-readout {
  align-items: center;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #dedede;
  display: grid;
  gap: 0.55rem;
  grid-template-columns: auto repeat(3, auto);
  padding: 0.48rem 0.62rem;
  position: absolute;
  right: 0.5rem;
  top: 0.55rem;
}
.chart-readout span { color: #777777; font: 700 0.62rem ui-monospace, monospace; }
.chart-readout strong { font-size: 0.72rem; }
.chart-readout strong.adaptive { color: #ae0b2a; }
.chart-readout em { color: #595959; font-size: 0.68rem; font-style: normal; font-weight: 800; }
footer { display: grid; grid-template-columns: 3fr 5fr 10fr 6fr; margin-left: 6.8%; }
footer span { border-top: 2px solid #d4d4d4; color: #858585; font-size: 0.58rem; padding: 0.4rem 0.2rem 0; text-align: center; }
footer span:nth-child(2) { border-color: #ae0b2a; }
footer span:nth-child(3) { border-color: #8c8c8c; }

@media (max-width: 640px) {
  header { display: grid; }
  .legend { margin-bottom: 0.4rem; }
  .trend-chart { padding: 0.95rem 0.7rem 0.75rem; }
  .chart-readout { position: static; width: max-content; margin-left: auto; }
  footer { margin-left: 8%; }
}
</style>
