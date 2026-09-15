<script setup>
defineProps({
  tone: {
    type: String,
    default: 'model',
  },
  label: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <span class="evidence-badge" :data-tone="tone">
    <span class="badge-dot" />
    {{ label }}
  </span>
</template>

<style scoped>
.evidence-badge {
  --badge-color: #f4bc6a;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--badge-color) 32%, transparent);
  border-radius: 999px;
  color: var(--badge-color);
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 700;
  gap: 0.42rem;
  letter-spacing: 0.04em;
  padding: 0.36rem 0.68rem;
  white-space: nowrap;
}

.evidence-badge[data-tone='observed'] {
  --badge-color: #71e0bc;
}

.evidence-badge[data-tone='review'] {
  --badge-color: #a995ff;
}

.evidence-badge[data-tone='offline'] {
  --badge-color: #ff9e86;
}

.badge-dot {
  background: currentColor;
  border-radius: 50%;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);
  height: 0.38rem;
  width: 0.38rem;
}
</style>
