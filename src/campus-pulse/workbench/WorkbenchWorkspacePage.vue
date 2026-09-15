<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  activateProjectSensingSnapshot,
  attachProjectEvidenceSnapshot,
  bootstrapProject,
  cancelRun,
  createProject,
  createProjectPolicy,
  createProjectScenario,
  enqueueRun,
  getLiveRuntimeCapability,
  getProjectSensingState,
  getRun,
  getRunRuntime,
  getWorkbenchHealth,
  getWorkbenchOverview,
  getWorkbenchReadiness,
  listProjectEvidence,
  listProjectPolicies,
  listProjectRuns,
  listProjectScenarios,
  listProjectSensingSnapshots,
  listProjects,
  listRunRuntimeEvents,
  planProjectRun,
  readableApiError,
} from '../../services/campusPulseApi'
import type { ApiProblem } from '../contracts/api.ts'
import CpStatusBadge from '../components/CpStatusBadge.vue'
import { currentLocale } from '../i18n/locale.ts'
import { makeOperationToken } from './operationToken'
import { workspaceFromQuery, workspaceToQuery, type WorkbenchWorkspaceState } from './workbenchState.ts'
import {
  countsFromOverview,
  evidenceBindingsFromPayload,
  fieldErrorsFromProblem,
  isCasConflict,
  isDuplicateProjectConflict,
  planContractFromRun,
  policyListFromPayload,
  projectFromPayload,
  projectListFromPayload,
  runEventsFromPayload,
  runFromPayload,
  runListFromPayload,
  runtimeSummaryFrom,
  scenarioListFromPayload,
  sensingStateFromPayload,
  type EvidenceBindingVM,
  type MutationState,
  type RunEventVM,
  type RunSummary,
  type RuntimeSummaryVM,
  type ScenarioSummary,
  type PolicySummary,
  type SensingStateVM,
  type WorkbenchCounts,
  type WorkbenchProject,
} from './workbenchViewModel.ts'
import { apiProblemKey } from './workbenchState.ts'
import WorkbenchProjectCreateDialog from './WorkbenchProjectCreateDialog.vue'
import WorkbenchOverviewPanel from './WorkbenchOverviewPanel.vue'
import WorkbenchEvidencePanel from './WorkbenchEvidencePanel.vue'
import WorkbenchScenarioPanel from './WorkbenchScenarioPanel.vue'
import WorkbenchPolicyPanel from './WorkbenchPolicyPanel.vue'
import WorkbenchPlanPanel from './WorkbenchPlanPanel.vue'
import WorkbenchPreflightPanel, {
  readWorkbenchPreflightSnapshot,
  retainWorkbenchPreflightSnapshot,
  type WorkbenchPreflightSnapshot,
} from './WorkbenchPreflightPanel.vue'
import WorkbenchRunsPanel from './WorkbenchRunsPanel.vue'
import WorkbenchRunMonitor from './WorkbenchRunMonitor.vue'

const route = useRoute()
const router = useRouter()
const isEnglish = computed(() => currentLocale.value === 'en-US')
const l = (zh: string, en: string) => isEnglish.value ? en : zh

const workspace = computed<WorkbenchWorkspaceState>(() => {
  const state = workspaceFromQuery(route.query as Record<string, unknown>)
  const project = typeof route.params.id === 'string' ? route.params.id : state.project
  const section = typeof route.meta.workbenchSection === 'string'
    ? route.meta.workbenchSection as WorkbenchWorkspaceState['section']
    : state.section
  return { ...state, project, section }
})

const projectRouteNames: Partial<Record<WorkbenchWorkspaceState['section'], string>> = {
  overview: 'campus-pulse-project-overview',
  evidence: 'campus-pulse-project-world',
  scenarios: 'campus-pulse-project-scenario',
  policies: 'campus-pulse-project-policies',
  plan: 'campus-pulse-project-run-plan',
}

function workspaceLocation(next: WorkbenchWorkspaceState) {
  const routeName = next.project ? projectRouteNames[next.section] : undefined
  if (routeName) {
    const query = workspaceToQuery({ ...next, project: undefined, section: 'overview' })
    return { name: routeName, params: { id: next.project }, query }
  }
  return { name: 'campus-pulse-workbench', query: workspaceToQuery(next) }
}

const access = ref<'interactive' | 'readonly' | 'unavailable'>('unavailable')
const accessError = ref('')
const lastSync = ref<string | null>(null)

const projects = ref<WorkbenchProject[] | null>(null)
const projectsLoading = ref(false)
const projectsError = ref<ApiProblem | null>(null)

const overviewCounts = ref<WorkbenchCounts>({ projects: null, scenarios: null, policies: null, runs: null, evidence: null, sensing: null })
const readinessData = ref<Record<string, unknown> | null>(null)

const scenarios = ref<ScenarioSummary[] | null>(null)
const scenariosLoading = ref(false)
const scenariosError = ref<ApiProblem | null>(null)
const scenarioMutation = reactive<MutationState<unknown>>({ status: 'idle' })

const policies = ref<PolicySummary[] | null>(null)
const policiesLoading = ref(false)
const policiesError = ref<ApiProblem | null>(null)
const policyMutation = reactive<MutationState<unknown>>({ status: 'idle' })

const evidence = ref<EvidenceBindingVM[] | null>(null)
const evidenceLoading = ref(false)
const evidenceError = ref<ApiProblem | null>(null)

const sensingSnapshots = ref<Array<{ snapshot_id: string; title?: string; manifest_sha256?: string }> | null>(null)
const sensingState = ref<SensingStateVM | null>(null)
const sensingLoading = ref(false)
const sensingError = ref<ApiProblem | null>(null)
const sensingActivating = ref(false)
const sensingMutationError = ref<ApiProblem | null>(null)

const runs = ref<RunSummary[] | null>(null)
const runsLoading = ref(false)
const runsError = ref<ApiProblem | null>(null)

const selectedRun = ref<RunSummary | null>(null)
const runDetailLoading = ref(false)
const runDetailError = ref<ApiProblem | null>(null)

const runtime = ref<RuntimeSummaryVM | null>(null)
const runtimeLoading = ref(false)
const runtimeError = ref<ApiProblem | null>(null)
const events = ref<RunEventVM[] | null>(null)
const eventsLoading = ref(false)
const eventsError = ref<ApiProblem | null>(null)
const lastEventSequence = ref(0)

const plannedRun = ref<RunSummary | null>(null)
const planMutation = reactive<MutationState<unknown>>({ status: 'idle' })
const bootstrapMutation = reactive<MutationState<unknown>>({ status: 'idle' })
const enqueueMutation = reactive<MutationState<unknown>>({ status: 'idle' })
const cancelMutation = reactive<MutationState<unknown>>({ status: 'idle' })
const runActionNotice = ref('')

const projectMutation = reactive<MutationState<unknown>>({ status: 'idle' })

const showCreateDialog = ref(false)
const preflightSnapshot = ref<WorkbenchPreflightSnapshot | null>(readWorkbenchPreflightSnapshot(workspace.value.project))

