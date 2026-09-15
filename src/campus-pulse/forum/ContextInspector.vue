<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { ForumInspectorTab } from './forumWorkspaceState.ts'

const props = defineProps<{
  open: boolean
  tab: ForumInspectorTab
  selectionLabel: string
}>()

const emit = defineEmits<{
  close: []
  changeTab: [tab: ForumInspectorTab]
}>()

const heading = ref<HTMLHeadingElement | null>(null)
let previouslyFocused: HTMLElement | null = null
watch(() => [props.open, props.tab] as const, async ([open]) => {
  if (open) {
    previouslyFocused = document.activeElement as HTMLElement | null
    await nextTick()
    heading.value?.focus()
  } else if (previouslyFocused) {
    previouslyFocused.focus?.()
    previouslyFocused = null
  }
})

const tabs: Array<{ key: ForumInspectorTab; label: string }> = [
  { key: 'thread', label: '讨论串' },
  { key: 'claim', label: 'Claim' },
  { key: 'agent', label: 'Agent' },
  { key: 'governance', label: '治理' },
  { key: 'evidence', label: '证据' },
]

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    event.preventDefault()
    emit('close')
  }
}
</script>

<template>
  <aside
    class="context-inspector"
    :class="{ open }"
    role="dialog"
    aria-label="调查对象 Inspector"
    @keydown="onKeydown"
  >
    <header class="inspector-head">
      <div>
        <h3 ref="heading" tabindex="-1">{{ selectionLabel }}</h3>
      </div>
      <button type="button" class="close" aria-label="关闭 Inspector" @click="emit('close')">×</button>
    </header>

    <nav class="inspector-tabs" role="tablist" aria-label="Inspector 标签">
      <button
        v-for="item in tabs"
        :key="item.key"
        type="button"
        role="tab"
        :aria-selected="tab === item.key"
        :class="{ active: tab === item.key }"
        @click="emit('changeTab', item.key)"
      >{{ item.label }}</button>
    </nav>

    <div v-if="open" class="inspector-body" role="tabpanel">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.context-inspector { display:flex; flex-direction:column; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); min-width:0; }
.inspector-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-2); padding:var(--cp-space-3) var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.inspector-head p { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; letter-spacing:.06em; }
.inspector-head h3 { margin:var(--cp-space-1) 0 0; font-size:var(--cp-text-md); word-break:break-all; }
.close { flex:none; width:2rem; height:2rem; border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-secondary); font-size:var(--cp-text-lg); line-height:1; cursor:pointer; }
.inspector-tabs { display:flex; flex-wrap:wrap; gap:0; padding:var(--cp-space-2) var(--cp-space-3) 0; border-bottom:1px solid var(--cp-border-default); }
.inspector-tabs button { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:0; border-bottom:2px solid transparent; background:none; color:var(--cp-text-secondary); font-weight:600; cursor:pointer; }
.inspector-tabs button.active { border-bottom-color:var(--cp-action-primary); color:var(--cp-action-primary); }
.inspector-body { padding:var(--cp-space-4); overflow-y:auto; min-height:8rem; }
@media (max-width:1023px) and (min-width:768px) {
  .context-inspector { position:fixed; top:0; right:0; bottom:0; width:min(92vw,26rem); z-index:var(--cp-z-drawer); box-shadow:var(--cp-shadow-drawer); transform:translateX(105%); transition:transform var(--cp-motion-standard) ease; }
  .context-inspector.open { transform:translateX(0); }
}
@media (max-width:767px) {
  .context-inspector { position:fixed; inset:0; z-index:var(--cp-z-drawer); transform:translateY(105%); transition:transform var(--cp-motion-standard) ease; }
  .context-inspector.open { transform:translateY(0); }
  .inspector-body { flex:1 1 auto; }
}
</style>
