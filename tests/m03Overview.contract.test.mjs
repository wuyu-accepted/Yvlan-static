import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import { buildExceptionItems, buildSituationOverview, strongestObservedDifference } from '../src/campus-pulse/overview/situationOverview.ts'
import { loadOverviewComposition } from '../src/campus-pulse/overview/overviewQuery.ts'

function resultFixture(overrides = {}) {
  return {
    key: 'hero-r9', runId: 'run_fixture',
    source: { key: 'offline-hero', mode: 'offline_hero', verification: 'verified', publicationEligible: false, boundarySummary: 'pilot', provenance: { manifestId: 'hash', origin: 'asset' } },
    scope: { scenarios: ['s1'], scenarioLabel: '场景一', scenarioDescription: '', seedCount: 1, population: 1000, tickIds: [0, 1], sharedConditions: [] },
    summary: {
      naturalMessages: 8, interventionMessages: 10, residentTurns: 12, providerTokens: 20,
      timeline: [
        { tick: 0, phase: 'baseline', natural: { messages: 2, threads: 1, claims: 1, corrections: 0, help_requests: 0 }, intervention: { messages: 2, threads: 1, claims: 1, corrections: 0, help_requests: 0 } },
        { tick: 1, phase: 'burst', natural: { messages: 8, threads: 2, claims: 3, corrections: 1, help_requests: 0 }, intervention: { messages: 10, threads: 1, claims: 2, corrections: 1, help_requests: 0 } },
      ],
      governance: { publishedMessages: 3, noResponseMessages: 1, noopDecisions: 0 },
    },
    capabilities: {}, provenance: { manifestId: 'hash', origin: 'asset' }, boundaries: ['pilot'],
    ...overrides,
  }
}

test('M03 view model derives scope, timeline and strongest difference without fixed T4/T23 rules', () => {
  const result = resultFixture()
  const strongest = strongestObservedDifference(result)
  assert.deepEqual(strongest, { metric: 'messages', tick: 1, natural: 8, intervention: 10, delta: 2 })
  const overview = buildSituationOverview(result)
  assert.equal(overview.observationWindow, 'Tick 0–1')
  assert.equal(overview.defaultTick, 1)
  assert.match(overview.pilotBoundary, /单场景、单种子/)
  assert.doesNotMatch(JSON.stringify(overview), /T4|T23/)
})

test('M03 exceptions only use explicit publication, uptake and observed values', () => {
  const items = buildExceptionItems(resultFixture())
  assert.deepEqual(items.map((item) => item.kind), ['publication', 'no_response', 'divergence'])
  assert.match(items[1].detail, /3 条治理消息中，1 条/)
  assert.match(items[2].detail, /不判断好坏或统计显著性/)
})

test('M03 empty published series stays empty instead of becoming a zero curve', () => {
  const result = resultFixture({ summary: { ...resultFixture().summary, timeline: [] } })
  const overview = buildSituationOverview(result)
  assert.equal(overview.timeline.length, 0)
  assert.equal(overview.defaultTick, null)
  assert.equal(overview.findings.length, 1)
})

test('M03 source-specific pilot copy never leaks into live result boundaries', () => {
  const live = resultFixture({ source: { ...resultFixture().source, key: 'live-api', mode: 'live_api', publicationEligible: true, boundarySummary: 'Live verified result' } })
  const overview = buildSituationOverview(live)
  assert.equal(overview.pilotBoundary, 'Live verified result')
  assert.doesNotMatch(overview.pilotBoundary, /Hero|单种子/)
})

test('M03 legacy Overview poster structures and unsupported numbers are removed', () => {
  const page = readFileSync(resolve('src/views/CampusPulseOverviewView.vue'), 'utf8')
  assert.doesNotMatch(page, /582,408|WHAT WE BUILT|HOW TO USE|class="hero"|story-card|evidence-strip/)
})

test('M03 allSettled composition preserves verified result when operations fail', async () => {
  const problem = Object.assign(new Error('offline'), { code: 'ERR_NETWORK', isAxiosError: true })
  const composition = await loadOverviewComposition(
    { resolve: async () => ({ status: 'success', value: resultFixture(), source: resultFixture().source }) },
    'offline-hero', 'hero-r9',
    { getOverview: async () => { throw problem }, getReadiness: async () => { throw problem }, listProjects: async () => [] },
  )
  assert.equal(composition.result.status, 'success')
  assert.equal(composition.operations.problems.length, 2)
  assert.equal(composition.operations.projects.length, 0)
})

