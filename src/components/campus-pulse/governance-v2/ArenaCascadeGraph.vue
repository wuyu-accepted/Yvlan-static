<script setup>
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { Graph } from '@antv/g6'

const props = defineProps({
  point: {
    type: Object,
    required: true,
  },
})

const host = ref(null)
let graph

function graphData() {
  const edges = props.point.cascade_groups
  const groupIds = [...new Set(
    edges.flatMap((edge) => [edge.source_group, edge.target_group]),
  )]
  const width = host.value?.clientWidth || 480
  const height = host.value?.clientHeight || 300
  const nodes = groupIds.map((id, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, groupIds.length) - Math.PI / 2
    const inbound = edges
      .filter((edge) => edge.target_group === id)
      .reduce((sum, edge) => sum + edge.rumor + edge.verified, 0)
    return {
      id,
      style: {
        x: width / 2 + Math.cos(angle) * Math.min(width * 0.34, 170),
        y: height / 2 + Math.sin(angle) * Math.min(height * 0.34, 100),
        size: 14 + Math.min(24, Math.sqrt(inbound) * 1.9),
        fill: '#183a42',
        stroke: '#5be0d0',
        lineWidth: 1.2,
        labelText: id.replace('archetype-', '群体 '),
        labelFill: '#dff6f2',
        labelFontSize: 9,
      },
    }
  })
  return {
    nodes,
    edges: edges.map((edge, index) => {
      const verifiedDominant = edge.verified >= edge.rumor
      return {
        id: `aggregate-cascade-${index}`,
        source: edge.source_group,
        target: edge.target_group,
        style: {
          stroke: verifiedDominant ? '#50dfcb' : '#ff7187',
          lineWidth: 1 + Math.min(4, (edge.rumor + edge.verified) / 12),
          lineDash: edge.bridge ? [5, 4] : [],
          opacity: 0.3 + Math.min(0.6, (edge.rumor + edge.verified) / 25),
          endArrow: true,
        },
      }
    }),
  }
}

async function renderGraph() {
  if (!host.value) return
  graph?.destroy()
  graph = null
  if (!props.point.cascade_groups.length) return
  graph = new Graph({
    container: host.value,
    width: host.value.clientWidth,
    height: host.value.clientHeight,
    data: graphData(),
    animation: false,
    behaviors: ['drag-canvas', 'zoom-canvas'],
  })
  await graph.render()
}

function resize() {
  renderGraph()
}

watch(
  () => props.point,
  async () => {
    await nextTick()
    await renderGraph()
  },
)

onMounted(async () => {
  window.addEventListener('resize', resize)
  await renderGraph()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  graph?.destroy()
})
</script>

<template>
  <section class="cascade">
    <header>
      <div>
        <span>AGGREGATE MESSAGE CASCADES</span>
        <h2>群体级消息级联</h2>
      </div>
      <b>FULLY SYNTHETIC</b>
    </header>

    <div class="flow-kpis">
      <div>
        <span>公开发出</span>
        <strong>{{ Math.round(point.diffusion.emissions) }}</strong>
      </div>
      <div>
        <span>有限阅读</span>
        <strong>{{ Math.round(point.diffusion.reads) }}</strong>
      </div>
      <div>
        <span>转发 / 纠错</span>
        <strong>
          {{ Math.round(point.diffusion.reposts) }}
          <i>/</i>
          {{ Math.round(point.diffusion.corrections) }}
        </strong>
      </div>
      <div>
        <span>级联深度</span>
        <strong>{{ point.diffusion.cascade_depth.toFixed(1) }}</strong>
      </div>
    </div>

    <div v-if="point.cascade_groups.length" ref="host" class="graph" />
    <div v-else class="empty">
      本时点没有达到公共导出阈值的群体级传播边
    </div>

    <footer>
      <span><i class="rumor" />错误信息占优</span>
      <span><i class="verified" />核验信息占优</span>
      <span><i class="bridge" />跨群桥接</span>
      <b>桥接占比 {{ (point.diffusion.bridge_share * 100).toFixed(1) }}%</b>
    </footer>
  </section>
</template>

<style scoped>
.cascade {
  min-width: 0;
}

header,
footer,
.flow-kpis {
  display: flex;
  align-items: center;
}

header {
  justify-content: space-between;
  gap: 14px;
}

header span {
  color: #8fc0ff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

h2 {
  margin: 6px 0 0;
  color: #f4faf9;
  font-size: 22px;
}

header > b {
  padding: 7px 9px;
  border: 1px solid rgba(143, 192, 255, 0.3);
  border-radius: 6px;
  color: #8fc0ff;
  font-size: 9px;
  letter-spacing: 0.08em;
}

.flow-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
  margin-top: 16px;
}

.flow-kpis div {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(131, 175, 183, 0.12);
  border-radius: 8px;
  background: rgba(9, 26, 31, 0.8);
}

.flow-kpis span {
  display: block;
  overflow: hidden;
  color: #839ba1;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-kpis strong {
  display: block;
  margin-top: 4px;
  color: #eef9f7;
  font: 800 16px ui-monospace, monospace;
}

.flow-kpis strong i {
  color: #5d7278;
  font-style: normal;
}

.graph,
.empty {
  height: 290px;
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid rgba(95, 220, 207, 0.1);
  border-radius: 12px;
  background: #071216;
}

.empty {
  display: grid;
  place-items: center;
  padding: 24px;
  color: #70888e;
  font-size: 12px;
  text-align: center;
}

footer {
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-top: 11px;
  color: #879ca2;
  font-size: 10px;
}

footer span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

footer i {
  width: 15px;
  height: 2px;
}

footer .rumor { background: #ff7187; }
footer .verified { background: #50dfcb; }
footer .bridge {
  height: 0;
  border-top: 2px dashed #d9a56d;
  background: transparent;
}

footer b {
  margin-left: auto;
  color: #d6e8e5;
}

@media (max-width: 560px) {
  .flow-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .graph,
  .empty {
    height: 250px;
  }

  footer b {
    width: 100%;
    margin-left: 0;
  }
}
</style>
