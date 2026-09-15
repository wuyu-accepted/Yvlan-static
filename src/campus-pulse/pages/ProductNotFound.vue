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
.product-not-found { min-height:100%; padding:var(--cp-space-6) var(--cp-content-gutter); }
@media (max-width:767px) { .product-not-found { padding:var(--cp-space-4); } }
</style>
