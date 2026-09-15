export type ApiProblemKind =
  | 'network'
  | 'http'
  | 'contract'
  | 'verification'
  | 'domain'
  | 'aborted'

export interface ApiFieldError {
  field: string
  message: string
  code?: string
}

export interface ApiProblem extends Error {
  name: 'ApiProblem'
  kind: ApiProblemKind
  code: string
  status?: number
  summary: string
  detail: string
  retryable: boolean
  action: 'retry' | 'start_backend' | 'inspect_evidence' | 'return_to_runs' | 'correct_input' | 'none'
  requestId?: string
  fieldErrors: ApiFieldError[]
  sourceImpact: 'unavailable' | 'unverified' | 'unchanged'
}

export interface ApiEnvelope<T> {
  data: T
}

export interface ProjectContract {
  project_id: string
  name: string
  governance_domain: string
  evaluation_mode: string
}

export interface RunContract {
  run_id: string
  project_id: string
  scenario_id: string
  execution_mode: string
  status: string
  token_budget: number
  input_fingerprint: string
  result_sha256?: string
}

export interface RunResultContract {
  result?: Record<string, unknown>
  [key: string]: unknown
}

export interface ForumTwinManifestContract {
  schema_version: string
  run_id: string
  result_sha256: string
  manifest_sha256?: string
}

export interface ForumTwinEndpointInventory {
  health: '/health'
  readiness: '/readiness'
  capability: '/live-runtime/capability'
  run: '/runs/{runId}'
  result: '/runs/{runId}/result'
  manifest: '/runs/{runId}/forum-twin/manifest'
  threads: '/runs/{runId}/forum-twin/threads'
  plan: '/projects/{projectId}/runs'
}

export const forumTwinEndpointInventory: ForumTwinEndpointInventory = Object.freeze({
  health: '/health',
  readiness: '/readiness',
  capability: '/live-runtime/capability',
  run: '/runs/{runId}',
  result: '/runs/{runId}/result',
  manifest: '/runs/{runId}/forum-twin/manifest',
  threads: '/runs/{runId}/forum-twin/threads',
  plan: '/projects/{projectId}/runs',
})
