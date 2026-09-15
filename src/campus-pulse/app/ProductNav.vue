<script setup>
defineProps({
  items: { type: Array, required: true },
  currentId: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
defineEmits(['navigate'])
</script>

<template>
  <nav class="product-nav" :class="{ 'product-nav--compact': compact }" aria-label="CampusPulse 主导航">
    <RouterLink
      v-for="item in items"
      :key="item.id"
      class="product-nav__link"
      :class="{ 'product-nav__link--active': item.id === currentId }"
      :to="item.to"
      :aria-current="item.id === currentId ? 'page' : undefined"
      :data-label="item.label"
      :title="compact ? item.label : undefined"
      @click="$emit('navigate', item)"
    >
      <span class="product-nav__active-rail" aria-hidden="true" />
      <i class="fa-solid product-nav__icon" :class="item.icon" aria-hidden="true" />
      <span class="product-nav__copy">
        <span class="product-nav__label">{{ item.label }}</span>
        <small>{{ item.description }}</small>
      </span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.product-nav { display:grid; gap:var(--cp-space-1); padding:var(--cp-space-3) var(--cp-space-2); }
.product-nav__link { position:relative; display:flex; min-height:3.55rem; align-items:center; gap:var(--cp-space-3); padding:0 var(--cp-space-3); border:1px solid transparent; border-radius:var(--cp-radius-md); color:var(--cp-text-inverse-muted); font-size:var(--cp-text-md); font-weight:600; text-decoration:none; transition:background var(--cp-motion-standard) ease,border-color var(--cp-motion-standard) ease,transform var(--cp-motion-standard) ease; }
.product-nav__link:hover { border-color:rgba(255,255,255,.08); background:rgba(255,255,255,.055); color:var(--cp-text-inverse); text-decoration:none; transform:translateX(2px); }
.product-nav__link--active { border-color:rgba(174,11,42,.34); background:linear-gradient(100deg,rgba(174,11,42,.26),rgba(174,11,42,.08)); color:var(--cp-text-inverse); }
.product-nav__active-rail { position:absolute; inset:.65rem auto .65rem -.05rem; width:3px; border-radius:99px; background:transparent; }
.product-nav__link--active .product-nav__active-rail { background:var(--brand-red); box-shadow:0 0 16px rgba(174,11,42,.65); }
.product-nav__icon { display:grid; width:1.75rem; height:1.75rem; flex:none; place-items:center; border-radius:8px; background:rgba(255,255,255,.055); text-align:center; }
.product-nav__copy { display:grid; min-width:0; gap:1px; }
.product-nav__copy small { overflow:hidden; color:#999; font-size:.64rem; font-weight:500; letter-spacing:.015em; text-overflow:ellipsis; white-space:nowrap; }
.product-nav__link--active .product-nav__copy small { color:#cbbec1; }
.product-nav--compact .product-nav__link { justify-content:center; padding-inline:0; }
.product-nav--compact .product-nav__copy { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.product-nav--compact .product-nav__link::after { position:absolute; left:calc(100% + .5rem); z-index:3; display:none; padding:.35rem .5rem; border:1px solid var(--cp-border-inverse); border-radius:var(--cp-radius-sm); background:var(--cp-surface-inverse); color:var(--cp-text-inverse); content:attr(data-label); font-size:var(--cp-text-xs); white-space:nowrap; }
.product-nav--compact .product-nav__link:is(:hover,:focus-visible)::after { display:block; }
</style>
