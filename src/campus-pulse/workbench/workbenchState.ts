import type { ApiProblem } from '../contracts/api.ts'

/**
 * M06 Project & Run Workbench — URL state.
 * Object identity (project / run) is shareable and refresh-restorable;
 * view state (section, run detail tab, filters) is kept only when it
 * survives navigation meaningfully.
 */

export type WorkbenchSection = 'overview' | 'evidence' | 'scenarios' | 'policies' | 'plan' | 'runs'
export type RunDetailTab = 'monitor' | 'events' | 'contract'

export const WORKBENCH_SECTIONS: WorkbenchSection[] = ['overview', 'evidence', 'scenarios', 'policies', 'plan', 'runs']
export const DEFAULT_SECTION: WorkbenchSection = 'overview'
export const DEFAULT_RUN_TAB: RunDetailTab = 'monitor'

export interface WorkbenchWorkspaceState {
  project?: string
  section: WorkbenchSection
  run?: string
  runTab: RunDetailTab
  q: string
  runStatus: string
}

function firstString(query: Record<string, unknown>, key: string): string {
  const value = query[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function sectionFromQuery(value: unknown): WorkbenchSection {
  return WORKBENCH_SECTIONS.includes(value as WorkbenchSection)
    ? value as WorkbenchSection
    : DEFAULT_SECTION
}

export function runTabFromQuery(value: unknown): RunDetailTab {
  return value === 'events' || value === 'contract' ? value : DEFAULT_RUN_TAB
}

export function workspaceFromQuery(query: Record<string, unknown>): WorkbenchWorkspaceState {
  return {
    project: firstString(query, 'project') || undefined,
    section: sectionFromQuery(query.section),
    run: firstString(query, 'run') || undefined,
    runTab: runTabFromQuery(query.run_tab),
    q: firstString(query, 'q'),
    runStatus: firstString(query, 'status'),
  }
}

export function workspaceToQuery(state: WorkbenchWorkspaceState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.project) query.project = state.project
  if (state.section !== DEFAULT_SECTION) query.section = state.section
  if (state.run) query.run = state.run
  if (state.runTab !== DEFAULT_RUN_TAB) query.run_tab = state.runTab
  if (state.q) query.q = state.q
  if (state.runStatus) query.status = state.runStatus
  return query
}

export function workbenchLocation(state: WorkbenchWorkspaceState) {
  return { name: 'campus-pulse-workbench', query: workspaceToQuery(state) }
}

export function projectSectionLocation(projectId: string, section: WorkbenchSection) {
  return {
    name: 'campus-pulse-workbench',
    query: { project: projectId, section: section === DEFAULT_SECTION ? undefined : section },
  }
}

export function runLocation(projectId: string, runId: string) {
  return {
    name: 'campus-pulse-workbench',
    query: { project: projectId, section: 'runs', run: runId },
  }
}

export function apiProblemKey(problem: ApiProblem | null | undefined): string {
  if (!problem) return ''
  return [problem.kind, problem.code, problem.status ?? ''].join(':')
}
