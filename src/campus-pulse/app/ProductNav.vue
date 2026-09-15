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
.product-nav__link { position:relative; display:flex; min-height:3.55rem; align-items:center; gap:var(--cp-space-3); padding:0 var(--cp-space-3); border:1px solid transparent; border-radius:var(--cp-radius-md); color:var(--cp-text-inverse-muted); font-size:var(--cp-text-md); font-weight:600; text-decoration:none; transition:background-color var(--cp-motion-standard) ease,border-color var(--cp-motion-standard) ease,color var(--cp-motion-standard) ease; }
.product-nav__link:hover { border-color:var(--cp-border-graphite); background:var(--cp-surface-charcoal-raised); color:var(--cp-text-inverse); text-decoration:none; }
.product-nav__link--active { border-color:#3a2930; background:#24171c; color:var(--cp-text-inverse); }
.product-nav__active-rail { position:absolute; inset:.65rem auto .65rem -1px; width:3px; border-radius:var(--cp-radius-xs); background:transparent; }
.product-nav__link--active .product-nav__active-rail { background:var(--cp-accent-crimson); }
.product-nav__icon { display:grid; width:1.75rem; height:1.75rem; flex:none; place-items:center; border-radius:var(--cp-radius-sm); color:var(--cp-text-inverse-muted); text-align:center; }
.product-nav__link--active .product-nav__icon { color:var(--cp-text-inverse); }
.product-nav__copy { display:grid; min-width:0; gap:1px; }
.product-nav__copy small { overflow:hidden; color:#999; font-size:.64rem; font-weight:500; letter-spacing:.015em; text-overflow:ellipsis; white-space:nowrap; }
.product-nav__link--active .product-nav__copy small { color:#cbbec1; }
.product-nav--compact .product-nav__link { justify-content:center; padding-inline:0; }
.product-nav--compact .product-nav__copy { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.product-nav--compact .product-nav__link::after { position:absolute; left:calc(100% + .5rem); z-index:3; display:none; padding:.35rem .5rem; border:1px solid var(--cp-border-inverse); border-radius:var(--cp-radius-sm); background:var(--cp-surface-inverse); color:var(--cp-text-inverse); content:attr(data-label); font-size:var(--cp-text-xs); white-space:nowrap; }
.product-nav--compact .product-nav__link:is(:hover,:focus-visible)::after { display:block; }
</style>
