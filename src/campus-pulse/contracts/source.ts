export type SourceMode =
  | 'live_api'
  | 'audited_replay'
  | 'offline_hero'
  | 'static_archive'
  | 'unknown'

export type VerificationStatus =
  | 'verified'
  | 'unverified'
  | 'mismatch'
  | 'failed'
  | 'missing'

export type FreshnessStatus = 'fresh' | 'stale' | 'unknown'
export type BackendStatus = 'available' | 'degraded' | 'unavailable' | 'unknown'
export type AccessMode = 'interactive' | 'readonly' | 'unavailable'

export interface SourceProvenance {
  runId?: string
  scenarioId?: string
  evidenceId?: string
  provider?: string
  origin?: string
  executionProvenance?: string
  manifestId?: string
  manifestAvailable: boolean
  expectedHash?: string
  actualHash?: string
}

export interface SourceFreshness {
  status: FreshnessStatus
  fetchedAt?: string
  generatedAt?: string
  ageMs?: number
}

export interface SourceAvailability {
  backend: BackendStatus
  access: AccessMode
  degradedReason?: string
}

export interface SourceFallback {
  from: SourceMode
  reason: string
  selectedBy: 'user' | 'policy'
}

export interface SourceState {
  key: string
  mode: SourceMode
  label: string
  verification: VerificationStatus
  freshness: SourceFreshness
  availability: SourceAvailability
  provenance: SourceProvenance
  publicationEligible: boolean | null
  boundaries: string[]
  boundarySummary: string
  fallback?: SourceFallback
}

export interface ResultSourceDescriptor {
  key: string
  label: string
  mode: Extract<SourceMode, 'live_api' | 'offline_hero' | 'static_archive'>
  immutable: boolean
  resultUrl?: string
  hashUrl?: string
  manifestUrl?: string
  runId?: string
  expectedSchema: string[]
  declaredPublication: boolean | 'server'
  boundaries: string[]
}

export function unknownSourceState(boundarySummary = '当前页面尚未解析数据来源。'): SourceState {
  return {
    key: 'unknown',
    mode: 'unknown',
    label: '来源未知',
    verification: 'unverified',
    freshness: { status: 'unknown' },
    availability: { backend: 'unknown', access: 'readonly' },
    provenance: { manifestAvailable: false },
    publicationEligible: null,
    boundaries: [boundarySummary],
    boundarySummary,
  }
}

export function sourceStateFromRoute(value: unknown): SourceState {
  if (!value || typeof value !== 'object') return unknownSourceState()
  const source = value as Record<string, any>
  return {
    key: String(source.key || source.mode || 'unknown'),
    mode: source.mode || 'unknown',
    label: String(source.label || ''),
    verification: source.verification || 'unverified',
    freshness: typeof source.freshness === 'object'
      ? source.freshness
      : { status: source.freshness || 'unknown' },
    availability: source.availability || {
      backend: source.backend || 'unknown',
      access: source.access || 'readonly',
    },
    provenance: source.provenance || { manifestAvailable: false },
    publicationEligible: source.publicationEligible ?? null,
    boundaries: source.boundaries || [source.boundarySummary].filter(Boolean),
    boundarySummary: source.boundarySummary || '当前页面未声明数据边界。',
    fallback: source.fallback,
  }
}
