<script setup>
import CpButton from './CpButton.vue'

const props = defineProps({
  variant: { type: String, default: 'empty' },
  title: { type: String, required: true },
  detail: { type: String, default: '' },
  primaryLabel: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' },
  timestamp: { type: String, default: '' },
})

defineEmits(['primary', 'secondary'])
const isAlert = ['error', 'verification-failed'].includes(props.variant)
</script>

<template>
  <section class="cp-state-panel" :class="`cp-state-panel--${variant}`" :role="isAlert ? 'alert' : 'status'" :aria-live="isAlert ? 'assertive' : 'polite'">
    <i class="fa-solid cp-state-panel__icon" :class="isAlert ? 'fa-circle-exclamation' : variant === 'loading' ? 'fa-hourglass-half' : 'fa-inbox'" aria-hidden="true" />
    <div class="cp-state-panel__body">
      <h1 v-if="variant === 'not-found'">{{ title }}</h1>
      <h2 v-else>{{ title }}</h2>
      <p v-if="detail">{{ detail }}</p>
      <time v-if="timestamp">{{ timestamp }}</time>
      <slot name="details" />
      <div v-if="primaryLabel || secondaryLabel" class="cp-state-panel__actions">
        <CpButton v-if="primaryLabel" variant="primary" @click="$emit('primary')">{{ primaryLabel }}</CpButton>
        <CpButton v-if="secondaryLabel" @click="$emit('secondary')">{{ secondaryLabel }}</CpButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cp-state-panel { display:flex; max-width:46rem; gap:var(--cp-space-4); margin:var(--cp-space-8) auto; padding:var(--cp-space-5); border:1px solid var(--cp-border-default); border-left:4px solid var(--cp-border-strong); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.cp-state-panel--error,.cp-state-panel--verification-failed { border-left-color:var(--cp-danger); background:var(--cp-danger-surface); }
.cp-state-panel__icon { margin-top:.2rem; color:var(--cp-text-secondary); }
.cp-state-panel--error .cp-state-panel__icon,.cp-state-panel--verification-failed .cp-state-panel__icon { color:var(--cp-danger); }
.cp-state-panel h1,.cp-state-panel h2 { margin:0; font-size:var(--cp-text-xl); line-height:var(--cp-leading-tight); }
.cp-state-panel p { margin:var(--cp-space-2) 0 0; color:var(--cp-text-secondary); line-height:var(--cp-leading-normal); }
.cp-state-panel time { display:block; margin-top:var(--cp-space-2); color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.cp-state-panel__actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); margin-top:var(--cp-space-4); }
</style>
