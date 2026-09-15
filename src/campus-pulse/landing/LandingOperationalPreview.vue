<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { currentLocale } from '../i18n/locale.ts'
import { loadLandingOperationalVM, type LandingOperationalVM } from './landingViewModel.ts'

const loading = ref(true)
const error = ref('')
const model = ref<LandingOperationalVM | null>(null)
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh
const copy = computed(() => isEnglish.value ? {
  incidents: 'Audited incident queue', incidentNote: 'Validated result cases, not live project activity.', audited: 'Audited case', integrity: 'Integrity verified', restricted: 'Publication restricted', agents: 'synthetic agents', open: 'Open result',
  network: 'Synthetic campus network', fixed: 'Fixed synthetic population snapshot', notLive: 'Not live runtime', representatives: 'representative profiles', relationships: 'aggregate directed ties', privacy: 'Aggregate relationships only · no record-level social edges',
  divergence: 'Natural vs Governed', comparison: 'Summer Housing audited comparison', natural: 'Natural', governed: 'Governed D', delta: 'Δ = D − Natural', derived: 'Derived comparison', causal: 'Derived comparison, not a causal estimate.', tick: 'Final published Tick',
  unavailable: 'The validated operational preview is unavailable.', retry: 'Retry',
} : {
  incidents: '审计事件队列', incidentNote: '已校验结果案例，不是实时项目活动。', audited: '审计案例', integrity: '完整性已校验', restricted: '发布受限', agents: '个合成 Agent', open: '打开结果',
  network: '合成校园网络', fixed: '固定合成人口快照', notLive: '非实时运行', representatives: '个代表 Profile', relationships: '条聚合有向关系', privacy: '仅展示聚合关系 · 不公开记录级社交边',
  divergence: 'Natural 与治理分支', comparison: '暑期住宿审计案例对比', natural: 'Natural', governed: '治理 D', delta: 'Δ = D − Natural', derived: '派生对比', causal: '派生对比，不是因果估计。', tick: '最终发布时间步',
  unavailable: '已校验的运营预览暂不可用。', retry: '重试',
})
const clusterById = computed(() => new Map(model.value?.network.clusters.map((cluster) => [cluster.id, cluster]) || []))
const maxEdge = computed(() => Math.max(1, ...(model.value?.network.edges.map((edge) => edge.count) || [1])))
const formatDelta = (value: number) => `${value > 0 ? '+' : ''}${value}`

