<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import LanguageToggle from '../i18n/LanguageToggle.vue'
import { currentLocale } from '../i18n/locale.ts'

const coverRoot = ref<HTMLElement | null>(null)
const simulationStage = ref<HTMLElement | null>(null)
let media: ReturnType<typeof gsap.matchMedia> | null = null
let stageX: ReturnType<typeof gsap.quickTo> | null = null
let stageY: ReturnType<typeof gsap.quickTo> | null = null
const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true'

const copy = computed(() => currentLocale.value === 'en-US' ? {
  race: 'AI FOR SOCIAL GOVERNANCE',
  status: publicDemo ? 'PUBLIC CASE SHOWCASE' : 'FORUMTWIN ENGINE ONLINE',
  navCase: 'Case studies',
  navEnter: publicDemo ? 'Explore evolution' : 'Enter simulator',
  kicker: 'YULAN · FORUMTWIN',
  titleLead: 'Before policy enters reality,',
  titleAccent: 'let it enter a parallel forum.',
  description: 'CampusPulse compiles real campus-forum ecology into 1,000 heterogeneous LLM agents. The same event unfolds across parallel forums, revealing how narratives form, governance is received, and risks diverge before a decision is deployed.',
  enter: publicDemo ? 'Explore the forum evolution' : 'Enter CampusPulse',
  cases: 'View verified cases',
  agents: 'persistent LLM agents',
  roles: 'data-driven micro roles',
  worlds: 'parallel governance worlds',
  eventLabel: 'EVENT INPUT',
  eventTitle: 'A campus issue enters the forum',
  forumLabel: 'FORUM LIVE',
  forumTitle: '1,000 agents interpret, post and respond',
  natural: 'NATURAL',
  naturalText: 'Organic evolution',
  governed: 'GOVERNED',
  governedText: 'Evidence · service · outreach',
  agentPulse: 'LLM AGENTS ACTIVE',
  visibleFeed: 'HOT 10 + LATEST',
  process: ['Define an event', 'Run the forum', 'Observe divergence', 'Compare governance'],
} : {
  race: '人工智能社会治理应用赛道',
  status: publicDemo ? '公开案例展示' : 'FORUMTWIN 引擎在线',
  navCase: '案例结果',
  navEnter: publicDemo ? '查看演化' : '进入模拟器',
  kicker: 'YULAN · FORUMTWIN',
  titleLead: '政策落地之前，',
  titleAccent: '先在平行论坛预演。',
  description: 'CampusPulse 将真实校园论坛生态编译为 1,000 个异质 LLM Agent。让同一事件在平行论坛中自然演化，提前看见叙事如何形成、治理如何被承接，以及风险为何分叉。',
  enter: publicDemo ? '查看论坛演化' : '进入 CampusPulse',
  cases: '查看已验证案例',
  agents: '持久 LLM Agent',
  roles: '数据驱动微角色',
  worlds: '平行治理世界',
  eventLabel: '事件输入',
  eventTitle: '一个校园议题进入论坛',
  forumLabel: '论坛运行中',
  forumTitle: '1,000 个 Agent 解释、发帖与回应',
  natural: '自然演化',
  naturalText: '不追加治理动作',
  governed: '主动治理',
  governedText: '证据 · 服务 · 触达',
  agentPulse: 'LLM AGENT 活跃',
  visibleFeed: '热榜前十 + 最新帖',
  process: ['定义事件', '运行论坛', '观察分叉', '比较治理'],
})

const networkNodes = [
  { x: 13, y: 26, size: 6, delay: 0.1 },
  { x: 27, y: 13, size: 4, delay: 0.5 },
  { x: 47, y: 20, size: 7, delay: 0.9 },
  { x: 68, y: 12, size: 5, delay: 1.2 },
  { x: 84, y: 28, size: 6, delay: 0.3 },
  { x: 91, y: 52, size: 4, delay: 1.5 },
  { x: 77, y: 66, size: 7, delay: 0.7 },
  { x: 56, y: 75, size: 5, delay: 1.1 },
  { x: 32, y: 70, size: 6, delay: 1.7 },
  { x: 12, y: 57, size: 4, delay: 0.4 },
  { x: 37, y: 39, size: 4, delay: 1.4 },
  { x: 66, y: 42, size: 5, delay: 0.8 },
]

