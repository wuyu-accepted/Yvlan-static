<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useRoute } from 'vue-router'
import ArenaCascadeGraph from '../components/campus-pulse/governance-v2/ArenaCascadeGraph.vue'
import ArenaGamePanel from '../components/campus-pulse/governance-v2/ArenaGamePanel.vue'
import ArenaParticleField from '../components/campus-pulse/governance-v2/ArenaParticleField.vue'
import ArenaPolicyChart from '../components/campus-pulse/governance-v2/ArenaPolicyChart.vue'
import ArenaTruthObservation from '../components/campus-pulse/governance-v2/ArenaTruthObservation.vue'
import YuLanActivationPanel from '../components/campus-pulse/yulan-scale/YuLanActivationPanel.vue'
import YuLanAuditPanel from '../components/campus-pulse/yulan-scale/YuLanAuditPanel.vue'
import YuLanEvidencePanel from '../components/campus-pulse/yulan-scale/YuLanEvidencePanel.vue'
import { loadYuLanScale } from '../services/yuLanScaleLoader'

const route = useRoute()
const loaded = ref(null)
const loadError = ref('')
const loading = ref(true)
const scenarioId = ref('')
const schemeId = ref('D')
const tick = ref(2)
const metricKey = ref('concern')
const playing = ref(false)
let playTimer
let loadGeneration = 0

