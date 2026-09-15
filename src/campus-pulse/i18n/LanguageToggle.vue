<script setup lang="ts">
import { currentLocale, setLocale } from './locale.ts'
</script>

<template>
  <div class="language-toggle" role="group" aria-label="界面语言 / Interface language" data-no-localize>
    <button type="button" :class="{ active:currentLocale === 'zh-CN' }" :aria-pressed="currentLocale === 'zh-CN'" @click="setLocale('zh-CN')">中</button>
    <button type="button" :class="{ active:currentLocale === 'en-US' }" :aria-pressed="currentLocale === 'en-US'" @click="setLocale('en-US')">EN</button>
  </div>
</template>

<style scoped>
.language-toggle { display:flex; flex:none; align-items:center; gap:.15rem; padding:.18rem; border:1px solid var(--cp-border-default); border-radius:999px; background:var(--cp-surface-subtle); box-shadow:inset 0 1px rgba(255,255,255,.55); }
.language-toggle button { min-width:2.1rem; min-height:1.85rem; padding:0 .55rem; border:0; border-radius:999px; background:transparent; color:var(--cp-text-muted); font:750 var(--cp-text-xs)/1 var(--cp-font-sans); cursor:pointer; transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease; }
.language-toggle button:hover { color:var(--cp-text-primary); transform:translateY(-1px); }
.language-toggle button.active { background:var(--cp-surface-default); color:var(--cp-action-primary); box-shadow:0 2px 8px rgba(0,0,0,.1); }
@media (prefers-reduced-motion:reduce) { .language-toggle button { transition:none; } }
</style>
