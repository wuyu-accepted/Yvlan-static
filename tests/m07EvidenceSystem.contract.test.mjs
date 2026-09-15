import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import {
  DEFAULT_SYSTEM_TAB,
  evidenceReleasesFromPayload,
  evidenceSnapshotDetailFromPayload,
  evidenceSnapshotsFromPayload,
  gatesFromPayloads,
  hasForbiddenEvidenceKey,
  HERO_ASSET,
  runtimeCapabilitiesFrom,
  systemTabFromQuery,
  verifyOfflineHeroAsset,
  versionsFromPayloads,
} from '../src/campus-pulse/system/systemViewModel.ts'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('M07 system tabs and evidence boundary fit the mobile viewport', () => {
  const source = read('src/views/CampusPulseSystemView.vue')
  assert.match(source, /\.tab-bar \{ display:grid; grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(source, /\.boundary-row \{ min-width:0; grid-template-columns:1fr/)
  assert.match(source, /\.system-workspace \{ max-width:100%; min-width:0;/)
})

function compileSfc(path) {
  const source = readFileSync(resolve(path), 'utf8')
  const parsed = parse(source, { filename: path })
  assert.deepEqual(parsed.errors, [], path + ' parse errors')
  const id = 'm07-' + path.length
  const script = parsed.descriptor.scriptSetup
    ? compileScript(parsed.descriptor, { id })
    : undefined
  const template = compileTemplate({
    id,
    filename: path,
    source: parsed.descriptor.template?.content || '',
    compilerOptions: { bindingMetadata: script?.bindings },
  })
  assert.deepEqual(template.errors, [], path + ' template errors')
}

async function servePublic(dir) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://x').pathname)
      const file = resolve(dir, '.' + pathname)
      if (!file.startsWith(resolve(dir))) {
        response.writeHead(403).end()
        return
      }
      const content = await readFile(file)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(content)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  const base = 'http://127.0.0.1:' + address.port
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input) => {
    const raw = String(input)
    const url = raw.startsWith('/') ? new URL(raw, base).toString() : raw
    return originalFetch(url)
  }
  return {
    base,
    close: async () => {
      globalThis.fetch = originalFetch
      await new Promise((done) => server.close(done))
    },
  }
}

test('M07 gates map real payloads and never invent ready', () => {
  const checkedAt = '2026-08-10T00:00:00.000Z'
  const gates = gatesFromPayloads(
    { status: 'healthy', service: 'campus-pulse-workbench' },
    {
      status: 'ready',
      checks: {
        database: 'ready',
        schema: 'current',
        runtime_adapter: 'disabled_by_configuration',
        worker_heartbeat: 'not_required',
      },
      runtime_enqueue_ready: false,
      live_llm_gate: 'disabled',
      schema_version: 'v1',
      expected_schema_version: 'v1',
    },
    {
      capability_schema_version: 'campus-pulse-live-capability-v1',
      phase: 'p3.2b_deterministic_transport',
      qualification: 'not_ready',
      live_gate: 'disabled',
      provider_profile_state: 'not_installed',
      executor_state: 'not_installed',
      live_enqueue_ready: false,
      live_enqueue_blocker: 'authorized_provider_runtime_not_installed',
      deterministic_fixture: { executor_state: 'installed', provider_calls_permitted: false },
      asset_bundle: { bundle_id: 'b', state: 'not_installed' },
      template_mapping: { mapping_id: 'm' },
    },
    checkedAt,
  )
  assert.equal(gates.length, 13)
  const byId = Object.fromEntries(gates.map((gate) => [gate.id, gate]))
  assert.equal(byId.backend_api.status, 'ready')
  assert.equal(byId.database.status, 'ready')
  assert.equal(byId.runtime_adapter.status, 'degraded')
  assert.equal(byId.runtime_enqueue.status, 'blocked')
  assert.equal(byId.live_enqueue.status, 'blocked')
  assert.equal(byId.deterministic_fixture.status, 'ready')
  assert.equal(byId.asset_bundle.status, 'blocked')
  assert.equal(byId.provider_profile.status, 'blocked')
  for (const gate of gates) assert.equal(gate.checkedAt, checkedAt)
})

test('M07 unknown fields never become ready', () => {
  const gates = gatesFromPayloads(null, null, null, 't')
  for (const gate of gates) {
    assert.notEqual(gate.status, 'ready', gate.id + ' must not be ready without data')
    assert.ok(gate.nextAction, gate.id + ' needs a next action')
  }
})

test('M07 runtime capability table derives from capability payload only', () => {
  const caps = runtimeCapabilitiesFrom({
    phase: 'p3.2b',
    capability_schema_version: 'v1',
    qualification: 'ready',
    live_gate: 'enabled',
    provider_profile_state: 'enabled',
    executor_state: 'installed',
    live_enqueue_ready: false,
    live_enqueue_blocker: 'authorization_required',
    deterministic_fixture: { executor_state: 'installed', provider_calls_permitted: false },
    asset_bundle: { bundle_id: 'bundle-x', state: 'qualified' },
    template_mapping: { mapping_id: 'map-1' },
  })
  assert.ok(caps.some((item) => item.key === 'live_enqueue' && item.value === '不可入队'))
  assert.ok(caps.some((item) => item.key === 'asset_bundle' && item.value.includes('bundle-x')))
  assert.ok(caps.some((item) => item.key === 'fixture'))
})

test('M07 offline hero verifier passes on real asset and fails closed on mismatch', async () => {
  const publicDir = resolve('public')
  const heroBase = await servePublic(publicDir)
  try {
    const verified = await verifyOfflineHeroAsset()
    assert.equal(verified.status, 'verified')
    assert.equal(verified.schemaVersion, 'campus-pulse-resource-allocation-sandbox-result-v1')
    assert.equal(verified.publicationEligible, false)
    assert.ok(verified.expectedSha256 && /^[0-9a-f]{64}$/.test(verified.expectedSha256))
  } finally {
    await heroBase.close()
  }
})

test('M07 offline hero verifier reports mismatch and missing honestly', async () => {
  const { mkdtemp, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join: joinPath } = await import('node:path')
  const dir = await mkdtemp(joinPath(tmpdir(), 'm07-hero-'))
  const original = await readFile(resolve('public/campus-pulse-data/resource-policy-live-r1.json'), 'utf8')
  const shaOriginal = (await readFile(resolve('public/campus-pulse-data/resource-policy-live-r1.sha256'), 'utf8')).trim()
  const tampered = original + '\n'
  const { mkdir } = await import('node:fs/promises')
  await mkdir(joinPath(dir, 'campus-pulse-data'), { recursive: true })
  const { createHash } = await import('node:crypto')
  const tamperedHash = createHash('sha256').update(tampered).digest('hex')
  await writeFile(joinPath(dir, 'campus-pulse-data/resource-policy-live-r1.json'), tampered)
  await writeFile(joinPath(dir, 'campus-pulse-data/resource-policy-live-r1.sha256'), shaOriginal + '\n')
  const tamperedBase = await servePublic(dir)
  try {
    const mismatch = await verifyOfflineHeroAsset()
    assert.equal(mismatch.status, 'mismatch')
    assert.equal(mismatch.actualSha256, tamperedHash)
  } finally {
    await tamperedBase.close()
  }
  // missing asset -> missing status
  const { mkdtemp: mkdtemp2 } = await import('node:fs/promises')
  const emptyDir = await mkdtemp2(joinPath(tmpdir(), 'm07-hero-empty-'))
  const emptyBase = await servePublic(emptyDir)
  try {
    const missing = await verifyOfflineHeroAsset()
    assert.equal(missing.status, 'missing')
  } finally {
    await emptyBase.close()
  }
})

test('M07 evidence releases normalize with a public-field whitelist', () => {
  const releases = evidenceReleasesFromPayload([
    {
      release_key: 'campus-forum-20260721-reviewed',
      label: 'Reviewed 校园论坛证据',
      manifest_schema_version: 'campus-pulse-evidence-manifest-v1',
      manifest_sha256: 'a'.repeat(64),
      snapshot_id: 'snap-1',
      status: 'sealed',
      privacy_mode: 'privacy_safe',
      source_rows: 3000,
      source_bytes: 999,
      analysis_artifact_count: 12,
      zero_raw_rows_persisted: true,
      raw_forum_text: 'never expose this',
      source_id: 'never expose this either',
    },
  ])
  assert.equal(releases.length, 1)
  const release = releases[0]
  assert.equal(release.releaseKey, 'campus-forum-20260721-reviewed')
  assert.equal(release.sourceRows, 3000)
  assert.equal(release.zeroRawRowsPersisted, true)
  assert.equal('raw_forum_text' in release, false)
  assert.equal('source_id' in release, false)
})

test('M07 evidence snapshots and detail normalize lineage fields', () => {
  const snapshots = evidenceSnapshotsFromPayload([
    {
      snapshot_id: 's1',
      label: '源证据快照',
      status: 'sealed',
      manifest_sha256: 'b'.repeat(64),
      artifact_sha256: 'c'.repeat(64),
      schema_version: 'v1',
      generated_at_utc: '2026-07-21T00:00:00Z',
      source_snapshot_id: 'parent',
      source_manifest_sha256: 'd'.repeat(64),
      taxonomy_release_sha256: 'e'.repeat(64),
      persona_evidence_sha256: 'f'.repeat(64),
      persona_release_sha256: 'g'.repeat(64),
      sources: [{ role: 'a' }, { role: 'b' }],
      analysis_artifacts: [{ analysis_id: 'x' }, { analysis_id: 'y' }, { analysis_id: 'z' }],
    },
  ])
  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0].sourceCount, 2)
  assert.equal(snapshots[0].artifactCount, 3)
  const detail = evidenceSnapshotDetailFromPayload({
    snapshot_id: 's1',
    label: '源证据快照',
    status: 'sealed',
    manifest_sha256: 'b'.repeat(64),
    zero_raw_rows_persisted: true,
    sources: [{ role: 'corpus', sha256: 'h'.repeat(64), rows: 100, bytes: 500 }],
    analysis_artifacts: [{ analysis_id: 'an-1', artifact_kind: 'taxonomy', artifact_sha256: 'i'.repeat(64), evidence_stage: 'reviewed', quality_grade: 'A', causal_status: 'not_identified' }],
  })
  assert.equal(detail?.sources[0].role, 'corpus')
  assert.equal(detail?.artifacts[0].causalStatus, 'not_identified')
  assert.equal(detail?.zeroRawRowsPersisted, true)
  assert.equal(evidenceSnapshotDetailFromPayload({}), null)
})