const probeToken = makeOperationToken()
const projectsToken = makeOperationToken()
const sectionToken = makeOperationToken()
const runDetailToken = makeOperationToken()
const runtimeToken = makeOperationToken()
const eventsToken = makeOperationToken()
let pendingPlanRequest: { projectId: string; signature: string; key: string } | null = null
let pendingEnqueueRequest: { runId: string; signature: string; key: string } | null = null
let pollTimer: ReturnType<typeof setInterval> | undefined

function problemText(error: ApiProblem | null): string {
  return error ? error.summary + '：' + error.detail : ''
}

// ---- health / access -----------------------------------------------------

async function probeBackend() {
  const id = probeToken.next()
  accessError.value = ''
  try {
    const [health, readiness, overview, capability] = await Promise.all([
      getWorkbenchHealth(),
      getWorkbenchReadiness(),
      getWorkbenchOverview(),
      getLiveRuntimeCapability(),
    ])
    if (!probeToken.isCurrent(id)) return
    readinessData.value = readiness
    overviewCounts.value = countsFromOverview(overview)
    access.value = 'interactive'
    lastSync.value = new Date().toISOString()
  } catch (error) {
    if (!probeToken.isCurrent(id)) return
    access.value = 'unavailable'
    accessError.value = readableApiError(error)
  }
}

// ---- projects -------------------------------------------------------------

async function loadProjects() {
  const id = projectsToken.next()
  projectsLoading.value = true
  projectsError.value = null
  try {
    const payload = await listProjects()
    if (!projectsToken.isCurrent(id)) return
    projects.value = projectListFromPayload(payload)
  } catch (error) {
    if (!projectsToken.isCurrent(id)) return
    projectsError.value = error as ApiProblem
  } finally {
    if (projectsToken.isCurrent(id)) projectsLoading.value = false
  }
}

function selectProject(projectId: string) {
  if (workspace.value.project === projectId) return
  router.push(workspaceLocation({ ...workspace.value, project: projectId, section: 'overview', run: undefined }))
}

function changeSection(section: WorkbenchWorkspaceState['section']) {
  router.push(workspaceLocation({ ...workspace.value, section, run: section === 'runs' ? workspace.value.run : undefined }))
}

function selectRun(runId: string) {
  router.push({
    name: 'campus-pulse-workbench',
    query: workspaceToQuery({ ...workspace.value, section: 'runs', run: runId }),
  })
}

function clearRun() {
  router.push({
    name: 'campus-pulse-workbench',
    query: workspaceToQuery({ ...workspace.value, run: undefined }),
  })
}

function setRunStatusFilter(status: string) {
  router.replace({
    name: 'campus-pulse-workbench',
    query: workspaceToQuery({ ...workspace.value, runStatus: status }),
  })
}

function setProjectSearch(q: string) {
  router.replace({
    name: 'campus-pulse-workbench',
    query: workspaceToQuery({ ...workspace.value, q }),
  })
}

type CreateProjectRequest = {
  name: string
  governance_domain: string
  objective: string
  evaluation_mode: string
  bootstrap_mode: 'century_gym' | 'none'
  existing_project_id?: string
}

function isCenturyGymProject(project: WorkbenchProject | null | undefined): boolean {
  if (!project) return false
  return /世纪馆|体育场地预约|幽灵预约/.test(`${project.name} ${project.governance_domain} ${project.objective}`)
}

function openCreateProjectDialog() {
  projectMutation.status = 'idle'
  showCreateDialog.value = true
}

async function createNewProject(payload: CreateProjectRequest) {
  if (projectMutation.status === 'submitting') return
  if (payload.existing_project_id) {
    showCreateDialog.value = false
    router.push({
      name: 'campus-pulse-workbench',
      query: workspaceToQuery({ ...workspace.value, project: payload.existing_project_id, section: 'overview', run: undefined }),
    })
    return
  }
  const duplicate = (projects.value ?? []).find((project) => (
    project.name.trim().toLocaleLowerCase('zh-CN') === payload.name.trim().toLocaleLowerCase('zh-CN')
  ))
  if (duplicate) {
    projectMutation.status = 'invalid'
    projectMutation.fieldErrors = { name: [`已存在同名项目“${duplicate.name}”，请修改名称后创建。`] }
    return
  }
  projectMutation.status = 'submitting'
  try {
    const {
      bootstrap_mode: bootstrapMode,
      existing_project_id: _existingProjectId,
      ...projectPayload
    } = payload
    const created = await createProject(projectPayload)
    const project = projectFromPayload(created)
    if (!project) throw new Error('后端已创建项目，但返回的项目合同无法确认。')
    projectMutation.status = 'success'
    projectMutation.data = created
    showCreateDialog.value = false
    await loadProjects()
    if (bootstrapMode === 'century_gym') {
      router.push({
        name: 'campus-pulse-workbench',
        query: workspaceToQuery({ ...workspace.value, project: project.project_id, section: 'overview', run: undefined }),
      })
      return
    }
    router.push({
      name: 'campus-pulse-workbench',
      query: workspaceToQuery({
        ...workspace.value,
        project: project.project_id,
        section: bootstrapMode === 'century_gym' ? 'plan' : 'overview',
        run: undefined,
      }),
    })
  } catch (error) {
    const problem = error as ApiProblem
    if (isDuplicateProjectConflict(problem)) {
      projectMutation.status = 'invalid'
      projectMutation.fieldErrors = { name: ['已存在同名项目，请修改项目名称。'] }
      await loadProjects()
      return
    }
    projectMutation.status = isCasConflict(problem) ? 'conflict' : problem.status === 422 ? 'invalid' : 'error'
    projectMutation.problem = problem
    if (problem.status === 422) projectMutation.fieldErrors = fieldErrorsFromProblem(problem)
    if (isCasConflict(problem)) await loadProjects()
  }
}

// ---- project sections -----------------------------------------------------

