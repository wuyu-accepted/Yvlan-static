<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  snapshot: {
    type: Object,
    default: null,
  },
})

const DIMENSIONS = [
  {
    key: 'issue',
    label: '议题领域',
    aggregateKey: 'issue_distribution',
    profileKey: 'issue_distribution',
  },
  {
    key: 'response',
    label: '治理响应',
    aggregateKey: 'response_distribution',
    profileKey: 'response_distribution',
  },
  {
    key: 'event',
    label: '事件关联',
    aggregateKey: 'event_relation_distribution',
    profileKey: 'event_relation_distribution',
  },
  {
    key: 'stance',
    label: '立场对象',
    aggregateKey: 'stance_distribution',
    profileKey: 'stance_distribution',
  },
]

const WINDOW_ORDER = [
  'matched_nonshock_reference',
  'tongzhou_governance_shock',
  'lecture_external_shock',
]
const FORMAL_RELEASE_KEY = 'campus-forum-windowed-sensing-v1-reviewed'
const FORMAL_SCHEMA_VERSION = 'campus-pulse-windowed-sensing-release-v1'
const FORMAL_STATUS = 'reviewed_aggregate'
const EXPECTED_AGGREGATE_SIZES = {
  issue_distribution: 9,
  archetype_distribution: 17,
  stance_distribution: 40,
  response_distribution: 9,
  event_relation_distribution: 5,
}

const WINDOW_LABELS = {
  matched_nonshock_reference: '匹配常态基准',
  tongzhou_governance_shock: '治理行动冲击',
  lecture_external_shock: '外生事件冲击',
}

const WINDOW_DESCRIPTIONS = {
  matched_nonshock_reference: '两个性质对应的历史时段，各占标准化基准的 50%',
  tongzhou_governance_shock: '治理行为相关舆情窗口',
  lecture_external_shock: '非治理行为触发的外生舆情窗口',
}

const SEGMENT_LABELS = {
  governance_matched_reference: '治理冲击匹配段',
  external_matched_reference: '外生冲击匹配段',
  observed_shock_window: '冲击观测段',
}

const ISSUE_LABELS = {
  academic_and_learning: '学习与课程',
  campus_services_and_rules: '校园服务与规则',
  career_and_opportunity: '生涯与机会',
  consumption_and_exchange: '消费与交易',
  leisure_and_culture: '休闲与文化',
  other_or_ambiguous: '其他或语义不明',
  public_discourse_and_norms: '公共讨论与规范',
  relationships_and_belonging: '关系与归属',
  wellbeing_and_support: '身心支持',
}

const RESPONSE_LABELS = {
  authoritative_information: '权威信息',
  coordination_or_matching: '协调与匹配',
  explanation_and_accountability: '解释与问责',
  no_response_or_ambiguous: '无需响应或不明确',
  participation_and_negotiation: '参与和协商',
  peer_experience_or_deliberation: '同伴经验与讨论',
  procedural_or_rule_clarification: '程序或规则澄清',
  safety_or_professional_support: '安全或专业支持',
  service_or_resource_delivery: '服务或资源供给',
}

const EVENT_LABELS = {
  external_focal_direct: '外生事件直接相关',
  focal_adjacent_spillover: '焦点事件邻近溢出',
  governance_focal_direct: '治理行动直接相关',
  ordinary_background: '日常背景讨论',
  uncertain_or_other: '关系不明或其他',
}

const STANCE_TARGET_LABELS = {
  ambiguous_or_multiple: '对象含混或多个对象',
  external_event_or_actor: '外部事件或主体',
  governance_actor_or_service: '治理主体或服务',
  governance_measure_or_rule: '治理措施或规则',
  no_evaluative_target: '无评价对象',
  peer_or_public_norm: '同伴或公共规范',
  personal_choice_or_situation: '个人选择或处境',
  transaction_or_opportunity: '交易或机会',
}

const STANCE_ORIENTATION_LABELS = {
  ambivalent: '矛盾',
  concerned: '关切',
  critical: '批评',
  neutral: '中性',
  supportive: '支持',
}

const selectedDimensionKey = ref('issue')

const selectedDimension = computed(
  () => DIMENSIONS.find(
    (dimension) => dimension.key === selectedDimensionKey.value,
  ) || DIMENSIONS[0],
)

const windows = computed(
  () => (Array.isArray(props.snapshot?.windows) ? props.snapshot.windows : []),
)

const windowById = computed(
  () => new Map(windows.value.map((window) => [window.window_id, window])),
)

const isWindowedSnapshot = computed(
  () => validateFormalSnapshot(props.snapshot, windowById.value),
)

const privacy = computed(() => props.snapshot?.privacy || {})
const claimBoundary = computed(() => props.snapshot?.claim_boundary || {})
const scope = computed(() => props.snapshot?.scope || {})

