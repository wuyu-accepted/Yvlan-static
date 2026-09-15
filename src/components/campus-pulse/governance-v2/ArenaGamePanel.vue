<script setup>
import { computed } from 'vue'

const props = defineProps({
  branch: {
    type: Object,
    required: true,
  },
  schemeId: {
    type: String,
    required: true,
  },
  tick: {
    type: Number,
    required: true,
  },
  temperature: {
    type: Number,
    default: 0.2,
  },
  llmLed: {
    type: Boolean,
    default: false,
  },
  provenanceLabel: {
    type: String,
    default: '',
  },
})

const actorLabels = {
  governance_authority: '治理责任主体',
  service_operator: '服务承接主体',
  community_bridge: '社区桥接主体',
}

const currentRound = computed(() => (
  [...props.branch.game_rounds]
    .reverse()
    .find((round) => round.tick <= props.tick) || null
))

const resource = computed(() => (
  currentRound.value?.resource_after || props.branch.resource
))

function actionLabel(decision) {
  return (
    decision.selected_action_label
    || decision.selected_action
    || decision.selected_strategy
    || '无新增行动'
  )
}

function candidateLabel(candidate) {
  return candidate.action_label || candidate.action_id || candidate.strategy_id
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(0)}%`
}
</script>

<template>
  <section class="game-panel">
    <header>
      <div>
        <span>
          {{ llmLed ? 'LLM ACTORS + CONSTRAINED QRE' : 'DYNAMIC MULTI-ACTOR GAME' }}
        </span>
        <h2>{{ llmLed ? '三主体 LLM 治理协调' : '有限观测治理博弈' }}</h2>
      </div>
      <b>
        {{ llmLed ? 'LLM → QRE' : 'QRE' }} τ={{ temperature.toFixed(2) }}
      </b>
    </header>

    <div v-if="schemeId === 'natural'" class="empty">
      <strong>自然分支不注入治理行动</strong>
      <p>保留完整资源，作为 A/B/C/D 的共同随机数反事实参照。</p>
    </div>
    <div v-else-if="!currentRound" class="empty">
      <strong>共享基线尚未决策</strong>
      <p>T3 首次基于有限观测进行三主体 logit response。</p>
    </div>
    <div v-else class="decisions">
      <article
        v-for="decision in currentRound.decisions"
        :key="decision.actor"
      >
        <div class="decision-head">
          <span>{{ actorLabels[decision.actor] || decision.actor }}</span>
          <b>延迟 {{ decision.delay_ticks ?? 0 }} tick</b>
        </div>
        <h3>{{ actionLabel(decision) }}</h3>
        <p>{{ decision.reason || '基于该主体可见信号与资源约束选择。' }}</p>
        <div class="probabilities">
          <div
            v-for="candidate in decision.candidate_probabilities"
            :key="candidate.action_id || candidate.strategy_id"
            :class="{
              selected: (
                (candidate.action_id || candidate.strategy_id)
                === (decision.selected_action || decision.selected_strategy)
              ),
            }"
          >
            <span>{{ candidateLabel(candidate) }}</span>
            <i>
              <b :style="{ width: percent(candidate.probability) }" />
            </i>
            <strong>{{ percent(candidate.probability) }}</strong>
          </div>
        </div>
      </article>
    </div>

    <div class="resource-ledger">
      <div>
        <span>初始</span>
        <strong>{{ resource.opening }}</strong>
      </div>
      <i>−</i>
      <div>
        <span>已消耗</span>
        <strong>{{ resource.consumed }}</strong>
      </div>
      <i>−</i>
      <div>
        <span>已承诺</span>
        <strong>{{ resource.committed }}</strong>
      </div>
      <i>=</i>
      <div class="remaining">
        <span>可用</span>
        <strong>{{ resource.remaining }}</strong>
      </div>
    </div>

    <footer>
      <template v-if="llmLed">
        LLM 提出动作分布 · 3 轮阻尼 response · 4 tick 滚动预测 ·
        资源求解器最终约束
      </template>
      <template v-else>
        确定性开发机制 · 3 轮阻尼 logit response · 4 tick 滚动预测
      </template>
      <span v-if="provenanceLabel"> · {{ provenanceLabel }}</span>
      · 不宣称纳什均衡或现实因果最优
    </footer>
  </section>
</template>

<style scoped>
.game-panel {
  min-width: 0;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

header span {
  color: #c3a8ff;
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
  border: 1px solid rgba(195, 168, 255, 0.3);
  border-radius: 6px;
  color: #c3a8ff;
  font: 700 10px ui-monospace, monospace;
}

.empty {
  min-height: 290px;
  margin-top: 18px;
  display: grid;
  place-content: center;
  padding: 32px;
  border: 1px dashed rgba(143, 172, 179, 0.2);
  border-radius: 12px;
  color: #91a6ab;
  text-align: center;
}

.empty strong {
  color: #d8e7e4;
}

.empty p {
  max-width: 360px;
  margin: 8px auto 0;
  font-size: 11px;
  line-height: 1.65;
}

.decisions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 18px;
}

.decisions > article {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(147, 120, 210, 0.15);
  border-radius: 10px;
  background: rgba(19, 16, 32, 0.34);
}

.decision-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: #9b8dba;
  font-size: 9px;
}

.decision-head b {
  color: #70868b;
  font-weight: 500;
}

h3 {
  min-height: 32px;
  margin: 8px 0 0;
  color: #f1eaff;
  font-size: 12px;
}

.decisions p {
  min-height: 44px;
  margin: 5px 0 10px;
  color: #7f9298;
  font-size: 9px;
  line-height: 1.55;
}

.probabilities {
  display: grid;
  gap: 6px;
}

.probabilities > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px 26px;
  gap: 5px;
  align-items: center;
  color: #71868c;
  font-size: 8px;
}

.probabilities > div > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.probabilities i {
  height: 3px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.07);
}

.probabilities i b {
  display: block;
  height: 100%;
  background: #7656bc;
}

.probabilities strong {
  font: 700 8px ui-monospace, monospace;
  text-align: right;
}

.probabilities .selected {
  color: #d8c9ff;
}

.probabilities .selected i b {
  background: #b393fb;
}

.resource-ledger {
  display: flex;
  align-items: stretch;
  gap: 7px;
  margin-top: 13px;
}

.resource-ledger div {
  flex: 1;
  padding: 9px;
  border: 1px solid rgba(102, 143, 151, 0.12);
  border-radius: 7px;
  background: rgba(7, 21, 25, 0.65);
}

.resource-ledger span,
.resource-ledger strong {
  display: block;
}

.resource-ledger span {
  color: #71888e;
  font-size: 8px;
}

.resource-ledger strong {
  margin-top: 3px;
  color: #d8e7e4;
  font: 800 15px ui-monospace, monospace;
}

.resource-ledger > i {
  align-self: center;
  color: #4b6268;
  font-style: normal;
}

.resource-ledger .remaining {
  border-color: rgba(85, 222, 205, 0.24);
}

.resource-ledger .remaining strong {
  color: #55decd;
}

footer {
  margin-top: 11px;
  color: #71888e;
  font-size: 9px;
  text-align: right;
}

@media (max-width: 720px) {
  .decisions {
    grid-template-columns: 1fr;
  }

  .decisions p,
  h3 {
    min-height: 0;
  }

  .resource-ledger {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .resource-ledger > i {
    display: none;
  }
}
</style>