async function loadSection() {
  const projectId = workspace.value.project
  const section = workspace.value.section
  const id = sectionToken.next()
  if (!projectId) return
  if (section === 'overview') {
    const payloads = await Promise.allSettled([
      listProjectScenarios(projectId),
      listProjectPolicies(projectId),
      listProjectEvidence(projectId),
      listProjectSensingSnapshots(projectId),
      getProjectSensingState(projectId),
      listProjectRuns(projectId),
    ])
    if (!sectionToken.isCurrent(id)) return
    scenarios.value = payloads[0].status === 'fulfilled'
      ? scenarioListFromPayload(payloads[0].value) : null
    policies.value = payloads[1].status === 'fulfilled'
      ? policyListFromPayload(payloads[1].value) : null
    evidence.value = payloads[2].status === 'fulfilled'
      ? evidenceBindingsFromPayload(payloads[2].value) : null
    sensingSnapshots.value = payloads[3].status === 'fulfilled'
      ? payloads[3].value : null
    sensingState.value = payloads[4].status === 'fulfilled'
      ? sensingStateFromPayload(payloads[4].value) : null
    runs.value = payloads[5].status === 'fulfilled'
      ? runListFromPayload(payloads[5].value) : null
  } else if (section === 'evidence') {
    evidenceLoading.value = true
    evidenceError.value = null
    sensingLoading.value = true
    sensingError.value = null
    try {
      const [bindings, sensingList, state] = await Promise.all([
        listProjectEvidence(projectId),
        listProjectSensingSnapshots(projectId),
        getProjectSensingState(projectId),
      ])
      if (!sectionToken.isCurrent(id)) return
      evidence.value = evidenceBindingsFromPayload(bindings)
      sensingSnapshots.value = sensingList
      sensingState.value = sensingStateFromPayload(state)
    } catch (error) {
      if (!sectionToken.isCurrent(id)) return
      evidenceError.value = error as ApiProblem
      sensingError.value = error as ApiProblem
    } finally {
      if (sectionToken.isCurrent(id)) { evidenceLoading.value = false; sensingLoading.value = false }
    }
  } else if (section === 'scenarios') {
    scenariosLoading.value = true
    scenariosError.value = null
    try {
      const payload = await listProjectScenarios(projectId)
      if (!sectionToken.isCurrent(id)) return
      scenarios.value = scenarioListFromPayload(payload)
    } catch (error) {
      if (!sectionToken.isCurrent(id)) return
      scenariosError.value = error as ApiProblem
    } finally {
      if (sectionToken.isCurrent(id)) scenariosLoading.value = false
    }
  } else if (section === 'policies') {
    policiesLoading.value = true
    policiesError.value = null
    try {
      const payload = await listProjectPolicies(projectId)
      if (!sectionToken.isCurrent(id)) return
      policies.value = policyListFromPayload(payload)
    } catch (error) {
      if (!sectionToken.isCurrent(id)) return
      policiesError.value = error as ApiProblem
    } finally {
      if (sectionToken.isCurrent(id)) policiesLoading.value = false
    }
  } else if (section === 'plan') {
    await Promise.all([loadScenariosSilent(), loadPoliciesSilent(), loadSensingSilent(), loadEvidenceSilent()])
  } else if (section === 'runs') {
    runsLoading.value = true
    runsError.value = null
    try {
      const payload = await listProjectRuns(projectId)
      if (!sectionToken.isCurrent(id)) return
      runs.value = runListFromPayload(payload)
      if (workspace.value.run) {
        const activeRun = runs.value.find((run) => run.run_id === workspace.value.run)
        if (activeRun) selectedRun.value = activeRun
        await loadRunDetail(workspace.value.run)
      } else {
        selectedRun.value = null
        runtime.value = null
        events.value = null
      }
    } catch (error) {
      if (!sectionToken.isCurrent(id)) return
      runsError.value = error as ApiProblem
    } finally {
      if (sectionToken.isCurrent(id)) runsLoading.value = false
    }
  }
}

async function loadScenariosSilent() {
  const projectId = workspace.value.project
  if (!projectId) return
  try { scenarios.value = scenarioListFromPayload(await listProjectScenarios(projectId)) } catch { /* plan panel shows readiness */ }
}
async function loadPoliciesSilent() {
  const projectId = workspace.value.project
  if (!projectId) return
  try { policies.value = policyListFromPayload(await listProjectPolicies(projectId)) } catch { /* ignored */ }
}
async function loadSensingSilent() {
  const projectId = workspace.value.project
  if (!projectId) return
  try { sensingState.value = sensingStateFromPayload(await getProjectSensingState(projectId)) } catch { /* ignored */ }
}
async function loadEvidenceSilent() {
  const projectId = workspace.value.project
  if (!projectId) return
  try { evidence.value = evidenceBindingsFromPayload(await listProjectEvidence(projectId)) } catch { /* ignored */ }
}

// ---- mutations ------------------------------------------------------------

async function attachEvidence(snapshotId: string) {
  const projectId = workspace.value.project
  if (!projectId || access.value !== 'interactive') return
  sensingMutationError.value = null
  try {
    await attachProjectEvidenceSnapshot(projectId, snapshotId)
    await loadSection()
  } catch (error) {
    sensingMutationError.value = error as ApiProblem
  }
}

async function activateSensing(snapshotId: string) {
  const projectId = workspace.value.project
  if (!projectId || access.value !== 'interactive') return
  sensingActivating.value = true
  sensingMutationError.value = null
  const expected = sensingState.value?.stateVersion ?? 0
  try {
    await activateProjectSensingSnapshot(projectId, snapshotId, expected)
    await loadSection()
  } catch (error) {
    const problem = error as ApiProblem
    sensingMutationError.value = isCasConflict(problem)
      ? { ...problem, detail: problem.detail + ' 当前版本 ' + expected + '；请刷新后重试，不会自动覆盖。' } as ApiProblem
      : problem
    if (isCasConflict(problem)) await loadSection()
  } finally {
    sensingActivating.value = false
  }
}

async function createScenario(payload: Record<string, unknown>) {
  const projectId = workspace.value.project
  if (!projectId || access.value !== 'interactive') return
  scenarioMutation.status = 'submitting'
  try {
    const created = await createProjectScenario(projectId, payload)
    scenarioMutation.status = 'success'
    scenarioMutation.data = created
    scenarios.value = scenarioListFromPayload(await listProjectScenarios(projectId))
  } catch (error) {
    const problem = error as ApiProblem
    scenarioMutation.status = isCasConflict(problem) ? 'conflict' : problem.status === 422 ? 'invalid' : 'error'
    scenarioMutation.problem = problem
    if (problem.status === 422) scenarioMutation.fieldErrors = fieldErrorsFromProblem(problem)
  }
}

async function createPolicy(payload: Record<string, unknown>) {
  const projectId = workspace.value.project
  if (!projectId || access.value !== 'interactive') return
  policyMutation.status = 'submitting'
  try {
    const created = await createProjectPolicy(projectId, payload)
    policyMutation.status = 'success'
    policyMutation.data = created
    policies.value = policyListFromPayload(await listProjectPolicies(projectId))
  } catch (error) {
    const problem = error as ApiProblem
    policyMutation.status = isCasConflict(problem) ? 'conflict' : problem.status === 422 ? 'invalid' : 'error'
    policyMutation.problem = problem
    if (problem.status === 422) policyMutation.fieldErrors = fieldErrorsFromProblem(problem)
  }
}

async function bootstrapCurrentProject() {
  const projectId = workspace.value.project
  if (!projectId || access.value !== 'interactive' || bootstrapMutation.status === 'submitting') return
  bootstrapMutation.status = 'submitting'
  try {
    bootstrapMutation.data = await bootstrapProject(projectId)
    bootstrapMutation.status = 'success'
    await loadSection()
  } catch (error) {
    const problem = error as ApiProblem
    bootstrapMutation.status = isCasConflict(problem) ? 'conflict' : problem.status === 422 ? 'invalid' : 'error'
    bootstrapMutation.problem = problem
    if (isCasConflict(problem)) await loadSection()
  }
}

