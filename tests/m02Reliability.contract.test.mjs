import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import { normalizeApiProblem, unwrapApiEnvelope } from '../src/campus-pulse/api/http.ts'
import { forumTwinEndpointInventory } from '../src/campus-pulse/contracts/api.ts'
import { ResultResolver, sourceProblem } from '../src/campus-pulse/source/resultResolver.ts'
import { canonicalResultLocation, legacyRunResultLocation } from '../src/campus-pulse/source/routeResolver.ts'
import { HERO_SOURCE_KEY, LECTURE_HERO_SOURCE_KEY, LIVE_SOURCE_KEY, listSourceDescriptors, sourceResolutionPriority } from '../src/campus-pulse/source/registry.ts'

const read = (path) => readFileSync(resolve(path), 'utf8')

function loadedFixture({ provenance = 'authorized_live_llm', publication = false } = {}) {
  const timeline = [
    { tick: 0, public_message_count: 1, active_thread_ids: [], claim_count: 0, metrics: {} },
    { tick: 1, public_message_count: 3, active_thread_ids: [], claim_count: 0, metrics: {} },
  ]
  return {
    aggregate: {
      run_id: 'run_contract_001',
      execution_provenance: provenance,
      publication_eligible: publication,
      domain_result: { audit: { llm_agent_count: 1000 } },
    },
    domain: {
      scenarios: [{ scenario_id: 'scenario_contract_001' }],
      parallel_forums: {
        scenario_contract_001: { natural: { timeline }, D: { timeline } },
      },
      llm_usage: { resident_turns: 10, provider_tokens: 20 },
    },
    manifestSha256: 'a'.repeat(64),
    threads: [{}], messages: [{}], claims: [{}], profiles: [],
  }
}

test('M02 endpoint inventory and backend run-plan schema stay aligned', () => {
  assert.deepEqual(forumTwinEndpointInventory, {
    health: '/health', readiness: '/readiness', capability: '/live-runtime/capability',
    run: '/runs/{runId}', result: '/runs/{runId}/result',
    manifest: '/runs/{runId}/forum-twin/manifest',
    threads: '/runs/{runId}/forum-twin/threads', plan: '/projects/{projectId}/runs',
  })
  const backendRoute = read('../backend/routers/campus_pulse.py')
  assert.match(backendRoute, /"budgeted_llm_agent_population"/)
  assert.match(backendRoute, /"llm_forum_twin"/)
  assert.match(backendRoute, /le=80_000_000/)
  assert.match(backendRoute, /"llm_forum_twin": 80_000_000/)
  assert.match(backendRoute, /"budgeted_llm_agent_population": 40_000_000/)
})

test('M02 registry exposes two audited cases and the API source in deterministic priority', () => {
  assert.deepEqual(listSourceDescriptors().map((source) => source.key), [HERO_SOURCE_KEY, LECTURE_HERO_SOURCE_KEY, LIVE_SOURCE_KEY])
  assert.deepEqual(sourceResolutionPriority, [LIVE_SOURCE_KEY, HERO_SOURCE_KEY, LECTURE_HERO_SOURCE_KEY])
  const service = read('src/services/forumTwin.ts')
  assert.doesNotMatch(service, /forum-twin-v1\.(json|visualization)/)
  assert.match(service, /source must be explicit/)
})

test('M02 resolver verifies Hero and preserves live replay provenance', async () => {
  const resolver = new ResultResolver({
    loadHero: async () => loadedFixture(),
    loadLectureHero: async () => loadedFixture(),
    loadLive: async () => loadedFixture({ provenance: 'reviewed_trace_replay', publication: true }),
  })
  const hero = await resolver.resolve(HERO_SOURCE_KEY)
  assert.equal(hero.status, 'success')
  assert.equal(hero.source.mode, 'offline_hero')
  assert.equal(hero.source.verification, 'verified')
  assert.equal(hero.source.availability.access, 'readonly')
  assert.equal(hero.source.publicationEligible, false)

  const lecture = await resolver.resolve(LECTURE_HERO_SOURCE_KEY)
  assert.equal(lecture.status, 'success')
  assert.equal(lecture.source.mode, 'offline_hero')
  assert.equal(lecture.source.verification, 'verified')

  const live = await resolver.resolve(LIVE_SOURCE_KEY, 'run_contract_001')
  assert.equal(live.status, 'success')
  assert.equal(live.source.mode, 'live_api')
  assert.equal(live.source.provenance.executionProvenance, 'reviewed_trace_replay')
  assert.equal(live.source.publicationEligible, true)
})

test('M02 live failure never silently falls through to Hero', async () => {
  const resolver = new ResultResolver({
    loadHero: async () => loadedFixture(),
    loadLive: async () => { throw Object.assign(new Error('down'), { name: 'ApiProblem', kind: 'network', code: 'backend_unavailable', summary: '后端不可用', detail: '启动后端', retryable: true, action: 'start_backend', fieldErrors: [], sourceImpact: 'unavailable' }) },
  })
  const live = await resolver.resolve(LIVE_SOURCE_KEY, 'run_contract_001')
  assert.equal(live.status, 'error')
  assert.equal(live.requestedSource, LIVE_SOURCE_KEY)
  const explicitlySelectedHero = await resolver.resolve(HERO_SOURCE_KEY)
  assert.equal(explicitlySelectedHero.status, 'success')
  assert.equal(explicitlySelectedHero.source.mode, 'offline_hero')
})

