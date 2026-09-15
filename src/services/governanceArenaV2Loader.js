import {
  getRunAggregateResult,
  getRunGovernanceVisualizationFrames,
  getRunGovernanceVisualizationManifest,
} from './campusPulseApi'
import {
  createParticleFrameReader,
  normalizeGovernanceArenaV2,
  validateGovernanceVisualizationV2,
  verifyGovernanceVisualizationBinary,
  verifyGovernanceVisualizationManifest,
} from './governanceArenaV2Adapter'

const OFFLINE_RESULT_FILE = 'governance-arena-v2.json'
const OFFLINE_MANIFEST_FILE = 'governance-arena-v2.visualization.json'
const OFFLINE_MANIFEST_HASH_FILE = 'governance-arena-v2.visualization.sha256'
const OFFLINE_BINARY_FILE = 'governance-arena-v2.frames.bin'

function assetUrl(file) {
  return `${import.meta.env.BASE_URL}campus-pulse-data/${file}`
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`${label}响应异常：HTTP ${response.status}`)
  try {
    return await response.json()
  } catch {
    throw new Error(`${label}不是有效 JSON`)
  }
}

async function fetchBinary(url, label) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/octet-stream' },
  })
  if (!response.ok) throw new Error(`${label}响应异常：HTTP ${response.status}`)
  return response.arrayBuffer()
}

async function fetchSha256(url, label) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'text/plain' },
  })
  if (!response.ok) throw new Error(`${label}响应异常：HTTP ${response.status}`)
  const value = (await response.text()).trim()
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label}格式非法`)
  return value
}

export async function loadGovernanceArenaV2(runId = '') {
  let payload
  let manifestPayload
  let manifestSha256
  let binary
  let source

  if (runId) {
    const [resultPayload, manifestResponse, framePayload] = await Promise.all([
      getRunAggregateResult(runId),
      getRunGovernanceVisualizationManifest(runId),
      getRunGovernanceVisualizationFrames(runId),
    ])
    // The shared runtime endpoint returns result metadata plus the sealed
    // aggregate under `result`; offline mode reads that aggregate directly.
    // Accept only those two explicit shapes so an API error envelope cannot
    // be mistaken for Governance Arena data.
    payload = resultPayload?.result || resultPayload
    manifestPayload = manifestResponse.payload
    manifestSha256 = manifestResponse.contentSha256
    binary = framePayload
    source = {
      mode: 'api',
      label: `RUN ${runId}`,
      run_id: runId,
    }
  } else {
    payload = await fetchJson(
      assetUrl(OFFLINE_RESULT_FILE),
      '离线 v2 结果',
    )
    ;[manifestPayload, manifestSha256] = await Promise.all([
      fetchJson(
        assetUrl(OFFLINE_MANIFEST_FILE),
        '离线可视化 manifest',
      ),
      fetchSha256(
        assetUrl(OFFLINE_MANIFEST_HASH_FILE),
        '离线 manifest 哈希',
      ),
    ])
    const normalized = normalizeGovernanceArenaV2(payload)
    const manifest = validateGovernanceVisualizationV2(
      manifestPayload,
      normalized.aggregate,
    )
    await verifyGovernanceVisualizationManifest(manifest, manifestSha256)
    binary = await fetchBinary(
      assetUrl(OFFLINE_BINARY_FILE),
      '离线量化粒子帧',
    )
    await verifyGovernanceVisualizationBinary(binary, manifest)
    return {
      ...normalized,
      manifest,
      manifestSha256,
      frameReader: createParticleFrameReader(binary, manifest),
      source: {
        mode: 'offline',
        label: 'FROZEN OFFLINE RELEASE',
        run_id: null,
      },
    }
  }

  const normalized = normalizeGovernanceArenaV2(payload)
  const manifest = validateGovernanceVisualizationV2(
    manifestPayload,
    normalized.aggregate,
  )
  await verifyGovernanceVisualizationManifest(manifest, manifestSha256)
  await verifyGovernanceVisualizationBinary(binary, manifest)
  return {
    ...normalized,
    manifest,
    manifestSha256,
    frameReader: createParticleFrameReader(binary, manifest),
    source,
  }
}

export {
  OFFLINE_MANIFEST_FILE,
  OFFLINE_MANIFEST_HASH_FILE,
  OFFLINE_BINARY_FILE,
  OFFLINE_RESULT_FILE,
}
