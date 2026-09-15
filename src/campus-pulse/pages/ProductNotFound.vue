<script setup>
import { useRouter } from 'vue-router'
import CpStatePanel from '../components/CpStatePanel.vue'

const router = useRouter()
</script>

<template>
  <div class="product-not-found">
    <CpStatePanel
      variant="not-found"
      title="找不到这个产品页面"
      detail="该地址不属于当前 CampusPulse 产品路由。你可以返回总览，或前往结果中心继续查证。"
      primary-label="返回产品总览"
      secondary-label="前往结果中心"
      @primary="router.push('/campus-pulse')"
      @secondary="router.push('/campus-pulse/results')"
    />
  </div>
</template>

<style scoped>
.product-not-found { --cp-surface-default:var(--cp-surface-charcoal); --cp-surface-subtle:var(--cp-surface-charcoal-raised); --cp-text-primary:var(--cp-text-warm); --cp-text-secondary:var(--cp-text-warm-muted); --cp-text-muted:var(--cp-text-warm-muted); --cp-border-default:var(--cp-border-graphite); --cp-border-strong:color-mix(in srgb,var(--cp-text-warm-muted) 58%,var(--cp-border-graphite)); --cp-action-primary:var(--cp-accent-crimson); min-height:calc(100dvh - var(--cp-topbar-height) - var(--cp-sourcebar-min-height)); padding:var(--cp-space-6) var(--cp-content-gutter); background:var(--cp-canvas-obsidian); color:var(--cp-text-primary); color-scheme:dark; }
@media (max-width:767px) { .product-not-found { padding:var(--cp-space-4); } }
</style>