async function load() {
  loading.value = true
  error.value = ''
  try { model.value = await loadLandingOperationalVM() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="operational-preview" aria-label="CampusPulse operational preview">
    <div v-if="loading" class="preview-state" role="status"><i aria-hidden="true" />{{ l('正在校验公开数据…','Validating public data…') }}</div>
    <div v-else-if="error || !model" class="preview-state preview-state--error" role="alert"><span>{{ copy.unavailable }}</span><button type="button" @click="load">{{ copy.retry }}</button></div>
    <template v-else>
      <section class="preview-panel incident-panel" aria-labelledby="landing-incidents-title">
        <header class="panel-head"><div><span>01</span><h2 id="landing-incidents-title">{{ copy.incidents }}</h2></div><p>{{ copy.incidentNote }}</p></header>
        <ol class="incident-list">
          <li v-for="item in model.incidents" :key="item.id"><RouterLink :to="item.route">
            <span class="classification">{{ copy.audited }}</span><strong>{{ isEnglish ? item.titleEn : item.title }}</strong><small>{{ item.id }} · {{ item.sourceKey }}</small>
            <dl><div><dt>{{ copy.integrity }}</dt><dd><i class="verified" />{{ item.population.toLocaleString() }} {{ copy.agents }}</dd></div><div><dt>{{ copy.restricted }}</dt><dd><i class="restricted" />{{ item.publicationEligible ? l('可发布','Eligible') : l('正式发布门禁未通过','Not eligible') }}</dd></div></dl>
            <em>{{ copy.open }} <i class="fa-solid fa-arrow-right" aria-hidden="true" /></em>
          </RouterLink></li>
        </ol>
      </section>

      <section class="preview-panel network-panel" aria-labelledby="landing-network-title">
        <header class="panel-head"><div><span>02</span><h2 id="landing-network-title">{{ copy.network }}</h2></div><p>{{ copy.fixed }} · {{ copy.notLive }}</p></header>
        <div class="network-stage"><svg viewBox="0 0 440 276" role="img" :aria-label="copy.fixed">
          <g class="aggregate-edges"><line v-for="edge in model.network.edges" :key="edge.id" :x1="clusterById.get(edge.sourceId)?.x" :y1="clusterById.get(edge.sourceId)?.y" :x2="clusterById.get(edge.targetId)?.x" :y2="clusterById.get(edge.targetId)?.y" :stroke-width=".5 + edge.count / maxEdge * 2.5"><title>{{ edge.count }} {{ copy.relationships }}</title></line></g>
          <g v-for="cluster in model.network.clusters" :key="cluster.id" class="agent-cluster"><circle class="cluster-ring" :cx="cluster.x" :cy="cluster.y" :r="7 + Math.min(cluster.count, 12)"/><circle class="cluster-core" :cx="cluster.x" :cy="cluster.y" :r="3.5 + Math.min(cluster.count, 12) / 3"/><title>{{ isEnglish ? cluster.labelEn : cluster.label }} · {{ cluster.count }} {{ copy.representatives }}</title></g>
          <circle class="network-center" cx="220" cy="138" r="35"/><text class="network-count" x="220" y="134">{{ model.network.population.toLocaleString() }}</text><text class="network-label" x="220" y="151">SYNTHETIC AGENTS</text>
        </svg></div>
        <dl class="network-facts"><div><dt>{{ model.network.population.toLocaleString() }}</dt><dd>{{ copy.agents }}</dd></div><div><dt>{{ model.network.representativeProfiles }}</dt><dd>{{ copy.representatives }}</dd></div><div><dt>{{ model.network.aggregateRelationshipCount.toLocaleString() }}</dt><dd>{{ copy.relationships }}</dd></div></dl>
        <p class="boundary"><i class="fa-solid fa-lock" aria-hidden="true" />{{ copy.privacy }} · {{ model.network.worldHash.slice(0, 10) }}</p>
      </section>

      <section class="preview-panel divergence-panel" aria-labelledby="landing-divergence-title">
        <header class="panel-head"><div><span>03</span><h2 id="landing-divergence-title">{{ copy.divergence }}</h2></div><p>{{ copy.comparison }}</p></header>
        <div class="comparison-context"><span>{{ copy.derived }}</span><strong>{{ copy.tick }} {{ model.comparison.tick }}</strong><small>{{ model.comparison.resultKey }} · {{ model.comparison.sourceKey }}</small></div>
        <div class="comparison-table" role="table" :aria-label="copy.comparison">
          <div class="comparison-row comparison-row--head" role="row"><span role="columnheader">{{ copy.delta }}</span><b role="columnheader">{{ copy.natural }}</b><b role="columnheader">{{ copy.governed }}</b><b role="columnheader">Δ</b></div>
          <div v-for="row in model.comparison.rows" :key="row.id" class="comparison-row" role="row"><strong role="rowheader">{{ isEnglish ? row.labelEn : row.label }}</strong><span class="natural" role="cell">{{ row.natural }}</span><span class="governed" role="cell">{{ row.governed }}</span><span role="cell" :class="{ positive:row.delta > 0, negative:row.delta < 0 }">{{ formatDelta(row.delta) }}</span></div>
        </div>
        <p class="boundary"><i class="fa-solid fa-scale-balanced" aria-hidden="true" />{{ copy.causal }}</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.operational-preview{display:grid;grid-template-columns:minmax(15rem,.82fr) minmax(25rem,1.45fr) minmax(17rem,.92fr);gap:var(--cp-space-3);min-width:0}.preview-panel{min-width:0;overflow:hidden;border:1px solid var(--cp-border-graphite);border-radius:var(--cp-radius-md);background:var(--cp-surface-charcoal)}.panel-head{display:grid;gap:var(--cp-space-2);min-height:5.15rem;padding:var(--cp-space-3) var(--cp-space-4);border-bottom:1px solid var(--cp-border-graphite)}.panel-head>div{display:flex;align-items:center;gap:var(--cp-space-2)}.panel-head span{color:var(--cp-accent-crimson);font:750 var(--cp-text-xs)/1 var(--cp-font-mono)}.panel-head h2{margin:0;color:var(--cp-text-warm);font-size:var(--cp-text-lg);line-height:1.2}.panel-head p{margin:0;color:var(--cp-text-warm-muted);font-size:var(--cp-text-xs);line-height:1.45}.incident-list{display:grid;margin:0;padding:0;list-style:none}.incident-list li+li{border-top:1px solid var(--cp-border-graphite)}.incident-list a{display:grid;gap:var(--cp-space-2);padding:var(--cp-space-3) var(--cp-space-4);color:var(--cp-text-warm);text-decoration:none}.incident-list a:hover{background:var(--cp-surface-charcoal-raised)}.classification{width:max-content;padding:.2rem .35rem;border:1px solid var(--cp-border-graphite);border-radius:var(--cp-radius-sm);color:var(--cp-text-warm-muted)!important;font-size:.62rem!important;letter-spacing:.02em}.incident-list strong{font-size:var(--cp-text-sm);line-height:1.35}.incident-list small{color:var(--cp-text-warm-muted);font:650 .62rem/1.3 var(--cp-font-mono)}.incident-list dl{display:grid;gap:.3rem;margin:0}.incident-list dl div{display:flex;justify-content:space-between;gap:.5rem}.incident-list dt,.incident-list dd{margin:0;color:var(--cp-text-warm-muted);font-size:.62rem}.incident-list dd{display:flex;align-items:center;gap:.35rem;text-align:right}.incident-list dd i{width:.35rem;height:.35rem;border-radius:50%}.incident-list dd .verified{background:var(--cp-branch-governed)}.incident-list dd .restricted{background:var(--cp-warning)}.incident-list em{display:flex;align-items:center;justify-content:flex-end;gap:.4rem;color:var(--cp-accent-crimson);font-size:.68rem;font-style:normal;font-weight:700}.network-stage{height:14.8rem;background:var(--cp-canvas-obsidian)}.network-stage svg{display:block;width:100%;height:100%}.aggregate-edges line{stroke:var(--cp-text-warm-muted);opacity:.24}.cluster-ring{fill:color-mix(in srgb,var(--cp-accent-crimson) 8%,transparent);stroke:var(--cp-border-graphite)}.cluster-core{fill:var(--cp-text-warm-muted)}.agent-cluster:nth-child(3n) .cluster-core{fill:var(--cp-branch-natural)}.agent-cluster:nth-child(4n) .cluster-core{fill:var(--cp-branch-governed)}.network-center{fill:var(--cp-surface-charcoal);stroke:var(--cp-accent-crimson);stroke-width:1.5}.network-count{fill:var(--cp-text-warm);font:760 1.05rem var(--cp-font-mono);text-anchor:middle}.network-label{fill:var(--cp-text-warm-muted);font:650 .42rem var(--cp-font-mono);letter-spacing:.08em;text-anchor:middle}.network-facts{display:grid;grid-template-columns:repeat(3,1fr);margin:0;border-top:1px solid var(--cp-border-graphite)}.network-facts div{display:grid;gap:.2rem;padding:var(--cp-space-3);text-align:center}.network-facts div+div{border-left:1px solid var(--cp-border-graphite)}.network-facts dt{color:var(--cp-text-warm);font:750 var(--cp-text-sm)/1 var(--cp-font-mono)}.network-facts dd{margin:0;color:var(--cp-text-warm-muted);font-size:.6rem;line-height:1.25}.boundary{display:flex;align-items:flex-start;gap:.45rem;margin:0;padding:var(--cp-space-2) var(--cp-space-3);border-top:1px solid var(--cp-border-graphite);color:var(--cp-text-warm-muted);font-size:.62rem;line-height:1.4}.boundary i{margin-top:.1rem;color:var(--cp-evidence)}.comparison-context{display:grid;gap:.35rem;padding:var(--cp-space-3) var(--cp-space-4);border-bottom:1px solid var(--cp-border-graphite)}.comparison-context span{color:var(--cp-accent-crimson);font-size:.65rem;font-weight:750}.comparison-context strong{font-size:var(--cp-text-sm)}.comparison-context small{color:var(--cp-text-warm-muted);font:650 .6rem/1.3 var(--cp-font-mono)}.comparison-table{display:grid}.comparison-row{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(2.5rem,.55fr));align-items:center;gap:.3rem;min-height:2.7rem;padding:0 var(--cp-space-3);border-bottom:1px solid var(--cp-border-graphite);font-size:.7rem}.comparison-row--head{min-height:2.2rem;color:var(--cp-text-warm-muted);font-size:.58rem}.comparison-row strong{overflow:hidden;color:var(--cp-text-warm);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.comparison-row span,.comparison-row b{text-align:right}.comparison-row b{font-weight:650}.comparison-row .natural{color:var(--cp-branch-natural)}.comparison-row .governed{color:var(--cp-branch-governed)}.comparison-row .positive{color:var(--cp-warning)}.comparison-row .negative{color:var(--cp-branch-governed)}.preview-state{display:flex;min-height:20rem;grid-column:1/-1;align-items:center;justify-content:center;gap:.65rem;border:1px solid var(--cp-border-graphite);border-radius:var(--cp-radius-md);background:var(--cp-surface-charcoal);color:var(--cp-text-warm-muted);font-size:var(--cp-text-sm)}.preview-state i{width:.55rem;height:.55rem;border-radius:50%;background:var(--cp-accent-crimson)}.preview-state--error{flex-direction:column}.preview-state button{min-height:var(--cp-touch-target);padding:0 var(--cp-space-3);border:1px solid var(--cp-border-graphite);border-radius:var(--cp-radius-md);background:var(--cp-surface-charcoal-raised);color:var(--cp-text-warm);cursor:pointer}@media(max-width:1120px){.operational-preview{grid-template-columns:minmax(14rem,.8fr) minmax(23rem,1.35fr)}.divergence-panel{display:grid;grid-column:1/-1;grid-template-columns:minmax(14rem,.7fr) minmax(0,1.3fr)}.divergence-panel .panel-head,.divergence-panel .boundary,.divergence-panel .comparison-context{grid-column:1}.divergence-panel .comparison-table{grid-column:2;grid-row:1/4;border-left:1px solid var(--cp-border-graphite)}.divergence-panel .boundary{align-self:end}}@media(max-width:767px){.operational-preview{grid-template-columns:minmax(0,1fr)}.divergence-panel{display:block;grid-column:auto}.divergence-panel .comparison-table{border-left:0}.network-stage{height:auto;aspect-ratio:440/276}}@media(max-width:430px){.panel-head{min-height:0;padding:var(--cp-space-3)}.incident-list a{padding:var(--cp-space-3)}.network-facts dd{font-size:.55rem}.comparison-row{grid-template-columns:minmax(0,1.35fr) repeat(3,minmax(2.25rem,.55fr));padding:0 var(--cp-space-2);font-size:.64rem}}
@media(min-width:600px) and (max-width:767px){.operational-preview{grid-template-columns:minmax(14rem,.8fr) minmax(23rem,1.35fr)}.divergence-panel{display:grid;grid-column:1/-1;grid-template-columns:minmax(14rem,.7fr) minmax(0,1.3fr)}.divergence-panel .panel-head,.divergence-panel .boundary,.divergence-panel .comparison-context{grid-column:1}.divergence-panel .comparison-table{grid-column:2;grid-row:1/4;border-left:1px solid var(--cp-border-graphite)}.divergence-panel .boundary{align-self:end}.network-stage{height:14.8rem;aspect-ratio:auto}}
/* Publication restriction is a real warning state, not a brand accent. */
.incident-list dd .restricted{background:var(--cp-risk-medium)}
</style>
