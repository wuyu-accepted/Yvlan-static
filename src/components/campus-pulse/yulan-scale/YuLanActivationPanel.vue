<script setup>
import { computed } from 'vue'

const props = defineProps({
  release: {
    type: Object,
    required: true,
  },
  point: {
    type: Object,
    required: true,
  },
  isActivationTick: {
    type: Boolean,
    required: true,
  },
})

const developmentOnly = computed(() => (
  props.release.executionProvenance === 'emulator_only_development'
))

const actual = computed(() => {
  const turn = props.point.llm_activation || props.point.activation || {}
  if (props.release.legacyDevelopmentAsset) {
    return {
      anchors: 0,
      pps: 0,
      fixture: props.isActivationTick ? props.point.probe.budget : 0,
    }
  }
  return {
    anchors: props.isActivationTick && !developmentOnly.value
      ? Number(turn.anchor_turns ?? props.release.activation.anchorCount)
      : 0,
    pps: props.isActivationTick && !developmentOnly.value
      ? Number(turn.pps_turns ?? props.release.activation.ppsCount)
      : 0,
    fixture: Number(turn.fixture_slots ?? 0),
  }
})

const stages = computed(() => [
  {
    key: 'population',
    label: '持久 LLM 人口',
    value: '1,000',
    detail: '人物 · 记忆 · 可调用合同',
  },
  {
    key: 'anchors',
    label: '纵向锚点',
    value: props.release.legacyDevelopmentAsset
      ? `0 / ${props.release.activation.anchorCount}`
      : `${actual.value.anchors} / ${props.release.activation.anchorCount}`,
    detail: props.release.legacyDevelopmentAsset
      ? '当前兼容资产未执行'
      : '跨时点保持人物轨迹',
  },
  {
    key: 'pps',
    label: '轮换 PPS',
    value: props.release.legacyDevelopmentAsset
      ? `0 / ${props.release.activation.ppsCount}`
      : `${actual.value.pps} / ${props.release.activation.ppsCount}`,
    detail: props.release.legacyDevelopmentAsset
      ? `${actual.value.fixture} 个 fixture 测试槽位`
      : '总体恢复与不确定性',
  },
  {
    key: 'emulator',
    label: 'LLM 行为代理',
    value: '1,000',
    detail: '未激活时预算化推进',
  },
  {
    key: 'particles',
    label: 'SMC 状态层',
    value: '10,000',
    detail: '每个智能体 10 个假设',
  },
])
</script>

<template>
  <section class="activation-panel">
    <header>
      <div>
        <span>ONE LLM-AGENT POPULATION</span>
        <h2>统一千体预算化激活链</h2>
      </div>
      <b :class="{ formal: release.publicationEligible }">
        {{ release.identityLabel }}
      </b>
    </header>

    <div class="pipeline">
      <template v-for="(stage, index) in stages" :key="stage.key">
        <article :class="stage.key">
          <span>{{ stage.label }}</span>
          <strong>{{ stage.value }}</strong>
          <small>{{ stage.detail }}</small>
        </article>
        <i v-if="index < stages.length - 1" aria-hidden="true">→</i>
      </template>
    </div>

    <div class="provenance">
      <article>
        <span>居民 LLM turns</span>
        <strong>{{ release.usage.residentLlmTurns.toLocaleString('zh-CN') }}</strong>
      </article>
      <article>
        <span>治理 LLM turns</span>
        <strong>{{ release.usage.governanceLlmTurns.toLocaleString('zh-CN') }}</strong>
      </article>
      <article>
        <span>审阅 trace replay</span>
        <strong>{{ release.usage.traceReplayTurns.toLocaleString('zh-CN') }}</strong>
      </article>
      <article>
        <span>实时 Provider</span>
        <strong>{{ release.usage.providerCalls.toLocaleString('zh-CN') }}</strong>
      </article>
      <article>
        <span>代理模型更新</span>
        <strong>{{ release.usage.emulatorUpdates.toLocaleString('zh-CN') }}</strong>
      </article>
      <article class="fixture">
        <span>测试 fixture</span>
        <strong>{{ release.usage.fixtureSlots.toLocaleString('zh-CN') }}</strong>
      </article>
    </div>

    <p v-if="release.legacyDevelopmentAsset" class="development-warning">
      当前加载的是旧 v2 开发兼容资产：32 个槽位是确定性 fixture，
      不是 LLM 输出；16 个纵向锚点尚未执行。本资产不可用于正式发布。
    </p>
    <p v-else-if="developmentOnly" class="development-warning">
      当前是 emulator-only 零 Provider 开发运行：16 anchors + 32 PPS
      是冻结预算合同，本结果中实际居民与治理 LLM turns 均为 0，
      不具备正式发布资格。
    </p>
    <p v-else class="method-note">
      48 次/轮是同一 1,000-agent 人口的预算化语义激活；
      低成本模型是 LLM 行为代理执行器，不是另一套普通智能体。
    </p>
  </section>
</template>

<style scoped>
.activation-panel { min-width: 0; }
header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
header span { color: #bf9cff; font-size: 10px; font-weight: 800; letter-spacing: .16em; }
h2 { margin: 6px 0 0; color: #f4faf9; font-size: 22px; }
header b { max-width: 320px; padding: 7px 9px; border: 1px solid rgba(255,180,92,.35); border-radius: 6px; color: #ffbf77; font: 700 9px ui-monospace, monospace; text-align: right; }
header b.formal { border-color: rgba(83,229,204,.36); color: #62e2cf; }
.pipeline { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto 1fr; gap: 8px; align-items: stretch; margin-top: 18px; }
.pipeline > i { align-self: center; color: #405c63; font-style: normal; }
.pipeline article { min-width: 0; padding: 12px; border: 1px solid rgba(118,167,176,.13); border-radius: 10px; background: rgba(8,24,29,.72); }
.pipeline article.anchors { border-color: rgba(190,157,255,.25); }
.pipeline article.pps { border-color: rgba(83,226,207,.25); }
.pipeline span,.pipeline small { display: block; color: #789097; font-size: 9px; }
.pipeline strong { display: block; margin: 6px 0; color: #edf8f6; font: 800 18px ui-monospace, monospace; }
.provenance { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 7px; margin-top: 12px; }
.provenance article { padding: 9px 10px; border-left: 2px solid #426e73; background: rgba(7,21,25,.62); }
.provenance article.fixture { border-left-color: #a6775d; }
.provenance span,.provenance strong { display: block; }
.provenance span { color: #72888e; font-size: 8px; }
.provenance strong { margin-top: 4px; color: #dcebe8; font: 800 14px ui-monospace, monospace; }
.method-note,.development-warning { margin: 12px 0 0; padding: 10px 12px; border-left: 2px solid #4cdcc7; background: rgba(50,134,124,.08); color: #86a29f; font-size: 10px; line-height: 1.65; }
.development-warning { border-left-color: #eaa66d; background: rgba(162,96,51,.09); color: #d3aa88; }
@media (max-width: 900px) {
  .pipeline { grid-template-columns: repeat(5,minmax(0,1fr)); }
  .pipeline > i { display: none; }
  .provenance { grid-template-columns: repeat(3,minmax(0,1fr)); }
}
@media (max-width: 560px) {
  header { align-items: flex-start; flex-direction: column; }
  .pipeline { grid-template-columns: 1fr 1fr; }
  .provenance { grid-template-columns: 1fr 1fr; }
}
</style>