test('M02 stale responses cannot replace a newer source selection', async () => {
  let releaseHero
  const heroPromise = new Promise((resolvePromise) => { releaseHero = resolvePromise })
  const resolver = new ResultResolver({
    loadHero: () => heroPromise,
    loadLive: async () => loadedFixture(),
  })
  const first = resolver.resolve(HERO_SOURCE_KEY)
  const second = await resolver.resolve(LIVE_SOURCE_KEY, 'run_contract_001')
  releaseHero(loadedFixture())
  const stale = await first
  assert.equal(second.status, 'success')
  assert.equal(stale.status, 'error')
  assert.equal(stale.problem.code, 'stale_response')
})

test('M02 normalizes network, HTTP, field and malformed envelope failures', () => {
  const network = normalizeApiProblem({ isAxiosError: true, code: 'ERR_NETWORK' })
  const notFound = normalizeApiProblem({ isAxiosError: true, response: { status: 404, data: {} } })
  const invalid = normalizeApiProblem({ isAxiosError: true, response: { status: 422, data: { detail: { code: 'RequestValidationError', message: 'SECRET_SENTINEL', issues: [{ location: ['body', 'token_budget'], code: 'invalid_request_field', message: 'SECRET_SENTINEL' }] } } } })
  const conflict = normalizeApiProblem({ isAxiosError: true, response: { status: 409, data: {} } })
  const precondition = normalizeApiProblem({ isAxiosError: true, response: { status: 412, data: {} } })
  const server = normalizeApiProblem({ isAxiosError: true, response: { status: 503, data: {} } })
  const duplicate = normalizeApiProblem({
    isAxiosError: true,
    response: {
      status: 409,
      data: { detail: { code: 'WorkbenchConflictError', message: 'A project with this name already exists' } },
    },
  })
  assert.equal(network.kind, 'network')
  assert.equal(notFound.status, 404)
  assert.equal(invalid.action, 'correct_input')
  assert.equal(invalid.fieldErrors[0].field, 'token_budget')
  assert.doesNotMatch(JSON.stringify(invalid), /SECRET_SENTINEL/)
  assert.equal(conflict.action, 'retry')
  assert.equal(precondition.action, 'correct_input')
  assert.equal(server.retryable, true)
  assert.equal(duplicate.detail, '已存在同名项目，请修改项目名称。')
  assert.throws(() => unwrapApiEnvelope({ data: { value: 1 } }), /后端响应契约不完整/)
})

test('M02 distinguishes missing, malformed and mismatched provenance', () => {
  const missing = sourceProblem(new Error('ForumTwin run result HTTP 404'))
  const malformed = sourceProblem(new Error('schema mismatch'))
  const mismatch = sourceProblem(new Error('manifest SHA-256 mismatch'))
  assert.equal(missing.status, 404)
  assert.equal(malformed.kind, 'contract')
  assert.equal(mismatch.kind, 'verification')
  assert.equal(mismatch.sourceImpact, 'unverified')
})

test('M02 private request fields are not reflected in client problems', () => {
  const problem = normalizeApiProblem({
    isAxiosError: true,
    response: { status: 422, data: { detail: { issues: [
      { location: ['body', 'provider_api_key'], message: 'PRIVATE_KEY_SENTINEL' },
      { location: ['body', 'raw_text'], message: 'RAW_TEXT_SENTINEL' },
    ] } } },
  })
  const serialized = JSON.stringify(problem)
  assert.doesNotMatch(serialized, /provider_api_key|raw_text|PRIVATE_KEY_SENTINEL|RAW_TEXT_SENTINEL/)
})

test('M02 canonical routes reject invalid source/query combinations', () => {
  assert.deepEqual(canonicalResultLocation({ source: HERO_SOURCE_KEY, resultKey: 'hero-r9' }), {
    sourceKey: HERO_SOURCE_KEY, runId: undefined, resultKey: 'hero-r9', needsReplace: false,
  })
  assert.deepEqual(canonicalResultLocation({ source: 'cache', resultKey: 'x' }), {
    sourceKey: 'cache', runId: undefined, resultKey: 'x', needsReplace: false,
  })
  assert.equal(legacyRunResultLocation('run_1234567890abcdef12345678').query.source, LIVE_SOURCE_KEY)
  assert.equal(legacyRunResultLocation('../private'), null)
})

test('M02 reliability components parse and compile', () => {
  for (const relative of [
    'src/campus-pulse/components/SourcePicker.vue',
    'src/campus-pulse/components/VerificationDetails.vue',
    'src/campus-pulse/components/ApiProblemPanel.vue',
    'src/campus-pulse/pages/ResultSummaryBoundary.vue',
  ]) {
    const file = resolve(relative)
    const parsed = parse(readFileSync(file, 'utf8'), { filename: file })
    assert.deepEqual(parsed.errors, [])
    const script = compileScript(parsed.descriptor, { id: `m02-${relative.length}` })
    const template = compileTemplate({
      id: `m02-${relative.length}`,
      filename: file,
      source: parsed.descriptor.template?.content || '',
      compilerOptions: { bindingMetadata: script.bindings },
    })
    assert.deepEqual(template.errors, [], `${relative} template errors`)
  }
})
