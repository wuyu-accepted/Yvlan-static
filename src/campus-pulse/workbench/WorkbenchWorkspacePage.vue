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
  deleteProject,
  enqueueRun,
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
import WorkbenchRunsPanel from './WorkbenchRunsPanel.vue'
import WorkbenchRunMonitor from './WorkbenchRunMonitor.vue'
import ForumLiveVignettePanel from './ForumLiveVignettePanel.vue'
import { currentLocale, localizeStoredText } from '../i18n/locale.ts'
import { useProductShellContext } from '../app/shellContext'

const route = useRoute()
const router = useRouter()
const demoWorkspace = ref(false)

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

const shell = useProductShellContext()
const serviceState = shell?.serviceState ?? ref('checking')
const access = computed<'interactive' | 'readonly' | 'unavailable'>(() =>
  serviceState.value === 'available' ? 'interactive'
    : serviceState.value === 'unavailable' ? 'unavailable' : 'readonly')
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
const deletingProjectId = ref('')

const showCreateDialog = ref(false)

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
    const health = shell?.refreshHealth ? await shell.refreshHealth() : await getWorkbenchHealth()
    if (!probeToken.isCurrent(id)) return
    if (!health) return
    serviceState.value = 'available'
    demoWorkspace.value = health.workspace?.demo === true
    lastSync.value = new Date().toISOString()
  } catch (error) {
    if (!probeToken.isCurrent(id)) return
    serviceState.value = 'unavailable'
    accessError.value = readableApiError(error)
    return
  }
  // Capability readiness does not determine whether the project API is online.
  const [readiness, overview] = await Promise.allSettled([
    getWorkbenchReadiness(), getWorkbenchOverview(),
  ])
  if (!probeToken.isCurrent(id)) return
  readinessData.value = readiness.status === 'fulfilled' ? readiness.value : null
  if (overview.status === 'fulfilled') overviewCounts.value = countsFromOverview(overview.value)
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

async function removeProject(project: WorkbenchProject) {
  if (access.value !== 'interactive' || deletingProjectId.value) return
  const confirmed = window.confirm(`删除项目“${localizeStoredText(project.name)}”？删除后可使用相同名称重新创建。`)
  if (!confirmed) return
  deletingProjectId.value = project.project_id
  try {
    await deleteProject(project.project_id)
    if (workspace.value.project === project.project_id) {
      await router.push({ name:'campus-pulse-workbench' })
    }
    await loadProjects()
  } catch (error) {
    projectsError.value = error as ApiProblem
  } finally {
    deletingProjectId.value = ''
  }
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

function inferProjectScenario(project: WorkbenchProject | null | undefined): 'century_gym_ghost_booking_dispute' | 'governance_legitimacy_dispute' | 'lecture_external_incident_shock' {
  const key = project?.project_id === workspace.value.project ? scenarios.value?.[0]?.template_key : undefined
  if (key?.includes('century_gym')) return 'century_gym_ghost_booking_dispute'
  if (key?.includes('lecture')) return 'lecture_external_incident_shock'
  if (key?.includes('housing')) return 'governance_legitimacy_dispute'
  const corpus = `${project?.name || ''} ${project?.governance_domain || ''} ${project?.objective || ''}`
  if (/世纪馆|体育场地预约|幽灵预约|羽毛球|乒乓球/.test(corpus)) return 'century_gym_ghost_booking_dispute'
  if (/讲座|辱骂|冲突|主办方|现场发言/.test(corpus)) return 'lecture_external_incident_shock'
  return 'governance_legitimacy_dispute'
}

function projectLiveLocation(project: WorkbenchProject | null | undefined, projectId?: string) {
  const centuryGym = inferProjectScenario(project) === 'century_gym_ghost_booking_dispute'
  return {
    name:'campus-pulse-live-world',
    query:{
      scenario:inferProjectScenario(project),
      project_id:project?.project_id || projectId || undefined,
      session:centuryGym ? 'century-gym-demo' : undefined,
      reset:centuryGym ? '1' : undefined,
    },
  }
}

function startProjectDemo(projectId?: string) {
  const project = (projects.value ?? []).find((item) => item.project_id === projectId) || selectedProject.value
  router.push(projectLiveLocation(project,projectId))
}

function openCreateProjectDialog() {
  void router.push({ name: 'campus-pulse-project-new' })
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
      ? { ...problem, detail: problem.detail + ' 请刷新项目状态后重试。' } as ApiProblem
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
    || localizeStoredText(project.name).toLowerCase().includes(q)
    || localizeStoredText(project.governance_domain).toLowerCase().includes(q)
  ))
})

