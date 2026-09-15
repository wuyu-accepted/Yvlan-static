import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('CampusPulse product home, ForumTwin, result center and system evidence routes are explicit', () => {
  const router = read('src/router/index.js')
  const overview = read('src/views/CampusPulseOverviewView.vue')
  const results = read('src/views/CampusPulseResultsView.vue')
  const system = read('src/views/CampusPulseSystemView.vue')
  const forum = read('src/views/ForumTwinView.vue')
  assert.match(router, /path: '\/campus-pulse',[\s\S]*?component: CampusPulseOverviewView/)
  assert.match(router, /path: '\/campus-pulse\/forum',[\s\S]*?component: ForumTwinView/)
  assert.match(router, /path: '\/campus-pulse\/results',[\s\S]*?component: CampusPulseResultsView/)
  assert.match(router, /path: '\/campus-pulse\/system',[\s\S]*?component: CampusPulseSystemView/)
  assert.match(router, /path: '\/campus-pulse\/archive\/yulan-scale-v1'/)
  assert.match(router, /component: YuLanScaleView/)
  for (const source of [overview, results, system, forum]) {
    assert.doesNotMatch(source, /WorkbenchSidebar/)
    assert.doesNotMatch(source, /<main|<\/main>/)
  }
  assert.doesNotMatch(overview, /\.product-page \{[^}]*height: 100vh[^}]*overflow-y: auto/)
  assert.doesNotMatch(forum, /\.forum-page \{[^}]*height: 100vh[^}]*overflow-y: auto/)
  assert.doesNotMatch(forum, /<aside class="brand-rail"/)
})

test('Workbench locks the v8 population and Provider risk budget', () => {
  const workbench = read('src/views/campus-pulse/workbench/WorkbenchHomeView.vue')
  assert.match(workbench, /execution_mode === 'llm_forum_twin'/)
  assert.match(workbench, /runForm\.agent_count = 1_000/)
  assert.match(workbench, /runForm\.token_budget = 80_000_000/)
  assert.match(workbench, /runForm\.model_name = 'gpt-5\.4-mini'/)
  assert.match(workbench, /semantic-llm-forum-agent-population-v2-reviewed/)
  assert.match(workbench, /workflow-guide/)
  assert.match(workbench, /id="runtime-step"/)
})

test('Runtime panel recognizes result-v6 and only unlocks formal ForumTwin', () => {
  const panel = read('src/components/campus-pulse/RunExecutionPanel.vue')
  assert.match(panel, /campus-pulse-live-aggregate-result-v6/)
  assert.match(panel, /completed_primary_slots === 16_544/)
  assert.match(panel, /privacy\?\.scan_passed === true/)
  assert.match(panel, /reviewed_trace_replay/)
  assert.match(panel, /authorized_live_llm/)
  assert.match(panel, /打开 ForumTwin 平行论坛/)
  assert.match(panel, /path: '\/campus-pulse\/forum'/)
})

test('Forum route is a thin shell over the investigation workspace without generated speech', () => {
  const view = read('src/views/ForumTwinView.vue')
  const page = read('src/campus-pulse/forum/ForumInvestigationPage.vue')
  const status = JSON.parse(read('public/campus-pulse-data/forum-twin-development-status.json'))
  assert.equal(status.backend_loop_ready, true)
  assert.equal(status.publication_eligible, false)
  assert.equal(status.engineering_evidence.provider_calls, 0)
  assert.equal(status.engineering_evidence.public_fixture_messages, 0)
  assert.match(view, /ForumInvestigationPage/)
  assert.doesNotMatch(page, /Math\.random|randomUUID/)
  assert.match(page, /new ResultResolver\(\)/)
})

test('Forum workspace defaults to the hash-verified offline Hero source explicitly', () => {
  const page = read('src/campus-pulse/forum/ForumInvestigationPage.vue')
  const resolver = read('src/campus-pulse/source/resultResolver.ts')
  const service = read('src/services/resourcePolicyHero.ts')
  assert.match(page, /HERO_SOURCE_KEY/)
  assert.match(page, /result: HERO_RESULT_KEY/)
  assert.match(resolver, /loadResourcePolicyHero/)
  assert.match(service, /campus-pulse-resource-allocation-sandbox-result-v1/)
  assert.match(service, /authorized_live_llm/)
  assert.match(service, /RESOURCE_POLICY_RESULT_HASH_FILE/)
  assert.match(service, /emulator_public_messages !== 0/)
  assert.match(service, /unknown_outcomes[^\n]*!== 0/)
})

test('Result center derives the governance uptake story from sealed hero mechanism chains', () => {
  const hero = JSON.parse(read('public/campus-pulse-data/forum-twin-hero-showcase-v1.json'))
  const chains = hero.result.branches.D.mechanism_chains.governance_uptake_chains
  const complete = chains.filter((chain) => chain.complete)
  const responseIds = new Set(complete.flatMap((chain) => chain.resident_response_ids))
  const adapter = read('src/campus-pulse/source/forumTwinAdapter.ts')
  const analysis = read('src/campus-pulse/results/resultsAnalysis.ts')
  const governance = read('src/campus-pulse/results/GovernancePage.vue')
  assert.equal(chains.length, 7)
  assert.equal(complete.length, 4)
  assert.equal(responseIds.size, 15)
  assert.match(adapter, /governance_uptake_chains/)
  assert.match(adapter, /completeChains/)
  assert.match(analysis, /completeChains/)
  assert.match(analysis, /totalChains/)
  assert.match(governance, /完整承接链/)
})
