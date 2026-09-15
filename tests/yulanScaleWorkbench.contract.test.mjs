import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

const pathFor = (relative) => fileURLToPath(
  new URL(relative, import.meta.url),
)
const workbenchPath = pathFor(
  '../src/views/campus-pulse/workbench/WorkbenchHomeView.vue',
)
const panelPath = pathFor(
  '../src/components/campus-pulse/RunExecutionPanel.vue',
)
const [workbenchSource, panelSource] = await Promise.all([
  readFile(workbenchPath, 'utf8'),
  readFile(panelPath, 'utf8'),
])

function compileVue(source, filename) {
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [])
  compileScript(descriptor, { id: filename })
  const compiled = compileTemplate({
    id: filename,
    filename,
    source: descriptor.template.content,
  })
  assert.deepEqual(compiled.errors, [])
}

test('Workbench compiles with the frozen YuLan-Scale v7 planning mode', () => {
  compileVue(workbenchSource, workbenchPath)
  compileVue(panelSource, panelPath)

  for (const marker of [
    'budgeted_llm_agent_population',
    'campus-pulse-run-plan-v7',
    'semantic-llm-agent-population-v1',
    'campus-pulse-llm-population-model-release-v1',
    '16 anchors + 32 PPS',
    '13,056 个预算化 LLM 槽位',
    '1,728 population_branch_tick',
  ]) {
    assert.ok(
      `${workbenchSource}\n${panelSource}`.includes(marker),
      `missing frozen v7 marker: ${marker}`,
    )
  }
})

test('v7 planner locks scale, paired seeds and the Provider risk budget', () => {
  assert.match(workbenchSource, /runForm\.agent_count = 1_000/)
  assert.match(workbenchSource, /runForm\.max_workers = 32/)
  assert.match(workbenchSource, /runForm\.token_budget = 40_000_000/)
  assert.match(workbenchSource, /seeds\.length !== governanceV2Seeds\.length/)
  assert.match(workbenchSource, /千体模式必须使用冻结的 8 个配对种子/)
  assert.match(workbenchSource, /isLockedPopulationMode/)
  assert.match(workbenchSource, /Natural\/A\/B\/C\/D/)
})

test('result-v5 separates replay, cache, live and emulator accounting', () => {
  for (const field of [
    'resident_llm_turns',
    'governance_llm_turns',
    'reviewed_trace_replays',
    'cache_hits',
    'live_provider_calls',
    'provider_tokens',
    'emulator_updates',
  ]) {
    assert.match(panelSource, new RegExp(field))
  }
  assert.match(panelSource, /reviewed_trace_replay/)
  assert.match(panelSource, /authorized_live_llm/)
  assert.match(panelSource, /emulator_only_development/)
  assert.match(panelSource, /fixture 不属于 result-v5 正式 provenance/)
})

test('development-only v7 results cannot request an official report', () => {
  assert.match(
    panelSource,
    /const isYuLanScalePublishable = computed[\s\S]*publication_eligible === true/,
  )
  assert.match(
    panelSource,
    /!canDownloadOfficialReport[\s\S]*requestAggregateReport/,
  )
  assert.match(
    panelSource,
    /!canDownloadOfficialReport[\s\S]*下载正式 JSON/,
  )
  assert.match(panelSource, /正式报告下载已在客户端禁用/)
  assert.match(panelSource, /if \(isYuLanScaleResult\.value\) return false/)
})
