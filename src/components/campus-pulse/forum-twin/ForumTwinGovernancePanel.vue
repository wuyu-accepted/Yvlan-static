<script setup lang="ts">
import { computed } from 'vue'
import type { ForumTick } from '../../../services/forumTwin'

const props = defineProps<{
  naturalTick: ForumTick
  adaptiveTick: ForumTick
}>()

function entries(value?: Record<string, unknown>) {
  if (!value) return []
  return Object.entries(value)
    .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
    .slice(0, 8)
}

const observation = computed(() => entries(props.adaptiveTick.governance_observation))
const decision = computed(() => entries(props.adaptiveTick.governance_decision))
</script>

<template>
  <section class="governance-panel">
    <header>
      <div>
        <span>LIMITED OBSERVATION GOVERNANCE</span>
        <h2>治理主体当时看到什么、随后做什么</h2>
      </div>
      <b>T{{ adaptiveTick.tick }}</b>
    </header>
    <div class="comparison">
      <article class="natural">
        <span>NATURAL</span>
        <strong>{{ naturalTick.activated_governance }} actor turns</strong>
        <p>Natural 分支不调用治理主体，也不产生治理消息。</p>
      </article>
      <article>
        <span>ACTOR-VISIBLE POSTERIOR</span>
        <dl v-if="observation.length">
          <div v-for="[key, value] in observation" :key="key">
            <dt>{{ key }}</dt><dd>{{ value }}</dd>
          </div>
        </dl>
        <p v-else>当前时点没有公开的治理观测摘要。</p>
      </article>
      <article>
        <span>VALIDATED DECISION</span>
        <dl v-if="decision.length">
          <div v-for="[key, value] in decision" :key="key">
            <dt>{{ key }}</dt><dd>{{ value }}</dd>
          </div>
        </dl>
        <p v-else>当前时点没有已执行并公开的治理决策。</p>
      </article>
    </div>
    <footer>本面板拒绝 truth、future events 与其他角色私有观测字段。</footer>
  </section>
</template>

<style scoped>
.governance-panel { min-width:0; padding:17px; border:1px solid rgba(105,158,166,.15); border-radius:15px; background:rgba(7,19,23,.9); }
header { display:flex; justify-content:space-between; align-items:center; gap:12px; }
header span { color:#b59ae8; font:800 9px ui-monospace,monospace; letter-spacing:.13em; }
h2 { margin:4px 0 0; color:#e2efed; font-size:16px; }
header > b { color:#b59ae8; font:800 10px ui-monospace,monospace; }
.comparison { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:13px; }
article { min-width:0; padding:11px; border:1px solid rgba(100,153,160,.1); border-radius:9px; background:#08191d; }
article > span { color:#6b8388; font:700 8px ui-monospace,monospace; }
article > strong { display:block; margin-top:7px; color:#d1e1df; font-size:11px; }
article p { margin:8px 0 0; color:#667e83; font-size:8px; line-height:1.55; }
article.natural { opacity:.75; }
dl { display:grid; gap:5px; margin:8px 0 0; }
dl div { display:flex; justify-content:space-between; gap:8px; }
dt { overflow:hidden; color:#617a7f; font-size:8px; text-overflow:ellipsis; }
dd { margin:0; color:#aebfbd; font:700 8px ui-monospace,monospace; text-align:right; }
.governance-panel > footer { margin-top:11px; color:#5d757a; font-size:8px; }
@media(max-width:760px){.comparison{grid-template-columns:1fr}}
</style>

<style scoped>
.governance-panel { border: 1px solid var(--ft-border); border-top: 4px solid var(--ft-red); border-radius: 2px; background: #ffffff; box-shadow: 0 5px 18px rgba(0,0,0,.035); }
header span { color: var(--ft-red); }
h2 { color: var(--ft-ink); font-weight: 600; }
header > b { color: var(--ft-red); }
article { border-color: #e8e8e8; border-radius: 2px; background: #fafafa; }
article:nth-child(2) { border-top: 3px solid var(--ft-gold); }
article:nth-child(3) { border-top: 3px solid var(--ft-red); background: var(--ft-red-soft); }
article > span { color: var(--ft-muted); }
article > strong { color: var(--ft-ink); }
article p { color: var(--ft-copy); }
dt { color: var(--ft-muted); }
dd { color: var(--ft-ink); }
.governance-panel > footer { color: var(--ft-muted); }
</style>
