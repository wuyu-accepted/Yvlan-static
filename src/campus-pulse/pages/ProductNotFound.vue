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
.product-not-found { --cp-surface-default:#fff; --cp-surface-subtle:#f7f5f3; --cp-text-primary:#2c2628; --cp-text-secondary:#6f6569; --cp-text-muted:#8c8185; --cp-border-default:#ded8d4; --cp-border-strong:#bdb4b0; --cp-action-primary:#b20f3d; min-height:calc(100dvh - var(--cp-topbar-height)); padding:var(--cp-space-6) var(--cp-content-gutter); background:#fff; color:var(--cp-text-primary); color-scheme:light; }
@media (max-width:767px) { .product-not-found { padding:var(--cp-space-4); } }
</style>