const boundaryItems = computed(() => [
  {
    label: '发布层级',
    value: privacy.value.publication_mode === 'aggregate_only'
      ? '仅公开聚合结果'
      : '发布层级未确认',
    safe: privacy.value.publication_mode === 'aggregate_only',
  },
  {
    label: '不确定性',
    value: confidenceLevelPpm.value === null
      ? '区间合同未确认'
      : `${formatPpm(confidenceLevelPpm.value, 0)} 抽样误差区间，不含分类误差`,
    safe: confidenceLevelPpm.value === 950000 && windows.value.every(
      (window) => (
        window.profile?.uncertainty_contract?.interval_scope
        === 'sampling_error_only'
        && window.profile?.uncertainty_contract
          ?.classification_error_in_interval === false
      ),
    ) && claimBoundary.value.interval_includes_classification_error === false,
  },
  {
    label: '因果边界',
    value: claimBoundary.value.causal_effect_identified === false
      ? '描述性对比，非因果识别'
      : '因果边界未确认',
    safe: claimBoundary.value.causal_effect_identified === false,
  },
  {
    label: '时效边界',
    value: claimBoundary.value.real_time_claimed === false
      ? '历史回溯，非实时监测'
      : '实时边界未确认',
    safe: claimBoundary.value.real_time_claimed === false,
  },
  {
    label: '预测边界',
    value: claimBoundary.value.forecast_validity_claimed === false
      ? '不预测事件、绝对热度或传播速度'
      : '预测边界未确认',
    safe: claimBoundary.value.forecast_validity_claimed === false,
  },
  {
    label: '编码边界',
    value: claimBoundary.value.model_coding_is_complete_human_annotation === false
      ? `模型辅助编码 · ${formatCount(directReviewTotal.value)} 条直接人工复核`
      : '人工编码边界未确认',
    safe: claimBoundary.value.model_coding_is_complete_human_annotation === false,
  },
])

const windowCards = computed(() => WINDOW_ORDER
  .map((windowId) => windowById.value.get(windowId))
  .filter(Boolean)
  .map((window) => {
    const profile = window.profile || {}
    return {
      ...window,
      displayLabel: WINDOW_LABELS[window.window_id] || readableCode(window.label),
      description: WINDOW_DESCRIPTIONS[window.window_id] || '',
      sampleCount: numberOrNull(
        profile.estimate_sample_count ?? window.sample_count,
      ),
      eligibleCount: numberOrNull(
        profile.eligible_count ?? window.denominator_count,
      ),
      essMilli: numberOrNull(
        profile.kish_effective_sample_size_milli,
      ),
      directReviewCount: numberOrNull(profile.direct_review_count),
      reviewCoveragePpm: numberOrNull(profile.direct_review_coverage_ppm),
      noFitPpm: numberOrNull(profile.window_novelty_or_no_fit_ppm),
      reviewStatus: profile.review_status,
      segments: Array.isArray(window.segments) ? window.segments : [],
    }
  }))

const comparisonContract = computed(
  () => props.snapshot?.distributions?.comparison_contract || {},
)

const comparisons = computed(() => {
  const declared = comparisonContract.value.allowed_pairwise_comparisons
  if (!Array.isArray(declared)) return []

  return declared.map((contract) => {
    const shockWindow = windowById.value.get(contract.shock_window_key)
    const referenceWindow = windowById.value.get(contract.reference_window_key)
    const referenceSegment = referenceWindow?.segments?.find(
      (segment) => segment.segment_id === contract.reference_segment_id,
    )
    const referenceProfile = (
      referenceSegment?.profile
      || referenceSegment?.sampling_contract?.profile
      || {}
    )
    const shockCells = (
      shockWindow?.aggregates?.[selectedDimension.value.aggregateKey]
      || shockWindow?.profile?.[selectedDimension.value.profileKey]?.cells
      || []
    )
    const referenceCells = (
      referenceProfile?.[selectedDimension.value.profileKey]?.cells
      || []
    )
    const rows = mergeComparisonCells(
      referenceCells,
      shockCells,
      selectedDimension.value.key,
    )

    return {
      id: `${contract.shock_window_key}:${contract.reference_segment_id}`,
      contract,
      shockWindow,
      referenceWindow,
      referenceSegment,
      rows,
      comparableCount: rows.filter((row) => row.deltaPpm !== null).length,
      title: contract.shock_window_key === 'tongzhou_governance_shock'
        ? '治理行动冲击对比'
        : '外生事件冲击对比',
      accent: contract.shock_window_key === 'tongzhou_governance_shock'
        ? 'governance'
        : 'external',
      referenceLabel: SEGMENT_LABELS[contract.reference_segment_id]
        || readableCode(contract.reference_segment_id),
      shockLabel: WINDOW_LABELS[contract.shock_window_key]
        || readableCode(contract.shock_window_key),
      comparisonReady: Boolean(
        shockWindow
        && referenceSegment
        && shockCells.length
        && referenceCells.length,
      ),
    }
  })
})

const minimumPublicCount = computed(
  () => numberOrNull(privacy.value.minimum_public_count),
)

const confidenceLevelPpm = computed(() => {
  const levels = new Set()
  for (const window of windows.value) {
    for (const key of Object.keys(EXPECTED_AGGREGATE_SIZES)) {
      const cells = window.aggregates?.[key]
      if (!Array.isArray(cells)) continue
      for (const cell of cells) {
        const value = numberOrNull(
          cell.estimation_contract?.confidence_level_ppm,
        )
        if (value !== null) levels.add(value)
      }
    }
  }
  return levels.size === 1 ? [...levels][0] : null
})

