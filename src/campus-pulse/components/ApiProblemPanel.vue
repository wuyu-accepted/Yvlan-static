<script setup lang="ts">
import { computed } from 'vue'
import type { ApiProblem } from '../contracts/api'
import CpStatePanel from './CpStatePanel.vue'

const props = defineProps<{ problem: ApiProblem; offlineAvailable?: boolean }>()
defineEmits<{ retry: []; openOffline: []; returnToRuns: []; inspectEvidence: [] }>()
const primary = computed(() => props.problem.retryable ? '重试当前来源' : props.problem.action === 'return_to_runs' ? '返回运行列表' : props.problem.action === 'inspect_evidence' ? '检查证据' : '')
</script>

<template>
  <CpStatePanel
    variant="error"
    :title="problem.summary"
    :detail="problem.detail"
    :primary-label="primary"
    :secondary-label="offlineAvailable ? '打开已校验的离线审计案例' : ''"
    @primary="problem.retryable ? $emit('retry') : problem.action === 'return_to_runs' ? $emit('returnToRuns') : $emit('inspectEvidence')"
    @secondary="$emit('openOffline')"
  >
    <template v-if="problem.fieldErrors.length" #details>
      <ul class="api-problem-fields">
        <li v-for="field in problem.fieldErrors" :key="`${field.field}:${field.code}`">
          <strong>{{ field.field || '请求' }}</strong>：{{ field.message }}
        </li>
      </ul>
    </template>
  </CpStatePanel>
</template>

<style scoped>
.api-problem-fields { margin:var(--cp-space-3) 0 0; padding-left:var(--cp-space-5); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
</style>
