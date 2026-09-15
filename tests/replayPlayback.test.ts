import test from 'node:test'
import assert from 'node:assert/strict'
import { INSPECTION_FRAME_MS, REPLAY_PACES, createReplayTimer, nextRecordedTick } from '../src/campus-pulse/live/replayPlayback.ts'

test('pacing is a display preference, and manual mode schedules no timer', () => {
  assert.deepEqual(REPLAY_PACES, { guided:8000, continuous:4000, quick:2000, manual:0 })
  let calls = 0
  const timer = createReplayTimer({ set: () => { calls++; return 1 }, clear: () => {} })
  timer.schedule(REPLAY_PACES.manual, () => assert.fail('manual playback advanced'))
  assert.equal(calls, 0)
})

test('advance uses only saved ticks, including sparse records and the end', () => {
  assert.equal(nextRecordedTick([10, 3, 0, 5, 5], 3), 5)
  assert.equal(nextRecordedTick([0, 3, 5, 10], 5), 10)
  assert.equal(nextRecordedTick([0, 3, 5, 10], 10), null)
  assert.equal(nextRecordedTick([], 0), null)
  assert.equal(REPLAY_PACES.guided, 8000)
  assert.equal(INSPECTION_FRAME_MS, 12000)
})

test('speed changes and pauses invalidate callbacks already queued by a browser', () => {
  const callbacks: Array<() => void> = []
  const cleared: unknown[] = []
  const timer = createReplayTimer({ set: callback => { callbacks.push(callback); return callbacks.length }, clear: handle => cleared.push(handle) })
  let advances = 0
  timer.schedule(8000, () => advances++)
  timer.schedule(2000, () => advances++)
  callbacks[0]()
  assert.equal(advances, 0)
  callbacks[1]()
  assert.equal(advances, 1)
  timer.schedule(4000, () => advances++)
  timer.cancel()
  callbacks[2]()
  assert.equal(advances, 1)
  assert.deepEqual(cleared, [1,3])
})
