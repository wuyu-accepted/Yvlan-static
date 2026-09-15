/** Display pacing only. This never schedules Provider work or changes run data. */
export const REPLAY_PACES = { guided: 8000, continuous: 4000, quick: 2000, manual: 0 } as const
export const INSPECTION_FRAME_MS = 12000
export type ReplayPace = keyof typeof REPLAY_PACES

export function nextRecordedTick(ticks: readonly number[], current: number): number | null {
  return [...new Set(ticks)].sort((a, b) => a - b).find(tick => tick > current) ?? null
}

/** One pending timer at most; restarting, inspecting and unmounting cancel it. */
export function createReplayTimer(clock = {
  set: (callback: () => void, delay: number): unknown => setTimeout(callback, delay),
  clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}) {
  let pending: unknown
  let generation = 0
  const cancel = () => {
    generation += 1
    if (pending !== undefined) clock.clear(pending)
    pending = undefined
  }
  return {
    cancel,
    schedule(delay: number, callback: () => void) {
      cancel()
      if (!Number.isFinite(delay) || delay <= 0) return
      const version = generation
      pending = clock.set(() => {
        if (version !== generation) return
        pending = undefined
        callback()
      }, delay)
    },
  }
}
