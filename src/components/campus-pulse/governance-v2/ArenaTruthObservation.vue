<script setup>
import { computed } from 'vue'

const props = defineProps({
  point: {
    type: Object,
    required: true,
  },
})

const metricLabels = {
  concern: '群体关切',
  trust: '治理信任',
  voice_gap: '参与缺口',
  rumor_belief: '错误信息信念',
  service_strain: '服务压力',
}

const actorLabels = {
  governance_authority: '治理责任主体',
  service_operator: '服务承接主体',
  community_bridge: '社区桥接主体',
}

const rows = computed(() => Object.entries(metricLabels).map(([key, label]) => {
  const truth = props.point.truth[key]
  const observed = props.point.observed[key]
  return {
    key,
    label,
    truth,
    observed,
    gap: observed.mean - truth,
  }
}))

const actorObservations = computed(() => (
  props.point.actor_observations || {}
))

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}
</script>

<template>
  <section class="truth-observation">
    <header>
      <div>
        <span>HIDDEN STATE vs GOVERNANCE VIEW</span>
        <h2>模拟真值与有限观测</h2>
      </div>
      <b>观测不是全知视角</b>
    </header>

    <div class="comparison-head">
      <span>指标</span>
      <span>模型隐藏状态</span>
      <span>治理可见 posterior</span>
      <span>观测差</span>
    </div>
    <div class="comparison-rows">
      <div v-for="row in rows" :key="row.key" class="metric-row">
        <strong>{{ row.label }}</strong>
        <div class="bar truth">
          <i :style="{ width: percent(row.truth) }" />
          <b>{{ percent(row.truth) }}</b>
        </div>
        <div class="bar observed">
          <i :style="{ width: percent(row.observed.mean) }" />
          <b>
            {{ percent(row.observed.mean) }}
            <small>
              {{ percent(row.observed.lower) }}–{{ percent(row.observed.upper) }}
            </small>
          </b>
        </div>
        <em :class="{ positive: row.gap > 0, negative: row.gap < 0 }">
          {{ row.gap > 0 ? '+' : '' }}{{ percent(row.gap) }}
        </em>
      </div>
    </div>

    <div class="observer-grid">
      <article
        v-for="(observation, actor) in actorObservations"
        :key="actor"
      >
        <span>{{ actorLabels[actor] || actor }}</span>
        <strong>{{ observation.signal_label || '有限公开信号' }}</strong>
        <small>
          延迟 {{ observation.delay_ticks ?? 0 }} tick ·
          覆盖 {{ percent(observation.coverage ?? 0) }}
        </small>
      </article>
    </div>

    <footer>
      <span>平均父内粒子 ESS {{ point.uncertainty.particle_ess.toFixed(1) }} / 10</span>
      <span>累计父内重采样 {{ point.uncertainty.resampling_count }}</span>
      <span>本轮 PPS Kish ESS {{ point.probe.kish_ess.toFixed(1) }} / 32</span>
    </footer>
  </section>
</template>

<style scoped>
.truth-observation {
  min-width: 0;
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

header span {
  color: #ffca7a;
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
  padding: 7px 9px;
  border: 1px solid rgba(255, 202, 122, 0.3);
  border-radius: 6px;
  color: #ffca7a;
  font-size: 9px;
}

.comparison-head,
.metric-row {
  display: grid;
  grid-template-columns: 0.75fr 1fr 1.3fr 64px;
  gap: 10px;
  align-items: center;
}

.comparison-head {
  margin-top: 18px;
  padding: 0 10px 7px;
  color: #6f878e;
  font-size: 9px;
  letter-spacing: 0.05em;
}

.comparison-rows {
  overflow: hidden;
  border: 1px solid rgba(120, 174, 181, 0.12);
  border-radius: 10px;
}

.metric-row {
  min-height: 58px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(120, 174, 181, 0.08);
}

.metric-row:last-child {
  border-bottom: 0;
}

.metric-row > strong {
  color: #cfe0de;
  font-size: 11px;
}

.bar {
  position: relative;
  height: 28px;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
}

.bar i {
  position: absolute;
  inset: 0 auto 0 0;
  opacity: 0.18;
}

.bar.truth i {
  background: #718b96;
}

.bar.observed i {
  background: #ffca7a;
}

.bar b {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 8px;
  color: #edf7f5;
  font: 700 11px ui-monospace, monospace;
}

.bar small {
  margin-left: auto;
  color: #8da1a6;
  font-size: 8px;
}

.metric-row em {
  color: #93a6aa;
  font: 700 10px ui-monospace, monospace;
  text-align: right;
}

.metric-row em.positive { color: #ff947c; }
.metric-row em.negative { color: #61d9c9; }

.observer-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.observer-grid article {
  padding: 11px;
  border-left: 2px solid #37636b;
  background: rgba(8, 24, 29, 0.64);
}

.observer-grid span,
.observer-grid small {
  display: block;
  color: #789097;
  font-size: 9px;
}

.observer-grid strong {
  display: block;
  margin: 5px 0;
  color: #dcebe8;
  font-size: 11px;
}

footer {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 13px;
  color: #89a0a5;
  font-size: 10px;
}

@media (max-width: 560px) {
  .comparison-head {
    display: none;
  }

  .comparison-rows {
    margin-top: 16px;
  }

  .metric-row {
    grid-template-columns: 76px minmax(0, 1fr) 52px;
  }

  .metric-row .bar.truth {
    display: none;
  }

  .observer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
