<script setup>
import { computed } from 'vue'
import CpStatusBadge from '../components/CpStatusBadge.vue'

const props = defineProps({
  sourceState: { type: Object, required: true },
  serviceState: { type: String, default: 'checking' },
  detailsOpen: { type: Boolean, default: false },
  problem: { type: Object, default: null },
})
defineEmits(['open-details', 'refresh'])

const modeLabels = {
  live_api: 'Live API', audited_replay: '审计回放',
  offline_hero: '离线审计案例', static_archive: '静态归档', unknown: '来源未知',
}
const verification = computed(() => ({
  verified: { label: '已验证', tone: 'evidence', icon: 'fa-circle-check' },
  unverified: { label: '未验证', tone: 'neutral', icon: 'fa-circle-question' },
  mismatch: { label: '校验不匹配', tone: 'danger', icon: 'fa-triangle-exclamation' },
  failed: { label: '验证失败', tone: 'danger', icon: 'fa-circle-exclamation' },
}[props.sourceState.verification] || { label: '验证状态未知', tone: 'neutral', icon: 'fa-circle-question' }))
const service = computed(() => ({
  checking: { label: '正在检查后端', tone: 'neutral', icon: 'fa-spinner' },
  available: { label: '后端可用', tone: 'success', icon: 'fa-circle-check' },
  degraded: { label: '后端降级', tone: 'warning', icon: 'fa-triangle-exclamation' },
  unavailable: { label: '后端不可用', tone: 'danger', icon: 'fa-plug-circle-xmark' },
}[props.serviceState] || { label: '后端状态未知', tone: 'neutral', icon: 'fa-circle-question' }))
const freshness = computed(() => ({
  stale: { label: '数据已过期', tone: 'warning', icon: 'fa-clock' },
  fresh: { label: '当前响应', tone: 'neutral', icon: 'fa-clock' },
  unknown: null,
}[props.sourceState.freshness?.status] ?? null))
</script>

<template>
  <section class="source-status-bar" aria-label="数据来源与系统状态" aria-live="polite">
    <div class="source-status-bar__badges">
      <CpStatusBadge tone="info" icon="fa-database">{{ modeLabels[sourceState.mode] || modeLabels.unknown }}</CpStatusBadge>
      <CpStatusBadge :tone="verification.tone" :icon="verification.icon">{{ verification.label }}</CpStatusBadge>
      <CpStatusBadge v-if="freshness" :tone="freshness.tone" :icon="freshness.icon">{{ freshness.label }}</CpStatusBadge>
      <CpStatusBadge v-if="sourceState.fallback" tone="warning" icon="fa-arrow-down">已降级</CpStatusBadge>
      <CpStatusBadge :tone="service.tone" :icon="service.icon">{{ service.label }}</CpStatusBadge>
      <CpStatusBadge v-if="problem" tone="danger" icon="fa-circle-exclamation">来源不可确认</CpStatusBadge>
    </div>
    <div class="source-status-bar__actions">
      <button type="button" aria-controls="source-boundary-details" :aria-expanded="detailsOpen" @click="$emit('open-details')">运行详情</button>
      <button v-if="serviceState === 'unavailable'" type="button" @click="$emit('refresh')">重试</button>
    </div>
  </section>
</template>

<style scoped>
.source-status-bar { display:flex; min-height:var(--cp-sourcebar-min-height); align-items:center; gap:var(--cp-space-3); padding:var(--cp-space-2) var(--cp-content-gutter); border-bottom:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); color:var(--cp-text-secondary); }
.source-status-bar__badges { display:flex; min-width:0; flex:1; flex-wrap:wrap; gap:var(--cp-space-2); }
.source-status-bar__actions { display:flex; flex:none; gap:var(--cp-space-2); margin-left:auto; }
.source-status-bar__actions button { min-height:2rem; padding:0 var(--cp-space-2); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font-size:var(--cp-text-xs); font-weight:600; }
@media (max-width:767px) { .source-status-bar { align-items:center; padding-inline:var(--cp-space-4); } .source-status-bar__badges > :deep(:nth-child(n+4)) { display:none; } .source-status-bar__actions button { min-height:var(--cp-touch-target); } }
</style>
