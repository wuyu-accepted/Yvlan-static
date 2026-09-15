<template>
  <div class="campus-page">
    <header class="topbar">
      <router-link class="back-link" to="/" aria-label="返回 YuLan-OneSim 首页">
        <span aria-hidden="true">←</span>
        YuLan-OneSim
      </router-link>
      <div class="brand-block">
        <span class="brand-mark">CP</span>
        <div>
          <strong>CampusPulse</strong>
          <span>校园治理仿真决策台</span>
        </div>
      </div>
      <span class="stage-badge">V2.1 重点版</span>
    </header>

    <main v-if="!loading && currentData" class="content">
      <section class="hero" aria-labelledby="page-title">
        <div>
          <p class="eyebrow">考试压力主展示 · 选课治理迁移验证</p>
          <h1 id="page-title">先用历史事件验证形状，再比较治理策略</h1>
          <p class="hero-copy">
            两张授权论坛表先经过字段闸门、时间留出和逐事件回放，再用 80 组分层压力样本检验治理组合；
            历史证据与仿真假设分层展示，不把策略结果包装成现实因果效果。
          </p>
        </div>
        <div class="scenario-switch" role="group" aria-label="选择演示场景">
          <button
            v-for="scenario in scenarioOptions"
            :key="scenario.id"
            type="button"
            :class="{ active: scenarioId === scenario.id }"
            :aria-pressed="scenarioId === scenario.id"
            @click="selectScenario(scenario.id)"
          >
            <span>{{ scenario.short }}</span>
            <small>{{ scenario.role }} · {{ scenario.subtitle }}</small>
          </button>
        </div>
      </section>

      <section class="evidence-strip" aria-label="证据等级">
        <div class="evidence-item" :class="`evidence-${focusBacktest?.overall_grade || 'insufficient_data'}`">
          <span class="status-dot" aria-hidden="true"></span>
          <div>
            <span>历史事件形状</span>
            <strong>{{ gradeLabel(focusBacktest?.overall_grade) }}</strong>
          </div>
          <small>
            {{ integer(focusBacktest?.event_count) }} 个留一事件窗 ·
            平均 MAE {{ fixed(focusBacktest?.mean_normalized_arrival_profile_mae, 3) }}
          </small>
        </div>
        <div class="evidence-item" :class="`evidence-${fidelity?.grade || 'insufficient_data'}`">
          <span class="status-dot" aria-hidden="true"></span>
          <div>
            <span>可观察生成机制</span>
            <strong>{{ gradeLabel(fidelity?.grade) }}</strong>
          </div>
          <small>
            留出集：回应率误差 {{ fixed(fidelity?.response_rate_absolute_error_pp, 2) }} pp ·
            CDF MAE {{ fixed(fidelity?.comment_cdf_mae, 3) }}
          </small>
        </div>
        <div class="evidence-item evidence-warning">
          <span class="status-dot" aria-hidden="true"></span>
          <div>
            <span>治理干预效果</span>
            <strong>尚未实证</strong>
          </div>
          <small>当前只能解读为假设压力测试，需试点干预与工单日志校准。</small>
        </div>
      </section>

      <section v-if="focusBacktest" class="focus-proof" aria-labelledby="focus-proof-title">
        <div class="focus-proof-intro">
          <p class="section-kicker">数据亮点 01 · {{ currentScenarioOption.role }}</p>
          <h2 id="focus-proof-title">历史事件逐个留出回放</h2>
          <p>
            每次只留出一个事件，用其余事件形成参考形状。这里检验代理帖占比的历史重复性，
            不预测事件发生、绝对工作量或治理效果。
          </p>
          <dl class="focus-stats">
            <div><dt>合格事件</dt><dd>{{ focusBacktest.event_count }}</dd></div>
            <div><dt>最差折</dt><dd>{{ gradeLabel(focusBacktest.overall_grade) }}</dd></div>
            <div><dt>稳定折</dt><dd>{{ percent(focusBacktest.stable_fold_fraction, 0) }}</dd></div>
          </dl>
        </div>
        <div class="event-replay" role="list" :aria-label="`${scenarioTitle}历史留一事件窗`">
          <article v-for="(event, index) in focusEventRows" :key="event.peak_date" class="event-fold" role="listitem">
            <span class="event-index">事件 {{ index + 1 }}</span>
            <time :datetime="event.peak_date">{{ compactDate(event.peak_date) }}</time>
            <strong>{{ integer(event.proxy_posts) }} 条代理帖</strong>
            <small>
              留出折 {{ gradeLabel(event.fold?.fold_grade) }} ·
              MAE {{ fixed(event.fold?.arrival_profile?.normalized_profile_mae, 3) }}
            </small>
          </article>
        </div>
      </section>

      <section class="workspace">
        <div class="analysis-column">
          <section class="stress-lab" aria-labelledby="stress-title">
            <div class="section-heading">
              <div>
                <p class="section-kicker">仿真亮点 01 · 假设压力测试</p>
                <h2 id="stress-title">压力条件实验台</h2>
              </div>
              <p>
                调节三个关键条件，系统会匹配到最近的一组离线预计算压力样本，
                不在浏览器里临时编造结果。
              </p>
            </div>

            <div class="sliders">
              <label v-for="control in stressControls" :key="control.key" class="slider-row">
                <span class="slider-label">
                  <strong>{{ control.label }} <i class="evidence-chip">{{ control.source }}</i></strong>
                  <small>{{ control.hint }}</small>
                </span>
                <input
                  v-model.number="stressValues[control.key]"
                  type="range"
                  :min="control.min"
                  :max="control.max"
                  :step="control.step"
                  :aria-label="control.label"
                />
                <output>{{ stressValueLabel(control) }}</output>
              </label>
            </div>

            <div class="sample-readout" aria-live="polite">
              <span>匹配样本 #{{ activeSample.sample_index + 1 }}</span>
              <strong>{{ policyName(selectedPolicy) }}</strong>
              <span>
                解决率 {{ percent(activeSample.policies[selectedPolicy].resolution_rate) }} ·
                紧急未解决 {{ fixed(activeSample.policies[selectedPolicy].urgent_unresolved, 1) }} ·
                成本 {{ integer(activeSample.policies[selectedPolicy].governance_cost) }}
              </span>
            </div>
          </section>

          <section class="interval-section" aria-labelledby="interval-title">
            <div class="section-heading compact">
              <div>
                <p class="section-kicker">仿真亮点 02 · 仿真输出</p>
                <h2 id="interval-title">策略稳健区间</h2>
              </div>
              <div class="legend" aria-label="图例">
                <span><i class="range-swatch"></i>90% 压力区间</span>
                <span><i class="median-swatch"></i>中位数</span>
                <span><i class="sample-swatch"></i>当前样本</span>
              </div>
            </div>

            <div class="interval-chart" role="img" :aria-label="`${scenarioTitle}各策略解决率稳健区间`">
              <div class="axis-labels"><span>0%</span><span>50%</span><span>100%</span></div>
              <button
                v-for="policyId in orderedPolicies"
                :key="policyId"
                type="button"
                class="interval-row"
                :class="{ selected: selectedPolicy === policyId }"
                @click="selectedPolicy = policyId"
              >
                <span class="policy-label">
                  <strong>{{ policyName(policyId) }}</strong>
                  <small>P50 {{ percent(policySummary(policyId).resolution_rate.p50) }}</small>
                </span>
                <span class="range-track">
                  <span class="range-band" :style="intervalBandStyle(policyId)"></span>
                  <span class="median-marker" :style="medianStyle(policyId)"></span>
                  <span class="sample-marker" :style="sampleStyle(policyId)"></span>
                </span>
              </button>
            </div>
          </section>
        </div>

        <aside class="decision-column" aria-label="策略解读">
          <section class="decision-summary">
            <p class="section-kicker">声明假设范围内的稳健首位</p>
            <h2>{{ policyName(currentData.robust_recommendation) }}</h2>
            <p>
              在本轮声明范围内排名首位；这表示模拟排序稳定，
              不表示已经证明现实因果优越性。
            </p>
            <dl class="key-metrics">
              <div>
                <dt>排名第一频率</dt>
                <dd>{{ percent(recommendedSummary.win_frequency, 0) }}</dd>
              </div>
              <div>
                <dt>解决率 P05</dt>
                <dd>{{ percent(recommendedSummary.resolution_rate.p05) }}</dd>
              </div>
              <div>
                <dt>Pareto 入选频率</dt>
                <dd>{{ percent(recommendedSummary.pareto_frequency, 0) }}</dd>
              </div>
            </dl>
          </section>

          <section class="sensitivity" aria-labelledby="sensitivity-title">
            <div class="section-heading compact">
              <div>
                <p class="section-kicker">假设敏感性</p>
                <h2 id="sensitivity-title">谁最影响组合增益</h2>
              </div>
            </div>
            <div class="sensitivity-axis"><span>负相关</span><span>0</span><span>正相关</span></div>
            <div v-for="row in topSensitivity" :key="row.parameter" class="sensitivity-row">
              <span :title="row.label">{{ row.label }}</span>
              <div class="sensitivity-track">
                <i class="zero-line"></i>
                <i
                  class="sensitivity-bar"
                  :class="{ negative: row.resolution_uplift_correlation < 0 }"
                  :style="sensitivityBarStyle(row.resolution_uplift_correlation)"
                ></i>
              </div>
              <strong>{{ signed(row.resolution_uplift_correlation) }}</strong>
            </div>
            <p class="microcopy">相关系数用于定位应优先校准的参数，不代表因果效应。</p>
          </section>

          <section class="threshold-note">
            <span>阈值观察</span>
            <p>
              FAQ 有效性从最低四分位到最高四分位时，FAQ 策略相对基线的平均解决率增益
              <strong>{{ signed(faqTrend, 1) }} 个百分点</strong>。
            </p>
          </section>
        </aside>
      </section>

      <section class="comparison" aria-labelledby="comparison-title">
        <div class="section-heading compact">
          <div>
            <p class="section-kicker">全策略审计表</p>
            <h2 id="comparison-title">不只看“赢家”</h2>
          </div>
          <p>点击任一策略，可同步查看上方当前压力样本结果。</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">策略</th>
                <th scope="col">当前解决率</th>
                <th scope="col">P05–P95</th>
                <th scope="col">第一频率</th>
                <th scope="col">Pareto 频率</th>
                <th scope="col">平均排名</th>
                <th scope="col">平均成本</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="policyId in orderedPolicies"
                :key="policyId"
                tabindex="0"
                :class="{ selected: selectedPolicy === policyId }"
                @click="selectedPolicy = policyId"
                @keydown.enter="selectedPolicy = policyId"
              >
                <th scope="row">
                  {{ policyName(policyId) }}
                  <span v-if="policyId === currentData.robust_recommendation">稳健首位</span>
                </th>
                <td>{{ percent(activeSample.policies[policyId].resolution_rate) }}</td>
                <td>
                  {{ percent(policySummary(policyId).resolution_rate.p05) }}–{{ percent(policySummary(policyId).resolution_rate.p95) }}
                </td>
                <td>{{ percent(policySummary(policyId).win_frequency, 0) }}</td>
                <td>{{ percent(policySummary(policyId).pareto_frequency, 0) }}</td>
                <td>{{ fixed(policySummary(policyId).mean_rank, 2) }}</td>
                <td>{{ integer(policySummary(policyId).governance_cost.mean) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="evidence-ledger" aria-labelledby="ledger-title">
        <div class="ledger-intro">
          <p class="section-kicker">可信边界</p>
          <h2 id="ledger-title">每个数字先说明从哪里来</h2>
          <p>
            当前 {{ currentData.evidence_summary.parameter_count }} 个场景参数均记录来源类型；
            原始帖子文本与直接标识不会进入演示产物。
          </p>
          <p class="field-gate-note">
            字段闸门：{{ rejectedFieldCount }} 项评论标注因时间缺失被拒绝进入评分；
            {{ auxiliaryFieldCount }} 项仅作辅助。
          </p>
        </div>
        <dl class="source-counts">
          <div v-for="source in sourceTypes" :key="source.key">
            <dt>{{ source.label }}</dt>
            <dd>{{ currentData.evidence_summary.source_counts[source.key] || 0 }}</dd>
            <small>{{ source.note }}</small>
          </div>
        </dl>
        <div class="claim-boundary">
          <strong>允许表达</strong>
          <p>在声明的不确定性范围内，比较策略的运营结果、成本、排序稳定性与风险暴露。</p>
          <strong>暂不表达</strong>
          <p>真实政策效果大小、真实响应时长、个体福祉改善或因果优越性。</p>
        </div>
      </section>

      <footer class="method-footer">
        <span>{{ currentData.methodology.samples }} 组 Latin hypercube 样本</span>
        <span>每策略每样本 {{ currentData.methodology.repetitions_per_policy_per_sample }} 次重复</span>
        <span>同源需求校验：{{ currentData.methodology.common_policy_inputs_verified ? '通过' : '未通过' }}</span>
        <span>场景版本 {{ currentData.scenario_version }}</span>
        <span>数据快照 {{ currentData.data_lineage.dataset_snapshot_id.slice(0, 12) }}</span>
      </footer>
    </main>

    <main v-else class="state-screen">
      <div v-if="loading" class="loader" aria-live="polite">
        <span></span>
        <p>正在加载预计算压力样本…</p>
      </div>
      <div v-else class="error-state" role="alert">
        <strong>演示数据加载失败</strong>
        <p>{{ errorMessage }}</p>
        <button type="button" @click="loadData">重新加载</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

const scenarioOptions = [
  { id: 'exam_pressure', short: '考试压力', role: '主展示', subtitle: '历史重复性中等' },
  { id: 'course_selection', short: '选课治理', role: '迁移验证', subtitle: '历史重复性较弱' }
]

const policyLabels = {
  combined: '组合响应',
  faq_deflection: '定向 FAQ',
  peer_support: '同伴支持',
  dynamic_capacity: '动态扩容',
  priority_routing: '紧急优先路由',
  baseline: '有限路由基线'
}

const orderedPolicies = [
  'combined',
  'faq_deflection',
  'peer_support',
  'dynamic_capacity',
  'priority_routing',
  'baseline'
]

const sourceTypes = [
  { key: 'empirical_proxy', label: '数据代理', note: '论坛可观察量' },
  { key: 'derived', label: '派生参数', note: '由代理量计算' },
  { key: 'operator_input', label: '运营输入', note: '待校方确认' },
  { key: 'assumption', label: '显式假设', note: '优先试点校准' }
]

const sourceTypeLabels = {
  empirical_proxy: '数据代理',
  derived: '数据派生',
  operator_input: '运营输入',
  assumption: '显式假设'
}

const scenarioId = ref('exam_pressure')
const datasets = reactive({})
const validation = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const selectedPolicy = ref('combined')
const stressValues = reactive({
  demand_shock_scale: 1,
  faq_effectiveness_scale: 1,
  department_capacity_scale: 1
})

const currentData = computed(() => datasets[scenarioId.value])
const currentScenarioOption = computed(
  () => scenarioOptions.find((scenario) => scenario.id === scenarioId.value) || scenarioOptions[0]
)
const scenarioTitle = computed(() => currentData.value?.scenario_title || '')
const validationScenario = computed(
  () => validation.value?.scenario_results?.[scenarioId.value] || null
)
const fidelity = computed(
  () => validationScenario.value?.observable_generator_holdout_fidelity || null
)
const focusBacktest = computed(
  () => validation.value?.focus_evidence?.scenario_backtests?.[scenarioId.value] || null
)
const focusEventRows = computed(() => {
  const focus = focusBacktest.value
  if (!focus) return []
  const folds = new Map((focus.folds || []).map((fold) => [fold.holdout_peak_date, fold]))
  return (focus.events || []).map((event) => ({
    ...event,
    fold: folds.get(event.peak_date) || null
  }))
})
const fieldGateCounts = computed(
  () => validation.value?.focus_evidence?.field_audit?.gate_counts || {}
)
const rejectedFieldCount = computed(
  () => fieldGateCounts.value.reject_temporal_missingness || 0
)
const auxiliaryFieldCount = computed(
  () => fieldGateCounts.value.auxiliary_only || 0
)
const recommendedSummary = computed(
  () => currentData.value.policy_summary[currentData.value.robust_recommendation]
)

const stressControls = computed(() => {
  if (!currentData.value) return []
  const definitions = currentData.value.uncertainty_dimensions
  return [
    {
      key: 'demand_shock_scale',
      label: '需求冲击',
      hint: '相对基准到达规模',
      source: evidenceSourceLabel('base_arrival_rate', '运营输入'),
      min: definitions.demand_shock_scale.low,
      max: definitions.demand_shock_scale.high,
      step: 0.01
    },
    {
      key: 'faq_effectiveness_scale',
      label: 'FAQ 有效性',
      hint: '相对基准效果假设',
      source: evidenceSourceLabel('faq_effectiveness', '显式假设'),
      min: definitions.faq_effectiveness_scale.low,
      max: definitions.faq_effectiveness_scale.high,
      step: 0.01
    },
    {
      key: 'department_capacity_scale',
      label: '部门容量',
      hint: '相对基准处理能力',
      source: evidenceSourceLabel('department_capacity', '运营输入'),
      min: definitions.department_capacity_scale.low,
      max: definitions.department_capacity_scale.high,
      step: 0.01
    }
  ]
})

const activeSample = computed(() => {
  if (!currentData.value?.samples?.length) return null
  const controls = stressControls.value
  return currentData.value.samples.reduce((best, sample) => {
    const distance = controls.reduce((sum, control) => {
      const span = control.max - control.min
      const delta = (sample.parameters[control.key] - stressValues[control.key]) / span
      return sum + delta * delta
    }, 0)
    return !best || distance < best.distance ? { sample, distance } : best
  }, null).sample
})

const topSensitivity = computed(() => currentData.value.sensitivity.slice(0, 5))
const faqTrend = computed(() => {
  const curve = currentData.value.threshold_analysis.faq_effectiveness_scale.curve
  if (curve.length < 2) return 0
  return curve[curve.length - 1].resolution_uplift_mean_pp - curve[0].resolution_uplift_mean_pp
})

function assetUrl(file) {
  return `${import.meta.env.BASE_URL}campus-pulse-data/${file}`
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [exam, course, validationResponse] = await Promise.all([
      fetch(assetUrl('exam_pressure.json')),
      fetch(assetUrl('course_selection.json')),
      fetch(assetUrl('validation.json'))
    ])
    for (const response of [exam, course, validationResponse]) {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    }
    datasets.exam_pressure = await exam.json()
    datasets.course_selection = await course.json()
    validation.value = await validationResponse.json()
    resetStressValues()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

function selectScenario(id) {
  scenarioId.value = id
  selectedPolicy.value = 'combined'
  resetStressValues()
}

function resetStressValues() {
  if (!currentData.value) return
  for (const key of Object.keys(stressValues)) {
    const definition = currentData.value.uncertainty_dimensions[key]
    stressValues[key] = (definition.low + definition.high) / 2
  }
}

function policyName(id) {
  return policyLabels[id] || id
}

function policySummary(id) {
  return currentData.value.policy_summary[id]
}

function percent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${fixed(Number(value) * 100, digits)}%`
}

function fixed(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(digits)
}

function integer(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Math.round(Number(value)).toLocaleString('zh-CN')
}

function signed(value, digits = 2) {
  const numeric = Number(value || 0)
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)}`
}

function gradeLabel(grade) {
  return {
    strong: '强',
    moderate: '中等',
    weak: '弱',
    insufficient_data: '事件不足'
  }[grade] || '待评估'
}

function evidenceSourceLabel(parameter, fallback) {
  const sourceType = currentData.value?.parameter_evidence?.[parameter]?.source_type
  return sourceTypeLabels[sourceType] || fallback
}

function compactDate(value) {
  return String(value || '').replaceAll('-', '.') || '—'
}

function stressValueLabel(control) {
  return `${fixed(stressValues[control.key], 2)}×`
}

function intervalBandStyle(policyId) {
  const summary = policySummary(policyId).resolution_rate
  return {
    left: `${summary.p05 * 100}%`,
    width: `${Math.max(0.8, (summary.p95 - summary.p05) * 100)}%`
  }
}

function medianStyle(policyId) {
  return { left: `${policySummary(policyId).resolution_rate.p50 * 100}%` }
}

function sampleStyle(policyId) {
  return { left: `${activeSample.value.policies[policyId].resolution_rate * 100}%` }
}

function sensitivityBarStyle(value) {
  const magnitude = Math.min(1, Math.abs(value)) * 50
  return value >= 0
    ? { left: '50%', width: `${magnitude}%` }
    : { left: `${50 - magnitude}%`, width: `${magnitude}%` }
}

onMounted(loadData)
</script>

<style scoped>
.campus-page {
  --cp-ink: var(--text-color, #142018);
  --cp-muted: color-mix(in srgb, var(--text-color, #142018) 62%, transparent);
  --cp-line: color-mix(in srgb, var(--text-color, #142018) 15%, transparent);
  --cp-surface: var(--card-bg-color, #ffffff);
  --cp-accent: #d85c2f;
  --cp-accent-soft: color-mix(in srgb, #d85c2f 13%, transparent);
  --cp-green: #19714b;
  --cp-yellow: #b97811;
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  color: var(--cp-ink);
  background:
    radial-gradient(circle at 88% 8%, color-mix(in srgb, #e9a038 12%, transparent), transparent 27rem),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-color, #f4f2ec) 93%, #f2eadc), var(--bg-color, #f4f2ec));
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

button,
input {
  font: inherit;
}

.topbar,
.content {
  width: min(1420px, calc(100% - 64px));
  margin: 0 auto;
}

.topbar {
  min-height: 76px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  border-bottom: 1px solid var(--cp-line);
}

.back-link {
  width: max-content;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--cp-muted);
  text-decoration: none;
  font-size: 0.86rem;
}

.back-link:hover,
.back-link:focus-visible {
  color: var(--cp-accent);
}

.brand-block {
  display: flex;
  gap: 11px;
  align-items: center;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--cp-accent);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.brand-block div {
  display: grid;
  line-height: 1.1;
}

.brand-block strong {
  letter-spacing: -0.02em;
}

.brand-block div span {
  margin-top: 4px;
  color: var(--cp-muted);
  font-size: 0.7rem;
}

.stage-badge {
  justify-self: end;
  margin-right: 76px;
  padding: 6px 10px;
  border: 1px solid var(--cp-line);
  border-radius: 999px;
  color: var(--cp-muted);
  font-size: 0.72rem;
}

.content {
  padding: 54px 0 42px;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.8fr);
  gap: 72px;
  align-items: end;
}

.eyebrow,
.section-kicker {
  margin: 0 0 9px;
  color: var(--cp-accent);
  font-size: 0.73rem;
  font-weight: 760;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  max-width: 780px;
  margin-bottom: 18px;
  font-family: Georgia, "Noto Serif SC", "Songti SC", serif;
  font-size: clamp(2.2rem, 4.6vw, 4.6rem);
  font-weight: 650;
  line-height: 1.08;
  letter-spacing: -0.045em;
}

.hero-copy {
  max-width: 740px;
  margin-bottom: 0;
  color: var(--cp-muted);
  font-size: 1rem;
  line-height: 1.8;
}

.scenario-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 7px;
  border: 1px solid var(--cp-line);
  border-radius: 16px;
  background: color-mix(in srgb, var(--cp-surface) 72%, transparent);
}

.scenario-switch button {
  display: grid;
  gap: 5px;
  padding: 15px 18px;
  border: 0;
  border-radius: 11px;
  color: var(--cp-muted);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.scenario-switch button.active {
  color: #fff;
  background: #1d2821;
  box-shadow: 0 8px 24px rgba(20, 32, 24, 0.16);
}

.light-theme .scenario-switch button.active {
  color: #fff;
}

.scenario-switch span {
  font-size: 1rem;
  font-weight: 720;
}

.scenario-switch small {
  opacity: 0.72;
}

.evidence-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin: 42px 0 52px;
  overflow: hidden;
  border: 1px solid var(--cp-line);
  border-radius: 14px;
  background: var(--cp-line);
}

.evidence-item {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 17px 20px;
  background: var(--cp-surface);
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--cp-green);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--cp-green) 13%, transparent);
}

.evidence-warning .status-dot {
  background: var(--cp-yellow);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--cp-yellow) 14%, transparent);
}

.evidence-moderate .status-dot,
.evidence-insufficient_data .status-dot {
  background: var(--cp-yellow);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--cp-yellow) 14%, transparent);
}

.evidence-weak .status-dot {
  background: var(--cp-accent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--cp-accent) 14%, transparent);
}

.evidence-item div {
  display: grid;
  min-width: 116px;
}

.evidence-item div span,
.evidence-item small {
  color: var(--cp-muted);
  font-size: 0.76rem;
}

.evidence-item strong {
  margin-top: 3px;
  font-size: 0.92rem;
}

.evidence-item small {
  justify-self: end;
  text-align: right;
  line-height: 1.5;
}

.focus-proof {
  display: grid;
  grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.8fr);
  gap: 48px;
  align-items: end;
  margin: -8px 0 58px;
  padding: 34px 0 38px;
  border-bottom: 1px solid var(--cp-line);
}