const directReviewTotal = computed(
  () => windows.value.reduce(
    (total, window) => (
      total + (numberOrNull(window.profile?.direct_review_count) || 0)
    ),
    0,
  ),
)

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function validateFormalSnapshot(snapshot, lookup) {
  if (
    !snapshot
    || snapshot.release_key !== FORMAL_RELEASE_KEY
    || snapshot.schema_version !== FORMAL_SCHEMA_VERSION
    || snapshot.status !== FORMAL_STATUS
    || snapshot.composition_status !== 'sealed'
    || Number(snapshot.window_count) !== WINDOW_ORDER.length
    || !Array.isArray(snapshot.windows)
    || snapshot.windows.length !== WINDOW_ORDER.length
    || lookup.size !== WINDOW_ORDER.length
    || !WINDOW_ORDER.every((windowId) => lookup.has(windowId))
  ) return false

  const snapshotPrivacy = snapshot.privacy
  const minimumCount = numberOrNull(snapshotPrivacy?.minimum_public_count)
  if (
    snapshotPrivacy?.publication_mode !== 'aggregate_only'
    || minimumCount === null
    || minimumCount < 10
    || snapshotPrivacy?.record_level_content_included !== false
    || snapshotPrivacy?.record_level_keys_included !== false
    || snapshotPrivacy?.review_free_text_included !== false
    || snapshotPrivacy?.semantic_free_text_included !== false
    || snapshotPrivacy?.runtime_locations_included !== false
    || snapshotPrivacy?.provider_secrets_included !== false
  ) return false

  const boundary = snapshot.claim_boundary
  const requiredFalseClaims = [
    'causal_effect_identified',
    'forecast_validity_claimed',
    'interval_includes_classification_error',
    'lexical_proxy_is_semantic_truth',
    'model_coding_is_complete_human_annotation',
    'population_is_unique_people_or_students',
    'real_time_claimed',
  ]
  if (
    boundary?.estimand !== 'historical_eligible_forum_post_episode_share'
    || requiredFalseClaims.some((key) => boundary?.[key] !== false)
  ) return false

  const expectedSegmentIds = {
    matched_nonshock_reference: [
      'external_matched_reference',
      'governance_matched_reference',
    ],
    tongzhou_governance_shock: ['observed_shock_window'],
    lecture_external_shock: ['observed_shock_window'],
  }
  for (const windowId of WINDOW_ORDER) {
    const window = lookup.get(windowId)
    const profile = window?.profile
    if (
      profile?.review_status !== 'review_complete'
      || numberOrNull(profile?.unresolved_count) !== 0
      || profile?.uncertainty_contract?.interval_scope
        !== 'sampling_error_only'
      || profile?.uncertainty_contract
        ?.classification_error_in_interval !== false
    ) return false

    for (const [aggregateKey, expectedSize] of Object.entries(
      EXPECTED_AGGREGATE_SIZES,
    )) {
      const cells = window?.aggregates?.[aggregateKey]
      if (
        !Array.isArray(cells)
        || cells.length !== expectedSize
        || cells.some(
          (cell) => (
            numberOrNull(
              cell.estimation_contract?.confidence_level_ppm,
            ) !== 950000
            || numberOrNull(
              cell.estimation_contract?.minimum_public_count,
            ) !== minimumCount
          ),
        )
      ) return false
    }

    const actualSegmentIds = (window.segments || [])
      .map((segment) => segment.segment_id)
      .sort()
    if (
      JSON.stringify(actualSegmentIds)
      !== JSON.stringify([...expectedSegmentIds[windowId]].sort())
    ) return false
    for (const segment of window.segments) {
      const segmentProfile = (
        segment.profile
        || segment.sampling_contract?.profile
      )
      if (
        !segmentProfile
        || segmentProfile.interval_scope !== 'sampling_error_only'
        || segmentProfile.classification_error_in_interval !== false
      ) return false
      for (const [aggregateKey, expectedSize] of Object.entries(
        EXPECTED_AGGREGATE_SIZES,
      )) {
        const distribution = segmentProfile[aggregateKey]
        if (
          !Array.isArray(distribution?.cells)
          || distribution.cells.length !== expectedSize
          || numberOrNull(distribution.confidence_level_ppm) !== 950000
          || numberOrNull(distribution.minimum_public_count) !== minimumCount
        ) return false
      }
    }
  }

  const comparisonContract = snapshot.distributions?.comparison_contract
  const allowed = comparisonContract?.allowed_pairwise_comparisons
  if (
    comparisonContract?.cross_comment_regime_comparison !== false
    || comparisonContract?.post_episode_estimates_only !== true
    || !Array.isArray(allowed)
    || allowed.length !== 2
  ) return false
  const expectedComparisons = new Set([
    'tongzhou_governance_shock:matched_nonshock_reference:governance_matched_reference',
    'lecture_external_shock:matched_nonshock_reference:external_matched_reference',
  ])
  const actualComparisons = new Set()
  for (const comparison of allowed) {
    if (comparison.comparison_type !== 'descriptive_window_contrast') {
      return false
    }
    const comparisonKey = [
      comparison.shock_window_key,
      comparison.reference_window_key,
      comparison.reference_segment_id,
    ].join(':')
    if (!expectedComparisons.has(comparisonKey)) return false
    const referenceWindow = lookup.get(comparison.reference_window_key)
    if (
      !referenceWindow?.segments?.some(
        (segment) => (
          segment.segment_id === comparison.reference_segment_id
        ),
      )
    ) return false
    actualComparisons.add(comparisonKey)
  }
  return actualComparisons.size === expectedComparisons.size
}

