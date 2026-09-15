<template>
  <div class="human-loop">
    <header class="hl-header">
      <h1>🧪 破默 — 谣言沉默螺旋治理推演</h1>
      <el-tag :type="statusType" size="large">{{ statusText }}</el-tag>
    </header>

    <div class="hl-grid">
      <!-- 左：模拟状态 + 干预面板 -->
      <div class="hl-left">
        <el-card shadow="hover">
          <template #header><span>📡 模拟状态</span></template>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="当前轮次">{{ round }} / {{ maxSteps }}</el-descriptions-item>
            <el-descriptions-item label="帖子池规模">{{ poolSize }}</el-descriptions-item>
            <el-descriptions-item label="Agent 数量">{{ agentCount }}</el-descriptions-item>
            <el-descriptions-item label="当前干预">{{ interventionMode }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="hover" v-if="!done && running" style="margin-top:12px">
          <template #header><span>🛠 本轮干预选择</span></template>
          <el-radio-group v-model="selectedMode" size="default">
            <el-radio-button v-for="iv in interventions" :key="iv.id" :value="iv.id">
              {{ iv.label }}
            </el-radio-button>
          </el-radio-group>
          <div style="margin-top:10px;color:#94a3b8;font-size:0.85rem">
            {{ interventions.find(i=>i.id===selectedMode)?.desc }}
          </div>
          <el-button type="primary" @click="doIntervene" :loading="acting" style="margin-top:12px;width:100%">
            ⏭ 确认干预，进入下一轮
          </el-button>
        </el-card>

        <el-card shadow="hover" v-if="done" style="margin-top:12px">
          <template #header><span>✅ 模拟结束</span></template>
          <p>共完成 {{ round }} 轮，最终帖子池 {{ poolSize }} 条。</p>
          <el-button @click="loadFinal">查看完整结果</el-button>
        </el-card>
      </div>

      <!-- 右：帖子流 + 历史 -->
      <div class="hl-right">
        <el-card shadow="hover">
          <template #header><span>📝 最新帖子（实时信息流预览）</span></template>
          <div class="post-feed">
            <div v-for="(p,i) in posts" :key="i" class="post-item" :style="{borderLeftColor: typeColor(p.type)}">
              <span class="post-author">@{{ p.author || '?' }}</span>
              <span class="post-text">{{ p.text?.substring(0,80) }}{{ (p.text||'').length>80?'…':'' }}</span>
            </div>
            <div v-if="!posts.length" style="color:#94a3b8">尚无帖子…</div>
          </div>
        </el-card>

        <el-card shadow="hover" style="margin-top:12px">
          <template #header><span>📋 干预历史</span></template>
          <el-timeline>
            <el-timeline-item v-for="h in history" :key="h.round" :timestamp="'第'+h.round+'轮'" placement="top">
              {{ modeLabel(h.mode) }} — 池规模 {{ h.pool_size }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const round = ref(0); const maxSteps = ref(8); const poolSize = ref(0)
const agentCount = ref(0); const interventionMode = ref('none')
const running = ref(false); const done = ref(false); const posts = ref([])
const history = ref([]); const interventions = ref([])
const selectedMode = ref('none'); const acting = ref(false)
let timer = null

const API = 'http://localhost:8765'

const statusType = computed(() => done.value ? 'success' : (running.value ? 'warning' : 'info'))
const statusText = computed(() => done.value ? '已完成' : (running.value ? '等待干预' : '初始化中'))

async function refresh() {
  try { const r = await fetch(API+'/state'); const s = await r.json()
    round.value = s.round; maxSteps.value = s.maxSteps; poolSize.value = s.pool_size
    agentCount.value = s.agent_count; interventionMode.value = s.intervention_mode
    running.value = s.running; done.value = s.done; history.value = s.history || []
    interventions.value = s.interventions || []; posts.value = (s.post_preview||[]).map(t=>({text:t,author:'?',type:''}))
    if (s.done) clearInterval(timer)
  } catch(e) {}
}

async function doIntervene() {
  acting.value = true
  await fetch(API+'/intervene', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:selectedMode.value})})
  acting.value = false; await refresh()
}

async function loadFinal() {
  const r = await fetch(API+'/final'); const s = await r.json()
  posts.value = (s.recent_posts||[]).map(p=>({text:p.text,author:p.author,type:p.type}))
}

function typeColor(t) { return t==='rumor'?'#e53e3e':t==='factcheck'?'#38a169':t==='neutral'?'#2b6cb0':'#718096' }
function modeLabel(m) { const map={none:'不干预',delete:'删除谣言',command_debunk:'命令辟谣',evidence_debunk:'证据辟谣',boost_visibility:'提升质疑'}; return map[m]||m }

onMounted(()=>{refresh();timer=setInterval(refresh,4000)})
onUnmounted(()=>clearInterval(timer))
</script>

<style scoped>
.human-loop{min-height:100vh;background:#0f172a;color:#e2e8f0}
.hl-header{display:flex;align-items:center;gap:16px;padding:16px 24px;background:#1e293b;border-bottom:2px solid #334155}
.hl-header h1{font-size:1.3rem;color:#f8fafc;margin:0}
.hl-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;max-width:1400px;margin:0 auto}
.hl-left,.hl-right{display:flex;flex-direction:column;gap:0}
.post-feed{max-height:420px;overflow-y:auto}
.post-item{padding:8px 10px;margin:4px 0;background:#0f172a;border-radius:6px;font-size:.82rem;border-left:3px solid #475569}
.post-author{color:#60a5fa;margin-right:8px;font-weight:600}
.post-text{color:#cbd5e1}
</style>
