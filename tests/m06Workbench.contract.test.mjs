import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import {
  apiProblemKey,
  DEFAULT_RUN_TAB,
  DEFAULT_SECTION,
  projectSectionLocation,
  runLocation,
  runTabFromQuery,
  sectionFromQuery,
  workspaceFromQuery,
  workspaceToQuery,
  WORKBENCH_SECTIONS,
} from '../src/campus-pulse/workbench/workbenchState.ts'
import { makeOperationToken } from '../src/campus-pulse/workbench/operationToken.ts'
import {
  ACTIVE_RUNTIME_STATES,
  CANCEL_REASONS,
  EXECUTION_MODE_LABELS,
  GOVERNANCE_V2_SEEDS,
  POLICY_TEMPLATE_WHITELIST,
  populationReleaseForMode,
  policyTemplateAllowed,
  PROJECT_EVALUATION_MODES,
  REVIEWED_POLICY_TEMPLATE_KEYS,
  RUNTIME_STATES,
  TERMINAL_RUNTIME_STATES,
  tokenBudgetContractFor,
  validateTokenBudget,
} from '../src/campus-pulse/workbench/workbenchCapabilities.ts'
import {
  countsFromOverview,
  dedupeEvents,
  evidenceBindingsFromPayload,
  fieldErrorsFromProblem,
  isCasConflict,
  isDuplicateProjectConflict,
  isRunActive,
  isRunTerminal,
  planContractFromRun,
  policyListFromPayload,
  projectFromPayload,
  projectListFromPayload,
  runEffectiveStatus,
  runEventsFromPayload,
  runFromPayload,
  runListFromPayload,
  runStateLabel,
  runtimeSummaryFrom,
  scenarioListFromPayload,
  SCENARIO_PHASE_IDS,
  sensingStateFromPayload,
  validatePolicyActions,
  validateProjectForm,
  validateScenarioPhases,
} from '../src/campus-pulse/workbench/workbenchViewModel.ts'

const read = (path) => readFileSync(resolve(path), 'utf8')
const WORKBENCH_DIR = 'src/campus-pulse/workbench'

