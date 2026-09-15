<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { Application, Graphics } from 'pixi.js'

const props = defineProps({
  frameReader: {
    type: Object,
    required: true,
  },
  scenarioId: {
    type: String,
    required: true,
  },
  schemeId: {
    type: String,
    required: true,
  },
  tick: {
    type: Number,
    required: true,
  },
  point: {
    type: Object,
    required: true,
  },
  activationSummary: {
    type: Object,
    default: null,
  },
})

const host = ref(null)
const fps = ref(0)
let app
let layers = []
let actionLayer
let destroyed = false
let frameCounter = 0
let frameStartedAt = performance.now()
let layout = []

const beliefColors = [
  0xff647c,
  0x8b9db0,
  0x4fe4ce,
]
const probeStrata = computed(() => Object.entries(
  props.point?.probe?.allocation_by_stratum || {},
))

function buildLayout() {
  layout = Array.from(
    { length: props.frameReader.count },
    (_, ordinal) => props.frameReader.readLayout(ordinal),
  )
}

function render() {
  if (!app?.renderer || !host.value || !layout.length) return
  const frame = props.frameReader.readFrame(
    props.scenarioId,
    props.schemeId,
    props.tick,
  )
  layers.forEach((layer) => layer.clear())
  actionLayer.clear()
  const width = app.renderer.width
  const height = app.renderer.height
  for (let ordinal = 0; ordinal < layout.length; ordinal += 1) {
    const location = layout[ordinal]
    const state = frame.read(ordinal)
    const stance = state.belief < -0.16 ? 0 : state.belief > 0.16 ? 2 : 1
    const bright = state.attention >= 0.52 ? 1 : 0
    const size = 1.15 + state.weight_bin * (1.55 / 255) + bright * 0.35
    const x = location.x * width
    const y = location.y * height
    layers[stance * 2 + bright].rect(x, y, size, size)
    if (state.public_action > 0) actionLayer.circle(x, y, 3.5)
  }
  layers.forEach((layer, index) => {
    layer.fill({
      color: beliefColors[Math.floor(index / 2)],
      alpha: index % 2 === 1 ? 0.95 : 0.30,
    })
  })
  actionLayer.stroke({ color: 0xffffff, width: 0.75, alpha: 0.7 })
}

async function init() {
  buildLayout()
  app = new Application()
  await app.init({
    resizeTo: host.value,
    antialias: false,
    backgroundAlpha: 0,
    preference: 'webgl',
  })
  if (destroyed) {
    app.destroy(true)
    return
  }
  host.value.appendChild(app.canvas)
  layers = Array.from({ length: 6 }, () => new Graphics())
  actionLayer = new Graphics()
  layers.forEach((layer) => app.stage.addChild(layer))
  app.stage.addChild(actionLayer)
  app.ticker.add(() => {
    frameCounter += 1
    const now = performance.now()
    if (now - frameStartedAt >= 1000) {
      fps.value = Math.round((frameCounter * 1000) / (now - frameStartedAt))
      frameCounter = 0
      frameStartedAt = now
    }
  })
  render()
}

function resize() {
  render()
}

watch(
  () => [props.scenarioId, props.schemeId, props.tick],
  async () => {
    await nextTick()
    render()
  },
)

onMounted(async () => {
  window.addEventListener('resize', resize)
  await init()
})

onBeforeUnmount(() => {
  destroyed = true
  window.removeEventListener('resize', resize)
  app?.destroy(true)
})
</script>