function readableCode(value) {
  if (!value) return '未命名'
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function cellKey(cell, dimensionKey) {
  if (dimensionKey === 'issue') {
    return cell.issue_domain_id || cell.broad_domain || ''
  }
  if (dimensionKey === 'response') {
    return cell.response_need_type || cell.response_need || ''
  }
  if (dimensionKey === 'event') return cell.event_relation || ''
  if (dimensionKey === 'stance') {
    return `${cell.stance_target || ''}::${cell.stance_orientation || ''}`
  }
  return ''
}

function cellLabel(cell, dimensionKey) {
  if (dimensionKey === 'issue') {
    const key = cell.issue_domain_id || cell.broad_domain
    return ISSUE_LABELS[key] || cell.label || readableCode(key)
  }
  if (dimensionKey === 'response') {
    const key = cell.response_need_type || cell.response_need
    return RESPONSE_LABELS[key] || cell.label || readableCode(key)
  }
  if (dimensionKey === 'event') {
    return EVENT_LABELS[cell.event_relation]
      || cell.label
      || readableCode(cell.event_relation)
  }
  const target = STANCE_TARGET_LABELS[cell.stance_target]
    || readableCode(cell.stance_target)
  const orientation = STANCE_ORIENTATION_LABELS[cell.stance_orientation]
    || readableCode(cell.stance_orientation)
  return `${target} · ${orientation}`
}

function normalizedCell(cell, dimensionKey) {
  if (!cell) return null
  const suppressed = Boolean(cell.suppressed)
  const estimatePpm = suppressed
    ? null
    : numberOrNull(cell.estimate_ppm ?? cell.weighted_share_ppm)
  const lowerPpm = suppressed
    ? null
    : numberOrNull(cell.lower_bound_ppm ?? cell.interval_95_lower_ppm)
  const upperPpm = suppressed
    ? null
    : numberOrNull(cell.upper_bound_ppm ?? cell.interval_95_upper_ppm)
  return {
    key: cellKey(cell, dimensionKey),
    label: cellLabel(cell, dimensionKey),
    suppressed,
    suppressionCode: (
      cell.review_support?.suppression_code
      || cell.suppression_code
      || null
    ),
    estimatePpm,
    lowerPpm,
    upperPpm,
    supportCount: suppressed
      ? null
      : numberOrNull(cell.sample_count ?? cell.support_count),
  }
}

function mergeComparisonCells(referenceCells, shockCells, dimensionKey) {
  const referenceMap = new Map()
  const shockMap = new Map()

  for (const cell of referenceCells) {
    const normalized = normalizedCell(cell, dimensionKey)
    if (normalized?.key) referenceMap.set(normalized.key, normalized)
  }
  for (const cell of shockCells) {
    const normalized = normalizedCell(cell, dimensionKey)
    if (normalized?.key) shockMap.set(normalized.key, normalized)
  }

  const keys = new Set([...referenceMap.keys(), ...shockMap.keys()])
  return [...keys]
    .map((key) => {
      const reference = referenceMap.get(key) || null
      const shock = shockMap.get(key) || null
      const referenceEstimate = reference?.estimatePpm
      const shockEstimate = shock?.estimatePpm
      const deltaPpm = (
        referenceEstimate !== null
        && referenceEstimate !== undefined
        && shockEstimate !== null
        && shockEstimate !== undefined
      )
        ? shockEstimate - referenceEstimate
        : null
      return {
        key,
        label: reference?.label || shock?.label || readableCode(key),
        reference,
        shock,
        deltaPpm,
      }
    })
    .sort((left, right) => {
      const leftVisible = Math.max(
        left.reference?.estimatePpm ?? -1,
        left.shock?.estimatePpm ?? -1,
      )
      const rightVisible = Math.max(
        right.reference?.estimatePpm ?? -1,
        right.shock?.estimatePpm ?? -1,
      )
      return rightVisible - leftVisible || left.label.localeCompare(right.label)
    })
}

function formatCount(value) {
  const number = numberOrNull(value)
  return number === null ? '—' : new Intl.NumberFormat('zh-CN').format(number)
}

function formatEss(milli) {
  const number = numberOrNull(milli)
  if (number === null) return '—'
  return (number / 1000).toFixed(1)
}

function formatPpm(ppm, digits = 1) {
  const number = numberOrNull(ppm)
  if (number === null) return '—'
  return `${(number / 10000).toFixed(digits)}%`
}

function formatDelta(ppm) {
  const number = numberOrNull(ppm)
  if (number === null) return '不可计算'
  if (number === 0) return '0.0 个百分点'
  const points = number / 10000
  return `${points > 0 ? '+' : ''}${points.toFixed(1)} 个百分点`
}

function deltaClass(ppm) {
  const number = numberOrNull(ppm)
  if (number === null || number === 0) return 'neutral'
  return number > 0 ? 'positive' : 'negative'
}

function formatInterval(cell) {
  if (!cell || cell.suppressed) return ''
  if (cell.lowerPpm === null || cell.upperPpm === null) return '区间未提供'
  return `95% CI ${formatPpm(cell.lowerPpm)}–${formatPpm(cell.upperPpm)}`
}

function suppressionLabel(cell) {
  if (!cell) return '未提供'
  if (!cell.suppressed) return ''
  if (cell.suppressionCode === 'minimum_cell') return '低于公开阈值'
  if (cell.suppressionCode === 'linked_or_complementary') {
    return '已联动抑制'
  }
  return '已抑制'
}

function barWidth(ppm) {
  const number = numberOrNull(ppm)
  if (number === null) return '0%'
  return `${Math.min(100, Math.max(0, number / 10000))}%`
}

function formatHalfOpenRange(start, end) {
  if (!start || !end) return '时段未提供'
  return `${String(start).replace('T', ' ').slice(0, 16)} 至 ${
    String(end).replace('T', ' ').slice(0, 16)
  }（右端不含）`
}

function shortHash(value) {
  if (!value) return '—'
  const text = String(value)
  return text.length > 24
    ? `${text.slice(0, 12)}…${text.slice(-8)}`
    : text
}

function comparisonSampleText(comparison, side) {
  if (side === 'reference') {
    const segment = comparison.referenceSegment
    const profile = (
      segment?.profile
      || segment?.sampling_contract?.profile
      || {}
    )
    return `n=${formatCount(segment?.estimate_sample_count ?? segment?.sample_count)} · ESS ${
      formatEss(profile.effective_sample_size_milli)
    }`
  }
  const profile = comparison.shockWindow?.profile || {}
  return `n=${formatCount(
    profile.estimate_sample_count ?? comparison.shockWindow?.sample_count,
  )} · ESS ${formatEss(profile.kish_effective_sample_size_milli)}`
}
</script>

<template>
  <section class="windowed-sensing-workbench" aria-labelledby="windowed-sensing-title">
    <header class="workbench-heading">
      <div>
        <h2 id="windowed-sensing-title">三窗口民意感知对比</h2>
        <p>
          把治理行动冲击与其历史匹配段、外生事件冲击与其历史匹配段分别比较，
          保留抽样区间和公开抑制边界。
        </p>
      </div>
      <span
        class="seal-state"
        :class="{ safe: isWindowedSnapshot }"
      >
        {{ isWindowedSnapshot ? '三窗口已封存' : '等待有效快照' }}
      </span>
    </header>

    <div v-if="!snapshot" class="empty-state" role="status">
      <strong>尚未提供感知快照</strong>
      <p>请传入服务端返回的已激活 schema-v4 snapshot。</p>
    </div>

    <div v-else-if="!isWindowedSnapshot" class="contract-warning" role="alert">
      <strong>快照未通过前端组合检查</strong>
      <p>
        组件要求 <code>composition_status=sealed</code>、三条固定窗口以及
        完整的 profile / segment / aggregate 数据；页面不会自行推测缺失映射。
      </p>
    </div>

    <template v-else>
      <div class="boundary-strip" aria-label="证据与解释边界">
        <div
          v-for="item in boundaryItems"
          :key="item.label"
          :class="{ safe: item.safe }"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <p class="unit-boundary">
        估计量描述各历史窗口中符合纳入规则的论坛帖子 episode 份额；样本用于估计
        该份额，不代表去重后的学生人数或全校人口。抽样区间不含模型分类误差；
        可见单元之和可能低于 100%，不得据此重归一化。
      </p>

      <section class="window-summary" aria-labelledby="window-summary-title">
        <div class="section-heading">
          <div>
            <span>WINDOW HEALTH</span>
            <h3 id="window-summary-title">三个冻结窗口</h3>
          </div>
          <small>
            包级 no-fit {{ formatPpm(scope.package_novelty_or_no_fit_ppm, 2) }}
          </small>
        </div>

        <div class="window-card-grid">
          <article
            v-for="window in windowCards"
            :key="window.window_id"
            class="window-card"
            :class="window.window_id"
          >
            <div class="window-title">
              <div>
                <span>{{ readableCode(window.window_role) }}</span>
                <h4>{{ window.displayLabel }}</h4>
              </div>
              <strong>n={{ formatCount(window.sampleCount) }}</strong>
            </div>
            <p>{{ window.description }}</p>

            <dl class="window-metrics">
              <div>
                <dt>有效样本 ESS</dt>
                <dd>{{ formatEss(window.essMilli) }}</dd>
              </div>
              <div>
                <dt>合格帖子池</dt>
                <dd>{{ formatCount(window.eligibleCount) }}</dd>
              </div>
              <div>
                <dt>人工直审</dt>
                <dd>{{ formatCount(window.directReviewCount) }}</dd>
              </div>
              <div>
                <dt>直审覆盖</dt>
                <dd>{{ formatPpm(window.reviewCoveragePpm) }}</dd>
              </div>
              <div>
                <dt>no-fit</dt>
                <dd>{{ formatPpm(window.noFitPpm, 2) }}</dd>
              </div>
              <div>
                <dt>复核状态</dt>
                <dd>{{ window.reviewStatus === 'review_complete' ? '已完成' : '未确认' }}</dd>
              </div>
            </dl>

            <div class="segment-list">
              <div
                v-for="segment in window.segments"
                :key="segment.segment_id"
              >
                <strong>
                  {{ SEGMENT_LABELS[segment.segment_id] || readableCode(segment.segment_id) }}
                </strong>
                <small>
                  {{ formatHalfOpenRange(segment.start_inclusive, segment.end_exclusive) }}
                </small>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="comparison-section" aria-labelledby="comparison-title">
        <div class="section-heading comparison-heading">
          <div>
            <span>DESCRIPTIVE CONTRASTS</span>
            <h3 id="comparison-title">匹配段与冲击窗口</h3>
          </div>
          <div class="dimension-tabs" aria-label="选择对比维度">
            <button
              v-for="dimension in DIMENSIONS"
              :key="dimension.key"
              type="button"
              :class="{ active: selectedDimensionKey === dimension.key }"
              :aria-pressed="selectedDimensionKey === dimension.key"
              @click="selectedDimensionKey = dimension.key"
            >
              {{ dimension.label }}
            </button>
          </div>
        </div>

        <p class="comparison-contract">
          仅执行服务端 <code>allowed_pairwise_comparisons</code> 声明的两组描述性对比。
          柱长直接使用原始加权份额（统一 0–100% 标尺），不会把未抑制项重新归一化。
          最小公开阈值为 n≥{{ formatCount(minimumPublicCount) }}，同时执行互补与跨范围
          联动抑制；不同评论采集制度和两个冲击窗口彼此不比较。
          “份额差”没有联合差值区间，不能用两侧边际区间判断统计显著性。
        </p>

        <article
          v-for="comparison in comparisons"
          :key="comparison.id"
          class="comparison-card"
          :class="comparison.accent"
        >
          <header>
            <div>
              <span>{{ comparison.contract.comparison_type }}</span>
              <h4>{{ comparison.title }}</h4>
            </div>
            <strong>
              历史描述性差异 · 非因果效应 · 可比较
              {{ comparison.comparableCount }}/{{ comparison.rows.length }}
            </strong>
          </header>

          <div v-if="!comparison.comparisonReady" class="comparison-missing">
            所需匹配段或聚合分布缺失；组件拒绝以混合基准窗口代替。
          </div>

          <template v-else>
            <div class="comparison-columns" aria-hidden="true">
              <span>{{ selectedDimension.label }}</span>
              <span>
                {{ comparison.referenceLabel }}
                <small>{{ comparisonSampleText(comparison, 'reference') }}</small>
              </span>
              <span>
                {{ comparison.shockLabel }}
                <small>{{ comparisonSampleText(comparison, 'shock') }}</small>
              </span>
              <span>份额差</span>
            </div>

            <div class="comparison-rows" role="table">
              <div
                v-for="row in comparison.rows"
                :key="row.key"
                class="comparison-row"
                role="row"
              >
                <div class="category-cell" role="rowheader">
                  <strong>{{ row.label }}</strong>
                  <code>{{ row.key }}</code>
                </div>

                <div class="measure-cell" role="cell">
                  <span class="mobile-label">{{ comparison.referenceLabel }}</span>
                  <div
                    v-if="row.reference && !row.reference.suppressed"
                    class="measure-value"
                  >
                    <strong>{{ formatPpm(row.reference.estimatePpm) }}</strong>
                    <small>
                      {{ formatInterval(row.reference) }} ·
                      n={{ formatCount(row.reference.supportCount) }}
                    </small>
                    <span class="bar-track" aria-hidden="true">
                      <i
                        class="reference-bar"
                        :style="{ width: barWidth(row.reference.estimatePpm) }"
                      />
                    </span>
                  </div>
                  <span v-else class="suppression">
                    {{ suppressionLabel(row.reference) }}
                  </span>
                </div>

                <div class="measure-cell" role="cell">
                  <span class="mobile-label">{{ comparison.shockLabel }}</span>
                  <div
                    v-if="row.shock && !row.shock.suppressed"
                    class="measure-value"
                  >
                    <strong>{{ formatPpm(row.shock.estimatePpm) }}</strong>
                    <small>
                      {{ formatInterval(row.shock) }} ·
                      n={{ formatCount(row.shock.supportCount) }}
                    </small>
                    <span class="bar-track" aria-hidden="true">
                      <i
                        class="shock-bar"
                        :style="{ width: barWidth(row.shock.estimatePpm) }"
                      />
                    </span>
                  </div>
                  <span v-else class="suppression">
                    {{ suppressionLabel(row.shock) }}
                  </span>
                </div>

                <div class="delta-cell" role="cell">
                  <span class="mobile-label">份额差</span>
                  <strong :class="deltaClass(row.deltaPpm)">
                    {{ formatDelta(row.deltaPpm) }}
                  </strong>
                  <small v-if="row.deltaPpm === null">
                    任一侧被抑制时不推算
                  </small>
                </div>
              </div>
            </div>
          </template>
        </article>
      </section>

      <footer class="method-footer">
        <div>
          <strong>可解释，但不过度承诺</strong>
          <p>
            页面呈现的是基于分层概率样本、模型辅助语义编码、强制路由与分层审计样本
            直接人工复核，以及隐私抑制后的历史窗口估计。它可用于校准模拟与提出治理
            假设，不能预测事件或绝对热度，不能冒充完整人工标注，也不能单独证明政策效果。
          </p>
        </div>
        <div class="release-identities">
          <span>
            snapshot
            <code :title="snapshot.snapshot_id">
              {{ shortHash(snapshot.snapshot_id) }}
            </code>
          </span>
          <span>
            manifest
            <code :title="snapshot.manifest_sha256">
              {{ shortHash(snapshot.manifest_sha256) }}
            </code>
          </span>
          <span>
            artifact
            <code :title="snapshot.artifact_sha256">
              {{ shortHash(snapshot.artifact_sha256) }}
            </code>
          </span>
        </div>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.windowed-sensing-workbench {
  --panel: var(--cp-surface-default);
  --panel-strong: var(--cp-surface-subtle);
  --line: var(--cp-border-subtle);
  --line-strong: var(--cp-border-default);
  --text: var(--cp-text-primary);
  --muted: var(--cp-text-muted);
  --blue: var(--brand-red);
  --green: var(--cp-success);
  --amber: var(--cp-warning);
  --orange: var(--cp-danger);
  background: var(--cp-surface-default);
  border: 1px solid var(--cp-border-default);
  border-radius: 0;
  color: var(--text);
  overflow: hidden;
  padding: clamp(0.85rem, 2vw, 1.25rem);
}

.workbench-heading,
.section-heading,
.comparison-card > header,
.window-title,
.method-footer {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.section-heading span,
.comparison-card > header span,
.window-title span {
  color: var(--blue);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.61rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.workbench-heading h2,
.section-heading h3,
.window-title h4,
.comparison-card h4 {
  font-family: Georgia, 'Noto Serif SC', serif;
  font-weight: 500;
  margin: 0;
}

.workbench-heading h2 {
  font-size: clamp(1.1rem, 2.2vw, 1.45rem);
  margin-top: 0.4rem;
}

.workbench-heading p {
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.7;
  margin: 0.5rem 0 0;
  max-width: 46rem;
}

.seal-state {
  background: rgba(231, 191, 133, 0.08);
  border: 1px solid rgba(231, 191, 133, 0.2);
  border-radius: 999px;
  color: var(--amber);
  flex: 0 0 auto;
  font-size: 0.65rem;
  padding: 0.42rem 0.68rem;
}

.seal-state.safe {
  background: rgba(125, 227, 192, 0.08);
  border-color: rgba(125, 227, 192, 0.2);
  color: var(--green);
}

.empty-state,
.contract-warning,
.comparison-missing {
  border-radius: 0.72rem;
  margin-top: 1rem;
  padding: 0.9rem;
}

.empty-state {
  background: rgba(143, 185, 239, 0.07);
  border: 1px dashed rgba(143, 185, 239, 0.22);
}

.contract-warning,
.comparison-missing {
  background: rgba(255, 159, 117, 0.07);
  border: 1px solid rgba(255, 159, 117, 0.2);
  color: #ffc0a6;
}

.empty-state strong,
.contract-warning strong {
  font-size: 0.78rem;
}

.empty-state p,
.contract-warning p {
  color: var(--muted);
  font-size: 0.67rem;
  line-height: 1.6;
  margin: 0.35rem 0 0;
}

.boundary-strip {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 1rem;
}

.boundary-strip > div {
  background: rgba(8, 25, 25, 0.7);
  border: 1px solid var(--line);
  border-radius: 0.7rem;
  display: grid;
  gap: 0.3rem;
  padding: 0.7rem;
}

.boundary-strip span {
  color: var(--muted);
  font-size: 0.58rem;
}

.boundary-strip strong {
  color: var(--amber);
  font-size: 0.68rem;
  line-height: 1.45;
}

.boundary-strip > div.safe strong {
  color: var(--green);
}

.unit-boundary,
.comparison-contract {
  border-left: 2px solid rgba(143, 185, 239, 0.38);
  color: var(--muted);
  font-size: 0.65rem;
  line-height: 1.7;
  margin: 0.75rem 0 0;
  padding-left: 0.75rem;
}

.window-summary,
.comparison-section {
  border-top: 1px solid var(--line);
  margin-top: 1.15rem;
  padding-top: 1rem;
}

.section-heading {
  align-items: flex-end;
}

.section-heading h3 {
  font-size: 1rem;
  margin-top: 0.28rem;
}

.section-heading small {
  color: var(--muted);
  font-size: 0.62rem;
}

.window-card-grid {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.75rem;
}

.window-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  min-width: 0;
  padding: 0.82rem;
}

.window-card.tongzhou_governance_shock {
  border-top-color: rgba(125, 227, 192, 0.5);
}

.window-card.lecture_external_shock {
  border-top-color: rgba(255, 159, 117, 0.5);
}

.window-title h4 {
  font-size: 0.88rem;
  margin-top: 0.3rem;
}

.window-title > strong {
  color: var(--green);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
}

.window-card > p {
  color: var(--muted);
  font-size: 0.63rem;
  line-height: 1.55;
  min-height: 2rem;
}

.window-metrics {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0.7rem 0 0;
}

.window-metrics > div {
  background: rgba(18, 43, 45, 0.54);
  border-radius: 0.5rem;
  min-width: 0;
  padding: 0.5rem;
}

.window-metrics dt {
  color: var(--muted);
  font-size: 0.55rem;
}

.window-metrics dd {
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  margin: 0.22rem 0 0;
}

.segment-list {
  border-top: 1px solid var(--line);
  display: grid;
  gap: 0.55rem;
  margin-top: 0.7rem;
  padding-top: 0.65rem;
}

.segment-list > div {
  display: grid;
  gap: 0.2rem;
}

.segment-list strong {
  color: #bfdaeb;
  font-size: 0.6rem;
}

.segment-list small {
  color: var(--muted);
  font-size: 0.55rem;
  line-height: 1.45;
}

.comparison-heading {
  gap: 1rem;
}

.dimension-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
  justify-content: flex-end;
}

.dimension-tabs button {
  background: rgba(12, 35, 38, 0.9);
  border: 1px solid var(--line);
  border-radius: 999px;
  color: #9ab1ae;
  cursor: pointer;
  font: inherit;
  font-size: 0.62rem;
  padding: 0.42rem 0.65rem;
}

.dimension-tabs button:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.dimension-tabs button.active {
  background: rgba(95, 156, 207, 0.16);
  border-color: rgba(143, 185, 239, 0.42);
  color: #dcecff;
}

.comparison-contract code {
  color: #a8caef;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.comparison-card {
  background: var(--panel-strong);
  border: 1px solid var(--line);
  border-radius: 0.85rem;
  margin-top: 0.75rem;
  overflow: hidden;
}

.comparison-card.governance {
  box-shadow: inset 3px 0 rgba(125, 227, 192, 0.45);
}

.comparison-card.external {
  box-shadow: inset 3px 0 rgba(255, 159, 117, 0.45);
}

.comparison-card > header {
  align-items: center;
  padding: 0.8rem;
}

.comparison-card h4 {
  font-size: 0.88rem;
  margin-top: 0.27rem;
}

.comparison-card > header > strong {
  color: var(--amber);
  font-size: 0.6rem;
  text-align: right;
}

.comparison-columns,
.comparison-row {
  display: grid;
  gap: 0.65rem;
  grid-template-columns:
    minmax(9rem, 1.05fr)
    minmax(9rem, 1fr)
    minmax(9rem, 1fr)
    minmax(7rem, 0.72fr);
}

.comparison-columns {
  background: rgba(143, 185, 239, 0.06);
  border-bottom: 1px solid var(--line);
  border-top: 1px solid var(--line);
  color: #abc3c1;
  font-size: 0.58rem;
  padding: 0.62rem 0.8rem;
}

.comparison-columns span {
  display: grid;
  gap: 0.18rem;
}

.comparison-columns small {
  color: var(--muted);
  font-size: 0.52rem;
}

.comparison-row {
  align-items: center;
  border-bottom: 1px solid rgba(151, 203, 224, 0.08);
  padding: 0.7rem 0.8rem;
}

.comparison-row:last-child {
  border-bottom: 0;
}

.category-cell {
  min-width: 0;
}

.category-cell strong {
  display: block;
  font-size: 0.66rem;
  line-height: 1.45;
}

.category-cell code {
  color: #5f807c;
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.48rem;
  margin-top: 0.2rem;
  overflow-wrap: anywhere;
}

.measure-value {
  display: grid;
  gap: 0.22rem;
}

.measure-value > strong {
  color: #dcecff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
}

.measure-value > small {
  color: var(--muted);
  font-size: 0.5rem;
  line-height: 1.35;
}

.bar-track {
  background: rgba(151, 203, 224, 0.1);
  border-radius: 999px;
  display: block;
  height: 0.25rem;
  overflow: hidden;
  width: 100%;
}

.bar-track i {
  border-radius: inherit;
  display: block;
  height: 100%;
}

.reference-bar {
  background: #799fc8;
}

.governance .shock-bar {
  background: var(--green);
}

.external .shock-bar {
  background: var(--orange);
}

.suppression {
  background: rgba(231, 191, 133, 0.08);
  border: 1px solid rgba(231, 191, 133, 0.16);
  border-radius: 0.45rem;
  color: var(--amber);
  display: inline-block;
  font-size: 0.56rem;
  line-height: 1.4;
  padding: 0.35rem 0.45rem;
}

.delta-cell {
  display: grid;
  gap: 0.22rem;
}

.delta-cell strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  line-height: 1.4;
}

