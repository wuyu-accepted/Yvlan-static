import { createRouter, createWebHistory } from 'vue-router'
import { productRouteMeta } from '../campus-pulse/app/navigation'
import { installProductRouteProgress } from '../campus-pulse/app/routeProgress'
import { legacyRunResultLocation } from '../campus-pulse/source/routeResolver'

// Keep the competition pages and the upstream OneSim console in separate
// chunks. The CampusPulse handoff can then load without paying for every
// unrelated editor and visualization dependency up front.
const Dashboard = () => import('../views/Dashboard.vue')
const CategoryView = () => import('../views/CategoryView.vue')
const ChatMode = () => import('../views/ChatMode.vue')
const AgentTypesView = () => import('../views/AgentTypesView.vue')
const HumanLoopView = () => import('../views/HumanLoopView.vue')
const CampusPulseView = () => import('../views/CampusPulseView.vue')
const RepresentativeSimulationView = () =>
  import('../views/RepresentativeSimulationView.vue')
const MassSimulationView = () =>
  import('../views/MassSimulationView.vue')
const GovernanceArenaView = () =>
  import('../views/GovernanceArenaView.vue')
const GovernanceArenaV2View = () =>
  import('../views/GovernanceArenaV2View.vue')
const YuLanScaleView = () =>
  import('../views/YuLanScaleView.vue')
const ForumTwinView = () =>
  import('../views/ForumTwinView.vue')
const CampusPulseCoverPage = () =>
  import('../campus-pulse/landing/CampusPulseCoverPage.vue')
const CampusPulseOverviewView = () =>
  import('../views/CampusPulseOverviewView.vue')
const CampusPulseResultsView = () =>
  import('../views/CampusPulseResultsView.vue')
const CampusPulseSystemView = () =>
  import('../views/CampusPulseSystemView.vue')
const InnovationEvaluationPage = () =>
  import('../campus-pulse/system/InnovationEvaluationPage.vue')
const WorkbenchHomeView = () =>
  import('../campus-pulse/workbench/WorkbenchWorkspacePage.vue')
const ProjectCenterPage = () =>
  import('../campus-pulse/projects/ProjectCenterPage.vue')
const ProjectCreationWizard = () =>
  import('../campus-pulse/projects/ProjectCreationWizard.vue')
const RunLivePage = () =>
  import('../campus-pulse/live/RunLivePage.vue')
const RunAnalysisPage = () =>
  import('../campus-pulse/analysis/RunAnalysisPage.vue')
const CenturyGymLivePage = () =>
  import('../campus-pulse/live/CenturyGymLivePage.vue')
const LiveEvolutionLandingPage = () =>
  import('../campus-pulse/live/LiveEvolutionLandingPage.vue')
const ProductNotFound = () =>
  import('../campus-pulse/pages/ProductNotFound.vue')
const ResultSummaryBoundary = () =>
  import('../campus-pulse/pages/ResultSummaryBoundary.vue')
const ResultSummaryPage = () =>
  import('../campus-pulse/results/ResultSummaryPage.vue')
const MechanismsPage = () =>
  import('../campus-pulse/results/MechanismsPage.vue')
const GovernancePage = () =>
  import('../campus-pulse/results/GovernancePage.vue')
const ResultEvidencePage = () =>
  import('../campus-pulse/results/ResultEvidencePage.vue')

function canonicalizeLegacyRun(to) {
  return legacyRunResultLocation(to.query.run_id) || true
}

