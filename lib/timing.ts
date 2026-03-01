/**
 * Timing utilities using the User Timing API (performance.mark/measure).
 * All timing is done on the client side only.
 */

const MARK_SERVICE2_ENTRY = 'service2.entry'
const MARK_SERVICE2_COMPLETE = 'service2.task.complete'
const MEASURE_SERVICE2 = 'service2.duration'

export function markService2Entry(): void {
  if (typeof performance === 'undefined') return
  try {
    performance.clearMarks(MARK_SERVICE2_ENTRY)
    performance.mark(MARK_SERVICE2_ENTRY)
  } catch {
    // Ignore timing errors — they are non-fatal
  }
}

export function markService2Complete(): number | undefined {
  if (typeof performance === 'undefined') return undefined
  try {
    performance.mark(MARK_SERVICE2_COMPLETE)
    performance.clearMeasures(MEASURE_SERVICE2)
    const measure = performance.measure(
      MEASURE_SERVICE2,
      MARK_SERVICE2_ENTRY,
      MARK_SERVICE2_COMPLETE
    )
    return Math.round(measure.duration)
  } catch {
    return undefined
  }
}

export function getMonoMs(): number {
  if (typeof performance === 'undefined') return 0
  return performance.now()
}
