import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const coreFiles = {
  overview: 'src/views/CampusPulseOverviewView.vue',
  simulator: 'src/campus-pulse/simulator/SimulatorHomePage.vue',
  forum: 'src/campus-pulse/forum/ForumInvestigationPage.vue',
  results: 'src/campus-pulse/results/ResultsListPage.vue',
  resultsDetail: 'src/campus-pulse/pages/ResultSummaryBoundary.vue',
  resultsSummary: 'src/campus-pulse/results/ResultSummaryPage.vue',
  workbench: 'src/views/campus-pulse/workbench/WorkbenchHomeView.vue',
  system: 'src/views/CampusPulseSystemView.vue',
  runtime: 'src/components/campus-pulse/RunExecutionPanel.vue',
  sensing: 'src/components/campus-pulse/WindowedSensingWorkbench.vue',
  trend: 'src/components/campus-pulse/ForumTwinTrendChart.vue',
}

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(coreFiles).map(async ([key, file]) => [
      key,
      await readFile(resolve(file), 'utf8'),
    ]),
  ),
)

test('five core product routes contain no presentation-first shell artifacts', () => {
  const combined = Object.values(sources).join('\n')
  for (const artifact of [
    'class="hero-panel"',
    'class="one-line-story"',
    'class="hero-bar"',
    'class="cta-row"',
    'class="roadmap-section',
    'class="eyebrow"',
    'class="section-index"',
    'runtime-eyebrow',
    '比赛口号',
    '五步启动',
    '我们不是',
    '巨幅欢迎横幅',
    'SYSTEM & EVIDENCE',
    'WHAT IS REAL',
    'CONTROL ROOM',
    'REAL LLM PAIRED RUN',
    'AUTHORIZED LIVE LLM · T0–T23 PILOT',
  ]) {
    assert.doesNotMatch(combined, new RegExp(artifact), artifact)
  }
})

test('five core pages retain task-oriented product hierarchy', () => {
  assert.match(sources.overview, /SimulatorHomePage/)
  assert.match(sources.simulator, /在政策发布前/)
  assert.match(sources.simulator, /先看见舆论如何发生/)
  assert.match(sources.simulator, /aria-labelledby="workflow-title"/)
  assert.match(sources.simulator, /CaseStudyGallery/)
  assert.match(sources.forum, /ForumContextHeader/)
  assert.match(sources.forum, /forum-investigation-page/)
  assert.match(sources.forum, /该结果没有可回放的公开论坛轨迹/)
  assert.match(sources.results, /<h1>案例与运行结果<\/h1>/)
  assert.match(sources.results, /对比治理分支/)
  assert.match(sources.resultsDetail, /ResultContextHeader/)
  assert.match(sources.resultsSummary, /核心观察/)
  assert.match(sources.workbench, /<h1>推演工作台<\/h1>/)
  assert.match(sources.workbench, /aria-label="工作台流程"/)
  assert.match(sources.system, /<h1>系统与证据<\/h1>/)
  assert.match(sources.system, /<h2 id="evidence-boundary-title">数据与证据边界<\/h2>/)
})

test('truth and runtime boundaries remain visible after the purge', () => {
  assert.match(sources.forum, /ForumContextHeader/)
  assert.match(sources.forum, /:readonly="readonly"/)
  assert.doesNotMatch(sources.results, /离线 Hero · T0–T23 paired pilot/)
  assert.match(sources.results, /审计案例/)
  assert.match(sources.resultsDetail, /正在校验结果/)
  assert.match(sources.workbench, /class="deployment-tier"/)
  assert.match(sources.runtime, /运行缺少封存的源证据绑定/)
  assert.match(sources.system, /不是实时全校舆情/)
})