.focus-proof-intro h2 {
  margin-bottom: 12px;
  font-size: clamp(1.35rem, 2.3vw, 2rem);
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.focus-proof-intro > p:not(.section-kicker) {
  margin-bottom: 20px;
  color: var(--cp-muted);
  font-size: 0.82rem;
  line-height: 1.7;
}

.focus-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin: 0;
  border-top: 1px solid var(--cp-line);
}

.focus-stats div {
  padding: 13px 10px 0 0;
}

.focus-stats dt {
  color: var(--cp-muted);
  font-size: 0.64rem;
}

.focus-stats dd {
  margin: 5px 0 0;
  font-family: Georgia, serif;
  font-size: 1.2rem;
}

.event-replay {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
  gap: 14px;
}

.event-fold {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding-top: 13px;
  border-top: 3px solid var(--cp-accent);
}

.event-index,
.event-fold small {
  color: var(--cp-muted);
  font-size: 0.66rem;
  line-height: 1.5;
}

.event-fold time {
  font-family: Georgia, serif;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}

.event-fold strong {
  font-size: 0.78rem;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(310px, 0.72fr);
  gap: 42px;
  align-items: start;
}

.analysis-column,
.decision-column {
  display: grid;
  gap: 40px;
}

.section-heading {
  display: grid;
  grid-template-columns: 1fr minmax(260px, 0.8fr);
  gap: 32px;
  align-items: end;
  margin-bottom: 28px;
}

