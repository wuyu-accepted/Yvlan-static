<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { currentLocale, useCampusPulseDomLocalization } from '../i18n/locale.ts'

const pageRoot = ref<HTMLElement | null>(null)
useCampusPulseDomLocalization(pageRoot)

const innovations = [
  { icon: 'fa-database', kicker: '数据基础', title: '真实数据驱动的人群孪生', text: '从脱敏论坛语义中提取行为情境、角色与 Profile，在不还原现实身份的前提下保留人群异质性。', facts: ['17 个宏角色', '120 个微角色', '22,477 个 Profile'] },
  { icon: 'fa-arrows-rotate', kicker: '认知引擎', title: 'SMC 认知状态双向闭环', text: '状态粒子约束 LLM 的表达边界，LLM 已表露的立场又作为观测值反向更新粒子权重，避免让模型直接自报心理数值。', facts: ['10 粒子 / Agent', '12 维认知状态', 'ESS 退化重采样'] },
  { icon: 'fa-layer-group', kicker: '传播结构', title: '六重约束与双层传播网络', text: '身份、利益位置、动态认知、局部观测、行为连续性和结构化动作共同限制 Agent，公开论坛与私聊网络分别承载显性与隐性传播。', facts: ['6 重行为约束', '公共 + 私有渠道', '8 条初始关系 / Agent'] },
  { icon: 'fa-code-branch', kicker: '实验设计', title: '可比较的平行孪生实验', text: '干预前共享历史、随机种子与动作预算，只在指定决策点分叉，使不同治理策略的差异能够被追踪与量化。', facts: ['共享演化前缀', '强制策略分叉', '反事实 + 双重差分'] },
]

const qualityMetrics = [
  { value: '0.0053', label: '讨论帖规模 JS 散度', note: '越接近 0，宏观分布越相似' },
  { value: '95.8%', label: '上下文承接率', note: '基础交互质量评测' },
  { value: '0.0%', label: '虚假事实编造率', note: '在报告评测样本中' },
  { value: '99.3%', label: 'LLM 输出与粒子更新对齐率', note: '语义表达与状态更新一致性' },
]

const researchFocus = [
  { index: 'A', label: '人群建模', question: '如何在不还原真实身份的前提下，保留论坛人群的行为异质性？', answer: '脱敏语义情境 → 角色聚类 → Profile → 合成 Agent' },
  { index: 'B', label: '认知约束', question: '如何让 LLM 的文本表达与动态心理状态长期保持一致？', answer: 'SMC 粒子状态 ↔ LLM 表达的双向闭环' },
  { index: 'C', label: '政策评估', question: '如何把治理策略的差异与随机演化的差异分离开？', answer: '共享历史前缀 → 决策点强制分叉 → 反事实对照' },
]

const updateTitle = () => {
  document.title = currentLocale.value === 'en-US'
    ? 'Innovation & evaluation · CampusPulse'
    : '创新与评测 · CampusPulse'
}
onMounted(updateTitle)
watch(currentLocale, updateTitle)
</script>

