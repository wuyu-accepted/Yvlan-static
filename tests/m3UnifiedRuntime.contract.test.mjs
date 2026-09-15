import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const readEvidence = path => JSON.parse(readFileSync(new URL(`../../../evidence/${path}`, import.meta.url), 'utf8'))

test('M3 canonical live route renders the unified runtime', () => {
  const router = read('src/router/index.js')
  assert.match(router, /path: '\/campus-pulse\/runs\/:runId\/live'[\s\S]{0,180}component: RunLivePage/)
  assert.match(router, /campus-pulse\/live\/century-gym'[\s\S]{0,260}campus-pulse-run-live/)
})

test('M3 runtime identity relies on the persistent product navigation', () => {
  const page = read('src/campus-pulse/live/RunLivePage.vue')
  assert.doesNotMatch(page, /replayMode\?\{name:'campus-pulse-live-evolution'\}/)
  assert.doesNotMatch(page, /run\?\.project_id\?\{name:'campus-pulse-project-overview'/)
  assert.doesNotMatch(page, /<div class="identity">\s*<button/)
  assert.match(page, /<div class="identity">\s*<div class="identity-copy">/)
})

test('M3 runtime exposes the required forum, stream, operations, Agent World, and Tick regions', () => {
  const page = read('src/campus-pulse/live/RunLivePage.vue')
  for (const marker of ['PUBLIC FORUM','EVENT + CONVERSATION STREAM','OPERATIONAL SUMMARY','AgentWorldPanel','活跃讨论串','运行事件','策略风险','Token 消耗','治理干预','Committed frame','tick-dock']) {
    assert.ok(page.includes(marker), `missing live-console marker: ${marker}`)
  }
  assert.match(page, /grid-template-columns:minmax\(250px/)
  assert.match(page, /\.tick-dock\{position:fixed/)
  assert.match(page, /@media\(max-width:760px\)/)
})

test('M3 playback keeps one selected Tick and exposes exactly 1x, 5x, and 20x', () => {
  const page = read('src/campus-pulse/live/RunLivePage.vue')
  assert.equal((page.match(/const selectedTick = ref\(/g) || []).length, 1)
  assert.match(page, /router\.replace\(\{query:\{\.\.\.route\.query,tick:String\(next\)\}\}\)/)
  assert.match(page, /<option :value="1">1×<\/option><option :value="5">5×<\/option><option :value="20">20×<\/option>/)
  assert.doesNotMatch(page, /0\.5×|2×/)
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

test('M3 audited replay passes real Tick aggregates without promoting scheduler identities', () => {
  const page = read('src/campus-pulse/live/RunLivePage.vue')
  const world = read('src/campus-pulse/workbench/AgentWorldPanel.vue')
  for (const marker of ['committedPublicMessages','residentActivations','governanceActivations','privateMessages','privateRoleEdges','timelineRecords']) {
    assert.ok(page.includes(marker), `missing audited replay summary field: ${marker}`)
  }
  assert.match(page, /:audited-replay-summary="replayMode \? auditedReplaySummary : null"/)
  assert.doesNotMatch(world, /re.privateRoleEdges[\s\S]{0,120}(sourceId|targetId)/)

  const social = readEvidence('century-gym-demo-v2/social-world-v1.json')
  const expected = new Map([[0,0],[2,0],[3,5],[5,18],[8,14],[10,13]])
  for (const [tick, publicMessages] of expected) {
    const branch = tick < 5 ? 'shared_baseline' : 'D'
    const payload = readEvidence(`century-gym-demo-v2/public-progress/${branch}/T${String(tick).padStart(2,'0')}.json`)
    const row = payload.public_branch.timeline.find(item => item.tick === tick)
    const frame = social.frames.find(item => item.tick === tick && item.branch === branch)
    assert.equal(row.messages_this_tick, publicMessages)
    assert.equal(typeof frame.private_messages_this_tick, 'number')
    assert.ok(Array.isArray(frame.edges))
  }
})

test('runtime event adapter accepts the backend paginated items envelope', () => {
  const adapter = read('src/campus-pulse/workbench/workbenchViewModel.ts')
  assert.match(adapter, /Array\.isArray\(envelope\.items\) \? envelope\.items/)
})
