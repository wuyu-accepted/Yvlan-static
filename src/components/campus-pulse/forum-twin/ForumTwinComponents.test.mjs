import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  compileScript,
  compileTemplate,
  parse,
} from '@vue/compiler-sfc'

const componentDirectory = resolve(
  'src/components/campus-pulse/forum-twin',
)
const files = [
  ...readdirSync(componentDirectory)
    .filter((file) => file.endsWith('.vue'))
    .map((file) => join(componentDirectory, file)),
  resolve('src/views/ForumTwinView.vue'),
  resolve('src/views/CampusPulseOverviewView.vue'),
  resolve('src/views/CampusPulseResultsView.vue'),
  resolve('src/views/CampusPulseSystemView.vue'),
  resolve('src/components/campus-pulse/ForumTwinTrendChart.vue'),
]

test('all ForumTwin SFCs parse and compile', () => {
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const parsed = parse(source, { filename: file })
    assert.deepEqual(parsed.errors, [], `${file} parse errors`)
    const id = `forum-twin-${file.length}`
    const script = parsed.descriptor.scriptSetup
      ? compileScript(parsed.descriptor, { id })
      : undefined
    const template = compileTemplate({
      id,
      filename: file,
      source: parsed.descriptor.template?.content || '',
      compilerOptions: {
        bindingMetadata: script?.bindings,
      },
    })
    assert.deepEqual(template.errors, [], `${file} template errors`)
  }
})

test('forum-first view is a shell over the investigation workspace without generated speech', () => {
  const sources = files.map((file) => readFileSync(file, 'utf8')).join('\n')
  const view = readFileSync(resolve('src/views/ForumTwinView.vue'), 'utf8')
  const page = readFileSync(resolve('src/campus-pulse/forum/ForumInvestigationPage.vue'), 'utf8')
  assert.doesNotMatch(sources, /Math\.random|randomUUID/)
  assert.match(view, /ForumInvestigationPage/)
  // Synchronized Natural / D branch panes with shared tick controls.
  assert.match(page, /branch="natural"/)
  assert.match(page, /branch="D"/)
  assert.match(page, /@prev-tick="goTick\(-1\)"/)
  assert.match(page, /@next-tick="goTick\(1\)"/)
  assert.match(page, /@play="play"/)
  assert.match(page, /@pause="pause"/)
  // Investigation primitives are mounted inside the ContextInspector.
  assert.match(page, /ThreadReader/)
  assert.match(page, /ClaimLineage/)
  assert.match(page, /AgentExplain/)
  assert.match(page, /GovernancePanel/)
  assert.match(page, /EvidenceDetails/)
  // Fail-closed source handling and no silent fallback.
  assert.match(page, /ApiProblemPanel/)
  assert.match(page, /switchOffline/)
  assert.match(page, /fallback_from/)
})

test('product pages expose the simulator first and keep verified results as a case module', () => {
  const overview = readFileSync(resolve('src/views/CampusPulseOverviewView.vue'), 'utf8')
  const simulator = readFileSync(resolve('src/campus-pulse/simulator/SimulatorHomePage.vue'), 'utf8')
  const cases = readFileSync(resolve('src/campus-pulse/results/CaseStudyGallery.vue'), 'utf8')
  const results = readFileSync(resolve('src/views/CampusPulseResultsView.vue'), 'utf8')
  const system = readFileSync(resolve('src/views/CampusPulseSystemView.vue'), 'utf8')
  const adapter = readFileSync(resolve('src/campus-pulse/source/forumTwinAdapter.ts'), 'utf8')
  const analysis = readFileSync(resolve('src/campus-pulse/results/resultsAnalysis.ts'), 'utf8')
  const summary = readFileSync(resolve('src/campus-pulse/results/ResultSummaryPage.vue'), 'utf8')
  const navigation = readFileSync(resolve('src/campus-pulse/app/navigation.js'), 'utf8')
  const combined = [overview, simulator, results, system].join('\n')
  assert.doesNotMatch(combined, /Math\.random|randomUUID/)
  assert.match(overview, /SimulatorHomePage/)
  assert.match(simulator, /getWorkbenchOverview/)
  assert.match(simulator, /CaseStudyGallery/)
  assert.match(cases, /loadResourcePolicyHero/)
  assert.match(cases, /loadLectureHero/)
  assert.match(cases, /直接承接链/)
  assert.doesNotMatch(cases, /治理未完成纠错/)
  assert.match(simulator, /在政策发布前/)
  assert.match(simulator, /LLM SOCIAL SIMULATION/)
  assert.match(simulator, /全局热榜前十 \+ 最新帖/)
  assert.match(simulator, /普通 Dynamics 不能生成公开帖子/)
  assert.match(results, /ResultsListPage/)
  assert.match(adapter, /governance_uptake_chains/)
  assert.match(adapter, /completed: loaded\.aggregate\.completeness\.completed_primary_slots/)
  assert.match(adapter, /required: loaded\.aggregate\.completeness\.required_primary_slots/)
  assert.match(analysis, /completeChains/)
  assert.match(summary, /OverviewTimeline/)
  assert.match(summary, /result\.slotCompleteness/)
  assert.match(summary, /LLM slot completion/)
  assert.match(summary, /LLM 槽位完成度/)
  assert.match(system, /禁止生成公开论坛文字/)
  assert.match(navigation, /label: '产品首页'/)
  assert.match(navigation, /label: '项目工作台'/)
  assert.match(navigation, /label: '实时演化'/)
  assert.match(navigation, /label: '案例中心'/)
  for (const route of [
    '/campus-pulse',
    '/campus-pulse/forum',
    '/campus-pulse/results',
    '/campus-pulse/workbench',
    '/campus-pulse/system',
  ]) assert.match(navigation, new RegExp(route.replaceAll('/', '\\/')))
})