.delta-cell strong.positive {
  color: #83e7c4;
}

.delta-cell strong.negative {
  color: #9fc6ee;
}

.delta-cell strong.neutral {
  color: var(--muted);
}

.delta-cell small {
  color: #6f8d89;
  font-size: 0.5rem;
  line-height: 1.35;
}

.mobile-label {
  display: none;
}

.method-footer {
  background: rgba(125, 227, 192, 0.05);
  border: 1px solid rgba(125, 227, 192, 0.12);
  border-radius: 0.75rem;
  margin-top: 1rem;
  padding: 0.8rem;
}

.method-footer strong {
  color: var(--green);
  font-size: 0.7rem;
}

.method-footer p {
  color: var(--muted);
  font-size: 0.6rem;
  line-height: 1.65;
  margin: 0.3rem 0 0;
  max-width: 48rem;
}

.method-footer code {
  color: #64827e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.48rem;
  overflow-wrap: anywhere;
  text-align: right;
}

.release-identities {
  display: grid;
  flex: 0 0 auto;
  gap: 0.3rem;
}

.release-identities span {
  align-items: center;
  color: var(--muted);
  display: flex;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.48rem;
  gap: 0.4rem;
  justify-content: space-between;
}

.release-identities code {
  max-width: 13rem;
}

