import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('M3 generic runs retain API runtime; Century Gym retains the complete legacy world', () => {
  const router = read('src/router/index.js')
  assert.match(router, /path: '\/campus-pulse\/runs\/:runId\/live'[\s\S]{0,180}component: RunLivePage/)
  assert.match(router, /campus-pulse\/live\/century-gym'[\s\S]{0,260}component: CenturyGymLivePage/)
})

test('M3 runtime exposes the required three-column deck and bottom drawer', () => {
  const page = read('src/campus-pulse/live/RunLivePage.vue')
  for (const marker of ['PUBLIC FORUM','AgentWorldPanel','CONTEXT INSPECTOR','风险雷达','治理决策室','资源账本','运行事件']) {
    assert.match(page, new RegExp(marker))
  }
  assert.match(page, /grid-template-columns:minmax\(260px/)
  assert.match(page, /@media\(max-width:760px\)/)
})

test('M3 playback uses committed API/replay ticks and never randomizes content', () => {
  const page = read('src/campus-pulse/live/RunLivePage.vue')
  assert.match(page, /listRunTicks/)
  assert.match(page, /loadLiveTick/)
  assert.match(page, /committed_ticks/)
  assert.match(page, /message\.created_tick===selectedTick\.value/)
  assert.doesNotMatch(page, /Math\.random|randomUUID/)
})

test('M3 keeps reviewed excerpts and aggregate-only private content distinct', () => {
  const page = read('src/campus-pulse/live/RunLivePage.vue')
  assert.match(page, /adaptCenturyGymSocialWorld/)
  assert.match(page, /access:'reviewed_excerpt'/)
  assert.match(page, /getRunTickPrivateConversations/)
  assert.match(page, /privateData\.access==='aggregate_only'/)
  assert.match(page, /不会根据计数生成发送者、关系边或对话正文/)
})

test('runtime event adapter accepts the backend paginated items envelope', () => {
  const adapter = read('src/campus-pulse/workbench/workbenchViewModel.ts')
  assert.match(adapter, /Array\.isArray\(envelope\.items\) \? envelope\.items/)
})
