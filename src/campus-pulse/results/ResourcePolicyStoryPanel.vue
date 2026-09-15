<script setup lang="ts">
import { computed } from 'vue'
import type { ResourcePolicyBranchSummary, ResourcePolicyStory } from '../../services/forumTwin.ts'
import ResourcePrivateChannelPanel from './ResourcePrivateChannelPanel.vue'
import { isEnglish } from '../i18n/locale.ts'
import ContentTranslation from '../i18n/ContentTranslation.vue'
import { branchDisplayName } from './branchPresentation.ts'

const props = defineProps<{ story: ResourcePolicyStory }>()

const natural = computed(() => props.story.branchSummaries.find((item) => item.branch === 'natural'))
const explanation = computed(() => props.story.branchSummaries.find((item) => item.branch === 'A'))
const intervention = computed(() => props.story.branchSummaries.find((item) => item.branch === 'D'))
const storyTitle = computed(() => isEnglish.value
  ? `When summer housing beds drop from ${props.story.scenarioFacts.bedsBefore} to ${props.story.scenarioFacts.bedsAfter}`
  : `当暑期宿舍床位从 ${props.story.scenarioFacts.bedsBefore} 个降到 ${props.story.scenarioFacts.bedsAfter} 个`)
const storyLede = computed(() => isEnglish.value
  ? `${props.story.scenarioFacts.validApplications} valid applications compete for limited beds, but the notice does not clearly explain cross-category and within-category ranking, who reviews supporting materials, the appeal channel, or response deadlines. The same synthetic campus-forum Agents enter three parallel worlds after sharing the same history.`
  : `${props.story.scenarioFacts.validApplications} 份有效申请竞争有限床位，但公告没有说清${props.story.scenarioFacts.announcementGaps.join('、')}。我们让同一批合成校园论坛 Agent 在共享历史之后进入三个平行世界。`)
const primaryFinding = computed(() => isEnglish.value
  ? 'Explaining the rules produced evidence cards, but residents did not directly take up any governance message. Adding review tickets created two strict service-closure chains, yet trust did not rise because scarcity and unresolved handling became more visible.'
  : props.story.primaryFinding)

const branchCards = computed(() => [
  {
    id: 'natural', eyebrow: isEnglish.value?'Parallel world 1':'平行世界 1', title: branchDisplayName('resource-policy-r1','Natural',isEnglish.value), value: natural.value,
    conclusion: isEnglish.value?'Discussion continues to spread, and no governance actor receives individual requests for help.':'讨论继续扩散，个体求助没有被任何治理对象承接。',
  },
  {
    id: 'A', eyebrow: isEnglish.value?'Parallel world 2':'平行世界 2', title: branchDisplayName('resource-policy-r1','A',isEnglish.value), value: explanation.value,
    conclusion: isEnglish.value?'Risk reports fall, but explanation alone does not create an actionable individual handling path.':'风险上报明显减少，但解释本身没有形成可执行的个体处理路径。',
  },
  {
    id: 'D', eyebrow: isEnglish.value?'Parallel world 3':'平行世界 3', title: branchDisplayName('resource-policy-r1','D',isEnglish.value), value: intervention.value,
    conclusion: isEnglish.value?'Individual concerns enter review tickets, followed by service receipts and feedback from the same resident.':'居民的具体问题进入复核工单，并出现服务回执与同一居民后续反馈。',
  },
])

function percentage(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(3) : '—'
}

function metric(item: ResourcePolicyBranchSummary | undefined, key: keyof ResourcePolicyBranchSummary) {
  const value = item?.[key]
  return typeof value === 'number' ? value : '—'
}
</script>

<template>
  <section class="story" aria-labelledby="resource-story-title">
    <header class="story__header">
      <div>
        <p class="eyebrow">真实 LLM 校园治理预演 · Tick 0–10</p>
        <h2 id="resource-story-title" data-no-localize>{{ storyTitle }}</h2>
        <p class="lede" data-no-localize>{{ storyLede }}</p>
      </div>
      <dl class="experiment-stamp" aria-label="实验审计摘要">
        <div><dt>语义槽位</dt><dd>{{ story.semanticTurns }}</dd></div>
        <div><dt>模型</dt><dd>{{ story.providerModel }}</dd></div>
        <div><dt>未知结果</dt><dd>{{ story.unknownOutcomes }}</dd></div>
      </dl>
    </header>

    <div class="worlds">
      <article v-for="card in branchCards" :key="card.id" class="world" :class="`world--${card.id}`">
        <p class="eyebrow">{{ card.eyebrow }}</p>
        <h3>{{ card.title }}</h3>
        <p class="world__conclusion">{{ card.conclusion }}</p>
        <dl>
          <div><dt>公开讨论</dt><dd>{{ metric(card.value, 'messages') }} 条</dd></div>
          <div><dt>求助</dt><dd>{{ metric(card.value, 'helpRequests') }} 条</dd></div>
          <div><dt>风险上报</dt><dd>{{ metric(card.value, 'riskReports') }} 条</dd></div>
          <div><dt>严格服务闭环</dt><dd>{{ metric(card.value, 'serviceClosures') }} 条</dd></div>
          <div><dt>Tick 10 信任状态</dt><dd>{{ percentage(card.value?.trust) }}</dd></div>
        </dl>
      </article>
    </div>

    <div class="finding-grid">
      <article class="finding">
        <p class="eyebrow">这次预演真正发现了什么</p>
        <h3>治理不是把舆情曲线压下去，而是把“信息问题”和“个体问题”分开处理</h3>
        <p data-no-localize>{{ primaryFinding }}</p>
        <p class="boundary">这是一场单场景、单 canonical seed 的模型条件实验，不代表现实因果效果或全校民意。</p>
      </article>

      <article v-if="story.closedLoops[0]" class="conversation" aria-labelledby="loop-title">
        <p class="eyebrow">一条可核查的闭环</p>
        <h3 id="loop-title">求助 → 服务回执 → 同一居民反馈</h3>
        <ol>
          <li><span>居民求助</span><p data-content-language="zh" lang="zh-CN">{{ story.closedLoops[0].helpText }}</p><ContentTranslation :text="story.closedLoops[0].helpText" /></li>
          <li><span>服务回执</span><p data-content-language="zh" lang="zh-CN">{{ story.closedLoops[0].receiptText }}</p><ContentTranslation :text="story.closedLoops[0].receiptText" /></li>
          <li><span>后续反馈</span><p data-content-language="zh" lang="zh-CN">{{ story.closedLoops[0].followUpText }}</p><ContentTranslation :text="story.closedLoops[0].followUpText" /></li>
        </ol>
      </article>
    </div>
    <ResourcePrivateChannelPanel />
  </section>
