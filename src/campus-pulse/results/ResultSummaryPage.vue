<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ResultStorySequence from './ResultStorySequence.vue'
import { RESULT_DETAIL_CONTEXT } from './resultDetailContext.ts'
import { buildResultStory } from './resultsAnalysis.ts'
import type { ResultMetricKey } from '../source/forumTwinAdapter.ts'

const context = inject(RESULT_DETAIL_CONTEXT)
const route = useRoute()
const router = useRouter()
if (!context) throw new Error('ResultSummaryPage requires ResultDetailLayout context')

const analysis = computed(() => context.analysis.value)
const result = computed(() => context.result.value)
const story = computed(() => analysis.value ? buildResultStory(analysis.value) : null)
const metric = computed<ResultMetricKey>(() => {
  const requested = typeof route.query.metric === 'string' ? route.query.metric : ''
  return analysis.value?.metricComparison.some((item) => item.metric === requested)
    ? requested as ResultMetricKey
    : analysis.value?.primaryObservation?.metric || 'messages'
})
const tick = computed(() => {
  const requested = typeof route.query.tick === 'string' ? Number(route.query.tick) : Number.NaN
  const ids = result.value?.scope.tickIds || []
  return ids.includes(requested) ? requested : null
})

function setMetric(next: ResultMetricKey) {
  router.replace({ query: { ...route.query, metric: next } })
}

function setTick(next: number) {
  router.replace({ query: { ...route.query, tick: String(next) } })
}

function inspectTick(next: number) {
  if (!result.value) return
  router.push({
    name: 'campus-pulse-result-evidence',
    params: { resultKey: result.value.key },
    query: { source: result.value.source.key, tick: String(next) },
  })
}
</script>

<template>
  <div v-if="analysis && result && story" class="result-summary-page">
    <ResultStorySequence
      :story="story"
      :result-key="result.key"
      :metric="metric"
      :tick="tick"
      @select-metric="setMetric"
      @select-tick="setTick"
      @inspect="inspectTick"
    />
  </div>
</template>

<style scoped>
.result-summary-page { width:100%; min-width:0; max-width:100%; }
</style>
