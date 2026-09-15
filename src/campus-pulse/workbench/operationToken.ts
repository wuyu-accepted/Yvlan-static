export interface OperationToken {
  next(): number
  isCurrent(id: number): boolean
  invalidate(): void
}

/**
 * Per-operation cancellation token. Independent operations must use their own
 * token so one slow request can never void the result of another (the shared
 * single counter bug made the Workbench show "backend unavailable" on first
 * load because loadProjects() raced probeBackend()).
 */
export function makeOperationToken(): OperationToken {
  let token = 0
  return {
    next: () => ++token,
    isCurrent: (id) => id === token,
    invalidate: () => { token += 1 },
  }
}