.section-heading.compact {
  align-items: center;
}

.section-heading h2,
.decision-summary h2,
.ledger-intro h2 {
  margin-bottom: 0;
  font-size: clamp(1.35rem, 2.3vw, 2rem);
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.section-heading > p,
.decision-summary > p,
.ledger-intro > p {
  margin-bottom: 0;
  color: var(--cp-muted);
  font-size: 0.86rem;
  line-height: 1.7;
}

.stress-lab {
  padding: 30px;
  border: 1px solid var(--cp-line);
  border-radius: 18px;
  background: color-mix(in srgb, var(--cp-surface) 76%, transparent);
}

.sliders {
  display: grid;
  gap: 8px;
}

.slider-row {
  display: grid;
  grid-template-columns: 190px 1fr 64px;
  gap: 20px;
  align-items: center;
  min-height: 64px;
  border-top: 1px solid var(--cp-line);
}

.slider-label {
  display: grid;
  gap: 4px;
}

.slider-label strong {
  font-size: 0.9rem;
}

.evidence-chip {
  display: inline-block;
  margin-left: 5px;
  padding: 2px 5px;
  border: 1px solid var(--cp-line);
  border-radius: 4px;
  color: var(--cp-accent);
  font-size: 0.58rem;
  font-style: normal;
  font-weight: 650;
  vertical-align: 1px;
}

.slider-label small {
  color: var(--cp-muted);
  font-size: 0.73rem;
}

.slider-row input {
  width: 100%;
  accent-color: var(--cp-accent);
  cursor: pointer;
}

.slider-row output {
  padding: 7px 9px;
  border: 1px solid var(--cp-line);
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  font-size: 0.82rem;
  font-weight: 700;
}

.sample-readout {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  align-items: center;
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 11px;
  color: #fff;
  background: #1d2821;
  font-size: 0.82rem;
}

.sample-readout > span:first-child {
  padding-right: 17px;
  border-right: 1px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.65);
}