function workbenchManifest() {
  return readFileSync(resolve(WORKBENCH_DIR, 'manifest.txt'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
}

function workbenchVueSources() {
  return workbenchManifest()
    .filter((file) => file.endsWith('.vue'))
    .map((file) => read(resolve(WORKBENCH_DIR, file)))
    .join('\n')
}

test('M06 URL restores project/section/run/filter and omits defaults', () => {
  const parsed = workspaceFromQuery({ project: 'p1', section: 'plan', run: 'r1', run_tab: 'events', q: '讲座', status: 'failed' })
  assert.equal(parsed.project, 'p1')
  assert.equal(parsed.section, 'plan')
  assert.equal(parsed.run, 'r1')
  assert.equal(parsed.runTab, 'events')
  assert.equal(parsed.q, '讲座')
  assert.equal(parsed.runStatus, 'failed')

  assert.equal(workspaceFromQuery({}).section, DEFAULT_SECTION)
  assert.equal(workspaceFromQuery({}).runTab, DEFAULT_RUN_TAB)
  assert.equal(sectionFromQuery('bogus'), DEFAULT_SECTION)
  assert.equal(runTabFromQuery('bogus'), DEFAULT_RUN_TAB)
  assert.equal(runTabFromQuery('contract'), 'contract')

  const full = { project: 'p1', section: 'plan', run: 'r1', runTab: 'events', q: 'x', runStatus: 'failed' }
  assert.deepEqual(workspaceFromQuery(workspaceToQuery(full)), full)

  assert.deepEqual(workspaceToQuery({ project: 'p1', section: 'overview', runTab: 'monitor' }), { project: 'p1' })

  assert.deepEqual(projectSectionLocation('p1', 'evidence'), { name: 'campus-pulse-workbench', query: { project: 'p1', section: 'evidence' } })
  const overviewLocation = projectSectionLocation('p1', 'overview')
  assert.equal(overviewLocation.name, 'campus-pulse-workbench')
  assert.equal(overviewLocation.query.project, 'p1')
  assert.equal(overviewLocation.query.section, undefined)
  assert.deepEqual(runLocation('p1', 'r9'), { name: 'campus-pulse-workbench', query: { project: 'p1', section: 'runs', run: 'r9' } })
  assert.equal(apiProblemKey({ kind: 'http', code: 'E422', status: 422 }), 'http:E422:422')
  assert.equal(apiProblemKey(null), '')
  assert.deepEqual(WORKBENCH_SECTIONS, ['overview', 'evidence', 'scenarios', 'policies', 'plan', 'runs'])
})

test('M06 overview counts keep unknown distinct from real zero', () => {
  const unknown = { projects: null, scenarios: null, policies: null, runs: null, evidence: null, sensing: null }
  assert.deepEqual(countsFromOverview(null), unknown)
  assert.deepEqual(countsFromOverview({}), unknown)
  const zeros = countsFromOverview({ counts: { projects: 0, scenarios: 0, policies: 0, runs: 0, evidence_snapshots: 0, sensing_snapshots: 0 } })
  assert.deepEqual(zeros, { projects: 0, scenarios: 0, policies: 0, runs: 0, evidence: 0, sensing: 0 })
  const partial = countsFromOverview({ counts: { projects: 2 } })
  assert.equal(partial.projects, 2)
  assert.equal(partial.scenarios, null)
  const stringy = countsFromOverview({ overview: { projects: '3' } })
  assert.equal(stringy.projects, null)
})

test('M06 project list normalizes entities and empty stays empty', () => {
  assert.deepEqual(projectListFromPayload([]), [])
  assert.deepEqual(projectListFromPayload(null), [])
  const list = projectListFromPayload([
    { project_id: 'p1', name: '讲座治理', governance_domain: '信息治理', objective: 'o', evaluation_mode: 'simulation_stress_test' },
    { project_id: 'p2', name: 'B', governance_domain: 'd', objective: 'o2' },
    { not_a_project: true },
  ])
  assert.equal(list.length, 2)
  assert.equal(list[0].evaluation_mode, 'simulation_stress_test')
  assert.equal(list[1].evaluation_mode, 'descriptive_pilot')
  assert.equal(projectFromPayload({ project_id: '' }), null)
  assert.deepEqual(scenarioListFromPayload([]), [])
  assert.deepEqual(policyListFromPayload([]), [])
  assert.deepEqual(runListFromPayload([]), [])
})

test('M06 project center collapses duplicate fixed templates to the newest record', () => {
  const list = projectListFromPayload([
    { project_id: 'old-century', name: '世纪馆“幽灵预约”治理预演', governance_domain: '体育场地预约', objective: 'old', created_at: '2026-09-10T08:00:00Z' },
    { project_id: 'new-century', name: '世纪馆预约服务治理预演', governance_domain: '体育场地预约', objective: 'new', created_at: '2026-09-13T08:00:00Z' },
    { project_id: 'custom-1', name: '我的新事件', governance_domain: '自定义', objective: 'keep both' },
  ])
  assert.deepEqual(list.map((item) => item.project_id), ['new-century', 'custom-1'])
})

test('M06 Century Gym is a singleton live-demo project, not a result-case copy', () => {
  const dialog = read('src/campus-pulse/workbench/WorkbenchProjectCreateDialog.vue')
  const workspace = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  assert.match(dialog, /existingCenturyGymProjectId/)
  assert.match(dialog, /进入现场项目/)
  assert.match(dialog, /世纪馆现场演示/)
  assert.doesNotMatch(dialog, /完整案例/)
  assert.match(workspace, /existing_project_id/)
  assert.match(workspace, /existing-century-gym-project-id/)
  assert.match(workspace, /century-gym-demo/)
})

test('M06 fixed Agent world exposes relationship, private channel, risk, and activation controls', () => {
  const world = read('src/campus-pulse/workbench/AgentWorldPanel.vue')
  const evidence = read('src/campus-pulse/workbench/WorkbenchEvidencePanel.vue')
  const plan = read('src/campus-pulse/workbench/WorkbenchPlanPanel.vue')
  const dialog = read('src/campus-pulse/workbench/WorkbenchProjectCreateDialog.vue')
  const api = read('src/services/campusPulseApi.js')
  assert.match(api, /\/forum-twin-v2\/agent-world/)
  assert.match(world, /人口与关系场/)
  assert.match(world, /好友私聊与动态小群/)
  assert.match(world, /七类可解释风险信号/)
  assert.match(world, /full_population_keyframes/)
  assert.match(world, /visibility-priority-rotation-pps-v3/)
  assert.match(world, /record-level friend edge/)
  assert.match(world, /representative_agents/)
  assert.match(world, /AgentDossierDrawer/)
  assert.match(world, /人物资料 · Prompt · 记忆 · 历史/)
  assert.match(evidence, /:project-id="projectId"/)
  assert.match(evidence, /AgentWorldPanel/)
  assert.match(plan, /固定人口世界与事件利益叠加/)
  assert.match(plan, /风险感知 · 关系承接 · 分层轮换 PPS/)
  assert.match(plan, /:readonly="isForumV2"/)
  assert.match(dialog, /项目接入固定校园 Agent 世界/)
})

test('M06 cases, the Century Gym demo, and new-project monitoring use one runtime world', () => {
  const runtime = read('src/campus-pulse/agent-world/ForumWorldRuntimeStage.vue')
  const historical = read('src/campus-pulse/agent-world/CaseAgentEvolution.vue')
  const century = read('src/campus-pulse/live/CenturyGymLivePage.vue')
  const world = read('src/campus-pulse/workbench/AgentWorldPanel.vue')
  const monitor = read('src/campus-pulse/workbench/WorkbenchRunMonitor.vue')
  assert.match(historical, /ForumWorldRuntimeStage/)
  assert.match(century, /ForumWorldRuntimeStage/)
  assert.match(world, /ForumWorldRuntimeStage/)
  assert.match(world, /variant === 'runtime'/)
  assert.match(world, /runtimeEvents/)
  assert.match(world, /world_edges/)
  assert.match(world, /private_direct/)
  assert.match(world, /private_group/)
  assert.match(monitor, /variant="runtime"/)
  assert.match(monitor, /setInterval\(\(\) => emit\('refreshRuntime'\), 4000\)/)
  assert.match(runtime, /role="button"/)
  assert.match(runtime, /runtime-world__inspector/)
  assert.match(runtime, /'idle' \| 'node' \| 'edge' \| 'follow'/)
  assert.match(runtime, /inspectorMode==='follow'/)
  assert.match(runtime, /实时跟踪 Agent/)
  assert.match(runtime, /step\.tick === props\.frame\.tick/)
  assert.match(century, /@start-follow="extendFrameForInspection"/)
  assert.match(runtime, /Nodes and edges are driven by the same runtime frame/)
})

test('M06 every representative Agent exposes a parallel public-private prompt dossier', () => {
  const dossier = read('src/campus-pulse/agent-world/AgentDossierDrawer.vue')
  const types = read('src/campus-pulse/agent-world/types.ts')
  assert.match(dossier, /PARALLEL OUTPUT CONTRACT/)
  assert.match(dossier, /0–1 个公开主动作/)
  assert.match(dossier, /0–6 个独立公开互动/)
  assert.match(dossier, /0–2 个私聊\/建群动作/)
  assert.match(dossier, /Each Tick freezes what every Agent can see/i)
  assert.match(dossier, /完整人物资料/)
  assert.match(dossier, /编辑本项目设定/)
  assert.match(dossier, /saveForumTwinV2AgentProfileOverride/)
  assert.match(dossier, /restoreForumTwinV2AgentProfile/)
  assert.doesNotMatch(dossier, /localStorage/)
  assert.match(dossier, /PUBLIC IDENTITY/)
  assert.match(dossier, /same forum and thread/i)
  assert.doesNotMatch(dossier, /tab==='persona'/)
  assert.match(types, /same_tick_commit_is_two_phase/)
  assert.match(types, /parallel_private_actions_max/)
})

test('M06 quick live vignette exposes one bounded preflight and no browser credential field', () => {
  const overview = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  const panel = read('src/campus-pulse/workbench/ForumLiveVignettePanel.vue')
  const api = read('src/services/campusPulseApi.js')
  assert.match(overview, /ForumLiveVignettePanel/)
  assert.match(panel, /primary_slots/)
  assert.match(panel, /resident_slots/)
  assert.match(panel, /governance_actor_slots/)
  assert.match(panel, /provider_request_hard_limit/)
  assert.match(panel, /provider_token_hard_limit/)
  assert.match(panel, /authorization_statement_sha256/)
  assert.match(panel, /unknown 不自动补发/)
  assert.match(panel, /result_summary/)
  assert.match(panel, /direct_governance_response_count/)
  assert.match(panel, /complete_correction_chains/)
  assert.match(panel, /resource_public_private_closed_loop/)
  assert.match(panel, /expected_committed_ticks/)
  assert.match(panel, /公域—私域主实验/)
  assert.match(panel, /unknown_resolution_required/)
  assert.match(panel, /resolveUnknownAndResume/)
  assert.match(panel, /模型与 API/)
  assert.match(panel, /campus-pulse\.quick-live-session\.v1/)
  assert.doesNotMatch(panel, /api[_-]?key|Bearer\s/i)
  assert.match(api, /\/live-vignettes\/prepare/)
  assert.match(api, /\/live-vignettes\/\$\{encodeURIComponent\(sessionId\)\}\/start/)
  assert.match(api, /\/live-vignettes\/\$\{encodeURIComponent\(sessionId\)\}\/resolve-unknown/)
})

test('M06 backend unavailable is never shown as zero and write actions disable', () => {
  const page = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  assert.match(page, /后端不可用/)
  assert.match(page, /连接恢复后可继续编辑项目/)
  assert.match(page, /shell\?\.serviceState/)
  assert.match(page, /serviceState.value === 'unavailable' \? 'unavailable' : 'readonly'/)
  assert.match(page, /Promise.allSettled/)
  assert.doesNotMatch(page, /access = ref.*\('unavailable'\)/)
  assert.match(page, /项目状态未知/)
  assert.match(page, /查看案例结果/)
  assert.match(page, /aria-label="模拟器工作流"/)
  assert.match(page, /'不可用'/)
  assert.match(page, /'未知'/)
  assert.match(page, /:disabled="access !== 'interactive'"/)
  const runsPanel = read('src/campus-pulse/workbench/WorkbenchRunsPanel.vue')
  assert.match(runsPanel, /后端不可用：运行记录未知。/)
  const evidencePanel = read('src/campus-pulse/workbench/WorkbenchEvidencePanel.vue')
  assert.match(evidencePanel, /不写入本地数据/)
  assert.match(evidencePanel, /绑定与激活已禁用/)
})

test('M06 BCI-001 token contract is exact and fail-closed', () => {
  assert.deepEqual(tokenBudgetContractFor('llm_forum_twin'), { min: 1000, required: 80_000_000, max: 80_000_000 })
  assert.deepEqual(tokenBudgetContractFor('budgeted_llm_agent_population'), { min: 1000, required: 40_000_000, max: 40_000_000 })
  assert.deepEqual(tokenBudgetContractFor('live_llm'), { min: 1000, max: 5_000_000 })
  assert.equal(validateTokenBudget('llm_forum_twin', 5_000_000).ok, false)
  assert.equal(validateTokenBudget('llm_forum_twin', 5_000_000).expected, 80_000_000)
  assert.equal(validateTokenBudget('llm_forum_twin', 80_000_000).ok, true)
  assert.equal(validateTokenBudget('budgeted_llm_agent_population', 40_000_000).ok, true)
  assert.equal(validateTokenBudget('budgeted_llm_agent_population', 5_000_000).ok, false)
  assert.equal(validateTokenBudget('live_llm', 5_000_000).ok, true)
  assert.deepEqual(tokenBudgetContractFor('llm_forum_twin_v2'), { min: 1000, max: 80_000_000 })
  assert.equal(validateTokenBudget('llm_forum_twin_v2', 80_000_000).ok, true)
  assert.equal(validateTokenBudget('live_llm', 5_000_001).ok, false)
  assert.equal(validateTokenBudget('live_llm', Number.NaN).ok, false)
  assert.equal(EXECUTION_MODE_LABELS.llm_forum_twin, 'LLM ForumTwin（正式）')
  assert.equal(populationReleaseForMode('llm_forum_twin'), 'semantic-llm-forum-agent-population-v2-reviewed')
  assert.equal(populationReleaseForMode('adaptive_particle_population'), 'semantic-population-v3-reviewed-1000')
  assert.equal(EXECUTION_MODE_LABELS.budgeted_llm_agent_population, '预算化 LLM Agent 人口（YuLan-Scale）')
})

test('M06 capability registry mirrors backend enums and whitelists', () => {
  assert.deepEqual([...RUNTIME_STATES], ['queued', 'leased', 'running', 'cancel_requested', 'succeeded', 'failed', 'cancelled'])
  assert.deepEqual([...ACTIVE_RUNTIME_STATES], ['queued', 'leased', 'running', 'cancel_requested'])
  assert.deepEqual([...TERMINAL_RUNTIME_STATES], ['succeeded', 'failed', 'cancelled'])
  assert.deepEqual(CANCEL_REASONS.map((reason) => reason.code), ['operator_requested', 'superseded_run', 'budget_revision'])
  assert.deepEqual(POLICY_TEMPLATE_WHITELIST.tongzhou_governance_notice_v2, ['natural_evolution_v2', 'combined_governance_v2'])
  assert.deepEqual(POLICY_TEMPLATE_WHITELIST.lecture_external_incident_v2, ['natural_evolution_v2'])
  assert.deepEqual(policyTemplateAllowed('tongzhou_governance_notice_v2', true), ['natural_evolution_v2', 'combined_governance_v2'])
  assert.deepEqual(policyTemplateAllowed('unknown_template', false), [])
  assert.deepEqual(policyTemplateAllowed(undefined, false), [])
  assert.deepEqual(REVIEWED_POLICY_TEMPLATE_KEYS, [
    'natural_evolution_v2',
    'combined_governance_v2',
    'century_gym_combined_governance_v1',
  ])
  assert.equal(GOVERNANCE_V2_SEEDS.length, 8)
  assert.deepEqual(PROJECT_EVALUATION_MODES.map((mode) => mode.code), ['simulation_stress_test', 'descriptive_pilot'])
})

test('M06 scenario requires exactly the four ordered phases', () => {
  assert.deepEqual(SCENARIO_PHASE_IDS, ['baseline', 'burst', 'spread', 'decay'])
  const valid = [
    { phase_id: 'baseline', label: '基线期', window: 'T0–T2' },
    { phase_id: 'burst', label: '事件爆发', window: 'T3–T6' },
    { phase_id: 'spread', label: '讨论扩散', window: 'T7–T14' },
    { phase_id: 'decay', label: '回落沉淀', window: 'T15–T23' },
  ]
  assert.deepEqual(validateScenarioPhases(valid), { ok: true })
  assert.equal(validateScenarioPhases(valid.slice(0, 3)).ok, false)
  assert.match(validateScenarioPhases(valid.slice(0, 3)).reason, /4 个阶段/)
  const reordered = [valid[1], valid[0], valid[2], valid[3]]
  assert.equal(validateScenarioPhases(reordered).ok, false)
  assert.match(validateScenarioPhases(reordered).reason, /baseline → burst → spread → decay/)
  const noLabel = valid.map((phase) => ({ ...phase, label: ' ' }))
  assert.equal(validateScenarioPhases(noLabel).ok, false)
  assert.equal(validateScenarioPhases(null).ok, false)
  const panel = read('src/campus-pulse/workbench/WorkbenchScenarioPanel.vue')
  assert.match(panel, /演化阶段：事件前 → 出现 → 扩散 → 后续反馈/)
  assert.match(panel, /选择已绑定的数据/)
  assert.match(panel, /系统自动使用所选情景关联的数据分析/)
  assert.match(panel, /\^\[0-9a-f\]\{64\}\$/)
})

test('M06 policy actions validate against the real action contract', () => {
  assert.deepEqual(validatePolicyActions([]), { ok: true })
  const action = { action_id: 'verified_update', label: '发布核实公告', commitment: '在 1 个工作日内核实讲座信息' }
  assert.deepEqual(validatePolicyActions([action]), { ok: true })
  const thirteen = Array.from({ length: 13 }, (_, index) => ({ action_id: 'action_' + index, label: 'l', commitment: 'c' }))
  assert.equal(validatePolicyActions(thirteen).ok, false)
  assert.match(validatePolicyActions(thirteen).reason, /0–12/)
  assert.equal(validatePolicyActions([{ ...action, action_id: 'Bad Action' }]).ok, false)
  assert.equal(validatePolicyActions([{ ...action, action_id: 'ab' }]).ok, false)
  assert.equal(validatePolicyActions([{ ...action, commitment: '' }]).ok, false)
  const panel = read('src/campus-pulse/workbench/WorkbenchPolicyPanel.vue')
  assert.match(panel, /治理动作（可选，最多 12 个）/)
  assert.ok(panel.includes('小写字母/数字/下划线，3–40 字符'))
  assert.match(panel, /\^\[a-z\]\[a-z0-9_\]\{2,39\}\$/)
})

test('M06 plan contract reads server work_contract and never guesses slots', () => {
  const frozen = planContractFromRun({
    execution_mode: 'llm_forum_twin',
    input_fingerprint: 'fp-abc',
    work_contract: { primary_slots: 16_544, request_limit: 33_088, token_limit: 80_000_000 },
  })
  assert.equal(frozen.serverProvided, true)
  assert.equal(frozen.primarySlots, 16_544)
  assert.equal(frozen.requestLimit, 33_088)
  assert.equal(frozen.tokenLimit, 80_000_000)
  assert.equal(frozen.fingerprint, 'fp-abc')
  const pending = planContractFromRun({ execution_mode: 'llm_forum_twin' })
  assert.equal(pending.serverProvided, false)
  assert.equal(pending.primarySlots, null)
  assert.equal(pending.requestLimit, null)
  assert.equal(pending.tokenLimit, null)
  assert.equal(pending.fingerprint, null)
  const socialWorld = planContractFromRun({
    execution_mode: 'llm_forum_twin_v2',
    input_snapshot: {
      forum_twin_v2: {
        population: { agent_count: 1_000 },
        relationships: { public_ranking_is_global: true },
        work_contract: { primary_slots: 2_092, request_hard_limit: 4_184 },
      },
      forum_visibility: {
        plan_sha256: 'v'.repeat(64),
        resident_turn_schema_version: 'campus-pulse-forum-agent-turn-v4',
        visibility_harness: {
          relationship_attention_enabled: true,
          public_anonymity_enabled: true,
          channels: {
            public_forum: true,
            friend_chat: true,
            dynamic_group: true,
            service_desk: true,
          },
        },
      },
    },
  })
  assert.equal(socialWorld.publicAnonymityEnabled, true)
  assert.equal(socialWorld.relationshipAttentionEnabled, true)
  assert.equal(socialWorld.privateChatEnabled, true)
  assert.equal(socialWorld.dynamicGroupsEnabled, true)
  assert.equal(socialWorld.serviceDeskEnabled, true)
  assert.equal(socialWorld.residentTurnSchemaVersion, 'campus-pulse-forum-agent-turn-v4')
  assert.equal(socialWorld.visibilityPlanSha256, 'v'.repeat(64))
  const panel = read('src/campus-pulse/workbench/WorkbenchPlanPanel.vue')
  assert.match(panel, /服务端冻结合同/)
  assert.match(panel, /待服务端冻结/)
  assert.match(panel, /已由服务端冻结/)
  assert.match(panel, /Token 预算/)
  assert.match(panel, /计划提交已禁用/)
  assert.match(panel, /小喇叭可选匿名/)
  assert.match(panel, /forum_public_anonymity_enabled/)
  assert.match(panel, /forum_relationship_attention_enabled/)
  const viewModel = read('src/campus-pulse/workbench/workbenchViewModel.ts')
  assert.match(viewModel, /no more hardcoded 1,728 \/ 16,544 \/ 13,056/)
  const vueSources = workbenchVueSources()
  assert.doesNotMatch(vueSources, /1,728 population_branch_tick/)
  assert.doesNotMatch(vueSources, /13,056 个预算化 LLM 槽位/)
  assert.doesNotMatch(vueSources, /16,544/)
})

test('M06 run state machine derives effective status from runtime first', () => {
  assert.equal(runEffectiveStatus({ effective_runtime_status: 'failed', plan_status: 'approved' }), 'failed')
  assert.equal(runEffectiveStatus({ effective_runtime_status: 'unknown', plan_status: 'queued' }), 'queued')
  assert.equal(runEffectiveStatus({ plan_status: 'draft' }), 'draft')
  assert.equal(runEffectiveStatus({}), 'draft')
  assert.equal(runStateLabel('queued'), '等待 Worker')
  assert.equal(runStateLabel('draft'), '尚未入队')
  assert.equal(runStateLabel('cancel_requested'), '正在安全取消')
  assert.equal(runStateLabel(''), '未知状态')
  assert.equal(runStateLabel('custom'), 'custom')
  assert.equal(isRunActive('running'), true)
  assert.equal(isRunActive('succeeded'), false)
  assert.equal(isRunTerminal('cancelled'), true)
  assert.equal(isRunTerminal('queued'), false)
  const run = runFromPayload({ run_id: 'r1', project_id: 'p1', status: 'queued', plan_status: 'approved', execution_mode: 'llm_forum_twin' })
  assert.equal(run.run_id, 'r1')
  assert.equal(run.execution_mode, 'llm_forum_twin')
  assert.equal(runFromPayload({ no_run_id: true }), null)
})

test('M06 runtime summary computes progress only from real server numbers', () => {
  const active = runtimeSummaryFrom({ runtime: { status: 'running', turns_reserved: 100, turns_completed: 25 } })
  assert.equal(active.status, 'running')
  assert.equal(active.progressFraction, 0.25)
  assert.equal(active.turnsReserved, 100)
  assert.equal(runtimeSummaryFrom({}).status, null)
  assert.equal(runtimeSummaryFrom({}).progressFraction, null)
  assert.equal(runtimeSummaryFrom({ runtime: { turns_reserved: 0, turns_completed: 0 } }).progressFraction, null)
  const events = runEventsFromPayload([{ sequence: 2, kind: 'b' }, { sequence: 1, kind: 'a' }, { no_sequence: true }])
  assert.deepEqual(events.map((event) => event.sequence), [1, 2])
  const committed = runEventsFromPayload([{
    sequence: 3,
    event_type: 'forum_tick_committed',
    created_at: '2026-08-24T12:00:00Z',
    detail: {
      tick: 7,
      branch: 'D',
      visible_text: '合成公开回复',
      world_edges: [{ channel: 'private_direct', source_display_id: 'FT-0001', target_display_id: 'FT-0002' }],
    },
  }])
  assert.equal(committed[0].kind, 'forum_tick_committed')
  assert.equal(committed[0].at, '2026-08-24T12:00:00Z')
  assert.equal(committed[0].payload.tick, 7)
  assert.equal(committed[0].payload.world_edges[0].channel, 'private_direct')
  const deduped = dedupeEvents([{ sequence: 1 }, { sequence: 1 }, { sequence: 2 }])
  assert.deepEqual(deduped.map((event) => event.sequence), [1, 2])
})

test('M06 evidence bindings and sensing CAS state normalize real fields', () => {
  const bindings = evidenceBindingsFromPayload([
    { snapshot_id: 's1', title: '讲座事件快照', manifest_sha256: 'm1', is_primary: true },
    { snapshot: { snapshot_id: 's2' }, title: '嵌套', make_primary: true },
    { other: true },
  ])
  assert.equal(bindings.length, 2)
  assert.equal(bindings[0].snapshotId, 's1')
  assert.equal(bindings[0].primary, true)
  assert.equal(bindings[1].snapshotId, 's2')
  assert.equal(bindings[1].primary, true)
  const state = sensingStateFromPayload({ status: 'active', state_version: 3, active_snapshot_id: 's2', active_snapshot_title: '标题' })
  assert.equal(state.status, 'active')
  assert.equal(state.stateVersion, 3)
  assert.equal(state.activeSnapshotId, 's2')
  assert.equal(sensingStateFromPayload(null).status, 'unknown')
  assert.equal(sensingStateFromPayload(null).stateVersion, null)
})

test('M06 CAS conflicts are detected without auto-overwrite', () => {
  assert.equal(isCasConflict({ status: 409 }), true)
  assert.equal(isCasConflict({ status: 412 }), true)
  assert.equal(isCasConflict({ code: 'WorkbenchConflictError' }), true)
  assert.equal(isCasConflict({ code: 'WorkbenchPreconditionError' }), true)
  assert.equal(isCasConflict({ status: 422 }), false)
  assert.equal(isCasConflict(null), false)
  assert.deepEqual(fieldErrorsFromProblem({ fieldErrors: [{ field: 'name', message: '不能为空' }] }), { name: ['不能为空'] })
  assert.deepEqual(fieldErrorsFromProblem(null), {})
})

test('M06 duplicate project names are corrected as field input, not stale state', () => {
  const duplicate = {
    status: 409,
    code: 'WorkbenchConflictError',
    detail: '已存在同名项目，请修改项目名称。',
  }
  assert.equal(isDuplicateProjectConflict(duplicate), true)
  assert.equal(isDuplicateProjectConflict({ ...duplicate, detail: '状态版本冲突' }), false)
  const dialog = read('src/campus-pulse/workbench/WorkbenchProjectCreateDialog.vue')
  const page = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  assert.match(dialog, /availableProjectName/)
  assert.match(dialog, /existingNames/)
  assert.match(page, /isDuplicateProjectConflict/)
  assert.match(page, /campus-pulse-live-world/)
  assert.match(page, /inferProjectScenario/)
})

test('M06 create-project validation maps to fields before any request', () => {
  const empty = validateProjectForm({})
  assert.deepEqual(Object.keys(empty).sort(), ['governance_domain', 'name', 'objective'])
  assert.equal(validateProjectForm({ name: 'x'.repeat(121) }).name[0].includes('120'), true)
  assert.equal(validateProjectForm({ objective: 'x'.repeat(801) }).objective[0].includes('800'), true)
  assert.deepEqual(validateProjectForm({ name: 'A', governance_domain: 'B', objective: 'C' }), {})
})

test('M06 plan/enqueue are idempotency-keyed with signature reuse', () => {
  const page = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  assert.match(page, /pendingPlanRequest/)
  assert.match(page, /pendingEnqueueRequest/)
  assert.match(page, /pendingEnqueueRequest\.signature !== signature/)
  assert.match(page, /randomUUID/)
  const service = read('src/services/campusPulseApi.js')
  assert.match(service, /Idempotency-Key/)
  assert.match(service, /planProjectRun\(projectId, payload, idempotencyKey\)/)
  assert.match(service, /enqueueRun\(runId, payload, idempotencyKey\)/)
})

test('M06 run monitor exposes accessible progress, failure and cancel flow', () => {
  const monitor = read('src/campus-pulse/workbench/WorkbenchRunMonitor.vue')
  assert.match(monitor, /role="progressbar"/)
  assert.match(monitor, /aria-valuenow/)
  assert.match(monitor, /aria-valuetext/)
  assert.match(monitor, /aria-live="polite"/)
  assert.match(monitor, /class="failure-panel" role="alert"/)
  assert.match(monitor, /role="dialog" aria-modal="true" aria-labelledby="cancel-title"/)
  assert.match(monitor, /reason_code/)
  assert.match(monitor, /operator_requested/)
  const page = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  assert.match(page, /服务端尚未返回 primary_slots 合同，前端不做估算/)
  assert.match(page, /status: 412/)
})

test('M06 create-project dialog is accessible with focus recovery', () => {
  const dialog = read('src/campus-pulse/workbench/WorkbenchProjectCreateDialog.vue')
  assert.match(dialog, /role="dialog" aria-modal="true" aria-labelledby="create-project-title"/)
  assert.match(dialog, /data-autofocus/)
  assert.match(dialog, /aria-describedby/)
  assert.match(dialog, /event\.key === 'Escape'/)
  assert.match(dialog, /previouslyFocused/)
  assert.match(dialog, /data-field-error/)
  assert.match(dialog, /role="alert"/)
  assert.match(dialog, /first\?\.focus\(\)/)
})

test('M06 workbench closes the loop to Result, Forum and Evidence', () => {
  const page = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  assert.match(page, /campus-pulse-run-analysis/)
  assert.match(page, /campus-pulse-run-live/)
  assert.match(page, /params: \{ runId \}/)
  assert.match(page, /openEvidencePage/)
  assert.match(page, /campus-pulse\/system/)
  assert.match(page, /openResult/)
  assert.match(page, /openForum/)
})

test('M06 overview readiness uses real states including unknown', () => {
  const overview = read('src/campus-pulse/workbench/WorkbenchOverviewPanel.vue')
  assert.match(overview, /'ready' \| 'missing' \| 'blocked' \| 'unknown'/)
  assert.match(overview, /'未知'/)
  assert.match(overview, /:aria-label="l\('项目就绪状态','Project readiness'\)"/)
})

test('M06 workbench SFCs parse and compile; router uses the workspace page', () => {
  const files = workbenchManifest()
  assert.equal(files.length, 13)
  const vueFiles = files.filter((file) => file.endsWith('.vue'))
  assert.equal(vueFiles.length, 10)
  for (const file of vueFiles) {
    const fullPath = resolve(WORKBENCH_DIR, file)
    const source = readFileSync(fullPath, 'utf8')
    const parsed = parse(source, { filename: fullPath })
    assert.deepEqual(parsed.errors, [], file + ' parse errors')
    const script = parsed.descriptor.scriptSetup
      ? compileScript(parsed.descriptor, { id: file })
      : undefined
    const template = compileTemplate({
      id: file,
      filename: fullPath,
      source: parsed.descriptor.template?.content || '',
      compilerOptions: { bindingMetadata: script?.bindings },
    })
    assert.deepEqual(template.errors, [], file + ' template errors')
  }
  const router = read('src/router/index.js')
  assert.match(router, /import\('\.\.\/campus-pulse\/workbench\/WorkbenchWorkspacePage\.vue'\)/)
  assert.match(router, /name: 'campus-pulse-workbench'/)
})

test('M06 new panels carry no invented parameters and no silent fallback', () => {
  const sources = workbenchVueSources()
  assert.doesNotMatch(sources, /政策强度/)
  assert.doesNotMatch(sources, /自动生成政策效果/)
  assert.doesNotMatch(sources, /silentFallback/)
  assert.doesNotMatch(sources, /静默回落/)
})

test('M06 legacy giant workbench files stay archived for characterization tests', () => {
  const combined = read('src/views/campus-pulse/workbench/WorkbenchHomeView.vue') + '\n' + read('src/components/campus-pulse/RunExecutionPanel.vue')
  assert.match(combined, /campus-pulse-run-plan-v7/)
  assert.match(combined, /13,056 个预算化 LLM 槽位/)
  assert.match(combined, /1,728 population_branch_tick/)
})
test('M06+ per-operation tokens never void a concurrent operation', () => {
  const probe = makeOperationToken()
  const projects = makeOperationToken()
  const probeId = probe.next()
  const projectsId = projects.next()
  // both operations are in flight; a later call on one must not invalidate the other
  assert.equal(probe.isCurrent(probeId), true)
  assert.equal(projects.isCurrent(projectsId), true)
  projects.next()
  assert.equal(projects.isCurrent(projectsId), false)
  assert.equal(probe.isCurrent(probeId), true, 'probe result must survive projects refresh')
  probe.invalidate()
  assert.equal(probe.isCurrent(probeId), false)
})

test('M06+ workbench no longer shares a single generation counter', () => {
  const sources = workbenchVueSources()
  assert.doesNotMatch(sources, /let generation = 0/)
  assert.doesNotMatch(sources, /\+\+generation/)
  assert.doesNotMatch(sources, /generation \+= 1/)
  assert.match(sources, /makeOperationToken/)
})

test('M06+ workbench empty state unwraps refs correctly in template', () => {
  const source = read('src/campus-pulse/workbench/WorkbenchWorkspacePage.vue')
  assert.match(source, /v-if="projects && projects.length === 0"/)
  assert.doesNotMatch(source, /v-if="projects\.value && projects\.value\.length === 0"/)
})
