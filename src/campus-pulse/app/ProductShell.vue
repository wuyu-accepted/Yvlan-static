<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getWorkbenchHealth } from '../../services/campusPulseApi'
import CpIconButton from '../components/CpIconButton.vue'
import CpSkeleton from '../components/CpSkeleton.vue'
import ProductNav from './ProductNav.vue'
import SourceStatusBar from './SourceStatusBar.vue'
import { productNavigation } from './navigation'
import { productShellContextKey } from './shellContext'
import { useSourceContext } from '../source/sourceContext'
import LanguageToggle from '../i18n/LanguageToggle.vue'
import { currentLocale, translateInterfaceText, useCampusPulseDomLocalization } from '../i18n/locale.ts'
import { useCampusPulseMotion } from './useCampusPulseMotion'

const route = useRoute()
defineProps({ routeLoading: { type: Boolean, default: false } })
const mobileNavOpen = ref(false)
const serviceState = ref('checking')
const mainElement = ref(null)
const menuButton = ref(null)
const drawerElement = ref(null)
const sourceDetailsOpen = ref(false)
const appRoot = ref(null)
const sourceContext = useSourceContext()
let mounted = true
let previousBodyOverflow = ''
const motion = useCampusPulseMotion(appRoot)
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh, en) => isEnglish.value ? en : zh
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'

const currentNavId = computed(() => route.meta.navId || '')
const routeTitle = computed(() => route.meta.title || 'CampusPulse')
const sourceState = sourceContext.sourceState
const readonly = computed(() => serviceState.value === 'unavailable' || sourceState.value.availability.access !== 'interactive')
const documentTitle = computed(() => `${translateInterfaceText(String(route.meta.documentTitle || route.meta.title || 'CampusPulse'))} · CampusPulse`)

provide(productShellContextKey, { serviceState, sourceState, sourceProblem: sourceContext.problem, readonly })

async function refreshHealth() {
  serviceState.value = 'checking'
  try {
    await getWorkbenchHealth()
    if (mounted) {
      serviceState.value = 'available'
      sourceContext.publishBackendAvailability('available')
    }
  } catch {
    if (mounted) {
      serviceState.value = 'unavailable'
      sourceContext.publishBackendAvailability('unavailable')
    }
  }
}

async function openDrawer() {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  mobileNavOpen.value = true
  await nextTick()
  drawerElement.value?.querySelector('a')?.focus()
}

function closeDrawer({ restoreFocus = true } = {}) {
  if (!mobileNavOpen.value) return
  mobileNavOpen.value = false
  document.body.style.overflow = previousBodyOverflow
  if (restoreFocus) nextTick(() => menuButton.value?.$el?.focus())
}

function handleDrawerKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDrawer()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = [...drawerElement.value.querySelectorAll('a,button:not([disabled])')]
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleMobileNavigate() {
  closeDrawer({ restoreFocus: false })
}

watch(() => route.fullPath, (nextPath) => {
  sourceContext.beginSourceRoute(nextPath, route.meta.source)
  if (serviceState.value !== 'checking') {
    sourceContext.publishBackendAvailability(serviceState.value)
  }
})

watch(() => route.path, async (nextPath, previousPath) => {
  if (!previousPath || nextPath === previousPath) return
  closeDrawer({ restoreFocus: false })
  await nextTick()
  mainElement.value?.focus()
  motion.playPageIntro()
})

watch([() => route.fullPath, currentLocale], () => {
  document.title = documentTitle.value
}, { immediate: true })

sourceContext.beginSourceRoute(route.fullPath, route.meta.source)
useCampusPulseDomLocalization(appRoot)

watch(mobileNavOpen, (open) => {
  if (!open) document.body.style.overflow = previousBodyOverflow
})

onMounted(() => {
  document.body.classList.add('campus-pulse-product-active')
  if (!publicDemo) refreshHealth()
})

