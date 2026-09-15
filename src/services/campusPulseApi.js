import { campusPulseHttp as client, isApiProblem, unwrapApiEnvelope } from '../campus-pulse/api/http'

function unwrap(response) {
  return unwrapApiEnvelope(response)
}

export async function getWorkbenchHealth() {
  return unwrap(await client.get('/health'))
}

export async function getWorkbenchReadiness() {
  return unwrap(await client.get('/readiness'))
}

export async function getWorkbenchOverview() {
  return unwrap(await client.get('/overview'))
}

export async function getForumTwinV2AgentWorld() {
  return unwrap(await client.get('/forum-twin-v2/agent-world'))
}

export async function getForumTwinV2AgentDossier(displayId, projectId = null) {
  if (!displayId) throw new TypeError('displayId is required')
  return unwrap(
    await client.get(
      `/forum-twin-v2/agent-world/agents/${encodeURIComponent(displayId)}`,
      { params: projectId ? { project_id: projectId } : {} },
    ),
  )
}

export async function saveForumTwinV2AgentProfileOverride(projectId, displayId, payload) {
  if (!projectId || !displayId) throw new TypeError('projectId and displayId are required')
  return unwrap(
    await client.put(
      `/projects/${encodeURIComponent(projectId)}/forum-twin-v2/agents/${encodeURIComponent(displayId)}/profile-override`,
      payload,
    ),
  )
}

export async function restoreForumTwinV2AgentProfile(projectId, displayId) {
  if (!projectId || !displayId) throw new TypeError('projectId and displayId are required')
  return unwrap(
    await client.delete(
      `/projects/${encodeURIComponent(projectId)}/forum-twin-v2/agents/${encodeURIComponent(displayId)}/profile-override`,
    ),
  )
}

export async function getProviderConfig() {
  return unwrap(await client.get('/provider-config'))
}

export async function saveProviderConfig(payload) {
  return unwrap(await client.put('/provider-config', payload))
}

export async function testProviderConfig() {
  return unwrap(await client.post('/provider-config/test'))
}

export async function clearProviderConfig() {
  return unwrap(await client.delete('/provider-config'))
}

export async function getCenturyGymDemoStatus() {
  return unwrap(await client.get('/live-demos/century-gym/status'))
}

export async function getCenturyGymSocialWorld() {
  return unwrap(await client.get('/live-demos/century-gym/social-world'))
}

export async function getResourcePrivateChannelSummary() {
  return unwrap(await client.get('/cases/resource-allocation/private-channel-summary'))
}

export async function startCenturyGymDemo() {
  return unwrap(await client.post('/live-demos/century-gym/start'))
}

export async function prepareForumLiveVignette(
  scenarioId,
  runScope = 'quick_closed_loop',
) {
  return unwrap(await client.post('/live-vignettes/prepare', {
    scenario_id: scenarioId,
    run_scope: runScope,
  }))
}

export async function getForumLiveVignetteStatus(sessionId) {
  return unwrap(await client.get(`/live-vignettes/${encodeURIComponent(sessionId)}/status`))
}

export async function startForumLiveVignette(sessionId, payload) {
  return unwrap(await client.post(`/live-vignettes/${encodeURIComponent(sessionId)}/start`, payload))
}

export async function resolveForumLiveVignetteUnknown(sessionId, payload) {
  return unwrap(await client.post(
    `/live-vignettes/${encodeURIComponent(sessionId)}/resolve-unknown`,
    payload,
  ))
}

export async function getLiveRuntimeCapability(runId = null) {
  return unwrap(
    await client.get('/live-runtime/capability', {
      params: runId ? { run_id: runId } : {},
    }),
  )
}

export async function listProjects() {
  return unwrap(await client.get('/projects'))
}

export async function createProject(payload) {
  return unwrap(await client.post('/projects', payload))
}

export async function bootstrapProject(projectId) {
  return unwrap(await client.post(`/projects/${encodeURIComponent(projectId)}/bootstrap`))
}

export async function listProjectScenarios(projectId) {
  return unwrap(await client.get(`/projects/${encodeURIComponent(projectId)}/scenarios`))
}

export async function listProjectPolicies(projectId) {
  return unwrap(await client.get(`/projects/${encodeURIComponent(projectId)}/policies`))
}