async function submitPlan(payload: Record<string, unknown>) {
  const projectId = workspace.value.project
  if (!projectId || access.value !== 'interactive') return
  planMutation.status = 'submitting'
  const signature = JSON.stringify(payload)
  if (!pendingPlanRequest || pendingPlanRequest.projectId !== projectId || pendingPlanRequest.signature !== signature) {
    pendingPlanRequest = {
      projectId,
      signature,
      key: globalThis.crypto?.randomUUID?.() || 'plan-' + projectId + '-' + Date.now(),
    }
  }
  try {
    const run = await planProjectRun(projectId, payload, pendingPlanRequest.key)
    planMutation.status = 'success'
    planMutation.data = run
    pendingPlanRequest = null
    plannedRun.value = runFromPayload(run)
    runs.value = [runFromPayload(run)!, ...(runs.value ?? [])].filter(Boolean)
    router.push({
      name: 'campus-pulse-workbench',
      query: workspaceToQuery({ ...workspace.value, section: 'runs', run: run.run_id }),
    })
  } catch (error) {
    const problem = error as ApiProblem
    planMutation.status = isCasConflict(problem) ? 'conflict' : problem.status === 422 ? 'invalid' : 'error'
    planMutation.problem = problem
    if (problem.status === 422) planMutation.fieldErrors = fieldErrorsFromProblem(problem)
  }
}

async function loadRunDetail(runId: string) {
  const id = runDetailToken.next()
  runDetailLoading.value = true
  runDetailError.value = null
  runtimeError.value = null
  eventsError.value = null
  try {
    const [detailResult, runtimeResult, eventResult] = await Promise.allSettled([
      getRun(runId),
      getRunRuntime(runId),
      listRunRuntimeEvents(runId, { afterSequence: 0, limit: 200 }),
    ])
    if (!runDetailToken.isCurrent(id)) return
    if (detailResult.status === 'rejected') throw detailResult.reason
    const detail = detailResult.value
    selectedRun.value = runFromPayload(detail) ?? runFromPayload({ run_id: runId })
    if (runtimeResult.status === 'fulfilled') {
      runtime.value = runtimeSummaryFrom(runtimeResult.value)
    } else {
      runtime.value = null
      const problem = runtimeResult.reason as ApiProblem
      // A planned run has no runtime resource until it is enqueued. That is a
      // normal lifecycle state, not a failed detail request.
      if (problem?.status !== 404) runtimeError.value = problem
    }
    const list = eventResult.status === 'fulfilled'
      ? runEventsFromPayload(eventResult.value)
      : []
    if (eventResult.status === 'rejected') {
      const problem = eventResult.reason as ApiProblem
      if (problem?.status !== 404) eventsError.value = problem
    }
    events.value = list
    lastEventSequence.value = list.length ? list[list.length - 1].sequence : 0
  } catch (error) {
    if (!runDetailToken.isCurrent(id)) return
    runDetailError.value = error as ApiProblem
  } finally {
    if (runDetailToken.isCurrent(id)) runDetailLoading.value = false
  }
}

async function refreshRuntime() {
  const runId = workspace.value.run
  if (!runId || access.value !== 'interactive') return
  const id = runtimeToken.next()
  runtimeLoading.value = true
  runtimeError.value = null
  try {
    const runtimePayload = await getRunRuntime(runId)
    if (!runtimeToken.isCurrent(id)) return
    runtime.value = runtimeSummaryFrom(runtimePayload)
  } catch (error) {
    if (!runtimeToken.isCurrent(id)) return
    runtimeError.value = error as ApiProblem
  } finally {
    if (runtimeToken.isCurrent(id)) runtimeLoading.value = false
  }
}

async function loadEvents() {
  const runId = workspace.value.run
  if (!runId) return
  const id = eventsToken.next()
  eventsLoading.value = true
  eventsError.value = null
  try {
    const payload = await listRunRuntimeEvents(runId, { afterSequence: lastEventSequence.value, limit: 200 })
    if (!eventsToken.isCurrent(id)) return
    const incoming = runEventsFromPayload(payload)
    events.value = [...(events.value ?? []), ...incoming].filter((event, index, all) => all.findIndex((item) => item.sequence === event.sequence) === index)
      .sort((left, right) => left.sequence - right.sequence)
    if (incoming.length) lastEventSequence.value = incoming[incoming.length - 1].sequence
  } catch (error) {
    if (!eventsToken.isCurrent(id)) return
    const problem = error as ApiProblem
    // Draft runs do not own an event stream yet. Keep the empty state honest
    // instead of presenting the expected 404 as a runtime failure.
    if (problem?.status === 404 && (selectedRun.value?.plan_status || selectedRun.value?.status) === 'draft') {
      events.value = []
      lastEventSequence.value = 0
      eventsError.value = null
    } else {
      eventsError.value = problem
    }
  } finally {
    if (eventsToken.isCurrent(id)) eventsLoading.value = false
  }
}

async function enqueueSelectedRun() {
  const runId = workspace.value.run
  if (!runId || access.value !== 'interactive') return
  const contract = planContractFromRun(selectedRun.value ?? {})
  const turnBudget = contract.primarySlots
  if (turnBudget === null) {
    runActionNotice.value = ''
    enqueueMutation.status = 'error'
    enqueueMutation.problem = { summary: '合同尚未冻结', detail: '服务端尚未返回 primary_slots 合同，前端不做估算；请刷新运行详情后重试。', status: 412, retryable: true } as unknown as ApiProblem
    return
  }
  const body = {
    expected_state_version: runtime.value?.stateVersion ?? 0,
    turn_budget: turnBudget,
    max_attempts: 2,
  }
  const signature = JSON.stringify(body)
  if (!pendingEnqueueRequest || pendingEnqueueRequest.runId !== runId || pendingEnqueueRequest.signature !== signature) {
    pendingEnqueueRequest = {
      runId,
      signature,
      key: globalThis.crypto?.randomUUID?.() || 'enqueue-' + runId + '-' + Date.now(),
    }
  }
  enqueueMutation.status = 'submitting'
  runActionNotice.value = ''
  try {
    await enqueueRun(runId, body, pendingEnqueueRequest.key)
    pendingEnqueueRequest = null
    enqueueMutation.status = 'success'
    runActionNotice.value = '运行已进入队列；模型尚未执行。'
    await refreshRuntime()
  } catch (error) {
    const problem = error as ApiProblem
    enqueueMutation.status = isCasConflict(problem) ? 'conflict' : 'error'
    enqueueMutation.problem = problem
    if (isCasConflict(problem)) await refreshRuntime()
  }
}

