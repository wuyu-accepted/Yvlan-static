<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useRoute } from 'vue-router'
import ArenaAuditPanel from '../components/campus-pulse/governance-v2/ArenaAuditPanel.vue'
import ArenaCascadeGraph from '../components/campus-pulse/governance-v2/ArenaCascadeGraph.vue'
import ArenaGamePanel from '../components/campus-pulse/governance-v2/ArenaGamePanel.vue'
import ArenaParticleField from '../components/campus-pulse/governance-v2/ArenaParticleField.vue'
import ArenaPolicyChart from '../components/campus-pulse/governance-v2/ArenaPolicyChart.vue'
import ArenaTruthObservation from '../components/campus-pulse/governance-v2/ArenaTruthObservation.vue'
import { loadGovernanceArenaV2 } from '../services/governanceArenaV2Loader'

const route = useRoute()
const loaded = ref(null)
const loadError = ref('')
const loading = ref(true)
const scenarioId = ref('')
const schemeId = ref('D')
const tick = ref(3)
const metricKey = ref('concern')
const playing = ref(false)
let playTimer
let loadGeneration = 0

const phaseLabels = {
  baseline: '共享基线',
  burst: '冲击爆发',
  spread: '网络扩散',
  decay: '干预消退',
}

const knownScenarioLabels = {
  lecture_external_incident_shock: '外部不确定事件',
  governance_legitimacy_dispute: '治理正当性争议',
}

const schemeLabels = {
  natural: 'Natural · 自然反事实',
  A: 'A · 快速透明',
  B: 'B · 参与服务',
  C: 'C · 定向桥接',
  D: 'D · 自适应组合',
}

const metricOptions = [
  { key: 'concern', label: '群体关切' },
  { key: 'trust', label: '治理信任' },
  { key: 'rumor_belief', label: '错误信息' },
  { key: 'voice_gap', label: '参与缺口' },
  { key: 'service_strain', label: '服务压力' },
]

const domain = computed(() => loaded.value?.domain || null)
const scenarioIds = computed(() => Object.keys(domain.value?.scenarios || {}))
const scenario = computed(() => domain.value?.scenarios?.[scenarioId.value] || null)
const branch = computed(() => scenario.value?.branches?.[schemeId.value] || null)
const currentPoint = computed(() => branch.value?.timeline?.[tick.value] || null)
const isProbeTick = computed(() => (
  domain.value?.timeline_contract?.probe_ticks?.includes(tick.value) || false
))
const isDecisionTick = computed(() => (
  domain.value?.timeline_contract?.decision_ticks?.includes(tick.value) || false
))
const latestRound = computed(() => (
  [...(branch.value?.game_rounds || [])]
    .reverse()
    .find((round) => round.tick <= tick.value) || null
))
const resourceNow = computed(() => (
  latestRound.value?.resource_after || branch.value?.resource || null
))

