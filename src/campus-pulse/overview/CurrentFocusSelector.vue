<script setup lang="ts">
import { ref, watch } from 'vue'
import { listSourceDescriptors } from '../source/registry.ts'
import SourcePicker from '../components/SourcePicker.vue'
import CpButton from '../components/CpButton.vue'

const props = defineProps<{ sourceKey: string; resultKey: string }>()
const emit = defineEmits<{ apply: [payload: { sourceKey: string; resultKey: string }] }>()
const pendingSource = ref(props.sourceKey)
const pendingResult = ref(props.resultKey)
watch(() => [props.sourceKey, props.resultKey], ([source, result]) => {
  pendingSource.value = source
  pendingResult.value = result
})
function submit() {
  emit('apply', { sourceKey: pendingSource.value, resultKey: pendingResult.value.trim() })
}
</script>

<template>
  <form class="focus-selector" aria-label="选择总览数据来源" @submit.prevent="submit">
    <SourcePicker :sources="listSourceDescriptors()" :selected-key="pendingSource" @select="pendingSource = $event" />
    <div v-if="pendingSource === 'live-api'" class="focus-selector__run">
      <label for="overview-run-id">运行 ID</label>
      <input id="overview-run-id" v-model="pendingResult" name="result" autocomplete="off" placeholder="run_…" spellcheck="false" />
    </div>
    <CpButton type="submit" variant="primary">加载所选来源</CpButton>
  </form>
</template>

<style scoped>
.focus-selector { display:flex; align-items:end; gap:var(--cp-space-2); }
.focus-selector__run { display:grid; min-width:16rem; gap:var(--cp-space-1); }
.focus-selector__run label { color:var(--cp-text-secondary); font-size:var(--cp-text-xs); font-weight:700; }
.focus-selector__run input { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); font:var(--cp-text-sm)/1 var(--cp-font-mono); }
@media (max-width:767px) { .focus-selector { align-items:stretch; flex-direction:column; } .focus-selector__run { min-width:0; } .focus-selector__run input { min-height:var(--cp-touch-target); } }
</style>