async function cancelSelectedRun(payload: { reason_code: string; expected_state_version: number }) {
  const runId = workspace.value.run
  if (!runId || access.value !== 'interactive') return
  cancelMutation.status = 'submitting'
  runActionNotice.value = ''
  try {
    await cancelRun(runId, payload)
    cancelMutation.status = 'success'
    runActionNotice.value = '取消请求已提交。'
    await refreshRuntime()
  } catch (error) {
    const problem = error as ApiProblem
    cancelMutation.status = isCasConflict(problem) ? 'conflict' : 'error'
    cancelMutation.problem = problem
    if (isCasConflict(problem)) await refreshRuntime()
  }
}

// ---- navigation helpers ---------------------------------------------------

function openResult() {
  const runId = workspace.value.run
  if (runId) router.push({ name: 'campus-pulse-run-analysis', params: { runId } })
}

function openForum() {
  const runId = workspace.value.run
  if (runId) router.push({ name: 'campus-pulse-run-live', params: { runId }, query: { project: workspace.value.project } })
}

function openEvidencePage() {
  router.push('/campus-pulse/system')
}

function openEvidenceSnapshot(snapshotId: string) {
  router.push({ path: '/campus-pulse/system', query: { evidence: snapshotId } })
}

function refreshAll() {
  probeBackend()
  loadProjects()
  if (workspace.value.project) loadSection()
}

// ---- wiring ---------------------------------------------------------------

watch(
  () => [route.query.project, route.query.section, route.query.run] as const,
  () => {
    if (workspace.value.project) loadSection()
    else {
      selectedRun.value = null
      runtime.value = null
      events.value = null
    }
  },
  { immediate: true },
)

watch(() => workspace.value.section, (section) => {
  if (section === 'runs' && !workspace.value.run) {
    selectedRun.value = null
    runtime.value = null
    events.value = null
  }
})

watch(() => workspace.value.project, () => {
  preflightSnapshot.value = readWorkbenchPreflightSnapshot(workspace.value.project)
})

function retainPreflightSnapshot(snapshot: WorkbenchPreflightSnapshot) {
  if (snapshot.projectId !== workspace.value.project) return
  retainWorkbenchPreflightSnapshot(snapshot)
  preflightSnapshot.value = snapshot
}

onMounted(async () => {
  probeBackend()
  await loadProjects()
  if (route.query.create === 'century-gym') {
    openCreateProjectDialog()
    const query = { ...route.query }
    delete query.create
    await router.replace({ name: 'campus-pulse-workbench', query })
  }
  if (pollTimer) clearInterval(pollTimer)
})

onBeforeUnmount(() => {
  probeToken.invalidate()
  projectsToken.invalidate()
  sectionToken.invalidate()
  runDetailToken.invalidate()
  runtimeToken.invalidate()
  eventsToken.invalidate()
  if (pollTimer) clearInterval(pollTimer)
})

const filteredProjects = computed(() => {
  const list = projects.value ?? []
  const q = workspace.value.q.trim().toLowerCase()
  if (!q) return list
  return list.filter((project) => (
    project.name.toLowerCase().includes(q)
    || project.governance_domain.toLowerCase().includes(q)
  ))
})

const projectCountLabel = computed(() => {
  if (access.value === 'unavailable') return '不可用'
  if (projects.value === null) return '未知'
  return projects.value.length + ' 个项目'
})

const selectedProject = computed(() => (
  (projects.value ?? []).find((project) => project.project_id === workspace.value.project) || null
))

const runtimeRunStatuses = new Set(['queued','enqueued','running','paused','succeeded'])
const latestRuntimeRun = computed(() => [...(runs.value ?? [])]
  .filter((run) => Boolean(
    run.result_sha256
    || runtimeRunStatuses.has(run.effective_runtime_status || run.status || run.plan_status),
  ))
  .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0] || null)
const contextualRuntimeLocation = computed(() => selectedProject.value && latestRuntimeRun.value ? {
  name:'campus-pulse-run-live',
  params:{ runId:latestRuntimeRun.value.run_id },
  query:{ project:selectedProject.value.project_id },
} : null)
const contextualDemoLabel = computed(() => '进入项目实时世界')

const planSubmitError = computed(() => (
  planMutation.status === 'error' || planMutation.status === 'conflict' || planMutation.status === 'invalid'
    ? planMutation.problem ?? null
    : null
))

const evidenceReady = computed(() => (evidence.value?.length ?? 0) > 0)
const sensingActive = computed(() => sensingState.value?.status === 'active')

const latestRunStatus = computed(() => {
  const list = runs.value ?? []
  if (!list.length) return null
  const latest = [...list].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0]
  return latest.effective_runtime_status || latest.plan_status || latest.status || null
})

const sections: Array<{ key: WorkbenchWorkspaceState['section']; label: string }> = [
  { key: 'overview', label: '总览' },
  { key: 'evidence', label: 'Agent 世界' },
  { key: 'scenarios', label: '事件场景' },
  { key: 'policies', label: '治理方案' },
  { key: 'plan', label: '运行合同' },
  { key: 'runs', label: '运行监控' },
]

const workflowSteps: Array<{
  number: string
  key: WorkbenchWorkspaceState['section']
  label: string
  detail: string
}> = [
  { number: '1', key: 'evidence', label: 'Agent 世界', detail: '固定人口、Profile、关系与利益位置' },
  { number: '2', key: 'scenarios', label: '事件场景', detail: '定义冲击和四阶段时间轴' },
  { number: '3', key: 'policies', label: '治理方案', detail: '设置可执行动作与承诺' },
  { number: '4', key: 'plan', label: '运行合同', detail: '冻结模型、分支、种子和预算' },
  { number: '5', key: 'runs', label: '运行监控', detail: '入队、观察、暂停和查看结果' },
]
</script>