function updateDocumentTitle() {
  document.title = currentLocale.value === 'en-US'
    ? 'CampusPulse · Parallel forum governance simulator'
    : 'CampusPulse · 校园平行论坛治理模拟器'
}

function moveStage(event: PointerEvent) {
  if (!coverRoot.value || event.pointerType === 'touch') return
  const bounds = coverRoot.value.getBoundingClientRect()
  const x = (event.clientX - bounds.left) / bounds.width - 0.5
  const y = (event.clientY - bounds.top) / bounds.height - 0.5
  stageX?.(x * 14)
  stageY?.(y * 10)
}

function resetStage() {
  stageX?.(0)
  stageY?.(0)
}

onMounted(() => {
  updateDocumentTitle()
  if (!coverRoot.value || !simulationStage.value) return

  stageX = gsap.quickTo(simulationStage.value, 'x', { duration: 0.9, ease: 'power3.out' })
  stageY = gsap.quickTo(simulationStage.value, 'y', { duration: 0.9, ease: 'power3.out' })
  media = gsap.matchMedia()
  media.add({
    desktop: '(min-width: 900px)',
    mobile: '(max-width: 899px)',
    reduceMotion: '(prefers-reduced-motion: reduce)',
  }, (context) => {
    const reduceMotion = Boolean(context.conditions?.reduceMotion)
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro
      .from('.cover-nav', { autoAlpha: 0, y: -18, duration: reduceMotion ? 0 : 0.65 })
      .from('.cover-reveal', { autoAlpha: 0, y: reduceMotion ? 0 : 28, duration: reduceMotion ? 0 : 0.75, stagger: reduceMotion ? 0 : 0.1 }, '-=0.22')
      .from('.simulation-stage', { autoAlpha: 0, scale: reduceMotion ? 1 : 0.94, duration: reduceMotion ? 0 : 0.9 }, '-=0.58')
      .from('.cover-process li', { autoAlpha: 0, x: reduceMotion ? 0 : -14, duration: reduceMotion ? 0 : 0.42, stagger: reduceMotion ? 0 : 0.08 }, '-=0.48')

    if (reduceMotion) return
    gsap.to('.orbit-ring--outer', { rotate: 360, duration: 28, repeat: -1, ease: 'none', transformOrigin: '50% 50%' })
    gsap.to('.orbit-ring--inner', { rotate: -360, duration: 19, repeat: -1, ease: 'none', transformOrigin: '50% 50%' })
    gsap.to('.network-node', { scale: 1.65, autoAlpha: 0.35, duration: 1.6, stagger: { each: 0.16, repeat: -1, yoyo: true }, ease: 'sine.inOut', transformOrigin: '50% 50%' })
    gsap.to('.signal-path', { strokeDashoffset: -64, duration: 2.6, repeat: -1, ease: 'none' })
    gsap.to('.event-core__pulse', { scale: 1.45, autoAlpha: 0, duration: 1.9, repeat: -1, ease: 'power1.out', transformOrigin: '50% 50%' })
    gsap.to('.world-card--natural', { y: -5, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    gsap.to('.world-card--governed', { y: 5, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.6 })
    gsap.to('.flow-packet', { x: 198, duration: 2.8, repeat: -1, ease: 'power1.inOut' })
  }, coverRoot.value)
})

watch(currentLocale, updateDocumentTitle)

onBeforeUnmount(() => {
  media?.revert()
  if (simulationStage.value) gsap.killTweensOf(simulationStage.value)
  media = null
  stageX = null
  stageY = null
})
</script>

<template>
  <div ref="coverRoot" class="campus-pulse-app cover-page" :class="{ 'cover-page--zh': currentLocale !== 'en-US' }" data-no-localize @pointermove="moveStage" @pointerleave="resetStage">
    <div class="cover-ambient" aria-hidden="true"><i /><i /><i /></div>
    <div class="cover-grid" aria-hidden="true" />

    <header class="cover-nav">
      <RouterLink class="cover-brand" to="/campus-pulse" aria-label="CampusPulse">
        <span class="cover-brand__mark"><i class="fa-solid fa-wave-square" aria-hidden="true" /></span>
        <span class="cover-brand__name"><strong>CampusPulse</strong><small>YULAN FORUMTWIN</small></span>
      </RouterLink>
      <div class="cover-nav__race"><i />{{ copy.race }}</div>
      <div class="cover-nav__actions">
        <LanguageToggle />
        <RouterLink class="cover-nav__case" to="/campus-pulse/results">{{ copy.navCase }}</RouterLink>
        <RouterLink v-if="publicDemo" class="cover-nav__enter" to="/campus-pulse/forum">{{ copy.navEnter }} <i class="fa-solid fa-arrow-right" aria-hidden="true" /></RouterLink>
        <RouterLink v-else class="cover-nav__enter" to="/campus-pulse/overview">{{ copy.navEnter }} <i class="fa-solid fa-arrow-right" aria-hidden="true" /></RouterLink>
      </div>
    </header>

    <main class="cover-main">
      <section class="cover-copy" aria-labelledby="cover-title">
        <div class="cover-kicker cover-reveal"><span><i />{{ copy.status }}</span><b>{{ copy.kicker }}</b></div>
        <h1 id="cover-title" class="cover-reveal"><span>{{ copy.titleLead }}</span><em>{{ copy.titleAccent }}</em></h1>
        <p class="cover-description cover-reveal">{{ copy.description }}</p>
        <div class="cover-actions cover-reveal">
          <RouterLink v-if="publicDemo" class="cover-primary" to="/campus-pulse/forum">{{ copy.enter }} <i class="fa-solid fa-arrow-right-long" aria-hidden="true" /></RouterLink>
          <RouterLink v-else class="cover-primary" to="/campus-pulse/overview">{{ copy.enter }} <i class="fa-solid fa-arrow-right-long" aria-hidden="true" /></RouterLink>
          <RouterLink class="cover-secondary" to="/campus-pulse/results"><i class="fa-regular fa-circle-play" aria-hidden="true" /> {{ copy.cases }}</RouterLink>
        </div>
        <dl class="cover-stats cover-reveal">
          <div><dt>1,000</dt><dd>{{ copy.agents }}</dd></div>
          <div><dt>120</dt><dd>{{ copy.roles }}</dd></div>
          <div><dt>2</dt><dd>{{ copy.worlds }}</dd></div>
        </dl>
      </section>

      <section ref="simulationStage" class="simulation-stage" aria-label="CampusPulse parallel forum simulation preview">
        <div class="stage-noise" aria-hidden="true" />
        <header class="stage-header"><span>LIVE SOCIAL SIMULATION</span><b><i /> TICK 07</b></header>
        <div class="stage-network" aria-hidden="true">
          <svg viewBox="0 0 620 470" role="presentation">
            <defs>
              <linearGradient id="coverSignal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8c078" stop-opacity=".15" /><stop offset=".5" stop-color="#f5efe7" stop-opacity=".55" /><stop offset="1" stop-color="#c70f3b" stop-opacity=".2" /></linearGradient>
              <radialGradient id="coverCore"><stop offset="0" stop-color="#f6e4aa" /><stop offset=".35" stop-color="#c70f3b" /><stop offset="1" stop-color="#4a0818" /></radialGradient>
            </defs>
            <ellipse class="orbit-ring orbit-ring--outer" cx="310" cy="206" rx="232" ry="160" />
            <ellipse class="orbit-ring orbit-ring--inner" cx="310" cy="206" rx="154" ry="104" />
            <path class="signal-path" d="M78 205 C140 55 248 102 310 206 S475 352 542 205" />
            <path class="signal-path signal-path--red" d="M104 305 C186 250 215 110 310 206 S430 228 518 108" />
            <line x1="310" y1="206" x2="186" y2="408" class="world-line" />
            <line x1="310" y1="206" x2="446" y2="408" class="world-line world-line--red" />
            <circle class="event-core__pulse" cx="310" cy="206" r="26" />
            <circle cx="310" cy="206" r="12" fill="url(#coverCore)" />
            <circle v-for="(node, index) in networkNodes" :key="index" class="network-node" :cx="node.x * 6.2" :cy="node.y * 4.1" :r="node.size / 2" />
          </svg>
          <div class="event-core"><small>{{ copy.eventLabel }}</small><strong>{{ copy.eventTitle }}</strong></div>
          <div class="forum-live"><span>{{ copy.forumLabel }}</span><strong>{{ copy.forumTitle }}</strong></div>
          <span class="flow-packet" />
        </div>
        <div class="world-cards">
          <article class="world-card world-card--natural"><small>{{ copy.natural }}</small><strong>{{ copy.naturalText }}</strong><span><i /></span></article>
          <article class="world-card world-card--governed"><small>{{ copy.governed }}</small><strong>{{ copy.governedText }}</strong><span><i /></span></article>
        </div>
        <footer class="stage-footer"><span><i class="fa-solid fa-circle-nodes" aria-hidden="true" /> {{ copy.agentPulse }}</span><span><i class="fa-solid fa-ranking-star" aria-hidden="true" /> {{ copy.visibleFeed }}</span></footer>
      </section>
    </main>

    <footer class="cover-process" aria-label="Simulation workflow">
      <ol><li v-for="(step, index) in copy.process" :key="step"><span>0{{ index + 1 }}</span><strong>{{ step }}</strong><i v-if="index < copy.process.length - 1" class="fa-solid fa-arrow-right" aria-hidden="true" /></li></ol>
    </footer>
  </div>
</template>

<style scoped>
.cover-page {
  --cover-ink:#0b0709;
  --cover-ink-soft:#171013;
  --cover-red:#b80b34;
  --cover-red-bright:#d71847;
  --cover-gold:#d2bb76;
  --cover-cream:#f4efe8;
  position:relative;
  isolation:isolate;
  display:grid;
  min-height:100dvh;
  grid-template-rows:auto minmax(0,1fr) auto;
  overflow-x:hidden;
  overflow-y:auto;
  background:var(--cover-ink);
  color:var(--cover-cream);
}
.cover-page::before { position:absolute; inset:0; z-index:-4; background:radial-gradient(circle at 70% 45%,rgba(184,11,52,.18),transparent 29rem),radial-gradient(circle at 18% 82%,rgba(210,187,118,.08),transparent 26rem),linear-gradient(132deg,#120b0e 0%,var(--cover-ink) 58%,#080607 100%); content:''; }
.cover-grid { position:absolute; inset:0; z-index:-3; background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px); background-size:4.5rem 4.5rem; mask-image:linear-gradient(90deg,black,rgba(0,0,0,.48) 58%,transparent); pointer-events:none; }
.cover-ambient { position:absolute; inset:0; z-index:-2; overflow:hidden; pointer-events:none; }.cover-ambient i{position:absolute;border:1px solid rgba(255,255,255,.04);border-radius:50%}.cover-ambient i:nth-child(1){right:-15rem;top:-17rem;width:46rem;height:46rem;box-shadow:0 0 0 5rem rgba(255,255,255,.012),0 0 0 11rem rgba(255,255,255,.008)}.cover-ambient i:nth-child(2){left:42%;top:16%;width:14rem;height:14rem;border-color:rgba(184,11,52,.1)}.cover-ambient i:nth-child(3){left:-7rem;bottom:-9rem;width:23rem;height:23rem;border-color:rgba(210,187,118,.07)}
.cover-nav { position:relative; z-index:5; display:grid; min-height:5rem; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:2rem; padding:0 clamp(1.25rem,4vw,4.75rem); border-bottom:1px solid rgba(255,255,255,.08); background:rgba(11,7,9,.58); backdrop-filter:blur(20px); }
.cover-brand { display:flex; align-items:center; gap:.8rem; color:var(--cover-cream); text-decoration:none; }.cover-brand__mark{display:grid;width:2.45rem;height:2.45rem;place-items:center;border:1px solid rgba(255,255,255,.14);border-radius:.7rem;background:linear-gradient(145deg,var(--cover-red-bright),#74061e);box-shadow:0 .7rem 2rem rgba(184,11,52,.28)}.cover-brand__name{display:grid;gap:.18rem}.cover-brand__name strong{font-size:1rem;letter-spacing:.01em}.cover-brand__name small{color:rgba(244,239,232,.45);font:750 .55rem/1 var(--cp-font-mono);letter-spacing:.14em}
.cover-nav__race { justify-self:center; display:flex; align-items:center; gap:.55rem;color:rgba(244,239,232,.48);font:750 .62rem/1 var(--cp-font-mono);letter-spacing:.13em;text-transform:uppercase}.cover-nav__race i{width:.36rem;height:.36rem;border-radius:50%;background:var(--cover-gold);box-shadow:0 0 .75rem rgba(210,187,118,.6)}
.cover-nav__actions { display:flex; align-items:center; gap:.8rem; }.cover-nav__actions :deep(.language-toggle){border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.045);box-shadow:none}.cover-nav__actions :deep(.language-toggle button){color:rgba(244,239,232,.55)}.cover-nav__actions :deep(.language-toggle button.active){background:rgba(255,255,255,.12);color:var(--cover-cream);box-shadow:none}.cover-nav__case,.cover-nav__enter{display:inline-flex;min-height:2.55rem;align-items:center;justify-content:center;gap:.55rem;padding:0 1rem;border:1px solid rgba(255,255,255,.12);border-radius:.45rem;color:rgba(244,239,232,.78);font-size:.76rem;font-weight:720;text-decoration:none}.cover-nav__case:hover{border-color:rgba(255,255,255,.28);color:var(--cover-cream)}.cover-nav__enter{border-color:var(--cover-red);background:var(--cover-red);color:white;box-shadow:0 .6rem 1.8rem rgba(184,11,52,.22)}.cover-nav__enter:hover{background:var(--cover-red-bright)}
.cover-main { position:relative; z-index:1; display:grid; width:min(100%,94rem); min-height:0; grid-template-columns:minmax(0,1.02fr) minmax(29rem,.88fr); align-items:center; gap:clamp(2rem,5vw,6rem); margin:0 auto; padding:clamp(2.2rem,5vh,5rem) clamp(1.25rem,4vw,4.75rem) clamp(1.5rem,3vh,2.7rem); }
  .cover-copy { min-width:0; max-width:47rem; }.cover-kicker{display:flex;align-items:center;gap:1rem;margin-bottom:1.35rem}.cover-kicker>span{display:inline-flex;align-items:center;gap:.5rem;color:var(--cover-gold);font:780 .63rem/1 var(--cp-font-mono);letter-spacing:.11em}.cover-kicker>span i{width:.38rem;height:.38rem;border-radius:50%;background:var(--cover-red-bright);box-shadow:0 0 .8rem rgba(215,24,71,.7)}.cover-kicker>b{padding-left:1rem;border-left:1px solid rgba(255,255,255,.13);color:rgba(244,239,232,.4);font:750 .6rem/1 var(--cp-font-mono);letter-spacing:.13em}
  .cover-copy h1 { display:grid; min-width:0; margin:0; font-size:clamp(2.65rem,5.2vw,5.65rem); font-weight:650; letter-spacing:-.06em; line-height:.98; }.cover-copy h1 span{color:var(--cover-cream)}.cover-copy h1 em{margin-top:.14em;color:var(--cover-red-bright);font-style:normal;text-shadow:0 1rem 4rem rgba(184,11,52,.24)}.cover-page--zh .cover-copy h1{font-size:clamp(2.6rem,4.65vw,4.85rem);letter-spacing:-.075em;line-height:1.02}.cover-page--zh .cover-copy h1 span,.cover-page--zh .cover-copy h1 em{white-space:nowrap;word-break:keep-all}
.cover-description { max-width:43rem; margin:1.7rem 0 0; color:rgba(244,239,232,.66); font-size:clamp(.88rem,1.08vw,1rem); line-height:1.78; }
.cover-actions { display:flex; flex-wrap:wrap; gap:.75rem; margin-top:2rem; }.cover-primary,.cover-secondary{display:inline-flex;min-height:3.25rem;align-items:center;justify-content:center;gap:.75rem;padding:0 1.25rem;border:1px solid rgba(255,255,255,.16);border-radius:.5rem;color:var(--cover-cream);font-size:.84rem;font-weight:760;text-decoration:none;transition:transform .25s ease,border-color .25s ease,background .25s ease,box-shadow .25s ease}.cover-primary{border-color:var(--cover-red);background:linear-gradient(135deg,var(--cover-red-bright),#8b0826);box-shadow:0 1rem 2.6rem rgba(184,11,52,.28)}.cover-primary:hover{transform:translateY(-3px);box-shadow:0 1.35rem 3.2rem rgba(184,11,52,.38)}.cover-secondary{background:rgba(255,255,255,.035);color:rgba(244,239,232,.76);backdrop-filter:blur(12px)}.cover-secondary:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.32);color:var(--cover-cream)}
.cover-stats { display:flex; gap:clamp(1.2rem,3vw,2.6rem); margin:2.1rem 0 0; }.cover-stats div{display:grid;gap:.32rem;padding-left:.8rem;border-left:1px solid rgba(255,255,255,.14)}.cover-stats dt{font:780 1rem/1 var(--cp-font-mono);color:var(--cover-cream)}.cover-stats dd{margin:0;color:rgba(244,239,232,.43);font-size:.65rem;letter-spacing:.035em}
.simulation-stage { position:relative; isolation:isolate; min-height:34rem; overflow:hidden; border:1px solid rgba(255,255,255,.13); border-radius:1.25rem; background:linear-gradient(148deg,rgba(255,255,255,.07),rgba(255,255,255,.015) 48%,rgba(184,11,52,.075)); box-shadow:0 2.2rem 7rem rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.09); backdrop-filter:blur(24px); will-change:transform; }
.simulation-stage::before{position:absolute;inset:-1px;z-index:-1;padding:1px;border-radius:inherit;background:linear-gradient(145deg,rgba(210,187,118,.3),transparent 36%,rgba(184,11,52,.4));content:'';mask:linear-gradient(black 0 0) content-box,linear-gradient(black 0 0);mask-composite:exclude}.stage-noise{position:absolute;inset:0;opacity:.13;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.32'/%3E%3C/svg%3E");pointer-events:none;mix-blend-mode:soft-light}
.stage-header,.stage-footer{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem 1.25rem;color:rgba(244,239,232,.42);font:760 .58rem/1 var(--cp-font-mono);letter-spacing:.11em}.stage-header{border-bottom:1px solid rgba(255,255,255,.08)}.stage-header b{display:inline-flex;align-items:center;gap:.45rem;color:var(--cover-gold)}.stage-header b i{width:.38rem;height:.38rem;border-radius:50%;background:var(--cover-red-bright);box-shadow:0 0 .8rem rgba(215,24,71,.76)}
.stage-network{position:relative;height:24.2rem}.stage-network svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.orbit-ring{fill:none;stroke:rgba(255,255,255,.075);stroke-width:1;stroke-dasharray:2 9}.orbit-ring--inner{stroke:rgba(210,187,118,.13);stroke-dasharray:1 12}.signal-path{fill:none;stroke:url(#coverSignal);stroke-width:1.2;stroke-dasharray:5 9;stroke-dashoffset:0}.signal-path--red{stroke:rgba(215,24,71,.5)}.world-line{stroke:rgba(210,187,118,.2);stroke-width:1;stroke-dasharray:3 6}.world-line--red{stroke:rgba(215,24,71,.34)}.network-node{fill:var(--cover-gold);opacity:.62;filter:drop-shadow(0 0 6px rgba(210,187,118,.55))}.network-node:nth-of-type(3n){fill:var(--cover-red-bright);filter:drop-shadow(0 0 6px rgba(215,24,71,.6))}.event-core__pulse{fill:none;stroke:rgba(215,24,71,.55);stroke-width:1.5}
.event-core{position:absolute;left:50%;top:43%;display:grid;width:13rem;gap:.28rem;transform:translate(-50%,-50%);text-align:center;pointer-events:none}.event-core small,.forum-live span{color:var(--cover-gold);font:760 .54rem/1 var(--cp-font-mono);letter-spacing:.12em}.event-core strong{font-size:.76rem;line-height:1.4}.forum-live{position:absolute;left:50%;top:7%;display:grid;gap:.32rem;transform:translateX(-50%);text-align:center;white-space:nowrap}.forum-live strong{font-size:.72rem;color:rgba(244,239,232,.68)}.flow-packet{position:absolute;left:18%;top:48%;width:.42rem;height:.42rem;border-radius:50%;background:var(--cover-red-bright);box-shadow:0 0 1rem rgba(215,24,71,.9)}
.world-cards{position:absolute;right:1.25rem;bottom:4.15rem;left:1.25rem;z-index:3;display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.world-card{display:grid;gap:.42rem;padding:.9rem 1rem;border:1px solid rgba(255,255,255,.1);border-radius:.65rem;background:rgba(8,6,7,.72);box-shadow:0 .8rem 2.2rem rgba(0,0,0,.28);backdrop-filter:blur(14px)}.world-card--governed{border-color:rgba(215,24,71,.42);background:linear-gradient(145deg,rgba(184,11,52,.18),rgba(8,6,7,.76))}.world-card small{color:rgba(244,239,232,.4);font:760 .54rem/1 var(--cp-font-mono);letter-spacing:.1em}.world-card strong{font-size:.72rem}.world-card>span{height:.18rem;overflow:hidden;background:rgba(255,255,255,.07)}.world-card>span i{display:block;width:72%;height:100%;background:linear-gradient(90deg,var(--cover-gold),rgba(244,239,232,.68))}.world-card--governed>span i{width:48%;background:linear-gradient(90deg,var(--cover-red-bright),var(--cover-gold))}.stage-footer{position:absolute;right:0;bottom:0;left:0;border-top:1px solid rgba(255,255,255,.08);font-size:.52rem}.stage-footer span{display:inline-flex;align-items:center;gap:.42rem}.stage-footer i{color:var(--cover-gold)}
.cover-process { position:relative; z-index:4; border-top:1px solid rgba(255,255,255,.08); background:rgba(8,6,7,.66); backdrop-filter:blur(16px); }.cover-process ol{display:grid;width:min(100%,94rem);grid-template-columns:repeat(4,minmax(0,1fr));margin:0 auto;padding:0 clamp(1.25rem,4vw,4.75rem);list-style:none}.cover-process li{display:grid;min-height:4.4rem;grid-template-columns:auto 1fr auto;align-items:center;gap:.65rem;border-right:1px solid rgba(255,255,255,.07);padding:0 1.35rem}.cover-process li:first-child{border-left:1px solid rgba(255,255,255,.07)}.cover-process li span{color:var(--cover-red-bright);font:780 .6rem/1 var(--cp-font-mono)}.cover-process li strong{color:rgba(244,239,232,.65);font-size:.69rem}.cover-process li i{color:rgba(244,239,232,.18);font-size:.58rem}
@media(max-width:1100px){.cover-nav__race{display:none}.cover-main{grid-template-columns:minmax(0,1fr) minmax(25rem,.85fr);gap:2rem}.cover-copy h1{font-size:clamp(2.6rem,5vw,4.5rem)}.simulation-stage{min-height:31rem}.stage-network{height:21.5rem}}
@media(max-width:899px){.cover-nav{grid-template-columns:auto 1fr;gap:1rem}.cover-nav__actions{justify-self:end}.cover-nav__case{display:none}.cover-main{grid-template-columns:1fr;align-items:start;padding-top:3rem}.cover-copy{max-width:46rem}.simulation-stage{width:min(100%,39rem);min-height:31.5rem;margin:0 auto}.cover-process ol{grid-template-columns:repeat(2,1fr)}.cover-process li:nth-child(3){border-left:1px solid rgba(255,255,255,.07);border-top:1px solid rgba(255,255,255,.07)}.cover-process li:nth-child(4){border-top:1px solid rgba(255,255,255,.07)}}
  @media(max-width:599px){.cover-nav{min-height:4.35rem;padding:0 1rem}.cover-brand__name{display:none}.cover-brand__mark{width:2.2rem;height:2.2rem}.cover-nav__actions{gap:.45rem}.cover-nav__enter{width:2.65rem;padding:0;font-size:0}.cover-nav__enter i{font-size:.75rem}.cover-main{gap:2.2rem;padding:2.5rem 1rem 1.5rem}.cover-kicker{align-items:flex-start;flex-direction:column;gap:.55rem}.cover-kicker>b{padding-left:0;border-left:0}.cover-copy h1{font-size:clamp(2.45rem,12vw,3.4rem)}.cover-page--zh .cover-copy h1{font-size:clamp(2.05rem,9vw,2.8rem);letter-spacing:-.065em}.cover-description{font-size:.84rem;line-height:1.68}.cover-actions{display:grid}.cover-primary,.cover-secondary{width:100%}.cover-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}.cover-stats div{padding-left:.55rem}.cover-stats dd{font-size:.56rem}.simulation-stage{min-height:27rem;border-radius:.9rem}.stage-network{height:18rem}.stage-network svg{transform:scale(1.12)}.forum-live{top:4%}.event-core{top:42%;width:10rem}.world-cards{right:.75rem;bottom:3.85rem;left:.75rem;gap:.5rem}.world-card{padding:.7rem}.world-card strong{font-size:.62rem}.stage-footer{padding:.9rem .75rem}.stage-footer span:last-child{display:none}.cover-process ol{padding:0}.cover-process li{min-height:3.8rem;padding:0 .75rem}.cover-process li strong{font-size:.62rem}.cover-process li i{display:none}}
@media(prefers-reduced-motion:reduce){.cover-page *{scroll-behavior:auto}.cover-primary,.cover-secondary{transition:none}}
</style>
