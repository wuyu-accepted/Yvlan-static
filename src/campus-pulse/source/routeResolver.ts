import {
  HERO_RESULT_KEY,
  HERO_SOURCE_KEY,
  LECTURE_HERO_RESULT_KEY,
  LECTURE_HERO_SOURCE_KEY,
  LIVE_SOURCE_KEY,
} from './registry.ts'

const RUN_ID = /^run_[0-9a-f]{24}$/

export function canonicalResultLocation({ source, resultKey }: { source?: unknown; resultKey?: unknown }) {
  const requested = Array.isArray(source) ? source[0] : source
  const key = Array.isArray(resultKey) ? resultKey[0] : resultKey
  if (requested === LIVE_SOURCE_KEY && typeof key === 'string' && RUN_ID.test(key)) {
    return { sourceKey: LIVE_SOURCE_KEY, runId: key, resultKey: key, needsReplace: false }
  }
  if (requested === HERO_SOURCE_KEY && key === HERO_RESULT_KEY) {
    return { sourceKey: HERO_SOURCE_KEY, runId: undefined, resultKey: HERO_RESULT_KEY, needsReplace: false }
  }
  if (requested === LECTURE_HERO_SOURCE_KEY && key === LECTURE_HERO_RESULT_KEY) {
    return { sourceKey: LECTURE_HERO_SOURCE_KEY, runId: undefined, resultKey: LECTURE_HERO_RESULT_KEY, needsReplace: false }
  }
  if (typeof requested === 'string' && requested) {
    return {
      sourceKey: requested,
      runId: undefined,
      resultKey: typeof key === 'string' ? key : '',
      needsReplace: false,
    }
  }
  return { sourceKey: HERO_SOURCE_KEY, runId: undefined, resultKey: HERO_RESULT_KEY, needsReplace: true }
}

export function legacyRunResultLocation(runId: unknown) {
  const value = Array.isArray(runId) ? runId[0] : runId
  return typeof value === 'string' && RUN_ID.test(value)
    ? { name: 'campus-pulse-result-summary', params: { resultKey: value }, query: { source: LIVE_SOURCE_KEY }, replace: true }
    : null
}
