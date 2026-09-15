import {
  getRunAggregateResult,
  getRunGovernanceVisualizationFrames,
  getRunGovernanceVisualizationManifest,
} from './campusPulseApi.js'
import {
  createParticleFrameReader,
  normalizeYuLanScale,
  validateYuLanVisualization,
  verifyYuLanAggregate,
  verifyYuLanVisualizationBinary,
  verifyYuLanVisualizationManifest,
} from './yuLanScaleAdapter.js'
import { loadGovernanceArenaV2 } from './governanceArenaV2Loader.js'

export const YULAN_OFFLINE_RESULT_FILE = 'yulan-scale-v1.json'
export const YULAN_OFFLINE_MANIFEST_FILE = 'yulan-scale-v1.visualization.json'
export const YULAN_OFFLINE_MANIFEST_HASH_FILE =
  'yulan-scale-v1.visualization.sha256'
export const YULAN_OFFLINE_BINARY_FILE = 'yulan-scale-v1.frames.bin'

class YuLanAssetUnavailableError extends Error {}

function assetUrl(file) {
  return `${import.meta.env.BASE_URL}campus-pulse-data/${file}`
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (response.status === 404) {
    throw new YuLanAssetUnavailableError(`${label} 尚未安装`)
  }
  if (!response.ok) throw new Error(`${label} 响应异常：HTTP ${response.status}`)
  try {
    const rawCanonicalJson = await response.text()
    const payload = JSON.parse(rawCanonicalJson)
    // Keep the exact response bytes private to the loader. Python's
    // canonical JSON retains distinctions such as 100.0 versus 100 that are
    // lost after JSON.parse, so offline verification must hash these bytes.
    Object.defineProperty(payload, '__rawCanonicalJson', {
      value: rawCanonicalJson,
      enumerable: false,
    })
    return payload
  } catch {
    throw new Error(`${label} 不是有效 JSON`)
  }
}

async function fetchBinary(url, label) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/octet-stream' },
  })
  if (response.status === 404) {
    throw new YuLanAssetUnavailableError(`${label} 尚未安装`)
  }
  if (!response.ok) throw new Error(`${label} 响应异常：HTTP ${response.status}`)
  return response.arrayBuffer()
}

async function fetchSha256(url, label) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'text/plain' },
  })
  if (response.status === 404) {
    throw new YuLanAssetUnavailableError(`${label} 尚未安装`)
  }
  if (!response.ok) throw new Error(`${label} 响应异常：HTTP ${response.status}`)
  const value = (await response.text()).trim()
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} 格式非法`)
  return value
}

async function seal(payload, manifestPayload, manifestSha256, binary, source) {
  const normalized = normalizeYuLanScale(payload)
  await verifyYuLanAggregate(normalized.aggregate)
  const manifest = validateYuLanVisualization(
    manifestPayload,
    normalized.aggregate,
  )
  await verifyYuLanVisualizationManifest(manifest, manifestSha256)
  await verifyYuLanVisualizationBinary(binary, manifest)
  const verifiedSource = (
    normalized.release.executionProvenance === 'emulator_only_development'
      ? {
          ...source,
          label: 'HASH-VERIFIED OFFLINE DEVELOPMENT RESULT',
        }
      : source
  )
  return {
    ...normalized,
    manifest,
    manifestSha256,
    frameReader: createParticleFrameReader(binary, manifest),
    source: verifiedSource,
  }
}

async function loadFormalOffline() {
  const [payload, manifestPayload, manifestSha256, binary] = await Promise.all([
    fetchJson(assetUrl(YULAN_OFFLINE_RESULT_FILE), 'YuLan-Scale 离线结果'),
    fetchJson(
      assetUrl(YULAN_OFFLINE_MANIFEST_FILE),
      'YuLan-Scale 可视化 manifest',
    ),
    fetchSha256(
      assetUrl(YULAN_OFFLINE_MANIFEST_HASH_FILE),
      'YuLan-Scale manifest 哈希',
    ),
    fetchBinary(
      assetUrl(YULAN_OFFLINE_BINARY_FILE),
      'YuLan-Scale 量化粒子帧',
    ),
  ])
  return seal(payload, manifestPayload, manifestSha256, binary, {
    mode: 'offline',
    label: 'YULAN-SCALE SEALED RELEASE',
    run_id: null,
  })
}

export async function loadYuLanScale(runId = '') {
  if (runId) {
    const [resultPayload, manifestResponse, binary] = await Promise.all([
      getRunAggregateResult(runId),
      getRunGovernanceVisualizationManifest(runId),
      getRunGovernanceVisualizationFrames(runId),
    ])
    return seal(
      resultPayload?.result || resultPayload,
      manifestResponse.payload,
      manifestResponse.contentSha256,
      binary,
      { mode: 'api', label: `RUN ${runId}`, run_id: runId },
    )
  }
  try {
    return await loadFormalOffline()
  } catch (formalError) {
    // Temporary migration bridge only. The sealed v2 asset may drive layout
    // development, but it remains non-publishable and reports zero LLM turns.
    if (!(formalError instanceof YuLanAssetUnavailableError)) {
      throw formalError
    }
    try {
      const legacy = await loadGovernanceArenaV2()
      const normalized = normalizeYuLanScale(legacy.aggregate)
      return {
        ...legacy,
        ...normalized,
        release: normalized.release,
        source: {
          ...legacy.source,
          label: 'LEGACY v2 · DEVELOPMENT COMPATIBILITY',
        },
      }
    } catch {
      throw formalError
    }
  }
}
