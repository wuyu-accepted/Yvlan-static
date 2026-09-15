<script setup lang="ts">
import type { ForumTick, ForumTwinManifest } from '../../../services/forumTwin'

defineProps<{
  naturalTick: ForumTick
  adaptiveTick: ForumTick
  manifest: ForumTwinManifest
}>()

function percent(value: unknown) {
  return Number.isFinite(value) ? `${(Number(value) * 100).toFixed(1)}%` : '—'
}
</script>

<template>
  <section class="particle-summary">
    <header>
      <div>
        <span>SECONDARY STATE VIEW</span>
        <h2>10,000 粒子只解释状态不确定性</h2>
      </div>
      <b :class="{ available: manifest.particle_frames.length > 0 }">
        {{ manifest.particle_frames.length > 0 ? 'VERIFIED FRAMES' : 'NO PUBLIC FRAMES' }}
      </b>
    </header>
    <div class="state-grid">
      <article>
        <span>NATURAL · concern / trust</span>
        <strong>{{ percent(naturalTick.metrics.concern) }} / {{ percent(naturalTick.metrics.trust) }}</strong>
      </article>
      <article>
        <span>ADAPTIVE D · concern / trust</span>
        <strong>{{ percent(adaptiveTick.metrics.concern) }} / {{ percent(adaptiveTick.metrics.trust) }}</strong>
      </article>
      <article>
        <span>PUBLIC PARTICLE FRAMES</span>
        <strong>{{ manifest.particle_frames.length }}</strong>
      </article>
      <article>
        <span>当前 PPS ESS · Natural / D</span>
        <strong>{{ naturalTick.pps_kish_ess.toFixed(1) }} / {{ adaptiveTick.pps_kish_ess.toFixed(1) }}</strong>
      </article>
    </div>
    <p>
      这里不按聚合指标随机生成粒子。只有后端量化帧资产通过摘要链校验后，主线才可接入真实 Pixi 渲染。
    </p>
  </section>
</template>

<style scoped>
.particle-summary { min-width:0; padding:17px; border:1px solid rgba(102,157,165,.15); border-radius:15px; background:rgba(6,19,23,.9); }
header { display:flex; justify-content:space-between; gap:12px; align-items:center; }
header span { color:#55d9c7; font:800 9px ui-monospace,monospace; letter-spacing:.13em; }
h2 { margin:4px 0 0; color:#e2efed; font-size:16px; }
header > b { color:#8b7771; font:800 8px ui-monospace,monospace; }
header > b.available { color:#55d9c7; }
.state-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; margin-top:13px; }
article { min-width:0; padding:10px; border:1px solid rgba(99,152,159,.1); border-radius:8px; background:#08191d; }
article span { display:block; overflow:hidden; color:#607a7f; font-size:8px; text-overflow:ellipsis; white-space:nowrap; }
article strong { display:block; margin-top:6px; overflow:hidden; color:#c7d9d6; font:800 12px ui-monospace,monospace; text-overflow:ellipsis; white-space:nowrap; }
.particle-summary > p { margin:11px 0 0; color:#5f787d; font-size:8px; line-height:1.55; }
@media(max-width:760px){.state-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>

<style scoped>
.particle-summary { border: 1px solid var(--ft-border); border-top: 4px solid var(--ft-gold); border-radius: 2px; background: #ffffff; box-shadow: 0 5px 18px rgba(0,0,0,.035); }
header span { color: var(--ft-gold); }
h2 { color: var(--ft-ink); font-weight: 600; }
header > b { color: var(--ft-muted); }
header > b.available { color: #2f7d42; }
article { border-color: #e8e8e8; border-radius: 2px; background: #fafafa; }
article span { color: var(--ft-muted); }
article strong { color: var(--ft-ink); }
.particle-summary > p { color: var(--ft-muted); }
</style>
