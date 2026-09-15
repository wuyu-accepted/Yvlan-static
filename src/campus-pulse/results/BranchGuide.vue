<script setup lang="ts">
import { computed } from 'vue'
import { currentLocale } from '../i18n/locale.ts'
import { branchPresentation, type GovernanceBranchId } from './branchPresentation.ts'

const props=withDefaults(defineProps<{resultKey:string;branches?:GovernanceBranchId[]}>(),{branches:()=>['Natural','D']})
const isEnglish=computed(()=>currentLocale.value==='en-US')
const items=computed(()=>props.branches.map(id=>branchPresentation(props.resultKey,id,isEnglish.value)))
const title=computed(()=>isEnglish.value?'What do these response plans mean?':'这些治理方案是什么意思？')
const intro=computed(()=>isEnglish.value?'Names explain the action; letters remain only as experiment identifiers.':'名称说明方案做了什么；字母只保留为实验和证据编号。')
const codeLabel=(id:GovernanceBranchId)=>id==='Natural'?'Natural':isEnglish.value?`Plan ${id}`:`方案 ${id}`
const actionLabel=computed(()=>isEnglish.value?'Details':'查看说明')
</script>

<template>
  <details class="branch-guide">
    <summary>
      <div class="branch-guide__heading"><span>{{ title }}</span><small>{{ intro }}</small></div>
      <div class="branch-guide__preview" aria-hidden="true">
        <span v-for="item in items" :key="item.id" :class="`branch-${item.id.toLowerCase()}`"><i />{{ item.shortName }}<code>{{ codeLabel(item.id) }}</code></span>
      </div>
      <b>{{ actionLabel }}<i class="fa-solid fa-chevron-down" aria-hidden="true" /></b>
    </summary>
    <div class="branch-guide__items">
      <article v-for="item in items" :key="item.id" :class="`branch-${item.id.toLowerCase()}`">
        <i aria-hidden="true" />
        <div><strong>{{ item.name }}</strong><p>{{ item.description }}</p></div>
        <code>{{ codeLabel(item.id) }}</code>
      </article>
    </div>
  </details>
</template>

<style scoped>
.branch-guide{border:1px solid var(--cp-border-default);border-radius:var(--cp-radius-sm);background:var(--cp-surface-default)}
.branch-guide summary{display:grid;grid-template-columns:minmax(15rem,.8fr) minmax(20rem,1.2fr) auto;align-items:center;gap:var(--cp-space-3);padding:var(--cp-space-2) var(--cp-space-3);cursor:pointer;list-style:none}.branch-guide summary::-webkit-details-marker{display:none}.branch-guide__heading{display:grid;gap:.1rem}.branch-guide__heading>span{font-size:var(--cp-text-sm);font-weight:780}.branch-guide__heading small{color:var(--cp-text-muted);font-size:var(--cp-text-xs)}
.branch-guide__preview{display:flex;min-width:0;flex-wrap:wrap;gap:var(--cp-space-1)}.branch-guide__preview>span{--branch:#777b82;display:flex;align-items:center;gap:.35rem;padding:.3rem .5rem;border:1px solid var(--cp-border-subtle);border-radius:999px;background:var(--cp-surface-subtle);color:var(--cp-text-secondary);font-size:.68rem;font-weight:700}.branch-guide__preview .branch-a{--branch:#b48a45}.branch-guide__preview .branch-b{--branch:#32745a}.branch-guide__preview .branch-c{--branch:#356b86}.branch-guide__preview .branch-d{--branch:var(--cp-action-primary)}.branch-guide__preview i{width:.38rem;height:.38rem;border-radius:50%;background:var(--branch)}.branch-guide__preview code{color:var(--branch);font-size:.62rem}.branch-guide summary>b{display:flex;align-items:center;gap:.4rem;color:var(--cp-action-primary);font-size:var(--cp-text-xs);white-space:nowrap}.branch-guide summary>b i{transition:transform .18s ease}.branch-guide[open] summary>b i{transform:rotate(180deg)}
.branch-guide[open] summary{border-bottom:1px solid var(--cp-border-default)}.branch-guide[open] .branch-guide__preview{opacity:.58}.branch-guide__items{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:var(--cp-space-2);padding:var(--cp-space-3)}
.branch-guide article{--branch:#777b82;display:grid;grid-template-columns:.35rem minmax(0,1fr) auto;gap:var(--cp-space-2);padding:var(--cp-space-3);border:1px solid var(--cp-border-subtle);background:var(--cp-surface-subtle)}.branch-guide article.branch-a{--branch:#b48a45}.branch-guide article.branch-b{--branch:#32745a}.branch-guide article.branch-c{--branch:#356b86}.branch-guide article.branch-d{--branch:var(--cp-action-primary)}.branch-guide article>i{background:var(--branch)}.branch-guide strong{font-size:var(--cp-text-sm)}.branch-guide p{margin:.25rem 0 0;color:var(--cp-text-secondary);font-size:var(--cp-text-xs);line-height:1.5}.branch-guide code{align-self:start;padding:.2rem .4rem;border:1px solid var(--cp-border-default);background:var(--cp-surface-default);color:var(--branch);font-size:var(--cp-text-xs);font-weight:750}
@media(max-width:1023px){.branch-guide summary{grid-template-columns:minmax(14rem,.8fr) minmax(0,1.2fr)}.branch-guide summary>b{grid-column:2;grid-row:1;justify-self:end}.branch-guide__preview{grid-column:1/-1}}
@media(max-width:767px){.branch-guide summary{grid-template-columns:minmax(0,1fr) auto}.branch-guide summary>b{grid-column:2;grid-row:1}.branch-guide__preview{display:none}}
</style>
