<script setup lang="ts">
import type { ResultSourceDescriptor } from '../contracts/source'
import { isEnglish } from '../i18n/locale.ts'

defineProps<{
  sources: ResultSourceDescriptor[]
  selectedKey: string
  disabledReasons?: Record<string, string>
}>()
defineEmits<{ select: [key: string] }>()

function sourceLabel(source: ResultSourceDescriptor): string {
  if (!isEnglish.value) return `${source.label}${source.immutable ? '（只读）' : ''}`
  const labels: Record<string, string> = {
    'offline-hero': 'Housing resource allocation governance case',
    'offline-lecture': 'Lecture misconduct governance rehearsal',
  }
  return `${labels[source.key] || source.label}${source.immutable ? ' (read-only)' : ''}`
}
</script>

<template>
  <div class="source-picker">
    <label for="result-source">数据来源</label>
    <select
      id="result-source"
      name="result-source"
      autocomplete="off"
      :value="selectedKey"
      @change="$emit('select', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="source in sources"
        :key="source.key"
        :value="source.key"
        :disabled="Boolean(disabledReasons?.[source.key])"
      >
        {{ sourceLabel(source) }}
      </option>
    </select>
    <p v-if="disabledReasons?.['live-api']" class="source-picker__hint">
      {{ disabledReasons['live-api'] }}
    </p>
  </div>
</template>

<style scoped>
.source-picker { display:grid; min-width:15rem; gap:var(--cp-space-1); }
.source-picker label { color:var(--cp-text-secondary); font-size:var(--cp-text-xs); font-weight:700; }
.source-picker select { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font:inherit; }
.source-picker__hint { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
@media (max-width:767px) { .source-picker { width:100%; min-width:0; } .source-picker select { min-height:var(--cp-touch-target); } }
</style>