const phaseLabels = {
  baseline: '共享基线',
  burst: '冲击爆发',
  spread: '网络扩散',
  decay: '治理与消退',
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
const release = computed(() => loaded.value?.release || null)
const scenarioIds = computed(() => Object.keys(domain.value?.scenarios || {}))
const scenario = computed(() => domain.value?.scenarios?.[scenarioId.value] || null)
const branch = computed(() => scenario.value?.branches?.[schemeId.value] || null)
const currentPoint = computed(() => branch.value?.timeline?.[tick.value] || null)
const isActivationTick = computed(() => (
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
const hasResidentLlmTurns = computed(() => (
  Number(release.value?.usage.residentLlmTurns || 0) > 0
))
const hasGovernanceLlmTurns = computed(() => (
  Number(release.value?.usage.governanceLlmTurns || 0) > 0
))
const resourceNow = computed(() => {
  if (latestRound.value?.resource_after) return latestRound.value.resource_after
  const opening = Number(branch.value?.resource?.opening || 0)
  return {
    opening,
    consumed: 0,
    committed: 0,
    remaining: opening,
    conserved: true,
  }
})
const activationProjection = computed(() => ({
  anchorTurns: (
    isActivationTick.value
      && !release.value?.legacyDevelopmentAsset
      && hasResidentLlmTurns.value
      ? release.value?.activation.anchorCount || 0
      : 0
  ),
  ppsTurns: (
    isActivationTick.value
      && !release.value?.legacyDevelopmentAsset
      && hasResidentLlmTurns.value
      ? release.value?.activation.ppsCount || 0
      : 0
  ),
}))

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
    const next = await loadYuLanScale(runId)
    if (generation !== loadGeneration) return
    loaded.value = next
    const ids = Object.keys(next.domain.scenarios)
    if (!ids.includes(scenarioId.value)) scenarioId.value = ids[0]
    if (!next.domain.scheme_ids.includes(schemeId.value)) schemeId.value = 'D'
    tick.value = 2
  } catch (error) {
    if (generation !== loadGeneration) return
    loaded.value = null
    loadError.value = error instanceof Error
      ? error.message
      : 'YuLan-Scale 加载失败'
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

watch(() => route.query.run_id, load)

onMounted(() => {
  document.documentElement.classList.add('yulan-scale-root')
  document.body.classList.add('yulan-scale-active')
  document.title = 'CampusPulse · YuLan-Scale 千体 LLM 多智能体'
  load()
})

onBeforeUnmount(() => {
  loadGeneration += 1
  clearInterval(playTimer)
  document.documentElement.classList.remove('yulan-scale-root')
  document.body.classList.remove('yulan-scale-active')
})
</script>

<template>
  <main class="scale-shell">
    <header class="topbar">
      <router-link to="/">← YuLan-OneSim</router-link>
      <div>
        <span>CAMPUSPULSE / YULAN-SCALE v1</span>
        <h1>千体预算化 LLM 多智能体治理模拟</h1>
        <p>
          1,000 个持久 LLM 智能体 · 48 次/轮预算化激活 ·
          LLM 行为代理扩展 · 10,000 SMC 粒子
        </p>
      </div>
      <strong
        v-if="release"
        :class="{ formal: release.publicationEligible }"
      >
        <i />
        {{ release.identityLabel }}
      </strong>
      <strong v-else><i /> VERIFYING RELEASE</strong>
    </header>

    <section v-if="loading" class="loading-state">
      <i />
      <strong>正在校验 result → manifest → binary 哈希链</strong>
      <span>完整校验通过前不渲染任何模拟内容。</span>
    </section>

    <section v-else-if="loadError" class="error-state">
      <span>FAIL-CLOSED</span>
      <h2>YuLan-Scale 已停止渲染</h2>
      <p>{{ loadError }}</p>
      <button type="button" @click="load">重新校验</button>
    </section>

    <template
      v-else-if="loaded && domain && release && scenario && branch && currentPoint"
    >
      <section class="claim-strip">
        <span>统一人口：每个主体都有 LLM 人物、记忆与可调用合同</span>
        <span>预算化激活：16 个纵向锚点 + 32 个轮换 PPS</span>
        <span>行为代理只扩展 LLM 智能体，不建立普通模型人口</span>
        <span>合成机制条件差异，不作真实政策因果结论</span>
      </section>

      <section
        v-if="release.legacyDevelopmentAsset"
        class="compatibility-banner"
      >
        开发兼容模式：当前 v2 fixture 仅用于验证页面和 10,000 粒子渲染，
        不属于 LLM turns，不具备正式发布资格。
      </section>

      <section class="control-deck">
        <label>
          <span>压力场景</span>
          <select v-model="scenarioId">
            <option v-for="id in scenarioIds" :key="id" :value="id">
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
            T{{ String(tick).padStart(2, '0') }} ·
            {{ phaseLabels[currentPoint.phase] }}
            <b v-if="isActivationTick">
              {{ hasResidentLlmTurns ? '16 ANCHORS + 32 PPS' : 'PLAN: 16 ANCHORS + 32 PPS' }}
            </b>
            <b v-if="isDecisionTick" class="decision">
              {{ hasGovernanceLlmTurns ? '3 LLM ACTORS' : '3 EMULATED ACTORS' }}
            </b>
          </span>
          <input v-model.number="tick" type="range" min="0" max="23" step="1">
        </label>
      </section>

      <section class="kpi-rail">
        <article>
          <span>持久 LLM agents</span>
          <strong>{{ integer(domain.population_identity.population_size) }}</strong>
          <small>episode 驱动的合成主体</small>
        </article>
        <article>
          <span>SMC 状态粒子</span>
          <strong>{{ integer(domain.population_identity.particle_count) }}</strong>
          <small>10 / agent</small>
        </article>
        <article>
          <span>纵向锚点 / 轮换 PPS</span>
          <strong>
            {{ release.activation.anchorCount }}
            <i>/</i>
            {{ release.activation.ppsCount }}
          </strong>
          <small>每个语义激活轮</small>
        </article>
        <article>
          <span>居民 / 治理 LLM turns</span>
          <strong>
            {{ integer(release.usage.residentLlmTurns) }}
            <i>/</i>
            {{ integer(release.usage.governanceLlmTurns) }}
          </strong>
          <small>按 provenance 单独计数</small>
        </article>
        <article>
          <span>当前关切 / 信任</span>
          <strong>
            {{ percent(currentPoint.truth.concern) }}
            <i>/</i>
            {{ percent(currentPoint.truth.trust) }}
          </strong>
          <small>模型隐藏状态</small>
        </article>
        <article>
          <span>PPS Kish ESS</span>
          <strong>{{ currentPoint.probe.kish_ess.toFixed(1) }}</strong>
          <small>总体恢复样本，不含锚点</small>
        </article>
        <article>
          <span>可用 / 已承诺资源</span>
          <strong>
            {{ resourceNow?.remaining ?? 0 }}
            <i>/</i>
            {{ resourceNow?.committed ?? 0 }}
          </strong>
          <small>资源账本严格守恒</small>
        </article>
        <article class="zero">
          <span>Provider / 真实治理动作</span>
          <strong>
            {{ release.usage.providerCalls }}
            <i>/</i>
            {{ release.usage.realGovernanceActions }}
          </strong>
          <small>{{ release.executionProvenance }}</small>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel activation">
          <YuLanActivationPanel
            :release="release"
            :point="currentPoint"
            :is-activation-tick="isActivationTick"
          />
        </article>

        <article class="panel evidence">
          <YuLanEvidencePanel
            :domain="domain"
            :release="release"
            :scenario-id="scenarioId"
            :scheme-id="schemeId"
            :tick="tick"
          />
        </article>

        <article class="panel particle">
          <ArenaParticleField
            :frame-reader="loaded.frameReader"
            :scenario-id="scenarioId"
            :scheme-id="schemeId"
            :tick="tick"
            :point="currentPoint"
            :activation-summary="activationProjection"
          />
        </article>

        <article class="panel cascade">
          <ArenaCascadeGraph :point="currentPoint" />
          <p class="source-legend">
            消息 provenance：
            <b>真实 LLM / 审阅 trace</b> 可展示审阅文本；
            <b>emulator</b> 只产生结构化 emission，不伪装成真实发言。
          </p>
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
            :llm-led="hasGovernanceLlmTurns"
            :provenance-label="release.executionProvenance"
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
          <YuLanAuditPanel
            :domain="domain"
            :aggregate="loaded.aggregate"
            :manifest="loaded.manifest"
            :manifest-sha256="loaded.manifestSha256"
            :source="loaded.source"
            :release="release"
          />
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped src="../styles/yulan-scale.css"></style>
