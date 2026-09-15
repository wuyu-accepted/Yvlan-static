<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { translateSyntheticContent } from './contentTranslation.ts'
import { currentLocale } from './locale.ts'

const props = defineProps<{ text: string }>()
const open = ref(false)
const loading = ref(false)
const translated = ref('')
const error = ref('')
const buttonLabel = computed(() => {
  if (currentLocale.value === 'en-US') return loading.value ? 'Translating…' : open.value ? 'Hide translation' : 'Translate to English'
  return loading.value ? '翻译中…' : open.value ? '收起翻译' : '译为英文'
})

watch(() => props.text, () => {
  open.value = false
  translated.value = ''
  error.value = ''
})

async function toggle() {
  if (open.value) {
    open.value = false
    return
  }
  if (translated.value) {
    open.value = true
    return
  }
  loading.value = true
  error.value = ''
  try {
    translated.value = (await translateSyntheticContent(props.text)).text
    open.value = true
  } catch {
    error.value = 'Translation unavailable. Start the translation service or retry.'
    open.value = true
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="content-translation" data-no-localize>
    <button type="button" :disabled="loading" :aria-expanded="open" @click="toggle">
      <i class="fa-solid fa-language" aria-hidden="true" />
      {{ buttonLabel }}
    </button>
    <p v-if="open && translated" lang="en" class="content-translation__text">{{ translated }}</p>
    <p v-else-if="open && error" role="status" class="content-translation__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.content-translation { display:grid; justify-items:start; gap:var(--cp-space-2); }
.content-translation button { display:inline-flex; min-height:1.8rem; align-items:center; gap:.35rem; padding:0 .55rem; border:1px solid var(--cp-border-default); border-radius:999px; background:var(--cp-surface-subtle); color:var(--cp-text-secondary); font-size:var(--cp-text-xs); font-weight:650; cursor:pointer; }
.content-translation button:hover { border-color:var(--cp-action-primary); color:var(--cp-action-primary); }
.content-translation button:disabled { opacity:.6; cursor:wait; }
.content-translation__text,.content-translation__error { margin:0; padding:var(--cp-space-2) var(--cp-space-3); border-left:2px solid var(--cp-evidence); background:var(--cp-evidence-surface); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.6; }
.content-translation__error { border-color:var(--cp-warning); background:var(--cp-warning-surface); }
</style>
