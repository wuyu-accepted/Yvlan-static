<script setup>
const props = defineProps({
  domain: { type: Object, required: true },
  aggregate: { type: Object, required: true },
  manifest: { type: Object, required: true },
  manifestSha256: { type: String, required: true },
  source: { type: Object, required: true },
  release: { type: Object, required: true },
})

function shortHash(value) {
  return value ? `${value.slice(0, 12)}…${value.slice(-6)}` : '未提供'
}
</script>

<template>
  <section class="audit">
    <header>
      <div>
        <span>PROVENANCE & CLAIM BOUNDARY</span>
        <h2>LLM 身份、发布资格与非主张</h2>
      </div>
      <b :class="{ blocked: !release.publicationEligible }">
        {{ release.publicationEligible ? 'PUBLICATION ELIGIBLE' : 'DEVELOPMENT ONLY' }}
      </b>
    </header>

    <div class="status-grid">
      <article>
        <span>执行 provenance</span>
        <strong>{{ release.executionProvenance }}</strong>
      </article>
      <article>
        <span>居民 / 治理 LLM turns</span>
        <strong>
          {{ release.usage.residentLlmTurns }} /
          {{ release.usage.governanceLlmTurns }}
        </strong>
      </article>
      <article>
        <span>Provider calls / tokens</span>
        <strong>
          {{ release.usage.providerCalls }} /
          {{ release.usage.providerTokens }}
        </strong>
      </article>
      <article>
        <span>真实治理动作</span>
        <strong>{{ release.usage.realGovernanceActions }}</strong>
      </article>
    </div>

    <div class="hash-chain">
      <code>{{ aggregate.schema_version }} · {{ shortHash(aggregate.result_sha256) }}</code>
      <i>→</i>
      <code>{{ domain.schema_version }} · {{ shortHash(aggregate.visualization_asset.domain_result_sha256) }}</code>
      <i>→</i>
      <code>{{ manifest.schema_version }} · {{ shortHash(manifestSha256) }}</code>
      <i>→</i>
      <code>particle binary · {{ shortHash(manifest.binary_sha256) }}</code>
    </div>

    <div class="boundaries">
      <ul>
        <li>1,000 个单位是 episode 驱动的合成 LLM 智能体，不是 1,000 名真实学生。</li>
        <li>每个主体具备人物、记忆、决策合同和可调用能力，不表示每 tick 调用 1,000 次 Provider。</li>
        <li>10,000 粒子是状态不确定性样本，不是用户、智能体或独立证据。</li>
        <li>旧 48-agent 轨迹是有限 LLM 人口证据，不与新 episode ID 伪造映射。</li>
      </ul>
      <ul>
        <li>代理模型结果、LLM 语义结果和真实人类意见分开标注。</li>
        <li>暴露图、传播速度、治理主体和政策差异均为模型条件下的合成机制。</li>
        <li>粒子、PPS 与配对种子区间口径不同，不可相互替代。</li>
        <li>结果不构成现实政策因果效果、治理建议或全校学生民意。</li>
      </ul>
    </div>

    <p v-if="release.legacyDevelopmentAsset" class="blocked-note">
      当前兼容资产包含 fixture 测试槽位；fixture 永远不能升级为 LLM trace，
      不能下载正式报告，也不能生成 CampusPulse-YuLan-Scale-v1 发布包。
    </p>
    <footer>
      <span>{{ source.label }}</span>
      <span>manifest 与二进制均经浏览器端 SHA-256 校验</span>
      <span>公共资产不含微观身份、记录级图边、私有观察或未审阅文本</span>
    </footer>
  </section>
</template>

<style scoped>
.audit { min-width: 0; }
header,footer,.hash-chain { display:flex; align-items:center; }
header { justify-content:space-between; gap:14px; }
header span { color:#70d5a5; font-size:10px; font-weight:800; letter-spacing:.16em; }
h2 { margin:6px 0 0; color:#f4faf9; font-size:22px; }
header b { padding:7px 9px; border:1px solid rgba(89,226,199,.35); border-radius:6px; color:#67dfc8; font-size:9px; letter-spacing:.08em; }
header b.blocked { border-color:rgba(255,170,105,.4); color:#ffb577; }
.status-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; margin-top:18px; }
.status-grid article { min-width:0; padding:11px; border:1px solid rgba(98,156,143,.13); border-radius:8px; background:rgba(8,24,26,.56); }
.status-grid span,.status-grid strong { display:block; }
.status-grid span { color:#748a8f; font-size:8px; }
.status-grid strong { overflow:hidden; margin-top:5px; color:#dcebe7; font:800 11px/1.5 ui-monospace,monospace; text-overflow:ellipsis; }
.hash-chain { gap:8px; margin-top:13px; padding:12px; overflow-x:auto; border:1px solid rgba(108,158,148,.11); border-radius:8px; background:#071316; }
.hash-chain code { min-width:max-content; color:#9ac1b9; font-size:9px; }
.hash-chain i { color:#42635c; font-style:normal; }
.boundaries { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:13px; padding:14px 16px; border-left:2px solid #477b70; background:rgba(7,23,24,.6); }
.boundaries ul { margin:0; padding-left:16px; color:#879c9f; font-size:10px; line-height:1.8; }
.blocked-note { margin:12px 0 0; padding:10px 12px; border-left:2px solid #eaa66d; background:rgba(162,96,51,.09); color:#d3aa88; font-size:10px; line-height:1.65; }
footer { flex-wrap:wrap; gap:9px 18px; margin-top:12px; color:#6d858a; font-size:9px; }
@media (max-width:700px) {
  .status-grid { grid-template-columns:1fr 1fr; }
  .boundaries { grid-template-columns:1fr; gap:0; }
}
</style>
