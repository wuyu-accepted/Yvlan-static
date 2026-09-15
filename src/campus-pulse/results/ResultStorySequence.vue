<script setup lang="ts">
import { computed } from 'vue'
import OverviewTimeline from '../overview/OverviewTimeline.vue'
import { isEnglish } from '../i18n/locale.ts'
import { branchDisplayName } from './branchPresentation.ts'
import type { ResultMetricKey } from '../source/forumTwinAdapter.ts'
import type { ResultStoryVM, StoryProvenanceKind } from './resultsAnalysis.ts'

const props = defineProps<{ story: ResultStoryVM; resultKey: string; metric: ResultMetricKey; tick: number | null }>()
const emit = defineEmits<{ 'select-metric': [metric: ResultMetricKey]; 'select-tick': [tick: number]; inspect: [tick: number] }>()
const l = (zh:string,en:string) => isEnglish.value ? en : zh
const titles = {
  'event-trigger':['事件触发','Event Trigger'], 'divergence-point':['分歧点','Divergence Point'],
  'behavioral-catalysts':['行为催化因素','Behavioral Catalysts'], 'governance-efficacy':['治理成效','Governance Efficacy'],
  'residual-vulnerabilities':['残余脆弱性','Residual Vulnerabilities'],
  'strategic-policy-recommendations':['战略政策建议','Strategic Policy Recommendations'],
} as const
const provenance:Record<StoryProvenanceKind,readonly [string,string]> = {
  structured_fact:['结构化事实','Structured fact'], fact:['直接事实','Direct fact'], derived_fact:['派生事实','Derived fact'],
  evidence_backed_interpretation:['证据支持的编写解读','Evidence-backed authored interpretation'],
  candidate_mechanism:['候选机制','Candidate mechanism'], unavailable:['不可用','Unavailable'],
}
const metricLabels:Record<ResultMetricKey,readonly [string,string]> = {
  messages:['公开消息','Public messages'], threads:['活跃讨论串','Active threads'], claims:['公开 Claim','Public Claims'],
  corrections:['纠正','Corrections'], help_requests:['求助','Help requests'],
}
const hasExplanation = computed(() => props.story.timeline.some((point) => point.explanation !== null))
const branchName = (id:'Natural'|'A'|'D') => branchDisplayName(props.resultKey,id,isEnglish.value,true)
const evidenceLabel = (ref:{ route:any }) => {
  const tick = ref.route?.query?.tick
  return tick ? l(`证据 · Tick ${tick}`,`Evidence · Tick ${tick}`) : l('证据','Evidence')
}
</script>

<template>
  <div class="result-story" aria-label="Six-stage result narrative">
    <article v-for="stage in story.stages" :key="stage.id" class="story-stage" :class="{'story-stage--unavailable':stage.status==='unavailable'}" :aria-labelledby="`story-stage-${stage.number}`">
      <div class="story-stage__number" aria-hidden="true">{{ String(stage.number).padStart(2,'0') }}</div>
      <div class="story-stage__content">
        <header class="story-stage__header">
          <div><p>{{ l('阶段','Stage') }} {{ stage.number }} / 6</p><h2 :id="`story-stage-${stage.number}`">{{ l(titles[stage.id][0],titles[stage.id][1]) }}</h2></div>
          <span class="provenance" :class="`provenance--${stage.provenance}`">{{ l(provenance[stage.provenance][0],provenance[stage.provenance][1]) }}</span>
        </header>
        <p class="story-stage__finding">{{ l(stage.finding,stage.findingEn) }}</p>
        <dl v-if="stage.facts.length" class="story-facts">
          <div v-for="fact in stage.facts" :key="fact.id"><dt>{{ l(fact.label,fact.labelEn) }}</dt><dd>{{ l(fact.value,fact.valueEn) }}</dd><span>{{ l(provenance[fact.provenance][0],provenance[fact.provenance][1]) }}</span></div>
        </dl>
        <div v-if="stage.id==='divergence-point'" class="divergence">
          <div class="comparison-wrap"><table><thead><tr><th scope="col">{{ l('指标','Metric') }}</th><th scope="col">{{ branchName('Natural') }}</th><th v-if="hasExplanation" scope="col">{{ branchName('A') }}</th><th scope="col">{{ branchName('D') }}</th><th scope="col">Δ</th></tr></thead>
            <tbody><tr v-for="row in story.comparison" :key="row.metric"><th scope="row">{{ l(metricLabels[row.metric][0],metricLabels[row.metric][1]) }}</th><td>{{ row.natural }}</td><td v-if="hasExplanation">{{ row.explanation ?? '—' }}</td><td>{{ row.intervention }}</td><td class="delta">{{ row.delta!>0?'+':'' }}{{ row.delta }}</td></tr></tbody></table></div>
          <OverviewTimeline :timeline="story.timeline" :metric="metric" :tick="tick" :result-key="resultKey" @select-metric="emit('select-metric',$event)" @select-tick="emit('select-tick',$event)" @inspect="emit('inspect',$event)" />
        </div>
        <footer class="story-stage__footer">
          <p class="boundary">{{ l(stage.boundary,stage.boundaryEn) }}</p>
          <nav v-if="stage.drilldowns.length||stage.evidenceRefs.length" :aria-label="l('阶段相关视图','Related stage views')">
            <RouterLink v-for="item in stage.drilldowns" :key="item.label" :to="item.route">{{ l(item.label,item.labelEn) }}</RouterLink>
            <RouterLink v-for="ref in stage.evidenceRefs" :key="`${ref.label}-${ref.manifestId}`" :to="ref.route" class="evidence-link"><i class="fa-solid fa-circle-check" aria-hidden="true"/>{{ evidenceLabel(ref) }}</RouterLink>
          </nav>
        </footer>
      </div>
    </article>
  </div>