const routes = [
  // {
  //   path: '/',
  //   name: 'welcome',
  //   component: WelcomePage
  // },
  {
    path: '/',
    redirect: '/campus-pulse'
  },
  {
    path: '/legacy/onesim',
    name: 'dashboard',
    component: Dashboard
  },
  {
    path: '/category/:category/:subcategory',
    name: 'category',
    component: CategoryView,
    props: true
  },
  {
    path: '/chat',
    name: 'chat',
    component: ChatMode
  },
  {
    path: '/agent-types',
    name: 'agent-types',
    component: AgentTypesView
  },
  {
    path: '/human-loop',
    name: 'human-loop',
    component: HumanLoopView
  },
  {
    path: '/campus-pulse',
    name: 'campus-pulse',
    component: CampusPulseCoverPage,
    meta: {
      standaloneCover: true,
      title: 'CampusPulse',
      documentTitle: 'CampusPulse · 校园论坛社会模拟',
    },
  },
  {
    path: '/campus-pulse/overview',
    name: 'campus-pulse-overview',
    component: CampusPulseOverviewView,
    meta: productRouteMeta.overview,
  },
  {
    path: '/campus-pulse/forum',
    name: 'campus-pulse-forum',
    component: ForumTwinView,
    meta: productRouteMeta.forum,
    beforeEnter: canonicalizeLegacyRun,
  },
  {
    path: '/campus-pulse/live-evolution',
    name: 'campus-pulse-live-evolution',
    component: LiveEvolutionLandingPage,
    meta: productRouteMeta.liveEvolution,
  },
  {
    path: '/campus-pulse/live',
    name: 'campus-pulse-live-world',
    component: CenturyGymLivePage,
    meta: productRouteMeta.liveWorld,
  },
  {
    path: '/campus-pulse/live/century-gym',
    name: 'campus-pulse-century-gym-live',
    redirect: {
      name: 'campus-pulse-run-live',
      params: { runId: 'century-gym-demo' },
      query: { session: 'century-gym-demo', branch: 'D', tick: '0' },
    },
  },
  {
    path: '/campus-pulse/results',
    name: 'campus-pulse-results',
    component: CampusPulseResultsView,
    meta: productRouteMeta.results,
    beforeEnter: canonicalizeLegacyRun,
  },
  {
    // M05 SDD scope: forum investigation lives under a result detail route.
    path: '/campus-pulse/results/:resultKey/forum',
    name: 'campus-pulse-result-forum',
    component: ForumTwinView,
    meta: productRouteMeta.forum,
  },  {
    path: '/campus-pulse/results/:resultKey',
    component: ResultSummaryBoundary,
    meta: productRouteMeta.results,
    children: [
      {
        path: '',
        redirect: (to) => ({
          name: 'campus-pulse-result-summary',
          params: { resultKey: to.params.resultKey },
          query: to.query,
        }),
      },
      {
        path: 'summary',
        name: 'campus-pulse-result-summary',
        component: ResultSummaryPage,
      },
      {
        path: 'mechanisms',
        name: 'campus-pulse-result-mechanisms',
        component: MechanismsPage,
      },
      {
        path: 'governance',
        name: 'campus-pulse-result-governance',
        component: GovernancePage,
      },
      {
        path: 'evidence',
        name: 'campus-pulse-result-evidence',
        component: ResultEvidencePage,
      },
    ],
  },
  {
    path: '/campus-pulse/system',
    name: 'campus-pulse-system',
    component: CampusPulseSystemView,
    meta: productRouteMeta.system,
  },
  {
    path: '/campus-pulse/system/innovation-evaluation',
    name: 'campus-pulse-innovation-evaluation',
    component: InnovationEvaluationPage,
    meta: {
      ...productRouteMeta.system,
      title: '创新与评测',
    },
  },
  {
    path: '/campus-pulse/archive/yulan-scale-v1',
    name: 'campus-pulse-yulan-scale-v1-archive',
    component: YuLanScaleView
  },
  {
    path: '/campus-pulse/archive/competition-final',
    name: 'campus-pulse-competition-final-archive',
    component: RepresentativeSimulationView
  },
  {
    path: '/campus-pulse/robustness',
    name: 'campus-pulse-robustness',
    component: CampusPulseView
  },
  {
    path: '/campus-pulse/mass-sim',
    name: 'campus-pulse-mass-sim',
    component: MassSimulationView
  },
  {
    path: '/campus-pulse/governance-arena',
    name: 'campus-pulse-governance-arena',
    component: GovernanceArenaView
  },
  {
    path: '/campus-pulse/governance-arena-v2',
    name: 'campus-pulse-governance-arena-v2',
    component: GovernanceArenaV2View
  },
  {
    path: '/campus-pulse/app',
    name: 'campus-pulse-project-center',
    component: ProjectCenterPage,
    meta: productRouteMeta.workbench,
  },
  {
    path: '/campus-pulse/projects/new',
    name: 'campus-pulse-project-new',
    component: ProjectCreationWizard,
    meta: productRouteMeta.workbench,
  },
  {
    path: '/campus-pulse/projects/:id',
    name: 'campus-pulse-project-overview',
    component: WorkbenchHomeView,
    meta: { ...productRouteMeta.workbench, workbenchSection: 'overview' },
  },
  {
    path: '/campus-pulse/projects/:id/world',
    name: 'campus-pulse-project-world',
    component: WorkbenchHomeView,
    meta: { ...productRouteMeta.workbench, workbenchSection: 'evidence' },
  },
  {
    path: '/campus-pulse/projects/:id/scenario',
    name: 'campus-pulse-project-scenario',
    component: WorkbenchHomeView,
    meta: { ...productRouteMeta.workbench, workbenchSection: 'scenarios' },
  },
  {
    path: '/campus-pulse/projects/:id/policies',
    name: 'campus-pulse-project-policies',
    component: WorkbenchHomeView,
    meta: { ...productRouteMeta.workbench, workbenchSection: 'policies' },
  },
  {
    path: '/campus-pulse/projects/:id/run-plan',
    name: 'campus-pulse-project-run-plan',
    component: WorkbenchHomeView,
    meta: { ...productRouteMeta.workbench, workbenchSection: 'plan' },
  },
  {
    path: '/campus-pulse/runs/:runId/live',
    name: 'campus-pulse-run-live',
    component: RunLivePage,
    meta: productRouteMeta.liveWorld,
  },
  {
    path: '/campus-pulse/runs/:runId/analysis',
    name: 'campus-pulse-run-analysis',
    component: RunAnalysisPage,
    meta: productRouteMeta.results,
  },
  {
    path: '/campus-pulse/cases',
    redirect: { name: 'campus-pulse-results' },
  },
  {
    path: '/campus-pulse/settings',
    redirect: { name: 'campus-pulse-system' },
  },
  {
    path: '/campus-pulse/workbench',
    name: 'campus-pulse-workbench',
    component: WorkbenchHomeView,
    meta: productRouteMeta.workbench,
  },
  {
    path: '/campus-pulse/:pathMatch(.*)*',
    name: 'campus-pulse-not-found',
    component: ProductNotFound,
    meta: {
      productShell: true,
      navId: '',
      title: '页面未找到',
      source: {
        mode: 'unknown',
        verification: 'unverified',
        freshness: 'unknown',
        access: 'readonly',
        publicationEligible: null,
        boundarySummary: '未知路由不加载业务数据。',
      },
    },
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

const publicDemoBlockedNames = new Set([
  'campus-pulse-project-center',
  'campus-pulse-project-new',
  'campus-pulse-project-overview',
  'campus-pulse-project-world',
  'campus-pulse-project-scenario',
  'campus-pulse-project-policies',
  'campus-pulse-project-run-plan',
  'campus-pulse-run-live',
  'campus-pulse-run-analysis',
  'campus-pulse-workbench',
])

if (import.meta.env.VITE_PUBLIC_DEMO === 'true') {
  router.beforeEach((to) => (
    publicDemoBlockedNames.has(String(to.name || ''))
      ? { name: 'campus-pulse-results', query: { mode: 'public-demo' } }
      : true
  ))
}

installProductRouteProgress(router)

export default router
