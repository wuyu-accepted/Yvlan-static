<script setup>
const props = defineProps({
  domain: {
    type: Object,
    required: true,
  },
  aggregate: {
    type: Object,
    required: true,
  },
  manifest: {
    type: Object,
    required: true,
  },
  manifestSha256: {
    type: String,
    required: true,
  },
  source: {
    type: Object,
    required: true,
  },
})

function integer(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function shortHash(value) {
  return value ? `${value.slice(0, 12)}…${value.slice(-6)}` : '未提供'
}
</script>

<template>
  <section class="audit-panel">
    <header>
      <div>
        <span>RELEASE & CLAIM AUDIT</span>
        <h2>运行证据与非主张</h2>
      </div>
      <b>FAIL-CLOSED VERIFIED</b>
    </header>

    <div class="audit-cards">
      <article>
        <span>Provider 调用</span>
        <strong class="zero">{{ domain.usage.provider_calls }}</strong>
        <small>冻结 fixture 语义传感器</small>
      </article>
      <article>
        <span>真实治理动作</span>
        <strong class="zero">{{ domain.usage.real_governance_actions }}</strong>
        <small>所有政策动作均为合成</small>
      </article>
      <article>
        <span>普通模型粒子更新</span>
        <strong>{{ integer(domain.usage.low_cost_particle_updates) }}</strong>
        <small>向量化状态空间推进</small>
      </article>
      <article>
        <span>冻结语义槽位</span>
        <strong>{{ integer(domain.usage.fixture_probe_slots) }}</strong>
        <small>32 × 16 × 2 × 8</small>
      </article>
      <article>
        <span>正式写回</span>
        <strong>{{ domain.writeback_evaluation?.formal_mode || '未声明' }}</strong>
        <small>由预注册留出门禁选择</small>
      </article>
      <article>
        <span>校准状态</span>
        <strong class="calibration">
          {{ domain.calibration?.status || '未声明' }}
        </strong>
        <small>缺少 paired evidence 时使用 identity</small>
      </article>
    </div>

    <div class="hash-chain">
      <div>
        <span>result-v4</span>
        <code>{{ shortHash(aggregate.result_sha256) }}</code>
      </div>
      <i>→</i>
      <div>
        <span>domain-result-v2</span>
        <code>{{ shortHash(aggregate.visualization_asset.domain_result_sha256) }}</code>
      </div>
      <i>→</i>
      <div>
        <span>manifest-v2</span>
        <code>{{ shortHash(manifestSha256) }}</code>
      </div>
      <i>→</i>
      <div>
        <span>particle binary</span>
        <code>{{ shortHash(manifest.binary_sha256) }}</code>
      </div>
    </div>

    <div class="boundaries">
      <ul>
        <li>1,000 个单位是审阅论坛行为 episode，不是 1,000 名学生。</li>
        <li>10,000 粒子是父 episode 状态假设，不是独立用户或证据主体。</li>
        <li>合成暴露图和消息级联不代表真实社交关系或传播速度。</li>
      </ul>
      <ul>
        <li>粒子、抽样和配对种子不确定性采用不同口径。</li>
        <li>结果是模型条件差异，不构成现实政策因果效果。</li>
        <li>公共资产不含抽样身份、记录级图边、私有消息或正文。</li>
      </ul>
    </div>

    <footer>
      <span>{{ source.label }}</span>
      <span>二进制 {{ (manifest.byte_length / 1048576).toFixed(2) }} MB</span>
      <span>manifest 与二进制均已浏览器端 SHA-256 校验</span>
    </footer>
  </section>
</template>

<style scoped>
.audit-panel {
  min-width: 0;
}

header,
footer,
.hash-chain {
  display: flex;
  align-items: center;
}

header {
  justify-content: space-between;
  gap: 14px;
}

header span {
  color: #70d5a5;
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
  color: #70d5a5;
  font-size: 9px;
  letter-spacing: 0.1em;
}

.audit-cards {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
  margin-top: 18px;
}

.audit-cards article {
  min-width: 0;
  padding: 11px;
  border: 1px solid rgba(98, 156, 143, 0.13);
  border-radius: 8px;
  background: rgba(8, 24, 26, 0.56);
}

.audit-cards span,
.audit-cards small,
.audit-cards strong {
  display: block;
}

.audit-cards span {
  color: #748a8f;
  font-size: 8px;
}

.audit-cards strong {
  overflow: hidden;
  margin: 5px 0;
  color: #dcebe7;
  font: 800 14px ui-monospace, monospace;
  text-overflow: ellipsis;
}

.audit-cards strong.zero {
  color: #69e3c7;
  font-size: 23px;
}

.audit-cards strong.calibration {
  font-size: 8px;
  line-height: 1.5;
  white-space: normal;
}

.audit-cards small {
  color: #5f767b;
  font-size: 8px;
  line-height: 1.4;
}

.hash-chain {
  gap: 8px;
  margin-top: 13px;
  padding: 12px;
  overflow-x: auto;
  border: 1px solid rgba(108, 158, 148, 0.11);
  border-radius: 8px;
  background: #071316;
}

.hash-chain div {
  min-width: 150px;
}

.hash-chain span,
.hash-chain code {
  display: block;
}

.hash-chain span {
  color: #668086;
  font-size: 8px;
}

.hash-chain code {
  margin-top: 3px;
  color: #9ac1b9;
  font-size: 9px;
}

.hash-chain i {
  color: #42635c;
  font-style: normal;
}

.boundaries {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 13px;
  padding: 14px 16px;
  border-left: 2px solid #477b70;
  background: rgba(7, 23, 24, 0.6);
}

.boundaries ul {
  margin: 0;
  padding-left: 16px;
  color: #879c9f;
  font-size: 10px;
  line-height: 1.8;
}

footer {
  flex-wrap: wrap;
  gap: 9px 18px;
  margin-top: 12px;
  color: #6d858a;
  font-size: 9px;
}

@media (max-width: 840px) {
  .audit-cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .audit-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .boundaries {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
