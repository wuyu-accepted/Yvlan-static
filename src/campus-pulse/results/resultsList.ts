import type { RouteLocationRaw } from 'vue-router'
import type { VerificationStatus } from '../contracts/source.ts'
import {
  HERO_RESULT_KEY,
  HERO_SOURCE_KEY,
  LECTURE_HERO_RESULT_KEY,
  LECTURE_HERO_SOURCE_KEY,
  LIVE_SOURCE_KEY,
} from '../source/registry.ts'

export const RESULT_PAGE_SIZE = 12

export interface ResultListRowVM {
  id: string
  resultKey: string
  sourceKey: string
  sourceLabel: string
  mode: 'live_api' | 'offline_hero'
  scenarioLabel: string
  status: string
  verification: VerificationStatus
  publicationEligible: boolean | null
  completedAt: string | null
  updatedAt: string | null
  population: number | null
  immutable: boolean
  href: RouteLocationRaw
}

export interface ResultFiltersVM {
  source: string
  status: string
  verification: string
  publication: string
  q: string
  sort: string
  page: number
}

export function defaultResultFilters(): ResultFiltersVM {
  return { source: 'all-registered', status: '', verification: '', publication: '', q: '', sort: '-created', page: 1 }
}

export function filtersFromQuery(query: Record<string, unknown>): ResultFiltersVM {
  const take = (key: string) => {
    const value = query[key]
    return typeof value === 'string' ? value : ''
  }
  const page = Number(take('page'))
  return {
    source: take('source') || 'all-registered',
    status: take('status'),
    verification: take('verification'),
    publication: take('publication'),
    q: take('q').trim(),
    sort: take('sort') || '-created',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export function filtersToQuery(filters: ResultFiltersVM) {
  const query: Record<string, string> = {}
  if (filters.source && filters.source !== 'all-registered') query.source = filters.source
  if (filters.status) query.status = filters.status
  if (filters.verification) query.verification = filters.verification
  if (filters.publication) query.publication = filters.publication
  if (filters.q) query.q = filters.q
  if (filters.sort !== '-created') query.sort = filters.sort
  if (filters.page !== 1) query.page = String(filters.page)
  return query
}

export function resultDetailLocation(row: Pick<ResultListRowVM, 'resultKey' | 'sourceKey'>, tab = 'summary', tick?: number): RouteLocationRaw {
  return {
    name: `campus-pulse-result-${tab}`,
    params: { resultKey: row.resultKey },
    query: {
      source: row.sourceKey,
      ...(typeof tick === 'number' ? { tick: String(tick) } : {}),
    },
  }
}

function sortRows(rows: ResultListRowVM[], sort: string): ResultListRowVM[] {
  const direction = sort.startsWith('-') ? -1 : 1
  const key = sort.replace(/^-/, '')
  return [...rows].sort((left, right) => {
    if (key === 'scenario') {
      return left.scenarioLabel.localeCompare(right.scenarioLabel) * direction
    }
    if (key === 'status') {
      return left.status.localeCompare(right.status) * direction
    }
    const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : left.completedAt ? Date.parse(left.completedAt) : 0
    const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : right.completedAt ? Date.parse(right.completedAt) : 0
    return (leftTime - rightTime) * direction
  })
}

export function applyResultFilters(rows: ResultListRowVM[], filters: ResultFiltersVM): { rows: ResultListRowVM[]; total: number; pageCount: number; page: number } {
  const normalized = filtersFromQuery({ ...filtersToQuery(filters), page: String(filters.page) })
  let filtered = rows.filter((row) => {
    if (normalized.source && normalized.source !== 'all-registered' && row.sourceKey !== normalized.source) return false
    if (normalized.status && row.status !== normalized.status) return false
    if (normalized.verification && row.verification !== normalized.verification) return false
    if (normalized.publication) {
      const eligible = normalized.publication === 'eligible'
      if (eligible !== (row.publicationEligible === true)) return false
    }
    if (normalized.q) {
      const haystack = `${row.resultKey} ${row.scenarioLabel} ${row.sourceLabel}`.toLowerCase()
      if (!haystack.includes(normalized.q.toLowerCase())) return false
    }
    return true
  })
  filtered = sortRows(filtered, normalized.sort)
  const pageCount = Math.max(1, Math.ceil(filtered.length / RESULT_PAGE_SIZE))
  const page = Math.min(normalized.page, pageCount)
  const start = (page - 1) * RESULT_PAGE_SIZE
  return {
    rows: filtered.slice(start, start + RESULT_PAGE_SIZE),
    total: filtered.length,
    pageCount,
    page,
  }
}

export function heroListRow(overrides: Partial<ResultListRowVM> = {}): ResultListRowVM {
  return {
    id: HERO_RESULT_KEY,
    resultKey: HERO_RESULT_KEY,
    sourceKey: HERO_SOURCE_KEY,
    sourceLabel: '住宿资源分配治理案例',
    mode: 'offline_hero',
    scenarioLabel: '暑期住宿床位分配正当性争议',
    status: 'pilot',
    verification: 'unverified',
    publicationEligible: false,
    completedAt: null,
    updatedAt: null,
    population: 1000,
    immutable: true,
    href: resultDetailLocation({ resultKey: HERO_RESULT_KEY, sourceKey: HERO_SOURCE_KEY }, 'summary'),
    ...overrides,
  }
}

export function lectureHeroListRow(overrides: Partial<ResultListRowVM> = {}): ResultListRowVM {
  return {
    id: LECTURE_HERO_RESULT_KEY,
    resultKey: LECTURE_HERO_RESULT_KEY,
    sourceKey: LECTURE_HERO_SOURCE_KEY,
    sourceLabel: '讲座辱骂事件治理预演',
    mode: 'offline_hero',
    scenarioLabel: '讲座辱骂事件后的校园治理回应',
    status: 'pilot',
    verification: 'unverified',
    publicationEligible: false,
    completedAt: null,
    updatedAt: null,
    population: 1000,
    immutable: true,
    href: resultDetailLocation({ resultKey: LECTURE_HERO_RESULT_KEY, sourceKey: LECTURE_HERO_SOURCE_KEY }, 'summary'),
    ...overrides,
  }
}

export function runRowFromApi(run: Record<string, any>): ResultListRowVM | null {
  const runId = typeof run?.run_id === 'string' ? run.run_id : ''
  if (!runId) return null
  const runtime = run?.runtime_summary
  const status = String(runtime?.status || run?.effective_runtime_status || run?.plan_status || run?.status || 'unknown')
  const scenarioLabel = run?.input_snapshot?.scenario_label
    || run?.input_snapshot?.scenario?.label
    || run?.input_snapshot?.scenario?.name
    || run?.scenario_id
    || '未命名场景'
  const completedAt = typeof runtime?.finished_at === 'string' ? runtime.finished_at : null
  const updatedAt = [runtime?.updated_at, run?.updated_at, runtime?.started_at, run?.created_at, completedAt]
    .find((value) => typeof value === 'string') || null
  const population = Number(run?.agent_count || 0) || null
  return {
    id: runId,
    resultKey: runId,
    sourceKey: LIVE_SOURCE_KEY,
    sourceLabel: 'Live API 结果',
    mode: 'live_api',
    scenarioLabel: String(scenarioLabel),
    status,
    verification: 'unverified',
    publicationEligible: null,
    completedAt,
    updatedAt,
    population,
    immutable: false,
    href: resultDetailLocation({ resultKey: runId, sourceKey: LIVE_SOURCE_KEY }, 'summary'),
  }
}

export function normalizeListPageRows(runs: unknown, includeHero: boolean): ResultListRowVM[] {
  const apiRows = Array.isArray(runs)
    ? runs.map((run) => runRowFromApi(run as Record<string, any>)).filter((row): row is ResultListRowVM => row !== null)
    : []
  return includeHero ? [...apiRows, heroListRow(), lectureHeroListRow()] : apiRows
}
