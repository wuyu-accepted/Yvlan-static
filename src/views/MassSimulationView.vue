<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Application, Graphics } from 'pixi.js'
import { Graph } from '@antv/g6'
import * as echarts from 'echarts'

const result = ref(null)
const loadError = ref('')
const scenarioId = ref('')
const branch = ref('governance')
const tick = ref(0)
const playing = ref(false)
const selectedGroup = ref('')
const fps = ref(0)
const particleHost = ref(null)
const graphHost = ref(null)
const chartHost = ref(null)

let playTimer
let pixiApp
let particleLayers = []
let glowLayer
let particleLayout = []
let exposureGraph
let branchChart
let frameCounter = 0
let frameStartedAt = performance.now()
let destroyed = false

const phaseLabels = {
  baseline: '基线',
  burst: '爆发',
  spread: '扩散',
  decay: '消退'
}
const scenarioLabels = {
  lecture_external_incident_shock: '外部事件冲击',
  tongzhou_governance_information_shock: '治理信息冲击'
}
const stanceColors = ['#50e3c2', '#6f8fae', '#ffc857', '#ff5d73']
const stanceNames = ['支持', '中性', '关切', '反对']

const scenarioIds = computed(() => Object.keys(result.value?.scenarios || {}))
const scenario = computed(() => result.value?.scenarios?.[scenarioId.value] || null)
const timeline = computed(() => scenario.value?.timeline?.[branch.value] || [])
const currentPoint = computed(() => timeline.value[tick.value] || null)
const currentProbe = computed(() => currentPoint.value?.probe_summary || null)
const visualGroups = computed(() => result.value?.population_identity?.visual_groups || [])
const currentDifferences = computed(() => scenario.value?.branch_differences?.[tick.value] || null)
const currentActions = computed(() => (
  scenario.value?.timeline?.governance?.[tick.value]?.governance_actions || []
))
const isSharedBaseline = computed(() => tick.value < 2)
const providerCalls = computed(() => result.value?.usage?.provider_calls ?? 0)
const lowCostUpdates = computed(() => result.value?.usage?.low_cost_state_updates ?? 0)
const writebackMode = computed(() => (
  result.value?.writeback_evaluation?.formal_mode || 'observation_only'
))