test('M07 forbidden evidence keys are rejected before rendering', () => {
  assert.equal(hasForbiddenEvidenceKey({ snapshot_id: 'ok', sources: [{ role: 'a' }] }), null)
  assert.ok(hasForbiddenEvidenceKey({ sources: [{ source_id: 's' }] }))
  assert.ok(hasForbiddenEvidenceKey({ raw_text: 'x' }))
  assert.ok(hasForbiddenEvidenceKey({ private_vector_index: 'x' }))
  assert.ok(hasForbiddenEvidenceKey({ api_key: 'x' }))
  assert.ok(hasForbiddenEvidenceKey({ authorization: 'Bearer x' }))
  assert.equal(hasForbiddenEvidenceKey(null), null)
})

test('M07 system tab state normalizes invalid values', () => {
  assert.equal(systemTabFromQuery('bogus'), DEFAULT_SYSTEM_TAB)
  assert.equal(systemTabFromQuery('evidence'), 'evidence')
  assert.equal(systemTabFromQuery('provider'), 'provider')
  assert.equal(systemTabFromQuery(undefined), DEFAULT_SYSTEM_TAB)
})

test('M07 Provider configuration stays machine-local and never repopulates the key', () => {
  const tab = read('src/campus-pulse/system/SystemProviderTab.vue')
  const api = read('src/services/campusPulseApi.js')
  const view = read('src/views/CampusPulseSystemView.vue')
  assert.match(view, /模型配置/)
  assert.match(api, /getProviderConfig/)
  assert.match(api, /saveProviderConfig/)
  assert.match(api, /testProviderConfig/)
  assert.match(api, /clearProviderConfig/)
  assert.match(tab, /~\/.campus-pulse\/provider-key/)
  assert.match(tab, /autocomplete="new-password"/)
  assert.match(tab, /form\.api_key = ''/)
  assert.doesNotMatch(tab, /localStorage|sessionStorage/)
})

