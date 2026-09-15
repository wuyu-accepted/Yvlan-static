import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parse } from '@vue/compiler-sfc'

const viewPath = fileURLToPath(
  new URL('../src/views/RepresentativeSimulationView.vue', import.meta.url),
)
const demoPath = fileURLToPath(
  new URL(
    '../public/campus-pulse-data/representative-simulation.json',
    import.meta.url,
  ),
)

const [viewSource, demoSource] = await Promise.all([
  readFile(viewPath, 'utf8'),
  readFile(demoPath, 'utf8'),
])
const demo = JSON.parse(demoSource)
const orchestration = demo.scenarios.tongzhou.governanceOrchestration

test('competition primary view remains a valid Vue component', () => {
  const parsed = parse(viewSource, { filename: viewPath })
  assert.deepEqual(parsed.errors, [])
  assert.ok(parsed.descriptor.template)
  assert.ok(parsed.descriptor.scriptSetup)
  assert.ok(parsed.descriptor.styles.length)
})

test('governance program exposes a finite reviewed orchestration contract', () => {
  assert.equal(orchestration.status, 'reviewed_model_program')
  assert.equal(orchestration.actorCount, 3)
  assert.equal(orchestration.actionCount, 4)
  assert.equal(orchestration.resourceUnitCount, 5)
  assert.equal(orchestration.realWorldActions, 0)
  assert.deepEqual(
    orchestration.steps.map(step => step.id),
    ['listen', 'disclose', 'service', 'monitor'],
  )
  assert.match(orchestration.steps[2].condition, /上一封存点/)
  assert.match(orchestration.steps[3].condition, /上一封存点/)
  assert.match(orchestration.boundary, /不执行真实治理动作/)
  assert.match(orchestration.boundary, /不构成因果识别/)
  assert.match(orchestration.actorReleaseFingerprint, /^[0-9a-f]{64}$/)
  assert.match(orchestration.actionReleaseFingerprint, /^[0-9a-f]{64}$/)
})

test('comparison design and unresolved gaps fail closed instead of inventing evidence', () => {
  assert.deepEqual(
    orchestration.comparisonContract.map(item => item.label),
    ['同源配对', '共同起点', '决策时钟', '资源核算'],
  )
  assert.match(orchestration.comparisonContract[0].value, /2 个相同随机种子/)
  assert.match(orchestration.comparisonContract[1].value, /1 条共享基线/)
  assert.equal(orchestration.gapsByCase.course.length, 2)
  assert.equal(orchestration.gapsByCase.feedback.length, 2)
  assert.match(orchestration.cohortGap, /不补造/)
  assert.match(orchestration.externalContrast.note, /不展示该事件的治理效果排名/)
})

test('competition UI makes orchestration and claim boundaries visible', () => {
  for (const requiredText of [
    '谁负责、何时做、凭什么触发',
    '审阅模型程序 · 非现实执行',
    '先锁住可比性，再看分支差异',
    '当前案例仍未解决',
    '真实动作',
    '不会直接发布或处置',
  ]) {
    assert.ok(viewSource.includes(requiredText), `missing final UI text: ${requiredText}`)
  }
  assert.match(viewSource, /currentGovernanceGaps/)
  assert.match(viewSource, /governanceOrchestration\.comparisonContract/)
  assert.doesNotMatch(viewSource, /已证明(?:治理|政策).*因果/)
})
