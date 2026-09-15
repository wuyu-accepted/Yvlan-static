import { readonly, shallowRef } from 'vue'
import type { ApiProblem } from '../contracts/api'
import { sourceStateFromRoute, type SourceState } from '../contracts/source'

const currentSource = shallowRef<SourceState>(sourceStateFromRoute(null))
const currentProblem = shallowRef<ApiProblem | null>(null)
let routeIdentity = ''

export function beginSourceRoute(identity: string, routeSource: unknown) {
  routeIdentity = identity
  currentSource.value = sourceStateFromRoute(routeSource)
  currentProblem.value = null
}

export function publishSourceState(identity: string, source: SourceState) {
  if (identity !== routeIdentity) return false
  currentSource.value = source.availability.backend === 'unknown'
    ? {
        ...source,
        availability: {
          ...source.availability,
          backend: currentSource.value.availability.backend,
        },
      }
    : source
  currentProblem.value = null
  return true
}

export function publishSourceProblem(identity: string, problem: ApiProblem) {
  if (identity !== routeIdentity) return false
  currentProblem.value = problem
  return true
}

export function publishBackendAvailability(backend: SourceState['availability']['backend']) {
  currentSource.value = {
    ...currentSource.value,
    availability: { ...currentSource.value.availability, backend },
  }
}

export function useSourceContext() {
  return {
    sourceState: readonly(currentSource),
    problem: readonly(currentProblem),
    beginSourceRoute,
    publishSourceState,
    publishSourceProblem,
    publishBackendAvailability,
  }
}