<template>
  <main ref="pageRoot" class="innovation-page">
    <nav class="breadcrumb" aria-label="面包屑">
      <RouterLink to="/campus-pulse/system">系统与数据</RouterLink><i class="fa-solid fa-chevron-right" aria-hidden="true" /><span>创新与评测</span>
    </nav>

    <header class="innovation-hero">
      <div>
        <span class="eyebrow">INNOVATION · EVALUATION</span>
        <h1>把社会模拟从“能运行”<br><em>推进到“可检查”。</em></h1>
        <p>CampusPulse 将真实数字足迹映射为异质性 Agent，用认知粒子限制大模型表达，并通过共享历史前缀的平行推演比较治理策略。</p>
        <div class="hero-tags" aria-label="Platform principles"><span>TRACEABLE</span><span>COUNTERFACTUAL</span><span>AUDITABLE</span></div>
      </div>
      <aside class="hero-proof" aria-label="系统规模">
        <div><strong>1,000</strong><span>异质性 Agent</span></div>
        <div><strong>10,000</strong><span>总状态粒子</span></div>
        <div><strong>2</strong><span>类实证场景</span></div>
      </aside>
    </header>

    <section class="research-focus" aria-labelledby="research-focus-title">
      <header>
        <span class="focus-marker">RESEARCH<br>FOCUS</span>
        <div><span class="eyebrow">研究主线</span><h2 id="research-focus-title">我们集中回答三个问题</h2></div>
      </header>
      <div class="focus-grid">
        <article v-for="focus in researchFocus" :key="focus.index">
          <span>{{ focus.index }}</span><small>{{ focus.label }}</small>
          <h3>{{ focus.question }}</h3><p>{{ focus.answer }}</p>
        </article>
      </div>
    </section>

    <section class="chapter" aria-labelledby="innovation-title">
      <header class="chapter-heading">
        <div><span class="chapter-number">01</span><h2 id="innovation-title">四项核心创新</h2></div>
        <p>从人群建模、个体状态到信息传播和对照实验，把模型生成纳入可追踪的系统约束。</p>
      </header>
      <div class="twin-pipeline" aria-label="从真实数字足迹到合成人群的映射管线">
        <header><span class="eyebrow">DATA → DIGITAL TWIN</span><div><h3>真实数字足迹如何成为合成人群</h3><p>从脱敏论坛语义中提取主题、需求、互动方式和人物资料。</p></div></header>
        <ol>
          <li><strong>586,970</strong><span>原始帖子与评论</span><small>4 YEARS</small></li>
          <li><strong>582,408</strong><span>去重语义行</span><small>DEDUPLICATED</small></li>
          <li><strong>131,604</strong><span>行为情境</span><small>CONTEXTS</small></li>
          <li><strong>22,477</strong><span>Profile 集合</span><small>PROFILES</small></li>
          <li class="pipeline-result"><strong>1,000</strong><span>异质性 Agent</span><small>DIGITAL TWIN</small></li>
        </ol>
      </div>
      <div class="innovation-grid">
        <article v-for="item in innovations" :key="item.title" class="innovation-card">
          <header><span class="card-kicker">{{ item.kicker }}</span><i class="fa-solid" :class="item.icon" aria-hidden="true" /></header>
          <h3>{{ item.title }}</h3><p>{{ item.text }}</p>
          <ul><li v-for="fact in item.facts" :key="fact">{{ fact }}</li></ul>
        </article>
      </div>
    </section>

    <section class="loop-panel" aria-labelledby="loop-title">
      <div class="loop-copy"><span class="eyebrow">CORE MECHANISM</span><h2 id="loop-title">粒子与 LLM 的双向认知闭环</h2><p>系统先将粒子期望写入生成上下文，再把 Agent 的实际表达作为观测，通过贝叶斯似然更新权重。</p></div>
      <div class="loop-diagram" aria-label="SMC 双向闭环流程">
        <div><small>STATE</small><strong>10 个粒子</strong><span>12 维隐状态</span></div>
        <i class="fa-solid fa-arrow-right-long" aria-hidden="true" />
        <div class="loop-core"><small>GENERATION</small><strong>LLM 表达</strong><span>文本、行为与立场</span></div>
        <i class="fa-solid fa-arrow-right-long" aria-hidden="true" />
        <div><small>UPDATE</small><strong>权重更新</strong><span>ESS 监测与重采样</span></div>
      </div>
      <p class="loop-return"><i class="fa-solid fa-arrow-rotate-left" aria-hidden="true" /> 新状态返回下一个 Tick，继续限制 Agent 的语义边界</p>
    </section>

    <section class="chapter" aria-labelledby="quality-title">
      <header class="chapter-heading"><div><span class="chapter-number">02</span><h2 id="quality-title">模拟真实性与一致性</h2></div><p>评测数字来自报告中的真实论坛对齐、微观一致性和约束消融实验。</p></header>
      <div class="metric-grid"><article v-for="metric in qualityMetrics" :key="metric.label"><strong>{{ metric.value }}</strong><h3>{{ metric.label }}</h3><p>{{ metric.note }}</p></article></div>
      <div class="validation-map" aria-label="从宏观生态到治理效能的四层验证框架">
        <header><span class="eyebrow">VALIDATION FRAMEWORK</span><h3>从论坛生态到治理响应的四维评估</h3></header>
        <ol>
          <li><span>01</span><div><strong>宏观生态</strong><small>回复规模分布与真实论坛对齐</small></div><b>JS 0.0053</b></li>
          <li><span>02</span><div><strong>微观一致性</strong><small>上下文、语言风格与状态对齐</small></div><b>99.3%</b></li>
          <li><span>03</span><div><strong>群体异质性</strong><small>利益位置能解释演化后的群体差异</small></div><b>p = 0.005</b></li>
          <li><span>04</span><div><strong>治理动作效能</strong><small>用平行分支和双重差分检查政策响应</small></div><b>DID</b></li>
        </ol>
      </div>
      <div class="ablation-panel">
        <div><span class="eyebrow">ABLATION STUDY</span><h3>完整输入确实改变了 Agent 行为</h3><p>固定外部环境，对比纯上下文、Profile 约束、状态约束与完整输入。</p></div>
        <dl><div><dt>75%</dt><dd>改变主动作</dd></div><div><dt>91.7%</dt><dd>改变情绪表现</dd></div><div><dt>66.7%</dt><dd>改变私聊触发</dd></div><div><dt>70.8%</dt><dd>约束条件识别率</dd></div></dl>
      </div>
    </section>

    <section class="chapter" aria-labelledby="comparison-title">
      <header class="chapter-heading"><div><span class="chapter-number">03</span><h2 id="comparison-title">平行策略对比</h2></div><p>同一事件共享干预前历史，在决策点分为 Natural 与综合干预 D，避免把不同起点误认为政策差异。</p></header>
      <div class="timeline" aria-label="平行孪生分叉时间线"><span>共享初始状态</span><i /><span>事件投入</span><i /><span>锁定共同前缀</span><b>策略分叉</b><div><em>NATURAL</em><em>D · 综合干预</em></div></div>
      <div class="case-grid">
        <article><span>CASE 01 · 突发冲突</span><h3>干预使议题集中，但发言量未减少</h3><dl><div><dt>167 → 173</dt><dd>发言总量</dd></div><div><dt>22 → 4</dt><dd>争论主张</dd></div><div><dt>0.392 → 0.424</dt><dd>群体信任度</dd></div></dl><p>官方渠道将分散的负面表达聚合为对责任与时限的直接质询。</p></article>
        <article><span>CASE 02 · 资源争议</span><h3>服务闭环有效，不等于信任已恢复</h3><dl><div><dt>73 → 76</dt><dd>发言总量</dd></div><div><dt>17 → 10</dt><dd>争论主张</dd></div><div class="negative"><dt>0.429 → 0.375</dt><dd>群体信任度</dd></div></dl><p>工单将服务积压降至零，但在实质资源不足时，程序公开也可能引发新的质询。</p></article>
      </div>
      <div class="governance-chart" aria-labelledby="governance-chart-title">
        <header><span class="eyebrow">COUNTERFACTUAL SIGNAL</span><div><h3 id="governance-chart-title">干预后的信任轨迹</h3><p>从同一决策基线出发，两次治理介入都促成议题收敛，却将群体信任推向不同方向。</p></div></header>
        <div class="trajectory-layout">
          <div class="trajectory-plot" role="img" aria-label="两个治理案例从共同决策点走向相反信任结果的动态轨迹">
            <svg viewBox="0 0 620 330" aria-hidden="true">
              <defs><linearGradient id="trajectoryUp" x1="0" x2="1"><stop stop-color="#ae0b2a"/><stop offset="1" stop-color="#ae0b2a"/></linearGradient><linearGradient id="trajectoryDown" x1="0" x2="1"><stop stop-color="#9b8a5c"/><stop offset="1" stop-color="#9b8a5c"/></linearGradient></defs>
              <path class="trajectory-grid" d="M70 55H585M70 165H585M70 275H585M180 30V300M310 30V300M440 30V300M570 30V300"/>
              <path class="trajectory-base" d="M45 165H178"/><circle class="origin-node" cx="178" cy="165" r="7"/>
              <path class="trajectory-ghost" d="M178 165C270 165 330 83 515 76"/><path class="trajectory-branch branch--conflict" d="M178 165C270 165 330 83 515 76"/>
              <path class="trajectory-ghost" d="M178 165C267 165 325 231 474 242"/><path class="trajectory-branch branch--resource" d="M178 165C267 165 325 231 474 242"/>
              <circle class="endpoint-halo halo--conflict" cx="515" cy="76" r="21"/><circle class="endpoint endpoint--conflict" cx="515" cy="76" r="8"/>
              <circle class="endpoint-halo halo--resource" cx="474" cy="242" r="18"/><circle class="endpoint endpoint--resource" cx="474" cy="242" r="8"/>
            </svg>
            <span class="plot-axis plot-axis--positive">信任提升</span><span class="plot-axis plot-axis--negative">信任受损</span>
            <span class="plot-origin">共同决策点</span>
            <span class="plot-result plot-result--conflict"><b>CASE 01</b><strong>+0.032</strong></span>
            <span class="plot-result plot-result--resource"><b>CASE 02</b><strong>−0.054</strong></span>
          </div>
          <div class="trajectory-cards">
            <article class="trajectory-card trajectory-card--conflict"><header><span>CASE 01</span><strong>突发冲突</strong><em>信任提升</em></header><dl><div><dt>−81.8%</dt><dd>争论主张</dd></div><div><dt>+6</dt><dd>发言变化</dd></div><div><dt>+0.032</dt><dd>信任变化</dd></div></dl><p>议题显著收敛，讨论仍保持活跃，信任同步回升。</p></article>
            <article class="trajectory-card trajectory-card--resource"><header><span>CASE 02</span><strong>资源争议</strong><em>信任受损</em></header><dl><div><dt>−41.2%</dt><dd>争论主张</dd></div><div><dt>+3</dt><dd>发言变化</dd></div><div><dt>−0.054</dt><dd>信任变化</dd></div></dl><p>服务闭环并未抵消资源不足带来的程序性质询。</p></article>
          </div>
        </div>
        <footer><strong>关键发现</strong><span>治理可以让议题收敛，却不必然降低讨论量，也不自动修复信任。</span></footer>
      </div>
      <blockquote class="research-finding">
        <span>KEY FINDING · 核心发现</span>
        <p>“服务承接有效”，不等于“程序正当性与群体信任已建立”。</p>
        <small>综合干预将资源争议的服务积压降至 0，但群体信任度从 Natural 的 0.429 下降至 0.375。</small>
      </blockquote>
      <RouterLink class="case-link" to="/campus-pulse/results">进入案例中心查看完整分支证据 <i class="fa-solid fa-arrow-right" aria-hidden="true" /></RouterLink>
    </section>

    <section class="chapter boundary-chapter" aria-labelledby="boundary-title">
      <header class="chapter-heading"><div><span class="chapter-number">04</span><h2 id="boundary-title">证据口径与适用边界</h2></div><p>评估对象为指定场景中的合成 Agent 群体。</p></header>
      <div class="boundary-panel">
        <ul><li>Agent 依据脱敏人物资料与合成关系参与模拟。</li><li>极端热点长尾仍有差距：模拟/真实 P99 回复数为 11/33，最大回复数为 15/590。</li><li>回复率与群体信息差分别衡量论坛活跃度和信息分布，按各自统计定义比较。</li><li>所有结论受初始条件、数据覆盖、随机种子、策略定义与发布门禁约束。</li></ul>
        <div><RouterLink to="/campus-pulse/system?tab=evidence">查看证据目录</RouterLink><RouterLink to="/campus-pulse/system?tab=disclosure">查看架构与数据边界</RouterLink></div>
      </div>
    </section>
  </main>
