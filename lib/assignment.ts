import type { Condition } from './experiment-config'
import { CONDITIONS } from './experiment-config'

/**
 * Stable hash of a string → unsigned 32-bit integer.
 * Uses djb2 algorithm.
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Assign a condition to a participant.
 * If an explicit override is provided (e.g. from URL ?condition=G1), use it.
 * Otherwise, hash the PROLIFIC_PID to get a stable, reproducible assignment.
 */
export function assignCondition(
  prolificPid: string,
  override?: string | null
): Condition {
  if (override && CONDITIONS.includes(override as Condition)) {
    return override as Condition
  }
  const index = hashString(prolificPid) % 4
  return CONDITIONS[index]
}