.sample-readout > span:last-child {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.72);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 15px;
  color: var(--cp-muted);
  font-size: 0.7rem;
}

.legend span {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.legend i {
  display: inline-block;
}

.range-swatch {
  width: 20px;
  height: 5px;
  border-radius: 4px;
  background: var(--cp-accent);
}

.median-swatch {
  width: 2px;
  height: 12px;
  background: var(--cp-ink);
}

.sample-swatch {
  width: 8px;
  height: 8px;
  border: 2px solid var(--cp-accent);
  border-radius: 50%;
  background: var(--cp-surface);
}

.interval-chart {
  padding-top: 2px;
}

.axis-labels {
  display: flex;
  justify-content: space-between;
  margin: 0 0 4px 190px;
  color: var(--cp-muted);
  font-size: 0.66rem;
}

.interval-row {
  width: 100%;
  display: grid;
  grid-template-columns: 172px 1fr;
  gap: 18px;
  align-items: center;
  padding: 13px 12px;
  border: 0;
  border-top: 1px solid var(--cp-line);
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.interval-row:hover,
.interval-row:focus-visible,
.interval-row.selected {
  background: var(--cp-accent-soft);
  outline: none;
}

.policy-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.policy-label strong {
  font-size: 0.83rem;
}

.policy-label small {
  color: var(--cp-muted);
  font-size: 0.65rem;
  font-variant-numeric: tabular-nums;
}

.range-track {
  position: relative;
  display: block;
  height: 3px;
  background:
    linear-gradient(90deg, transparent 49.8%, var(--cp-line) 50%, transparent 50.2%),
    color-mix(in srgb, var(--cp-line) 60%, transparent);
}

.range-band,
.median-marker,
.sample-marker {
  position: absolute;
  display: block;
  transform: translateX(-50%);
}

.range-band {
  top: -3px;
  height: 9px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--cp-accent) 55%, transparent);
  transform: none;
}

