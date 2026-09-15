import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('M2 exposes the project center and canonical project routes', () => {
  const router = read('src/router/index.js')
  for (const route of [
    '/campus-pulse/app', '/campus-pulse/projects/new',
    '/campus-pulse/projects/:id', '/campus-pulse/projects/:id/world',
    '/campus-pulse/projects/:id/scenario', '/campus-pulse/projects/:id/policies',
    '/campus-pulse/projects/:id/run-plan',
    '/campus-pulse/runs/:runId/live', '/campus-pulse/runs/:runId/analysis',
    '/campus-pulse/cases', '/campus-pulse/settings',
  ]) assert.match(router, new RegExp(route.replaceAll('/', '\\/').replace(':', '\\:')))
})

test('M2 wizard contains all six stages and persists its draft', () => {
  const wizard = read('src/campus-pulse/projects/ProjectCreationWizard.vue')
  for (const label of ['基础信息', 'Agent 世界', '事件情景', '治理分支', '运行合同', 'Preflight']) {
    assert.match(wizard, new RegExp(label))
  }
  assert.match(wizard, /localStorage\.setItem/)
  assert.match(wizard, /query:\{ \.\.\.route\.query, step:/)
})

test('M2 client exposes all generic committed-run readers', () => {
  const api = read('src/services/campusPulseApi.js')
  for (const symbol of [
    'listRunTicks', 'getRunTickWorld', 'getRunTickForum',
    'getRunTickPrivateConversations', 'getRunPrivateConversation',
    'getRunAgent', 'getRunGovernance', 'getRunRisks',
  ]) assert.match(api, new RegExp(`export async function ${symbol}`))
})

test('private conversation list keeps aggregate-only truth boundary', () => {
  const service = read('../backend/campus_pulse/service.py')
  assert.match(service, /"access": "aggregate_only"/)
  assert.match(service, /"contains_conversation_ids": False/)
  assert.doesNotMatch(service, /get_run_tick_private_conversations[\s\S]{0,1000}visible_text/)
})
