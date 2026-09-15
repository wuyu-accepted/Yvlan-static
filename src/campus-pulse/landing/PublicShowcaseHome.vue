<script setup lang="ts">
import { computed } from 'vue'
import { currentLocale } from '../i18n/locale.ts'
import { HERO_RESULT_KEY, HERO_SOURCE_KEY, LECTURE_HERO_RESULT_KEY, LECTURE_HERO_SOURCE_KEY } from '../source/registry.ts'

const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh

const cases = [
  {
    key: 'housing',
    tag: 'CASE 01 · 资源治理',
    title: '暑期住宿床位分配',
    description: '比较“不再回应、解释规则、解释并承接服务”三种治理路径，观察争议如何变化。',
    resultKey: HERO_RESULT_KEY,
    source: HERO_SOURCE_KEY,
  },
  {
    key: 'lecture',
    tag: 'CASE 02 · 事件回应',
    title: '讲座事件后的持续回应',
    description: '比较讨论自然发展与学校主动回应，观察责任说明、诉求回应和后续保障带来的差异。',
    resultKey: LECTURE_HERO_RESULT_KEY,
    source: LECTURE_HERO_SOURCE_KEY,
  },
]
</script>

<template>
  <div class="showcase-home">
    <section class="showcase-hero">
      <p class="eyebrow">YULAN FORUMTWIN · CAMPUSPULSE</p>
      <h1>{{ l('在政策发布前，先看见讨论如何演化。', 'See how a discussion may evolve before a policy is released.') }}</h1>
      <p class="lead">{{ l('CampusPulse 用平行论坛呈现校园事件、群体讨论与治理回应之间的关系，并把关键过程整理成可阅读、可追溯的案例。', 'CampusPulse presents the relationship between campus events, group discussion, and governance responses through parallel forums, organized as readable and traceable cases.') }}</p>
      <div class="hero-actions">
        <RouterLink class="primary" to="/campus-pulse/results">{{ l('浏览公开案例', 'Browse public cases') }}</RouterLink>
        <RouterLink to="/campus-pulse/live-evolution">{{ l('查看演化展示', 'View evolution showcase') }}</RouterLink>
      </div>
    </section>

    <section class="capability-grid" aria-label="项目能力">
      <article>
        <span>01</span><h2>{{ l('平行论坛', 'Parallel forums') }}</h2>
        <p>{{ l('让不同治理选择在相同事件条件下分别发展，便于对照讨论走向。', 'Let different governance choices evolve under the same event conditions for direct comparison.') }}</p>
      </article>
      <article>
        <span>02</span><h2>{{ l('过程回放', 'Process replay') }}</h2>
        <p>{{ l('按时间步查看发帖、回复、观点变化与治理行动，理解结果如何形成。', 'Review posts, replies, opinion shifts, and governance actions over time to understand how outcomes form.') }}</p>
      </article>
      <article>
        <span>03</span><h2>{{ l('案例证据', 'Case evidence') }}</h2>
        <p>{{ l('把场景事实、分支差异、关键发现和证据边界放在同一条阅读路径中。', 'Keep scenario facts, branch differences, key findings, and evidence boundaries in one reading path.') }}</p>
      </article>
    </section>

    <section class="featured-cases">
      <header><p class="eyebrow">FEATURED CASES</p><h2>{{ l('精选案例', 'Featured cases') }}</h2></header>
      <div class="case-grid">
        <article v-for="item in cases" :key="item.key">
          <p class="case-tag">{{ item.tag }}</p>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
          <RouterLink :to="{ name: 'campus-pulse-result-summary', params: { resultKey: item.resultKey }, query: { source: item.source } }">
            {{ l('查看完整分析', 'View full analysis') }} <i class="fa-solid fa-arrow-right" aria-hidden="true" />
          </RouterLink>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.showcase-home { box-sizing:border-box; width:min(100%,78rem); margin:0 auto; padding:clamp(1.5rem,4vw,4rem); color:#241f21; }
.showcase-hero { padding:clamp(2rem,5vw,5.5rem) 0; border-bottom:1px solid #ded8d4; }
.eyebrow { margin:0 0 1rem; color:#a50f37; font-size:.72rem; font-weight:800; letter-spacing:.14em; }
.showcase-hero h1 { max-width:58rem; margin:0; font-size:clamp(2.5rem,5.6vw,5.6rem); line-height:1.02; letter-spacing:-.055em; }
.lead { max-width:49rem; margin:1.6rem 0 0; color:#655d60; font-size:clamp(1rem,1.4vw,1.2rem); line-height:1.8; }
.hero-actions { display:flex; flex-wrap:wrap; gap:.75rem; margin-top:2rem; }
.hero-actions a { display:inline-flex; min-height:2.8rem; align-items:center; padding:0 1.1rem; border:1px solid #cfc8c4; border-radius:.35rem; color:#352e31; font-size:.9rem; font-weight:750; text-decoration:none; }
.hero-actions a.primary { border-color:#b20f3d; background:#b20f3d; color:#fff; }
.capability-grid,.case-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }
.capability-grid { padding:2.5rem 0; border-bottom:1px solid #ded8d4; }
.capability-grid article,.case-grid article { padding:1.4rem; border:1px solid #ded8d4; border-radius:.55rem; background:#fff; }
.capability-grid span { color:#b20f3d; font-size:.7rem; font-weight:800; }
.capability-grid h2 { margin:.8rem 0 .65rem; font-size:1.05rem; }
.capability-grid p,.case-grid article>p { margin:0; color:#71686b; font-size:.86rem; line-height:1.7; }
.featured-cases { padding:3rem 0 2rem; }
.featured-cases header { margin-bottom:1.25rem; }
.featured-cases h2 { margin:0; font-size:clamp(1.7rem,3vw,2.5rem); }
.case-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
.case-grid article { display:grid; align-content:start; min-height:15rem; }
.case-grid .case-tag { margin-bottom:.75rem; color:#9b8e92; font-size:.67rem; font-weight:800; letter-spacing:.08em; }
.case-grid h3 { margin:0 0 .75rem; font-size:1.25rem; }
.case-grid a { align-self:end; justify-self:start; margin-top:1.5rem; color:#a50f37; font-size:.86rem; font-weight:750; text-decoration:none; }
@media(max-width:767px){.showcase-home{padding:1.25rem}.capability-grid,.case-grid{grid-template-columns:1fr}.showcase-hero{padding:2.5rem 0}.showcase-hero h1{font-size:2.5rem}}
</style>
