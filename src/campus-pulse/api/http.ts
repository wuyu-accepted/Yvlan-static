import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ApiFieldError, ApiProblem } from '../contracts/api.ts'

const SAFE_CODES = new Set([
  'RequestValidationError', 'WorkbenchConflictError', 'WorkbenchNotFoundError',
  'WorkbenchPreconditionError', 'WorkbenchError',
])

function fieldErrors(detail: any): ApiFieldError[] {
  const issues = Array.isArray(detail?.issues) ? detail.issues : Array.isArray(detail) ? detail : []
  return issues.map((issue: any) => ({
    field: Array.isArray(issue.location || issue.loc)
      ? (issue.location || issue.loc).filter((part: unknown) => part !== 'body').join('.')
      : '',
    message: '字段不符合请求契约',
    code: typeof issue.code === 'string' ? issue.code : undefined,
  })).filter((issue: ApiFieldError) => (
    (issue.field || issue.code)
    && !/(api.?key|secret|prompt|raw.?text|private|credential|access.?token|bearer)/i.test(issue.field)
  ))
}

function problemMessage(status?: number) {
  if (status === 400) return ['请求不符合契约', '请检查输入后重试。', false, 'correct_input'] as const
  if (status === 401 || status === 403) return ['当前操作未获授权', '请确认访问权限或返回只读视图。', false, 'none'] as const
  if (status === 404) return ['请求的运行或证据不存在', '请返回运行列表确认标识，或选择已登记的离线结果。', false, 'return_to_runs'] as const
  if (status === 409) return ['服务器状态已发生变化', '请刷新最新状态后再提交操作。', true, 'retry'] as const
  if (status === 412) return ['前置条件尚未满足', '请检查已激活证据、版本或运行状态。', false, 'correct_input'] as const
  if (status === 422) return ['配置未通过契约校验', '请修正标出的字段；系统不会自动降低正式运行配置。', false, 'correct_input'] as const
  if (status === 429) return ['请求过于频繁', '请稍后重试。', true, 'retry'] as const
  if (status && status >= 500) return ['后端暂时无法完成请求', '当前响应不能作为可信结果，请稍后重试。', true, 'retry'] as const
  return ['无法连接 CampusPulse 后端', '当前没有获得实时结果；请启动后端或显式选择已验证的离线结果。', true, 'start_backend'] as const
}

function safeBackendDetail(detail: any, backendCode: string, fallback: string): string {
  const message = typeof detail?.message === 'string' ? detail.message.trim() : ''
  if (
    backendCode === 'WorkbenchConflictError'
    && message === 'A project with this name already exists'
  ) {
    return '已存在同名项目，请修改项目名称。'
  }
  return fallback
}

export function createApiProblem(input: Partial<ApiProblem> & Pick<ApiProblem, 'kind' | 'code' | 'summary'>): ApiProblem {
  const problem = new Error(input.summary) as ApiProblem
  problem.name = 'ApiProblem'
  problem.kind = input.kind
  problem.code = input.code
  problem.status = input.status
  problem.summary = input.summary
  problem.detail = input.detail || input.summary
  problem.retryable = Boolean(input.retryable)
  problem.action = input.action || 'none'
  problem.requestId = input.requestId
  problem.fieldErrors = input.fieldErrors || []
  problem.sourceImpact = input.sourceImpact || 'unavailable'
  return problem
}

export function isApiProblem(value: unknown): value is ApiProblem {
  return value instanceof Error && (value as ApiProblem).name === 'ApiProblem'
}

export function normalizeApiProblem(error: unknown): ApiProblem {
  if (isApiProblem(error)) return error
  if (axios.isCancel(error) || (error instanceof Error && error.name === 'AbortError')) {
    return createApiProblem({ kind: 'aborted', code: 'request_aborted', summary: '请求已取消', detail: '请求已被新的操作取代。', retryable: true, action: 'retry', sourceImpact: 'unchanged' })
  }
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>
    const status = axiosError.response?.status
    const detail = axiosError.response?.data?.detail
    const [summary, fallbackDetail, retryable, action] = problemMessage(status)
    const backendCode = typeof detail?.code === 'string' && SAFE_CODES.has(detail.code)
      ? detail.code
      : status ? `http_${status}` : axiosError.code === 'ECONNABORTED' ? 'timeout' : 'backend_unavailable'
    const requestId = axiosError.response?.headers?.['x-request-id']
    return createApiProblem({
      kind: status ? 'http' : 'network',
      code: backendCode,
      status,
      summary: axiosError.code === 'ECONNABORTED' ? '后端响应超时' : summary,
      detail: axiosError.code === 'ECONNABORTED'
        ? fallbackDetail
        : safeBackendDetail(detail, backendCode, fallbackDetail),
      retryable: axiosError.code === 'ECONNABORTED' ? true : retryable,
      action: axiosError.code === 'ECONNABORTED' ? 'retry' : action,
      requestId: typeof requestId === 'string' ? requestId : undefined,
      fieldErrors: fieldErrors(detail),
      sourceImpact: 'unavailable',
    })
  }
  return createApiProblem({ kind: 'contract', code: 'unexpected_client_error', summary: '响应无法安全读取', detail: '客户端未能确认响应结构，当前数据不会显示为已验证。', retryable: false, action: 'inspect_evidence', sourceImpact: 'unverified' })
}

export const campusPulseHttp = axios.create({
  baseURL: '/api/campus-pulse/v1',
  timeout: 12_000,
  headers: { Accept: 'application/json' },
})

campusPulseHttp.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiProblem(error)),
)

export function unwrapApiEnvelope<T>(response: any): T {
  const body = response?.data
  if (!body || typeof body !== 'object' || !Object.prototype.hasOwnProperty.call(body, 'data')) {
    throw createApiProblem({ kind: 'contract', code: 'invalid_envelope', summary: '后端响应契约不完整', detail: '响应缺少 data envelope，当前内容不会被标记为可信。', retryable: false, action: 'inspect_evidence', sourceImpact: 'unverified' })
  }
  return body.data as T
}

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  return unwrapApiEnvelope<T>(await campusPulseHttp.request(config))
}