test('M07 system view keeps truth anchors and drops hardcoded scale numbers', () => {
  const view = read('src/views/CampusPulseSystemView.vue')
  assert.match(view, /<h1>系统与证据<\/h1>/)
  assert.match(view, /<h2 id="evidence-boundary-title">数据与证据边界<\/h2>/)
  assert.match(view, /不是实时全校舆情/)
  assert.match(view, /LLM 负责语言表达与治理判断；后台计算负责状态、调度与资源队列/)
  for (const artifact of [
    '582,408', '132,917', '454,053', '22,477', '67 turns', '10,000 个粒子',
    '单轮最多 67', '八个配对种子', 'emulator public messages = 0',
  ]) {
    assert.doesNotMatch(view, new RegExp(artifact), artifact)
  }
})

test('M07 system page probes real endpoints and never hardcodes READY', () => {
  const view = read('src/views/CampusPulseSystemView.vue')
  for (const token of ['getWorkbenchHealth', 'getWorkbenchReadiness', 'getLiveRuntimeCapability', 'verifyOfflineHeroAsset']) {
    assert.match(view, new RegExp(token))
  }
  const readiness = read('src/campus-pulse/system/SystemReadinessTab.vue')
  assert.match(readiness, /查看服务连接、运行能力与案例文件状态/)
  assert.match(readiness, /status === 'ready' \? '就绪'/)
  assert.doesNotMatch(readiness.split('<template>')[1], /actualSha256|expectedSha256|version\.value/)
  assert.match(view, /未知状态保持未知/)
})

