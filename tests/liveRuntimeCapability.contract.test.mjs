import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from '@vue/compiler-sfc'

const servicePath = fileURLToPath(
  new URL('../src/services/campusPulseApi.js', import.meta.url),
)
const panelPath = fileURLToPath(
  new URL(
    '../src/components/campus-pulse/RunExecutionPanel.vue',
    import.meta.url,
  ),
)
const workbenchPath = fileURLToPath(
  new URL(
    '../src/views/campus-pulse/workbench/WorkbenchHomeView.vue',
    import.meta.url,
  ),
)

const [serviceSource, panelSource, workbenchSource] = await Promise.all([
  readFile(servicePath, 'utf8'),
  readFile(panelPath, 'utf8'),
  readFile(workbenchPath, 'utf8'),
])

test('live capability API uses the fixed read-only route and optional run ID', () => {
  assert.match(
    serviceSource,
    /export async function getLiveRuntimeCapability\(runId = null\)/,
  )
  assert.match(serviceSource, /client\.get\('\/live-runtime\/capability'/)
  assert.match(serviceSource, /run_id: runId/)
  assert.doesNotMatch(
    serviceSource,
    /client\.(post|put|patch|delete)\('\/live-runtime\/capability'/,
  )
})

test('run panel exposes all server-authoritative live qualification fields', () => {
  for (const requiredText of [
    '资格资产未安装',
    'Provider未启用',
    '授权缺失',
    'ready',
    'P3.2c尚未接入',
    'Expected turns',
    'Cold calls',
    'Hard call cap',
    'Hard Token cap',
    'Effective workers',
    '模型条件模拟、非因果识别、非预测',
    '不提供合成发言浏览',
  ]) {
    assert.ok(
      panelSource.includes(requiredText),
      `missing UI contract text: ${requiredText}`,
    )
  }
  for (const requiredField of [
    'expected_agent_turns',
    'expected_cold_provider_calls',
    'provider_call_limit',
    'token_limit',
    'effective_max_workers',
    'provider_calls_performed',
    'deterministic_fixture',
  ]) {
    assert.ok(
      panelSource.includes(requiredField),
      `missing capability field: ${requiredField}`,
    )
  }
  assert.match(panelSource, /getLiveRuntimeCapability\(runId\)/)
  assert.match(panelSource, /页面不会猜测资产、Provider或授权状态/)
})

test('P3.1 deterministic fixture controls remain independent', () => {
  assert.match(
    panelSource,
    /props\.runtimeAdapterMode !== 'deterministic_fake'/,
  )
  assert.match(panelSource, /const canEnqueue = computed/)
  assert.match(panelSource, /enqueueRun\(runId, body, launchRequest\.key\)/)
  assert.match(panelSource, /TEST FIXTURE \/ 测试夹具/)
  assert.match(panelSource, /测试夹具禁止导出为治理结论/)
})

test('workbench separates deterministic fixture readiness from live Provider readiness', () => {
  assert.match(workbenchSource, /void refreshLiveCapability\(requestGeneration\)/)
  assert.match(workbenchSource, /资格资产未安装/)
  assert.match(workbenchSource, /Provider未启用/)
  assert.match(workbenchSource, /确定性夹具执行器/)
  assert.match(workbenchSource, /执行器已安装/)
  assert.match(workbenchSource, /P3\.2c尚未接入/)
  assert.match(workbenchSource, /需新的显式授权，当前不可Live入队/)
  assert.match(workbenchSource, /资格阶段Provider调用/)
  assert.match(workbenchSource, /本工作台不提供合成发言浏览/)
  assert.match(workbenchSource, /页面不会推测安装、启用或授权状态/)
})

test('both Vue single-file components parse and expose no utterance endpoint', () => {
  for (const [filename, source] of [
    [panelPath, panelSource],
    [workbenchPath, workbenchSource],
  ]) {
    const parsed = parse(source, { filename })
    assert.deepEqual(parsed.errors, [])
    assert.ok(parsed.descriptor.scriptSetup)
    assert.ok(parsed.descriptor.template)
  }
  assert.doesNotMatch(
    `${serviceSource}\n${panelSource}\n${workbenchSource}`,
    /['"`]\/[^'"`]*(?:utterance|transcript|synthetic-message)/i,
  )
})