function percent(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`
}

function integer(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function scenarioLabel(id) {
  return domain.value?.scenarios?.[id]?.label || knownScenarioLabels[id] || id
}

function normalizeRunId(value) {
  if (Array.isArray(value)) value = value[0]
  if (!value) return ''
  const normalized = String(value)
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(normalized)) {
    throw new Error('run_id 格式非法，已拒绝加载')
  }
  return normalized
}

async function load() {
  const generation = ++loadGeneration
  loading.value = true
  loadError.value = ''
  playing.value = false
  clearInterval(playTimer)
  try {
    const runId = normalizeRunId(route.query.run_id)
    const next = await loadGovernanceArenaV2(runId)
    if (generation !== loadGeneration) return
    loaded.value = next
    const ids = Object.keys(next.domain.scenarios)
    if (!ids.includes(scenarioId.value)) scenarioId.value = ids[0]
    if (!next.domain.scheme_ids.includes(schemeId.value)) {
      schemeId.value = 'D'
    }
    tick.value = 3
  } catch (error) {
    if (generation !== loadGeneration) return
    loaded.value = null
    loadError.value = error instanceof Error
      ? error.message
      : 'Governance Arena v2 加载失败'
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}

function togglePlayback() {
  playing.value = !playing.value
  clearInterval(playTimer)
  if (!playing.value) return
  playTimer = setInterval(() => {
    tick.value = tick.value >= 23 ? 0 : tick.value + 1
  }, 900)
}

watch(
  () => route.query.run_id,
  load,
)

onMounted(() => {
  document.documentElement.classList.add('governance-v2-root')
  document.body.classList.add('governance-v2-active')
  document.title = 'CampusPulse · Governance Arena v2'
  load()
})

onBeforeUnmount(() => {
  loadGeneration += 1
  clearInterval(playTimer)
  document.documentElement.classList.remove('governance-v2-root')
  document.body.classList.remove('governance-v2-active')
})
</script>

<template>
  <main class="v2-shell">
    <header class="topbar">
      <router-link to="/campus-pulse">← CampusPulse</router-link>
      <div>
        <span>CAMPUSPULSE / GOVERNANCE ARENA v2</span>
        <h1>千体混合驱动治理竞技场</h1>
        <p>真实状态粒子 · 显式消息级联 · 预算化语义观测 · 有限信息动态博弈</p>
      </div>
      <strong :class="{ api: loaded?.source.mode === 'api' }">
        <i />
        {{ loaded?.source.label || 'VERIFYING RELEASE' }}
      </strong>
    </header>

    <section v-if="loading" class="loading-state">
      <i />
      <strong>正在校验 result → manifest → binary 哈希链</strong>
      <span>数据未通过完整校验前不会渲染任何模拟内容。</span>
    </section>

    <section v-else-if="loadError" class="error-state">
      <span>FAIL-CLOSED</span>
      <h2>Governance Arena v2 已停止渲染</h2>
      <p>{{ loadError }}</p>
      <button type="button" @click="load">重新校验</button>
    </section>

    <template v-else-if="loaded && domain && scenario && branch && currentPoint">
      <section class="claim-strip">
        <span>1,000 个审阅论坛 episode，不是真实学生</span>
        <span>10,000 个状态粒子，不计独立证据</span>
        <span>暴露图与传播完全合成</span>
        <span>模型条件差异，不作因果结论</span>
      </section>

      <section class="control-deck">
        <label>
          <span>压力场景</span>
          <select v-model="scenarioId">
            <option
              v-for="id in scenarioIds"
              :key="id"
              :value="id"
            >
              {{ scenarioLabel(id) }}
            </option>
          </select>
        </label>

        <div class="branch-switch" aria-label="选择政策分支">
          <button
            v-for="id in domain.scheme_ids"
            :key="id"
            type="button"
            :class="{ active: schemeId === id }"
            @click="schemeId = id"
          >
            {{ schemeLabels[id] }}
          </button>
        </div>

        <button class="play" type="button" @click="togglePlayback">
          {{ playing ? 'Ⅱ 暂停' : '▶ 播放' }}
        </button>

        <label class="timeline-control">
          <span>
            T{{ String(tick).padStart(2, '0') }}
            · {{ phaseLabels[currentPoint.phase] }}
            <b v-if="isProbeTick">PPS 32</b>
            <b v-if="isDecisionTick" class="decision">GAME</b>
          </span>
          <input v-model.number="tick" type="range" min="0" max="23" step="1">
        </label>
      </section>

      <section class="kpi-rail">
        <article>
          <span>父 episode</span>
          <strong>{{ integer(domain.population_identity.population_size) }}</strong>
          <small>设计权重人口</small>
        </article>
        <article>
          <span>真实状态粒子</span>
          <strong>{{ integer(domain.population_identity.particle_count) }}</strong>
          <small>10 / 父 episode</small>
        </article>
        <article>
          <span>当前关切 / 信任</span>
          <strong>
            {{ percent(currentPoint.truth.concern) }}
            <i>/</i>
            {{ percent(currentPoint.truth.trust) }}
          </strong>
          <small>隐藏总体状态</small>
        </article>
        <article>
          <span>本轮语义探针</span>
          <strong>{{ currentPoint.probe.budget }}</strong>
          <small>Kish ESS {{ currentPoint.probe.kish_ess.toFixed(1) }}</small>
        </article>
        <article>
          <span>平均父内粒子 ESS</span>
          <strong>{{ integer(currentPoint.uncertainty.particle_ess) }}</strong>
          <small>/ 10 · 重采样 {{ currentPoint.uncertainty.resampling_count }}</small>
        </article>
        <article>
          <span>可用 / 已承诺资源</span>
          <strong>
            {{ resourceNow?.remaining ?? 0 }}
            <i>/</i>
            {{ resourceNow?.committed ?? 0 }}
          </strong>
          <small>opening = consumed + committed + remaining</small>
        </article>
        <article>
          <span>普通模型更新</span>
          <strong>{{ integer(domain.usage.low_cost_particle_updates) }}</strong>
          <small>17.28M 预算目标</small>
        </article>
        <article class="zero">
          <span>Provider / 真实动作</span>
          <strong>
            {{ domain.usage.provider_calls }}
            <i>/</i>
            {{ domain.usage.real_governance_actions }}
          </strong>
          <small>ZERO PROVIDER · ZERO REAL ACTIONS</small>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel particle">
          <ArenaParticleField
            :frame-reader="loaded.frameReader"
            :scenario-id="scenarioId"
            :scheme-id="schemeId"
            :tick="tick"
            :point="currentPoint"
          />
        </article>

        <article class="panel cascade">
          <ArenaCascadeGraph :point="currentPoint" />
        </article>

        <article class="panel truth">
          <ArenaTruthObservation :point="currentPoint" />
        </article>

        <article class="panel game">
          <ArenaGamePanel
            :branch="branch"
            :scheme-id="schemeId"
            :tick="tick"
            :temperature="domain.game_contract?.qre_temperature ?? 0.2"
          />
        </article>

        <article class="panel policies">
          <div class="metric-tabs">
            <button
              v-for="metric in metricOptions"
              :key="metric.key"
              type="button"
              :class="{ active: metricKey === metric.key }"
              @click="metricKey = metric.key"
            >
              {{ metric.label }}
            </button>
          </div>
          <ArenaPolicyChart
            :scenario="scenario"
            :scheme-ids="domain.scheme_ids"
            :selected-scheme="schemeId"
            :metric-key="metricKey"
            @select-scheme="schemeId = $event"
          />
        </article>

        <article class="panel audit">
          <ArenaAuditPanel
            :domain="domain"
            :aggregate="loaded.aggregate"
            :manifest="loaded.manifest"
            :manifest-sha256="loaded.manifestSha256"
            :source="loaded.source"
          />
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped>
:global(html.governance-v2-root) {
  min-height: 100%;
  overflow-x: hidden;
  background: #050d10;
}

:global(body.governance-v2-active) {
  min-width: 0;
  min-height: 100%;
  margin: 0;
  overflow-x: hidden;
  background: #050d10;
}

:global(body.governance-v2-active .global-theme-toggle) {
  display: none;
}

.v2-shell {
  min-height: 100vh;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 12% 0%, rgba(59, 154, 149, 0.12), transparent 31%),
    radial-gradient(circle at 88% 8%, rgba(109, 78, 154, 0.09), transparent 26%),
    #050d10;
  color: #d9e8e6;
  font-family:
    Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

.topbar {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
  width: min(1540px, calc(100% - 40px));
  margin: 0 auto;
  padding: 26px 0 22px;
  border-bottom: 1px solid rgba(103, 158, 164, 0.15);
}

.topbar > a {
  color: #7e969c;
  font-size: 11px;
  text-decoration: none;
}

.topbar > div > span {
  color: #55dfce;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

h1 {
  margin: 6px 0 3px;
  color: #f4faf9;
  font-size: clamp(25px, 3vw, 38px);
  letter-spacing: -0.04em;
}

.topbar p {
  margin: 0;
  color: #728a90;
  font-size: 11px;
}

.topbar > strong {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 240px;
  padding: 9px 11px;
  border: 1px solid rgba(88, 218, 198, 0.22);
  border-radius: 8px;
  color: #61d9c8;
  font: 700 9px ui-monospace, monospace;
  letter-spacing: 0.06em;
  text-align: right;
}

.topbar > strong.api {
  color: #9bbfff;
  border-color: rgba(142, 185, 255, 0.25);
}

.topbar > strong i {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 10px currentColor;
}

.loading-state,
.error-state {
  display: grid;
  justify-items: center;
  width: min(680px, calc(100% - 40px));
  margin: 90px auto;
  padding: 48px 28px;
  border: 1px solid rgba(99, 162, 166, 0.14);
  border-radius: 16px;
  background: rgba(7, 20, 24, 0.76);
  text-align: center;
}

.loading-state i {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(80, 226, 205, 0.16);
  border-top-color: #50e2cd;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-state strong {
  margin-top: 17px;
  color: #dfefec;
  font-size: 13px;
}

.loading-state span,
.error-state p {
  margin-top: 7px;
  color: #758c92;
  font-size: 11px;
}

.error-state > span {
  color: #ff6e82;
  font: 800 10px ui-monospace, monospace;
  letter-spacing: 0.16em;
}

.error-state h2 {
  margin: 8px 0 0;
  color: #f4e8ea;
}

.error-state button {
  margin-top: 18px;
  padding: 9px 14px;
  border: 1px solid rgba(255, 110, 130, 0.35);
  border-radius: 7px;
  background: transparent;
  color: #ff8c9d;
  cursor: pointer;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.claim-strip,
.control-deck,
.kpi-rail,
.dashboard-grid {
  width: min(1540px, calc(100% - 40px));
  margin-right: auto;
  margin-left: auto;
}

.claim-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid rgba(91, 153, 159, 0.1);
  border-radius: 7px;
  background: rgba(91, 153, 159, 0.1);
}

.claim-strip span {
  padding: 9px 12px;
  background: #071519;
  color: #789096;
  font-size: 9px;
  text-align: center;
}

.control-deck {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 100px;
  gap: 12px;
  align-items: end;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(93, 157, 163, 0.13);
  border-radius: 11px;
  background: rgba(7, 21, 25, 0.82);
}

.control-deck label > span {
  display: block;
  margin-bottom: 6px;
  color: #6d858b;
  font-size: 9px;
}

.control-deck select {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid rgba(97, 156, 161, 0.18);
  border-radius: 7px;
  outline: none;
  background: #09191d;
  color: #d9e7e5;
  font-size: 11px;
}

.branch-switch {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.branch-switch button,
.play,
.metric-tabs button {
  border: 1px solid rgba(101, 155, 161, 0.13);
  border-radius: 7px;
  background: rgba(12, 31, 35, 0.9);
  color: #789095;
  cursor: pointer;
}

.branch-switch button {
  min-height: 37px;
  padding: 7px;
  font-size: 9px;
}

.branch-switch button.active {
  border-color: rgba(86, 225, 207, 0.45);
  background: rgba(45, 111, 105, 0.17);
  color: #dff7f3;
  box-shadow: inset 0 -2px #51ddcb;
}

.play {
  min-height: 37px;
  color: #b4c6c8;
  font-size: 10px;
}

.timeline-control {
  grid-column: 1 / -1;
}

.timeline-control > span {
  display: flex !important;
  align-items: center;
  gap: 8px;
}

.timeline-control b {
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(88, 222, 204, 0.14);
  color: #62dcca;
  font-size: 8px;
}

.timeline-control b.decision {
  background: rgba(189, 157, 244, 0.14);
  color: #c5a7f4;
}

.timeline-control input {
  width: 100%;
  accent-color: #53dbc9;
}

.kpi-rail {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 7px;
  margin-top: 12px;
}

.kpi-rail article {
  min-width: 0;
  padding: 11px;
  border: 1px solid rgba(93, 153, 159, 0.11);
  border-radius: 8px;
  background: rgba(8, 23, 27, 0.76);
}

.kpi-rail span,
.kpi-rail strong,
.kpi-rail small {
  display: block;
}

.kpi-rail span {
  color: #71898f;
  font-size: 8px;
}

.kpi-rail strong {
  overflow: hidden;
  margin: 5px 0;
  color: #e5f0ee;
  font: 800 18px ui-monospace, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-rail strong i {
  color: #4f676d;
  font-style: normal;
}

.kpi-rail small {
  overflow: hidden;
  color: #5e777d;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-rail .zero {
  border-color: rgba(82, 218, 197, 0.23);
}

.kpi-rail .zero strong {
  color: #59dfca;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(400px, 0.82fr);
  gap: 12px;
  padding: 12px 0 38px;
}

.panel {
  min-width: 0;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgba(91, 151, 158, 0.12);
  border-radius: 13px;
  background: rgba(7, 18, 22, 0.86);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.14);
}

.panel.policies,
.panel.audit {
  grid-column: 1 / -1;
}

.metric-tabs {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
  margin-bottom: -28px;
  position: relative;
  z-index: 2;
}

.metric-tabs button {
  padding: 5px 8px;
  font-size: 8px;
}

.metric-tabs button.active {
  border-color: rgba(83, 221, 203, 0.4);
  color: #d9f2ee;
}

@media (max-width: 1120px) {
  .kpi-rail {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .panel.policies,
  .panel.audit {
    grid-column: auto;
  }
}

@media (max-width: 760px) {
  .topbar {
    grid-template-columns: 1fr;
    gap: 10px;
    width: min(100% - 28px, 1540px);
  }

  .topbar > strong {
    justify-self: start;
    max-width: 100%;
  }

  .claim-strip,
  .control-deck,
  .kpi-rail,
  .dashboard-grid {
    width: min(100% - 24px, 1540px);
  }

  .claim-strip {
    grid-template-columns: 1fr 1fr;
  }

  .control-deck {
    grid-template-columns: 1fr;
  }

  .branch-switch {
    grid-template-columns: 1fr 1fr;
  }

  .timeline-control {
    grid-column: auto;
  }

  .kpi-rail {
    grid-template-columns: 1fr 1fr;
  }

  .metric-tabs {
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
}

@media (max-width: 420px) {
  .topbar,
  .claim-strip,
  .control-deck,
  .kpi-rail,
  .dashboard-grid {
    width: calc(100% - 20px);
  }

  .claim-strip {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 14px;
  }

  .kpi-rail strong {
    font-size: 15px;
  }
}
</style>