</template>

<style scoped>
.result-story{display:grid;min-width:0;border:1px solid var(--cp-border-default);background:var(--cp-surface-default)}
.story-stage{display:grid;grid-template-columns:3.5rem minmax(0,1fr);min-width:0;border-top:1px solid var(--cp-border-default)}.story-stage:first-child{border-top:0}
.story-stage__number{display:flex;justify-content:center;padding:var(--cp-space-4) var(--cp-space-2);border-right:1px solid var(--cp-border-default);color:var(--cp-action-primary);font:700 var(--cp-text-sm)/1 var(--cp-font-mono)}
.story-stage__content{min-width:0;padding:var(--cp-space-4)}.story-stage__header{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--cp-space-3)}
.story-stage__header p{margin:0 0 var(--cp-space-1);color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.story-stage h2{margin:0;font-size:var(--cp-text-xl);line-height:var(--cp-leading-tight)}
.provenance{flex:none;padding:.2rem var(--cp-space-2);border:1px solid var(--cp-border-strong);border-radius:var(--cp-radius-sm);color:var(--cp-text-secondary);font-size:var(--cp-text-xs)}
.provenance--derived_fact{border-color:var(--cp-branch-natural);color:var(--cp-branch-natural-text)}.provenance--candidate_mechanism{border-color:var(--cp-warning);color:var(--cp-warning-text)}.provenance--unavailable{color:var(--cp-text-muted)}
.story-stage__finding{max-width:72rem;margin:var(--cp-space-3) 0 0;color:var(--cp-text-primary);font-size:var(--cp-text-md);font-weight:650;line-height:1.55}
.story-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:var(--cp-space-3) 0 0;border:1px solid var(--cp-border-subtle)}.story-facts div{min-width:0;padding:var(--cp-space-3);border-left:1px solid var(--cp-border-subtle)}.story-facts div:first-child{border-left:0}
.story-facts dt{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}.story-facts dd{margin:var(--cp-space-1) 0 0;color:var(--cp-text-primary);font-size:var(--cp-text-sm);line-height:1.45;overflow-wrap:anywhere}.story-facts span{display:block;margin-top:var(--cp-space-2);color:var(--cp-text-muted);font-size:.68rem}
.divergence{display:grid;gap:var(--cp-space-3);margin-top:var(--cp-space-3)}.comparison-wrap{max-width:100%;overflow-x:auto;border:1px solid var(--cp-border-subtle)}.comparison-wrap table{width:100%;border-collapse:collapse;font-size:var(--cp-text-xs);font-variant-numeric:tabular-nums}.comparison-wrap th,.comparison-wrap td{padding:var(--cp-space-2) var(--cp-space-3);border-top:1px solid var(--cp-border-subtle);text-align:right;white-space:nowrap}.comparison-wrap thead th{border-top:0;color:var(--cp-text-muted)}.comparison-wrap th:first-child{text-align:left}.comparison-wrap .delta{color:var(--cp-action-primary);font-weight:750}
.story-stage__footer{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--cp-space-3);margin-top:var(--cp-space-3);padding-top:var(--cp-space-3);border-top:1px solid var(--cp-border-subtle)}.boundary{max-width:62rem;margin:0;color:var(--cp-text-muted);font-size:var(--cp-text-xs);line-height:1.5}.story-stage__footer nav{display:flex;flex:none;flex-wrap:wrap;justify-content:flex-end;gap:var(--cp-space-2)}.story-stage__footer a{display:inline-flex;min-height:2rem;align-items:center;gap:var(--cp-space-1);padding:0 var(--cp-space-2);border:1px solid var(--cp-border-strong);border-radius:var(--cp-radius-sm);color:var(--cp-text-primary);font-size:var(--cp-text-xs);font-weight:700;text-decoration:none}.story-stage__footer a:hover{border-color:var(--cp-action-primary);color:var(--cp-action-primary)}.story-stage__footer .evidence-link{color:var(--cp-evidence-text)}.story-stage--unavailable{background:var(--cp-surface-subtle)}
@media(max-width:1023px){.story-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.story-facts div:nth-child(odd){border-left:0}}
@media(max-width:767px){.story-stage{grid-template-columns:2.6rem minmax(0,1fr)}.story-stage__content{padding:var(--cp-space-3)}.story-stage__header,.story-stage__footer{align-items:flex-start;flex-direction:column}.story-stage__footer nav{justify-content:flex-start}.provenance{align-self:flex-start}}
@media(max-width:479px){.story-facts{grid-template-columns:1fr}.story-facts div{border-left:0;border-top:1px solid var(--cp-border-subtle)}.story-facts div:first-child{border-top:0}.story-stage__footer nav{width:100%}.story-stage__footer a{min-height:var(--cp-touch-target)}}
</style>