<template>
  <section class="particle-field" aria-label="真实量化粒子状态场">
    <header>
      <div>
        <span>REAL QUANTIZED PARTICLE FRAMES</span>
        <h2>10,000 粒子状态场</h2>
      </div>
      <strong>{{ fps }} FPS</strong>
    </header>
    <div ref="host" class="particle-host">
      <div class="axis horizontal" />
      <div class="axis vertical" />
      <div class="probe-projection">
        <small>
          {{ activationSummary ? '匿名 LLM 激活投影' : '匿名探针投影' }}
        </small>
        <b v-if="activationSummary">
          {{ activationSummary.anchorTurns }} A +
          {{ activationSummary.ppsTurns }} PPS
        </b>
        <b v-else>{{ point.probe.budget }} / 32</b>
        <div v-if="activationSummary" class="activation-rings">
          <span class="anchor">A {{ activationSummary.anchorTurns }}</span>
          <span class="pps">PPS {{ activationSummary.ppsTurns }}</span>
        </div>
        <div v-if="probeStrata.length" class="probe-strata">
          <span
            v-for="([label, count], index) in probeStrata"
            :key="label"
            :title="`${label}: ${count}`"
            :style="{ '--probe-glow': `${Math.max(3, Number(count))}px` }"
          >
            {{ index + 1 }}
          </span>
        </div>
      </div>
    </div>
    <footer>
      <span><i class="opposition" />反对信念</span>
      <span><i class="neutral" />不确定</span>
      <span><i class="support" />支持信念</span>
      <span>亮度 = 注意力</span>
      <span>大小 = 设计权重分箱</span>
      <span>光圈 = 公开行动</span>
    </footer>
  </section>
</template>

<style scoped>
.particle-field {
  min-width: 0;
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

header span {
  color: #56dfce;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

h2 {
  margin: 6px 0 0;
  color: #f4faf9;
  font-size: clamp(20px, 2vw, 28px);
}

header strong {
  min-width: 70px;
  color: #90a8af;
  font: 700 13px/1.2 ui-monospace, SFMono-Regular, monospace;
  text-align: right;
}

.particle-host {
  position: relative;
  height: 430px;
  margin-top: 18px;
  overflow: hidden;
  border: 1px solid rgba(91, 225, 208, 0.16);
  border-radius: 16px;
  background:
    radial-gradient(circle at 50% 50%, rgba(38, 103, 106, 0.17), transparent 58%),
    linear-gradient(rgba(95, 219, 207, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(95, 219, 207, 0.03) 1px, transparent 1px),
    #071216;
  background-size: auto, 32px 32px, 32px 32px, auto;
}

.particle-host :deep(canvas) {
  position: relative;
  z-index: 2;
  display: block;
}

.axis {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  background: rgba(108, 227, 212, 0.12);
}

.axis.horizontal {
  top: 50%;
  right: 0;
  left: 0;
  height: 1px;
}

.axis.vertical {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}

.probe-projection {
  position: absolute;
  z-index: 4;
  top: 14px;
  right: 14px;
  display: grid;
  padding: 8px 11px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(4, 16, 20, 0.78);
  color: #e8f6f4;
  text-align: right;
}

.probe-projection small {
  color: #8da3a9;
  font-size: 9px;
}

.probe-projection b {
  margin-top: 3px;
  font: 800 14px ui-monospace, monospace;
}

.probe-strata {
  display: grid;
  grid-template-columns: repeat(6, 12px);
  gap: 4px;
  margin-top: 7px;
}

.activation-rings {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
  margin-top: 7px;
}

.activation-rings span {
  padding: 3px 6px;
  border-radius: 999px;
  font: 700 7px/1 ui-monospace, monospace;
}

.activation-rings .anchor {
  border: 1px double rgba(196, 168, 255, 0.8);
  color: #d8c7ff;
  box-shadow: 0 0 8px rgba(190, 157, 255, 0.35);
}

.activation-rings .pps {
  border: 1px solid rgba(117, 255, 231, 0.75);
  color: #bafff3;
  box-shadow: 0 0 8px rgba(83, 241, 216, 0.35);
}

.probe-strata span {
  display: grid;
  width: 12px;
  height: 12px;
  place-items: center;
  border: 1px solid rgba(117, 255, 231, 0.75);
  border-radius: 50%;
  background: rgba(69, 226, 204, 0.2);
  box-shadow: 0 0 var(--probe-glow) rgba(83, 241, 216, 0.72);
  color: rgba(226, 255, 250, 0.9);
  font: 700 7px/1 ui-monospace, monospace;
}

footer {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 12px;
  color: #8fa3a8;
  font-size: 11px;
}

footer span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

footer i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.opposition { background: #ff647c; }
.neutral { background: #8b9db0; }
.support { background: #4fe4ce; }

@media (max-width: 720px) {
  .particle-host {
    height: 360px;
  }

  footer {
    gap: 8px 14px;
  }
}
</style>