</template>

<style scoped>
.story { min-width:0; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.story > :deep(.private-evidence) { width:calc(100% - var(--cp-space-4) - var(--cp-space-4)); margin:var(--cp-space-4); }
.story__header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-5); padding:var(--cp-space-5); border-bottom:1px solid var(--cp-border-default); }
.eyebrow { margin:0 0 var(--cp-space-1); color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:750; letter-spacing:.06em; text-transform:uppercase; }
.story h2 { max-width:45rem; margin:0; font-size:clamp(1.4rem,2.5vw,2rem); line-height:1.25; }
.lede { max-width:56rem; margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.75; }
.experiment-stamp { display:grid; min-width:14rem; margin:0; border:1px solid var(--cp-border-default); }
.experiment-stamp div { display:flex; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-2) var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); }
.experiment-stamp div:first-child { border-top:0; }
.experiment-stamp dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.experiment-stamp dd { margin:0; font:650 var(--cp-text-xs)/1.4 var(--cp-font-mono); }
.worlds { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); }
.world { min-width:0; padding:var(--cp-space-4); border-right:1px solid var(--cp-border-default); border-top:3px solid var(--cp-branch-natural); }
.world:last-child { border-right:0; }
.world--A { border-top-color:var(--cp-evidence); }
.world--D { border-top-color:var(--cp-branch-governance); }
.world h3,.finding h3,.conversation h3 { margin:0; font-size:var(--cp-text-lg); line-height:1.35; }
.world__conclusion { min-height:4.2em; margin:var(--cp-space-2) 0 var(--cp-space-3); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.55; }
.world dl { display:grid; gap:var(--cp-space-1); margin:0; }
.world dl div { display:flex; justify-content:space-between; gap:var(--cp-space-2); padding-top:var(--cp-space-2); border-top:1px solid var(--cp-border-subtle); }
.world dt { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.world dd { margin:0; font:700 var(--cp-text-sm)/1 var(--cp-font-mono); }
.finding-grid { display:grid; grid-template-columns:1fr; border-top:1px solid var(--cp-border-default); }
.finding,.conversation { padding:var(--cp-space-5); }
.finding { display:grid; gap:var(--cp-space-2); }
.finding > * { margin-block:0; }
.conversation { border-top:1px solid var(--cp-border-default); background:var(--cp-surface-subtle); }
.finding > p:not(.eyebrow),.conversation li p { color:var(--cp-text-secondary); font-size:var(--cp-text-sm); line-height:1.65; }
.finding .boundary { padding-top:var(--cp-space-3); border-top:1px solid var(--cp-border-subtle); color:var(--cp-text-muted) !important; font-size:var(--cp-text-xs) !important; }
.conversation ol { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--cp-space-3); margin:var(--cp-space-3) 0 0; padding:0; list-style:none; }
.conversation li { position:relative; padding:var(--cp-space-3); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.conversation li + li::before { position:absolute; top:50%; left:calc(-1 * var(--cp-space-3)); z-index:1; width:var(--cp-space-3); content:'→'; color:var(--cp-text-muted); text-align:center; transform:translateY(-50%); }
.conversation li span { color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:750; }
.conversation li p { margin:var(--cp-space-1) 0 0; }
@media (max-width:999px) { .story__header { flex-direction:column; } .experiment-stamp { width:100%; } .worlds { grid-template-columns:1fr; } .world { border-right:0; border-bottom:1px solid var(--cp-border-default); } .world__conclusion { min-height:0; } }
@media (max-width:799px) { .conversation ol { grid-template-columns:1fr; gap:var(--cp-space-2); } .conversation li + li::before { top:calc(-1 * var(--cp-space-3)); left:1.2rem; width:auto; content:'↓'; transform:none; } }
@media (max-width:599px) { .story__header,.world,.finding,.conversation { padding:var(--cp-space-3); } .story > :deep(.private-evidence) { width:calc(100% - var(--cp-space-3) - var(--cp-space-3)); margin:var(--cp-space-3); } }
</style>