const projectCountLabel = computed(() => {
  if (access.value === 'unavailable') return currentLocale.value === 'en-US' ? 'Unavailable' : '不可用'
  if (projects.value === null) return currentLocale.value === 'en-US' ? 'Unknown' : '未知'
  if (currentLocale.value === 'en-US') return `${projects.value.length} project${projects.value.length === 1 ? '' : 's'}`
  return projects.value.length + ' 个项目'
})

const selectedProject = computed(() => (
  (projects.value ?? []).find((project) => project.project_id === workspace.value.project) || null
))

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
  { key: 'scenarios', label: '事件设置' },
  { key: 'policies', label: '治理方案' },
  { key: 'plan', label: '运行参数' },
  { key: 'runs', label: '运行监控' },
]

const workflowSteps: Array<{
  number: string
  key: WorkbenchWorkspaceState['section']
  label: string
  detail: string
}> = [
  { number: '1', key: 'evidence', label: 'Agent 世界', detail: '固定人口、Profile、关系与利益位置' },
  { number: '2', key: 'scenarios', label: '事件设置', detail: '检查已保存的事件和演化阶段' },
  { number: '3', key: 'policies', label: '治理方案', detail: '设置可执行动作与承诺' },
  { number: '4', key: 'plan', label: '运行参数', detail: '确认模型、分支、时间步和预算' },
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
          {{ serviceState === 'checking' ? '正在检查后端' : access === 'interactive' ? '内部服务已连接' : access === 'readonly' ? '只读' : '服务未连接' }}
        </CpStatusBadge>
        <span v-if="lastSync" class="last-sync">上次同步 {{ new Date(lastSync).toLocaleTimeString('zh-CN') }}</span>
        <button type="button" class="refresh" @click="refreshAll">刷新</button>
        <RouterLink class="provider-link" to="/campus-pulse/system?tab=provider"><i class="fa-solid fa-key" aria-hidden="true" /> 模型与 API</RouterLink>
      </div>
    </header>

    <div v-if="access === 'unavailable'" class="unavailable-banner" role="status">
      <div>
        <strong>后端不可用</strong>
        <p>连接恢复后可继续编辑项目。{{ accessError ? accessError : '' }}</p>
      </div>
      <div class="banner-actions">
        <button type="button" class="refresh" @click="probeBackend">重试连接</button>
        <RouterLink class="offline-link" to="/campus-pulse/results">查看案例结果</RouterLink>
      </div>
    </div>

    <nav v-if="!workspace.project" class="workflow-guide" aria-label="模拟器工作流">
      <button
        v-for="step in workflowSteps"
        :key="step.key"
        type="button"
        :class="{ active: workspace.section === step.key }"
        :disabled="!workspace.project"
        @click="changeSection(step.key)"
      >
        <b>{{ step.number }}</b>
        <span>{{ step.label }}</span>
        <small>{{ step.detail }}</small>
      </button>
    </nav>

    <div class="workbench-layout">
      <aside class="projects-pane" aria-label="模拟项目">
        <div class="pane-tools">
          <label class="search">
            <span class="visually-hidden">搜索项目</span>
            <input type="search" placeholder="搜索项目 / 领域" :value="workspace.q" @input="setProjectSearch(($event.target as HTMLInputElement).value)" />
          </label>
          <button type="button" class="primary" :disabled="access !== 'interactive'" @click="openCreateProjectDialog">+ 新建项目</button>
        </div>

        <p class="pane-count" data-no-localize>{{ projectCountLabel }}</p>

        <div v-if="access === 'unavailable'" class="pane-state">
          <strong>项目状态未知</strong>
          <p>后端不可用，项目列表状态未知。</p>
        </div>
        <div v-else-if="projectsLoading" class="pane-state">正在读取项目…</div>
        <div v-else-if="projectsError" class="pane-state" role="alert">
          <strong>项目列表读取失败</strong>
          <p>{{ projectsError.summary }}</p>
          <button type="button" @click="loadProjects">重试</button>
        </div>
        <div v-else-if="filteredProjects.length === 0" class="pane-state">
          <strong v-if="projects && projects.length === 0">尚无模拟项目</strong>
          <strong v-else>没有匹配项目</strong>
          <p>创建项目后，可以绑定证据、配置场景并生成运行计划。</p>
          <button type="button" :disabled="access !== 'interactive'" @click="openCreateProjectDialog">新建推演项目</button>
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
              <span class="project-glyph" aria-hidden="true"><i class="fa-solid fa-building-columns" /></span>
              <span class="project-copy">
                <strong data-no-localize>{{ localizeStoredText(project.name) }}</strong>
                <small data-no-localize>{{ localizeStoredText(project.governance_domain) }}</small>
              </span>
            </button>
            <button type="button" class="project-delete" :disabled="access !== 'interactive' || Boolean(deletingProjectId)" :aria-label="`删除项目 ${localizeStoredText(project.name)}`" @click="removeProject(project)"><i class="fa-regular fa-trash-can" aria-hidden="true" /></button>
          </li>
        </ul>
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
          <nav class="context-nav" aria-label="项目导航">
            <button
              v-for="item in sections"
              :key="item.key"
              type="button"
              :class="{ active: workspace.section === item.key }"
              :aria-current="workspace.section === item.key ? 'page' : undefined"
              @click="changeSection(item.key)"
            >{{ item.label }}</button>
          </nav>

          <div class="section-body">
            <WorkbenchOverviewPanel
              v-if="workspace.section === 'overview'"
              :project="selectedProject"
              :counts="overviewCounts"
              :access="access"
              :scenario-key="scenarios?.[0]?.template_key || undefined"
              :scenario-count="scenarios?.length ?? null"
              :policy-count="policies?.length ?? null"
              :run-count="runs?.length ?? null"
              :evidence-count="evidence?.length ?? null"
              :sensing-count="sensingSnapshots?.length ?? null"
              :latest-run-status="latestRunStatus"
              :readiness="readinessData"
              demo-kind="live_world"
              @go="changeSection"
              @start-demo="startProjectDemo(workspace.project)"
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

            <template v-else-if="workspace.section === 'plan'">
            <ForumLiveVignettePanel
              v-if="!demoWorkspace"
              :project-id="workspace.project"
              :scenario-id="scenarios?.some(item => item.template_key === 'project_setup_custom_v1') ? null : inferProjectScenario(selectedProject)"
              :scenario-configured="Boolean(scenarios?.length)"
              @configure-scenario="changeSection('scenarios')"
            />
            <details v-if="!demoWorkspace" class="advanced-run-settings">
            <summary data-no-localize>{{ currentLocale === 'en-US' ? 'Advanced run configuration' : '高级运行配置' }}</summary>
            <WorkbenchPlanPanel
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
            />
            </details>
            <WorkbenchOverviewPanel v-else
              :project="selectedProject" :counts="overviewCounts" :access="access"
              :scenario-key="scenarios?.[0]?.template_key"
              :scenario-count="scenarios?.length ?? null" :policy-count="policies?.length ?? null"
              :run-count="runs?.length ?? null" :evidence-count="evidence?.length ?? null"
              :sensing-count="sensingSnapshots?.length ?? null" :latest-run-status="latestRunStatus"
              :readiness="readinessData" demo-kind="live_world" @go="changeSection"
            />
            </template>

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
.workbench-workspace { display:grid; gap:var(--cp-space-4); width:min(100%,var(--cp-content-max)); margin:0 auto; padding:var(--cp-space-5) var(--cp-content-gutter) var(--cp-space-8); }
.page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-6); padding:var(--cp-space-6); border:1px solid var(--cp-tech-line); border-radius:var(--cp-radius-lg); background:var(--cp-surface-default); box-shadow:var(--cp-shadow-sm); }
.page-kicker { display:block; margin-bottom:var(--cp-space-2); color:var(--cp-tech); font-size:var(--cp-text-xs); font-weight:800; letter-spacing:.12em; }
.page-head h1 { margin:0; font-size:var(--cp-text-3xl); line-height:1.15; letter-spacing:-.025em; }
.page-head p { max-width:56rem; margin:var(--cp-space-3) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-md); line-height:1.7; }
.head-actions { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:var(--cp-space-2); }
.last-sync { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.refresh, .primary { min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.refresh { background:var(--cp-surface-default); color:var(--cp-text-primary); }
.provider-link { display:inline-flex; min-height:var(--cp-control-height); align-items:center; gap:.45rem; padding:0 var(--cp-space-3); border:1px solid var(--cp-action-primary); border-radius:var(--cp-radius-sm); background:var(--cp-surface-selected); color:var(--cp-action-primary); font-size:var(--cp-text-sm); font-weight:700; text-decoration:none; }
.provider-link:hover { background:var(--cp-action-primary); color:var(--cp-surface-default); }
.primary { border-color:var(--cp-action-primary); background:var(--cp-action-primary); color:var(--cp-surface-default); }
.primary:hover { background:var(--cp-action-primary-hover); }
.primary:disabled { opacity:.5; cursor:not-allowed; }
.offline-link { display:inline-flex; min-height:var(--cp-control-height); align-items:center; padding:0 var(--cp-space-3); border:1px solid var(--cp-evidence); border-radius:var(--cp-radius-sm); background:var(--cp-evidence-surface); color:var(--cp-evidence-text); font-size:var(--cp-text-sm); font-weight:650; text-decoration:none; }
.unavailable-banner { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--cp-space-3); padding:var(--cp-space-3) var(--cp-space-4); border:1px solid var(--cp-warning); background:var(--cp-warning-surface); }
.unavailable-banner strong { font-size:var(--cp-text-sm); }
.unavailable-banner p { margin:var(--cp-space-1) 0 0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.banner-actions { display:flex; flex-wrap:wrap; gap:var(--cp-space-2); }
.workflow-guide { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.workflow-guide button { display:grid; min-width:0; grid-template-columns:1.75rem 1fr; gap:var(--cp-space-1) var(--cp-space-2); padding:var(--cp-space-3); border:0; border-right:1px solid var(--cp-border-default); background:transparent; color:var(--cp-text-primary); text-align:left; cursor:pointer; }
.workflow-guide button:last-child { border-right:0; }
.workflow-guide button:hover:not(:disabled) { background:var(--cp-surface-selected); }
.workflow-guide button.active { box-shadow:inset 0 3px 0 var(--cp-action-primary); background:var(--cp-surface-selected); }
.workflow-guide button:disabled { cursor:not-allowed; opacity:.62; }
.workflow-guide b { display:flex; width:1.75rem; height:1.75rem; grid-row:1 / 3; align-items:center; justify-content:center; background:var(--cp-surface-inverse); color:var(--cp-text-inverse); font-size:var(--cp-text-xs); }
.workflow-guide button.active b { background:var(--cp-action-primary); }
.workflow-guide span { overflow:hidden; font-size:var(--cp-text-sm); font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
.workflow-guide small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); line-height:var(--cp-leading-normal); }
.workbench-layout { display:grid; grid-template-columns:minmax(15rem,20rem) minmax(0,1fr); gap:var(--cp-space-4); align-items:start; }
.projects-pane { position:sticky; top:var(--cp-topbar-height); display:grid; gap:var(--cp-space-3); }
.pane-tools { display:grid; gap:var(--cp-space-2); }
.search input { width:100%; min-height:var(--cp-control-height); padding:0 var(--cp-space-2); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-text-primary); }
.pane-count { margin:0; color:var(--cp-text-muted); font-size:var(--cp-text-xs); font-weight:700; }
.pane-state { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-3); border:1px dashed var(--cp-border-strong); color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.pane-state strong { color:var(--cp-text-primary); }
.pane-state button { justify-self:start; min-height:var(--cp-control-height); padding:0 var(--cp-space-3); border:1px solid var(--cp-border-strong); border-radius:var(--cp-radius-sm); background:var(--cp-surface-default); color:var(--cp-action-primary); font-weight:650; cursor:pointer; }
.project-list { display:grid; gap:var(--cp-space-1); margin:0; padding:0; list-style:none; }
.project-list>li{display:grid;grid-template-columns:minmax(0,1fr) 2.5rem;gap:.35rem;align-items:stretch}.project-delete{display:grid;place-items:center;border:1px solid var(--cp-border-subtle);background:var(--cp-surface-default);color:var(--cp-text-muted);cursor:pointer}.project-delete:hover:not(:disabled){border-color:var(--cp-danger);color:var(--cp-danger);background:#fff4f5}.project-delete:focus-visible{outline:2px solid var(--cp-focus-ring);outline-offset:2px}.project-delete:disabled{opacity:.4;cursor:default}
.project-row { display:flex; align-items:center; gap:var(--cp-space-2); width:100%; padding:var(--cp-space-2) var(--cp-space-3); border:1px solid var(--cp-border-subtle); border-left:3px solid transparent; background:var(--cp-surface-default); text-align:left; cursor:pointer; }
.project-row:hover { background:var(--cp-surface-subtle); }
.project-row.selected { border-left-color:var(--cp-action-primary); background:var(--cp-surface-selected); }
.project-glyph { flex:none; display:flex; align-items:center; justify-content:center; width:2rem; height:2rem; border-radius:var(--cp-radius-sm); background:var(--cp-surface-subtle); color:var(--cp-action-primary); font-weight:800; }
.project-copy { min-width:0; display:grid; }
.project-copy strong { font-size:var(--cp-text-sm); }
.project-copy small { color:var(--cp-text-muted); font-size:var(--cp-text-xs); }
.workspace-main { display:grid; gap:var(--cp-space-4); min-width:0; }
.workspace-empty { display:grid; gap:var(--cp-space-2); padding:var(--cp-space-6); border:1px dashed var(--cp-border-strong); }
.workspace-empty h2 { margin:0; font-size:var(--cp-text-lg); }
.workspace-empty p { margin:0; color:var(--cp-text-secondary); font-size:var(--cp-text-sm); }
.workspace-empty .primary { justify-self:start; }
.context-nav { display:flex; flex-wrap:wrap; gap:0; border-bottom:1px solid var(--cp-border-default); }
.context-nav button { min-height:var(--cp-control-height); padding:0 var(--cp-space-4); border:0; border-bottom:2px solid transparent; background:none; color:var(--cp-text-secondary); font-weight:650; cursor:pointer; }
.context-nav button.active { border-bottom-color:var(--cp-action-primary); color:var(--cp-action-primary); }
.section-body { display:grid; gap:var(--cp-space-4); min-width:0; }
.advanced-run-settings { min-width:0; border:1px solid var(--cp-border-default); background:var(--cp-surface-default); }
.advanced-run-settings > summary { padding:var(--cp-space-4); color:var(--cp-text-primary); font-size:var(--cp-text-sm); font-weight:650; cursor:pointer; }
.advanced-run-settings > summary:hover { background:var(--cp-surface-selected); }
.advanced-run-settings > summary:focus-visible { outline:2px solid var(--cp-action-primary); outline-offset:-3px; }
.advanced-run-settings[open] > summary { border-bottom:1px solid var(--cp-border-default); }
@media (max-width:1023px) {
  .workflow-guide { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .workflow-guide button { border-bottom:1px solid var(--cp-border-default); }
  .workbench-layout { grid-template-columns:1fr; }
  .projects-pane { position:static; }
}
@media (max-width:767px) {
  .page-head { flex-direction:column; }
  .head-actions { justify-content:flex-start; }
  .unavailable-banner { flex-direction:column; }
  .context-nav button { min-height:var(--cp-touch-target); }
  .workbench-workspace { padding-top:var(--cp-space-4); }
  .workflow-guide { grid-template-columns:1fr; }
  .workflow-guide button { min-height:var(--cp-touch-target); border-right:0; }
}
</style>