<template>
  <div class="workbench-workspace">
    <header class="page-head">
      <div>
        <span class="page-kicker">SIMULATION CONTROL PLANE</span>
        <h1>模拟器工作台</h1>
        <p>创建校园事件，绑定 LLM Agent 人口与论坛环境，配置治理分支，然后启动并观察一次完整社会模拟。</p>
      </div>
      <div class="head-actions">
        <CpStatusBadge :tone="access === 'interactive' ? 'success' : access === 'readonly' ? 'warning' : 'neutral'">
          {{ access === 'interactive' ? '内部服务已连接' : access === 'readonly' ? '只读' : '服务未连接' }}
        </CpStatusBadge>
        <span v-if="lastSync" class="last-sync">上次同步 {{ new Date(lastSync).toLocaleTimeString('zh-CN') }}</span>
        <button type="button" class="refresh" @click="refreshAll">刷新</button>
        <RouterLink class="refresh header-link" to="/campus-pulse/app">项目中心</RouterLink>
        <RouterLink class="provider-link" to="/campus-pulse/system?tab=provider"><i class="fa-solid fa-key" aria-hidden="true" /> 模型与 API</RouterLink>
        <RouterLink v-if="contextualRuntimeLocation" class="offline-link" :to="contextualRuntimeLocation">{{ contextualDemoLabel }}</RouterLink>
        <button v-else type="button" class="offline-link" disabled :title="selectedProject ? '需要先创建并启动真实运行' : '请先选择项目'">{{ contextualDemoLabel }}</button>
      </div>
    </header>

    <div v-if="access === 'unavailable'" class="unavailable-banner" role="status">
      <div>
        <strong>后端不可用</strong>
        <p>写操作暂不可用；已验证离线结果仍可查看。{{ accessError ? accessError : '' }} 未知状态保持未知。</p>
      </div>
      <div class="banner-actions">
        <button type="button" class="refresh" @click="probeBackend">重试连接</button>
        <RouterLink class="offline-link" to="/campus-pulse/results">查看案例结果</RouterLink>
      </div>
    </div>

    <div class="workbench-layout">
      <aside class="projects-pane" aria-label="模拟项目">
        <section class="project-context" :aria-label="l('项目上下文', 'Project context')">
          <p class="rail-label">PROJECT CONTEXT</p>
          <div v-if="selectedProject" class="selected-project-context">
            <span class="project-glyph" aria-hidden="true"><i class="fa-solid fa-building-columns" /></span>
            <span class="project-copy">
              <strong>{{ selectedProject.name }}</strong>
              <small>{{ selectedProject.governance_domain }}</small>
              <code>{{ selectedProject.project_id }}</code>
            </span>
          </div>
          <p v-else class="no-project-context">{{ l('尚未选择项目', 'No project selected') }}</p>

          <details class="project-switcher" :open="!workspace.project">
            <summary><span>{{ l('切换项目', 'Change project') }}</span><small>{{ projectCountLabel }}</small></summary>
            <div class="project-picker">
              <label class="search">
                <span class="visually-hidden">{{ l('搜索项目', 'Search projects') }}</span>
                <input type="search" :placeholder="l('搜索项目 / 领域', 'Search project / domain')" :value="workspace.q" @input="setProjectSearch(($event.target as HTMLInputElement).value)" />
              </label>

              <div v-if="access === 'unavailable'" class="pane-state">
                <strong>{{ l('项目状态未知', 'Project state unknown') }}</strong>
                <p>{{ l('后端不可用，项目列表状态未知。', 'The backend is unavailable, so project state is unknown.') }}</p>
              </div>
              <div v-else-if="projectsLoading" class="pane-state">{{ l('正在读取项目…', 'Loading projects…') }}</div>
              <div v-else-if="projectsError" class="pane-state" role="alert">
                <strong>{{ l('项目列表读取失败', 'Could not load projects') }}</strong>
                <p>{{ projectsError.summary }}</p>
                <button type="button" @click="loadProjects">{{ l('重试', 'Retry') }}</button>
              </div>
              <div v-else-if="filteredProjects.length === 0" class="pane-state">
                <strong v-if="projects && projects.length === 0">{{ l('尚无模拟项目', 'No simulation projects yet') }}</strong>
                <strong v-else>{{ l('没有匹配项目', 'No matching projects') }}</strong>
              </div>
              <ul v-else class="project-list">
                <li v-for="project in filteredProjects" :key="project.project_id">
                  <button
                    type="button"
                    class="project-row"
                    :class="{ selected: project.project_id === workspace.project }"
                    :aria-current="project.project_id === workspace.project ? 'page' : undefined"
                    @click="selectProject(project.project_id)"
                  >
                    <span class="project-copy"><strong>{{ project.name }}</strong><small>{{ project.governance_domain }}</small></span>
                  </button>
                </li>
              </ul>
            </div>
          </details>
          <button type="button" class="new-project-link" :disabled="access !== 'interactive'" @click="openCreateProjectDialog">+ {{ l('新建项目', 'New project') }}</button>
        </section>

        <nav class="rail-workflow" aria-label="模拟器工作流">
          <p class="rail-label">WORKFLOW</p>
          <button
            v-for="item in sections"
            :key="item.key"
            type="button"
            :class="{ active: workspace.section === item.key }"
            :aria-current="workspace.section === item.key ? 'page' : undefined"
            :disabled="!workspace.project"
            @click="changeSection(item.key)"
          >
            <span>{{ item.label }}</span>
            <small v-if="workflowSteps.find((step) => step.key === item.key)">{{ workflowSteps.find((step) => step.key === item.key)?.detail }}</small>
            <small v-else>{{ l('项目状态与下一步', 'Project status and next steps') }}</small>
          </button>
        </nav>
      </aside>

      <aside class="preflight-rail" aria-label="运行前检查">
        <WorkbenchPreflightPanel
          :access="access"
          :snapshot="preflightSnapshot"
          :runtime="runtime"
          :has-run="Boolean(selectedRun)"
        />
      </aside>

      <section class="workspace-main" aria-label="项目工作区">
        <template v-if="!workspace.project">
          <div class="workspace-empty">
            <h2>选择一个模拟项目</h2>
            <p>选择左侧项目继续配置，或新建一个校园事件模拟。</p>
            <button type="button" class="primary" :disabled="access !== 'interactive'" @click="openCreateProjectDialog">
              {{ access === 'unavailable' ? '后端不可用（只读）' : '新建推演项目' }}
            </button>
          </div>
        </template>

        <template v-else-if="selectedProject">
          <div class="section-body">
            <WorkbenchOverviewPanel
              v-if="workspace.section === 'overview'"
              :project="selectedProject"
              :counts="overviewCounts"
              :access="access"
              :scenario-count="scenarios?.length ?? null"
              :policy-count="policies?.length ?? null"
              :run-count="runs?.length ?? null"
              :evidence-count="evidence?.length ?? null"
              :sensing-count="sensingSnapshots?.length ?? null"
              :latest-run-status="latestRunStatus"
              :runtime-available="Boolean(latestRuntimeRun)"
              :readiness="readinessData"
              demo-kind="live_world"
              @go="changeSection"
              @start-demo="latestRuntimeRun && router.push({ name:'campus-pulse-run-live', params:{ runId:latestRuntimeRun.run_id }, query:{ project:workspace.project } })"
            />

            <WorkbenchEvidencePanel
              v-else-if="workspace.section === 'evidence'"
              :project-id="workspace.project"
              :access="access"
              :evidence="evidence"
              :evidence-loading="evidenceLoading"
              :evidence-error="evidenceError"
              :sensing-snapshots="sensingSnapshots"
              :sensing-state="sensingState"
              :sensing-loading="sensingLoading"
              :sensing-error="sensingError"
              :activating="sensingActivating"
              :attach-error="sensingMutationError"
              @attach-evidence="attachEvidence"
              @activate-sensing="activateSensing"
              @refresh="loadSection"
              @open-evidence="openEvidenceSnapshot"
              @open-plan="changeSection('plan')"
            />

            <WorkbenchScenarioPanel
              v-else-if="workspace.section === 'scenarios'"
              :project-id="workspace.project"
              :access="access"
              :scenarios="scenarios"
              :loading="scenariosLoading"
              :error="scenariosError"
              :submitting="scenarioMutation.status === 'submitting'"
              :submit-error="scenarioMutation.status === 'error' || scenarioMutation.status === 'conflict' || scenarioMutation.status === 'invalid' ? scenarioMutation.problem ?? null : null"

              :submit-success="scenarioMutation.status === 'success' ? '场景已创建。' : ''"
              @create="createScenario"
              @refresh="loadSection"
            />

            <WorkbenchPolicyPanel
              v-else-if="workspace.section === 'policies'"
              :project-id="workspace.project"
              :access="access"
              :policies="policies"
              :loading="policiesLoading"
              :error="policiesError"
              :submitting="policyMutation.status === 'submitting'"
              :submit-error="policyMutation.status === 'error' || policyMutation.status === 'conflict' || policyMutation.status === 'invalid' ? policyMutation.problem ?? null : null"

              :submit-success="policyMutation.status === 'success' ? '方案已创建。' : ''"
              @create="createPolicy"
              @refresh="loadSection"
            />

            <WorkbenchPlanPanel
              v-else-if="workspace.section === 'plan'"
              :project-id="workspace.project"
              :access="access"
              :scenarios="scenarios"
              :policies="policies"
              :sensing-active="sensingActive"
              :evidence-ready="evidenceReady"
              :submitting="planMutation.status === 'submitting'"
              :submit-error="planSubmitError"

              :submit-success="planMutation.status === 'success' ? '运行计划已冻结；当前没有调用模型，也没有消耗 Token。' : ''"
              :bootstrap-submitting="bootstrapMutation.status === 'submitting'"
              :bootstrap-error="bootstrapMutation.status === 'error' || bootstrapMutation.status === 'conflict' || bootstrapMutation.status === 'invalid' ? problemText(bootstrapMutation.problem ?? null) : ''"
              :bootstrap-success="bootstrapMutation.status === 'success' ? '场景、治理方案与人口已就绪。' : ''"
              :planned-run="plannedRun"
              @submit="submitPlan"
              @refresh="loadSection"
              @open-run="selectRun"
              @open-section="changeSection"
              @bootstrap-project="bootstrapCurrentProject"
              @preflight-change="retainPreflightSnapshot"
            />

            <template v-else-if="workspace.section === 'runs'">
              <WorkbenchRunsPanel
                :project-id="workspace.project"
                :access="access"
                :runs="runs"
                :loading="runsLoading"
                :error="runsError"
                :selected-run-id="workspace.run"
                :status-filter="workspace.runStatus"
                @select-run="selectRun"
                @filter="setRunStatusFilter"
                @refresh="loadSection"
                @create-plan="changeSection('plan')"
              />
              <WorkbenchRunMonitor
                v-if="workspace.run"
                :run="selectedRun"
                :runtime="runtime"
                :runtime-loading="runtimeLoading"
                :runtime-error="runtimeError"
                :events="events"
                :events-loading="eventsLoading"
                :events-error="eventsError"
                :access="access"
                :enqueuing="enqueueMutation.status === 'submitting'"
                :cancelling="cancelMutation.status === 'submitting'"
                :action-error="enqueueMutation.status === 'error' || enqueueMutation.status === 'conflict' ? enqueueMutation.problem ?? null : (cancelMutation.status === 'error' || cancelMutation.status === 'conflict' ? cancelMutation.problem ?? null : null)"
                :action-notice="runActionNotice"
                @enqueue="enqueueSelectedRun"
                @cancel="cancelSelectedRun"
                @refresh-runtime="refreshRuntime"
                @load-events="loadEvents"
                @open-result="openResult"
                @open-forum="openForum"
                @open-evidence="openEvidencePage"
                @back="clearRun"
              />
            </template>
          </div>
        </template>

        <div v-else-if="projectsLoading" class="workspace-empty">正在读取项目…</div>
        <div v-else class="workspace-empty">
          <h2>项目未找到</h2>
          <p>请从左侧项目列表重新选择。</p>
        </div>
      </section>
    </div>

    <WorkbenchProjectCreateDialog
      :open="showCreateDialog"
      :submitting="projectMutation.status === 'submitting'"
      :existing-names="(projects ?? []).map((project) => project.name)"
      :existing-century-gym-project-id="(projects ?? []).find((project) => isCenturyGymProject(project))?.project_id"
      :field-errors="projectMutation.status === 'invalid' ? projectMutation.fieldErrors : {}"
      :server-error="problemText(projectMutation.status === 'error' || projectMutation.status === 'conflict' ? projectMutation.problem ?? null : null)"
      @submit="createNewProject"
      @cancel="showCreateDialog = false"
    />
  </div>
