import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import {
  buildResultAnalysis,
  buildResultStory,
  firstDivergence,
  RESULT_DELTA_DEFINITION,
  strongestObservedDelta,
} from '../src/campus-pulse/results/resultsAnalysis.ts'
import {
  applyResultFilters,
  filtersFromQuery,
  filtersToQuery,
  heroListRow,
  lectureHeroListRow,
  normalizeListPageRows,
  resultDetailLocation,
  runRowFromApi,
} from '../src/campus-pulse/results/resultsList.ts'
import { loadResultsList } from '../src/campus-pulse/results/resultsListQuery.ts'
import { canonicalResultLocation, legacyRunResultLocation } from '../src/campus-pulse/source/routeResolver.ts'
import { sourceProblem } from '../src/campus-pulse/source/resultResolver.ts'
import { HERO_RESULT_KEY, HERO_SOURCE_KEY, LECTURE_HERO_RESULT_KEY, LECTURE_HERO_SOURCE_KEY, LIVE_SOURCE_KEY } from '../src/campus-pulse/source/registry.ts'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('M04 run archive becomes mobile cards instead of a wide scrolling table', () => {
  const source = read('src/campus-pulse/results/ResultsListPage.vue')
  assert.match(source, /data-label="运行 ID"/)
  assert.match(source, /\.results-table,.results-table tbody,.results-table tr,.results-table td \{ display:block/)
  assert.doesNotMatch(source, /\.results-table \{ min-width:46rem; \}/)
})

function timeline(overrides = {}) {
  return [
    { tick: 0, phase: 'baseline', natural: { messages: 2, threads: 1, claims: 1, corrections: 0, help_requests: 0 }, intervention: { messages: 2, threads: 1, claims: 1, corrections: 0, help_requests: 0 } },
    { tick: 1, phase: 'burst', natural: { messages: 5, threads: 2, claims: 2, corrections: 0, help_requests: 0 }, intervention: { messages: 4, threads: 1, claims: 2, corrections: 0, help_requests: 0 } },
    { tick: 2, phase: 'spread', natural: { messages: 8, threads: 3, claims: 3, corrections: 1, help_requests: 0 }, intervention: { messages: 6, threads: 2, claims: 2, corrections: 1, help_requests: 0 } },
    { tick: 3, phase: 'decay', natural: { messages: 12, threads: 3, claims: 4, corrections: 1, help_requests: 1 }, intervention: { messages: 9, threads: 2, claims: 3, corrections: 1, help_requests: 1 } },
  ].map((point) => ({ ...point, ...(overrides[point.tick] || {}) }))
}

function resultFixture(overrides = {}) {
  return {
    key: 'run_generic_001',
    runId: 'run_generic_001',
    source: {
      key: LIVE_SOURCE_KEY,
      mode: 'live_api',
      label: 'Live API Result',
      verification: 'verified',
      freshness: { status: 'unknown' },
      availability: { backend: 'available', access: 'readonly' },
      provenance: { runId: 'run_generic_001', scenarioId: 'scenario_001', origin: 'CampusPulse result API', executionProvenance: 'authorized_live_llm', manifestId: 'b'.repeat(64), manifestAvailable: true, actualHash: 'b'.repeat(64) },
      publicationEligible: true,
      boundaries: ['Live API 结果需后端再次校验 manifest'],
      boundarySummary: 'Live API 已返回并通过结果/manifest 校验',
    },
    scope: {
      scenarios: ['scenario_001'],
      scenarioLabel: '通用场景',
      scenarioDescription: '',
      seedCount: 1,
      tickIds: [0, 1, 2, 3],
      population: 1000,
      sharedConditions: ['共享人口', '共享初始状态', '共享事件条件'],
    },
    summary: {
      naturalMessages: 12,
      interventionMessages: 9,
      residentTurns: 10,
      providerTokens: 20,
      timeline: timeline(),
      governance: {
        publishedMessages: 3,
        noResponseMessages: 1,
        noopDecisions: 1,
        decisionTicks: [{ tick: 1, summary: 'Authority: post_guidance · 80.0%' }],
        uptake: { completeChains: 1, totalChains: 3 },
      },
    },
    capabilities: { threads: true, claims: true, agents: true, particles: false, reports: true },
    provenance: { runId: 'run_generic_001', scenarioId: 'scenario_001', origin: 'CampusPulse result API', manifestId: 'b'.repeat(64), manifestAvailable: true, actualHash: 'b'.repeat(64) },
    boundaries: ['Live API 已校验'],
    forum: {
      threads: [{ thread_id: 't1', status: 'open' }],
      claims: [
        { claim_id: 'c1', status: 'contested', correction_target_claim_id: null },
        { claim_id: 'c2', status: 'corrected', correction_target_claim_id: 'c1' },
      ],
      messages: [],
      profiles: [],
    },
    ...overrides,
  }
}

function heroFixture() {
  return resultFixture({
    key: 'hero-r9',
    source: {
      key: HERO_SOURCE_KEY,
      mode: 'offline_hero',
      label: 'Verified Offline Hero',
      verification: 'verified',
      freshness: { status: 'unknown' },
      availability: { backend: 'unknown', access: 'readonly' },
      provenance: { runId: 'hero_pilot_r9_t23', evidenceId: 'hero-r9', origin: 'sealed offline public asset', manifestId: 'a'.repeat(64), manifestAvailable: true, actualHash: 'a'.repeat(64) },
      publicationEligible: false,
      boundaries: ['仅限 T0–T23 paired hero pilot 单场景展示'],
      boundarySummary: '仅限 T0–T23 paired hero pilot 单场景展示',
    },
    heroAnnotation: { text: '由 LLM 驱动 T0–T23 的单场景 paired hero pilot；不能外推为总体政策效果。', evidenceId: 'hero-r9', manifestId: 'a'.repeat(64) },
  })
}

test('M04 generic result never leaks Hero narrative or fixed T4/T23 story', () => {
  const analysis = buildResultAnalysis(resultFixture())
  const serialized = JSON.stringify(analysis)
  assert.doesNotMatch(serialized, /hero-r9|heroAnnotation|离线 Hero|单场景|T0–T23 paired/)
  assert.doesNotMatch(serialized, /"T23"|t4Adaptive|T04 · 事件爆发/)
  assert.ok(analysis.findings.every((finding) => finding.id !== 'hero-annotation'))
})

test('M04 hero-r9 annotation appears only for offline-hero with matching evidence', () => {
  const heroAnalysis = buildResultAnalysis(heroFixture())
  const annotation = heroAnalysis.findings.find((finding) => finding.id === 'hero-annotation')
  assert.ok(annotation, 'hero annotation finding expected for hero-r9')
  assert.equal(annotation.kind, 'evidence_backed_interpretation')
  assert.equal(annotation.evidenceRef.manifestId, 'a'.repeat(64))
  const liveWithHeroKey = buildResultAnalysis(resultFixture({ key: 'hero-r9', heroAnnotation: undefined }))
  assert.ok(liveWithHeroKey.findings.every((finding) => finding.id !== 'hero-annotation'))
  const generic = buildResultAnalysis(resultFixture())
  assert.ok(generic.findings.every((finding) => finding.id !== 'hero-annotation'))
})

test('M04 evidence annotation boundary follows the selected audited result', () => {
  const lecture = resultFixture({
    key: LECTURE_HERO_RESULT_KEY,
    source: { ...resultFixture().source, key: LECTURE_HERO_SOURCE_KEY },
    heroAnnotation: { text: '讲座案例注解', evidenceId: 'lecture-open-choice-r4', manifestId: 'c'.repeat(64) },
  })
  const annotation = buildResultAnalysis(lecture).findings.find((finding) => finding.id === 'hero-annotation')
  assert.match(annotation.boundary, /source=offline-lecture/)
  assert.match(annotation.boundary, /result=lecture-open-choice-r4/)
  assert.doesNotMatch(annotation.boundary, /resource-policy-r1/)
})

test('M04 Natural/D compare the same metric and tick with one delta direction', () => {
  const analysis = buildResultAnalysis(resultFixture())
  assert.equal(RESULT_DELTA_DEFINITION.formula, 'Δ = D − Natural')
  for (const row of analysis.metricComparison) {
    if (row.comparable) {
      assert.equal(row.delta, row.intervention - row.natural)
    }
  }
  const strongest = strongestObservedDelta(resultFixture())
  assert.deepEqual(strongest, { metric: 'messages', tick: 3, natural: 12, intervention: 9, delta: -3 })
  assert.equal(analysis.primaryObservation.metric, 'messages')
  assert.equal(analysis.primaryObservation.delta, -3)
  assert.match(analysis.primaryObservation.label, /公开消息/)
})

test('M04 key moments derive from the current result, not fixed T4/T23', () => {
  const analysis = buildResultAnalysis(resultFixture())
  const ticks = analysis.keyMoments.map((moment) => moment.tick)
  assert.deepEqual(ticks, [1, 3, 3, 1])
  assert.equal(firstDivergence(resultFixture()).tick, 1)
  const shiftedTimeline = timeline({ 1: { natural: { messages: 5, threads: 2, claims: 2, corrections: 0, help_requests: 0 }, intervention: { messages: 5, threads: 2, claims: 2, corrections: 0, help_requests: 0 } } })
  const shifted = buildResultAnalysis(resultFixture({ summary: { ...resultFixture().summary, timeline: shiftedTimeline } }))
  assert.equal(firstDivergence({ ...resultFixture(), summary: { ...resultFixture().summary, timeline: shiftedTimeline } }).tick, 2)
  assert.ok(shifted.keyMoments.some((moment) => moment.id === 'first-divergence' && moment.tick === 2))
  assert.doesNotMatch(JSON.stringify(analysis.keyMoments), /事件爆发/)
})

test('M04 fact boundary classifies findings as fact / derived / evidence-backed', () => {
  const analysis = buildResultAnalysis(resultFixture())
  const kinds = new Set(analysis.findings.map((finding) => finding.kind))
  assert.ok(kinds.has('derived_fact'))
  assert.ok(kinds.has('fact'))
  assert.ok(kinds.has('evidence_backed_interpretation'))
  const primary = analysis.findings.find((finding) => finding.id === 'primary-observation')
  assert.equal(primary.kind, 'derived_fact')
  assert.ok(primary.detail.includes(RESULT_DELTA_DEFINITION.formula))
  const scope = analysis.findings.find((finding) => finding.id === 'scope-fact')
  assert.equal(scope.kind, 'fact')
  const uptake = analysis.findings.find((finding) => finding.id === 'governance-uptake-finding')
  assert.equal(uptake.kind, 'evidence_backed_interpretation')
  assert.ok(analysis.findings.every((finding) => finding.kind !== 'candidate_mechanism'))
})

test('M04 evidence-backed findings carry an evidence reference', () => {
  const analysis = buildResultAnalysis(resultFixture())
  for (const finding of analysis.findings) {
    if (finding.kind === 'evidence_backed_interpretation' || finding.kind === 'derived_fact') {
      assert.ok(finding.evidenceRef, `${finding.id} needs evidenceRef`)
      assert.ok(finding.evidenceRef.route)
      assert.equal(finding.evidenceRef.manifestId, 'b'.repeat(64))
    }
  }
})

test('M04 shared Result story always exposes Nianze six stages in order', () => {
  const expected = [
    'event-trigger',
    'divergence-point',
    'behavioral-catalysts',
    'governance-efficacy',
    'residual-vulnerabilities',
    'strategic-policy-recommendations',
  ]
  const housing = resultFixture({
    key: HERO_RESULT_KEY,
    source: { ...resultFixture().source, key: HERO_SOURCE_KEY },
    resourcePolicy: {
      scenarioFacts: { bedsBefore: 520, bedsAfter: 320, validApplications: 536, announcementGaps: ['排序依据', '复核入口'] },
      sharedThroughTick: 4,
    },
  })
  const lecture = resultFixture({
    key: LECTURE_HERO_RESULT_KEY,
    source: { ...resultFixture().source, key: LECTURE_HERO_SOURCE_KEY },
    scope: { ...resultFixture().scope, scenarioLabel: '讲座辱骂事件后的校园治理回应', scenarioDescription: '登记编写的讲座事件说明。' },
  })
  for (const result of [housing, lecture]) {
    const story = buildResultStory(buildResultAnalysis(result))
    assert.equal(story.stages.length, 6)
    assert.deepEqual(story.stages.map((stage) => stage.id), expected)
    assert.deepEqual(story.stages.map((stage) => stage.number), [1, 2, 3, 4, 5, 6])
  }
})

test('M04 story preserves evidence classes and never invents recommendations or causal divergence', () => {
  const story = buildResultStory(buildResultAnalysis(resultFixture()))
  const divergence = story.stages[1]
  const mechanisms = story.stages[2]
  const recommendations = story.stages[5]
  assert.equal(story.deltaDefinition.formula, 'Δ = D − Natural')
  assert.equal(divergence.provenance, 'derived_fact')
  assert.match(divergence.boundary, /not a causal estimate/)
  assert.ok(divergence.evidenceRefs.every((ref) => ref.route && ref.manifestId))
  assert.equal(mechanisms.provenance, 'candidate_mechanism')
  assert.match(mechanisms.boundary, /候选机制/)
  assert.equal(recommendations.status, 'unavailable')
  assert.equal(recommendations.provenance, 'unavailable')
  assert.equal(recommendations.facts.length, 0)
  assert.equal(recommendations.finding, 'No verified strategic recommendation was published for this result.')
})

test('M04 six-stage English copy is explicit and does not depend on mixed-language replacements', () => {
  const cases = [
    resultFixture({
      key: HERO_RESULT_KEY,
      source: { ...resultFixture().source, key: HERO_SOURCE_KEY },
      resourcePolicy: { scenarioFacts: { bedsBefore: 520, bedsAfter: 320, validApplications: 536, announcementGaps: ['类别间与同类内排序', '材料复核责任人', '申诉入口', '答复时限'] }, sharedThroughTick: 4 },
    }),
    resultFixture({
      key: LECTURE_HERO_RESULT_KEY,
      source: { ...resultFixture().source, key: LECTURE_HERO_SOURCE_KEY },
      scope: { ...resultFixture().scope, scenarios: ['lecture_external_incident_shock'], scenarioDescription: '讲座案例说明' },
    }),
  ]
  for (const result of cases) {
    const story = buildResultStory(buildResultAnalysis(result))
    const english = story.stages.flatMap((stage) => [
      stage.findingEn,
      stage.boundaryEn,
      ...stage.facts.flatMap((fact) => [fact.labelEn, fact.valueEn]),
      ...stage.drilldowns.map((item) => item.labelEn),
    ]).join('\n')
    assert.doesNotMatch(english, /[\u3400-\u9fff]/)
    assert.doesNotMatch(english, /\d(public|governance)|messageshave/)
  }
  const component = read('src/campus-pulse/results/ResultStorySequence.vue')
  assert.doesNotMatch(component, /replaceAll\(/)
})

test('M04 story drill-downs preserve result and registered source context', () => {
  const result = resultFixture({ key: LECTURE_HERO_RESULT_KEY, source: { ...resultFixture().source, key: LECTURE_HERO_SOURCE_KEY } })
  const story = buildResultStory(buildResultAnalysis(result))
  const routes = story.stages.flatMap((stage) => stage.drilldowns.map((item) => item.route))
  assert.ok(routes.some((route) => route.name === 'campus-pulse-result-forum'))
  assert.ok(routes.some((route) => route.name === 'campus-pulse-result-mechanisms'))
  assert.ok(routes.some((route) => route.name === 'campus-pulse-result-governance'))
  assert.ok(routes.some((route) => route.name === 'campus-pulse-result-evidence'))
  for (const route of routes) {
    assert.equal(route.params.resultKey, LECTURE_HERO_RESULT_KEY)
    assert.equal(route.query.source, LECTURE_HERO_SOURCE_KEY)
  }
})

test('M04 URL restores result/source/tab/metric/tick and keeps list filters', () => {
  const router = read('src/router/index.js')
  for (const tab of ['summary', 'mechanisms', 'governance', 'evidence']) {
    assert.match(router, new RegExp(`path: '${tab}'`))
    assert.match(router, new RegExp(`name: 'campus-pulse-result-${tab}'`))
  }
  const list = read('src/campus-pulse/results/ResultsListPage.vue')
  for (const key of ['project', 'source', 'status', 'verification', 'publication', 'q', 'sort', 'page']) {
    assert.match(list, new RegExp(`route\\.query\\.${key}`))
  }
  const summary = read('src/campus-pulse/results/ResultSummaryPage.vue')
  assert.match(summary, /route\.query\.metric/)
  assert.match(summary, /route\.query\.tick/)
  assert.match(summary, /router\.replace\(\{ query: \{ \.\.\.route\.query, metric:/)
  assert.match(summary, /router\.replace\(\{ query: \{ \.\.\.route\.query, tick:/)
  const tabs = read('src/campus-pulse/results/ResultRouteTabs.vue')
  assert.match(tabs, /aria-current/)
  assert.match(tabs, /RouterLink/)
})

test('M04 presentation-only tick changes do not reload the result boundary', () => {
  const boundary = read('src/campus-pulse/pages/ResultSummaryBoundary.vue')
  assert.match(boundary, /const resolutionIdentity = computed/)
  assert.match(boundary, /watch\(resolutionIdentity, resolve\)/)
  assert.match(boundary, /publishResolvedSourceForPresentationRoute/)
  assert.doesNotMatch(boundary, /watch\(\(\) => route\.fullPath, resolve\)/)
})

test('M04 shared Lecture evidence boundary has an explicit English authored equivalent', () => {
  const boundary = read('src/campus-pulse/pages/ResultSummaryBoundary.vue')
  assert.match(boundary, /const LECTURE_BOUNDARY_EN = 'Single-scenario, single fixed-seed, Natural\/D live-LLM open-choice governance rehearsal for Tick 3–10\.'/)
  assert.match(boundary, /result\.value\?\.source\.key === LECTURE_HERO_SOURCE_KEY/)
  assert.match(boundary, /if \(!isEnglish\.value\) return value/)
})

test('M04 result body keeps mobile padding inside the viewport', () => {
  const boundary = read('src/campus-pulse/pages/ResultSummaryBoundary.vue')
  assert.match(boundary, /\.result-detail-layout__body\s*\{[^}]*box-sizing:border-box/)
  assert.match(boundary, /\.result-detail-layout__body\s*\{[^}]*min-width:0/)
})

test('M04 missing result keeps explicit source and does not jump to Hero', () => {
  assert.deepEqual(canonicalResultLocation({ source: LIVE_SOURCE_KEY, resultKey: 'not_a_run_id' }), {
    sourceKey: LIVE_SOURCE_KEY, runId: undefined, resultKey: 'not_a_run_id', needsReplace: false,
  })
  const layout = read('src/campus-pulse/pages/ResultSummaryBoundary.vue')
  assert.match(layout, /ApiProblemPanel/)
  assert.match(layout, /offline-available="request\.sourceKey === LIVE_SOURCE_KEY"/)
  const missing = sourceProblem(new Error('ForumTwin run result HTTP 404'))
  assert.equal(missing.status, 404)
})

test('M04 verification failure hides the result body and shows diagnostics', () => {
  const mismatch = sourceProblem(new Error('manifest SHA-256 mismatch'))
  assert.equal(mismatch.kind, 'verification')
  assert.equal(mismatch.sourceImpact, 'unverified')
  const layout = read('src/campus-pulse/pages/ResultSummaryBoundary.vue')
  assert.match(layout, /result\.source\.verification !== 'verified'|problem/)
  const evidencePage = read('src/campus-pulse/results/ResultEvidencePage.vue')
  assert.match(evidencePage, /发布门禁/)
})

test('M04 auxiliary panel failure keeps the trusted summary available', () => {
  const withoutForum = resultFixture({ forum: undefined })
  const analysis = buildResultAnalysis(withoutForum)
  assert.equal(analysis.mechanisms.status, 'unavailable')
  assert.match(analysis.mechanisms.reason, /未携带公开 Claim 资产/)
  assert.ok(analysis.findings.length >= 1, 'summary findings still available')
  assert.ok(analysis.primaryObservation)
  assert.ok(analysis.governance.decisionActions.length === 1)
})

test('M04 tabs, headings and actions keep an accessibility contract', () => {
  const tabs = read('src/campus-pulse/results/ResultRouteTabs.vue')
  assert.match(tabs, /nav class="result-route-tabs" aria-label="结果分析视图"/)
  assert.match(tabs, /aria-current="current\(tab\.id\) \? 'page' : undefined"/)
  const summary = read('src/campus-pulse/results/ResultSummaryPage.vue')
  assert.match(summary, /<ResultStorySequence/)
  const story = read('src/campus-pulse/results/ResultStorySequence.vue')
  assert.match(story, /:aria-labelledby="`story-stage-\$\{stage\.number\}`"/)
  assert.match(story, /<h2 :id="`story-stage-\$\{stage\.number\}`">/)
  const evidence = read('src/campus-pulse/results/ResultEvidencePage.vue')
  assert.match(evidence, /下载 JSON 报告/)
  assert.match(evidence, /下载 HTML 报告/)
  const header = read('src/campus-pulse/results/ResultContextHeader.vue')
  assert.match(header, />复制链接<\/button>/)
  assert.match(header, />返回结果列表<\/RouterLink>/)
  assert.match(header, />调查论坛<\/RouterLink>/)
})

test('M04 list view model treats both audited cases as explicit registered offline sources', () => {
  const hero = heroListRow()
  assert.equal(hero.sourceKey, HERO_SOURCE_KEY)
  assert.equal(hero.mode, 'offline_hero')
  assert.equal(hero.status, 'pilot')
  assert.equal(hero.publicationEligible, false)
  assert.equal(hero.verification, 'unverified')
  const lecture = lectureHeroListRow()
  assert.equal(lecture.sourceKey, LECTURE_HERO_SOURCE_KEY)
  assert.equal(lecture.resultKey, LECTURE_HERO_RESULT_KEY)
  assert.equal(lecture.mode, 'offline_hero')
  const run = runRowFromApi({
    run_id: 'run_1234567890abcdef12345678',
    scenario_id: 'scenario_001',
    status: 'planned',
    runtime_summary: { status: 'completed', finished_at: '2026-08-01T00:00:00Z' },
    agent_count: 1000,
  })
  assert.equal(run.resultKey, 'run_1234567890abcdef12345678')
  assert.equal(run.sourceKey, LIVE_SOURCE_KEY)
  assert.equal(run.status, 'completed')
  assert.equal(run.completedAt, '2026-08-01T00:00:00Z')
  assert.equal(run.updatedAt, '2026-08-01T00:00:00Z')
  const named = runRowFromApi({ run_id: 'run_named', scenario_id: 'scenario_001', input_snapshot: { scenario: { name: '场景名称' } } })
  assert.equal(named.scenarioLabel, '场景名称')
  const rows = normalizeListPageRows([
    { run_id: 'run_1234567890abcdef12345678', scenario_id: 'scenario_001', runtime_summary: { status: 'completed', finished_at: '2026-08-01T00:00:00Z' }, agent_count: 1000 },
  ], true)
  assert.equal(rows.length, 3)
  assert.equal(rows[0].resultKey, 'run_1234567890abcdef12345678')
})

test('M04 Case Center keeps Housing and Lecture templates but excludes Century Gym', () => {
  const gallery = read('src/campus-pulse/results/CaseStudyGallery.vue')
  assert.match(gallery, /template:'housing'/)
  assert.match(gallery, /template:'lecture'/)
  assert.doesNotMatch(gallery, /template:'century_gym'/)
  assert.match(gallery, /resourceResult\.value && lectureResult\.value/)
  assert.doesNotMatch(gallery, /resourceResult\.value && lectureResult\.value && flagshipSummary\.value/)
  assert.match(gallery, /resource-policy-r1\+lecture-open-choice-r4/)
})

test('M04 list filters, search, sort and pagination are URL-driven and deterministic', () => {
  const rows = normalizeListPageRows([], true)
  const extra = [
    { run_id: 'run_aaaaaaaaaaaaaaaaaaaaaaaa', status: 'planned', runtime_summary: { status: 'draft' }, agent_count: 100 },
    { run_id: 'run_bbbbbbbbbbbbbbbbbbbbbbbb', status: 'planned', runtime_summary: { status: 'completed', finished_at: '2026-08-02T00:00:00Z' }, agent_count: 500 },
  ]
  const all = normalizeListPageRows(extra, true)
  const defaults = filtersFromQuery({})
  assert.equal(defaults.source, 'all-registered')
  assert.equal(applyResultFilters(all, defaults).total, 4)
  assert.equal(filtersToQuery(defaults).source, undefined)
  const filters = filtersFromQuery({ source: HERO_SOURCE_KEY })
  const heroOnly = applyResultFilters(all, filters)
  assert.equal(heroOnly.total, 1)
  assert.equal(heroOnly.rows[0].resultKey, HERO_RESULT_KEY)
  const liveOnly = applyResultFilters(all, filtersFromQuery({ source: LIVE_SOURCE_KEY }))
  assert.equal(liveOnly.total, 2)
  const byStatus = applyResultFilters(all, filtersFromQuery({ status: 'draft' }))
  assert.equal(byStatus.total, 1)
  const searched = applyResultFilters(all, filtersFromQuery({ q: 'run_bbbb' }))
  assert.equal(searched.total, 1)
  const unsorted = applyResultFilters(all, filtersFromQuery({ sort: 'created' }))
  assert.deepEqual(unsorted.rows.map((row) => row.resultKey), [
    'run_aaaaaaaaaaaaaaaaaaaaaaaa',
    HERO_RESULT_KEY,
    LECTURE_HERO_RESULT_KEY,
    'run_bbbbbbbbbbbbbbbbbbbbbbbb',
  ])
})

test('M04 list query registers the global results API gap and fails without silent fallback', async () => {
  const ok = await loadResultsList(undefined, {
    listProjects: async () => [{ project_id: 'p1', name: '项目一' }],
    listProjectRuns: async () => [],
  })
  assert.equal(ok.selectedProject, 'p1')
  assert.ok(ok.rows.some((row) => row.sourceKey === HERO_SOURCE_KEY))
  assert.match(ok.gap, /当前项目.*离线来源/)
  const down = Object.assign(new Error('offline'), { isAxiosError: true, code: 'ERR_NETWORK' })
  const failed = await loadResultsList(undefined, {
    listProjects: async () => { throw down },
    listProjectRuns: async () => [],
  })
  assert.equal(failed.problem.kind, 'network')
  assert.equal(failed.rows.length, 0)
  assert.ok(failed.backendUnavailable)
})

test('M04 result components parse and compile', () => {
  for (const relative of [
    'src/campus-pulse/pages/ResultSummaryBoundary.vue',
    'src/campus-pulse/results/ResultsListPage.vue',
    'src/campus-pulse/results/ResultContextHeader.vue',
    'src/campus-pulse/results/ResultRouteTabs.vue',
    'src/campus-pulse/results/ResultSummaryPage.vue',
    'src/campus-pulse/results/ResultStorySequence.vue',
    'src/campus-pulse/results/ResourcePrivateChannelPanel.vue',
    'src/campus-pulse/results/MechanismsPage.vue',
    'src/campus-pulse/results/GovernancePage.vue',
    'src/campus-pulse/results/ResultEvidencePage.vue',
    'src/views/CampusPulseResultsView.vue',
  ]) {
    const file = resolve(relative)
    const source = readFileSync(file, 'utf8')
    const parsed = parse(source, { filename: file })
    assert.deepEqual(parsed.errors, [], `${relative} parse errors`)
    const id = `m04-${relative.length}`
    const script = parsed.descriptor.scriptSetup
      ? compileScript(parsed.descriptor, { id })
      : undefined
    const template = compileTemplate({
      id,
      filename: file,
      source: parsed.descriptor.template?.content || '',
      compilerOptions: { bindingMetadata: script?.bindings },
    })
    assert.deepEqual(template.errors, [], `${relative} template errors`)
  }
})

test('M04 legacy run_id redirects to the canonical result detail', () => {
  const legacy = legacyRunResultLocation('run_1234567890abcdef12345678')
  assert.equal(legacy.name, 'campus-pulse-result-summary')
  assert.equal(legacy.query.source, LIVE_SOURCE_KEY)
  assert.equal(legacy.params.resultKey, 'run_1234567890abcdef12345678')
  assert.deepEqual(resultDetailLocation({ resultKey: 'hero-r9', sourceKey: HERO_SOURCE_KEY }, 'evidence'), {
    name: 'campus-pulse-result-evidence',
    params: { resultKey: 'hero-r9' },
    query: { source: HERO_SOURCE_KEY },
  })
})