test('M07 navigation includes team credits and system meta is readiness-based', () => {
  const navigation = read('src/campus-pulse/app/navigation.js')
  assert.equal((navigation.match(/Object\.freeze\(\{ id:/g) || []).length, 6)
  assert.doesNotMatch(navigation, /static-system-claims/)
  assert.match(navigation, /System Readiness（后端探测）/)
})

test('M07 archive and legacy views stay lazy and out of product route chunks', () => {
  const router = read('src/router/index.js')
  for (const token of ['YuLanScaleView', 'GovernanceArenaView', 'MassSimulationView', 'RepresentativeSimulationView', 'CategoryView']) {
    assert.match(router, new RegExp('const ' + token + ' = \\(\\) =>'))
  }
  const productViews = [
    'src/views/CampusPulseOverviewView.vue',
    'src/views/ForumTwinView.vue',
    'src/views/CampusPulseResultsView.vue',
    'src/views/campus-pulse/workbench/WorkbenchHomeView.vue',
    'src/views/CampusPulseSystemView.vue',
  ].join('\n')
  for (const path of productViews) {
    // only used as a marker above; real assertions below on the actual files
  }
  for (const file of [
    'src/views/CampusPulseOverviewView.vue',
    'src/views/ForumTwinView.vue',
    'src/views/CampusPulseResultsView.vue',
    'src/views/campus-pulse/workbench/WorkbenchHomeView.vue',
    'src/views/CampusPulseSystemView.vue',
  ]) {
    const source = read(file)
    for (const legacy of ['GovernanceArenaView', 'YuLanScaleView', 'MassSimulationView', 'RepresentativeSimulationView']) {
      assert.doesNotMatch(source, new RegExp(legacy), file + ' must not import ' + legacy)
    }
  }
})

test('M07 dirty guards are not applicable: every write is immediate submit', () => {
  const files = [
    'src/campus-pulse/workbench/WorkbenchWorkspacePage.vue',
    'src/campus-pulse/workbench/WorkbenchProjectCreateDialog.vue',
    'src/campus-pulse/workbench/WorkbenchScenarioPanel.vue',
    'src/campus-pulse/workbench/WorkbenchPolicyPanel.vue',
    'src/campus-pulse/workbench/WorkbenchPlanPanel.vue',
    'src/campus-pulse/system/SystemEvidenceTab.vue',
  ]
  for (const file of files) {
    const source = read(file)
    assert.doesNotMatch(source, /beforeunload|onbeforeunload/, file + ' has no beforeunload guard (immediate submit model)')
  }
  // no local draft persistence for write forms
  const combined = files.map((file) => read(file)).join('\n')
  assert.doesNotMatch(combined, /localStorage.*draft|draft.*localStorage/)
})

test('M07 evidence tab exposes accessible dialog, table semantics and audit links', () => {
  const tab = read('src/campus-pulse/system/SystemEvidenceTab.vue')
  assert.match(tab, /role="dialog"/)
  assert.match(tab, /aria-modal="true"/)
  assert.match(tab, /@keydown\.esc=/)
  assert.match(tab, /RouterLink to="\/campus-pulse\/results\/resource-policy-r1\/evidence\?source=offline-hero"/)
  const view = read('src/views/CampusPulseSystemView.vue')
  assert.match(view, /role="table"/)
  assert.match(view, /aria-label="数据与证据边界"/)
})

test('M07 readiness tab exposes tablist and status icon+text redundancy', () => {
  const tab = read('src/campus-pulse/system/SystemReadinessTab.vue')
  const view = read('src/views/CampusPulseSystemView.vue')
  assert.match(view, /role="tablist"/)
  assert.match(view, /aria-selected=/)
  assert.match(tab, /CpStatusBadge/)
  assert.match(tab, /caption class="sr-only"/)
})

test('M07 system SFCs parse and compile', () => {
  for (const file of [
    'src/views/CampusPulseSystemView.vue',
    'src/campus-pulse/system/SystemReadinessTab.vue',
    'src/campus-pulse/system/SystemEvidenceTab.vue',
    'src/campus-pulse/system/SystemProviderTab.vue',
  ]) {
    compileSfc(file)
  }
})

test('M07 no secrets or local absolute paths in system sources', () => {
  const systemDir = resolve('src/campus-pulse/system')
  const viewPath = resolve('src/views/CampusPulseSystemView.vue')
  const files = []
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      const file = join(dir, name)
      const info = await stat(file)
      if (info.isDirectory()) await walk(file)
      else files.push(file)
    }
  }
  return (async () => {
    await walk(systemDir)
    files.push(viewPath)
    for (const file of files) {
      const text = await readFile(file, 'utf8')
      assert.doesNotMatch(text, /D:\\Program\\|C:\\Users\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/, relative(resolve('src'), file))
    }
  })()
})