onBeforeUnmount(() => {
  mounted = false
  document.body.classList.remove('campus-pulse-product-active')
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <div ref="appRoot" class="campus-pulse-app" :class="{ 'campus-pulse-app--public': publicDemo }">
    <a class="cp-skip-link" href="#main-content">跳到主要内容</a>

    <aside class="product-sidebar" aria-label="CampusPulse 产品导航">
      <RouterLink class="product-brand" to="/campus-pulse" aria-label="CampusPulse 校园论坛模拟器">
        <span class="product-brand__mark" aria-hidden="true"><i class="fa-solid fa-wave-square" /></span>
        <span class="product-brand__text"><strong>CampusPulse</strong><small>校园论坛数字孪生</small></span>
      </RouterLink>
      <ProductNav :items="productNavigation" :current-id="currentNavId" />
      <div class="product-sidebar__footer">
        <span><i class="fa-solid fa-shield-halved" aria-hidden="true" /> {{ l('案例资料', 'CASE MATERIALS') }}</span>
        <p>{{ l('校园论坛模拟与治理案例展示', 'Campus forum simulation and governance case showcase') }}</p>
      </div>
    </aside>

    <div class="product-stage" :inert="mobileNavOpen || undefined">
      <header class="product-topbar">
        <CpIconButton ref="menuButton" class="product-topbar__menu" label="打开主导航" :expanded="mobileNavOpen" controls="mobile-navigation" @click="openDrawer">
          <i class="fa-solid fa-bars" aria-hidden="true" />
        </CpIconButton>
        <div class="product-topbar__context">
          <span class="product-topbar__eyebrow">{{ l('校园治理预演台', 'CAMPUSPULSE CONTROL DESK') }}</span>
          <span class="product-topbar__separator" aria-hidden="true" />
          <strong>{{ routeTitle }}</strong>
        </div>
        <span v-if="publicDemo" class="product-topbar__showcase"><i class="fa-solid fa-book-open" aria-hidden="true" /> {{ l('公开展示', 'SHOWCASE') }}</span>
        <span v-else class="product-topbar__live"><i class="fa-solid fa-circle" aria-hidden="true" /> {{ l('本机运行', 'LOCAL') }}</span>
        <LanguageToggle />
        <RouterLink v-if="!publicDemo" class="product-topbar__provider" to="/campus-pulse/system?tab=provider" :title="l('配置模型连接与访问凭据','Configure the model connection and credentials')">
          <i class="fa-solid fa-key" aria-hidden="true" />
          <span>{{ l('模型连接', 'Model connection') }}</span>
        </RouterLink>
      </header>

      <SourceStatusBar v-if="!publicDemo" :source-state="sourceState" :service-state="serviceState" :problem="sourceContext.problem.value" :details-open="sourceDetailsOpen" @open-details="sourceDetailsOpen = !sourceDetailsOpen" @refresh="refreshHealth" />
      <section v-if="!publicDemo && sourceDetailsOpen" id="source-boundary-details" class="source-detail" aria-label="运行详情">
        <strong>运行详情</strong>
        <span>origin: {{ sourceState.provenance.origin || sourceState.provenance.evidenceId || '未声明' }}</span>
        <span>publication eligible: {{ sourceState.publicationEligible === null ? '未声明' : sourceState.publicationEligible ? '是' : '否' }}</span>
        <button type="button" @click="sourceDetailsOpen = false">关闭</button>
      </section>

      <main id="main-content" ref="mainElement" class="product-main-content" tabindex="-1">
        <div v-if="routeLoading" class="product-route-loading" role="status" aria-live="polite">
          <span class="product-route-loading__label">正在加载 {{ routeTitle }}</span>
          <CpSkeleton :rows="5" />
        </div>
        <slot v-else />
      </main>
      <div class="cp-toast-region" aria-live="polite" aria-atomic="true" />
      <div class="cp-alert-region" role="alert" aria-atomic="true" />
    </div>

    <Teleport to="body">
      <div v-if="mobileNavOpen" class="campus-pulse-portal mobile-navigation-layer">
        <div class="mobile-navigation-backdrop" aria-hidden="true" @click="closeDrawer()" />
        <aside id="mobile-navigation" ref="drawerElement" class="mobile-navigation" role="dialog" aria-modal="true" aria-label="CampusPulse 主导航" @keydown="handleDrawerKeydown">
          <header>
            <strong>CampusPulse</strong>
            <CpIconButton label="关闭主导航" @click="closeDrawer()"><i class="fa-solid fa-xmark" aria-hidden="true" /></CpIconButton>
          </header>
          <ProductNav :items="productNavigation" :current-id="currentNavId" @navigate="handleMobileNavigate" />
          <p>模拟器用于政策预演；合成 Agent 不代表真实学生。</p>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.campus-pulse-app { display:grid; width:100%; height:100dvh; min-height:0; grid-template-columns:var(--cp-sidebar-width) minmax(0,1fr); overflow:hidden; }
.cp-skip-link { position:fixed; top:var(--cp-space-2); left:var(--cp-space-2); z-index:var(--cp-z-skip-link); padding:var(--cp-space-2) var(--cp-space-3); border-radius:var(--cp-radius-sm); background:var(--color-white); color:var(--color-black); font-weight:700; transform:translateY(-160%); }
.cp-skip-link:focus { transform:translateY(0); }
.product-sidebar { position:relative; z-index:var(--cp-z-shell); display:flex; min-width:0; flex-direction:column; border-right:1px solid var(--cp-border-graphite); background:var(--cp-canvas-obsidian); color:var(--cp-text-inverse); }
.product-brand { display:flex; min-height:4.5rem; align-items:center; gap:var(--cp-space-3); padding:0 var(--cp-space-4); border-bottom:1px solid rgba(255,255,255,.08); color:var(--cp-text-inverse); text-decoration:none; }
.product-brand:hover { text-decoration:none; }
.product-brand__mark { display:grid; width:2.35rem; height:2.35rem; flex:none; place-items:center; border:1px solid #dc3159; border-radius:var(--cp-radius-md); background:var(--cp-accent-crimson); color:var(--cp-text-inverse); font-size:.9rem; }
.product-brand__text { display:grid; line-height:1.15; }
.product-brand__text strong { font-size:1rem; letter-spacing:.01em; }
.product-brand__text small { margin-top:.2rem; color:#9f9a98; font-size:.66rem; letter-spacing:.06em; }
.product-sidebar__footer { margin:auto var(--cp-space-3) var(--cp-space-4); padding:var(--cp-space-3); border-top:1px solid var(--cp-border-graphite); color:var(--cp-text-warm-muted); }
.product-sidebar__footer span { display:flex; align-items:center; gap:var(--cp-space-2); color:#d6c8a1; font-size:.68rem; font-weight:700; letter-spacing:.08em; }
.product-sidebar__footer p { margin:var(--cp-space-2) 0 0; color:#96918f; font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.product-stage { position:relative; isolation:isolate; display:grid; min-width:0; min-height:0; grid-template-rows:auto auto auto minmax(0,1fr); overflow:hidden; background:var(--cp-surface-canvas); }
.product-topbar { display:flex; min-height:4.5rem; align-items:center; gap:var(--cp-space-3); padding:0 var(--cp-content-gutter); border-bottom:1px solid var(--cp-border-graphite); background:var(--cp-surface-charcoal); color:var(--cp-text-warm); }
.product-topbar__menu { display:none; }
.product-topbar__context { display:flex; min-width:0; align-items:center; gap:var(--cp-space-3); }
.product-topbar__eyebrow { color:var(--cp-text-warm-muted); font-size:.63rem; font-weight:700; letter-spacing:.11em; }
.product-topbar__separator { width:1px; height:1rem; background:var(--cp-border-graphite); }
.product-topbar__context strong { overflow:hidden; font-size:var(--cp-text-md); text-overflow:ellipsis; white-space:nowrap; }
.product-topbar__context { flex:1; }
.product-topbar__live { display:inline-flex; align-items:center; gap:.38rem; padding:.35rem .55rem; border:1px solid #355746; border-radius:999px; background:#18251e; color:#8ac9a2; font-size:.62rem; font-weight:800; letter-spacing:.09em; }
.product-topbar__live i { font-size:.38rem; }
.product-topbar__showcase { display:inline-flex; align-items:center; gap:.4rem; padding:.35rem .55rem; border:1px solid #d9d2ce; border-radius:999px; background:#faf8f7; color:#70666a; font-size:.62rem; font-weight:800; letter-spacing:.08em; }
.product-topbar__provider { display:inline-flex; min-height:2.25rem; align-items:center; gap:.45rem; padding:0 .7rem; border:1px solid #49343c; border-radius:var(--cp-radius-sm); background:var(--cp-surface-charcoal-raised); color:var(--cp-text-warm); font-size:var(--cp-text-xs); font-weight:700; text-decoration:none; }
.product-topbar__provider:hover { border-color:var(--cp-accent-crimson); color:var(--cp-text-warm); text-decoration:none; }
.product-topbar__provider i { color:#e24a6d; }
.product-topbar :deep(.language-toggle) { border-color:var(--cp-border-graphite); background:var(--cp-surface-charcoal-raised); box-shadow:none; }
.product-topbar :deep(.language-toggle button) { color:var(--cp-text-warm-muted); }
.product-topbar :deep(.language-toggle button.active) { background:#2a2024; color:var(--cp-text-warm); box-shadow:none; }
.product-stage :deep(.source-status-bar) { border-bottom-color:var(--cp-border-graphite); background:#110e0f; }
.product-stage :deep(.source-status-bar__actions button) { border-color:var(--cp-border-graphite); background:var(--cp-surface-charcoal); color:var(--cp-text-warm); }
.source-detail { display:flex; align-items:center; gap:var(--cp-space-3); padding:var(--cp-space-2) var(--cp-content-gutter); border-bottom:1px solid var(--cp-evidence); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); font-size:var(--cp-text-xs); }
.source-detail span:nth-of-type(1) { min-width:0; flex:1; }
.source-detail button { min-height:2rem; padding:0 var(--cp-space-2); border:1px solid var(--cp-evidence); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.product-main-content { min-width:0; min-height:0; overflow:auto; overscroll-behavior:contain; background:var(--cp-surface-canvas); }
.product-main-content > :deep(*) { will-change:opacity,transform; }
.product-main-content:focus { outline-offset:-3px; }
.campus-pulse-app--public .product-stage { grid-template-rows:auto minmax(0,1fr); background:#fff; }
.campus-pulse-app--public .product-topbar { border-bottom-color:#e4dfdc; background:#fff; color:#2c2628; }
.campus-pulse-app--public .product-topbar__eyebrow { color:#8b8084; }
.campus-pulse-app--public .product-topbar__separator { background:#ddd7d3; }
.campus-pulse-app--public .product-main-content { background:#fff; }
.campus-pulse-app--public .product-topbar :deep(.language-toggle) { border-color:#ded8d4; background:#f7f5f3; }
.campus-pulse-app--public .product-topbar :deep(.language-toggle button) { color:#766c70; }
.campus-pulse-app--public .product-topbar :deep(.language-toggle button.active) { background:#fff; color:#2c2628; }
.product-route-loading { max-width:72rem; margin:0 auto; padding:var(--cp-space-6) var(--cp-content-gutter); }
.product-route-loading__label { display:block; margin-bottom:var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.mobile-navigation-layer { position:fixed; inset:0; z-index:var(--cp-z-drawer-backdrop); }
.mobile-navigation-backdrop { position:absolute; inset:0; background:var(--cp-overlay); }
.mobile-navigation { position:absolute; inset:0 auto 0 0; z-index:var(--cp-z-drawer); display:flex; width:min(20rem,88vw); flex-direction:column; border-right:1px solid var(--cp-border-inverse); background:var(--cp-surface-inverse); color:var(--cp-text-inverse); box-shadow:var(--cp-shadow-drawer); }
.mobile-navigation header { display:flex; min-height:var(--cp-topbar-height); align-items:center; justify-content:space-between; padding:0 var(--cp-space-3) 0 var(--cp-space-4); border-bottom:1px solid var(--cp-border-inverse); }
.mobile-navigation p { margin:auto var(--cp-space-4) var(--cp-space-4); color:var(--neutral-light-brand-ref); font-size:var(--cp-text-xs); }
@media (max-width:1439px) and (min-width:1024px) { .campus-pulse-app { grid-template-columns:var(--cp-sidebar-compact-width) minmax(0,1fr); } .product-brand { justify-content:center; padding:0; } .product-brand__text,.product-sidebar__footer { display:none; } .product-sidebar :deep(.product-nav) { display:grid; } .product-sidebar :deep(.product-nav__link) { justify-content:center; padding-inline:0; } .product-sidebar :deep(.product-nav__copy) { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; } .product-sidebar :deep(.product-nav__link::after) { position:absolute; left:calc(100% + .5rem); z-index:3; display:none; padding:.35rem .5rem; border:1px solid var(--cp-border-inverse); border-radius:var(--cp-radius-sm); background:var(--cp-surface-inverse); color:var(--cp-text-inverse); content:attr(data-label); font-size:var(--cp-text-xs); white-space:nowrap; } .product-sidebar :deep(.product-nav__link:is(:hover,:focus-visible)::after) { display:block; } }
@media (max-width:1023px) { .campus-pulse-app { grid-template-columns:minmax(0,1fr); } .product-sidebar { display:none; } .product-topbar__menu { display:inline-grid; } }
@media (max-width:767px) { .product-topbar { min-height:var(--cp-topbar-height); padding-inline:var(--cp-space-2) var(--cp-space-4); } .product-topbar__context { display:grid; gap:0; } .product-topbar__eyebrow,.product-topbar__separator,.product-topbar__live,.product-topbar__showcase { display:none; } .product-topbar__provider { width:var(--cp-touch-target); min-width:var(--cp-touch-target); height:var(--cp-touch-target); justify-content:center; padding:0; } .product-topbar__provider span { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; } .source-detail { align-items:flex-start; flex-wrap:wrap; padding-inline:var(--cp-space-4); } .source-detail span:nth-of-type(1) { min-width:100%; } .source-detail button { min-height:var(--cp-touch-target); } .product-route-loading { padding:var(--cp-space-4); } }
</style>
