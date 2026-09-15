<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { verifyForumTwinResultFileHash } from '../../services/forumTwin.ts'
import { currentLocale } from '../i18n/locale.ts'

const SUMMARY_FILE = 'resource-v5-formal-summary-v1.json'
const SUMMARY_HASH_FILE = 'resource-v5-formal-summary-v1.sha256'

const summary = ref<Record<string, any> | null>(null)
const error = ref('')
const isEnglish = computed(() => currentLocale.value === 'en-US')
const localize = (zh: string, en: string) => (isEnglish.value ? en : zh)

function assetUrl(file: string) {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/campus-pulse-data/${file}`
}

async function fetchText(file: string) {
  const response = await fetch(assetUrl(file), { cache: 'no-store' })
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
  return response.text()
}

function validate(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('summary root is invalid')
  const result = value as Record<string, any>
  if (result.schema_version !== 'campus-pulse-four-dimension-formal-public-summary-v1') throw new Error('summary schema mismatch')
  if (result.execution?.primary_slots !== 366 || result.execution?.unresolved_unknown_outcomes !== 0) throw new Error('execution audit mismatch')
  if (result.model?.dynamics_language_messages !== 0) throw new Error('language provenance mismatch')
  if (!result.branches?.Natural || !result.branches?.D || !result.four_dimensions) throw new Error('paired evidence is incomplete')
  return result
}

async function load() {
  error.value = ''
  try {
    const [rawSummary, expectedSummary] = await Promise.all([
      fetchText(SUMMARY_FILE),
      fetchText(SUMMARY_HASH_FILE),
    ])
    await verifyForumTwinResultFileHash(rawSummary, expectedSummary.trim().split(/\s+/)[0])
    summary.value = validate(JSON.parse(rawSummary))
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}

const dimensionRows = computed(() => {
  const dimensions = summary.value?.four_dimensions || {}
  return [
    ['forum_ecology', localize('论坛生态', 'Forum ecology'), localize('48 条成熟线程 · 误差 0.008', '48 mature threads · error 0.008')],
    ['persona_and_one_step_state', localize('人物真实性', 'Persona fidelity'), localize('Profile 41.7% · 上下文 95.8%', 'Profile 41.7% · context 95.8%')],
    ['population_heterogeneity', localize('人群异质性', 'Population heterogeneity'), localize('群体差异 0.226 · 熵 0.887', 'Group gap 0.226 · entropy 0.887')],
    ['network_and_governance_response', localize('治理响应', 'Governance response'), localize('严格承接 50% · 服务积压归零', 'Direct uptake 50% · backlog cleared')],
  ].map(([key, label, detail]) => ({ key, label, detail, status: String(dimensions[key]?.status || 'pending') }))
})

const statusText = (status: string) => ({
  pass: localize('通过', 'Passed'),
  pending: localize('待独立评审', 'Independent review pending'),
  needs_iteration: localize('需要迭代', 'Needs iteration'),
}[status] || status)

onMounted(load)
</script>

<template>
  <section class="formal-v5" aria-labelledby="formal-v5-title">
    <header>
      <div>
        <p>FORMALTWIN V5 · PAIRED LLM RUN</p>
        <h2 id="formal-v5-title">{{ localize('服务闭环了，为什么信任仍在下降？', 'The service loop closed. Why did trust still fall?') }}</h2>
        <span>{{ localize('住宿床位分配争议 · 同一人口与起点 · Natural / D 推进至 Tick 10', 'Housing allocation dispute · shared population and baseline · Natural / D through Tick 10') }}</span>
      </div>
      <dl v-if="summary">
        <div><dt>{{ localize('LLM 槽位', 'LLM slots') }}</dt><dd>{{ summary.execution.primary_slots }}/366</dd></div>
        <div><dt>{{ localize('严格治理承接', 'Direct governance uptake') }}</dt><dd>{{ Math.round(summary.governance_uptake.summary.direct_uptake_rate * 100) }}%</dd></div>
        <div><dt>Unknown</dt><dd>{{ summary.execution.unresolved_unknown_outcomes }}</dd></div>
      </dl>
    </header>

    <div v-if="error" class="formal-v5__error" role="alert">
      <strong>{{ localize('正式结果校验失败', 'Formal result verification failed') }}</strong>
      <span>{{ error }}</span>
      <button type="button" @click="load">{{ localize('重新校验', 'Verify again') }}</button>
    </div>

    <template v-else-if="summary">
      <div class="formal-v5__dimensions" :aria-label="localize('四维证据状态', 'Four-dimensional evidence status')">
        <article v-for="row in dimensionRows" :key="row.key" :class="`status-${row.status}`">
          <span>{{ row.label }}</span><strong>{{ statusText(row.status) }}</strong><small>{{ row.detail }}</small>
        </article>
      </div>
      <footer>
        <strong>{{ localize('治理启发', 'Governance insight') }}</strong>
        <p>{{ localize('工单解决“有没有人管”；排序标准、补材料时限、复核入口与跨群触达，才决定“规则为什么公平”。', 'Tickets answer whether anyone is handling the issue; criteria, deadlines, review access and cross-group reach determine whether the process is seen as fair.') }}</p>
      </footer>
    </template>
    <div v-else class="formal-v5__loading" role="status">{{ localize('正在校验正式实验数据…', 'Verifying formal experiment data…') }}</div>
  </section>
</template>

<style scoped>
.formal-v5{overflow:hidden;border:1px solid #442c33;background:#100b0d;color:#fff8f2;box-shadow:0 24px 64px rgb(38 8 18 / 18%)}
.formal-v5>header{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding:1.5rem 1.75rem;border-bottom:1px solid #442c33;background:radial-gradient(circle at 95% 0,rgb(225 22 78 / 20%),transparent 45%)}
.formal-v5 header p{margin:0 0 .55rem;color:#e4bf69;font:750 .72rem/1 var(--cp-font-mono);letter-spacing:.12em}.formal-v5 h2{margin:0;font-size:clamp(1.45rem,2.5vw,2.35rem);line-height:1.12}.formal-v5 header span{display:block;margin-top:.55rem;color:#baadb0;font-size:.82rem}
.formal-v5 dl{display:flex;margin:0;border:1px solid #442c33;background:rgb(20 13 16 / 80%)}.formal-v5 dl div{min-width:7.7rem;padding:.75rem 1rem;border-right:1px solid #442c33}.formal-v5 dl div:last-child{border-right:0}.formal-v5 dt{color:#baadb0;font-size:.68rem}.formal-v5 dd{margin:.3rem 0 0;font-size:1.15rem;font-weight:800;font-variant-numeric:tabular-nums}
.formal-v5__dimensions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#442c33}.formal-v5__dimensions article{display:grid;gap:.25rem;padding:.8rem 1rem;background:#1b1316}.formal-v5__dimensions span{color:#baadb0;font-size:.68rem}.formal-v5__dimensions strong{font-size:.78rem}.formal-v5__dimensions small{color:#8f8084;font-size:.62rem;line-height:1.35}.status-pass strong{color:#67c68b}.status-pending strong{color:#e4bf69}.status-needs_iteration strong{color:#6ab2e4}
.formal-v5 footer{display:flex;align-items:baseline;gap:1rem;padding:1rem 1.75rem;border-top:1px solid #442c33}.formal-v5 footer strong{flex:0 0 auto;color:#e1164e}.formal-v5 footer p{margin:0;color:#d4c8ca;font-size:.82rem;line-height:1.55}
.formal-v5__error,.formal-v5__loading{display:flex;align-items:center;gap:1rem;padding:1rem 1.75rem;color:#e4bf69}.formal-v5__error span{color:#baadb0;font-size:.75rem}.formal-v5__error button{margin-left:auto;padding:.45rem .8rem;border:1px solid #e4bf69;background:transparent;color:#fff8f2;cursor:pointer}
@media(max-width:900px){.formal-v5>header{align-items:flex-start;flex-direction:column}.formal-v5 dl{width:100%}.formal-v5 dl div{flex:1;min-width:0}.formal-v5__dimensions{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.formal-v5>header{padding:1.1rem}.formal-v5 dl{display:grid;grid-template-columns:1fr}.formal-v5 dl div{border-right:0;border-bottom:1px solid #442c33}.formal-v5__dimensions{grid-template-columns:1fr}.formal-v5 footer{align-items:flex-start;flex-direction:column}}
</style>