.median-marker {
  top: -7px;
  width: 2px;
  height: 17px;
  background: var(--cp-ink);
}

.sample-marker {
  top: -6px;
  width: 11px;
  height: 11px;
  border: 3px solid var(--cp-accent);
  border-radius: 50%;
  background: var(--cp-surface);
}

.decision-column {
  position: sticky;
  top: 24px;
}

.decision-summary {
  padding: 28px;
  border-radius: 18px;
  color: #fff;
  background: #1d2821;
  box-shadow: 0 20px 45px rgba(16, 32, 22, 0.16);
}

.decision-summary .section-kicker {
  color: #f2a771;
}

.decision-summary h2 {
  margin-bottom: 12px;
  font-size: 2rem;
}

.decision-summary > p {
  color: rgba(255, 255, 255, 0.66);
}

.key-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin: 25px 0 0;
  overflow: hidden;
  border-top: 1px solid rgba(255, 255, 255, 0.17);
}

.key-metrics div {
  padding: 18px 8px 0;
}

.key-metrics div:first-child {
  padding-left: 0;
}

.key-metrics dt {
  min-height: 32px;
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.65rem;
  line-height: 1.4;
}

.key-metrics dd {
  margin: 5px 0 0;
  font-family: Georgia, serif;
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
}

.sensitivity {
  padding: 0 3px;
}

