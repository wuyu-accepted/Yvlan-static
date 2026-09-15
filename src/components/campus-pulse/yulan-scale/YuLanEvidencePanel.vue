<script setup>
import { computed } from 'vue'

const props = defineProps({
  domain: { type: Object, required: true },
  release: { type: Object, required: true },
  scenarioId: { type: String, required: true },
  schemeId: { type: String, required: true },
  tick: { type: Number, required: true },
})

function branch(section) {
  return (
    section?.[props.scenarioId]?.branches?.[props.schemeId]
    || section?.scenarios?.[props.scenarioId]?.branches?.[props.schemeId]
    || {}
  )
}

function atTick(section) {
  const current = branch(section)
  const timeline = current.timeline || current.ticks || []
  return timeline.find((item) => item?.tick === props.tick) || current
}

function number(value, digits = 3) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—'
}

function percent(value) {
  return Number.isFinite(value) ? `${(Number(value) * 100).toFixed(1)}%` : '—'
}

const anchor = computed(() => branch(props.domain.anchor_trajectories))
const residual = computed(() => atTick(props.domain.emulator_residuals))
const speakers = computed(() => atTick(props.domain.speaker_opinion))
const differences = computed(() => branch(props.domain.branch_differences))

const cards = computed(() => [
  {
    label: '纵向轨迹覆盖',
    value: (
      props.release.legacyDevelopmentAsset
      || props.release.usage.residentLlmTurns === 0
    )
      ? '未执行'
      : (
          anchor.value.trajectory_count
          ?? anchor.value.anchor_count
          ?? props.release.activation.anchorCount
        ),
    detail: '匿名聚合，不公开锚点身份',
  },
  {
    label: '公开发言者 support',
    value: percent(
      speakers.value.conditional_support
      ?? speakers.value.support,
    ),
    detail: '条件意见，不等于全体状态',
  },
  {
    label: 'LLM—代理 action MAE',
    value: number(residual.value.action_mae),
    detail: '只在真实 LLM/trace 激活轮估计',
  },
  {
    label: 'LLM—代理 stance MAE',
    value: number(residual.value.stance_mae),
    detail: '代理漂移审计',
  },
  {
    label: 'LLM—代理 topic MAE',
    value: number(residual.value.topic_mae),
    detail: '代理漂移审计',
  },
  {
    label: '配对分支差异',
    value: number(
      differences.value.objective_difference
      ?? differences.value.objective_score,
    ),
    detail: '8 个配对种子；模型条件差异',
  },
])
</script>

<template>
  <section class="evidence-panel">
    <header>
      <div>
        <span>LLM EVIDENCE & EMULATOR DRIFT</span>
        <h2>纵向锚点、发言者意见与代理残差</h2>
      </div>
      <b>THREE DISTINCT ESTIMANDS</b>
    </header>
    <div class="cards">
      <article v-for="card in cards" :key="card.label">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <small>{{ card.detail }}</small>
      </article>
    </div>
    <div class="estimands">
      <p><b>全体状态</b>由 10,000 粒子的加权分布导出。</p>
      <p><b>发言者意见</b>只描述模拟公开发言者的条件组成。</p>
      <p><b>治理 posterior</b>只包含当时延迟、有限、可见的观测。</p>
    </div>
    <p
      v-if="release.legacyDevelopmentAsset"
      class="unavailable"
    >
      旧 v2 兼容资产没有真实 LLM 锚点和 LLM—代理残差；空值保持为空，
      不使用 fixture 补造。
    </p>
    <p
      v-else-if="release.usage.residentLlmTurns === 0"
      class="unavailable"
    >
      当前 emulator-only 开发结果没有执行居民 LLM 锚点或 PPS turn；
      纵向轨迹与 LLM—代理残差保持为空，不以代理结果补造。
    </p>
  </section>
</template>

<style scoped>
.evidence-panel { min-width: 0; }
header { display:flex; justify-content:space-between; gap:14px; align-items:center; }
header span { color:#8fc0ff; font-size:10px; font-weight:800; letter-spacing:.16em; }
h2 { margin:6px 0 0; color:#f4faf9; font-size:22px; }
header > b { color:#82979d; font:700 9px ui-monospace,monospace; }
.cards { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:7px; margin-top:18px; }
.cards article { min-width:0; padding:11px; border:1px solid rgba(115,168,179,.12); border-radius:8px; background:rgba(8,24,29,.66); }
.cards span,.cards strong,.cards small { display:block; }
.cards span { color:#748a90; font-size:8px; }
.cards strong { overflow:hidden; margin:6px 0; color:#e7f2f0; font:800 16px ui-monospace,monospace; text-overflow:ellipsis; }
.cards small { color:#61787e; font-size:8px; line-height:1.45; }
.estimands { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:12px; }
.estimands p { margin:0; padding:10px 12px; border-left:2px solid #456f75; color:#82989d; background:rgba(7,22,26,.58); font-size:9px; line-height:1.55; }
.estimands b { color:#c5d8d5; }
.unavailable { margin:12px 0 0; color:#cc9e79; font-size:9px; }
@media (max-width:850px) { .cards { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width:560px) {
  header { align-items:flex-start; flex-direction:column; }
  .cards { grid-template-columns:1fr 1fr; }
  .estimands { grid-template-columns:1fr; }
}
</style>
