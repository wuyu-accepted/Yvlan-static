<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import { Application, Graphics } from 'pixi.js'
import { Graph } from '@antv/g6'
import * as echarts from 'echarts'

const result = ref(null)
const populationVisual = ref(null)
const loadError = ref('')
const scenarioId = ref('lecture_external_incident_shock')
const schemeId = ref('rapid_transparency')
const tick = ref(3)
const metricKey = ref('concern')
const selectedGroup = ref('archetype-04')
const playing = ref(false)
const fps = ref(0)

const particleHost = ref(null)
const chartHost = ref(null)
const graphHost = ref(null)

let playTimer
let pixiApp
let particleLayers = []
let particleLayout = []
let pulseLayer
let metricChart
let localGraph
let frameCount = 0
let frameStartedAt = performance.now()
let destroyed = false

const scenarioLabels = {
  lecture_external_incident_shock: '外部不确定事件',
  tongzhou_governance_information_shock: '治理正当性争议'
}

const schemeLabels = {
  natural: '自然反事实',
  rapid_transparency: '方案 A · 快速透明响应',
  participatory_service: '方案 B · 参与式服务协同'
}

const schemeShortLabels = {
  natural: '自然',
  rapid_transparency: '方案 A',
  participatory_service: '方案 B'
}

const schemeColors = {
  natural: '#7f8d9d',
  rapid_transparency: '#51e2d0',
  participatory_service: '#ffbf69'
}

const phaseLabels = {
  baseline: '共享基线',
  burst: '冲击爆发',
  spread: '网络扩散',
  decay: '干预消退'
}

const metricOptions = [
  { key: 'concern', label: '群体关切', good: 'low' },
  { key: 'trust', label: '治理信任', good: 'high' },
  { key: 'rumor_belief', label: '错误信息信念', good: 'low' },
  { key: 'verified_belief', label: '核验信息信念', good: 'high' },
  { key: 'voice_gap', label: '参与感缺口', good: 'low' },
  { key: 'service_overload', label: '服务过载', good: 'low' }
]

const actorLabels = {
  governance_authority: '治理责任主体',
  service_operator: '服务承接主体',
  community_bridge: '社区桥接主体'
}

const strategyLabels = {
  wait_and_monitor: '等待监测',
  minimal_notice: '最低限度通告',
  full_evidence_disclosure: '完整证据披露',
  open_deliberation: '开放式协商',
  hold_capacity: '维持现有容量',
  targeted_triage: '定向分流',
  surge_support_capacity: '扩容支持服务',
  passive_relay: '被动转发',
  fact_check_relay: '事实核验接力',
  facilitated_group_dialogue: '引导式群体对话'
}

const scenario = computed(() => result.value?.scenarios?.[scenarioId.value] || null)
const branch = computed(() => scenario.value?.branches?.[schemeId.value] || null)
const timeline = computed(() => branch.value?.timeline || [])
const currentPoint = computed(() => timeline.value[tick.value] || null)
const comparison = computed(() => scenario.value?.policy_comparison || null)
const comparisonRows = computed(() => comparison.value?.rows || [])
const recommendedScheme = computed(() => (
  comparison.value?.conditional_recommendation?.recommended_scheme_id || ''
))
const currentComparison = computed(() => (
  comparisonRows.value.find((row) => row.scheme_id === schemeId.value) || null
))
const selectedMetric = computed(() => (
  metricOptions.find((item) => item.key === metricKey.value) || metricOptions[0]
))
const visualGroups = computed(() => (
  populationVisual.value?.population_identity?.visual_groups || []
))
const currentRound = computed(() => {
  const rounds = branch.value?.game_rounds || []
  return [...rounds].reverse().find((item) => item.tick <= tick.value) || null
})
const resourceAtTick = computed(() => {
  if (schemeId.value === 'natural') return 100
  return currentRound.value?.resource_after ?? 100
})
const isDecisionTick = computed(() => (
  result.value?.timeline_contract?.decision_ticks?.includes(tick.value) || false
))
const particleCount = computed(() => (
  result.value?.population_identity?.particle_count || 0
))
const latestTopGroups = computed(() => (
  currentPoint.value?.group_gap?.highest_concern_groups || []
))
const maxTransmission = computed(() => {
  if (!timeline.value.length) return 1
  return Math.max(
    1,
    ...timeline.value.map((point) => (
      point.diffusion.rumor_transmissions
      + point.diffusion.verified_transmissions
    ))
  )
})

function assetUrl(file) {
  return `${import.meta.env.BASE_URL}campus-pulse-data/${file}`
}

function metricValue(point, key = metricKey.value) {
  return Number(point?.metrics?.[key]?.mean || 0)
}