.sensitivity .section-heading {
  grid-template-columns: 1fr;
  margin-bottom: 18px;
}

.sensitivity-axis {
  display: flex;
  justify-content: space-between;
  margin: 0 39px 6px 126px;
  color: var(--cp-muted);
  font-size: 0.62rem;
}

.sensitivity-row {
  display: grid;
  grid-template-columns: 116px 1fr 32px;
  gap: 10px;
  align-items: center;
  min-height: 34px;
}

.sensitivity-row > span {
  overflow: hidden;
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sensitivity-row > strong {
  font-size: 0.69rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.sensitivity-track {
  position: relative;
  height: 8px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--cp-line) 55%, transparent);
}

.zero-line,
.sensitivity-bar {
  position: absolute;
  top: 0;
  height: 100%;
}

.zero-line {
  left: 50%;
  width: 1px;
  background: var(--cp-muted);
}

.sensitivity-bar {
  border-radius: 5px;
  background: var(--cp-green);
}

.sensitivity-bar.negative {
  background: var(--cp-accent);
}

.microcopy {
  margin: 13px 0 0;
  color: var(--cp-muted);
  font-size: 0.68rem;
  line-height: 1.6;
}

.threshold-note {
  padding: 18px 20px;
  border-left: 3px solid var(--cp-accent);
  background: var(--cp-accent-soft);
}