</template>

<style scoped>

.innovation-page { display:grid; gap:32px; max-width:1280px; margin:auto; padding:24px var(--cp-content-gutter) 48px; color:var(--cp-text-primary); }
.breadcrumb { display:flex; flex-wrap:wrap; align-items:center; gap:10px; font-size:12px; color:var(--cp-text-secondary); }
.breadcrumb a,.case-link,.boundary-panel a { color:var(--cp-action-primary); text-underline-offset:4px; }
.breadcrumb i { font-size:9px; }
.innovation-hero { display:grid; grid-template-columns:minmax(0,1fr) 190px; gap:32px; padding:32px; background:#211b1d; color:#f6f4f2; border:1px solid #382b30; border-radius:12px; }
.eyebrow { display:block; font:700 11px/1.5 var(--cp-font-mono); letter-spacing:.08em; color:var(--cp-action-primary); }
.innovation-hero .eyebrow { color:#d6c29a; }
.innovation-hero h1 { margin:12px 0; font-size:clamp(25px,2.6vw,34px); font-weight:650; line-height:1.45; letter-spacing:-.02em; text-wrap:balance; }
.innovation-hero em { font-style:normal; color:#e2baa9; }
.innovation-hero p { max-width:740px; font-size:14px; line-height:1.85; color:#c1b9bc; }
.hero-tags { display:flex; flex-wrap:wrap; gap:16px; margin-top:18px; color:#aea4a6; font:600 10px var(--cp-font-mono); letter-spacing:.08em; }
.hero-proof { display:grid; gap:18px; align-content:center; padding-left:24px; border-left:1px solid #48393e; }
.hero-proof div { display:grid; gap:4px; }.hero-proof strong { font:650 25px var(--cp-font-mono); }.hero-proof span { color:#bfb4b8; font-size:12px; }
h2 { margin:0; font-size:22px; line-height:1.5; font-weight:650; } h3 { font-size:17px; line-height:1.6; font-weight:650; } p { line-height:1.8; }
.research-focus,.twin-pipeline,.innovation-card,.loop-panel,.metric-grid article,.validation-map,.ablation-panel,.case-grid article,.governance-chart,.boundary-panel { min-width:0; background:var(--cp-surface-default); border:1px solid var(--cp-border-default); border-radius:10px; padding:24px; }
.research-focus>header,.twin-pipeline>header,.loop-panel,.chapter-heading,.chapter-heading>div { display:flex; gap:18px; align-items:center; }
.focus-marker { flex:none; font:700 10px/1.6 var(--cp-font-mono); color:var(--cp-action-primary); border-left:3px solid currentColor; padding-left:12px; }
.focus-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; margin-top:22px; }
.focus-grid article { position:relative; padding-top:16px; border-top:1px solid var(--cp-border-subtle); }
.focus-grid article>span { float:right; color:var(--cp-text-muted); font:600 13px var(--cp-font-mono); }.focus-grid small { color:var(--cp-action-primary); }
.focus-grid h3 { margin:10px 0; font-size:16px; }.focus-grid p { color:var(--cp-text-secondary); font-size:12px; }
.chapter { display:grid; gap:20px; }.chapter-heading { justify-content:space-between; align-items:flex-start; }.chapter-heading>div { flex:none; }
.chapter-number { font:600 14px var(--cp-font-mono); color:var(--cp-action-primary); }.chapter-heading p { margin:0; max-width:540px; color:var(--cp-text-secondary); font-size:13px; }
.twin-pipeline h3 { margin:0; }.twin-pipeline p { margin:4px 0 0; color:var(--cp-text-secondary); font-size:13px; }
.twin-pipeline ol { list-style:none; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); padding:0; margin:24px 0 0; }
.twin-pipeline li { display:grid; gap:8px; padding:12px; border-left:1px solid var(--cp-border-default); }.twin-pipeline li:first-child { border-left:0; padding-left:0; }
.twin-pipeline strong { font:650 21px var(--cp-font-mono); }.twin-pipeline span { font-size:12px; }.twin-pipeline small { color:var(--cp-text-muted); font:10px var(--cp-font-mono); }
.pipeline-result strong { color:var(--cp-action-primary); }
.innovation-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.innovation-card header { display:flex; justify-content:space-between; color:var(--cp-action-primary); font-size:12px; }.innovation-card h3 { margin:14px 0 8px; }.innovation-card p { margin:0; color:var(--cp-text-secondary); font-size:14px; }
.innovation-card ul { display:flex; flex-wrap:wrap; gap:8px; list-style:none; margin:18px 0 0; padding:0; }.innovation-card li { font-size:11px; padding:5px 8px; background:var(--cp-surface-subtle); border-radius:4px; }
.loop-panel { display:grid; grid-template-columns:1fr 1.2fr; }.loop-copy p { color:var(--cp-text-secondary); font-size:13px; }.loop-copy h2 { margin-top:8px; }
.loop-diagram { display:flex; gap:10px; align-items:center; }.loop-diagram>div { display:grid; gap:8px; flex:1; padding:16px 10px; border:1px solid var(--cp-border-default); text-align:center; border-radius:6px; }
.loop-diagram small { color:var(--cp-text-muted); font:9px var(--cp-font-mono); }.loop-diagram strong { font-size:14px; }.loop-diagram span { font-size:11px; }.loop-diagram i { color:var(--cp-action-primary); }
.loop-diagram .loop-core { border-color:#c89aa5; background:#faf0f2; }.loop-return { grid-column:1/-1; margin:0; color:var(--cp-text-secondary); font-size:12px; }
.metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }.metric-grid article { padding:20px; }.metric-grid strong { font:650 26px var(--cp-font-mono); color:var(--cp-action-primary); }.metric-grid h3 { margin:12px 0 4px; font-size:14px; }.metric-grid p { margin:0; font-size:12px; color:var(--cp-text-secondary); }
.validation-map h3 { margin:6px 0 16px; }.validation-map ol { list-style:none; padding:0; margin:0; }.validation-map li { display:grid; grid-template-columns:30px 1fr auto; gap:16px; align-items:center; padding:16px 0; border-top:1px solid var(--cp-border-subtle); }
.validation-map li>span { font:11px var(--cp-font-mono); color:var(--cp-action-primary); }.validation-map li div { display:grid; gap:5px; }.validation-map strong { font-size:14px; }.validation-map small { font-size:12px; color:var(--cp-text-secondary); }.validation-map b { font:600 14px var(--cp-font-mono); }
.ablation-panel { display:grid; grid-template-columns:1fr 1.2fr; gap:24px; }.ablation-panel h3 { margin:8px 0; }.ablation-panel p { margin:0; color:var(--cp-text-secondary); font-size:13px; }
.ablation-panel dl,.case-grid dl,.trajectory-card dl { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:16px 0; }.ablation-panel dl { grid-template-columns:repeat(4,minmax(0,1fr)); align-items:center; }
.ablation-panel dt,.case-grid dt,.trajectory-card dt { font:600 18px var(--cp-font-mono); }.ablation-panel dd,.case-grid dd,.trajectory-card dd { margin:7px 0 0; font-size:11px; color:var(--cp-text-secondary); }
.timeline { display:flex; flex-wrap:wrap; gap:14px; align-items:center; padding:20px; background:var(--cp-surface-default); border:1px solid var(--cp-border-default); border-radius:8px; font-size:12px; }
.timeline>i { flex:1; min-width:15px; height:1px; background:var(--cp-border-default); }.timeline b { padding:8px 12px; background:#f7e9ed; color:var(--cp-action-primary); }.timeline>div { display:grid; gap:8px; }.timeline em { font:600 10px var(--cp-font-mono); }
.case-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }.case-grid article>span { font:600 11px var(--cp-font-mono); color:var(--cp-action-primary); }.case-grid h3 { margin:12px 0; }.case-grid p { color:var(--cp-text-secondary); font-size:13px; margin:12px 0 0; }.negative dt { color:var(--cp-action-primary); }
.governance-chart h3 { margin:6px 0; }.governance-chart header p { margin:0; color:var(--cp-text-secondary); font-size:13px; }.trajectory-layout { display:grid; grid-template-columns:1.2fr 1fr; align-items:center; gap:24px; margin:20px 0; }
.trajectory-plot { position:relative; width:100%; aspect-ratio:620/330; font-size:11px; }.trajectory-plot svg { display:block; width:100%; }.trajectory-grid { fill:none; stroke:#e8e3e2; stroke-width:1; }.trajectory-base,.trajectory-ghost,.trajectory-branch { fill:none; stroke-width:3; }.trajectory-base { stroke:#817777; }.trajectory-ghost { stroke:#eee8e8; stroke-width:8; }
.branch--conflict { stroke:url(#trajectoryUp); }.branch--resource { stroke:url(#trajectoryDown); }.origin-node { fill:#32282c; }.endpoint--conflict { fill:#ae0b2a; }.endpoint--resource { fill:#9b8a5c; }.halo--conflict { fill:#ae0b2a12; }.halo--resource { fill:#9b8a5c18; }
.plot-axis,.plot-origin,.plot-result { position:absolute; font-size:10px; }.plot-axis--positive { left:2%; top:6%; }.plot-axis--negative { left:2%; bottom:7%; }.plot-origin { left:9%; top:55%; }.plot-result { display:grid; gap:5px; }.plot-result--conflict { right:6%; top:8%; color:#ae0b2a; }.plot-result--resource { right:11%; bottom:9%; color:#796942; }.plot-result strong { font:600 18px var(--cp-font-mono); }
.trajectory-cards { display:grid; gap:12px; }.trajectory-card { padding:16px; border:1px solid var(--cp-border-default); border-left:3px solid #ae0b2a; border-radius:6px; }.trajectory-card--resource { border-left-color:#9b8a5c; }.trajectory-card header { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }.trajectory-card header span { color:var(--cp-text-muted); font:10px var(--cp-font-mono); }.trajectory-card header strong { font-size:13px; }.trajectory-card header em { margin-left:auto; font-size:11px; font-style:normal; }.trajectory-card dt { font-size:17px; }.trajectory-card p { margin:0; color:var(--cp-text-secondary); font-size:12px; }
.governance-chart footer { display:flex; gap:16px; padding-top:16px; border-top:1px solid var(--cp-border-subtle); font-size:13px; line-height:1.8; }.governance-chart footer strong { flex:none; color:var(--cp-action-primary); }
.research-finding { margin:0; border-left:3px solid #9b8a5c; padding:20px 24px; background:#f5f1e8; }.research-finding>span { font:600 10px var(--cp-font-mono); color:#796942; }.research-finding p { font-size:18px; margin:12px 0; }.research-finding small { color:var(--cp-text-secondary); font-size:12px; line-height:1.8; }
.case-link { justify-self:start; font-size:14px; font-weight:600; }.case-link i { margin-left:8px; transition:transform .18s ease; }.case-link:hover i { transform:translateX(3px); }
.boundary-panel ul { margin:0; padding-left:20px; font-size:13px; line-height:1.9; color:var(--cp-text-secondary); }.boundary-panel>div { display:flex; flex-wrap:wrap; gap:20px; margin-top:18px; font-size:12px; }
@media(max-width:1000px) { .chapter-heading { flex-direction:column; gap:8px; }.loop-panel,.ablation-panel,.trajectory-layout { grid-template-columns:1fr; }.metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.twin-pipeline ol { grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; } }
@media(max-width:680px) { .innovation-page { padding:16px 14px 36px; gap:24px; }.innovation-hero { grid-template-columns:1fr; padding:22px; gap:24px; }.hero-proof { grid-template-columns:repeat(3,minmax(0,1fr)); padding:16px 0 0; border-left:0; border-top:1px solid #48393e; }.hero-proof strong { font-size:21px; }.hero-proof span { font-size:10px; }.focus-grid,.innovation-grid,.case-grid { grid-template-columns:1fr; }.twin-pipeline>header { align-items:flex-start; flex-direction:column; }.twin-pipeline ol { grid-template-columns:repeat(2,minmax(0,1fr)); }.metric-grid article { padding:16px; }.metric-grid strong { font-size:23px; }.case-grid dl,.trajectory-card dl { gap:6px; }.case-grid dt { font-size:16px; }.ablation-panel dl { grid-template-columns:repeat(2,minmax(0,1fr)); }.validation-map li { gap:8px; grid-template-columns:22px 1fr auto; }.loop-diagram { gap:6px; }.loop-diagram>div { padding:12px 6px; }.loop-diagram strong { font-size:12px; }.loop-diagram span { font-size:10px; }.governance-chart footer { flex-direction:column; gap:4px; }.chapter-heading>div { gap:10px; } h2 { font-size:19px; } }
@media(prefers-reduced-motion:reduce) { .case-link i { transition:none; }.case-link:hover i { transform:none; } }
</style>
