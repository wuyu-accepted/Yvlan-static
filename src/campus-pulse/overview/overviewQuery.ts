import type { ApiProblem } from '../contracts/api.ts'
import type { ResolveState, ResultResolver } from '../source/resultResolver.ts'
import { sourceProblem } from '../source/resultResolver.ts'

export interface OverviewOperationsVM {
  counts: Record<string, number> | null
  evidenceBoundary: string
  readiness: Record<string, any> | null
  projects: Array<Record<string, any>>
  problems: ApiProblem[]
}

export interface OverviewComposition {
  result: ResolveState
  operations: OverviewOperationsVM
}

export interface OverviewQueryDependencies {
  getOverview: () => Promise<any>
  getReadiness: () => Promise<any>
  listProjects: () => Promise<any[]>
}

export async function loadOverviewComposition(
  resolver: ResultResolver,
  sourceKey: string,
  resultKey: string | undefined,
  dependencies: OverviewQueryDependencies,
): Promise<OverviewComposition> {
  const [resultOutcome, overviewOutcome, readinessOutcome, projectsOutcome] = await Promise.allSettled([
    resolver.resolve(sourceKey, sourceKey === 'live-api' ? resultKey : undefined),
    dependencies.getOverview(),
    dependencies.getReadiness(),
    dependencies.listProjects(),
  ])
  const problems: ApiProblem[] = []
  const takeProblem = (outcome: PromiseSettledResult<unknown>) => {
    if (outcome.status === 'rejected') problems.push(sourceProblem(outcome.reason))
  }
  takeProblem(overviewOutcome)
  takeProblem(readinessOutcome)
  takeProblem(projectsOutcome)
  const overview = overviewOutcome.status === 'fulfilled' ? overviewOutcome.value : null
  return {
    result: resultOutcome.status === 'fulfilled'
      ? resultOutcome.value
      : { status: 'error', requestedSource: sourceKey, problem: sourceProblem(resultOutcome.reason) },
    operations: {
      counts: overview ? Object.fromEntries(Object.entries(overview).filter(([, value]) => typeof value === 'number')) as Record<string, number> : null,
      evidenceBoundary: typeof overview?.evidence_boundary === 'string' ? overview.evidence_boundary : '',
      readiness: readinessOutcome.status === 'fulfilled' ? readinessOutcome.value : null,
      projects: projectsOutcome.status === 'fulfilled' && Array.isArray(projectsOutcome.value) ? projectsOutcome.value : [],
      problems,
    },
  }
}
