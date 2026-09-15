<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ProductShell from './campus-pulse/app/ProductShell.vue'
import LegacyPageAdapter from './campus-pulse/app/LegacyPageAdapter.vue'
import { productRouteLoading } from './campus-pulse/app/routeProgress'
import ThemeToggle from './components/ThemeToggle.vue'

const route = useRoute()
const usesProductShell = computed(() => route.meta.productShell === true)
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'
</script>

<template>
  <div class="app" :class="{ 'public-demo-theme': publicDemo }">
    <aside v-if="publicDemo" class="public-demo-notice" role="status">
      公开成果展示 · 内容来自脱敏、哈希校验的封存案例
    </aside>
    <ThemeToggle v-if="!usesProductShell && route.meta.standaloneCover !== true" class="global-theme-toggle" />
    <router-view v-slot="{ Component }">
      <ProductShell v-if="usesProductShell" :route-loading="productRouteLoading">
        <LegacyPageAdapter>
          <component :is="Component" />
        </LegacyPageAdapter>
      </ProductShell>
      <transition v-else name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
.app {
  min-height: 100vh;
  background-color: var(--bg-color);
  position: relative;
}

.public-demo-notice {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 10000;
  max-width: min(34rem, calc(100vw - 2rem));
  padding: .65rem .9rem;
  border: 1px solid #ded8d4;
  border-radius: .75rem;
  background: rgba(255, 255, 255, .96);
  color: #3e3639;
  box-shadow: 0 .75rem 2rem rgba(38, 30, 33, .12);
  font-size: .78rem;
  line-height: 1.5;
  backdrop-filter: blur(12px);
}

/* 全局滚动条样式 */
:root {
  --scrollbar-width: 4px;
  --scrollbar-track: transparent;
  --scrollbar-thumb: rgba(128, 128, 128, 0.3);
  --scrollbar-thumb-hover: rgba(128, 128, 128, 0.5);
}

/* WebKit/Blink (Chrome, Safari, Edge) */
::-webkit-scrollbar {
  width: var(--scrollbar-width);
  height: var(--scrollbar-width);
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb);
  border-radius: 4px;
  transition: background-color 0.3s;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-thumb-hover);
}

/* 完全隐藏滚动条箭头 */
::-webkit-scrollbar-button {
  width: 0;
  height: 0;
  display: none;
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* 平滑滚动效果 */
html {
  scroll-behavior: smooth;
}

/* 亮色主题下的滚动条调整 */
.light-theme {
  --scrollbar-thumb: rgba(0, 0, 0, 0.2);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.3);
}

.global-theme-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  gap: 10px;
  padding: 6px;
  background-color: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  border-radius: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.light-theme .global-btn {
  background-color: rgba(255, 255, 255, 0.6);
}

.button-area {
  display: flex;
  justify-content: flex-end;
  height: 100px;
  position: absolute;
  bottom: 25px;
  right: 25px;
}

.button-area button {
  padding: 10px 20px;
  border: none;
  border-radius: 30px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  display: flex;
  align-items: center;
}

.button-area button i {
  margin-right: 8px;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
