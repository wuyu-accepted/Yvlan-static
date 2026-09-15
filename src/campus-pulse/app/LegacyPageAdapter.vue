<template>
  <div class="legacy-page-adapter" data-cp-motion-page><slot /></div>
</template>

<style scoped>
.legacy-page-adapter { width:100%; min-width:0; min-height:100%; background:var(--cp-surface-canvas); }
.legacy-page-adapter :deep(.product-page),
.legacy-page-adapter :deep(.forum-page),
.legacy-page-adapter :deep(.workbench-page) {
  display:block !important;
  width:100%;
  height:auto !important;
  min-height:100% !important;
  overflow:visible !important;
}
.legacy-page-adapter :deep(.product-main),
.legacy-page-adapter :deep(.results-main),
.legacy-page-adapter :deep(.system-main),
.legacy-page-adapter :deep(.forum-shell),
.legacy-page-adapter :deep(.workbench-main) {
  width:100%;
  min-width:0;
  min-height:0;
}
</style>