export async function listProjectRuns(projectId) {
  return unwrap(await client.get(`/projects/${encodeURIComponent(projectId)}/runs`))
}

export async function listProjectEvidence(projectId) {
  return unwrap(
    await client.get(
      `/projects/${encodeURIComponent(projectId)}/evidence-snapshots`,
    ),
  )
}

export async function listSensingReleases() {
  return unwrap(await client.get('/sensing/releases'))
}

export async function registerSensingRelease(releaseKey) {
  return unwrap(
    await client.post(
      `/sensing/releases/${encodeURIComponent(releaseKey)}/register`,
    ),
  )
}

export async function listSensingSnapshots() {
  return unwrap(await client.get('/sensing-snapshots'))
}

export async function getSensingSnapshot(snapshotId) {
  return unwrap(
    await client.get(
      `/sensing-snapshots/${encodeURIComponent(snapshotId)}`,
    ),
  )
}

export async function listProjectSensingSnapshots(projectId) {
  return unwrap(
    await client.get(
      `/projects/${encodeURIComponent(projectId)}/sensing-snapshots`,
    ),
  )
}

export async function attachProjectSensingSnapshot(projectId, snapshotId) {
  return unwrap(
    await client.post(
      `/projects/${encodeURIComponent(projectId)}/sensing-snapshots/${
        encodeURIComponent(snapshotId)
      }/attach`,
    ),
  )
}

export async function getProjectSensingState(projectId) {
  return unwrap(
    await client.get(
      `/projects/${encodeURIComponent(projectId)}/sensing-state`,
    ),
  )
}

export async function activateProjectSensingSnapshot(
  projectId,
  snapshotId,
  expectedStateVersion,
) {
  return unwrap(
    await client.put(
      `/projects/${encodeURIComponent(projectId)}/sensing-state/active`,
      {
        snapshot_id: snapshotId,
        expected_state_version: expectedStateVersion,
      },
    ),
  )
}

export async function planProjectRun(projectId, payload, idempotencyKey) {
  return unwrap(
    await client.post(
      `/projects/${encodeURIComponent(projectId)}/runs`,
      payload,
      {
        // Freezing a 1,000-Agent work contract is intentionally heavier than
        // ordinary reads. Keep the global 12 s guard, but give this one
        // idempotent operation enough time to return its canonical contract.
        timeout: 60_000,
        headers: idempotencyKey
          ? { 'Idempotency-Key': idempotencyKey }
          : {},
      },
    ),
  )
}

export async function enqueueRun(runId, payload, idempotencyKey) {
  return unwrap(
    await client.post(
      `/runs/${encodeURIComponent(runId)}/enqueue`,
      payload,
      {
        headers: idempotencyKey
          ? { 'Idempotency-Key': idempotencyKey }
          : {},
      },
    ),
  )
}

export async function getRunRuntime(runId) {
  return unwrap(
    await client.get(`/runs/${encodeURIComponent(runId)}/runtime`),
  )
}

export async function listRunRuntimeEvents(
  runId,
  { afterSequence = 0, limit = 50 } = {},
) {
  return unwrap(
    await client.get(
      `/runs/${encodeURIComponent(runId)}/events`,
      {
        params: {
          after_sequence: afterSequence,
          limit,
        },
      },
    ),
  )
}

export async function getRunAggregateResult(runId) {
  return unwrap(
    await client.get(`/runs/${encodeURIComponent(runId)}/result`),
  )
}

export async function listRunTicks(runId) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/ticks`))
}

export async function getRunTickWorld(runId, tick) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/ticks/${tick}/world`))
}

export async function getRunTickForum(runId, tick) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/ticks/${tick}/forum`))
}

export async function getRunTickPrivateConversations(runId, tick) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/ticks/${tick}/private-conversations`))
}

export async function getRunPrivateConversation(runId, conversationId) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/private-conversations/${encodeURIComponent(conversationId)}`))
}

export async function getRunAgent(runId, displayId) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/agents/${encodeURIComponent(displayId)}`))
}

