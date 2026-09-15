<script setup lang="ts">
import { computed, watch } from 'vue'
import LanguageToggle from '../i18n/LanguageToggle.vue'
import { currentLocale } from '../i18n/locale.ts'
import LandingOperationalPreview from './LandingOperationalPreview.vue'

const isEnglish = computed(() => currentLocale.value === 'en-US')
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'
const copy = computed(() => isEnglish.value ? {
  title: 'Run a Society Before Policy Rollout',
  description: 'CampusPulse runs campus governance incidents through a fixed synthetic agent population, then compares Natural and Governed outcomes with traceable evidence.',
  initialize: 'Initialize Simulation Run', cases: 'View Verified Case Studies', overview: 'Operational overview', product: 'Campus governance simulation',
} : {
  title: '政策落地之前，先运行一次社会。',
  description: 'CampusPulse 将校园治理事件置于固定合成人口中推演，并用可追溯证据对比 Natural 与治理分支结果。',
  initialize: '初始化模拟运行', cases: '查看已验证案例', overview: '运营能力总览', product: '校园治理社会模拟',
})

function updateDocumentTitle() {
  document.title = isEnglish.value ? 'CampusPulse · Run a Society Before Policy Rollout' : 'CampusPulse · 政策落地之前，先运行一次社会'
}
updateDocumentTitle()
watch(currentLocale, updateDocumentTitle)
</script>

<template>
  <div class="campus-pulse-app landing-page" data-no-localize>
    <header class="landing-nav">
      <RouterLink class="landing-brand" to="/campus-pulse" aria-label="CampusPulse">
        <span class="landing-brand__mark"><i class="fa-solid fa-wave-square" aria-hidden="true" /></span>
        <span><strong>CampusPulse</strong><small>{{ copy.product }}</small></span>
      </RouterLink>
      <nav class="landing-nav__actions" :aria-label="isEnglish ? 'Product navigation' : '产品导航'">
        <RouterLink class="overview-link" to="/campus-pulse/overview">{{ copy.overview }}</RouterLink>
        <LanguageToggle />
      </nav>
    </header>
    <main class="landing-main">
      <header class="landing-hero">
        <div><h1>{{ copy.title }}</h1><p>{{ copy.description }}</p></div>
        <div class="landing-actions">
          <RouterLink class="landing-action landing-action--primary" :to="publicDemo ? '/campus-pulse/results' : '/campus-pulse/workbench'">{{ publicDemo ? copy.cases : copy.initialize }} <i class="fa-solid fa-arrow-right" aria-hidden="true" /></RouterLink>
          <RouterLink class="landing-action landing-action--secondary" to="/campus-pulse/results">{{ copy.cases }}</RouterLink>
        </div>
      </header>
      <LandingOperationalPreview />
    </main>
  </div>
</template>

<style scoped>
.landing-page{width:100%;height:100dvh;min-height:0;overflow-x:hidden;overflow-y:auto;background:var(--cp-canvas-obsidian);color:var(--cp-text-warm);color-scheme:dark}
.landing-nav{position:sticky;top:0;z-index:10;display:flex;min-height:4.5rem;align-items:center;justify-content:space-between;gap:var(--cp-space-4);padding:0 clamp(1rem,3vw,3rem);border-bottom:1px solid var(--cp-border-graphite);background:color-mix(in srgb,var(--cp-canvas-obsidian) 94%,transparent);backdrop-filter:blur(12px)}
.landing-brand{display:flex;align-items:center;gap:var(--cp-space-3);color:var(--cp-text-warm);text-decoration:none}.landing-brand__mark{display:grid;width:2.35rem;height:2.35rem;place-items:center;border:1px solid color-mix(in srgb,var(--cp-accent-crimson) 78%,white);border-radius:var(--cp-radius-md);background:var(--cp-accent-crimson);color:var(--cp-text-warm)}.landing-brand>span:last-child{display:grid;gap:.12rem}.landing-brand strong{font-size:.95rem}.landing-brand small{color:var(--cp-text-warm-muted);font-size:.62rem;letter-spacing:.035em}
.landing-nav__actions{display:flex;align-items:center;gap:var(--cp-space-3)}.overview-link{display:inline-flex;min-height:var(--cp-touch-target);align-items:center;padding:0 var(--cp-space-3);border:1px solid var(--cp-border-graphite);border-radius:var(--cp-radius-md);color:var(--cp-text-warm-muted);font-size:var(--cp-text-xs);font-weight:700;text-decoration:none}.overview-link:hover{border-color:var(--cp-border-strong);color:var(--cp-text-warm)}
.landing-main{display:grid;width:min(100%,92rem);gap:var(--cp-space-4);margin:0 auto;padding:clamp(1.25rem,2.8vh,2rem) clamp(1rem,3vw,3rem) var(--cp-space-5)}
.landing-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:clamp(1.5rem,4vw,4rem);padding-bottom:var(--cp-space-4);border-bottom:1px solid var(--cp-border-graphite)}.landing-hero>div:first-child{max-width:54rem}.landing-hero h1{max-width:48rem;margin:0;color:var(--cp-text-warm);font-size:clamp(2rem,4vw,4rem);font-weight:680;letter-spacing:-.045em;line-height:1}.landing-hero p{max-width:49rem;margin:var(--cp-space-3) 0 0;color:var(--cp-text-warm-muted);font-size:clamp(.82rem,1.1vw,.96rem);line-height:1.6}
.landing-actions{display:flex;flex:none;flex-wrap:wrap;justify-content:flex-end;gap:var(--cp-space-2)}.landing-action{display:inline-flex;min-height:var(--cp-touch-target);align-items:center;justify-content:center;gap:.55rem;padding:0 var(--cp-space-4);border:1px solid var(--cp-border-graphite);border-radius:var(--cp-radius-md);color:var(--cp-text-warm);font-size:var(--cp-text-sm);font-weight:720;text-decoration:none}.landing-action--primary{border-color:var(--cp-accent-crimson);background:var(--cp-accent-crimson)}.landing-action--primary:hover{background:var(--cp-accent-crimson-hover)}.landing-action--secondary{background:var(--cp-surface-charcoal)}.landing-action--secondary:hover{border-color:var(--cp-border-strong)}
@media(max-width:1023px){.landing-hero{align-items:flex-start;flex-direction:column}.landing-actions{justify-content:flex-start}}
@media(max-width:599px){.landing-nav{min-height:4.25rem}.landing-brand>span:last-child{display:none}.landing-nav__actions{gap:var(--cp-space-2)}.overview-link{padding:0 var(--cp-space-2);font-size:.68rem}.landing-main{gap:var(--cp-space-3);padding-top:var(--cp-space-4)}.landing-hero{gap:var(--cp-space-3);padding-bottom:var(--cp-space-3)}.landing-hero h1{font-size:clamp(2rem,10vw,2.65rem);line-height:1.04}.landing-actions{display:grid;width:100%}.landing-action{width:100%}}
</style>
