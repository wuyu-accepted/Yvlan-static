import type { ApiProblem } from '../contracts/api.ts'
import { sourceProblem } from '../source/resultResolver.ts'
import { normalizeListPageRows, type ResultListRowVM } from './resultsList.ts'

export interface ResultsListComposition {
  rows: ResultListRowVM[]
  projects: Array<{ projectId: string; name: string; runCount: number }>
  selectedProject: string
  problem: ApiProblem | null
  backendUnavailable: boolean
  gap: string
}

export interface ResultsListDependencies {
  listProjects: () => Promise<any[]>
  listProjectRuns: (projectId: string) => Promise<any[]>
}

/** Global run-list endpoint does not exist yet (M04-RES-002); the list uses the
 *  selected project context plus the registered offline Hero row. */
export const RESULTS_LIST_CAPABILITY_GAP =
  '结果按当前项目与已注册离线来源汇总。'

export async function loadResultsList(
  selectedProject: string | undefined,
  dependencies: ResultsListDependencies,
): Promise<ResultsListComposition> {
  let projects: Array<{ projectId: string; name: string; runCount: number }> = []
  try {
    const raw = await dependencies.listProjects()
    projects = (Array.isArray(raw) ? raw : []).map((project: Record<string, any>) => ({
      projectId: String(project.project_id || ''),
      name: String(project.name || project.project_id || '未命名项目'),
      runCount: Number(project.run_count || 0) || 0,
    }))
  } catch (error) {
    const problem = sourceProblem(error)
    return {
      rows: [],
      projects,
      selectedProject: '',
      problem,
      backendUnavailable: problem.kind === 'network',
      gap: RESULTS_LIST_CAPABILITY_GAP,
    }
  }
  const projectId = selectedProject || projects[0]?.projectId || ''
  if (!projectId) {
    return {
      rows: normalizeListPageRows([], true),
      projects,
      selectedProject: '',
      problem: null,
      backendUnavailable: false,
      gap: RESULTS_LIST_CAPABILITY_GAP,
    }
  }
  try {
    const runs = await dependencies.listProjectRuns(projectId)
    const project = projects.find((item) => item.projectId === projectId)
    if (project) project.runCount = Array.isArray(runs) ? runs.length : 0
    return {
      rows: normalizeListPageRows(runs, true),
      projects,
      selectedProject: projectId,
      problem: null,
      backendUnavailable: false,
      gap: RESULTS_LIST_CAPABILITY_GAP,
    }
  } catch (error) {
    const problem = sourceProblem(error)
    return {
      rows: [],
      projects,
      selectedProject: projectId,
      problem,
      backendUnavailable: problem.kind === 'network',
      gap: RESULTS_LIST_CAPABILITY_GAP,
    }
  }
}