test('M03 product overview remains the simulator while the cover and case module stay separate', () => {
  const page = readFileSync(resolve('src/views/CampusPulseOverviewView.vue'), 'utf8')
  const simulator = readFileSync(resolve('src/campus-pulse/simulator/SimulatorHomePage.vue'), 'utf8')
  const cover = readFileSync(resolve('src/campus-pulse/landing/CampusPulseCoverPage.vue'), 'utf8')
  const cases = readFileSync(resolve('src/campus-pulse/results/CaseStudyGallery.vue'), 'utf8')
  assert.match(page, /SimulatorHomePage/)
  assert.match(cover, /进入 CampusPulse/)
  assert.doesNotMatch(page, /CampusPulseCoverPage/)
  assert.match(simulator, /getWorkbenchHealth/)
  assert.match(simulator, /getWorkbenchOverview/)
  assert.match(simulator, /listProjects/)
  assert.match(simulator, /CaseStudyGallery/)
  assert.match(cases, /loadResourcePolicyHero/)
  assert.match(cases, /loadLectureHero/)
  assert.match(cases, /直接承接链/)
  assert.match(cases, /播放演化过程/)
  assert.equal((cases.match(/播放演化过程/g) || []).length, 2)
  assert.equal((cases.match(/查看完整分析/g) || []).length, 2)
  assert.doesNotMatch(page, /ResourcePolicyStoryPanel|OverviewTimeline|CurrentFocusSelector/)
})

test('M03 Overview components parse and compile', () => {
  for (const relative of [
    'src/campus-pulse/overview/CurrentFocusSelector.vue',
    'src/campus-pulse/overview/ScopeSummary.vue',
    'src/campus-pulse/overview/ExceptionQueue.vue',
    'src/campus-pulse/overview/OverviewTimeline.vue',
    'src/campus-pulse/overview/EvidenceFindings.vue',
    'src/campus-pulse/overview/OperationsSnapshot.vue',
    'src/campus-pulse/simulator/SimulatorHomePage.vue',
    'src/views/CampusPulseOverviewView.vue',
  ]) {
    const file = resolve(relative)
    const parsed = parse(readFileSync(file, 'utf8'), { filename: file })
    assert.deepEqual(parsed.errors, [])
    const script = compileScript(parsed.descriptor, { id: `m03-${relative.length}` })
    const template = compileTemplate({ id: `m03-${relative.length}`, filename: file, source: parsed.descriptor.template?.content || '', compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [], `${relative} template errors`)
  }
})

test('M03 timeline exposes keyboard navigation, visible readout and table fallback', () => {
  const timeline = readFileSync(resolve('src/campus-pulse/overview/OverviewTimeline.vue'), 'utf8')
  assert.match(timeline, /ArrowRight/)
  assert.match(timeline, /event\.key === 'Enter'/)
  assert.match(timeline, /aria-live="polite"/)
  assert.match(timeline, /<table>/)
  assert.match(timeline, /stroke-dasharray/)
})

test('M03 query-only timeline changes do not trigger shell route focus reset', () => {
  const shell = readFileSync(resolve('src/campus-pulse/app/ProductShell.vue'), 'utf8')
  const progress = readFileSync(resolve('src/campus-pulse/app/routeProgress.js'), 'utf8')
  assert.match(shell, /watch\(\(\) => route\.fullPath,[\s\S]*beginSourceRoute/)
  assert.match(shell, /watch\(\(\) => route\.path,[\s\S]*mainElement\.value\?\.focus/)
  assert.match(shell, /watch\(\(\) => route\.path, async \(nextPath, previousPath\)/)
  assert.match(progress, /to\.path !== from\.path/)
})

test('M03 simulator layout uses shared tokens and a responsive task workflow', () => {
  const page = readFileSync(resolve('src/campus-pulse/simulator/SimulatorHomePage.vue'), 'utf8')
  assert.doesNotMatch(page, /#[0-9a-fA-F]{3,8}/)
  assert.match(page, /@media \(max-width:767px\)/)
  assert.match(page, /workflow-list/)
  assert.match(page, /engine-flow/)
  assert.match(page, /case-section/)
  assert.match(page, /在政策发布前/)
  assert.match(page, /hero-facts/)
  assert.match(page, /≤67/)
  assert.doesNotMatch(page, /动力学生成发言/)
  assert.match(page, /定义事件[\s\S]*绑定社会人口[\s\S]*配置论坛与治理[\s\S]*冻结运行合同[\s\S]*运行与观察/)
  assert.doesNotMatch(page, /font-size:\s*(?:[3-9]|\d{2,})rem/)
})