@media (max-width: 960px) {
  .boundary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .window-card-grid {
    grid-template-columns: 1fr;
  }

  .window-card > p {
    min-height: 0;
  }
}

@media (max-width: 760px) {
  .workbench-heading,
  .comparison-heading,
  .method-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .seal-state {
    align-self: flex-start;
  }

  .dimension-tabs {
    justify-content: flex-start;
    width: 100%;
  }

  .release-identities {
    width: 100%;
  }

  .dimension-tabs button {
    flex: 1 1 calc(50% - 0.38rem);
  }

  .comparison-columns {
    display: none;
  }

  .comparison-row {
    align-items: stretch;
    gap: 0.65rem;
    grid-template-columns: 1fr 1fr;
    padding: 0.82rem;
  }

  .category-cell {
    border-bottom: 1px solid var(--line);
    grid-column: 1 / -1;
    padding-bottom: 0.55rem;
  }

  .delta-cell {
    border-top: 1px dashed var(--line);
    grid-column: 1 / -1;
    padding-top: 0.55rem;
  }

  .mobile-label {
    color: var(--muted);
    display: block;
    font-size: 0.5rem;
    line-height: 1.35;
    margin-bottom: 0.3rem;
  }

  .method-footer code {
    max-width: 100%;
    text-align: left;
  }
}

@media (max-width: 430px) {
  .boundary-strip,
  .window-metrics,
  .comparison-row {
    grid-template-columns: 1fr;
  }

  .dimension-tabs button {
    flex-basis: 100%;
  }

  .category-cell,
  .delta-cell {
    grid-column: auto;
  }

  .measure-cell,
  .delta-cell {
    background: rgba(143, 185, 239, 0.035);
    border-radius: 0.55rem;
    padding: 0.55rem;
  }

  .delta-cell {
    border-top: 0;
  }
}
</style>