.threshold-note span {
  color: var(--cp-accent);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.threshold-note p {
  margin: 8px 0 0;
  font-size: 0.8rem;
  line-height: 1.65;
}

.comparison,
.evidence-ledger {
  margin-top: 66px;
  padding-top: 42px;
  border-top: 1px solid var(--cp-line);
}

.comparison .section-heading > p {
  text-align: right;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 880px;
  font-size: 0.8rem;
}

thead {
  color: var(--cp-muted);
  text-align: left;
}

th,
td {
  padding: 15px 13px;
  border-bottom: 1px solid var(--cp-line);
  font-variant-numeric: tabular-nums;
}

thead th {
  font-size: 0.68rem;
  font-weight: 650;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover,
tbody tr:focus-visible,
tbody tr.selected {
  background: var(--cp-accent-soft);
  outline: none;
}

tbody th {
  font-weight: 680;
  text-align: left;
}

tbody th span {
  display: inline-block;
  margin-left: 7px;
  padding: 3px 6px;
  border-radius: 5px;
  color: var(--cp-accent);
  background: var(--cp-accent-soft);
  font-size: 0.6rem;
}

.evidence-ledger {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(420px, 1.45fr) minmax(260px, 0.75fr);
  gap: 48px;
  align-items: start;
}

.ledger-intro > p {
  margin-top: 15px;
}

.ledger-intro .field-gate-note {
  color: var(--cp-ink);
  font-size: 0.7rem;
}

.source-counts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
  border-left: 1px solid var(--cp-line);
}

.source-counts div {
  padding: 5px 18px;
  border-right: 1px solid var(--cp-line);
}

.source-counts dt {
  color: var(--cp-muted);
  font-size: 0.68rem;
}

.source-counts dd {
  margin: 7px 0 3px;
  font-family: Georgia, serif;
  font-size: 2rem;
}

.source-counts small {
  color: var(--cp-muted);
  font-size: 0.62rem;
}

.claim-boundary {
  display: grid;
  gap: 6px;
  padding-left: 22px;
  border-left: 3px solid var(--cp-green);
}

.claim-boundary strong {
  font-size: 0.75rem;
}

.claim-boundary strong:nth-of-type(2) {
  margin-top: 8px;
  color: var(--cp-accent);
}

.claim-boundary p {
  margin: 0;
  color: var(--cp-muted);
  font-size: 0.72rem;
  line-height: 1.6;
}

.method-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin-top: 55px;
  padding: 20px 0;
  border-top: 1px solid var(--cp-line);
  color: var(--cp-muted);
  font-size: 0.67rem;
}

