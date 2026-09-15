<script setup lang="ts">
import { computed } from 'vue'
import type { SourceState } from '../contracts/source'
import CpStatusBadge from './CpStatusBadge.vue'

const props = defineProps<{ source: SourceState }>()
const verificationLabel = computed(() => ({
  verified: '已验证', unverified: '未验证', mismatch: '文件校验不一致', failed: '验证失败', missing: '证据缺失',
}[props.source.verification]))
</script>

<template>
  <section class="verification-details" aria-labelledby="verification-title">
    <header>
      <div>
        <h2 id="verification-title">验证详情</h2>
      </div>
      <CpStatusBadge
        :tone="source.verification === 'verified' ? 'evidence' : source.verification === 'unverified' ? 'neutral' : 'danger'"
        :icon="source.verification === 'verified' ? 'fa-circle-check' : 'fa-triangle-exclamation'"
      >{{ verificationLabel }}</CpStatusBadge>
    </header>
    <dl>
      <div><dt>交付来源</dt><dd>{{ source.label }}</dd></div>
      <div><dt>执行来源</dt><dd>{{ source.provenance.executionProvenance || '未声明' }}</dd></div>
      <div><dt>Run</dt><dd>{{ source.provenance.runId || '离线资产' }}</dd></div>
      <div><dt>Scenario</dt><dd>{{ source.provenance.scenarioId || '未声明' }}</dd></div>
      <div><dt>Manifest</dt><dd>{{ source.provenance.manifestAvailable ? '可用' : '缺失' }}</dd></div>
      <div><dt>发布资格</dt><dd>{{ source.publicationEligible === null ? '未声明' : source.publicationEligible ? '允许' : '不允许' }}</dd></div>
      <div><dt>新鲜度</dt><dd>{{ source.freshness.status === 'stale' ? '已过期' : source.freshness.status === 'fresh' ? '当前响应' : '无可验证时间戳' }}</dd></div>
    </dl>
    <ul>
      <li v-for="boundary in source.boundaries" :key="boundary">{{ boundary }}</li>
    </ul>
  </section>
</template>

<style scoped>
.verification-details { border:1px solid var(--cp-evidence); background:var(--cp-surface-default); }
.verification-details header { display:flex; align-items:center; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.verification-details h2 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-lg); }
.verification-details dl { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:0; }
.verification-details dl div { min-width:0; padding:var(--cp-space-3) var(--cp-space-4); border-right:1px solid var(--cp-border-default); border-bottom:1px solid var(--cp-border-default); }
.verification-details dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.verification-details dd { margin:var(--cp-space-1) 0 0; overflow-wrap:anywhere; color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:600; }
.verification-details code { font-family:var(--cp-font-mono); }
.verification-details ul { margin:0; padding:var(--cp-space-3) var(--cp-space-8); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:var(--cp-leading-normal); }
@media (max-width:1023px) { .verification-details dl { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:479px) { .verification-details dl { grid-template-columns:1fr; } .verification-details dl div { border-right:0; } }
</style>
