import { apiRequest, createApiProblem, isApiProblem, normalizeApiProblem } from '../api/http.ts'
import type { ApiProblem } from '../contracts/api.ts'
import type { ResultSourceDescriptor, SourceState } from '../contracts/source.ts'
import { loadForumTwin } from '../../services/forumTwin.ts'
import { loadLectureHero } from '../../services/lectureHero.ts'
import { loadResourcePolicyHero } from '../../services/resourcePolicyHero.ts'
import type { ForumTwinLoaded } from '../contracts/forumTwin.ts'
import {
  loadForumTwinV2,
  type ForumTwinV2Loaded,
} from '../../services/forumTwinV2.ts'
import type { ResultViewModel } from '../domain/viewModels.ts'
import { liveApiAdapter } from '../adapters/liveApiAdapter.ts'
import { auditedReplayAdapter } from '../adapters/auditedReplayAdapter.ts'
import { HERO_SOURCE_KEY, LECTURE_HERO_SOURCE_KEY, LIVE_SOURCE_KEY, getSourceDescriptor } from './registry.ts'

export type ResolveState =
  | { status: 'idle' }
  | { status: 'loading'; source: ResultSourceDescriptor }
  | { status: 'success'; value: ResultViewModel; source: SourceState }
  | { status: 'partial'; value: ResultViewModel; problems: ApiProblem[] }
  | { status: 'not_ready'; runId: string; problem: ApiProblem }
  | { status: 'error'; problem: ApiProblem; requestedSource: string }

export interface ResultResolverDependencies {
  loadHero: () => Promise<ForumTwinLoaded>
  loadLectureHero: () => Promise<ForumTwinLoaded>
  loadLive: (runId: string) => Promise<ForumTwinLoaded | ForumTwinV2Loaded>
}

export function sourceProblem(error: unknown): ApiProblem {
  if (isApiProblem(error)) return error
  if (error instanceof Error) {
    const httpStatus = Number(error.message.match(/HTTP\s+(\d{3})/i)?.[1] || 0)
    if (httpStatus) {
      return normalizeApiProblem({
        isAxiosError: true,
        response: { status: httpStatus, data: {} },
      })
    }
    if ((error as { isAxiosError?: boolean }).isAxiosError) {
      return normalizeApiProblem(error)
    }
    if (/failed to fetch|fetch failed|networkerror|load failed/i.test(error.message)) {
      return normalizeApiProblem({ isAxiosError: true, code: 'ERR_NETWORK' })
    }
    const verification = /sha|hash|manifest|digest|verification/i.test(error.message)
    return createApiProblem({
      kind: verification ? 'verification' : 'contract',
      code: verification ? 'verification_failed' : 'invalid_result_contract',
      summary: verification ? '证据校验失败' : '结果契约无法确认',
      detail: verification
        ? '结果正文已隐藏；请检查 manifest 与哈希链。'
        : '响应结构不符合 ForumTwin 公开结果契约，当前数据不会显示。',
      retryable: false,
      action: 'inspect_evidence',
      sourceImpact: 'unverified',
    })
  }
  return normalizeApiProblem(error)
}

export class ResultResolver {
  private generation = 0
  private readonly dependencies: ResultResolverDependencies

  constructor(dependencies: Partial<ResultResolverDependencies> = {}) {
    this.dependencies = {
      loadHero: loadResourcePolicyHero,
      loadLectureHero,
      loadLive: async (runId) => {
        const run = await apiRequest<Record<string, unknown>>({
          method: 'GET',
          url: `/runs/${encodeURIComponent(runId)}`,
        })
        if (run.execution_mode === 'llm_forum_twin_v2') return loadForumTwinV2(runId)
        await apiRequest({ method: 'GET', url: '/health' })
        return loadForumTwin(runId)
      },
      ...dependencies,
    }
  }

  dispose() {
    this.generation += 1
  }

  async resolve(sourceKey: string, runId?: string): Promise<ResolveState> {
    const generation = ++this.generation
    const descriptor = getSourceDescriptor(sourceKey)
    if (!descriptor) {
      return { status: 'error', requestedSource: sourceKey, problem: createApiProblem({ kind: 'contract', code: 'unknown_source', summary: '请求的数据来源未登记', detail: '请选择来源列表中明确登记的来源。', retryable: false, action: 'none', sourceImpact: 'unavailable' }) }
    }
    if (sourceKey === LIVE_SOURCE_KEY && !runId) {
      return { status: 'error', requestedSource: sourceKey, problem: createApiProblem({ kind: 'contract', code: 'run_id_required', summary: 'Live API 来源缺少运行标识', detail: '请从运行列表选择一个结果，或打开已登记的审计案例。', retryable: false, action: 'return_to_runs', sourceImpact: 'unavailable' }) }
    }
    try {
      const loaded = sourceKey === HERO_SOURCE_KEY
        ? await this.dependencies.loadHero()
        : sourceKey === LECTURE_HERO_SOURCE_KEY
          ? await this.dependencies.loadLectureHero()
          : await this.dependencies.loadLive(runId!)
      if (generation !== this.generation) {
        return { status: 'error', requestedSource: sourceKey, problem: createApiProblem({ kind: 'aborted', code: 'stale_response', summary: '已忽略过期响应', detail: '较新的来源请求已经生效。', retryable: true, action: 'retry', sourceImpact: 'unchanged' }) }
      }
      const value = sourceKey === HERO_SOURCE_KEY
        ? auditedReplayAdapter.result('hero', loaded as ForumTwinLoaded)
        : sourceKey === LECTURE_HERO_SOURCE_KEY
          ? auditedReplayAdapter.result('lecture', loaded as ForumTwinLoaded)
          : liveApiAdapter.result(loaded, runId!)
      return { status: 'success', value, source: value.source }
    } catch (error) {
      if (generation !== this.generation) {
        return { status: 'error', requestedSource: sourceKey, problem: createApiProblem({ kind: 'aborted', code: 'stale_response', summary: '已忽略过期响应', detail: '较新的来源请求已经生效。', retryable: true, action: 'retry', sourceImpact: 'unchanged' }) }
      }
      const problem = sourceProblem(error)
      if (sourceKey === LIVE_SOURCE_KEY && problem.status === 404) {
        return { status: 'not_ready', runId: runId!, problem }
      }
      return { status: 'error', requestedSource: sourceKey, problem }
    }
  }
}
