import type { ResultSourceDescriptor } from '../contracts/source.ts'

export const HERO_SOURCE_KEY = 'offline-hero'
export const HERO_RESULT_KEY = 'resource-policy-r1'
export const LECTURE_HERO_SOURCE_KEY = 'offline-lecture'
export const LECTURE_HERO_RESULT_KEY = 'lecture-open-choice-r4'
export const LIVE_SOURCE_KEY = 'live-api'

// Resolution never falls through implicitly. A failed Live request remains an
// error until the user selects the next eligible registered source.
export const sourceResolutionPriority = Object.freeze([
  LIVE_SOURCE_KEY,
  HERO_SOURCE_KEY,
  LECTURE_HERO_SOURCE_KEY,
])

const descriptors: Readonly<Record<string, ResultSourceDescriptor>> = Object.freeze({
  [HERO_SOURCE_KEY]: Object.freeze({
    key: HERO_SOURCE_KEY,
    label: '住宿资源分配治理案例',
    mode: 'offline_hero',
    immutable: true,
    resultUrl: '/campus-pulse-data/resource-policy-live-r1.json',
    hashUrl: '/campus-pulse-data/resource-policy-live-r1.sha256',
    expectedSchema: ['campus-pulse-resource-allocation-sandbox-result-v1'],
    declaredPublication: false,
    boundaries: [
      '单场景、单固定随机种子、Tick 3–10 的真实 LLM 治理预演。',
    ],
  }),
  [LECTURE_HERO_SOURCE_KEY]: Object.freeze({
    key: LECTURE_HERO_SOURCE_KEY,
    label: '讲座辱骂事件治理预演',
    mode: 'offline_hero',
    immutable: true,
    resultUrl: '/campus-pulse-data/lecture-open-choice-r4.json',
    hashUrl: '/campus-pulse-data/lecture-open-choice-r4.sha256',
    expectedSchema: ['campus-pulse-forum-hero-result-v1'],
    declaredPublication: false,
    boundaries: [
      '单场景、单固定随机种子、Natural/D、Tick 3–10 的真实 LLM 开放选择治理预演。',
      'D 形成 4 条居民对治理消息的严格直接承接；没有形成完整纠错接受链或求助服务闭环。',
    ],
  }),
  [LIVE_SOURCE_KEY]: Object.freeze({
    key: LIVE_SOURCE_KEY,
    label: '运行 API 结果',
    mode: 'live_api',
    immutable: false,
    resultUrl: '/api/campus-pulse/v1/runs/{runId}/result',
    manifestUrl: '/api/campus-pulse/v1/runs/{runId}/forum-twin/manifest',
    expectedSchema: [
      'campus-pulse-forum-twin-result-v6',
      'campus-pulse-live-aggregate-result-v7',
    ],
    declaredPublication: 'server',
    boundaries: ['结果范围、发布门禁与来源信息以服务器返回的已验证 manifest 或 result-v7 摘要为准。'],
  }),
})

export function getSourceDescriptor(key: string): ResultSourceDescriptor | null {
  return descriptors[key] || null
}

export function listSourceDescriptors(): ResultSourceDescriptor[] {
  return Object.values(descriptors)
}

export function sourceDescriptorsForRun(runId?: string): ResultSourceDescriptor[] {
  return listSourceDescriptors().map((descriptor) => descriptor.key === LIVE_SOURCE_KEY
    ? { ...descriptor, runId }
    : descriptor)
}