.state-screen {
  min-height: calc(100vh - 77px);
  display: grid;
  place-items: center;
  text-align: center;
}

.loader span {
  display: block;
  width: 42px;
  height: 42px;
  margin: 0 auto 16px;
  border: 3px solid var(--cp-line);
  border-top-color: var(--cp-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loader p,
.error-state p {
  color: var(--cp-muted);
}

.error-state button {
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: var(--cp-accent);
  cursor: pointer;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1080px) {
  .hero,
  .workspace,
  .focus-proof,
  .evidence-ledger {
    grid-template-columns: 1fr;
  }

  .hero {
    gap: 34px;
  }

  .scenario-switch {
    max-width: 600px;
  }

  .decision-column {
    position: static;
    grid-template-columns: 1fr 1fr;
  }

  .threshold-note {
    grid-column: 1 / -1;
  }

  .evidence-ledger {
    gap: 30px;
  }

  .focus-proof {
    gap: 28px;
    align-items: start;
  }
}

@media (max-width: 760px) {
  .topbar,
  .content {
    width: min(100% - 30px, 1420px);
  }

  .topbar {
    grid-template-columns: 1fr auto;
  }

  .brand-block {
    justify-self: end;
    margin-right: 58px;
  }

  .stage-badge {
    display: none;
  }

  .content {
    padding-top: 36px;
  }

  h1 {
    font-size: 2.45rem;
  }

  .scenario-switch,
  .evidence-strip,
  .decision-column {
    grid-template-columns: 1fr;
  }

  .evidence-item {
    grid-template-columns: auto 1fr;
  }

  .evidence-item small {
    grid-column: 2;
    justify-self: start;
    text-align: left;
  }

  .section-heading {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .stress-lab {
    padding: 22px 18px;
  }

  .slider-row {
    grid-template-columns: 1fr 58px;
    gap: 8px 14px;
    padding: 12px 0;
  }

  .slider-row input {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .slider-row output {
    grid-column: 2;
    grid-row: 1;
  }

  .sample-readout > span:last-child {
    width: 100%;
    margin-left: 0;
  }

  .legend {
    justify-content: flex-start;
  }

  .axis-labels {
    margin-left: 126px;
  }

  .interval-row {
    grid-template-columns: 108px 1fr;
    gap: 8px;
    padding-inline: 4px;
  }

  .policy-label {
    display: grid;
  }

  .comparison .section-heading > p {
    text-align: left;
  }

  .source-counts {
    grid-template-columns: 1fr 1fr;
    border-top: 1px solid var(--cp-line);
  }

  .source-counts div {
    border-bottom: 1px solid var(--cp-line);
  }

  .threshold-note {
    grid-column: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loader span {
    animation: none;
  }
}
</style>