function assetUrl(file) {
  return `${import.meta.env.BASE_URL}campus-pulse-data/${file}`
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
  const total = result.value.population_identity.particle_count
  const raw = groups.map((group) => group.population_weight * total)
  const counts = raw.map(Math.floor)
  let remaining = total - counts.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - counts[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
  for (let index = 0; index < remaining; index += 1) counts[order[index].index] += 1
  const random = mulberry32(20260730)
  particleLayout = []
  groups.forEach((group, groupIndex) => {
    const angle = (Math.PI * 2 * groupIndex) / groups.length - Math.PI / 2
    const centerX = 0.5 + Math.cos(angle) * 0.29
    const centerY = 0.5 + Math.sin(angle) * 0.26
    const spread = 0.035 + Math.sqrt(group.population_weight) * 0.15
    for (let index = 0; index < counts[groupIndex]; index += 1) {
      const theta = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * spread
      particleLayout.push({
        ordinal: particleLayout.length,
        groupIndex,
        x: Math.min(0.96, Math.max(0.04, centerX + Math.cos(theta) * radius)),
        y: Math.min(0.94, Math.max(0.06, centerY + Math.sin(theta) * radius)),
        stanceRoll: random(),
        luminanceRoll: random()
      })
    }
  })
}

function particleStance(particle, state) {
  const support = Math.max(0.08, state.support)
  const opposition = Math.max(0.07, state.opposition)
  const concern = Math.max(0.10, state.concern * (1 - opposition * 0.35))
  const neutral = Math.max(0.08, 1 - support - opposition - concern * 0.55)
  const total = support + neutral + concern + opposition
  const roll = particle.stanceRoll * total
  if (roll < support) return 0
  if (roll < support + neutral) return 1
  if (roll < support + neutral + concern) return 2
  return 3
}

function renderParticles() {
  if (!pixiApp?.renderer || !currentPoint.value || !particleLayout.length) return
  const width = pixiApp.renderer.width
  const height = pixiApp.renderer.height
  const state = currentPoint.value.state_means
  particleLayers.forEach((layer) => layer.clear())
  glowLayer.clear()
  particleLayout.forEach((particle) => {
    const stance = particleStance(particle, state)
    const bright = particle.luminanceRoll < state.attention ? 1 : 0
    const layer = particleLayers[stance * 2 + bright]
    const size = bright ? 2.2 : 1.45
    layer.rect(particle.x * width, particle.y * height, size, size)
  })
  particleLayers.forEach((layer, index) => {
    const bright = index % 2 === 1
    layer.fill({
      color: stanceColors[Math.floor(index / 2)],
      alpha: bright ? 0.92 : 0.34
    })
  })
  const displayOrdinals = currentProbe.value?.display_probe_particle_ordinals || []
  displayOrdinals.forEach((ordinal) => {
    const particle = particleLayout[ordinal]
    if (!particle) return
    glowLayer.circle(particle.x * width, particle.y * height, 4.8)
  })
  glowLayer.stroke({ color: '#ffffff', width: 1.2, alpha: 0.95 })
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
  particleLayers = Array.from({ length: 8 }, () => new Graphics())
  glowLayer = new Graphics()
  particleLayers.forEach((layer) => pixiApp.stage.addChild(layer))
  pixiApp.stage.addChild(glowLayer)
  pixiApp.ticker.add(() => {
    frameCounter += 1
    const now = performance.now()
    if (now - frameStartedAt >= 1000) {
      fps.value = Math.round((frameCounter * 1000) / (now - frameStartedAt))
      frameCounter = 0
      frameStartedAt = now
    }
  })
  renderParticles()
}

function localGraphData() {
  const groups = visualGroups.value
  if (!groups.length) return { nodes: [], edges: [] }
  const selectedIndex = Math.max(
    0,
    groups.findIndex((group) => group.group_id === selectedGroup.value)
  )
  const neighborhood = [selectedIndex]
  for (let offset = 1; neighborhood.length < Math.min(13, groups.length); offset += 1) {
    neighborhood.push((selectedIndex + offset) % groups.length)
  }
  const state = currentPoint.value?.state_means || {
    support: 0.3,
    opposition: 0.3,
    concern: 0.3
  }
  const nodes = neighborhood.map((groupIndex, localIndex) => {
    const group = groups[groupIndex]
    const stance = particleStance(
      { stanceRoll: ((groupIndex * 37) % 100) / 100 },
      state
    )
    return {
      id: group.group_id,
      data: {
        weight: group.population_weight,
        selected: localIndex === 0
      },
      style: {
        fill: stanceColors[stance],
        stroke: localIndex === 0 ? '#ffffff' : '#203a52',
        lineWidth: localIndex === 0 ? 3 : 1,
        size: 17 + Math.sqrt(group.population_weight) * 62,
        labelText: group.group_id.replace('archetype-', '群'),
        labelFill: '#d8ebf7',
        labelFontSize: 10
      }
    }
  })
  const edges = nodes.slice(1).map((node, index) => ({
    id: `local-edge-${index}`,
    source: nodes[0].id,
    target: node.id,
    data: {
      edgeType: index < 8 ? 'semantic_neighbor' : 'cross_archetype_bridge'
    },
    style: {
      stroke: index < 8 ? '#46677f' : '#f5a65b',
      lineDash: index < 8 ? [] : [4, 4],
      opacity: 0.72
    }
  }))
  return { nodes, edges }
}

async function renderExposureGraph() {
  if (!graphHost.value || !currentPoint.value) return
  if (exposureGraph) exposureGraph.destroy()
  exposureGraph = new Graph({
    container: graphHost.value,
    width: graphHost.value.clientWidth,
    height: graphHost.value.clientHeight,
    data: localGraphData(),
    layout: {
      type: 'force',
      preventOverlap: true,
      linkDistance: 78,
      nodeStrength: -55
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    animation: false
  })
  await exposureGraph.render()
}

function confidenceBand(timelineData) {
  const lower = []
  const upper = []
  timelineData.forEach((point) => {
    const interval = point.probe_summary?.confidence_intervals_95?.stance?.concerned
    lower.push(interval ? interval[0] : null)
    upper.push(interval ? interval[1] : null)
  })
  return { lower, upper }
}

function renderChart() {
  if (!chartHost.value || !scenario.value) return
  if (!branchChart) branchChart = echarts.init(chartHost.value)
  const natural = scenario.value.timeline.natural
  const governance = scenario.value.timeline.governance
  const band = confidenceBand(scenario.value.timeline[branch.value])
  const bandWidth = band.upper.map((value, index) => (
    value == null || band.lower[index] == null ? null : value - band.lower[index]
  ))
  branchChart.setOption({
    animationDuration: 260,
    backgroundColor: 'transparent',
    grid: { left: 46, right: 20, top: 32, bottom: 38 },
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#a9bfd0' },
      data: ['自然演化·关切', '治理分支·关切', '95% 探针区间']
    },
    xAxis: {
      type: 'category',
      data: natural.map((point) => point.tick),
      axisLabel: { color: '#7892a7' },
      axisLine: { lineStyle: { color: '#29465c' } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: { color: '#7892a7' },
      splitLine: { lineStyle: { color: 'rgba(74, 110, 134, .18)' } }
    },
    series: [
      {
        name: '自然演化·关切',
        type: 'line',
        smooth: 0.28,
        symbol: 'none',
        data: natural.map((point) => point.state_means.concern),
        lineStyle: { width: 2, color: '#ffb357' }
      },
      {
        name: '治理分支·关切',
        type: 'line',
        smooth: 0.28,
        symbol: 'none',
        data: governance.map((point) => point.state_means.concern),
        lineStyle: { width: 3, color: '#50e3c2' },
        markLine: {
          symbol: 'none',
          silent: true,
          data: [{ xAxis: tick.value }],
          lineStyle: { color: '#ffffff', opacity: 0.36, type: 'dashed' },
          label: { show: false }
        }
      },
      {
        name: '_band-base',
        type: 'line',
        stack: 'confidence',
        connectNulls: true,
        symbol: 'none',
        data: band.lower,
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        tooltip: { show: false }
      },
      {
        name: '95% 探针区间',
        type: 'line',
        stack: 'confidence',
        connectNulls: true,
        symbol: 'none',
        data: bandWidth,
        lineStyle: { color: '#82a9c2', width: 1, opacity: 0.45 },
        areaStyle: { color: 'rgba(98, 160, 190, .2)' }
      }
    ]
  }, true)
}

function togglePlayback() {
  playing.value = !playing.value
  if (!playing.value) {
    clearInterval(playTimer)
    return
  }
  playTimer = setInterval(() => {
    tick.value = tick.value >= 15 ? 0 : tick.value + 1
  }, 900)
}

function selectBranch(nextBranch) {
  branch.value = nextBranch
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}

function formatInteger(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

async function refreshVisuals() {
  await nextTick()
  renderParticles()
  renderChart()
  await renderExposureGraph()
}

function handleResize() {
  renderParticles()
  branchChart?.resize()
  renderExposureGraph()
}

watch([scenarioId, branch, tick, selectedGroup], refreshVisuals)

onMounted(async () => {
  document.body.classList.add('mass-sim-active')
  try {
    const response = await fetch(assetUrl('mass-sim-v1.json'), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (payload.schema_version !== 'campus-pulse-live-aggregate-result-v3') {
      throw new Error('离线数据合同不是 aggregate-result-v3')
    }
    result.value = payload
    scenarioId.value = Object.keys(payload.scenarios)[0]
    selectedGroup.value = payload.population_identity.visual_groups[0]?.group_id || ''
    buildParticleLayout()
    await nextTick()
    await initParticles()
    renderChart()
    await renderExposureGraph()
    window.addEventListener('resize', handleResize)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '离线数据加载失败'
  }
})

onBeforeUnmount(() => {
  destroyed = true
  document.body.classList.remove('mass-sim-active')
  clearInterval(playTimer)
  window.removeEventListener('resize', handleResize)
  exposureGraph?.destroy()
  branchChart?.dispose()
  pixiApp?.destroy(true)
})
</script>

<template>
  <main class="mass-shell">
    <header class="topbar">
      <router-link class="back-link" to="/campus-pulse">← Competition Final</router-link>
      <div class="brand-block">
        <span class="eyebrow">CAMPUSPULSE / MASS SIM v1</span>
        <h1>千体预算化多智能体舆情沙盘</h1>
      </div>
      <div class="zero-provider">OFFLINE · ZERO PROVIDER</div>
    </header>

    <section v-if="loadError" class="error-panel">
      <strong>离线演示未就绪</strong>
      <span>{{ loadError }}</span>
    </section>

    <template v-else-if="result">
      <section class="boundary-strip">
        <span>1,000 个审阅论坛 episode 微智能体</span>
        <span>10,000 个视觉粒子不是证据主体</span>
        <span>合成暴露图不代表真实社交关系</span>
        <span>模型条件推演，不作因果与人群患病率主张</span>
      </section>

      <section class="control-deck">
        <label>
          <span>冲击场景</span>
          <select v-model="scenarioId">
            <option v-for="id in scenarioIds" :key="id" :value="id">
              {{ scenarioLabels[id] || id }}
            </option>
          </select>
        </label>
        <div class="branch-switch" aria-label="政策分支">
          <button :class="{ active: branch === 'natural' }" @click="selectBranch('natural')">
            自然演化
          </button>
          <button :class="{ active: branch === 'governance' }" @click="selectBranch('governance')">
            治理分支
          </button>
        </div>
        <button class="play-button" @click="togglePlayback">
          {{ playing ? '暂停' : '播放 16 时点' }}
        </button>
        <label class="timeline-control">
          <span>T{{ tick.toString().padStart(2, '0') }} · {{ phaseLabels[currentPoint?.phase] }}</span>
          <input v-model.number="tick" type="range" min="0" max="15" step="1">
        </label>
      </section>

      <section class="metric-grid">
        <article>
          <span>证据微智能体</span>
          <strong>{{ formatInteger(result.population_identity.population_size) }}</strong>
          <small>论坛行为 episode</small>
        </article>
        <article>
          <span>视觉压力粒子</span>
          <strong>{{ formatInteger(result.population_identity.particle_count) }}</strong>
          <small>每父节点 10 个，不计证据</small>
        </article>
        <article :class="{ pulse: currentProbe }">
          <span>本时点 LLM 语义探针</span>
          <strong>{{ currentProbe?.budget || 0 }}</strong>
          <small>{{ currentProbe ? '固定预算，六层 PPS' : '非校正时点' }}</small>
        </article>
        <article>
          <span>低成本状态更新</span>
          <strong>{{ formatInteger(lowCostUpdates) }}</strong>
          <small>全体 GLM / 状态空间推进</small>
        </article>
        <article>
          <span>Kish ESS</span>
          <strong>{{ currentProbe ? currentProbe.mean_kish_ess.toFixed(1) : '—' }}</strong>
          <small>抽样权重有效样本量</small>
        </article>
        <article>
          <span>Provider 调用</span>
          <strong>{{ providerCalls }}</strong>
          <small>主体发布严格零调用</small>
        </article>
        <article>
          <span>真实治理动作</span>
          <strong>{{ result.usage.real_governance_actions }}</strong>
          <small>屏幕动作均为合成压力测试</small>
        </article>
        <article>
          <span>正式写回模式</span>
          <strong class="mode">{{ writebackMode }}</strong>
          <small>冻结门槛自动选择</small>
        </article>
      </section>

      <section class="hero-grid">
        <article class="panel particle-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">PIXĪ.JS / 10K</span>
              <h2>人口压力场</h2>
            </div>
            <span class="fps" :class="{ low: fps && fps < 30 }">{{ fps || '—' }} FPS</span>
          </div>
          <div ref="particleHost" class="particle-canvas" aria-label="一万个合成粒子"></div>
          <div class="legend">
            <span v-for="(name, index) in stanceNames" :key="name">
              <i :style="{ background: stanceColors[index] }"></i>{{ name }}
            </span>
            <span><i class="attention-dot"></i>亮度 = 注意力</span>
            <span><i class="probe-dot"></i>光环 = 展示探针（非抽样身份）</span>
          </div>
        </article>

        <aside class="side-stack">
          <article class="panel state-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">CURRENT STATE</span>
                <h2>{{ branch === 'governance' ? '治理分支' : '自然演化' }} · T{{ tick }}</h2>
              </div>
              <span class="phase-chip">{{ phaseLabels[currentPoint?.phase] }}</span>
            </div>
            <div class="state-bars">
              <div v-for="field in ['attention', 'concern', 'trust', 'satisfaction']" :key="field">
                <span>{{ { attention: '注意力', concern: '关切', trust: '信任', satisfaction: '满意度' }[field] }}</span>
                <div><i :style="{ width: formatPercent(currentPoint?.state_means?.[field]) }"></i></div>
                <strong>{{ formatPercent(currentPoint?.state_means?.[field]) }}</strong>
              </div>
            </div>
            <p v-if="isSharedBaseline" class="shared-note">
              两个政策分支严格共享 T00–T01 人口状态和随机种子。
            </p>
            <dl v-else class="gap-list">
              <div><dt>关切差</dt><dd>{{ formatPercent(currentDifferences?.concern_delta) }}</dd></div>
              <div><dt>信任差</dt><dd>{{ formatPercent(currentDifferences?.trust_delta) }}</dd></div>
              <div><dt>活跃差</dt><dd>{{ formatPercent(currentDifferences?.activity_delta) }}</dd></div>
            </dl>
          </article>

          <article class="panel action-panel" :class="{ active: currentActions.length }">
            <span class="eyebrow">SYNTHETIC GOVERNANCE</span>
            <template v-if="currentActions.length">
              <h2>治理动作已触发</h2>
              <div v-for="action in currentActions" :key="action.action" class="action-card">
                <strong>{{ action.action }}</strong>
                <span>责任主体：{{ action.actor }}</span>
                <span>资源消耗：{{ action.resource_units }} 单位</span>
                <span>传播：{{ action.propagation_path.join(' → ') }}</span>
              </div>
            </template>
            <template v-else>
              <h2>本时点无治理动作</h2>
              <p>模型继续推进自然扩散与有限衰减，不补写虚构干预。</p>
            </template>
          </article>
        </aside>
      </section>

      <section class="analysis-grid">
        <article class="panel chart-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">ECHARTS / BRANCH DELTA</span>
              <h2>自然—治理分支与 95% 不确定性</h2>
            </div>
          </div>
          <div ref="chartHost" class="branch-chart"></div>
        </article>

        <article class="panel graph-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">G6 / LOCAL SYNTHETIC GRAPH</span>
              <h2>选中群体的局部暴露结构</h2>
            </div>
            <select v-model="selectedGroup">
              <option v-for="group in visualGroups" :key="group.group_id" :value="group.group_id">
                {{ group.group_id }} · {{ formatPercent(group.population_weight) }}
              </option>
            </select>
          </div>
          <div ref="graphHost" class="exposure-graph"></div>
          <p>节点大小 = 设计人口权重；实线 = 语义近邻；虚线 = 跨原型桥。这里只展示群体聚合，不展示微智能体、样本身份或记录级边。</p>
        </article>
      </section>

      <section class="utterance-strip">
        <article v-for="item in result.representative_synthetic_utterances" :key="item.label">
          <span>{{ item.label }}</span>
          <p>“{{ item.text }}”</p>
          <small>经审阅合成文本 · 非原帖</small>
        </article>
      </section>

      <footer>
        <span>aggregate-result-v3 · {{ result.result_sha256.slice(0, 12) }}</span>
        <span>引擎 {{ result.performance.engine_elapsed_seconds.toFixed(2) }}s · 峰值附加内存 {{ (result.performance.peak_additional_memory_bytes / 1048576).toFixed(1) }} MB</span>
        <router-link to="/campus-pulse/workbench">进入治理工作台 →</router-link>
      </footer>
    </template>
  </main>
</template>

<style scoped>
:global(body.mass-sim-active) {
  margin: 0;
  background: #071018;
  color: #e8f4fb;
  overflow-x: hidden;
}

:global(body.mass-sim-active .global-theme-toggle) {
  display: none;
}

.mass-shell {
  min-height: 100vh;
  padding: 0 28px 28px;
  color: #e8f4fb;
  background:
    radial-gradient(circle at 8% 5%, rgba(44, 150, 171, .18), transparent 28rem),
    radial-gradient(circle at 92% 24%, rgba(255, 93, 115, .10), transparent 30rem),
    linear-gradient(145deg, #071018 0%, #091722 50%, #061017 100%);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.topbar {
  min-height: 88px;
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(150px, 1fr);
  align-items: center;
  border-bottom: 1px solid rgba(117, 174, 202, .18);
}

.back-link, footer a {
  color: #8fb4c7;
  text-decoration: none;
}

.brand-block {
  text-align: center;
}

.brand-block h1, .panel h2 {
  margin: 4px 0 0;
  font-weight: 650;
}

.brand-block h1 {
  font-size: clamp(20px, 2.3vw, 34px);
  letter-spacing: .04em;
}

.eyebrow {
  color: #5ad3c2;
  font-size: 10px;
  letter-spacing: .16em;
}

.zero-provider {
  justify-self: end;
  padding: 7px 11px;
  border: 1px solid rgba(80, 227, 194, .45);
  border-radius: 999px;
  color: #73e7cb;
  font: 600 10px/1 monospace;
  letter-spacing: .08em;
}

.boundary-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 22px;
  padding: 12px;
  color: #8ba4b5;
  font-size: 11px;
  border-bottom: 1px solid rgba(117, 174, 202, .12);
}

.boundary-strip span::before {
  content: "◆";
  margin-right: 7px;
  color: #41697e;
}

.control-deck {
  display: grid;
  grid-template-columns: minmax(170px, .7fr) auto auto minmax(260px, 1.5fr);
  gap: 12px;
  align-items: end;
  padding: 18px 0 14px;
}

label > span, .timeline-control span {
  display: block;
  margin-bottom: 7px;
  color: #7590a3;
  font-size: 11px;
}

select, button {
  border: 1px solid rgba(100, 151, 178, .3);
  border-radius: 8px;
  color: #dcecf5;
  background: rgba(11, 29, 41, .92);
}

select {
  width: 100%;
  padding: 9px 10px;
}

button {
  padding: 9px 14px;
  cursor: pointer;
}

.branch-switch {
  display: flex;
}

.branch-switch button {
  border-radius: 0;
}

.branch-switch button:first-child {
  border-radius: 8px 0 0 8px;
}

.branch-switch button:last-child {
  border-radius: 0 8px 8px 0;
}

.branch-switch .active, .play-button {
  color: #061816;
  border-color: #50e3c2;
  background: #50e3c2;
}

.timeline-control input {
  width: 100%;
  accent-color: #50e3c2;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 12px;
}

.metric-grid article {
  min-height: 84px;
  padding: 13px;
  border: 1px solid rgba(87, 132, 157, .18);
  border-radius: 10px;
  background: rgba(8, 24, 34, .72);
}

.metric-grid span, .metric-grid small {
  display: block;
  color: #7690a1;
  font-size: 10px;
}

.metric-grid strong {
  display: block;
  margin: 7px 0 5px;
  color: #f0f8fc;
  font: 650 22px/1 monospace;
}

.metric-grid strong.mode {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
}

.metric-grid article.pulse {
  border-color: rgba(80, 227, 194, .58);
  box-shadow: inset 0 0 24px rgba(80, 227, 194, .08);
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) minmax(290px, .8fr);
  gap: 12px;
}

.side-stack, .analysis-grid {
  display: grid;
  gap: 12px;
}

.side-stack {
  grid-template-rows: 1fr .72fr;
}

.panel {
  overflow: hidden;
  border: 1px solid rgba(90, 142, 169, .2);
  border-radius: 12px;
  background: rgba(7, 22, 31, .78);
  box-shadow: 0 18px 50px rgba(0, 0, 0, .16);
}

.panel-heading {
  min-height: 54px;
  padding: 14px 16px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel h2 {
  font-size: 16px;
}

.particle-canvas {
  height: min(52vw, 540px);
  min-height: 390px;
}

.particle-canvas :deep(canvas) {
  display: block;
}

.legend {
  min-height: 36px;
  padding: 8px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  color: #7893a4;
  font-size: 10px;
  border-top: 1px solid rgba(90, 142, 169, .12);
}

.legend i {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  border-radius: 50%;
}

.legend .attention-dot {
  background: white;
  box-shadow: 0 0 8px white;
}

.legend .probe-dot {
  border: 1px solid white;
  background: transparent;
}

.fps, .phase-chip {
  padding: 5px 8px;
  border-radius: 999px;
  color: #65d8c2;
  background: rgba(80, 227, 194, .09);
  font: 600 10px/1 monospace;
}

.fps.low {
  color: #ffbf69;
  background: rgba(255, 191, 105, .1);
}

.state-bars {
  padding: 10px 16px;
}

.state-bars > div {
  display: grid;
  grid-template-columns: 52px 1fr 44px;
  gap: 9px;
  align-items: center;
  margin: 11px 0;
  font-size: 11px;
}

.state-bars > div > span {
  color: #8da6b6;
}

.state-bars > div > div {
  height: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(95, 135, 156, .18);
}

.state-bars i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #347c88, #50e3c2);
}

.state-bars strong {
  color: #dcecf5;
  font: 500 10px monospace;
  text-align: right;
}

.shared-note, .action-panel p, .graph-panel p {
  margin: 4px 16px 14px;
  color: #839bab;
  font-size: 11px;
  line-height: 1.6;
}

.gap-list {
  padding: 0 16px;
}

.gap-list > div {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-top: 1px solid rgba(95, 135, 156, .13);
}

.gap-list dt {
  color: #7e98aa;
}

.gap-list dd {
  margin: 0;
  color: #d9e9f2;
  font-family: monospace;
}

.action-panel {
  padding: 16px;
}

.action-panel.active {
  border-color: rgba(255, 184, 87, .45);
  box-shadow: inset 0 0 40px rgba(255, 169, 64, .06);
}

.action-card {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  color: #8ca4b3;
  font-size: 11px;
}

.action-card strong {
  color: #ffc46c;
  font-size: 13px;
}

.analysis-grid {
  grid-template-columns: minmax(0, 1.2fr) minmax(350px, .8fr);
  margin-top: 12px;
}

.branch-chart, .exposure-graph {
  height: 330px;
}

.graph-panel select {
  width: auto;
  max-width: 190px;
}

.utterance-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.utterance-strip article {
  padding: 17px;
  border-left: 2px solid #4eae9d;
  background: rgba(10, 27, 38, .72);
}

.utterance-strip span, .utterance-strip small {
  color: #6e8b9e;
  font-size: 10px;
}

.utterance-strip p {
  min-height: 40px;
  margin: 10px 0;
  color: #cfe1eb;
  line-height: 1.65;
}

footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 4px 2px;
  color: #657f91;
  font: 10px/1.4 monospace;
}

.error-panel {
  margin: 80px auto;
  max-width: 600px;
  padding: 24px;
  display: grid;
  gap: 8px;
  border: 1px solid rgba(255, 93, 115, .4);
  border-radius: 12px;
  background: rgba(65, 18, 28, .34);
}

@media (max-width: 1120px) {
  .metric-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .hero-grid, .analysis-grid {
    grid-template-columns: 1fr;
  }
  .side-stack {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto;
  }
}

@media (max-width: 700px) {
  .mass-shell {
    padding: 0 12px 18px;
  }
  .topbar {
    grid-template-columns: 1fr auto;
    padding: 12px 0;
  }
  .brand-block {
    grid-column: 1 / -1;
    grid-row: 1;
    margin-bottom: 10px;
  }
  .back-link {
    grid-row: 2;
  }
  .zero-provider {
    grid-row: 2;
  }
  .control-deck {
    grid-template-columns: 1fr 1fr;
  }
  .timeline-control {
    grid-column: 1 / -1;
  }
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .side-stack, .utterance-strip {
    grid-template-columns: 1fr;
  }
  .particle-canvas {
    height: 430px;
    min-height: 0;
  }
  .analysis-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .graph-panel .panel-heading {
    align-items: flex-start;
    gap: 8px;
    flex-direction: column;
  }
  .graph-panel select {
    width: 100%;
    max-width: none;
  }
  footer {
    flex-direction: column;
  }
}

@media (max-width: 420px) {
  .control-deck {
    grid-template-columns: 1fr;
  }
  .timeline-control {
    grid-column: auto;
  }
  .metric-grid article {
    min-width: 0;
  }
  .metric-grid strong {
    font-size: 18px;
  }
  .particle-canvas {
    height: 390px;
  }
  .branch-chart, .exposure-graph {
    height: 300px;
  }
}
</style>
