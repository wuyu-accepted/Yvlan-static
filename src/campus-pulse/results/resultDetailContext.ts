import type { InjectionKey, Ref } from 'vue'
import type { ResolveState } from '../source/resultResolver.ts'
import type { ResultViewModel } from '../domain/viewModels.ts'
import type { ResultAnalysisVM } from './resultsAnalysis.ts'

export interface ResultDetailContext {
  state: Ref<ResolveState>
  analysis: Ref<ResultAnalysisVM | null>
  result: Ref<ResultViewModel | null>
  request: Ref<{ sourceKey: string; runId?: string; resultKey: string }>
  reload: () => void
}

export const RESULT_DETAIL_CONTEXT: InjectionKey<ResultDetailContext> = Symbol('result-detail-context')