export async function getRunGovernance(runId) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/governance`))
}

export async function getRunRisks(runId) {
  return unwrap(await client.get(`/runs/${encodeURIComponent(runId)}/risks`))
}

export async function getRunGovernanceVisualizationManifest(runId) {
  if (!runId) throw new TypeError('runId is required')
  const response = await client.get(
    `/runs/${encodeURIComponent(runId)}/visualization/manifest`,
  )
  const payload = response?.data?.data || response?.data
  if (!payload || payload.error) {
    throw new Error(
      payload?.error?.message || '可视化 manifest 请求失败',
    )
  }
  const contentSha256 = (
    response.headers?.['x-content-sha256']
    || String(response.headers?.etag || '').replace(/^W\//, '').replaceAll('"', '')
  )
  return { payload, contentSha256 }
}

export async function getRunGovernanceVisualizationFrames(runId) {
  if (!runId) throw new TypeError('runId is required')
  const response = await client.get(
    `/runs/${encodeURIComponent(runId)}/visualization/frames`,
    {
      headers: { Accept: 'application/octet-stream' },
      responseType: 'arraybuffer',
    },
  )
  if (response?.data?.error) {
    throw new Error(response.data.error.message || '可视化帧请求失败')
  }
  return response.data
}

const AGGREGATE_REPORT_FORMATS = new Set(['json', 'html'])

export function getRunAggregateReportRoute(runId, format) {
  const normalizedFormat = String(format || '').toLowerCase()
  if (!runId) throw new TypeError('runId is required')
  if (!AGGREGATE_REPORT_FORMATS.has(normalizedFormat)) {
    throw new TypeError('aggregate report format must be json or html')
  }
  return `/runs/${encodeURIComponent(runId)}/reports/aggregate.${
    normalizedFormat
  }`
}

export async function downloadRunAggregateReport(runId, format) {
  const normalizedFormat = String(format || '').toLowerCase()
  const accept = normalizedFormat === 'html'
    ? 'text/html; charset=utf-8'
    : 'application/json; charset=utf-8'
  return client.get(
    getRunAggregateReportRoute(runId, normalizedFormat),
    {
      headers: { Accept: accept },
      responseType: 'blob',
    },
  )
}

export async function cancelRun(runId, payload) {
  return unwrap(
    await client.post(
      `/runs/${encodeURIComponent(runId)}/cancel`,
      payload,
    ),
  )
}

export function readableApiError(error) {
  if (isApiProblem(error)) return `${error.summary}：${error.detail}`
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  if (error?.code === 'ECONNABORTED') return '工作台服务响应超时'
  if (!error?.response) return 'CampusPulse 后端服务未连接'
  if (error.response.status === 404) {
    return 'CampusPulse 后端 API 未启动，或当前预览没有配置 /api 代理'
  }
  if (error.response.status >= 500) return 'CampusPulse 后端服务暂不可用'
  return error.message || '请求失败'
}
export async function getProject(projectId) {
  return unwrap(
    await client.get(`/projects/${encodeURIComponent(projectId)}`),
  )
}

export async function updateProject(projectId, payload) {
  return unwrap(
    await client.patch(
      `/projects/${encodeURIComponent(projectId)}`,
      payload,
    ),
  )
}

export async function getRun(runId) {
  return unwrap(
    await client.get(`/runs/${encodeURIComponent(runId)}`),
  )
}

export async function listEvidenceSnapshots() {
  return unwrap(await client.get('/evidence-snapshots'))
}

export async function getEvidenceSnapshot(snapshotId) {
  return unwrap(
    await client.get(
      `/evidence-snapshots/${encodeURIComponent(snapshotId)}`,
    ),
  )
}

export async function attachProjectEvidenceSnapshot(projectId, snapshotId) {
  return unwrap(
    await client.post(
      `/projects/${encodeURIComponent(projectId)}/evidence-snapshots/${
        encodeURIComponent(snapshotId)
      }/attach`,
      { make_primary: true },
    ),
  )
}

export async function createProjectScenario(projectId, payload) {
  return unwrap(
    await client.post(
      `/projects/${encodeURIComponent(projectId)}/scenarios`,
      payload,
    ),
  )
}

export async function createProjectPolicy(projectId, payload) {
  return unwrap(
    await client.post(
      `/projects/${encodeURIComponent(projectId)}/policies`,
      payload,
    ),
  )
}

export async function listEvidenceReleases() {
  return unwrap(await client.get('/evidence/releases'))
}

export async function registerEvidenceRelease(releaseKey) {
  return unwrap(
    await client.post(
      `/evidence/releases/${encodeURIComponent(releaseKey)}/register`,
    ),
  )
}