function formatPercent(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`
}

function formatNumber(value, digits = 3) {
  return Number(value || 0).toFixed(digits)
}

function formatInteger(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function strategyLabel(value) {
  return strategyLabels[value] || value || '无新增行动'
}

function groupLabel(value) {
  return String(value || '').replace('archetype-', '群体 ')
}

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function buildParticleLayout() {
  const groups = visualGroups.value
  if (!groups.length) return
  const total = particleCount.value
  const rawCounts = groups.map((group) => group.population_weight * total)
  const counts = rawCounts.map(Math.floor)
  let remainder = total - counts.reduce((sum, value) => sum + value, 0)
  const order = rawCounts
    .map((value, index) => ({ index, fraction: value - counts[index] }))
    .sort((left, right) => (
      right.fraction - left.fraction || left.index - right.index
    ))
  for (let index = 0; index < remainder; index += 1) {
    counts[order[index].index] += 1
  }
  const random = mulberry32(20260730)
  particleLayout = []
  groups.forEach((group, groupIndex) => {
    const angle = (Math.PI * 2 * groupIndex) / groups.length - Math.PI / 2
    const ring = groupIndex % 2 === 0 ? 0.29 : 0.22
    const centerX = 0.5 + Math.cos(angle) * ring
    const centerY = 0.50 + Math.sin(angle) * ring * 0.76
    const spread = 0.027 + Math.sqrt(group.population_weight) * 0.12
    for (let index = 0; index < counts[groupIndex]; index += 1) {
      const theta = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * spread
      particleLayout.push({
        ordinal: particleLayout.length,
        groupIndex,
        x: Math.min(0.97, Math.max(0.03, centerX + Math.cos(theta) * radius)),
        y: Math.min(0.95, Math.max(0.05, centerY + Math.sin(theta) * radius)),
        attentionRoll: random(),
        rumorRoll: random(),
        verifiedRoll: random(),
        pulseRoll: random()
      })
    }
  })
}

function renderParticles() {
  if (!pixiApp?.renderer || !currentPoint.value || !particleLayout.length) return
  particleLayers.forEach((layer) => layer.clear())
  pulseLayer.clear()
  const width = pixiApp.renderer.width
  const height = pixiApp.renderer.height
  const attention = metricValue(currentPoint.value, 'attention')
  const rumorReach = metricValue(currentPoint.value, 'rumor_reach')
  const verifiedReach = metricValue(currentPoint.value, 'verified_reach')
  const rumorBelief = metricValue(currentPoint.value, 'rumor_belief')
  const verifiedBelief = metricValue(currentPoint.value, 'verified_belief')
  const transmissionPressure = Math.min(
    1,
    (
      currentPoint.value.diffusion.rumor_transmissions
      + currentPoint.value.diffusion.verified_transmissions
    ) / maxTransmission.value
  )
  particleLayout.forEach((particle) => {
    const attentive = particle.attentionRoll < attention
    const rumor = (
      particle.rumorRoll < rumorReach
      && particle.pulseRoll < Math.min(1, rumorBelief * 2.2)
    )
    const verified = (
      particle.verifiedRoll < verifiedReach
      && (1 - particle.pulseRoll) < Math.min(1, verifiedBelief * 1.25)
    )
    let signal = 0
    if (rumor && verified) signal = rumorBelief > verifiedBelief ? 1 : 2
    else if (rumor) signal = 1
    else if (verified) signal = 2
    const layerIndex = signal * 2 + Number(attentive)
    const size = attentive ? 2.15 : 1.35
    particleLayers[layerIndex].rect(
      particle.x * width,
      particle.y * height,
      size,
      size
    )
    if (
      particle.pulseRoll < transmissionPressure * 0.006
      && tick.value >= 2
    ) {
      pulseLayer.circle(
        particle.x * width,
        particle.y * height,
        isDecisionTick.value ? 5.2 : 3.6
      )
    }
  })
  const colors = ['#5b6f80', '#94aec1', '#ff596f', '#ff8b67', '#3fb9c8', '#66f1d5']
  particleLayers.forEach((layer, index) => {
    layer.fill({
      color: colors[index],
      alpha: index % 2 === 0 ? 0.30 : 0.88
    })
  })
  pulseLayer.stroke({
    color: schemeColors[schemeId.value],
    width: 1.2,
    alpha: 0.72
  })
}

async function initParticles() {
  pixiApp = new Application()
  await pixiApp.init({
    resizeTo: particleHost.value,
    antialias: false,
    backgroundAlpha: 0,
    preference: 'webgl'
  })
  if (destroyed) {
    pixiApp.destroy(true)
    return
  }
  particleHost.value.appendChild(pixiApp.canvas)
  particleLayers = Array.from({ length: 6 }, () => new Graphics())
  pulseLayer = new Graphics()
  particleLayers.forEach((layer) => pixiApp.stage.addChild(layer))
  pixiApp.stage.addChild(pulseLayer)
  pixiApp.ticker.add(() => {
    frameCount += 1
    const now = performance.now()
    if (now - frameStartedAt > 1000) {
      fps.value = Math.round(frameCount * 1000 / (now - frameStartedAt))
      frameCount = 0
      frameStartedAt = now
    }
  })
  renderParticles()
}

function chartSeries(branchId) {
  const rows = scenario.value?.branches?.[branchId]?.timeline || []
  return rows.map((point) => metricValue(point))
}

function renderChart() {
  if (!chartHost.value || !scenario.value) return
  if (!metricChart) metricChart = echarts.init(chartHost.value)
  const selectedRows = timeline.value
  const lower = selectedRows.map((point) => point.metrics[metricKey.value].lower)
  const interval = selectedRows.map((point, index) => (
    point.metrics[metricKey.value].upper - lower[index]
  ))
  metricChart.setOption({
    animationDuration: 260,
    backgroundColor: 'transparent',
    grid: { left: 48, right: 22, top: 48, bottom: 36 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(5, 17, 25, .94)',
      borderColor: '#31536b',
      textStyle: { color: '#e7f4fb' },
      valueFormatter: (value) => formatPercent(value)
    },
    legend: {
      top: 4,
      textStyle: { color: '#91aaba', fontSize: 11 },
      data: [
        schemeShortLabels.natural,
        schemeShortLabels.rapid_transparency,
        schemeShortLabels.participatory_service,
        '所选方案 95% 区间'
      ]
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 16 }, (_, index) => `T${index}`),
      axisLabel: { color: '#6f899a' },
      axisLine: { lineStyle: { color: '#294758' } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: {
        color: '#6f899a',
        formatter: (value) => `${Math.round(value * 100)}%`
      },
      splitLine: { lineStyle: { color: 'rgba(79, 113, 131, .16)' } }
    },
    series: [
      {
        name: '_interval-base',
        type: 'line',
        stack: 'interval',
        symbol: 'none',
        data: lower,
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        tooltip: { show: false }
      },
      {
        name: '所选方案 95% 区间',
        type: 'line',
        stack: 'interval',
        symbol: 'none',
        data: interval,
        lineStyle: { opacity: 0 },
        areaStyle: {
          color: schemeColors[schemeId.value],
          opacity: 0.10
        },
        tooltip: { show: false }
      },
      ...result.value.scheme_ids.map((id) => ({
        name: schemeShortLabels[id],
        type: 'line',
        smooth: 0.24,
        symbol: id === schemeId.value ? 'circle' : 'none',
        symbolSize: 5,
        data: chartSeries(id),
        lineStyle: {
          color: schemeColors[id],
          width: id === schemeId.value ? 3 : 1.8,
          opacity: id === schemeId.value ? 1 : 0.68
        },
        itemStyle: { color: schemeColors[id] },
        markLine: id === schemeId.value ? {
          silent: true,
          symbol: 'none',
          data: [{ xAxis: `T${tick.value}` }],
          lineStyle: { color: '#ffffff', opacity: 0.35, type: 'dashed' },
          label: { show: false }
        } : undefined
      }))
    ]
  }, true)
}

function localGraphData() {
  const groups = visualGroups.value
  if (!groups.length) return { nodes: [], edges: [] }
  const selectedIndex = Math.max(
    0,
    groups.findIndex((group) => group.group_id === selectedGroup.value)
  )
  const indices = [selectedIndex]
  for (let offset = 1; indices.length < Math.min(13, groups.length); offset += 1) {
    indices.push((selectedIndex + offset) % groups.length)
  }
  const rumor = metricValue(currentPoint.value, 'rumor_belief')
  const verified = metricValue(currentPoint.value, 'verified_belief')
  const concernByGroup = Object.fromEntries(
    latestTopGroups.value.map((row) => [row.archetype_id, row.concern])
  )
  const graphWidth = graphHost.value?.clientWidth || 360
  const graphHeight = graphHost.value?.clientHeight || 270
  const nodes = indices.map((groupIndex, localIndex) => {
    const group = groups[groupIndex]
    const isSelected = localIndex === 0
    const ringIndex = Math.max(0, localIndex - 1)
    const ringCount = localIndex <= 8 ? 8 : 4
    const ringPosition = localIndex <= 8 ? ringIndex : ringIndex - 8
    const angle = (
      Math.PI * 2 * ringPosition / ringCount
      - Math.PI / 2
    )
    const radius = localIndex <= 8
      ? Math.min(82, graphWidth * 0.24)
      : Math.min(120, graphWidth * 0.36)
    const concern = concernByGroup[group.group_id] || metricValue(currentPoint.value, 'concern')
    const fill = concern > 0.42
      ? '#ff6c72'
      : (verified >= rumor ? '#41cdbb' : '#f08768')
    return {
      id: group.group_id,
      style: {
        x: isSelected ? graphWidth / 2 : graphWidth / 2 + Math.cos(angle) * radius,
        y: isSelected ? graphHeight / 2 : graphHeight / 2 + Math.sin(angle) * radius * 0.78,
        size: 16 + Math.sqrt(group.population_weight) * 62,
        fill,
        fillOpacity: isSelected ? 1 : 0.70,
        stroke: isSelected ? '#ffffff' : '#17394b',
        lineWidth: isSelected ? 3 : 1,
        labelText: groupLabel(group.group_id),
        labelFill: '#ddecf4',
        labelFontSize: 9
      }
    }
  })
  const edges = nodes.slice(1).map((node, index) => ({
    id: `arena-edge-${index}`,
    source: nodes[0].id,
    target: node.id,
    style: {
      stroke: index < 8 ? '#4a7588' : '#f4aa5d',
      lineWidth: index < 8 ? 1.2 : 1.8,
      lineDash: index < 8 ? [] : [5, 4],
      opacity: 0.34 + currentPoint.value.diffusion.bridge_share * 0.55
    }
  }))
  return { nodes, edges }
}

async function renderGraph() {
  if (!graphHost.value || !currentPoint.value) return
  localGraph?.destroy()
  localGraph = new Graph({
    container: graphHost.value,
    width: graphHost.value.clientWidth,
    height: graphHost.value.clientHeight,
    data: localGraphData(),
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    animation: false
  })
  await localGraph.render()
}

function togglePlayback() {
  playing.value = !playing.value
  clearInterval(playTimer)
  if (!playing.value) return
  playTimer = setInterval(() => {
    tick.value = tick.value >= 15 ? 0 : tick.value + 1
  }, 850)
}

function selectScheme(value) {
  schemeId.value = value
}

async function refreshVisuals() {
  await nextTick()
  renderParticles()
  renderChart()
  await renderGraph()
}

function handleResize() {
  renderParticles()
  metricChart?.resize()
  renderGraph()
}

watch([scenarioId, schemeId, tick, metricKey, selectedGroup], refreshVisuals)

onMounted(async () => {
  document.documentElement.classList.add('governance-arena-root')
  document.body.classList.add('governance-arena-active')
  try {
    const [arenaResponse, populationResponse] = await Promise.all([
      fetch(assetUrl('governance-arena-v1.json'), { cache: 'no-store' }),
      fetch(assetUrl('mass-sim-v1.json'), { cache: 'no-store' })
    ])
    if (!arenaResponse.ok || !populationResponse.ok) {
      throw new Error(
        `离线数据响应异常：Arena ${arenaResponse.status} / Population ${populationResponse.status}`
      )
    }
    const [arenaPayload, populationPayload] = await Promise.all([
      arenaResponse.json(),
      populationResponse.json()
    ])
    if (
      arenaPayload.schema_version
      !== 'campus-pulse-governance-arena-result-v1'
    ) {
      throw new Error('治理竞技场数据合同版本不匹配')
    }
    if (
      arenaPayload.population_identity.population_sha256
      !== populationPayload.population_identity.population_sha256
    ) {
      throw new Error('治理结果与视觉人口的哈希身份不一致')
    }
    result.value = arenaPayload
    populationVisual.value = populationPayload
    selectedGroup.value = populationPayload.population_identity
      .visual_groups[0]?.group_id || 'archetype-01'
    buildParticleLayout()
    await nextTick()
    await initParticles()
    renderChart()
    await renderGraph()
    window.addEventListener('resize', handleResize)
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : '治理竞技场离线数据加载失败'
  }
})

onBeforeUnmount(() => {
  destroyed = true
  document.documentElement.classList.remove('governance-arena-root')
  document.body.classList.remove('governance-arena-active')
  clearInterval(playTimer)
  window.removeEventListener('resize', handleResize)
  metricChart?.dispose()
  localGraph?.destroy()
  pixiApp?.destroy(true)
})
</script>

<template>
  <main class="arena-shell">
    <header class="arena-topbar">
      <router-link class="arena-back" to="/campus-pulse">← Competition Final</router-link>
      <div class="arena-brand">
        <span class="arena-eyebrow">CAMPUSPULSE / GOVERNANCE ARENA vNEXT</span>
        <h1>千体治理干预竞技场</h1>
        <p>异质 episode 人口 × 竞争信息扩散 × 多主体序贯博弈</p>
      </div>
      <div class="arena-status">
        <i />
        OFFLINE · ZERO PROVIDER
      </div>
    </header>

    <section v-if="loadError" class="arena-error">
      <strong>治理竞技场未就绪</strong>
      <span>{{ loadError }}</span>
    </section>

    <template v-else-if="result">
      <section class="truth-strip">
        <span>1,000 个审阅论坛 episode 微智能体，不是真实学生</span>
        <span>10,000 粒子仅作视觉压力层</span>
        <span>全合成暴露图，不推断真实社交关系</span>
        <span>结果为模型条件差异，不作因果结论</span>
      </section>

      <section class="arena-controls">
        <label class="control-field">
          <span>压力测试场景</span>
          <select v-model="scenarioId">
            <option
              v-for="id in Object.keys(result.scenarios)"
              :key="id"
              :value="id"
            >
              {{ scenarioLabels[id] }}
            </option>
          </select>
        </label>

        <div class="scheme-switch" aria-label="治理方案">
          <button
            v-for="id in result.scheme_ids"
            :key="id"
            :class="[
              `scheme-${id}`,
              {
                active: schemeId === id,
                recommended: recommendedScheme === id
              }
            ]"
            @click="selectScheme(id)"
          >
            <small v-if="recommendedScheme === id">本场景推荐</small>
            <span>{{ schemeLabels[id] }}</span>
          </button>
        </div>

        <button class="arena-play" @click="togglePlayback">
          <span>{{ playing ? 'Ⅱ' : '▶' }}</span>
          {{ playing ? '暂停推演' : '播放推演' }}
        </button>

        <label class="tick-control">
          <span>
            T{{ tick.toString().padStart(2, '0') }}
            · {{ phaseLabels[currentPoint?.phase] }}
          </span>
          <input v-model.number="tick" type="range" min="0" max="15" step="1">
        </label>
      </section>

      <section class="arena-kpis">
        <article>
          <span>episode 微智能体</span>
          <strong>{{ formatInteger(result.population_identity.population_size) }}</strong>
          <small>96.2% 可行动人口权重</small>
        </article>
        <article>
          <span>视觉压力粒子</span>
          <strong>{{ formatInteger(result.population_identity.particle_count) }}</strong>
          <small>{{ fps }} FPS · 不计证据</small>
        </article>
        <article class="kpi-concern">
          <span>当前群体关切</span>
          <strong>{{ formatPercent(metricValue(currentPoint, 'concern')) }}</strong>
          <small>95% 配对种子区间 {{
            formatPercent(currentPoint.metrics.concern.lower)
          }}–{{ formatPercent(currentPoint.metrics.concern.upper) }}</small>
        </article>
        <article class="kpi-rumor">
          <span>错误信息 / 核验信念</span>
          <strong>
            {{ formatPercent(metricValue(currentPoint, 'rumor_belief')) }}
            <b>/</b>
            {{ formatPercent(metricValue(currentPoint, 'verified_belief')) }}
          </strong>
          <small>竞争信息扩散，不是事实判定器</small>
        </article>
        <article>
          <span>参与感缺口</span>
          <strong>{{ formatPercent(metricValue(currentPoint, 'voice_gap')) }}</strong>
          <small>越低越好 · 按画像需求加权</small>
        </article>
        <article>
          <span>方案资源</span>
          <strong>{{ resourceAtTick }} / 100</strong>
          <small>当前已用 {{ 100 - resourceAtTick }} · 全程守恒 {{
            branch.resource.conserved ? '通过' : '失败'
          }}</small>
        </article>
        <article>
          <span>低成本状态更新</span>
          <strong>{{ formatInteger(result.usage.low_cost_agent_tick_updates) }}</strong>
          <small>双场景 × 三分支 × 八种子</small>
        </article>
        <article class="kpi-zero">
          <span>Provider / 真实动作</span>
          <strong>{{ result.usage.provider_calls }} / {{ result.usage.real_governance_actions }}</strong>
          <small>全程网络隔离，可离线复现</small>
        </article>
      </section>

      <section class="arena-grid">
        <article class="panel particle-panel">
          <header class="panel-header">
            <div>
              <span class="panel-kicker">POPULATION PRESSURE FIELD</span>
              <h2>10,000 粒子舆论压力场</h2>
            </div>
            <div class="signal-legend">
              <span><i class="quiet" />未激活</span>
              <span><i class="rumor" />错误信息</span>
              <span><i class="verified" />核验信息</span>
            </div>
          </header>
          <div ref="particleHost" class="particle-stage">
            <div class="particle-crosshair horizontal" />
            <div class="particle-crosshair vertical" />
            <div v-if="isDecisionTick" class="decision-wave">
              T{{ tick }} 治理主体行动已注入
            </div>
          </div>
          <footer class="panel-foot">
            <span>亮度 = 注意力 · 颜色 = 当前竞争信息状态</span>
            <span>脉冲 = 当时点传播压力的确定性视觉采样</span>
          </footer>
        </article>

        <article class="panel diffusion-panel">
          <header class="panel-header compact">
            <div>
              <span class="panel-kicker">COMPETING DIFFUSION</span>
              <h2>竞争信息传播</h2>
            </div>
            <span class="synthetic-badge">SYNTHETIC GRAPH</span>
          </header>

          <div class="diffusion-bars">
            <div>
              <span>错误信息触达</span>
              <strong>{{ formatPercent(metricValue(currentPoint, 'rumor_reach')) }}</strong>
              <i><b :style="{ width: formatPercent(metricValue(currentPoint, 'rumor_reach')) }" /></i>
            </div>
            <div class="verified-bar">
              <span>核验信息触达</span>
              <strong>{{ formatPercent(metricValue(currentPoint, 'verified_reach')) }}</strong>
              <i><b :style="{ width: formatPercent(metricValue(currentPoint, 'verified_reach')) }" /></i>
            </div>
          </div>

          <div class="transmission-counts">
            <div>
              <span>错误信息传递 / 种子均值</span>
              <strong>{{ formatNumber(currentPoint.diffusion.rumor_transmissions, 1) }}</strong>
            </div>
            <div>
              <span>核验信息传递 / 种子均值</span>
              <strong>{{ formatNumber(currentPoint.diffusion.verified_transmissions, 1) }}</strong>
            </div>
            <div>
              <span>桥接边占比</span>
              <strong>{{ formatPercent(currentPoint.diffusion.bridge_share) }}</strong>
            </div>
          </div>

          <label class="group-select">
            <span>查看局部合成暴露图</span>
            <select v-model="selectedGroup">
              <option
                v-for="group in visualGroups"
                :key="group.group_id"
                :value="group.group_id"
              >
                {{ groupLabel(group.group_id) }} · {{ formatPercent(group.population_weight) }}
              </option>
            </select>
          </label>
          <div ref="graphHost" class="local-graph" />
          <div class="edge-legend">
            <span><i />8 条语义邻边</span>
            <span><i class="bridge-edge" />4 条跨原型桥接边</span>
          </div>
        </article>

        <article class="panel chart-panel">
          <header class="panel-header">
            <div>
              <span class="panel-kicker">PAIRED COUNTERFACTUALS</span>
              <h2>同人口、同种子三分支对照</h2>
            </div>
            <div class="metric-tabs">
              <button
                v-for="item in metricOptions"
                :key="item.key"
                :class="{ active: metricKey === item.key }"
                @click="metricKey = item.key"
              >
                {{ item.label }}
              </button>
            </div>
          </header>
          <div ref="chartHost" class="metric-chart" />
          <footer class="panel-foot">
            <span>{{ selectedMetric.label }} · {{
              selectedMetric.good === 'low' ? '越低越好' : '越高越好'
            }}</span>
            <span>阴影为所选分支 8 个配对种子的 95% t 区间</span>
          </footer>
        </article>

        <article class="panel game-panel">
          <header class="panel-header compact">
            <div>
              <span class="panel-kicker">MULTI-ACTOR GAME</span>
              <h2>有预算的序贯最佳响应</h2>
            </div>
            <span class="game-status">
              {{ currentRound ? `最近决策 T${currentRound.tick}` : '等待 T3' }}
            </span>
          </header>

          <div v-if="schemeId === 'natural'" class="natural-empty">
            <strong>自然反事实不注入治理行动</strong>
            <p>保留 100 单位资源，作为两个干预方案的配对参照。</p>
          </div>
          <div v-else-if="!currentRound" class="natural-empty">
            <strong>共享基线尚未进入博弈</strong>
            <p>T3、T7、T11 将依次由责任主体、服务主体和桥接主体决策。</p>
          </div>
          <div v-else class="actor-list">
            <article
              v-for="decision in currentRound.decisions"
              :key="decision.actor"
              class="actor-card"
            >
              <div class="actor-title">
                <span>{{ actorLabels[decision.actor] }}</span>
                <b>−{{ decision.resource_cost }} 资源</b>
              </div>
              <strong>{{ strategyLabel(decision.selected_strategy) }}</strong>
              <div class="utility-row">
                <span>候选效用</span>
                <div>
                  <i
                    v-for="candidate in decision.candidate_utilities"
                    :key="candidate.strategy_id"
                    :class="{
                      selected: candidate.strategy_id === decision.selected_strategy
                    }"
                    :style="{
                      height: `${Math.max(6, 8 + candidate.utility * 24)}px`
                    }"
                    :title="`${strategyLabel(candidate.strategy_id)} · ${candidate.utility}`"
                  />
                </div>
                <b>{{ formatNumber(decision.selected_utility) }}</b>
              </div>
            </article>
          </div>

          <div class="game-boundary">
            <span>解概念：有界序贯最佳响应</span>
            <span>策略跨种子稳定：{{ currentRound?.strategy_stable_across_seeds ? '是' : '否' }}</span>
            <span>不宣称纳什均衡</span>
          </div>
        </article>

        <article class="panel comparison-panel">
          <header class="panel-header compact">
            <div>
              <span class="panel-kicker">POLICY VALUE</span>
              <h2>目标函数与方案取舍</h2>
            </div>
            <span class="recommendation-chip">
              推荐 {{ schemeShortLabels[recommendedScheme] }}
            </span>
          </header>

          <p class="objective-label">{{ comparison.objective.label }}</p>
          <div class="comparison-table">
            <div class="comparison-head">
              <span>方案</span>
              <span>关切 AUC</span>
              <span>谣言 AUC</span>
              <span>末期信任</span>
              <span>参与缺口</span>
              <span>资源</span>
              <span>得分</span>
            </div>
            <button
              v-for="row in comparisonRows"
              :key="row.scheme_id"
              :class="{
                active: schemeId === row.scheme_id,
                winner: recommendedScheme === row.scheme_id
              }"
              @click="selectScheme(row.scheme_id)"
            >
              <span>{{ schemeShortLabels[row.scheme_id] }}</span>
              <span>{{ formatNumber(row.concern_auc) }}</span>
              <span>{{ formatNumber(row.rumor_auc) }}</span>
              <span>{{ formatPercent(row.end_trust) }}</span>
              <span>{{ formatPercent(row.end_voice_gap) }}</span>
              <span>{{ row.resource_consumed }}</span>
              <span>{{ row.objective_evaluation
                ? formatNumber(row.objective_evaluation.objective_score)
                : '基线'
              }}</span>
            </button>
          </div>

          <div class="objective-weights">
            <span
              v-for="(value, key) in comparison.objective.weights"
              :key="key"
              :class="{ penalty: value < 0 }"
            >
              {{ key
                .replace('_reduction_ratio', '')
                .replace('_gain_ratio', '')
                .replace('_cost_ratio', '') }}
              <b>{{ value > 0 ? '+' : '' }}{{ formatPercent(value, 0) }}</b>
            </span>
          </div>
          <p class="tradeoff">{{ comparison.conditional_recommendation.tradeoff }}</p>
        </article>

        <article class="panel audit-panel">
          <header class="panel-header compact">
            <div>
              <span class="panel-kicker">MODEL AUDIT</span>
              <h2>画像、意见与边界检查</h2>
            </div>
            <span class="audit-pass">7 / 7 PASS</span>
          </header>
          <div class="audit-grid">
            <div>
              <span>审阅立场对齐权重</span>
              <strong>{{
                formatPercent(result.profile_audit.reviewed_stance_modal_alignment_weight)
              }}</strong>
              <small>仅评价基线模态意见</small>
            </div>
            <div>
              <span>风险上报单调性</span>
              <strong>{{ result.profile_audit.risk_reporting_is_monotonic ? '通过' : '失败' }}</strong>
              <small>high ＞ medium ＞ low ＞ none</small>
            </div>
            <div>
              <span>背景信号权重</span>
              <strong>{{
                formatPercent(result.profile_audit.background_signal_population_weight)
              }}</strong>
              <small>archetype-16 禁止行动</small>
            </div>
            <div>
              <span>治理风险信号权重</span>
              <strong>{{
                formatPercent(result.profile_audit.governance_risk_signal_population_weight)
              }}</strong>
              <small>archetype-09 仅可读 / 上报</small>
            </div>
          </div>

          <div class="risk-monotonic">
            <span
              v-for="(value, key) in result.profile_audit.report_risk_probability_by_reviewed_risk"
              :key="key"
            >
              <i :style="{ height: `${8 + value * 480}px` }" />
              <b>{{ key }}</b>
              <small>{{ formatPercent(value) }}</small>
            </span>
          </div>

          <ul class="audit-checks">
            <li>共享基线近似平稳且三分支同状态起跑</li>
            <li>所有连续状态远离 0 / 1 非物理边界</li>
            <li>画像负面约束与证据标识不进入响应评分</li>
            <li>公开产物不含正文、身份、图边或微观状态</li>
          </ul>
        </article>
      </section>

      <section class="arena-footer">
        <div>
          <strong>解释边界</strong>
          <span>{{ result.uncertainty.interval }}</span>
        </div>
        <div>
          <strong>性能</strong>
          <span>{{ result.performance.engine_elapsed_seconds.toFixed(2) }}s · {{
            (result.performance.peak_additional_memory_bytes / 1048576).toFixed(1)
          }} MB 额外峰值</span>
        </div>
        <div>
          <strong>结果哈希</strong>
          <code>{{ result.result_sha256.slice(0, 16) }}…</code>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
:global(html.governance-arena-root) {
  height: auto;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

:global(body.governance-arena-active) {
  margin: 0;
  height: auto;
  min-width: 0;
  min-height: 100%;
  background: #061018;
  color: #e5f2f7;
  overflow-y: auto;
}

:global(body.governance-arena-active .global-theme-toggle) {
  display: none;
}

.arena-shell {
  min-height: 100vh;
  overflow-x: hidden;
  color: #dceaf0;
  background:
    radial-gradient(circle at 12% 12%, rgba(52, 173, 170, .12), transparent 32%),
    radial-gradient(circle at 88% 7%, rgba(255, 151, 73, .11), transparent 29%),
    linear-gradient(145deg, #061018 0%, #08141d 46%, #071018 100%);
  font-family:
    Inter, "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.arena-topbar {
  min-height: 110px;
  display: grid;
  grid-template-columns: 200px 1fr 220px;
  align-items: center;
  gap: 22px;
  padding: 18px clamp(20px, 3vw, 48px);
  border-bottom: 1px solid rgba(106, 151, 172, .18);
  background: rgba(4, 15, 22, .72);
  backdrop-filter: blur(18px);
}

.arena-back {
  color: #819eae;
  font-size: 12px;
  letter-spacing: .05em;
  text-decoration: none;
}

.arena-back:hover { color: #fff; }

.arena-brand { text-align: center; }
.arena-brand h1 {
  margin: 4px 0 2px;
  color: #f2fbff;
  font-size: clamp(24px, 3vw, 38px);
  font-weight: 650;
  letter-spacing: .08em;
}
.arena-brand p {
  margin: 0;
  color: #7997a8;
  font-size: 12px;
  letter-spacing: .08em;
}
.arena-eyebrow,
.panel-kicker {
  color: #61d4c5;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .22em;
}
.arena-status {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border: 1px solid rgba(91, 220, 189, .26);
  border-radius: 999px;
  color: #71dbc9;
  background: rgba(21, 91, 84, .12);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .09em;
}
.arena-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #62e1c8;
  box-shadow: 0 0 12px #62e1c8;
}

.truth-strip {
  display: flex;
  justify-content: center;
  gap: 0;
  padding: 9px 20px;
  border-bottom: 1px solid rgba(95, 135, 155, .16);
  color: #6f8999;
  background: rgba(6, 22, 31, .65);
  font-size: 10px;
}
.truth-strip span { padding: 0 17px; }
.truth-strip span + span { border-left: 1px solid rgba(108, 145, 162, .22); }

.arena-controls {
  display: grid;
  grid-template-columns: minmax(190px, .75fr) minmax(460px, 1.7fr) 130px minmax(220px, 1fr);
  align-items: end;
  gap: 14px;
  padding: 18px clamp(18px, 2.5vw, 38px);
  border-bottom: 1px solid rgba(90, 133, 153, .17);
}
.control-field,
.tick-control,
.group-select {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.control-field > span,
.tick-control > span,
.group-select > span {
  color: #718b9b;
  font-size: 10px;
  letter-spacing: .08em;
}
select {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #244457;
  border-radius: 8px;
  color: #ddecf3;
  outline: none;
  background: #0a1a24;
}
.scheme-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}
.scheme-switch button {
  position: relative;
  min-height: 50px;
  padding: 8px 10px;
  border: 1px solid #203d4d;
  border-radius: 9px;
  color: #7894a4;
  background: rgba(10, 27, 37, .76);
  cursor: pointer;
}
.scheme-switch button span { font-size: 11px; }
.scheme-switch button small {
  position: absolute;
  top: -8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 5px;
  color: #071118;
  background: #ffca81;
  font-size: 8px;
  font-weight: 800;
}
.scheme-switch button.active {
  color: #edfaff;
  border-color: var(--scheme, #6d9cb0);
  background: rgba(28, 63, 75, .62);
  box-shadow: inset 0 -2px 0 var(--scheme, #6d9cb0);
}
.scheme-natural { --scheme: #7f8d9d; }
.scheme-rapid_transparency { --scheme: #51e2d0; }
.scheme-participatory_service { --scheme: #ffbf69; }
.arena-play {
  height: 42px;
  border: 1px solid rgba(84, 224, 204, .42);
  border-radius: 8px;
  color: #7ce2d2;
  background: rgba(38, 141, 128, .12);
  cursor: pointer;
}
.arena-play span { margin-right: 6px; }
.tick-control input { width: 100%; accent-color: #54d6c5; }

.arena-kpis {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 1px;
  background: rgba(75, 111, 128, .18);
  border-bottom: 1px solid rgba(94, 133, 151, .16);
}
.arena-kpis article {
  min-width: 0;
  padding: 14px 13px 13px;
  background: rgba(7, 20, 29, .94);
}
.arena-kpis span,
.arena-kpis small {
  display: block;
  overflow: hidden;
  color: #688391;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arena-kpis strong {
  display: block;
  margin: 5px 0 3px;
  overflow: hidden;
  color: #e4f2f7;
  font-size: clamp(17px, 1.65vw, 25px);
  font-weight: 580;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arena-kpis strong b {
  color: #556f7e;
  font-size: .65em;
}
.kpi-concern strong,
.kpi-rumor strong { color: #ffb168; }
.kpi-zero strong { color: #5ee0c6; }

.arena-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(330px, .78fr);
  gap: 14px;
  padding: 14px clamp(14px, 2vw, 30px) 22px;
}
.panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(91, 136, 155, .19);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(10, 27, 37, .92), rgba(6, 19, 27, .96));
  box-shadow: 0 16px 55px rgba(0, 0, 0, .14);
}
.panel-header {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(89, 132, 151, .15);
}
.panel-header.compact { min-height: 48px; }
.panel-header h2 {
  margin: 3px 0 0;
  color: #e4f2f7;
  font-size: 14px;
  font-weight: 600;
}
.signal-legend,
.edge-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #718c9c;
  font-size: 9px;
}
.signal-legend span,
.edge-legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}
.signal-legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.signal-legend .quiet { background: #7690a0; }
.signal-legend .rumor { background: #ff6577; box-shadow: 0 0 8px #ff6577; }
.signal-legend .verified { background: #57e2cd; box-shadow: 0 0 8px #57e2cd; }
.particle-stage {
  position: relative;
  height: 450px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, rgba(47, 106, 117, .12), transparent 48%),
    linear-gradient(rgba(68, 108, 124, .05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(68, 108, 124, .05) 1px, transparent 1px);
  background-size: auto, 34px 34px, 34px 34px;
}
.particle-stage canvas {
  position: relative;
  z-index: 2;
  display: block;
}
.particle-crosshair {
  position: absolute;
  z-index: 1;
  background: rgba(91, 155, 163, .08);
}
.particle-crosshair.horizontal { top: 50%; left: 0; width: 100%; height: 1px; }
.particle-crosshair.vertical { top: 0; left: 50%; width: 1px; height: 100%; }
.decision-wave {
  position: absolute;
  z-index: 4;
  top: 18px;
  left: 50%;
  padding: 6px 11px;
  border: 1px solid rgba(255, 194, 111, .42);
  border-radius: 999px;
  color: #ffd29b;
  background: rgba(104, 63, 29, .72);
  font-size: 9px;
  transform: translateX(-50%);
  animation: wave 1.4s ease-in-out infinite;
}
@keyframes wave {
  50% { box-shadow: 0 0 24px rgba(255, 180, 92, .24); }
}
.panel-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 15px;
  color: #5f7c8c;
  border-top: 1px solid rgba(91, 136, 155, .13);
  font-size: 9px;
}

.diffusion-panel { min-height: 540px; }
.synthetic-badge,
.game-status,
.audit-pass,
.recommendation-chip {
  padding: 5px 8px;
  border: 1px solid rgba(86, 202, 188, .25);
  border-radius: 999px;
  color: #61cdbc;
  font-size: 8px;
  letter-spacing: .06em;
}
.diffusion-bars { padding: 13px 15px 4px; }
.diffusion-bars > div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px 10px;
  margin-bottom: 10px;
  color: #8299a6;
  font-size: 9px;
}
.diffusion-bars strong { color: #ff7d83; font-size: 11px; }
.diffusion-bars i {
  grid-column: 1 / -1;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #142e3b;
}
.diffusion-bars i b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #a13f54, #ff6a78);
}
.diffusion-bars .verified-bar strong { color: #5ee0ca; }
.diffusion-bars .verified-bar i b {
  background: linear-gradient(90deg, #1c857e, #5ee0ca);
}
.transmission-counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 4px 15px 12px;
  border: 1px solid rgba(76, 119, 138, .17);
  border-radius: 8px;
}
.transmission-counts div { padding: 9px; }
.transmission-counts div + div { border-left: 1px solid rgba(76, 119, 138, .17); }
.transmission-counts span {
  display: block;
  color: #5e7a8a;
  font-size: 8px;
}
.transmission-counts strong {
  display: block;
  margin-top: 3px;
  color: #d7e9f1;
  font-size: 14px;
}
.group-select { padding: 0 15px; }
.group-select select { padding: 7px 9px; font-size: 10px; }
.local-graph { height: 270px; margin: 4px 5px 0; }
.edge-legend { justify-content: center; padding: 4px 10px 12px; }
.edge-legend i { width: 18px; height: 1px; background: #4a7588; }
.edge-legend .bridge-edge {
  height: 0;
  border-top: 1px dashed #f4aa5d;
  background: none;
}

.chart-panel { min-height: 430px; }
.metric-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}
.metric-tabs button {
  padding: 4px 7px;
  border: 1px solid #203f50;
  border-radius: 6px;
  color: #668494;
  background: #091923;
  font-size: 8px;
  cursor: pointer;
}
.metric-tabs button.active {
  color: #7fe5d5;
  border-color: rgba(82, 220, 198, .44);
}
.metric-chart { height: 340px; }

.game-panel { min-height: 430px; }
.natural-empty {
  margin: 18px;
  padding: 42px 22px;
  border: 1px dashed #29495a;
  border-radius: 9px;
  text-align: center;
}
.natural-empty strong { color: #b7cbd5; font-size: 13px; }
.natural-empty p { color: #627e8c; font-size: 10px; line-height: 1.7; }
.actor-list { padding: 12px; }
.actor-card {
  padding: 12px;
  border: 1px solid rgba(83, 133, 152, .18);
  border-radius: 8px;
  background: rgba(13, 37, 49, .46);
}
.actor-card + .actor-card { margin-top: 8px; }
.actor-title {
  display: flex;
  justify-content: space-between;
  color: #698797;
  font-size: 9px;
}
.actor-title b { color: #f0a36a; }
.actor-card > strong {
  display: block;
  margin: 6px 0 9px;
  color: #e2f0f6;
  font-size: 13px;
  font-weight: 550;
}
.utility-row {
  display: grid;
  grid-template-columns: 64px 1fr 42px;
  align-items: end;
  gap: 8px;
  color: #577484;
  font-size: 8px;
}
.utility-row > div {
  height: 35px;
  display: flex;
  align-items: end;
  gap: 4px;
}
.utility-row i {
  width: 100%;
  max-width: 26px;
  border-radius: 2px 2px 0 0;
  background: #294c5c;
}
.utility-row i.selected {
  background: linear-gradient(#6ce1d0, #267d79);
  box-shadow: 0 0 8px rgba(97, 224, 205, .25);
}
.utility-row b { color: #7fdacb; text-align: right; font-size: 11px; }
.game-boundary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 10px 14px;
  color: #597584;
  border-top: 1px solid rgba(87, 128, 146, .14);
  font-size: 8px;
}

.comparison-panel { min-height: 370px; }
.recommendation-chip {
  color: #ffd099;
  border-color: rgba(255, 191, 105, .31);
}
.objective-label {
  margin: 12px 15px;
  color: #9bb1bd;
  font-size: 10px;
}
.comparison-table { margin: 0 14px; font-size: 9px; }
.comparison-head,
.comparison-table button {
  display: grid;
  grid-template-columns: 1.2fr repeat(6, 1fr);
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 9px 8px;
  text-align: right;
}
.comparison-head {
  color: #557384;
  border-bottom: 1px solid rgba(87, 131, 149, .18);
}
.comparison-head span:first-child,
.comparison-table button span:first-child { text-align: left; }
.comparison-table button {
  border: 0;
  border-bottom: 1px solid rgba(87, 131, 149, .12);
  color: #8ba4b1;
  background: transparent;
  cursor: pointer;
}
.comparison-table button.active {
  color: #ecf9fd;
  background: rgba(50, 102, 113, .15);
}
.comparison-table button.winner span:first-child { color: #ffd094; }
.objective-weights {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 12px 14px 8px;
}
.objective-weights span {
  padding: 4px 6px;
  border-radius: 5px;
  color: #6f8a98;
  background: #0c202b;
  font-size: 7px;
}
.objective-weights b { color: #65d5c4; margin-left: 3px; }
.objective-weights .penalty b { color: #e79570; }
.tradeoff {
  margin: 4px 14px 14px;
  color: #66818f;
  font-size: 9px;
  line-height: 1.6;
}

.audit-panel { min-height: 370px; }
.audit-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  margin: 12px;
  background: rgba(80, 125, 143, .15);
}
.audit-grid div {
  padding: 10px;
  background: #0a1c26;
}
.audit-grid span,
.audit-grid small {
  display: block;
  color: #5c7887;
  font-size: 8px;
}
.audit-grid strong {
  display: block;
  margin: 4px 0 2px;
  color: #6fddca;
  font-size: 17px;
}
.risk-monotonic {
  height: 72px;
  display: flex;
  align-items: end;
  justify-content: space-around;
  margin: 5px 14px 8px;
  padding: 0 10px 6px;
  border-bottom: 1px solid rgba(80, 125, 143, .18);
}
.risk-monotonic span {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  color: #587585;
  font-size: 7px;
}
.risk-monotonic i {
  width: 12px;
  max-height: 36px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(#ff9c70, #7b3d43);
}
.risk-monotonic b { color: #809aa7; font-weight: 500; }
.risk-monotonic small { font-size: 7px; }
.audit-checks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
  margin: 10px 14px 15px;
  padding: 0;
  list-style: none;
}
.audit-checks li {
  position: relative;
  padding-left: 14px;
  color: #76919f;
  font-size: 8px;
  line-height: 1.5;
}
.audit-checks li::before {
  position: absolute;
  left: 0;
  content: "✓";
  color: #62dbc6;
}

.arena-footer {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 20px;
  padding: 16px clamp(20px, 3vw, 44px) 28px;
  color: #587483;
  border-top: 1px solid rgba(85, 126, 144, .17);
  font-size: 9px;
}
.arena-footer div { min-width: 0; }
.arena-footer strong {
  display: block;
  margin-bottom: 4px;
  color: #89a1ad;
}
.arena-footer code { color: #70cabc; }
.arena-error {
  margin: 60px auto;
  max-width: 560px;
  padding: 28px;
  border: 1px solid #7a3c4b;
  border-radius: 10px;
  color: #ff9fab;
}
.arena-error span { display: block; margin-top: 8px; color: #b27a84; }

@media (max-width: 1180px) {
  .arena-controls {
    grid-template-columns: 1fr 2fr 130px;
  }
  .tick-control { grid-column: 1 / -1; }
  .arena-kpis { grid-template-columns: repeat(4, 1fr); }
  .arena-grid { grid-template-columns: 1fr; }
  .particle-stage { height: 420px; }
}

@media (max-width: 720px) {
  .arena-topbar {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 16px 18px;
  }
  .arena-brand { text-align: left; }
  .arena-status { justify-self: start; }
  .truth-strip {
    justify-content: flex-start;
    overflow-x: auto;
    white-space: nowrap;
  }
  .arena-controls { grid-template-columns: 1fr; }
  .scheme-switch { grid-template-columns: 1fr; }
  .tick-control { grid-column: auto; }
  .arena-kpis { grid-template-columns: repeat(2, 1fr); }
  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .particle-stage { height: 340px; }
  .metric-tabs { justify-content: flex-start; }
  .metric-chart { height: 300px; }
  .comparison-table { overflow-x: auto; }
  .comparison-head,
  .comparison-table button {
    min-width: 630px;
  }
  .arena-footer { grid-template-columns: 1fr; }
}

@media (max-width: 420px) {
  .arena-brand h1 { font-size: 24px; letter-spacing: .04em; }
  .arena-brand p { font-size: 10px; }
  .arena-grid { padding: 8px; gap: 8px; }
  .arena-controls { padding: 12px; }
  .arena-kpis strong { font-size: 18px; }
  .panel-foot { flex-direction: column; }
  .particle-stage { height: 290px; }
  .audit-grid,
  .audit-checks { grid-template-columns: 1fr; }
  .local-graph { height: 230px; }
}
</style>
