<script setup lang="ts">
import { useRoute } from 'vue-router'
import type { ResultViewModel } from '../domain/viewModels.ts'

const props = defineProps<{ result: ResultViewModel }>()
const route = useRoute()

const tabs = [
  { id: 'summary', label: '摘要' },
  { id: 'mechanisms', label: '机制' },
  { id: 'governance', label: '治理' },
  { id: 'evidence', label: '证据' },
] as const

function tabHref(id: string) {
  const query: Record<string, string> = { source: props.result.source.key }
  if (typeof route.query.tick === 'string') query.tick = route.query.tick
  return { name: `campus-pulse-result-${id}`, params: { resultKey: props.result.key }, query }
}

function current(id: string) {
  return route.name === `campus-pulse-result-${id}`
}
</script>

<template>
  <nav class="result-route-tabs" aria-label="结果分析视图">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.id"
      :to="tabHref(tab.id)"
      :aria-current="current(tab.id) ? 'page' : undefined"
      class="result-route-tabs__tab"
    >
      <span class="result-route-tabs__label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.result-route-tabs { display:flex; gap:var(--cp-space-1); padding:0 var(--cp-content-gutter); border-bottom:1px solid var(--cp-border-default); background:var(--cp-surface-default); overflow-x:auto; }
.result-route-tabs__tab { min-width:6rem; padding:var(--cp-space-3) var(--cp-space-4); border-bottom:3px solid transparent; color:var(--cp-text-secondary); text-align:center; text-decoration:none; }
.result-route-tabs__tab:hover { background:var(--cp-surface-subtle); }
.result-route-tabs__tab[aria-current="page"] { border-bottom-color:var(--cp-action-primary); color:var(--cp-action-primary); }
.result-route-tabs__label { font-size:var(--cp-text-sm); font-weight:750; }
@media (max-width:767px) { .result-route-tabs { padding-inline:var(--cp-space-2); } .result-route-tabs__tab { min-width:5rem; } }
</style>