</template>

<style scoped>
.workbench-workspace {
  --cp-surface-canvas:#0b090a; --cp-surface-default:#151113; --cp-surface-subtle:#1c1719; --cp-surface-raised:#1c1719; --cp-surface-inverse:#080708; --cp-surface-selected:#29171d;
  --cp-text-primary:#f1ece7; --cp-text-secondary:#b9b0aa; --cp-text-muted:#9e958f; --cp-text-inverse:#f1ece7;
  --cp-border-default:#2a2428; --cp-border-subtle:#241f22; --cp-border-strong:#51464c; --cp-border-inverse:#2a2428;
  --cp-action-primary:#c51642; --cp-action-primary-hover:#a91137;
  --cp-evidence:#d4af37; --cp-evidence-surface:#211d12; --cp-evidence-text:#e2c65f;
  --cp-info:#2b6cb0; --cp-info-surface:#111c27; --cp-warning:#dd6b20; --cp-warning-surface:#26180f; --cp-danger:#e53e3e; --cp-danger-surface:#281214;
  --cp-tech:#9e958f; --cp-tech-bright:#b9b0aa; --cp-tech-surface:#1c1719; --cp-tech-line:#2a2428; --cp-tech-glow:none; --cp-shadow-card:none;
  display:grid; gap:var(--cp-space-4); width:100%; min-height:calc(100vh - 7.5rem); margin:0 auto; padding:var(--cp-space-4) var(--cp-content-gutter) var(--cp-space-8); background:var(--cp-surface-canvas); color:var(--cp-text-primary);
}
.page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-6); padding:var(--cp-space-4); border:1px solid var(--cp-border-default); border-radius:var(--cp-radius-lg); background:var(--cp-surface-default); box-shadow:none; }
.page-kicker { display:block; margin-bottom:var(--cp-space-2); color:var(--cp-tech); font-size:var(--cp-text-xs); font-weight:800; letter-spacing:.12em; }
.page-head h1 { margin:0; font-size:var(--cp-text-3xl); line-height:1.15; letter-spacing:-.025em; }
.page-head p { max-width:56rem; margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-md); line-height:1.7; }
.head-actions { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:var(--cp-space-2); }
.last-sync { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.refresh, .primary { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.refresh { background:var(--cp-surface-default); color:var(--cp-text-primary); }
.header-link { display:inline-flex; align-items:center; text-decoration:none; }
.provider-link { display:inline-flex; min-height:var(--cp-control-height); align-items:center; gap:.45rem; padding:0 var(--cp-space-3); border:1px solid var(--cp-action-primary); border-radius:var(--cp-radius-sm); background:var(--cp-surface-selected); color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:700; text-decoration:none; }
.provider-link:hover { background:var(--cp-action-primary); color:var(--cp-text-inverse); }
.primary { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-text-inverse); }
.primary:hover { background:var(--cp-action-primary-hover); }
.primary:disabled { opacity:.5; cursor:not-allowed; }
.offline-link { display:inline-flex; min-height:var(--cp-control-height); align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-evidence); border-radius:var(--cp-radius-sm); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); font-size:var(--cp-text-sm); font-weight:650; text-decoration:none; }
.head-actions .offline-link { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-text-inverse); }
.head-actions .offline-link:hover { background:var(--cp-action-primary-hover); }
.head-actions .offline-link:disabled { border-color:var(--cp-border-strong); background:var(--cp-surface-subtle); color:var(--cp-text-muted); cursor:not-allowed; }
.unavailable-banner { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border:1px solid var(--cp-warning); background:var(--cp-warning-surface); }
.unavailable-banner strong { font-size:var(--cp-text-sm); }
.unavailable-banner p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.banner-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.workbench-layout { display:grid; grid-template-areas:"left main preflight"; grid-template-columns:minmax(13rem,16rem) minmax(0,1fr) minmax(15rem,18rem); gap:var(--cp-space-3); align-items:start; }
.projects-pane { position:sticky; top:var(--cp-topbar-height); display:grid; gap:var(--cp-space-3); }
.projects-pane { grid-area:left; }
.preflight-rail { grid-area:preflight; position:sticky; top:var(--cp-topbar-height); min-width:0; }
.search input { width:100%; min-height:var(--cp-control-height); padding:0 var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.project-context { display:grid; gap:var(--cp-space-2); padding-bottom:var(--cp-space-4); border-bottom:1px solid var(--cp-border-default); }
.rail-label { margin:0; color:var(--cp-text-muted); font:750 var(--cp-text-xs)/1 var(--cp-font-mono); letter-spacing:.11em; }
.selected-project-context { display:flex; align-items:flex-start; gap:var(--cp-space-2); padding:var(--cp-space-2) 0; }
.selected-project-context code { overflow:hidden; margin-top:2px; color:var(--cp-text-muted); font-size:.61rem; text-overflow:ellipsis; white-space:nowrap; }
.no-project-context { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-sm); }
.project-switcher { border-block:1px solid var(--cp-border-subtle); }
.project-switcher summary { display:flex; min-height:var(--cp-control-height); align-items:center; justify-content:space-between; gap:var(--cp-space-2); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; list-style-position:inside; }
.project-switcher summary small { margin-left:auto; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:600; }
.project-switcher[open] summary { border-bottom:1px solid var(--cp-border-subtle); }
.project-picker { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-2) 0; }
.new-project-link { justify-self:start; min-height:2rem; padding:0; border:0; background:transparent; color:var(--cp-action-primary); font-size:var(--cp-text-xs); font-weight:700; cursor:pointer; }
.new-project-link:disabled { opacity:.5; cursor:not-allowed; }
.pane-state { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.pane-state strong { color:var(--cp-text-primary); }
.pane-state button { justify-self:start; min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-action-primary); font-weight:650; cursor:pointer; }
.project-list { display:grid; max-height:14rem; gap:var(--cp-space-1); margin:0; padding:0; overflow:auto; list-style:none; }
.project-row { display:flex; align-items:center; gap:var(--cp-space-2); width:100%; padding:var(--cp-space-2); border:0; border-left:2px solid transparent; background:transparent; color:var(--cp-text-primary); text-align:left; cursor:pointer; }
.project-row:hover { background:var(--cp-surface-subtle); }
.project-row.selected { border-left-color:var(--cp-action-primary); background:var(--cp-surface-selected); }
.project-glyph { flex:none; display:flex; align-items:center; justify-content:center; width:2rem; height:2rem; border-radius:var(--cp-radius-sm); background:var(--cp-surface-subtle); color:var(--cp-action-primary); font-weight:800; }
.project-copy { min-width:0; display:grid; }
.project-copy strong { font-size:var(--cp-text-sm); }
.project-copy small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.rail-workflow { display:grid; background:transparent; }
.rail-workflow .rail-label { padding:var(--cp-space-1) var(--cp-space-3) var(--cp-space-2); }
.rail-workflow button { display:grid; gap:2px; min-height:var(--cp-control-height); padding:var(--cp-space-2) var(--cp-space-3); border:0; border-bottom:1px solid var(--cp-border-subtle); border-left:3px solid transparent; background:transparent; color:var(--cp-text-primary); text-align:left; cursor:pointer; }
.rail-workflow button:last-child { border-bottom:0; }
.rail-workflow button:hover:not(:disabled) { background:var(--cp-surface-subtle); }
.rail-workflow button.active { border-left-color:var(--cp-action-primary); background:var(--cp-surface-selected); }
.rail-workflow button:disabled { cursor:not-allowed; opacity:.55; }
.rail-workflow span { font-size:var(--cp-text-sm); font-weight:700; }
.rail-workflow small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.workspace-main { grid-area:main; display:grid; gap:var(--cp-space-4); min-width:0; }
.workspace-empty { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-6); border:1px dashed var(--cp-border-strong); }
.workspace-empty h2 { margin:0; font-size:var(--cp-text-lg); }
.workspace-empty p { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.workspace-empty .primary { justify-self:start; }
.section-body { display:grid; gap:var(--cp-space-4); min-width:0; }
.workbench-workspace :deep(button.primary),
.workbench-workspace :deep(.live-demo button),
.workbench-workspace :deep(.open-dossier) { color:var(--cp-text-inverse); }
@media (min-width:1280px) and (max-width:1799px) {
  .workspace-main :deep(.network-layout),
  .workspace-main :deep(.world-grid),
  .workspace-main :deep(.risk-card) { grid-template-columns:1fr; }
  .workspace-main :deep(.role-inspector) { border-top:1px solid var(--cp-border-default); border-left:0; }
  .workspace-main :deep(.channel-flow) { grid-template-columns:1fr; gap:var(--cp-space-2); }
  .workspace-main :deep(.channel-link) { padding:var(--cp-space-2); transform:rotate(90deg); }
}
@media (max-width:1279px) {
  .workbench-layout { grid-template-areas:"left" "preflight" "main"; grid-template-columns:1fr; }
  .projects-pane { position:static; }
  .preflight-rail { position:static; }
  .rail-workflow { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .rail-workflow button { border-right:1px solid var(--cp-border-subtle); }
}
@media (max-width:767px) {
  .page-head { flex-direction:column; }
  .head-actions { justify-content:flex-start; }
  .unavailable-banner { flex-direction:column; }
  .workbench-workspace { padding-top:var(--cp-space-4); }
  .rail-workflow { grid-template-columns:1fr 1fr; }
  .rail-workflow button { min-height:var(--cp-touch-target); }
}
</style>