test('M07 hero asset identity is consistent across source registry and manifest', () => {
  const registry = read('src/campus-pulse/source/registry.ts')
  assert.match(registry, /resultUrl: '\/campus-pulse-data\/resource-policy-live-r1\.json'/)
  assert.match(registry, /hashUrl: '\/campus-pulse-data\/resource-policy-live-r1\.sha256'/)
  assert.match(registry, /expectedSchema: \['campus-pulse-resource-allocation-sandbox-result-v1'\]/)
  const heroJson = read('public/campus-pulse-data/resource-policy-live-r1.json')
  const parsed = JSON.parse(heroJson)
  assert.equal(parsed.result.schema_version, 'campus-pulse-resource-allocation-sandbox-result-v1')
  assert.equal(HERO_ASSET.expectedSchema, 'campus-pulse-resource-allocation-sandbox-result-v1')
})

test('M07 lecture open-choice hero is hash-bound and honestly discloses incomplete mechanisms', () => {
  const registry = read('src/campus-pulse/source/registry.ts')
  assert.match(registry, /resultUrl: '\/campus-pulse-data\/lecture-open-choice-r4\.json'/)
  assert.match(registry, /hashUrl: '\/campus-pulse-data\/lecture-open-choice-r4\.sha256'/)
  assert.match(registry, /expectedSchema: \['campus-pulse-forum-hero-result-v1'\]/)
  assert.match(registry, /没有形成完整纠错接受链或求助服务闭环/)
  const raw = read('public/campus-pulse-data/lecture-open-choice-r4.json')
  const expected = read('public/campus-pulse-data/lecture-open-choice-r4.sha256').trim()
  assert.equal(createHash('sha256').update(raw).digest('hex'), expected)
  const parsed = JSON.parse(raw)
  assert.equal(parsed.result.schema_version, 'campus-pulse-forum-hero-result-v1')
  assert.deepEqual(parsed.result.branches_executed, ['Natural', 'D'])
  assert.equal(parsed.live_usage.semantic_turns, 390)
  assert.equal(parsed.live_usage.unknown_outcomes, 0)
  assert.equal(parsed.result.targeted_capability_panel_used, false)
})

test('M07 no component fabricates a model release file', () => {
  const preflight = read('scripts/m07-preflight.mjs')
  assert.match(preflight, /model-release\.json/)
  assert.match(preflight, /不伪造/)
  const viewModel = read('src/campus-pulse/system/systemViewModel.ts')
  assert.doesNotMatch(viewModel, /model-release|_run/)
})

test('M07 BCI-003 contract stays server-sourced with no frontend estimates', () => {
  const systemSources = [
    read('src/campus-pulse/system/systemViewModel.ts'),
    read('src/campus-pulse/system/SystemReadinessTab.vue'),
    read('src/campus-pulse/system/SystemEvidenceTab.vue'),
    read('src/views/CampusPulseSystemView.vue'),
  ].join('\n')
  for (const estimate of ['16544', '33088', '1728', '13056']) {
    assert.doesNotMatch(systemSources, new RegExp(estimate), estimate)
  }
})
