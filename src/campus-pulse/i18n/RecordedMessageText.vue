<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { currentLocale } from './locale.ts'
import { savedEnglishText } from './contentTranslation.ts'
import ContentTranslation from './ContentTranslation.vue'
const props = defineProps<{ text:string }>()
const original = ref(false)
const english = computed(() => currentLocale.value === 'en-US')
const translation = computed(() => savedEnglishText(props.text))
watch(() => props.text, () => { original.value=false })
</script>
<template>
 <div class="recorded-text" data-no-localize>
  <p :lang="english && translation && !original ? 'en' : undefined">{{ english && translation && !original ? translation : text }}</p>
  <button v-if="english && translation && translation !== text" @click="original=!original">{{ original ? 'English translation' : 'Original text' }}</button>
  <ContentTranslation v-else-if="english && !translation" :text="text" />
 </div>
</template>
<style scoped>
.recorded-text p{margin:0;line-height:1.65;font-size:inherit;color:inherit;overflow-wrap:anywhere}
.recorded-text button{padding:4px 0;border:0;border-bottom:1px dotted currentColor;background:none;color:inherit;opacity:.8;font:inherit;font-size:11px;cursor:pointer}.recorded-text button:hover{opacity:1}.recorded-text button:focus-visible{outline:2px solid var(--cp-focus-ring);outline-offset:3px}
</style>
